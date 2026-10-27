"use client";

import { useState, useTransition } from "react";
import { IntentLink as Link } from "@/components/shell/intent-link";
import { cn } from "@brandloop/ui";
import type { ChecklistItem } from "@brandloop/db";
import { dismissChecklistAction } from "@/app/onboarding/actions";

/** The getting-started card on Home. Each item's done state comes from real data; it can be dismissed for good. */
export function GettingStarted({ items }: { items: ChecklistItem[] }) {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="getting-started" className="orbit-panel w-full max-w-[760px] !rounded-[18px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="getting-started" className="text-[15px] font-medium text-text">
          Getting started <span className="font-normal text-text-2">· {done} of {items.length}</span>
        </h2>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
              if ((await dismissChecklistAction()).ok) setHidden(true);
            })}
          className="orbit-transition min-h-8 rounded-pill px-3 text-[13px] text-text-2 hover:bg-line-soft hover:text-text"
        >
          Dismiss
        </button>
      </div>
      <ul className="mt-3 flex flex-col">
        {items.map((item) => (
          <li key={item.id} data-done={item.done || undefined} className="flex min-h-10 items-center gap-3 border-t border-line first:border-t-0">
            <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[11px]", item.done ? "border-accent bg-accent text-on-accent" : "border-line-control")}>
              {item.done ? "✓" : ""}
            </span>
            {item.comingSoon ? (
              <span aria-disabled="true" className="flex flex-1 items-center justify-between gap-3 text-[14px] text-text-3">
                {item.label}
                <span className="text-xs">Coming soon</span>
              </span>
            ) : (
              <Link href={item.href} className={cn("flex-1 py-2 text-[14px] hover:underline", item.done ? "text-text-2 line-through" : "text-text")}>
                {item.label}
                {item.done && <span className="sr-only"> (done)</span>}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
