import { describe, expect, it } from "vitest";
import { lintPost, type LintContext } from "./lint";
import { resolveRules } from "./rules";

const ctx: LintContext = { postType: null, groundingText: null, researchDates: null, personalDetails: "allowed" };
const rules = (md = "") => resolveRules({ userRulesMarkdown: md, style: null, turn: {} });
const ids = (text: string, md = "", c: Partial<LintContext> = {}) => lintPost(text, rules(md), { ...ctx, ...c }).violations;
const find = (v: ReturnType<typeof ids>, id: string) => v.find((x) => x.id === id);

const GOOD = "Stop building the wrong thing.\n\nA proof of concept answers one question. An MVP answers a harder one.\n\nPick the harder one first.";

describe("lintPost", () => {
  it("passes a clean post with no hard violations", () => {
    expect(ids(GOOD).filter((v) => v.level === "hard")).toEqual([]);
  });

  it("lints the user's hard rules as hard, the style's as target", () => {
    const text = "Launch day — finally.\n\nBody here.";
    expect(find(ids(text, "- Don't use em dashes"), "dashes")?.level).toBe("hard");
    expect(find(ids(text), "dashes")).toBeUndefined();
    const emoji = "Launch day 🚀\n\nBody here.";
    expect(find(ids(emoji, "- No emojis"), "emoji")?.level).toBe("hard");
    expect(find(ids(emoji), "emoji")).toBeUndefined();
  });

  it("flags a hashtag line, a P.S., a link and a banned word per the rules", () => {
    const text = "Hook line.\n\nBody with synergy and https://example.com\n\nP.S. read more\n\n#ai #mvp";
    const v = ids(text, "- No keyword hashtags\n- Never add a P.S.\n- No links\n## Banned words\n- synergy");
    for (const id of ["hashtags", "links", "banned-phrase"]) expect(find(v, id)?.level, id).toBe("hard");
    expect(find(ids("Hook.\n\nBody.\n\nP.S. more", "- Never add a P.S."), "postscript")?.level).toBe("hard");
  });

  it("flags a 5-mobile-line block when the rule says at most 3", () => {
    const wall = Array.from({ length: 24 }, () => "words").join(" ") + " and then some more words to fill the lines right up";
    const v = ids(`Hook.\n\n${wall}\n\nEnd.`, "- No walls of text (>3 lines)");
    expect(find(v, "block-lines")).toMatchObject({ level: "hard", block: 1 });
  });

  it("flags a rhetorical opening only when the rule is set", () => {
    expect(find(ids("Ever wondered why?\n\nBody."), "rhetorical-opening")).toBeUndefined();
    expect(find(ids("Ever wondered why?\n\nBody.", "- Never open with a rhetorical question"), "rhetorical-opening")?.level).toBe("hard");
  });

  it("flags every-sentence-its-own-block at six blocks or more", () => {
    const text = Array.from({ length: 7 }, (_, i) => `Sentence ${i + 1} stands alone.`).join("\n\n");
    expect(find(ids(text), "one-line-blocks")?.level).toBe("target");
    expect(find(ids("A.\n\nB.\n\nC."), "one-line-blocks")).toBeUndefined();
  });

  it("flags a blank line between list items", () => {
    expect(find(ids("Hook.\n\n- one\n\n- two\n\n- three"), "list-adjacency")?.level).toBe("hard");
    expect(find(ids("Hook.\n\n- one\n- two\n- three"), "list-adjacency")).toBeUndefined();
  });

  it("measures the hook and the fold", () => {
    expect(find(ids(`${"w".repeat(120)}\n\nBody.`), "hook-length")?.level).toBe("hard");
    expect(find(ids(`${"short words here ".repeat(5).trim()}\n\nBody.`), "hook-length")?.level).toBe("target");
    const late = `${"word ".repeat(55).trim()}\n\nBody.`;
    expect(find(ids(late), "fold")?.level).toBe("target");
  });

  it("advises a list for framework and how-to posts", () => {
    expect(find(ids(GOOD, "", { postType: "framework" }), "list-expected")?.level).toBe("advice");
    expect(find(ids(GOOD, "", { postType: "story" }), "list-expected")).toBeUndefined();
  });

  it("is hard on a number the grounding does not hold, and on a date outside the research", () => {
    const text = "Hook.\n\nWe cut churn by 37% in 90 days.\n\nSources: Example (21 Oct)";
    const v = ids(text, "", { groundingText: "The user said churn fell by 90 days of work.", researchDates: ["2026-10-19"] });
    expect(find(v, "number-provenance")).toMatchObject({ level: "hard" });
    expect(find(v, "number-provenance")!.detail).toContain("37%");
    expect(find(v, "number-provenance")!.detail).not.toContain("90");
    expect(find(v, "date-provenance")?.level).toBe("hard");
    const ok = ids(text, "", { groundingText: "churn fell 37% in 90 days; published 21 Oct", researchDates: ["2026-10-21"] });
    expect(find(ok, "number-provenance")).toBeUndefined();
    expect(find(ok, "date-provenance")).toBeUndefined();
  });

  it("skips the provenance checks without context", () => {
    const v = ids("Hook.\n\nWe cut churn by 37%.");
    expect(find(v, "number-provenance")).toBeUndefined();
  });

  it("flags first-person experience claims only in personalDetails none", () => {
    const text = "Hook.\n\nI hired my first engineer last year and my client agreed.";
    expect(find(ids(text, "", { personalDetails: "none" }), "first-person")?.level).toBe("hard");
    expect(find(ids(text), "first-person")).toBeUndefined();
    expect(find(ids("Hook.\n\nFounders hire late. They regret it.", "", { personalDetails: "none" }), "first-person")).toBeUndefined();
  });

  it("flags placeholders, markdown and 3,000+ characters", () => {
    expect(find(ids("Hook.\n\nHello [Name]"), "placeholders")?.level).toBe("hard");
    expect(find(ids("Hook.\n\nThis is **bold**"), "markdown")?.level).toBe("hard");
    expect(find(ids(`Hook.\n\n${"word ".repeat(700)}`), "post-length")?.level).toBe("hard");
  });

  it("does not flag '#1', ranges or hyphenated words", () => {
    const v = ids("Hook.\n\nWe rank #1 for 3–5 week builds by co-founder teams.", "- No hashtags\n- Don't use em dashes");
    expect(v.filter((x) => x.level === "hard")).toEqual([]);
  });
});

