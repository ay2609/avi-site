/**
 * The fractals walkthrough, chapter by chapter: what the stage says over each
 * picture. The pictures themselves are set up in engine.ts from the same ids
 * (the cover in cover.ts); the maths is in systems.ts.
 *
 * Sep 29 (Avi): ITERATE and RESOLVE are gone, and so are the figures and the
 * plates of his code that sat beside every chapter — git history has them.
 */
import type { FractalParams } from "./renderer";

export interface Preset {
  id: string;
  label: string;
  /** One line under the preset list, when this preset has something to own up to. */
  note?: string;
  params: FractalParams;
}

export interface Chapter {
  id: "fractals" | "julia" | "fraotic" | "lissajous";
  headline: string;
  /** Beside "Chapter NN / NN". */
  kicker?: string;
  caption: string;
  presets?: Preset[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "fractals",
    headline: "Fractals",
    caption: "Fig. 3.0 — This is a fractal. The Mandelbrot set, as my first year of code drew it.",
  },
  {
    id: "julia",
    headline: "Julia",
    caption: "Fig. 3.1 — Hold c still and start every z somewhere else. Drag to move c.",
    presets: [
      {
        id: "first",
        label: "First",
        note: "The first one — pygame, pixel by pixel, 1920 × 1080",
        params: {
          mode: "escape",
          julia: true,
          c: [-0.8, 0.156],
          center: [0, 0],
          half: 1.6,
          iters: 1000,
          max: 1000,
          gamma: 1,
          palette: "site",
          pygame: true,
        },
      },
      {
        id: "prisonah",
        label: "Prisonah",
        note: "c marked “yes #prisonah” in the notes",
        params: {
          mode: "escape",
          julia: true,
          c: [-0.624, 0.435],
          center: [0, 0],
          half: 1.25,
          iters: 500,
          max: 500,
          gamma: 1,
          offset: -1,
          palette: "inferno",
          interior: "max",
        },
      },
      {
        id: "sunburst",
        label: "−0.4 − 0.6i",
        params: {
          mode: "escape",
          julia: true,
          c: [-0.4, -0.6],
          center: [0, 0],
          half: 1.5,
          iters: 1000,
          max: 1000,
          gamma: 3.2,
          palette: "sunburst",
        },
      },
      {
        id: "thorn",
        label: "Thorn",
        note: "Xsave = X is the same array, so Y divides by the new X — the thorns are that bug",
        params: {
          mode: "thorn",
          c: [0.662, 1.086],
          center: [0, 0],
          half: 3,
          iters: 250,
          max: 29,
          gamma: 1,
          palette: "bone",
          flipY: true,
        },
      },
    ],
  },
  {
    id: "fraotic",
    headline: "Fraotic",
    caption:
      "Fig. 3.2 — Escape time, turned on a chaotic flow: how many steps each start takes to fall into the attractor. Drag to turn the slice.",
    presets: [
      {
        id: "thomas",
        label: "Thomas",
        params: { mode: "thomas", iters: 1000, max: 612, gamma: 3.2, palette: "gothic" },
      },
      {
        id: "lorenz",
        label: "Lorenz",
        note: "Euler, dt 0.01: the escapes come from the step size — the continuous flow keeps every point",
        params: {
          mode: "lorenz",
          iters: 500,
          max: 267,
          gamma: 2.1,
          palette: "twilight",
          escape: { palette: "gothic", gamma: 2, max: 238, alpha: 0.75 },
        },
      },
    ],
  },
  {
    id: "lissajous",
    headline: "Lissajous",
    kicker: "Bonus",
    caption: "Fig. 3.3 — A Lissajous table: each curve is its column's circle against its row's.",
  },
];

export const LAST_CHAPTER = CHAPTERS.length - 1;
