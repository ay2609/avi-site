"use client";

import { useEffect, useRef } from "react";

import { ASCII_FIELDS, ASCII_RAMPS, type AsciiFieldId } from "./fields";

/**
 * Width of a monospace character relative to its line box, at the panel's
 * font-size and leading. Used to hand the fields a square coordinate space so
 * a circle renders as a circle rather than an ellipse.
 */
const CHAR_ASPECT = 0.55;

interface AsciiPanelProps {
  field: AsciiFieldId;
  /** Character grid. Kept small — these are texture, not detail. */
  cols?: number;
  rows?: number;
  /** Refresh rate. Well below display refresh; the globe needs the frames. */
  fps?: number;
  className?: string;
}

export default function AsciiPanel({
  field,
  cols = 34,
  rows = 20,
  fps = 18,
  className = "",
}: AsciiPanelProps) {
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;

    const fn = ASCII_FIELDS[field];
    const ramp = ASCII_RAMPS[field];
    const maxIndex = ramp.length - 1;
    const frameInterval = 1000 / fps;

    // Reused across frames so a panel allocates one array, not one per frame.
    const line: string[] = new Array(cols);
    const out: string[] = new Array(rows);

    // Map the character grid onto a square field space: the shorter visual
    // axis spans exactly [0, 1], the longer one overflows symmetrically.
    const visualWidth = cols * CHAR_ASPECT;
    const visualHeight = rows;
    const shorter = Math.min(visualWidth, visualHeight);
    const scaleX = visualWidth / shorter;
    const scaleY = visualHeight / shorter;

    const draw = (seconds: number) => {
      for (let y = 0; y < rows; y += 1) {
        const v = (y / (rows - 1) - 0.5) * scaleY + 0.5;
        for (let x = 0; x < cols; x += 1) {
          const u = (x / (cols - 1) - 0.5) * scaleX + 0.5;
          const value = fn(u, v, seconds);
          const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
          line[x] = ramp[Math.round(clamped * maxIndex)];
        }
        out[y] = line.join("");
      }
      el.textContent = out.join("\n");
    };

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      draw(0);
      return;
    }

    let raf = 0;
    let lastFrame = 0;
    const start = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;
      draw((now - start) * 0.001);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [field, cols, rows, fps]);

  return (
    <pre
      ref={preRef}
      aria-hidden="true"
      className={`font-mono-ui select-none overflow-hidden whitespace-pre text-[9px] leading-[1.06] tracking-[0.06em] text-paper-dim ${className}`}
    />
  );
}
