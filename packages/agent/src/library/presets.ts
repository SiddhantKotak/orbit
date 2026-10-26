/** Ten hand-written preset writing styles, validated against StyleProfileSchema. No model is involved. */
import { STYLE_SCHEMA_VERSION, StyleProfileSchema, type PostType, type StyleProfile } from "@brandloop/ai";

type Ref = [string, PostType, string];
type Def = {
  name: string;
  voice: string;
  hooks: [string[], string[]];
  rhythm: [string[], string[]];
  diction: [string[], string[]];
  moves: [string, string, string][];
  refs: [Ref, Ref, Ref];
  post: number;
  sentence: number;
  oneLine: number;
  emoji: number;
  endings: [number, number, number, number, number];
};

const range = (low: number, typical: number, high: number) => ({ low, typical, high });
const dd = ([d, n]: [string[], string[]]) => ({ do: d, dont: n });

function build(d: Def): StyleProfile {
  const [question, rule, cta, statement, sources] = d.endings;
  return StyleProfileSchema.parse({
    schemaVersion: STYLE_SCHEMA_VERSION,
    language: "en",
    voiceTarget: d.voice,
    rules: {
      hooks: dd(d.hooks),
      rhythm: dd(d.rhythm),
      formatting: dd([["Leave a blank line between ideas", "Keep each block short enough to read on a phone"], ["Use more than one emoji in a post", "Stack hashtags at the end"]]),
      diction: dd(d.diction),
      closings: dd([["End on one clear line the reader can act on or repeat"], ["Trail off with a vague summary", "Add a generic call to follow"]]),
      global: dd([["Write about one idea per post", "Prefer concrete detail to abstraction"], ["Use filler openers", "Claim results you cannot show"]]),
    },
    signatureMoves: d.moves.map(([label, pattern, useWhen]) => ({ label, pattern, useWhen })),
    finalChecks: ["The first line works without the rest", "Every sentence earns its place", "One idea, stated once"],
    layout: {
      hookChars: range(40, 80, 140),
      hookMobileLines: range(1, 2, 3),
      postChars: range(Math.round(d.post * 0.5), d.post, Math.round(d.post * 1.6)),
      blocks: range(4, 8, 14),
      blockLineMix: { one: d.oneLine, two: Math.round((1 - d.oneLine) * 0.6 * 100) / 100, threePlus: Math.round((1 - d.oneLine) * 0.4 * 100) / 100 },
      proseBlockChars: range(60, 160, 320),
      sentenceWords: range(4, d.sentence, d.sentence * 2),
      listPosts: { bullet: 0.2, numbered: 0.15 },
      emoji: { perPost: d.emoji, positions: ["line-end"] },
      hashtagsPerPost: 0,
      postscriptPercent: 0,
      linkPercent: 0,
      endings: { question, rule, cta, statement, sources },
    },
    referencePosts: d.refs.map(([text, postType, note]) => ({ text, postType, note })),
    source: { kind: "preset", postCount: 0, corpusHash: "preset", compiledAt: "2026-10-26T00:00:00.000Z", model: null },
  });
}

