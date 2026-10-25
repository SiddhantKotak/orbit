"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import type { OptionsPanel as PanelData } from "@brandloop/agent/client";
import { cn } from "@brandloop/ui";

/** The row to focus after an arrow key (wrapping), or null for any other key. */
export function nextFocus(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * The choices a reply asks for, docked above the composer: the question, numbered rows (label and a one-line why),
 * a "Suggested" badge on the recommended one, and a hint that the composer takes a different answer. Arrow keys move
 * between rows, Enter or click picks, Esc (or the close button) hides it.
 */
export function OptionsPanel({
  panel,
  onPick,
  onClose,
  disabled = false,
}: {
  panel: PanelData;
  onPick: (optionId: string) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <section
      aria-labelledby="options-panel-title"
      data-options-panel=""
      className="msg-arrive orbit-panel mb-3 overflow-hidden rounded-card-sm border border-line-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
          return;
        }
        const at = rows.current.findIndex((r) => r === document.activeElement);
        const to = nextFocus(e.key, at, panel.options.length);
        if (to !== null) {
          e.preventDefault();
          rows.current[to]?.focus();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5 sm:px-5">
        <h2 id="options-panel-title" className="font-display text-[17px] font-medium leading-snug text-text">
          {panel.question}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close options"
          className="orbit-transition -mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-text-3 hover:bg-panel-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text max-md:size-11"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <ol className="flex flex-col px-2 pb-1">
        {panel.options.map((o, i) => (
          <li key={o.id}>
            <button
              type="button"
              ref={(el) => {
                rows.current[i] = el;
              }}
              disabled={disabled}
              data-option={o.id}
              onClick={() => onPick(o.id)}
              className={cn(
                "orbit-transition flex w-full items-start gap-3 rounded-[12px] px-3 py-2.5 text-left hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-text disabled:pointer-events-none disabled:opacity-50 sm:px-3.5",
              )}
            >
              <span aria-hidden="true" className="mt-px grid size-6 shrink-0 place-items-center rounded-full border border-line-3 text-[12px] font-medium text-text-2">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span data-option-label="" className="flex flex-wrap items-center gap-2 text-[15px] font-medium leading-snug text-text">
                  {o.label}
                  {o.id === panel.recommendedOptionId && (
                    <span data-suggested="" className="inline-flex h-5 items-center rounded-pill bg-accent-wash px-2 text-[11px] font-medium text-accent-text">
                      Suggested
                    </span>
                  )}
                </span>
                <span className="text-[13px] leading-[1.45] text-text-3">{o.explainer}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {panel.allowFreeInput && (
        <p className="border-t border-line-row px-4 py-2.5 text-[13px] text-text-3 sm:px-5" data-options-hint="">
          {panel.freeInputPlaceholder} Type it below.
        </p>
      )}
    </section>
  );
}
