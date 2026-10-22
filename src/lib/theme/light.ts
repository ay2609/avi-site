import { useSyncExternalStore } from "react";

import { sfx } from "@/lib/sound/sfx";

import { BEND_KEY, THEME_KEY } from "./prepaint";

/**
 * Light and dark, and the globe's bend that goes with them.
 *
 * The theme is `data-theme` on <html>, which swaps the CSS tokens
 * (globals.css); the WebGL scenes and the tinted ASCII subscribe and fade
 * their own colours over FLIP_S. A first visit follows the system; the
 * switch in the masthead picks one and it's remembered. The inline script in
 * the root layout applies it before the first paint (prepaint.ts) — keep the
 * two in step.
 *
 * The globe throws it too, inside its window (open, or docked): it publishes
 * its bend — 0 perspective, 1 orthographic — here every frame, and crossing
 * FLIP_ON flips to light, crossing back under FLIP_OFF to dark (the gap keeps
 * it from flickering at the line). The other way round, the switch (or the
 * system, until the reader picks) bends the globe to match: flat for light,
 * round for dark.
 */
export type Theme = "dark" | "light";

const FLIP_ON = 0.55;
const FLIP_OFF = 0.45;
/** How long the flip's cross-fade takes, s (the CSS side is in globals.css). */
export const FLIP_S = 0.3;

// --- The bend ---------------------------------------------------------------

let bend: number | null = null;

function savedBend(): number | null {
  try {
    const saved = window.localStorage.getItem(BEND_KEY);
    if (saved !== null) return Math.min(1, Math.max(0, Number(saved) || 0));
  } catch {}
  return null;
}

/** The bend to start from: the last one saved if it's on the theme's side of the line, else that side's end. */
function initialBend(): number {
  const light = getTheme() === "light";
  const saved = savedBend();
  if (saved !== null && saved >= 0.5 === light) return saved;
  return light ? 1 : 0;
}

export function getBend(): number {
  if (bend === null) bend = typeof window === "undefined" ? 0 : initialBend();
  return bend;
}

export function setBend(next: number): void {
  const prev = getBend();
  bend = next;
  sfx.bend(next); // hums while it moves
  if (prev <= FLIP_ON && next > FLIP_ON) chooseTheme("light");
  else if (prev >= FLIP_OFF && next < FLIP_OFF) chooseTheme("dark");
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

const SYSTEM_LIGHT = "(prefers-color-scheme: light)";

/** The reader's last pick — or, from before the switch, the side their saved bend was on. */
function remembered(): Theme | null {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {}
  const b = savedBend();
  return b === null ? null : b >= 0.5 ? "light" : "dark";
}

export function getTheme(): Theme {
  if (theme === null) {
    if (typeof window === "undefined") return "dark";
    const system = window.matchMedia(SYSTEM_LIGHT);
    theme = remembered() ?? (system.matches ? "light" : "dark");
    // Until the reader picks one, follow the system as it changes.
    system.addEventListener("change", (e) => {
      if (remembered()) return;
      const next = e.matches ? "light" : "dark";
      setTheme(next);
      requestBend(next);
    });
  }
  return theme;
}

/** A bend across the line: the theme follows the globe, and it's remembered. */
function chooseTheme(next: Theme): void {
  setTheme(next);
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {}
}

/** The masthead's switch: the theme, remembered, and the globe bends to match. */
export function switchTheme(next: Theme): void {
  chooseTheme(next);
  requestBend(next);
}

const bendRequests = new Set<(to: number) => void>();

/** Bend the globe to a theme's end of the line (it eases there; see GlobeCanvas). */
function requestBend(to: Theme): void {
  const target = to === "light" ? 1 : 0;
  saveBend(target);
  bendRequests.forEach((f) => f(target));
}

/** The globe listens here for the bend the switch asks for, 0 → 1. */
export function onBendRequest(f: (to: number) => void): () => void {
  bendRequests.add(f);
  return () => bendRequests.delete(f);
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
  sfx.lights(next); // the relay, and the tubes (or a whine down)
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
