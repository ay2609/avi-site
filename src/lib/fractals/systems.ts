/**
 * The maths behind the fractals article, in plain numbers — the same maps,
 * constants and stopping rules as Avi's Python, so the shader and the overlays
 * reproduce his pictures rather than textbook ones.
 */
import type { FieldId } from "./renderer";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

// --- Chaotic flows, and their "Fraotic" basins ---------------------------------
//
// lorenz.py's method, for every system: a reference orbit (forward Euler, the
// basin's own step, 100k steps); the target is a sphere at its mean whose radius
// is its farthest point; a slice of starting points is stepped until each enters
// the sphere (coloured by the step) or passes 1000 from it. The orbits are
// chaotic, so JavaScript's rounding would walk a different path to a different
// mean — the targets below are numpy's, not recomputed.

export type FlowId =
  | "thomas"
  | "thomas1998"
  | "thomas32899"
  | "lorenz"
  | "rucklidge"
  | "lu"
  | "halvorsen"
  | "sprottD"
  | "sprottF"
  | "tsucs2";

export interface Slice {
  /** The slice's centre, and its across and up axes (unit vectors). */
  origin: Vec3;
  u: Vec3;
  v: Vec3;
}

export interface Flow {
  id: FlowId;
  field: FieldId;
  /** The field's constants, in the order FIELDS takes them. */
  constants: number[];
  /** Step: forward Euler, as in his scripts — or RK4, where Euler at any usable step flies apart. */
  dt: number;
  rk4?: boolean;
  /** The reference orbit's start. */
  start: Vec3;
  slice: Slice;
  /** Half-height of the slice. */
  bounds: number;
  target: { center: Vec3; radius: number };
  /** Steps of the orbit drawn over the basin. */
  trace: number;
}

/** The vector fields, with the constants each takes. Same expressions as the shader's. */
export const FIELDS: Record<FieldId, (k: number[]) => (p: Vec3) => Vec3> = {
  thomas:
    ([b]) =>
    ([x, y, z]) => [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z],
  // His operation order: the orbit is chaotic, so rounding decides its mean.
  lorenz:
    ([s, r, b]) =>
    ([x, y, z]) => [s * (y - x), r * x - y - x * z, x * y - b * z],
  rucklidge:
    ([k, a]) =>
    ([x, y, z]) => [-k * x + a * y - y * z, x, -z + y * y],
  lu:
    ([a, b, c]) =>
    ([x, y, z]) => [a * (y - x), c * y - x * z, x * y - b * z],
  halvorsen:
    ([a]) =>
    ([x, y, z]) => [-a * x - 4 * y - 4 * z - y * y, -a * y - 4 * z - 4 * x - z * z, -a * z - 4 * x - 4 * y - x * x],
  sprottD:
    ([a]) =>
    ([x, y, z]) => [-y, x + z, x * z + a * y * y],
  sprottF:
    ([a]) =>
    ([x, y, z]) => [y + z, -x + a * y, x * x - z],
  tsucs2:
    ([a, b, c, d, e, f]) =>
    ([x, y, z]) => [a * (y - x) + d * x * z, f * y + b * x - x * z, c * z + x * y - e * x * x],
};

const X: Vec3 = [1, 0, 0];
const Z: Vec3 = [0, 0, 1];
/** lorenz.py's slice: x across and z up, through the plane y = 0, centred on the target. */
const xz = (c: Vec3): Slice => ({ origin: [c[0], 0, c[2]], u: X, v: Z });

const flow = (f: Omit<Flow, "slice"> & { slice?: Slice }): Flow => ({ slice: xz(f.target.center), ...f });

