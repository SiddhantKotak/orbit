"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@brandloop/ui";
import { dialogActionsClass, dialogContentClass, dialogDescriptionClass, dialogOverlayClass, dialogTitleClass } from "@/components/dialog-classes";
import type { StyleSummary } from "@/lib/style-summary";

type Version = { version: number; createdAt: string };

/** An own style's kept versions (newest first). Automatic learning from edits writes one per change; Revert saves an older one again. */
function StyleHistory({ styleId }: { styleId: string }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/voice/${encodeURIComponent(styleId)}/versions`).catch(() => null);
    if (res?.ok) setVersions(((await res.json()) as { versions: Version[] }).versions);
  }, [styleId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function revert(version: number) {
    setBusy(version);
    setError(null);
    const res = await fetch(`/api/voice/${encodeURIComponent(styleId)}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version }),
    }).catch(() => null);
    if (!res?.ok) setError("Couldn't revert this version");
    await load();
    setBusy(null);
  }
  if (!versions || versions.length < 2) return null;
  return (
    <section data-style-history aria-label="History" className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-text">History</h3>
      <p className="text-xs text-text-3">Your style also adapts when you edit drafts. Each change is saved here.</p>
      <ul className="flex flex-col gap-1">
        {versions.map((v, i) => (
          <li key={v.version} data-style-version={v.version} className="flex items-center justify-between gap-3 text-[13px] text-text-2">
            <span>
              Version {v.version} · {new Date(v.createdAt).toLocaleString()}
              {i === 0 ? " · current" : ""}
            </span>
            {i > 0 && (
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void revert(v.version)}>
                Revert
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

type Result = { id: string; style: StyleSummary } | { id: string; error: string };

/**
 * What a writing style does, measured: its name, tagline, layout in one line and one reference post. Read from
 * /api/voice/:id, which only answers for presets and the current profile's own style.
 */
export function StyleDetailsSheet({ styleId, onClose }: { styleId: string | null; onClose: () => void }) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!styleId) return;
    let live = true;
    fetch(`/api/voice/${encodeURIComponent(styleId)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as StyleSummary & { error?: string };
        if (!live) return;
        setResult(res.ok ? { id: styleId, style: body } : { id: styleId, error: body.error ?? "Couldn't load this writing style" });
      })
      .catch(() => live && setResult({ id: styleId, error: "Couldn't load this writing style" }));
    return () => {
      live = false;
    };
  }, [styleId]);

  // The answer counts only for the style it was asked for; until then the sheet is loading.
  const current = result && result.id === styleId ? result : null;
  const style = current && "style" in current ? current.style : null;
  const error = current && "error" in current ? current.error : null;
  return (
    <Dialog.Root open={styleId !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={dialogOverlayClass} />
        <Dialog.Content className={`${dialogContentClass} max-w-lg`} aria-describedby={undefined}>
          <Dialog.Title className={dialogTitleClass}>{style ? (style.own ? "Your style" : style.name) : "Writing style"}</Dialog.Title>
          {!current && <p className={dialogDescriptionClass}>Loading…</p>}
          {error && (
            <p role="alert" className="mt-2 text-[14px] text-danger">
              {error}
            </p>
          )}
          {style && (
            <div data-style-details className="mt-2 flex flex-col gap-4">
              <p className={dialogDescriptionClass}>{style.tagline}</p>
              {style.status !== "READY" ? (
                <p data-style-status role="status" className="text-[14px] text-text-2">
                  {style.status === "FAILED" ? (style.statusDetail ?? "Couldn't learn this style.") : `Analysing ${style.analyzedPostCount || "your"} posts…`}
                </p>
              ) : style.profile ? (
                <>
                  <p data-style-layout className="text-[13px] font-medium text-text">
                    {style.profile.layoutLine}
                  </p>
                  <p className="text-[14px] leading-[1.55] text-text-2">{style.profile.voiceTarget}</p>
                  <figure className="light rounded-card bg-panel p-4 text-text">
                    <figcaption className="mb-2 text-xs text-text-3">Example post · {style.profile.referencePost.note}</figcaption>
                    <div data-style-reference className="whitespace-pre-wrap break-words text-[14px] leading-[1.5]">
                      {style.profile.referencePost.text}
                    </div>
                  </figure>
                </>
              ) : (
                <p className="text-[14px] text-text-2">This style was saved as a short description, without measured layout.</p>
              )}
              {style.own && <StyleHistory styleId={style.id} />}
            </div>
          )}
          <div className={dialogActionsClass}>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
