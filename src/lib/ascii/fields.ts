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
 */

export type AsciiFieldId = "terrain" | "flow" | "sphere" | "lattice";

/** x, y are in [0, 1] over the square inscribed in the panel; t is seconds. */
export type AsciiField = (x: number, y: number, t: number) => number;

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
  const warp = fbm(x * 1.7 + t * 0.045, y * 1.7 - t * 0.028);
  const a = Math.sin((x * 2.0 + warp * 2.8) * TAU + t * 0.3);
  const b = Math.sin((y * 1.5 - warp * 2.1) * TAU - t * 0.22);
  const lobes = a * b;
  return lobes <= 0 ? 0 : Math.pow(lobes, 1.7);
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

export const ASCII_FIELDS: Record<AsciiFieldId, AsciiField> = {
  terrain,
  flow,
  sphere,
  lattice,
};

/** Sparse-to-dense character ramps. Index 0 renders as empty space. */
export const ASCII_RAMPS: Record<AsciiFieldId, string> = {
  terrain: "  .:=+*#",
  flow: " .:-=+*#",
  sphere: " .:-=+*#%@",
  lattice: " .:-=+*#",
};
