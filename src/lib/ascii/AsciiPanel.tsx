"use client";

import { type CSSProperties, useEffect, useRef } from "react";

import { ASCII_FIELDS, ASCII_RAMPS, type AsciiFieldId } from "./fields";

interface AsciiPanelProps {
  field: AsciiFieldId;
  /** Refresh rate. Well below display refresh; the globe needs the frames. */
  fps?: number;
  className?: string;
  /** Overrides for the text (font size, line height, colour) — inline, so they win. */
  style?: CSSProperties;
}

/**
 * Renders a field as ASCII that fills whatever box it is given. The character
 * grid is derived from the measured cell size, so the art bleeds to the edges
 * of its section instead of sitting inside one at a fixed size.
 */
export default function AsciiPanel({
  field,
  fps = 18,
  className = "",
  style,
}: AsciiPanelProps) {
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;

    const fn = ASCII_FIELDS[field];
    const ramp = ASCII_RAMPS[field];
    const maxIndex = ramp.length - 1;
    const frameInterval = 1000 / fps;

    let cols = 0;
    let rows = 0;
    let scaleX = 1;
    let scaleY = 1;
    let line: string[] = [];
    let out: string[] = [];

    /**
     * Measure a real glyph rather than assuming an aspect ratio: the ratio
     * differs per font and is what keeps a circle circular.
     */
    const measure = (): boolean => {
      const probe = document.createElement("span");
      probe.textContent = "0".repeat(40);
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "pre";
      el.appendChild(probe);
      const charWidth = probe.getBoundingClientRect().width / 40;
      probe.remove();

      const styles = getComputedStyle(el);
      const lineHeight =
        parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.15;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (!charWidth || !lineHeight || !width || !height) return false;

      const nextCols = Math.max(8, Math.floor(width / charWidth));
      const nextRows = Math.max(4, Math.floor(height / lineHeight));
      if (nextCols === cols && nextRows === rows) return false;

      cols = nextCols;
      rows = nextRows;

      // Hand the field a square coordinate space so circles stay circular.
      const visualWidth = cols * charWidth;
      const visualHeight = rows * lineHeight;
      const shorter = Math.min(visualWidth, visualHeight);
      scaleX = visualWidth / shorter;
      scaleY = visualHeight / shorter;

      line = new Array(cols);
      out = new Array(rows);
      return true;
    };

    const draw = (seconds: number) => {
      if (!cols || !rows) return;
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

    measure();

    let lastSeconds = 0;

    const resizeObserver = new ResizeObserver(() => {
      if (measure()) draw(lastSeconds);
    });
    resizeObserver.observe(el);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      draw(0);
      return () => resizeObserver.disconnect();
    }

    let raf = 0;
    let lastFrame = 0;
    const start = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastFrame < frameInterval) return;
      // Hidden (e.g. the stage's backdrop while no article is open): skip the work.
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true, checkVisibilityCSS: true })) return;
      lastFrame = now;
      lastSeconds = (now - start) * 0.001;
      draw(lastSeconds);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [field, fps]);

  return (
    <pre
      ref={preRef}
      aria-hidden="true"
      className={`font-mono-ui block h-full w-full select-none overflow-hidden whitespace-pre text-[10px] leading-[1.15] text-ascii ${className}`}
      style={style}
    />
  );
}