describe("AI tells", () => {
  const tells = (text: string) => ids(text).filter((v) => ["not-just", "triad", "filler", "overused", "uniform-rhythm"].includes(v.id));
  const has = (text: string, id: string) => tells(text).some((v) => v.id === id);

  it("flags overused words and stock phrases as target", () => {
    const v = tells("Let's dive in.\n\nWe leverage a seamless, robust stack.");
    expect(v.map((x) => x.id).sort()).toEqual(["filler", "overused"]);
    expect(v.every((x) => x.level === "target")).toBe(true);
  });
  it("does not flag leverage as a noun or ordinary words", () => {
    expect(tells("Debt gives you leverage in a negotiation.\n\nShip it on Monday.")).toEqual([]);
  });
  it("flags not-just-but and It's not X. It's Y.", () => {
    expect(has("It is not just a tool, but a habit.", "not-just")).toBe(true);
    expect(has("It's not a tool. It's a habit.", "not-just")).toBe(true);
    expect(has("We are not only on Mondays open.\n\nCome by.", "not-just")).toBe(false);
    expect(has("I did not only ship it. I shipped it twice.", "not-just")).toBe(false);
  });
  it("flags triads only when two sentences have one", () => {
    expect(has("We cut cost, time, and risk.\n\nIt scales up, out, and down.", "triad")).toBe(true);
    expect(has("We cut cost, time, and risk.\n\nIt works.", "triad")).toBe(false);
  });
  it("flags uniform sentence length only from six sentences", () => {
    const flat = "We shipped the new app. It runs on every phone. Users like the new look. Sales grew a little bit. We plan more changes. The team feels very proud.";
    expect(has(flat, "uniform-rhythm")).toBe(true);
    expect(has(flat.split(". ").slice(0, 4).join(". ") + ".", "uniform-rhythm")).toBe(false);
    expect(has("Short. We shipped the new app to every single phone this week without a single crash. Done. It works. Sales doubled after the launch event, which surprised us all, even the cynics. Wow.", "uniform-rhythm")).toBe(false);
  });
});