const DEFS: Def[] = [
  {
    name: "Blunt operator",
    voice: "A direct operator who states what works and what does not, in short sentences, with no cushioning and no hype.",
    hooks: [["Open with the verdict", "Name the cost of the mistake"], ["Warm up before the point", "Hedge with maybe or perhaps"]],
    rhythm: [["Short declarative lines", "One sentence per block when it carries weight"], ["Long compound sentences"]],
    diction: [["Plain verbs", "Numbers over adjectives"], ["Buzzwords", "Exclamation marks"]],
    moves: [["Verdict first", "[Thing] is [wrong/right]. Here is why.", "A strong stance backed by one reason"], ["Cost line", "That mistake costs [number] per [period].", "Making a flaw concrete"]],
    refs: [
      ["Weekly status meetings are a tax.\n\nFifteen people. One hour. Nothing decided.\n\nReplace them with a written update by noon Friday. Anyone with a blocker replies. The meeting only happens if someone does.\n\nWe cut four hours a week per person and lost nothing.", "opinion", "Verdict, cost, replacement."],
      ["Your onboarding doc is not the problem.\n\nNobody owns it.\n\nName one owner. Give them an hour each month. Ship it with a changelog.\n\nA doc with an owner stays true. A doc without one rots.", "how-to", "Reframe, then a fix."],
      ["Stop asking for feedback you will not use.\n\nIf the answer cannot change the plan, do not ask. You waste their time and spend your credibility.\n\nAsk only when a no would change what you do next.", "opinion", "A rule with a test."],
    ],
    post: 600, sentence: 8, oneLine: 0.55, emoji: 0, endings: [0.05, 0.5, 0.05, 0.4, 0],
  },
  {
    name: "Warm storyteller",
    voice: "A friendly narrator who opens on a small real moment, lets the scene breathe, and lands a gentle lesson at the end.",
    hooks: [["Start inside a scene", "Use a specific time or place"], ["Start with a lesson before the story"]],
    rhythm: [["Mix short and medium sentences", "Let a quiet line sit alone"], ["Rush through the scene"]],
    diction: [["Sensory, concrete nouns", "Dialogue in plain speech"], ["Corporate abstractions"]],
    moves: [["Scene to lesson", "[Moment]. [What I noticed]. [What it taught me].", "Turning an anecdote into a takeaway"], ["Quiet turn", "And then [small surprise].", "The pivot of a story"]],
    refs: [
      ["It was a Tuesday, and the coffee machine was broken again.\n\nSo six of us stood in the kitchen and talked. Really talked, for the first time in weeks.\n\nThat is where our best idea of the quarter started. Not in a workshop. By a dead machine.\n\nMake room for the unplanned hallway.", "story", "A scene with a soft lesson."],
      ["My first manager never gave me answers.\n\nShe gave me questions, then waited. It drove me mad for a year.\n\nNow I hear her voice every time I want to jump in and fix something. Waiting is a skill, and she taught it by example.", "story", "Memory, reflection, thanks."],
      ["Last spring a customer wrote to say thank you.\n\nWe had done almost nothing. We had answered quickly and kindly, that was all.\n\nIt reminded me that small courtesies are the work, not a bonus on top of it.", "story", "A small event reframed."],
    ],
    post: 900, sentence: 12, oneLine: 0.35, emoji: 0.2, endings: [0.15, 0.1, 0.05, 0.7, 0],
  },
  {
    name: "Data teacher",
    voice: "A patient analyst who explains one number at a time, shows how it was found, and says what it does and does not prove.",
    hooks: [["Lead with a surprising number", "Say what the number measures"], ["Lead with a chart description"]],
    rhythm: [["One claim per block", "Name the method in a clause"], ["Stack statistics without context"]],
    diction: [["Precise units", "Plain words for technical terms"], ["Jargon without a definition"]],
    moves: [["Number then meaning", "[Number] [unit]. That means [plain reading].", "Making a statistic land"], ["Limits line", "This does not show [overreach].", "Staying honest about the data"]],
    refs: [
      ["38 percent of our support tickets came from one confusing button.\n\nWe counted a month of tickets and tagged each by cause. One cause stood out.\n\nWe renamed the button. Tickets from it fell by two thirds.\n\nThis does not prove naming fixes everything. It shows where to look first.", "analysis", "Number, method, limit."],
      ["Average response time hid the real story.\n\nThe mean was 4 hours. The median was 40 minutes. A few very slow cases dragged the average up.\n\nReport the median and the slowest ten percent. You will fix the right thing.", "analysis", "Teaching a better measure."],
      ["Here is how to read a conversion rate.\n\nFirst, ask what counts as a visit. Second, ask what counts as a conversion. Third, check the sample size.\n\nA 10 percent rate from 20 visits tells you almost nothing.", "how-to", "A short method in three steps."],
    ],
    post: 750, sentence: 13, oneLine: 0.3, emoji: 0, endings: [0.1, 0.35, 0.05, 0.4, 0.1],
  },
  {
    name: "Contrarian analyst",
    voice: "A sharp analyst who challenges a popular belief, gives the strongest version of it, then shows where it breaks.",
    hooks: [["Quote the common belief, then push back", "Keep it to one line"], ["Attack people instead of ideas"]],
    rhythm: [["Setup, turn, evidence", "A short line right after the turn"], ["Pile on several counterpoints"]],
    diction: [["Measured, confident tone", "Concrete example over theory"], ["Insults", "Absolutes like always or never"]],
    moves: [["Common belief, flipped", "Everyone says [belief]. The data says [opposite].", "Opening a counterintuitive take"], ["Steelman", "The best case for [belief] is [case]. It still fails because [reason].", "Being fair before disagreeing"]],
    refs: [
      ["Everyone says hire fast, fire fast.\n\nThe best case for it is simple: bad hires are costly, so correct quickly.\n\nBut speed at the front produces the bad hires. Teams that slow down on hiring end up firing less.\n\nFix the input, not the exit.", "opinion", "Belief, steelman, flip."],
      ["Remote work did not kill culture.\n\nVague culture did. Offices hid the gap with free lunch and proximity.\n\nWrite down how decisions get made and who owns what. Culture becomes portable.", "opinion", "A reframe with a fix."],
      ["More meetings do not mean more alignment.\n\nAlignment is a shared answer to what we are not doing. Most teams never say it out loud.\n\nStart there and cancel half the calendar.", "analysis", "Redefining the term."],
    ],
    post: 650, sentence: 10, oneLine: 0.4, emoji: 0, endings: [0.1, 0.4, 0.05, 0.45, 0],
  },
  {
    name: "Builder in public",
    voice: "A maker sharing honest progress: what shipped, what broke, the numbers, and what comes next.",
    hooks: [["Open with a concrete result or a miss", "Include a date or a count"], ["Open with a vague announcement"]],
    rhythm: [["Short update lines", "Bullet the changes"], ["Narrate every detail"]],
    diction: [["First person, plain", "Real numbers"], ["Marketing language"]],
    moves: [["Progress log", "Shipped: [x]. Broke: [y]. Next: [z].", "A regular update"], ["Honest miss", "I expected [x]. I got [y].", "Sharing a setback"]],
    refs: [
      ["Week 6 of building in public.\n\nShipped: a faster import. Broke: the login page, twice. Next: fixing the emails.\n\nSignups are at 212. Paid users are at 9.\n\nThe import was the right call. People stayed after they tried it.", "short", "A progress log."],
      ["I expected the launch to bring 500 signups.\n\nIt brought 61.\n\nBut 14 of them wrote back with real questions. That is more useful than a spike. I am answering every one this week.", "story", "A miss, reframed."],
      ["Three things I changed this month:\n\n- Cut the setup from 9 steps to 3\n- Added an example project\n- Removed two settings nobody used\n\nActivation went from 22 to 41 percent.", "short", "A list of changes with a result."],
    ],
    post: 550, sentence: 9, oneLine: 0.45, emoji: 0.1, endings: [0.1, 0.1, 0.1, 0.7, 0],
  },
  {
    name: "Calm explainer",
    voice: "A steady teacher who breaks a hard idea into small steps, uses one analogy, and never rushes.",
    hooks: [["Pose the question the reader has", "Promise a simple answer"], ["Open with jargon"]],
    rhythm: [["Even, medium sentences", "One step per block"], ["Dense paragraphs"]],
    diction: [["Everyday words", "One clear analogy"], ["Acronyms without expansion"]],
    moves: [["Plain analogy", "Think of [concept] as [everyday thing].", "Explaining something abstract"], ["Three steps", "First [a]. Then [b]. Finally [c].", "Walking through a process"]],
    refs: [
      ["What is a cache, really?\n\nThink of it as a notepad by your desk. You write down answers you look up often, so you do not walk to the archive each time.\n\nIt is faster. It can also go stale, so you check the notepad now and then.", "how-to", "Question, analogy, caveat."],
      ["How do you give feedback that lands?\n\nFirst, name what you saw, not what you assume. Then say the effect it had. Finally, ask what they think.\n\nThat order keeps people listening.", "how-to", "Three calm steps."],
      ["Why does a budget feel hard?\n\nBecause it asks you to decide in advance what matters. That is the work.\n\nThe spreadsheet only records the choice.", "analysis", "Reframing difficulty."],
    ],
    post: 700, sentence: 12, oneLine: 0.3, emoji: 0, endings: [0.2, 0.25, 0.05, 0.5, 0],
  },
  {
    name: "Punchy minimalist",
    voice: "A writer of very short posts: one idea, a handful of words per line, white space doing the work.",
    hooks: [["One line, under ten words", "A claim or a contrast"], ["Two-part setups"]],
    rhythm: [["One line per block", "Cut every filler word"], ["Paragraphs"]],
    diction: [["Single-syllable words when possible", "Strong verbs"], ["Qualifiers", "Adverbs"]],
    moves: [["Twin lines", "[A]. Not [B].", "A tight contrast"], ["Rule of one", "One [thing]. Do it well.", "Closing with focus"]],
    refs: [
      ["Do less.\n\nShip it.\n\nThen do less again.", "short", "Three lines."],
      ["Busy is not a result.\n\nA finished thing is.\n\nPick one. Finish it today.", "short", "Contrast and a nudge."],
      ["Good writing is rewriting.\n\nCut the first line.\n\nNow it starts.", "short", "A craft tip in three beats."],
    ],
    post: 160, sentence: 4, oneLine: 0.9, emoji: 0, endings: [0, 0.4, 0, 0.6, 0],
  },
  {
    name: "Coach",
    voice: "An encouraging mentor who speaks to you directly, gives one practical step, and believes you can do it.",
    hooks: [["Address the reader as you", "Name a feeling they know"], ["Talk about yourself first"]],
    rhythm: [["Direct second person", "Short imperative lines"], ["Passive voice"]],
    diction: [["Encouraging but specific", "Action verbs"], ["Empty praise"]],
    moves: [["Name it, then one step", "If you feel [x], try [one action] today.", "Giving a doable next step"], ["Permission line", "You are allowed to [x].", "Easing pressure"]],
    refs: [
      ["If you feel stuck, make the task smaller.\n\nNot 'write the report'. Write the first heading.\n\nSmall steps are still steps. Do one in the next ten minutes.", "how-to", "Name the feeling, then a step."],
      ["You are allowed to say no.\n\nNot rudely. Clearly. 'I cannot take that on this week, but I can on the 14th.'\n\nA clear no protects every yes that follows.", "how-to", "Permission plus a script."],
      ["Before your next hard conversation, write one sentence.\n\nWhat do you want to be true when it ends?\n\nHold that sentence. It will steady you when the talk wanders.", "how-to", "A preparation habit."],
    ],
    post: 650, sentence: 10, oneLine: 0.4, emoji: 0.1, endings: [0.2, 0.3, 0.2, 0.3, 0],
  },
  {
    name: "Curator",
    voice: "A well-read guide who picks a few good things, says why each is worth the time, and credits the source.",
    hooks: [["Promise a short, chosen list", "Say who it is for"], ["Promise everything on a topic"]],
    rhythm: [["Numbered list with one line of reason each", "Link-free body text"], ["Long summaries"]],
    diction: [["Specific praise with a reason", "Credit by name"], ["Hype words like must-read"]],
    moves: [["Pick and reason", "[Item]: worth it for [specific reason].", "Each entry in a list"], ["Who it is for", "Best if you [situation].", "Helping readers choose"]],
    refs: [
      ["Three essays on focus worth your lunch break.\n\n1. On shallow days: short, honest, practical.\n2. On saying no: a clear script you can reuse.\n3. On deep work rituals: the best examples I have seen.\n\nBest if you work on a team that pings a lot.", "short", "A short chosen list."],
      ["Four tools that quietly improved my week:\n\n1. A plain text notes app: no setup\n2. A shared calendar view: fewer back-and-forth emails\n3. A timer: honest about how long things take\n4. A weekly review template: five minutes\n\nSources are linked in the first comment.", "short", "A list with reasons."],
      ["Reading list for new managers.\n\nStart with the book on feedback. It is short and full of examples. Then the one on running one-to-ones.\n\nSkip the rest until you have a team to try it on.", "short", "Opinionated ordering."],
    ],
    post: 600, sentence: 10, oneLine: 0.35, emoji: 0, endings: [0.1, 0.1, 0.1, 0.2, 0.5],
  },
  {
    name: "Founder memo",
    voice: "A founder writing to the whole company: reasoned, accountable, explicit about the decision and the tradeoff.",
    hooks: [["State the decision up front", "Say what changes and when"], ["Bury the news"]],
    rhythm: [["Context, decision, reasoning, next step", "Short paragraphs"], ["Passive announcements"]],
    diction: [["We and I, owning the call", "Name the tradeoff"], ["Euphemisms"]],
    moves: [["Decision and tradeoff", "We are [doing x]. The cost is [y]. We accept it because [z].", "Announcing a hard call"], ["What happens next", "By [date], [owner] will [action].", "Closing with accountability"]],
    refs: [
      ["We are pausing the mobile app.\n\nThe cost: some users will wait longer for it. We accept that because the web product still has gaps that lose customers.\n\nBy March we revisit with real numbers. Until then every engineer works on the web.", "opinion", "Decision, cost, date."],
      ["Starting next quarter, we publish our pricing logic.\n\nI used to think this gave competitors an edge. I now think hiding it costs us trust.\n\nThe page goes up on the first. Questions to me directly.", "opinion", "A change of mind, explained."],
      ["A note on last month's outage.\n\nThe cause was ours: a change shipped without a rollback. Customers lost about two hours.\n\nWe now require a rollback plan on every release. I will report on it in the next update.", "story", "Accountability with a fix."],
    ],
    post: 750, sentence: 12, oneLine: 0.3, emoji: 0, endings: [0.05, 0.2, 0.1, 0.65, 0],
  },
];

export type PresetStyle = { slug: string; name: string; profile: StyleProfile };

export function presetStyles(): PresetStyle[] {
  return DEFS.map((d) => ({ slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: d.name, profile: build(d) }));
}
