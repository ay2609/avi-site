/**
 * The motion engine for the stage, on GSAP.
 *
 * One transition, two variants, both directions:
 *
 *   iris  — a clip mask widens from the lead's slot to the viewport. Inside it
 *           the stage is already laid out; the globe grows at the mask's rate,
 *           so what the eye sees is the frame around the globe opening. The
 *           newspaper does not move.
 *   rule  — the slot's four dashed edges travel outward to become the stage's
 *           rules, and the newspaper is pushed off the grid along the axes:
 *           masthead up, rail right, below-fold down.
 *
 * Text never travels. The newspaper's labels stay where they are (covered or
 * pushed); the stage's labels are typed in once everything has landed.
 *
 *   OPEN   "fly"   0.08  globe flies · mask opens · rules /   0.80  expo.inOut
 *                        push (rule variant)
 *          "land"  0.72  stage labels type in                0.40
 *   CLOSE  the same timeline built the other way, at 1.25× speed.
 */
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(Flip, SplitText, CustomEase, useGSAP);

export { gsap, Flip, SplitText, useGSAP };

// Dev only: lets the console drive the ticker by hand, which is how the
// transition is verified from a browser whose tab is hidden.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __gsap?: unknown }).__gsap = { gsap };
}

/**
 * iris — the frame widens.
 * rule — the rules travel and the page is pushed off the grid.
 */
export type Variant = "iris" | "rule";
export const VARIANTS: Variant[] = ["iris", "rule"];

export const EASE = {
  travel: "expo.inOut",
  arrive: "expo.out",
  leave: "expo.in",
} as const;

export const T = {
  fly: 0.8,
  type: 0.4,
  closeSpeed: 1.25,
  flyAt: 0.08,
  landAt: 0.72,
} as const;

/** Gutter between the expanded globe and the viewport edge — the label bands live here. */
export const STAGE_GUTTER = 64;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const box = (r: DOMRect): Box => ({
  top: r.top,
  left: r.left,
  width: r.width,
  height: r.height,
});

/** Where the globe sits when expanded: a centred square inside the gutters. */
export function stageBox(): Box {
  const side = Math.max(
    120,
    Math.min(window.innerWidth, window.innerHeight) - STAGE_GUTTER * 2
  );
  return {
    top: (window.innerHeight - side) / 2,
    left: (window.innerWidth - side) / 2,
    width: side,
    height: side,
  };
}

/**
 * Pin an element to a viewport box. "doc" keeps it in the document (it
 * scrolls with the page); "fixed" pins it to the viewport.
 */
export function place(el: HTMLElement, b: Box, mode: "doc" | "fixed"): void {
  const sy = mode === "doc" ? window.scrollY : 0;
  const sx = mode === "doc" ? window.scrollX : 0;
  Object.assign(el.style, {
    position: mode === "doc" ? "absolute" : "fixed",
    top: `${b.top + sy}px`,
    left: `${b.left + sx}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
    visibility: "visible",
  });
}

/** `clip-path: inset(...)` that shows only `b`. */
export function insetTo(b: Box): string {
  const r = window.innerWidth - (b.left + b.width);
  const btm = window.innerHeight - (b.top + b.height);
  return `inset(${b.top}px ${r}px ${btm}px ${b.left}px)`;
}

export const INSET_NONE = "inset(0px 0px 0px 0px)";

/** How far a pushed section travels to leave the viewport, by its edge. */
export function pushDistance(
  el: HTMLElement,
  dir: "up" | "right" | "down"
): { x: number; y: number } {
  // Only what's still on screen needs to travel; anything already past the
  // edge just gets the pad, so nothing ever moves the wrong way.
  const r = el.getBoundingClientRect();
  const pad = 12;
  if (dir === "up") return { x: 0, y: -(Math.max(0, r.bottom) + pad) };
  if (dir === "right")
    return { x: Math.max(0, window.innerWidth - r.left) + pad, y: 0 };
  return { x: 0, y: Math.max(0, window.innerHeight - r.top) + pad };
}
