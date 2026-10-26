"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A Link that prefetches its route on hover, keyboard focus or touch instead of when it scrolls into view.
 * Every shell link is always in view, so the default would render a dozen routes on the server per page load.
 */
export function IntentLink({ href, onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const warm = () => {
    if (typeof href === "string") router.prefetch(href);
  };
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      {...props}
    />
  );
}
