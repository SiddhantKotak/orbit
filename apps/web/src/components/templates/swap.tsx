"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Popover } from "radix-ui";
import type { ChatUIMessage } from "@brandloop/agent/client";
import { SearchIcon } from "@brandloop/ui/icons";
import { categoryLabel, type TemplateDto } from "./labels";

export type UsedTemplate = { slug: string; title: string; category: string };
type Ctx = { used: ReadonlyMap<string, UsedTemplate>; onSwap?: (t: { slug: string; title: string }) => void; disabled: boolean };
const SwapContext = createContext<Ctx>({ used: new Map(), disabled: true });
export const SwapProvider = SwapContext.Provider;
export const useTemplateSwap = () => useContext(SwapContext);

const isTemplate = (v: unknown): v is UsedTemplate =>
  typeof v === "object" && v !== null && typeof (v as UsedTemplate).slug === "string" && typeof (v as UsedTemplate).title === "string" && typeof (v as UsedTemplate).category === "string";

/** The newest template each post was shaped by: the createDocument that wrote it, then any later swap. */
export function usedTemplates(messages: ChatUIMessage[]): Map<string, UsedTemplate> {
  const out = new Map<string, UsedTemplate>();
  for (const m of messages) {
    for (const p of m.parts as { type: string; state?: string; output?: unknown }[]) {
      if ((p.type !== "tool-createDocument" && p.type !== "tool-updateDocument") || p.state !== "output-available") continue;
      const o = p.output as { id?: unknown; template?: unknown } | undefined;
      if (o && typeof o === "object" && typeof o.id === "string" && isTemplate(o.template)) out.set(o.id, o.template);
    }
  }
  return out;
}

/** "Template: <title> · Swap" under a draft: Swap lists the templates of the same category and re-applies the one picked. */
export function TemplateLine({ docId }: { docId: string }) {
  const { used, onSwap, disabled } = useTemplateSwap();
  const t = used.get(docId);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TemplateDto[] | null>(null);
  const [query, setQuery] = useState("");
  const category = t?.category;

  useEffect(() => {
    if (!open || !category) return;
    const ctl = new AbortController();
    const p = new URLSearchParams({ type: "POST", category, limit: "100" });
    const timer = setTimeout(
      () => {
        if (query.trim()) p.set("search", query.trim());
        fetch(`/api/templates?${p}`, { signal: ctl.signal })
          .then((r) => (r.ok ? r.json() : null))
          .then((b: { items: TemplateDto[] } | null) => b && setItems(b.items))
          .catch(() => {});
      },
      query ? 200 : 0,
    );
    return () => (clearTimeout(timer), ctl.abort());
  }, [open, category, query]);

  const options = useMemo(() => (items ?? []).filter((i) => i.slug !== t?.slug), [items, t?.slug]);
  if (!t) return null;
  return (
    <p data-template-line className="flex flex-wrap items-center gap-x-2 text-[13px] text-text-3">
      <span>
        Template: <span data-template-title className="text-text-2">{t.title}</span>
      </span>
      {onSwap && (
        <>
          <span aria-hidden="true">·</span>
          <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), o && (setQuery(""), setItems(null)))}>
            <Popover.Trigger asChild>
              <button
                type="button"
                data-template-swap
                disabled={disabled}
                aria-label={`Swap the template for this post (${t.title})`}
                className="orbit-transition rounded-pill font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text disabled:opacity-40"
              >
                Swap
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                aria-label={`Other ${categoryLabel(t.category)} templates`}
                align="start"
                sideOffset={8}
                collisionPadding={16}
                className="orbit-panel z-50 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-card p-0 shadow-[var(--panel-highlight),var(--shadow-draft)] data-[state=open]:animate-[orbit-pop_200ms_var(--ease-out)_both]"
              >
                <div className="flex items-center gap-2.5 border-b border-line px-4">
                  <SearchIcon size={16} className="shrink-0 text-text-2" />
                  <input
                    aria-label="Search templates"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${categoryLabel(t.category)} templates`}
                    className="h-12 w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-3"
                  />
                </div>
                <div role="listbox" aria-label="Templates" data-lenis-prevent className="max-h-[min(340px,50dvh)] overflow-y-auto p-1.5">
                  {items === null && <p className="px-3 py-6 text-center text-[13px] text-text-2">Loading</p>}
                  {items !== null && options.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-text-2">No other template matches.</p>}
                  {options.map((o) => (
                    <button
                      key={o.slug}
                      type="button"
                      role="option"
                      aria-selected={false}
                      data-swap-option={o.slug}
                      onClick={() => {
                        setOpen(false);
                        onSwap?.({ slug: o.slug, title: o.title });
                      }}
                      className="flex w-full flex-col rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-line-row"
                    >
                      <span className="text-[14px] font-medium text-text">{o.title}</span>
                      <span className="truncate text-[12px] text-text-2">{o.why}</span>
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </>
      )}
    </p>
  );
}
