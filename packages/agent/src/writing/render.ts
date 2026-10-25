/** The writer returns blocks; the server renders the text (design §4.1). List items are always adjacent, blocks blank-separated. */
export type WriterBlock = { kind: "hook" | "prose" | "bullets" | "numbered" | "close" | "sources"; lines: string[] };

const MARKER = /^\s*(?:[-•*]|\d+[.)])\s+/;

export function renderBlocks(blocks: WriterBlock[], opts: { bullet: "-" | "•"; numbered: boolean }): string {
  return blocks
    .map((b) => {
      const all = b.lines.map((l) => l.trim()).filter(Boolean);
      if (b.kind !== "bullets" && b.kind !== "numbered") return all.join("\n");
      // A list may open with a lead-in line ending in a colon; it stays unmarked and adjacent to the items.
      const lead = all.length > 1 && all[0]!.endsWith(":") && !MARKER.test(all[0]!) ? [all[0]!] : [];
      const items = all.slice(lead.length);
      const marked =
        b.kind === "bullets"
          ? items.map((l) => `${opts.bullet} ${l.replace(MARKER, "")}`)
          : items.map((l, i) => `${opts.numbered ? `${i + 1}.` : opts.bullet} ${l.replace(MARKER, "")}`);
      return [...lead, ...marked].join("\n");
    })
    .filter((b) => b.trim() !== "")
    .join("\n\n");
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The post's Sources line, written by the server from cited research items only (design §6.1): the writer never types a URL.
 * "Sources: OpenAI (21 Oct) https://…, Microsoft (19 Oct) https://…".
 */
export function renderSourcesBlock(
  items: { id: string; publisher: string; url: string; published: string | null; eventDate: string | null }[],
  cited: string[],
): WriterBlock | null {
  const used = items.filter((i) => cited.includes(i.id));
  if (used.length === 0) return null;
  const day = (i: (typeof used)[number]) => {
    const d = i.eventDate ?? i.published;
    return d ? ` (${Number(d.slice(8, 10))} ${MONTH[Number(d.slice(5, 7)) - 1]})` : "";
  };
  return { kind: "sources", lines: [`Sources: ${used.map((i) => `${i.publisher}${day(i)} ${i.url}`).join(", ")}`] };
}
