"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A Link that prefetches its route on hover, keyboard focus or touch instead of when it scrolls into view.
 * Every shell link is always in view, so the default would render a dozen routes on the server per page load.
 */
export function IntentLink({ onMouseEnter, onFocus, onTouchStart, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [armed, setArmed] = useState(false);
  return (
    <Link
      {...props}
      prefetch={armed ? null : false}
      onMouseEnter={(e) => {
        setArmed(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setArmed(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setArmed(true);
        onTouchStart?.(e);
      }}
    />
  );
}
