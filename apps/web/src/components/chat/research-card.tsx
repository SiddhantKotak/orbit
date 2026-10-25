import type { ToolPartLike } from "./tool-row";

type Item = { id: string; claim: string; publisher: string; url: string; published: string | null; eventDate: string | null };
type Exclusion = { claim: string; reason: string };
export type Research = { windowLabel: string; items: Item[]; exclusions: Exclusion[] };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (ymd: string | null) => (ymd ? `${Number(ymd.slice(8, 10))} ${MONTH[Number(ymd.slice(5, 7)) - 1]}` : "undated");

/** The research behind a finished researchTopic call, or null for a refusal, a failure string or anything else. */
export function researchOf(part: ToolPartLike): Research | null {
  if (part.type !== "tool-researchTopic" || part.state !== "output-available") return null;
  const o = part.output as { success?: unknown; window?: { label?: unknown }; items?: unknown; exclusions?: unknown } | undefined;
  if (o?.success !== true || !Array.isArray(o.items) || !Array.isArray(o.exclusions)) return null;
  return { windowLabel: typeof o.window?.label === "string" ? o.window.label : "", items: o.items as Item[], exclusions: o.exclusions as Exclusion[] };
}

/** The window, each dated item with its source, and how many were left out and why. */
export function ResearchCard({ research }: { research: Research }) {
  return (
    <section aria-label="Research" data-research-card className="rounded-card border border-line-3 px-4 py-3.5 text-[13px]">
      <p className="mb-2 font-medium text-text">
        Research <span data-research-window className="font-normal text-text-3">{research.windowLabel}</span>
      </p>
      {research.items.length === 0 ? (
        <p className="text-text-3">Nothing qualified inside the window.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {research.items.map((i) => (
            <li key={i.id} data-research-item className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-[52px] shrink-0 font-medium text-text">{day(i.eventDate ?? i.published)}</span>
              <span className="min-w-0 flex-1 basis-[220px] text-text-2">
                {i.claim}{" "}
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-text-3 underline underline-offset-2">
                  {i.publisher}
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      {research.exclusions.length > 0 && (
        <details data-research-excluded className="mt-2 text-text-3">
          <summary className="cursor-pointer">Excluded: {research.exclusions.length} outside the window or unverifiable</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {research.exclusions.map((e, i) => (
              <li key={i}>
                {e.claim.slice(0, 120)} ({e.reason})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
