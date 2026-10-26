"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cancelFrame, frame } from "motion/react";

const options = {
  lerp: 0.12,
  duration: 1.1,
  smoothWheel: true,
  syncTouch: false,
  autoRaf: false,
  anchors: true,
  autoResize: true,
} as const;

/**
 * Same wrapper/content shape as `SmoothScroll`, but Lenis is imported after first paint (idle) and attached to the
 * already-rendered scroller, so it stays out of the initial JavaScript and the page never remounts.
 */
export function DeferredSmoothScroll({ children, className }: { children: ReactNode; className?: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const start = () => {
      void import("lenis").then(({ default: Lenis }) => {
        if (cancelled || !wrapper.current || !content.current) return;
        const lenis = new Lenis({ ...options, wrapper: wrapper.current, content: content.current });
        const update = (data: { timestamp: number }) => lenis.raf(data.timestamp);
        frame.update(update, true);
        destroy = () => {
          cancelFrame(update);
          lenis.destroy();
        };
      });
    };
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(start, { timeout: 1500 }) : window.setTimeout(start, 300);
    return () => {
      cancelled = true;
      if (idle) (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
      destroy?.();
    };
  }, []);
  return (
    <div ref={wrapper} className={className}>
      <div ref={content}>{children}</div>
    </div>
  );
}
