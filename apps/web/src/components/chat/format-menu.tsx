"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { CATEGORIES, FRAMEWORKS } from "@brandloop/agent/client";
import { Button, cn } from "@brandloop/ui";
import { CloseIcon, SearchIcon } from "@brandloop/ui/icons";

type Option = { id: string | null; name: string; hint: string; group: string };

const AUTO: Option = { id: null, name: "Let Orbit choose", hint: "Match the structure to the post", group: "" };
const STRUCTURES: Option[] = FRAMEWORKS.map((f) => ({ id: f.id, name: f.name, hint: f.description, group: "Structures" }));
const PAGE = 100;

type ApiTemplate = { slug: string; category: string; title: string; why: string };
const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const toOption = (t: ApiTemplate): Option => ({ id: t.slug, name: t.title, hint: t.why, group: categoryLabel(t.category) });

/**
 * The composer's Format menu (design §5): "Let Orbit choose" (the default), the six structures, and the templates grouped
 * by category, with search. The pick shows as a removable chip and applies to the next message only.
 */
export function FormatMenu({ value, onChange, disabled, valueName }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean; valueName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const [templates, setTemplates] = useState<Option[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState<Record<string, string>>({});
  const q = query.trim().toLowerCase();

  // Templates come from the library in the database: searched on the server, newest page appended on "Show more".
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const t = setTimeout(() => void load(0, true, ctl.signal), q ? 200 : 0);
    return () => (clearTimeout(t), ctl.abort());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);

  async function load(offset: number, replace: boolean, signal?: AbortSignal) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "POST", offset: String(offset), limit: String(PAGE) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/templates?${params}`, { signal });
      if (!res.ok) return;
      const body = (await res.json()) as { items: ApiTemplate[]; total: number };
      const opts = body.items.map(toOption);
      setTemplates((prev) => (replace ? opts : [...prev, ...opts]));
      setTotal(body.total);
      setKnown((k) => ({ ...k, ...Object.fromEntries(body.items.map((t) => [t.slug, t.title])) }));
    } catch {
      /* aborted or offline: keep what is shown */
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  const shown = useMemo(() => {
    const fixed = [AUTO, ...STRUCTURES].filter((o) => !q || `${o.name} ${o.hint} ${o.group}`.toLowerCase().includes(q));
    return [...fixed, ...templates];
  }, [q, templates]);
  const groups = [...new Set(shown.map((o) => o.group))];
  const name = value === null ? null : (FRAMEWORKS.find((f) => f.id === value)?.name ?? known[value] ?? valueName ?? null);

  return (
    <>
      <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), o && setQuery(""))}>
        <Popover.Trigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label="Format" title="Choose a post format">
            <span>Format</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label="Choose a post format"
            align="start"
            side="top"
            sideOffset={8}
            collisionPadding={16}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).querySelector("input")?.focus();
            }}
            className="orbit-panel z-50 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-card p-0 shadow-[var(--panel-highlight),var(--shadow-draft)] data-[state=open]:animate-[orbit-pop_200ms_var(--ease-out)_both]"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <SearchIcon size={16} className="shrink-0 text-text-2" />
              <input
                aria-label="Search formats"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search formats"
                className="h-12 w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-3"
              />
            </div>
            <div id={listId} role="listbox" aria-label="Formats" data-lenis-prevent className="max-h-[min(380px,55dvh)] overflow-y-auto p-1.5">
              {shown.length === 0 && !loading && <p className="px-3 py-6 text-center text-[13px] text-text-2">No format matches that.</p>}
              {groups.map((g) => (
                <div key={g || "default"} role="group" aria-label={g || "Default"}>
                  {g && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-text-3">{g}</p>}
                  {shown
                    .filter((o) => o.group === g)
                    .map((o) => (
                      <button
                        key={o.id ?? "auto"}
                        type="button"
                        role="option"
                        aria-selected={o.id === value}
                        onClick={() => {
                          onChange(o.id);
                          setOpen(false);
                        }}
                        className={cn("flex w-full flex-col rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-line-row", o.id === value && "bg-line-row")}
                      >
                        <span className="text-[14px] font-medium text-text">{o.name}</span>
                        <span className="truncate text-[12px] text-text-2">{o.hint}</span>
                      </button>
                    ))}
                </div>
              ))}
              {templates.length < total && (
                <button type="button" disabled={loading} onClick={() => void load(templates.length, false)} className="mt-1 w-full rounded-[10px] px-2.5 py-2 text-center text-[13px] text-text-2 hover:bg-line-row">
                  {loading ? "Loading" : `Show more (${total - templates.length})`}
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {name && (
        <button
          type="button"
          data-format-chip
          aria-label={`Remove format: ${name}`}
          onClick={() => onChange(null)}
          className="orbit-transition inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-pill border border-line-control pl-3 pr-2 text-[12px] font-medium text-text hover:border-text-3"
        >
          <span className="truncate">{name}</span>
          <CloseIcon size={12} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
