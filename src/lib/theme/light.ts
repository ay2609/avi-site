import { useSyncExternalStore } from "react";

import { BEND_KEY } from "./prepaint";

/**
 * Light mode, driven by the globe's bend.
 *
 * The globe publishes its bend — 0 perspective, 1 orthographic — here every
 * frame. Past FLIP_ON the site flips to light, and back to dark under
 * FLIP_OFF (the gap keeps it from flickering at the line). The theme is
 * `data-theme` on <html>, which swaps the CSS tokens (globals.css); the WebGL
 * scenes and the tinted ASCII subscribe and fade their own colours over FLIP_S.
 *
 * The bend is remembered across visits; a first visit starts fully bent if
 * the system is in light mode. The inline script in the root layout applies
 * the saved theme before the first paint (prepaint.ts) — keep the two in step.
 */
export type Theme = "dark" | "light";

const FLIP_ON = 0.55;
const FLIP_OFF = 0.45;
/** How long the flip's cross-fade takes, s (the CSS side is in globals.css). */
export const FLIP_S = 0.3;

// --- The bend ---------------------------------------------------------------

let bend: number | null = null;

/** The bend to start from: the last one saved, or full if the system prefers light. */
function initialBend(): number {
  try {
    const saved = window.localStorage.getItem(BEND_KEY);
    if (saved !== null) return Math.min(1, Math.max(0, Number(saved) || 0));
  } catch {}
  return window.matchMedia("(prefers-color-scheme: light)").matches ? 1 : 0;
}

export function getBend(): number {
  if (bend === null) bend = typeof window === "undefined" ? 0 : initialBend();
  return bend;
}

export function setBend(next: number): void {
  bend = next;
  if (next > FLIP_ON) setTheme("light");
  else if (next < FLIP_OFF) setTheme("dark");
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Remember where the bend is heading, once the wheel has stopped. */
export function saveBend(target: number): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(BEND_KEY, String(target));
    } catch {}
  }, 250);
}

// --- The theme --------------------------------------------------------------

let theme: Theme | null = null;
const themeSubs = new Set<() => void>();
let flipTimer: ReturnType<typeof setTimeout> | undefined;

export function getTheme(): Theme {
  if (theme === null) theme = typeof window === "undefined" ? "dark" : getBend() >= 0.5 ? "light" : "dark";
  return theme;
}

function setTheme(next: Theme): void {
  if (next === getTheme()) return;
  theme = next;
  const html = document.documentElement;
  html.classList.add("theme-flip");
  html.dataset.theme = next;
  clearTimeout(flipTimer);
  flipTimer = setTimeout(() => html.classList.remove("theme-flip"), FLIP_S * 1000 + 50);
  themeSubs.forEach((f) => f());
}

export function onTheme(f: () => void): () => void {
  themeSubs.add(f);
  return () => themeSubs.delete(f);
}

export function useTheme(): Theme {
  return useSyncExternalStore(onTheme, getTheme, () => "dark");
}

/**
 * A 0 → 1 dark-to-light amount that eases toward the theme over FLIP_S, for
 * colours that live outside CSS. Call `step(dt)` once a frame (dt in s); it
 * returns the amount and whether it moved.
 */
export function themeFader() {
  let t = getTheme() === "light" ? 1 : 0;
  return {
    step(dt: number): { t: number; moved: boolean } {
      const target = getTheme() === "light" ? 1 : 0;
      if (t === target) return { t, moved: false };
      const d = Math.max(dt, 0) / FLIP_S;
      t = target > t ? Math.min(target, t + d) : Math.max(target, t - d);
      return { t, moved: true };
    },
  };
}
