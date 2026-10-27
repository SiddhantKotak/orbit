"use client";

import { useEffect, useState } from "react";
import { IntentLink as Link } from "@/components/shell/intent-link";
import { CONTENT_TYPES } from "@brandloop/ai/constants";
import { ideaDraftHref, type Idea } from "@/lib/ideas";

/** Three post ideas built from the person's onboarding answers: one click opens a prefilled composer for a first draft. */
export function FirstIdeas() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count: 3 }), signal: ctl.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { ideas?: Idea[] };
        if (!res.ok || !body.ideas?.length) throw new Error("no ideas");
        setIdeas(body.ideas.slice(0, 3));
      })
      .catch(() => !ctl.signal.aborted && setFailed(true));
    return () => ctl.abort();
  }, []);

  if (failed) return null;
  return (
    <section aria-labelledby="first-ideas" className="w-full max-w-[760px]">
      <h2 id="first-ideas" className="mb-3 text-[14px] font-medium text-text-2">
        Three ideas to start with
      </h2>
      {ideas ? (
        <ul className="grid gap-3 md:grid-cols-3">
          {ideas.map((idea) => (
            <li key={idea.title} className="orbit-panel orbit-panel--interactive flex flex-col gap-2 !rounded-[16px] p-4">
              <span className="text-xs text-text-2">{CONTENT_TYPES[idea.contentType].label}</span>
              <span className="text-[15px] font-medium leading-snug text-text">{idea.title}</span>
              <span className="text-[13px] leading-snug text-text-2">{idea.hook}</span>
              <Link href={ideaDraftHref(idea)} className="orbit-transition mt-auto inline-flex h-8 items-center justify-center self-start rounded-pill bg-accent px-3.5 text-[13px] font-medium text-on-accent hover:bg-accent-hover">
                Draft this
                <span className="sr-only">: {idea.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="text-[13px] text-text-2">
          Finding ideas from your answers…
        </p>
      )}
    </section>
  );
}
