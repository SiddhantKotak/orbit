"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@brandloop/ui";
import { restartAction } from "@/app/onboarding/actions";

/** Reopens the setup flow with the saved answers. Never blocks the app. */
export function SetUpAgain() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="orbit-panel flex max-w-[760px] flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-labelledby="setup-again">
      <div className="min-w-0">
        <h2 id="setup-again" className="text-[14px] font-medium text-text">
          Setup
        </h2>
        <p className="mt-1 text-xs text-text-2">Go through the setup questions again to refresh your profile, voice and strategy.</p>
      </div>
      <Button variant="secondary" disabled={pending} onClick={() => startTransition(async () => {
            if ((await restartAction()).ok) router.push("/onboarding");
          })}>
        Set up again
      </Button>
    </section>
  );
}