export const FLOWS: Record<FlowId, Flow> = {
  // stage_2/Fraotic Attractors/TCSA.py — "Thomas' cyclically symmetric attractor"
  thomas: flow({
    id: "thomas",
    field: "thomas",
    constants: [0.208186],
    dt: 0.1,
    start: [-0.33, -0.1, -0.25],
    bounds: 20,
    target: { center: [-1.84167939, -1.84709622, -1.85014349], radius: 3.89888827 },
    trace: 40000,
  }),
  // TCSA.py's other b's: just under 0.2 one chaotic attractor fills the box; at
  // 0.32899 the start settles on one of several that coexist, and the starts that
  // belong to the others never arrive (ink).
  thomas1998: flow({
    id: "thomas1998",
    field: "thomas",
    constants: [0.1998],
    dt: 0.1,
    start: [-0.33, -0.1, -0.25],
    bounds: 20,
    target: { center: [1.8148855869094243, 1.8147400584922022, 1.8125063311089533], radius: 7.637725329958448 },
    trace: 40000,
  }),
  thomas32899: flow({
    id: "thomas32899",
    field: "thomas",
    constants: [0.32899],
    dt: 0.1,
    start: [-0.33, -0.1, -0.25],
    bounds: 20,
    target: { center: [-2.2643372832987136, -2.2642231012115226, -2.2643412189564307], radius: 3.5331420724001386 },
    trace: 40000,
  }),
  // stage_2/Fraotic Attractors/lorenz.py
  lorenz: flow({
    id: "lorenz",
    field: "lorenz",
    constants: [10, 28, 2.667],
    dt: 0.01,
    start: [0, 1, 8],
    bounds: 130,
    target: { center: [-0.43450803, -0.43365947, 25.08799559], radius: 35.35646429 },
    trace: 20000,
  }),
  // The attractors his notes list beside them, by the same method. Each slice is
  // three of its sphere's radii high (TSUCS's two: any wider and a wide box reaches
  // past 1000 from the centre, where his rule calls a start escaped before it moves).
  rucklidge: flow({
    id: "rucklidge",
    field: "rucklidge",
    constants: [2, 6.7],
    dt: 0.0075,
    start: [1, 0, 0],
    bounds: 42.521845458838534,
    target: { center: [0.002663859512636158, 0.05707787663319826, 6.482843182983827], radius: 14.173948486279512 },
    trace: 40000,
  }),
  lu: flow({
    id: "lu",
    field: "lu",
    constants: [36, 3, 20],
    dt: 0.01,
    start: [1, 2, 3],
    bounds: 128.2190109125468,
    target: { center: [-0.08993147315728828, -0.09014495096127702, 21.39291314402732], radius: 42.73967030418226 },
    trace: 20000,
  }),
  // Halvorsen's symmetry is about the diagonal, so its slice is the plane across it.
  halvorsen: flow({
    id: "halvorsen",
    field: "halvorsen",
    constants: [1.89],
    dt: 0.01,
    start: [1, 0, 0],
    bounds: 41.12075666508644,
    target: { center: [-2.8450419505209057, -2.886707892457465, -2.5855803888388538], radius: 13.706918888362146 },
    slice: {
      origin: [-2.8450419505209057, -2.886707892457465, -2.5855803888388538],
      u: [0.7071067811865475, -0.7071067811865475, 0],
      v: [0.408248290463863, 0.408248290463863, -0.816496580927726],
    },
    trace: 20000,
  }),
  sprottD: flow({
    id: "sprottD",
    field: "sprottD",
    constants: [3],
    dt: 0.01,
    start: [0.1, 0, 0],
    bounds: 27.255209941874394,
    target: { center: [-1.099922097571781, 0.0005911638213232339, 1.0994790030826058], radius: 9.085069980624798 },
    trace: 40000,
  }),
  sprottF: flow({
    id: "sprottF",
    field: "sprottF",
    constants: [0.5],
    dt: 0.01,
    start: [0.1, 0, 0],
    bounds: 15.95348123352128,
    target: { center: [-0.5642187327025433, -1.127639205934571, 1.128184985731651], radius: 5.317827077840427 },
    trace: 40000,
  }),
  // Its reference orbit by RK4 as well (100k steps).
  tsucs2: flow({
    id: "tsucs2",
    field: "tsucs2",
    constants: [40, 55, 1.833, 0.16, 0.65, 20],
    dt: 0.002,
    rk4: true,
    start: [0.1, 1, -0.1],
    bounds: 437.8294786836643,
    target: { center: [0.6325835708987725, 0.46420499409411586, 102.86109817858612], radius: 218.91473934183216 },
    trace: 60000,
  }),
};

