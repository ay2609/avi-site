/**
 * Scalar fields rendered as animated ASCII in the side columns.
 *
 * Each field is a pure function of normalized position and time returning an
 * intensity in [0, 1], which the panel maps onto a character ramp. They are
 * deliberately cheap: a panel is ~540 cells refreshed at 18fps, so a whole
 * column costs far less than one frame of the globe.
 *
 * The grid is coarse — roughly 30x18 — which rules out anything built from
 * thin lines, since a one-cell-wide curve aliases into scattered dots at this
 * resolution. Every field here is therefore built from areas: terraces, lobes,
 * a shaded disc, bands wide enough to survive quantization.
 *
 * Panel coordinates arrive aspect-corrected, so a unit circle in field space
 * renders as a circle on screen rather than an ellipse.
 *
 * A field may also have a tint (ASCII_TINTS): a colour per cell, fixed in time,
 * that the panel paints its characters with instead of the one text colour.
 */

import { COVER, COVER_VIEW, coverRGB, escapeStep } from "@/lib/fractals/cover";

export type AsciiFieldId =
  | "terrain"
  | "flow"
  | "sphere"
  | "lattice"
  | "ripple"
  | "spiral"
  | "weave"
  | "scan"
  | "crate"
  | "mandel";

/** x, y are in [0, 1] over the square inscribed in the panel; t is seconds. */
export type AsciiField = (x: number, y: number, t: number) => number;

/** A cell's colour (0–255 RGB), or null to leave it uncoloured. Same x, y as the field. */
export type AsciiTint = (x: number, y: number) => [number, number, number] | null;

const TAU = Math.PI * 2;

