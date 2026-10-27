"use client";

import { Button, Hint, Input, Label, NativeSelect } from "@brandloop/ui";
import { AUDIENCE_LEVELS, CONTENT_TYPES, FORMATS, GOALS } from "@brandloop/ai/constants";
import type { Strategy } from "@brandloop/ai/schemas";
import { textareaClass } from "@/components/dialog-classes";

const WEEKDAYS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" } as const;
const MAX_PILLARS = 5;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="orbit-panel flex flex-col gap-4 !rounded-[18px] p-5">
      <h2 className="text-[15px] font-medium text-text">{title}</h2>
      {children}
    </section>
  );
}

/** The editable review of a drafted strategy. Edits stay in the page; nothing is saved until the person confirms. */
export function StrategyReview({
  draft,
  drafting,
  onChange,
  onRetry,
}: {
  draft: Strategy | null;
  drafting: boolean;
  onChange: (s: Strategy) => void;
  onRetry: () => void;
}) {
  if (!draft) {
    return (
      <div role="status" className="orbit-panel flex flex-col items-start gap-3 !rounded-[18px] p-5">
        <p className="text-[14px] text-text-2">{drafting ? "Drafting your strategy from your answers…" : "We couldn't draft your strategy yet."}</p>
        {!drafting && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  const set = (patch: Partial<Strategy>) => onChange({ ...draft, ...patch });
  const total = draft.contentMix.reduce((a, m) => a + (Number.isFinite(m.percent) ? m.percent : 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <Section title="Positioning">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sr-positioning">How you want to be known</Label>
          <textarea id="sr-positioning" rows={2} value={draft.positioning} onChange={(e) => set({ positioning: e.target.value })} className={textareaClass} />
          <Hint>{draft.positioningWhy}</Hint>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sr-tagline">Tagline</Label>
          <Input id="sr-tagline" value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sr-goal">Goal</Label>
          <NativeSelect id="sr-goal" value={draft.goal} onChange={(e) => set({ goal: e.target.value as Strategy["goal"] })}>
            {Object.entries(GOALS).map(([id, g]) => (
              <option key={id} value={id}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
          <Hint>{draft.goalWhy}</Hint>
        </div>
      </Section>

      <Section title="Content pillars">
        <ul className="flex flex-col gap-4">
          {draft.recurringSeries.map((s, i) => (
            <li key={i} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`sr-pillar-${i}`} className="sr-only">
                    Pillar {i + 1} name
                  </Label>
                  <Input id={`sr-pillar-${i}`} value={s.name} onChange={(e) => set({ recurringSeries: draft.recurringSeries.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                </div>
                <NativeSelect aria-label={`Pillar ${i + 1} day`} className="w-[130px] shrink-0" value={s.weekday} onChange={(e) => set({ recurringSeries: draft.recurringSeries.map((x, j) => (j === i ? { ...x, weekday: e.target.value as keyof typeof WEEKDAYS } : x)) })}>
                  {Object.entries(WEEKDAYS).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
                <Button variant="ghost" size="sm" aria-label={`Remove pillar ${i + 1}`} disabled={draft.recurringSeries.length <= 1} onClick={() => set({ recurringSeries: draft.recurringSeries.filter((_, j) => j !== i) })}>
                  Remove
                </Button>
              </div>
              <Label htmlFor={`sr-pillar-d-${i}`} className="sr-only">
                Pillar {i + 1} description
              </Label>
              <Input id={`sr-pillar-d-${i}`} value={s.description} onChange={(e) => set({ recurringSeries: draft.recurringSeries.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
            </li>
          ))}
        </ul>
        {draft.recurringSeries.length < MAX_PILLARS && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => set({ recurringSeries: [...draft.recurringSeries, { name: "New pillar", weekday: "thu", description: "What this pillar covers" }] })}>
            Add a pillar
          </Button>
        )}
      </Section>

      <Section title="Content mix">
        <ul className="grid gap-3 sm:grid-cols-2">
          {draft.contentMix.map((m, i) => (
            <li key={m.type} className="flex items-center justify-between gap-3">
              <Label htmlFor={`sr-mix-${m.type}`}>{CONTENT_TYPES[m.type].label}</Label>
              <span className="flex items-center gap-1.5">
                <Input id={`sr-mix-${m.type}`} type="number" min={0} max={100} className="w-20" value={m.percent} onChange={(e) => set({ contentMix: draft.contentMix.map((x, j) => (j === i ? { ...x, percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)) })} />
                <span className="text-xs text-text-2">%</span>
              </span>
            </li>
          ))}
        </ul>
        <Hint>
          {total === 100 ? "Adds up to 100%." : `Adds up to ${total}%. It is scaled to 100% when you confirm.`} Audience: {draft.audienceBalance.map((a) => `${AUDIENCE_LEVELS[a.level].label} ${a.percent}%`).join(", ")}.
        </Hint>
      </Section>

      <Section title="Posts per week">
        <ul className="grid gap-3 sm:grid-cols-2">
          {draft.contentFormats.map((f, i) => (
            <li key={f.format} className="flex items-center justify-between gap-3">
              <Label htmlFor={`sr-fmt-${f.format}`}>{FORMATS[f.format].label}</Label>
              <Input id={`sr-fmt-${f.format}`} type="number" min={0} max={14} className="w-20" value={f.perWeek} onChange={(e) => set({ contentFormats: draft.contentFormats.map((x, j) => (j === i ? { ...x, perWeek: Math.max(0, Math.min(14, Number(e.target.value) || 0)) } : x)) })} />
            </li>
          ))}
        </ul>
        <Hint>{draft.contentFormats.reduce((a, f) => a + f.perWeek, 0)} posts a week in total.</Hint>
      </Section>
    </div>
  );
}
