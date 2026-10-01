/**
 * The fractals walkthrough, chapter by chapter: the headline and presets over
 * each picture. The pictures themselves are set up in engine.ts from the same ids
 * (the cover in cover.ts); the maths is in systems.ts.
 *
 * Sep 29 (Avi): ITERATE and RESOLVE are gone, and so are the figures and the
 * plates of his code that sat beside every chapter — git history has them.
 * Sep 30: so are the captions, the chapter counter and the preset notes.
 */
import type { FractalParams } from "./renderer";

export interface Preset {
  id: string;
  label: string;
  params: FractalParams;
}

export interface Chapter {
  id: "fractals" | "julia" | "fraotic" | "lissajous";
  headline: string;
  presets?: Preset[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "fractals",
    headline: "Fractals",
  },
  {
    id: "julia",
    headline: "Julia",
    presets: [
      {
        id: "first",
        label: "First",
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
    presets: [
      {
        id: "thomas",
        label: "Thomas",
        params: { mode: "thomas", iters: 1000, max: 612, gamma: 3.2, palette: "gothic" },
      },
      {
        id: "lorenz",
        label: "Lorenz",
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
  },
];

export const LAST_CHAPTER = CHAPTERS.length - 1;
