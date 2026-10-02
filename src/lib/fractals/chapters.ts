/**
 * The fractals walkthrough, chapter by chapter: the headline and presets over
 * each picture. The pictures themselves are set up in engine.ts from the same ids
 * (the cover in cover.ts); the maths is in systems.ts.
 *
 * Sep 29 (Avi): ITERATE and RESOLVE are gone, and so are the figures and the
 * plates of his code that sat beside every chapter — git history has them.
 * Sep 30: so are the captions, the chapter counter and the preset notes.
 * Oct 1: Julia and Fraotic carry the rest of his sets — every one a picture he
 * rendered, with his view, count and colouring (see fractals-inventory.md).
 */
import type { FractalParams } from "./renderer";
import type { CliffordId, FlowId } from "./systems";

export interface Preset {
  id: string;
  /** The preset's row — or, inside a group, its chip. */
  label: string;
  /** Consecutive presets with the same group share one row: the group's name, then their labels. */
  group?: string;
  /** The label is maths: set as written rather than in the furniture's capitals. */
  math?: boolean;
  params: FractalParams;
  /** Fraotic: the flow whose basin this is, or the Clifford map. */
  flow?: FlowId;
  clifford?: CliffordId;
}

export interface Chapter {
  id: "fractals" | "julia" | "fraotic";
  headline: string;
  presets?: Preset[];
}

const PHI = (1 + Math.sqrt(5)) / 2;