/** The orbit drawn over a basin, `n` steps from the flow's start, flattened xyz. */
export function traceFlow(flow: Flow, n: number): Float64Array {
  const f = FIELDS[flow.field](flow.constants);
  const h = flow.dt;
  const out = new Float64Array((n + 1) * 3);
  let p: Vec3 = [...flow.start];
  out.set(p, 0);
  const at = (q: Vec3, d: Vec3, s: number): Vec3 => [q[0] + d[0] * s, q[1] + d[1] * s, q[2] + d[2] * s];
  for (let i = 1; i <= n; i++) {
    if (flow.rk4) {
      const k1 = f(p);
      const k2 = f(at(p, k1, h / 2));
      const k3 = f(at(p, k2, h / 2));
      const k4 = f(at(p, k3, h));
      p = at(p, [k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0], k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1], k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]], h / 6);
    } else {
      p = at(p, f(p), h);
    }
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

// --- Fraotic on the Clifford map (2023) -----------------------------------------
//
// The incremental Clifford map, x += dt·(sin ay + c·cos ax), y += dt·(sin bx + d·cos by),
// both from the old point. The first is Clifford_Boundary.py, the gallery's
// picture: a taxicab diamond of radius 1 on the attractor, 30 steps. The rest are
// the sets CoMFinder.py tried: a circle of radius 1 at the orbit's centre of mass,
// 50 steps, the view that centre ± 2.

export type CliffordId = "gallery" | "wing" | "loop" | "point" | "fold";

export interface Clifford {
  id: CliffordId;
  abcd: [number, number, number, number];
  dt: number;
  view: { center: Vec2; half: number };
  target: Vec2;
  radius: number;
  metric: "l1" | "l2";
  /** The orbit drawn over the basin: its start, steps, the transient skipped and every `stride`-th point. */
  start: Vec2;
  steps: number;
  skip: number;
  stride: number;
}

const cliff = (c: Omit<Clifford, "view" | "radius" | "metric" | "start" | "steps" | "skip" | "stride"> & Partial<Clifford>): Clifford => ({
  view: { center: c.target, half: 2 },
  radius: 1,
  metric: "l2",
  start: [10.75, 8.2],
  steps: 150000,
  skip: 1000,
  stride: 3,
  ...c,
});

export const CLIFFORDS: Record<CliffordId, Clifford> = {
  gallery: cliff({
    id: "gallery",
    abcd: [-1.4, 1.7, 1.0, 0.7],
    dt: 1.35,
    view: { center: [10, 8], half: 2 },
    target: [10.95, 8.1],
    metric: "l1",
    skip: 0,
  }),
  wing: cliff({ id: "wing", abcd: [-2, 1.6, 1, 0.7], dt: 1.35, target: [13.212203047014672, 14.050039533276685] }),
  loop: cliff({ id: "loop", abcd: [2, 1, -0.5, -1.01], dt: 1.25, target: [12.191945495944744, 4.4291327968451135] }),
  // This one's attractor is a single point.
  point: cliff({ id: "point", abcd: [1.6, -0.6, -1.2, 1.6], dt: 1.35, target: [11.363699460496342, 12.549417987755913] }),
  fold: cliff({ id: "fold", abcd: [-1.7, 1.8, -1.9, -0.4], dt: 1.35, target: [14.277619771589428, 6.666920012230595] }),
};

/** The Clifford orbit drawn over its basin, flattened xy. */
export function traceClifford(c: Clifford): Float64Array {
  const [a, b, cc, d] = c.abcd;
  const n = Math.floor((c.steps - c.skip) / c.stride);
  const out = new Float64Array(n * 2);
  let [x, y] = c.start;
  let k = 0;
  for (let i = 1; i <= c.steps && k < n; i++) {
    const nx = x + (Math.sin(a * y) + cc * Math.cos(a * x)) * c.dt;
    const ny = y + (Math.sin(b * x) + d * Math.cos(b * y)) * c.dt;
    x = nx;
    y = ny;
    if (i >= c.skip && (i - c.skip) % c.stride === 0) {
      out[k * 2] = x;
      out[k * 2 + 1] = y;
      k++;
    }
  }
  return out.subarray(0, k * 2);
}
