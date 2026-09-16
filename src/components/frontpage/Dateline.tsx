"use client";

import { useEffect, useRef } from "react";

const FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

/**
 * The date is the reader's, not the build's, so it has to be filled in on the
 * client. Written straight to the node rather than held in state: there is no
 * React-visible value here, only a DOM update, and it keeps the server and
 * client markup identical at hydration.
 */
export default function Dateline({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = new Date().toLocaleDateString("en-US", FORMAT);
  }, []);

  return (
    <span ref={ref} className={className}>
      {"—"}
    </span>
  );
}
