/**
 * The maths behind the fractals article, in plain numbers — the same maps,
 * constants and stopping rules as Avi's Python, so the shader and the overlays
 * reproduce his pictures rather than textbook ones.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

// --- Chaotic flows, and their "Fraotic" basins ---------------------------------

export interface Flow {
  id: "thomas" | "lorenz";
  /** The vector field. */
  f: (p: Vec3) => Vec3;
  /** Forward-Euler step, as in stage_2. */
  dt: number;
  /** The reference orbit's start. */
  start: Vec3;
  /** Steps per pixel before giving up. */
  steps: number;
  /** Half-width of the slice around the orbit's centre. */
  bounds: number;
  /** Colour: (n / max)^(1/gamma). `max` is the image maximum of his render. */
  gamma: number;
  max: number;
  /**
   * The sphere a point has to reach: his reference orbit's mean and farthest
   * distance (100k Euler steps), computed with numpy. The orbit is chaotic, so
   * JavaScript's sin rounds it onto a different path with a different mean —
   * these are his numbers, not recomputed.
   */
  target: { center: Vec3; radius: number };
}

const THOMAS_B = 0.208186;
const LORENZ = { sigma: 10, rho: 28, beta: 2.667 };

export const FLOWS: Record<Flow["id"], Flow> = {
  // stage_2/Fraotic Attractors/TCSA.py — "Thomas' cyclically symmetric attractor"
  thomas: {
    id: "thomas",
    f: ([x, y, z]) => [Math.sin(y) - THOMAS_B * x, Math.sin(z) - THOMAS_B * y, Math.sin(x) - THOMAS_B * z],
    dt: 0.1,
    start: [-0.33, -0.1, -0.25],
    steps: 1000,
    bounds: 20,
    gamma: 3.2,
    max: 612,
    target: { center: [-1.84167939, -1.84709622, -1.85014349], radius: 3.89888827 },
  },
  // stage_2/Fraotic Attractors/lorenz.py
  lorenz: {
    id: "lorenz",
    f: ([x, y, z]) => [
      LORENZ.sigma * (y - x),
      LORENZ.rho * x - y - x * z, // his order: the orbit is chaotic, so rounding decides its mean
      x * y - LORENZ.beta * z,
    ],
    dt: 0.01,
    start: [0, 1, 8],
    steps: 500,
    bounds: 130,
    gamma: 2.1,
    max: 267,
    target: { center: [-0.43450803, -0.43365947, 25.08799559], radius: 35.35646429 },
  },
};

export const FLOW_CONSTANTS = { thomasB: THOMAS_B, ...LORENZ };

/** Forward-Euler orbit, `n` steps, flattened xyz. */
export function traceFlow(flow: Flow, n: number): Float64Array {
  const out = new Float64Array((n + 1) * 3);
  let p: Vec3 = [...flow.start];
  out.set(p, 0);
  for (let i = 1; i <= n; i++) {
    const d = flow.f(p);
    p = [p[0] + d[0] * flow.dt, p[1] + d[1] * flow.dt, p[2] + d[2] * flow.dt];
    out.set(p, i * 3);
  }
  return out;
}

/**
 * The target a starting point has to reach, as in lorenz.py: a sphere at the
 * orbit's mean ("centre of mass") whose radius is the orbit's farthest point
 * from it. His reference orbit is 100k steps.
 */
export function basinTarget(orbit: Float64Array): { center: Vec3; radius: number } {
  const n = orbit.length / 3;
  const c: Vec3 = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += orbit[i * 3 + k];
  for (let k = 0; k < 3; k++) c[k] /= n;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(orbit[i * 3] - c[0], orbit[i * 3 + 1] - c[1], orbit[i * 3 + 2] - c[2]);
    if (d > r) r = d;
  }
  return { center: c, radius: r };
}

// --- The Lissajous table (FractalsPython/Circles/MovingCircle6.py) -------------

export const LISSAJOUS = {
  /** "best working normal version": one circle per column and per row, at these rhythms. */
  columns: [1, 2, 3, 5, 7, 10],
  rows: [1, 2, 5],
  /** Each tick adds 360·rhythm/1000 degrees every 10 ms: rhythm 1 turns once in 10 s. */
  period: 10,
};
