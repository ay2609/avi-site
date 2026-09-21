"use client";

import { useEffect, useRef } from "react";

type ClockFormat = "stamp" | "date";

const STAMP: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
};

function render(format: ClockFormat, now: Date): string {
  if (format === "date") {
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${now.getFullYear()}`;
  }
  const day = now
    .toLocaleDateString("en-GB", STAMP)
    .replace(",", "")
    .toUpperCase();
  const time = now.toLocaleTimeString("en-GB", { hour12: false });
  return `${day}  ·  ${time}`;
}

/**
 * The reader's clock, not the build's. Written straight to the node rather
 * than held in state: there is no React-visible value here, only a DOM
 * update, and it keeps server and client markup identical at hydration while
 * avoiding a re-render every second.
 */
export default function Clock({
  format = "stamp",
  className = "",
}: {
  format?: ClockFormat;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tick = () => {
      el.textContent = render(format, new Date());
    };

    tick();
    if (format === "date") return; // a date does not need a heartbeat
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [format]);

  return (
    <span ref={ref} className={className}>
      {"—"}
    </span>
  );
}