/** Positive-safe fractional part — plain `%` returns negatives in JS. */
const fract = (v: number): number => v - Math.floor(v);

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Cheap value noise — smooth, deterministic, no allocation. */
function hash(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

function smoothNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, y: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    sum += smoothNoise(x * freq, y * freq) * amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Elevation quantized into terraces that migrate upward through the levels —
 * the same idea as the globe's topography shader, but filled rather than
 * outlined so it survives a 30-column grid. The lowest terrace renders empty,
 * which keeps the panel from reading as a solid block.
 */
const TERRAIN_LEVELS = 6;
const terrain: AsciiField = (x, y, t) => {
  const h = fbm(x * 2.3 + t * 0.03, y * 2.3 + t * 0.012);
  const level = Math.floor(fract(h * 2.6 + t * 0.045) * TERRAIN_LEVELS);
  // The ramp's first two slots are blank, so the two lowest terraces read as
  // open ground and the panel doesn't fill in solid.
  return level / (TERRAIN_LEVELS - 1);
};

/**
 * Two sine layers warped against each other by a drifting noise field. Only
 * the positive lobes are kept, and they're sharpened with a power curve, so
 * the panel stays roughly a third ink rather than filling in.
 */
const flow: AsciiField = (x, y, t) => {
  // Frequencies kept low: this one sits in a rail, where the grid is only
  // about thirty columns wide and finer lobes break up into speckle.
  const warp = fbm(x * 1.15 + t * 0.045, y * 1.15 - t * 0.028);
  const a = Math.sin((x * 1.35 + warp * 1.9) * TAU + t * 0.3);
  const b = Math.sin((y * 1.0 - warp * 1.45) * TAU - t * 0.22);
  const lobes = a * b;
  return lobes <= 0 ? 0 : Math.pow(lobes, 1.5);
};

/**
 * A rotating globe — a small rhyme with the lead art in the centre well.
 * Lambert shading plus a lat/long wireframe, over an ambient floor so the
 * unlit limb still reads as part of a sphere instead of vanishing.
 */
const sphere: AsciiField = (x, y, t) => {
  const px = (x - 0.5) * 2.2;
  const py = (y - 0.5) * 2.2;
  const r2 = px * px + py * py;
  if (r2 > 1) return 0;

  const pz = Math.sqrt(1 - r2);
  const ang = t * 0.4;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const nx = px * cos - pz * sin;
  const ny = py;
  const nz = px * sin + pz * cos;

  const lambert = Math.max(0, nx * 0.35 + ny * -0.35 + nz * 0.87);
  const lat = Math.abs(fract((Math.asin(clamp01(ny * 0.5 + 0.5) * 2 - 1) / Math.PI) * 8) - 0.5);
  const lon = Math.abs(fract((Math.atan2(nz, nx) / TAU) * 10) - 0.5);
  const wire = Math.max(Math.max(0, 1 - lat * 7), Math.max(0, 1 - lon * 7));

  return Math.min(1, 0.16 + lambert * 0.68 + wire * 0.26 * (0.4 + lambert));
};

/** A breathing lattice with bright intersections — structural, circuit-like. */
const lattice: AsciiField = (x, y, t) => {
  const gx = Math.abs(fract(x * 6 + Math.sin(t * 0.2) * 0.15) - 0.5);
  const gy = Math.abs(fract(y * 5 + Math.cos(t * 0.17) * 0.15) - 0.5);
  const lineWidth = 0.16;
  const barX = Math.max(0, 1 - gx / lineWidth);
  const barY = Math.max(0, 1 - gy / lineWidth);
  const node = barX * barY;
  const pulse = 0.72 + 0.28 * Math.sin(t * 0.75 - (x + y) * 3.2);
  return Math.min(1, (Math.max(barX, barY) * 0.62 + node * 0.95) * pulse);
};

/** Two wave sources interfering — concentric rings crossing each other. */
const ripple: AsciiField = (x, y, t) => {
  const d1 = Math.hypot(x - 0.32, y - 0.44);
  const d2 = Math.hypot(x - 0.72, y - 0.6);
  const wave = Math.sin(d1 * 21 - t * 1.05) + Math.sin(d2 * 18 - t * 0.82);
  const lobe = Math.max(0, wave * 0.5);
  return Math.pow(lobe, 1.35);
};

/** Rotating arms falling off toward the edge of the frame. */
const spiral: AsciiField = (x, y, t) => {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const arms = Math.sin(angle * 3 + r * 17 - t * 1.1);
  const falloff = Math.max(0, 1 - r * 1.85);
  return Math.max(0, arms) * falloff;
};

/** Over-under basket weave; alternating cells carry the warp or the weft. */
const weave: AsciiField = (x, y, t) => {
  const scale = 7;
  const u = x * scale + Math.sin(t * 0.2) * 0.2;
  const v = y * scale - Math.cos(t * 0.17) * 0.2;
  // u and v can go negative once aspect correction widens the range, so the
  // parity test has to survive a negative remainder.
  const isWarp = Math.abs((Math.floor(u) + Math.floor(v)) % 2) === 0;
  const bar = isWarp
    ? 1 - Math.abs(fract(u) - 0.5) * 2.4
    : 1 - Math.abs(fract(v) - 0.5) * 2.4;
  const pulse = 0.58 + 0.42 * Math.sin(t * 0.45 + (x - y) * 4.5);
  return Math.max(0, bar) * pulse;
};

/** Wavy horizontal bands — a printing artefact rather than a picture. */
const scan: AsciiField = (x, y, t) => {
  const band = Math.sin(y * 19 + Math.sin(x * 2.6 + t * 0.4) * 1.5 - t * 0.66);
  const envelope = 0.5 + 0.5 * Math.sin(x * 3.4 - t * 0.22);
  return Math.max(0, band) * (0.3 + envelope * 0.8);
};

/**
 * An egg-crate interference — sin·sin on two axes that slowly turn — after the
 * backdrop on caponier.io. Soft lobes, no lines, so it survives any grid size;
 * the stage uses it large and nearly invisible behind the globe.
 */
const crate: AsciiField = (x, y, t) => {
  const u = x * 2 - 1;
  const v = y * 2 - 1;
  const a = t * 0.08;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = 7;
  return (Math.sin(k * (u * c - v * s)) * Math.sin(k * (u * s + v * c)) + 1) / 2;
};

/**
 * The Mandelbrot set at ASCII resolution — the fractals article on the front
 * page. Its iteration count rises and falls, so the set condenses out of a
 * disc and melts back (the video's "iterations 10 → 1000", in miniature).
 * Shaded as Avi's code does it: escape step over the maximum, ^(1/3.2).
 * The view is the article's cover (src/lib/fractals/cover.ts), and each
 * character takes the colour its cell has there (the tint), so opening the
 * article resolves this grid into the same picture in pixels.
 */
export const MANDEL_VIEW = COVER_VIEW;
export const mandelIterations = (t: number): number =>
  Math.round(3 + 27 * (0.5 - 0.5 * Math.cos((TAU * t) / 16)));

const mandelC = (x: number, y: number): [number, number] => [
  MANDEL_VIEW.center[0] + (x * 2 - 1) * MANDEL_VIEW.half,
  MANDEL_VIEW.center[1] + (1 - y * 2) * MANDEL_VIEW.half,
];

const mandel: AsciiField = (x, y, t) => {
  const k = escapeStep(...mandelC(x, y), mandelIterations(t));
  // Over the most it ever runs, not this frame's: far points stay sparse however few steps there are.
  return k ? Math.pow(k / 30, 1 / 3.2) : 0;
};

/** A cell's escape step doesn't depend on how many steps run, so its colour is the cover's, fixed. */
const mandelTint: AsciiTint = (x, y) => coverRGB(escapeStep(...mandelC(x, y), COVER.iters));

export const ASCII_FIELDS: Record<AsciiFieldId, AsciiField> = {
  terrain,
  flow,
  sphere,
  lattice,
  ripple,
  spiral,
  weave,
  scan,
  crate,
  mandel,
};

/** Sparse-to-dense character ramps. Index 0 renders as empty space. */
export const ASCII_RAMPS: Record<AsciiFieldId, string> = {
  terrain: "  .:=+*#",
  flow: " .:-=+*#",
  sphere: " .:-=+*#%@",
  lattice: " .:-=+*#",
  ripple: " .:-=+*#",
  spiral: " .:-=+*#%",
  weave: " .:-=+*#",
  scan: " .:-=+*#",
  crate: " .:-=+*#%@",
  mandel: " .:-=+*#%@",
};

export const ASCII_TINTS: Partial<Record<AsciiFieldId, AsciiTint>> = {
  mandel: mandelTint,
};