const JULIA: Preset[] = [
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
    math: true,
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
  // Julia_3.py
  {
    id: "lilac",
    label: "−0.76 + 0.084i",
    math: true,
    params: {
      mode: "escape",
      julia: true,
      c: [-0.76, 0.0838],
      center: [0, 0],
      half: 1.25,
      iters: 1000,
      max: 1000,
      gamma: 1,
      offset: -1,
      least: 1,
      palette: "lilac",
      interior: "max",
    },
  },
  // The rabbit, counted as Iterate.py counts, coloured in his later style (γ 3.2, the interior ink).
  {
    id: "rabbit",
    label: "−0.11 + 0.656i",
    math: true,
    params: {
      mode: "escape",
      julia: true,
      c: [-0.11, 0.65569999],
      center: [0, 0],
      half: 1.25,
      iters: 500,
      max: 465,
      gamma: 3.2,
      offset: -1,
      least: 1,
      palette: "horizon",
    },
  },
  {
    id: "ocean",
    label: "−0.513 + 0.521i",
    math: true,
    params: {
      mode: "escape",
      julia: true,
      c: [-0.512511498387847167, 0.521295573094847167],
      center: [0, 0],
      half: 1.25,
      iters: 500,
      max: 500,
      gamma: 1,
      offset: -1,
      least: 1,
      palette: "ocean",
      interior: "max",
    },
  },
  // DeepJulia.py: it marks every step past 2 until the numbers overflow, three past the escape.
  {
    id: "deep",
    label: "z⁵ + c",
    math: true,
    params: {
      mode: "escape",
      julia: true,
      power: 5,
      c: [0.6, 0.55],
      center: [0, 0],
      half: 1.25,
      iters: 100,
      max: 100,
      gamma: 1,
      offset: 2,
      palette: "magma",
      interior: "min",
    },
  },
  // JuliaSetFinal2.py's "good one", through IterateUpdate.py's φz² + c.
  {
    id: "golden",
    label: "φz² + c",
    math: true,
    params: {
      mode: "escape",
      julia: true,
      coef: PHI,
      bailout: 2.5,
      c: [0.28, 0.008],
      center: [0, 0],
      half: 0.8,
      iters: 150,
      max: 27,
      gamma: 2,
      offset: -1,
      least: 1,
      palette: "bone",
      flipY: true,
    },
  },
  // iterative_julia.py's sine lines (the gallery's JULIA_SIN).
  {
    id: "sine",
    label: "c·sin z",
    math: true,
    params: {
      mode: "sine",
      c: [1, 1],
      center: [0, 0],
      half: Math.PI,
      bailout: 50,
      iters: 100,
      max: 44,
      min: 2,
      gamma: 3.2,
      palette: "arctic_r",
      interior: "min",
    },
  },
  // NewtonRaphsonFinal.py (X3_1) and NewtonRaphsonSin.py (COS_2LOW).
  {
    id: "newton",
    group: "Newton",
    label: "z³ − 1",
    math: true,
    params: {
      mode: "newton",
      newton: "z3",
      center: [0, 0],
      half: 1.25,
      iters: 750,
      max: 40,
      min: 1,
      gamma: 1,
      offset: -1,
      palette: "ember",
      roots: ["ember", "bubblegum", "gem"],
    },
  },
  {
    id: "newton-sinc",
    group: "Newton",
    label: "sin z / z",
    math: true,
    params: {
      mode: "newton",
      newton: "sinc",
      center: [0, 0],
      half: 0.4,
      iters: 300,
      max: 280,
      gamma: 1,
      offset: -1,
      palette: "prism",
      interior: "min",
    },
  },
  // CollatzConjecture.py
  {
    id: "collatz",
    label: "Collatz",
    params: {
      mode: "collatz",
      center: [0, 0],
      half: 1.5,
      iters: 75,
      max: 75,
      gamma: 1,
      offset: -1,
      least: 1,
      palette: "magma",
      interior: "min",
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
];

/** The escape layer under every flow that has one: steps to fly off, gothic, at ¾. */
const fled = (max: number) => ({ palette: "gothic", gamma: 2, max, alpha: 0.75 }) as const;

const FRAOTIC: Preset[] = [
  {
    id: "thomas",
    group: "Thomas",
    label: "b .208",
    math: true,
    flow: "thomas",
    params: { mode: "flow", iters: 1000, max: 612, gamma: 3.2, palette: "gothic" },
  },
  {
    id: "thomas-1998",
    group: "Thomas",
    label: "b .1998",
    math: true,
    flow: "thomas1998",
    params: { mode: "flow", iters: 1000, max: 194, gamma: 3.2, palette: "gothic" },
  },
  {
    id: "thomas-32899",
    group: "Thomas",
    label: "b .329",
    math: true,
    flow: "thomas32899",
    params: { mode: "flow", iters: 1000, max: 294, gamma: 3.2, palette: "gothic" },
  },
  {
    id: "lorenz",
    group: "Lorenz",
    label: "Twilight",
    flow: "lorenz",
    params: { mode: "flow", iters: 500, max: 267, gamma: 2.1, palette: "twilight", escape: fled(238) },
  },
  // The slice turned π/16 about z, nearer in.
  {
    id: "lorenz-ember",
    group: "Lorenz",
    label: "Ember",
    flow: "lorenz",
    params: {
      mode: "flow",
      angle: Math.PI / 16,
      bounds: 125,
      iters: 300,
      max: 254,
      gamma: 2.1,
      palette: "ember",
      escape: fled(211),
    },
  },
  // Clifford_Boundary.py — never-arrived is the top of the scale, as his array started full.
  {
    id: "clifford",
    group: "Clifford",
    label: "1",
    clifford: "gallery",
    params: { mode: "clifford", iters: 30, max: 30, gamma: 1, offset: -1, palette: "twilight", interior: "max" },
  },
  {
    id: "clifford-2",
    group: "Clifford",
    label: "2",
    clifford: "wing",
    params: { mode: "clifford", iters: 50, max: 50, gamma: 1, palette: "twilight", interior: "min" },
  },
  {
    id: "clifford-3",
    group: "Clifford",
    label: "3",
    clifford: "loop",
    params: { mode: "clifford", iters: 50, max: 26, gamma: 1, palette: "twilight", interior: "min" },
  },
  {
    id: "clifford-4",
    group: "Clifford",
    label: "4",
    clifford: "point",
    params: { mode: "clifford", iters: 50, max: 50, gamma: 1, palette: "twilight", interior: "min" },
  },
  {
    id: "clifford-5",
    group: "Clifford",
    label: "5",
    clifford: "fold",
    params: { mode: "clifford", iters: 50, max: 50, gamma: 1, palette: "twilight", interior: "min" },
  },
  {
    id: "rucklidge",
    label: "Rucklidge",
    flow: "rucklidge",
    params: { mode: "flow", iters: 1500, max: 638, gamma: 3.2, palette: "sunburst" },
  },
  {
    id: "halvorsen",
    label: "Halvorsen",
    flow: "halvorsen",
    params: { mode: "flow", iters: 1000, max: 20, gamma: 2.1, palette: "ocean", escape: fled(57) },
  },
  {
    id: "sprott-d",
    group: "Sprott–Linz",
    label: "D",
    flow: "sprottD",
    params: { mode: "flow", iters: 1500, max: 734, gamma: 2.1, palette: "horizon", escape: fled(319) },
  },
  {
    id: "sprott-f",
    group: "Sprott–Linz",
    label: "F",
    flow: "sprottF",
    params: { mode: "flow", iters: 1500, max: 88, gamma: 2.1, palette: "lilac", escape: fled(294) },
  },
  {
    id: "lu",
    label: "Lü",
    flow: "lu",
    params: { mode: "flow", iters: 1000, max: 58, gamma: 2.1, palette: "twilight", escape: fled(122) },
  },
  {
    id: "tsucs",
    label: "TSUCS",
    flow: "tsucs2",
    params: { mode: "flow", iters: 600, max: 419, gamma: 2.1, palette: "ember" },
  },
];

export const CHAPTERS: Chapter[] = [
  { id: "fractals", headline: "Fractals" },
  { id: "julia", headline: "Julia", presets: JULIA },
  { id: "fraotic", headline: "Fraotic", presets: FRAOTIC },
];

export const LAST_CHAPTER = CHAPTERS.length - 1;

/** A chapter's presets as its list shows them: one row per preset, or per run of a group. */
export interface PresetRow {
  label: string;
  math?: boolean;
  /** Indices into the chapter's presets. */
  items: number[];
}

/** What a drag on the picture moves: Julia's c, a flow's slice, or nothing. */
export function dragOf(p: Preset | undefined): "c" | "slice" | null {
  if (!p) return null;
  if (p.flow) return "slice";
  const m = p.params.mode;
  return p.params.c && (m === "escape" || m === "sine" || m === "thorn") ? "c" : null;
}

export function presetRows(presets: Preset[]): PresetRow[] {
  const rows: PresetRow[] = [];
  presets.forEach((p, k) => {
    const last = rows[rows.length - 1];
    if (p.group && last && presets[last.items[0]].group === p.group) last.items.push(k);
    else rows.push(p.group ? { label: p.group, items: [k] } : { label: p.label, math: p.math, items: [k] });
  });
  return rows;
}
