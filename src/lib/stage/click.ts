"use client";

import { useRef } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";

/**
 * How far a press may travel and still count as a click, in px. Past it the
 * press was a drag — the globe orbits on the page — and opens nothing.
 */
export const CLICK_SLOP = 6;

/**
 * A single click opens an article (Sep 29; it used to take a double-click or
 * the `OPEN — /<id> ↗` control). Spread the result onto whatever the reader
 * clicks. Two presses don't count as a click:
 *  - the end of a drag;
 *  - the second click of a double-click, which would push the route twice and
 *    leave Esc needing two presses to get home.
 * Enter opens too, for keyboard focus. Pass `undefined` to disable.
 */
export function useOpenOnClick(onOpen: (() => void) | undefined) {
  const down = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDownCapture: (e: PointerEvent) => {
      down.current = { x: e.clientX, y: e.clientY };
    },
    onClick: (e: MouseEvent) => {
      const from = down.current;
      down.current = null;
      if (!onOpen || e.detail > 1) return;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > CLICK_SLOP) return;
      onOpen();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (!onOpen || e.key !== "Enter" || e.target !== e.currentTarget) return;
      e.preventDefault();
      onOpen();
    },
  };
}
