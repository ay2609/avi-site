/**
 * One WebGL2 fragment shader that draws every picture in the fractals article,
 * with Avi's maps, stopping rules and colourings:
 *
 *  - escape   z → k·zⁿ + c, Mandelbrot (z₀ = 0) or Julia (z₀ = pixel); escape at
 *             |z| > bailout. n = 2, k = 1, bailout 2 is the classic set; DeepJulia
 *             is z⁵ + c, IterateUpdate's golden Julia φz² + c with bailout 2.5.
 *  - sine     z → c·sin z, escaped once |Im z| > bailout (iterative_julia.py).
 *  - newton   Newton's method on z³ − 1, each root's basin in its own palette
 *             (NewtonRaphsonFinal.py), or on sin z / z, counted when |z| lands near
 *             a multiple of π (NewtonRaphsonSin.py).
 *  - collatz  z → ((7z + 2) − round(e^{iπz})(5z + 2)) / 4, escaped at |z| > 1000.
 *  - thorn    X ← X / cos Y + cx, then Y ← Y / sin X + cy with the *new* X
 *             (numpy aliasing in Thorn.py — it is what gives the thorns); bailout 1000.
 *  - clifford "Fraotic" on a 2D map: the incremental Clifford map, each start
 *             coloured by the step it first comes within a radius (taxicab or round)
 *             of the attractor's centre.
 *  - flow     "Fraotic" on a 3D flow: each pixel is a starting point on a slice; it
 *             is stepped (forward Euler, or RK4 where Euler blows up) until it enters
 *             the sphere around the attractor — the orbit's mean, radius its farthest
 *             point — and the colour is how many steps that took; or until it passes
 *             1000 from it (ink, or the escape layer).
 *
 * Colour is his: t = ((n + offset) / max)^(1/γ) through one of the baked palettes
 * (palettes.ts), optionally stretched up from (min / max)^(1/γ), as imshow
 * stretches an image's own range. `cells` renders on an N-cell grid and scales it
 * up with nearest filtering — the article's resolve.
 *
 * The shader is compiled once per kind of picture (mode, and a flow's field and
 * integrator), with the others compiled out, so each picture runs only its own
 * loop — as fast as the single-purpose shaders it replaced.
 */
import { PALETTE_ROW, PALETTES, type PaletteId } from "./palettes";

export type Mode = "none" | "escape" | "sine" | "newton" | "collatz" | "thorn" | "clifford" | "flow";

/** The vector fields the flow mode knows; their constants come with each system (systems.ts). */
export type FieldId = "thomas" | "lorenz" | "rucklidge" | "lu" | "halvorsen" | "sprottD" | "sprottF" | "tsucs2";

type Vec3 = [number, number, number];

export interface FractalParams {
  mode: Mode;
  /** Plane centre and half-height; the width follows the canvas. Flow: unused. */
  center?: [number, number];
  half?: number;
  /** Julia (z₀ = pixel, c fixed) instead of Mandelbrot (z₀ = 0, c = pixel). */
  julia?: boolean;
  /** Julia and sine c; Thorn (cx, cy). */
  c?: [number, number];
  /** escape: z → coef·z^power + c (defaults 2 and 1; power up to 8). */
  power?: number;
  coef?: number;
  /** escape: |z| beyond this has escaped (default 2). sine: |Im z| (default 50). */
  bailout?: number;
  iters: number;
  /** Normalisation: his image maximum. */
  max: number;
  /** His image minimum, where imshow's autoscale started above 0. */
  min?: number;
  /** Colour exponent: t = (n/max)^(1/gamma). 1 = linear. */
  gamma: number;
  palette: PaletteId;
  /** Points that never escape: ink, the top of the palette, or its bottom. */
  interior?: "ink" | "max" | "min";
  /** Count offset (his loops counted from 0, or marked a few steps late). */
  offset?: number;
  /**
   * The least count, after the offset (default 0). Iterate.py's mask leaves a point
   * that escapes on the first step unmarked, then marks it 1 on the next — so its
   * counts start at 1, not 0.
   */
  least?: number;
  /** The first Julia's own colours (pygame, main.py). */
  pygame?: boolean;
  /** Mirror vertically (imshow without origin="lower"). */
  flipY?: boolean;
  /** Render on an N-cell grid across the shorter side, sampled like linspace. 0 = per pixel. */
  cells?: number;
  /** newton: the function. */
  newton?: "z3" | "sinc";
  /** newton z3: each root's basin in its own palette, roots in sympy's order (1, then −½ ∓ (√3/2)i). */
  roots?: [PaletteId, PaletteId, PaletteId];
  /** clifford: the map, its step, and the target its starts are timed into. */
  clifford?: {
    abcd: [number, number, number, number];
    dt: number;
    target: [number, number];
    radius: number;
    /** "l1": |x − tx| + |y − ty| < r (Clifford_Boundary.py); "l2": a circle (CoMFinder.py). */
    metric: "l1" | "l2";
  };
  /** flow: the field and its constants (up to six, in the order systems.ts lists them). */
  field?: FieldId;
  constants?: number[];
  dt?: number;
  rk4?: boolean;
  /** flow: the plane of starting points — origin, across (u) and up (v), unit vectors. */
  slice?: { origin: Vec3; u: Vec3; v: Vec3 };
  /** flow: the slice's half-height. */
  bounds?: number;
  /** flow: the sphere a start has to reach. */
  target?: { center: Vec3; radius: number };
  /** flow: turn the slice's across axis about its up axis (radians). */
  angle?: number;
  /**
   * flow: colour the points that fly off too (his commented-out `alt_mapp`
   * layer, by steps to escape) instead of leaving them ink.
   */
  escape?: { palette: PaletteId; gamma: number; max: number; alpha: number };
}

const INK = [10 / 255, 10 / 255, 11 / 255];
const MAX_LOOP = 4096;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = (defines: string) => `#version 300 es
${defines}
precision highp float;
precision highp int;

uniform vec2 u_size;
uniform bool u_julia;
uniform bool u_grid;
uniform vec3 u_view;
uniform int u_iters;
uniform float u_max;
uniform float u_lo;
uniform float u_gamma;
uniform vec2 u_c;
uniform int u_power;
uniform float u_coef;
uniform float u_bail;
uniform int u_interior;
uniform float u_offset;
uniform float u_least;
uniform bool u_pygame;
uniform bool u_flipY;
uniform sampler2D u_pal;
uniform float u_row;
uniform float u_rows;
uniform vec3 u_ink;
uniform vec3 u_rootRows;
uniform highp uvec4 u_signs[64];
uniform vec4 u_cliff;
uniform vec4 u_cliffTarget;
uniform vec3 u_k0;
uniform vec3 u_k1;
uniform vec3 u_origin;
uniform vec3 u_axisU;
uniform vec3 u_axisV;
uniform vec3 u_center;
uniform float u_radius;
uniform float u_angle;
uniform float u_dt;
uniform float u_bounds;
uniform bool u_escLayer;
uniform float u_escRow;
uniform float u_escGamma;
uniform float u_escMax;
uniform float u_escAlpha;

out vec4 outColor;

const float PI = 3.14159265358979;

vec3 paletteRow(float t, float row) {
  t = clamp(t, 0.0, 1.0);
  return texture(u_pal, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, (row + 0.5) / u_rows)).rgb;
}

vec3 palette(float t) {
  return paletteRow(t, u_row);
}

// His count → t: ((n + offset) / max)^(1/γ), stretched up from u_lo as imshow's autoscale does.
float level(float n) {
  float t = pow(max(n + u_offset, u_least) / u_max, 1.0 / u_gamma);
  return u_lo > 0.0 ? (t - u_lo) / (1.0 - u_lo) : t;
}

vec3 shade(float n) {
  return palette(level(n));
}

vec3 interior() {
  if (u_interior == 1) return palette(1.0);
  if (u_interior == 2) return palette(0.0);
  return u_ink;
}

// --- complex arithmetic ---------------------------------------------------------------

vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b) { return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / dot(b, b); }
vec2 csin(vec2 z) { return vec2(sin(z.x) * cosh(z.y), cos(z.x) * sinh(z.y)); }
vec2 cpow(vec2 z, int n) {
  vec2 r = z;
  for (int i = 1; i < 8; i++) {
    if (i >= n) break;
    r = cmul(r, z);
  }
  return r;
}

// Pixel → [-1, 1]², y up. On a grid, cell i of N sits where linspace(-1, 1, N) puts it.
vec2 unit() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = u_grid
    ? floor(fc) / max(u_size - 1.0, vec2(1.0)) * 2.0 - 1.0
    : fc / u_size * 2.0 - 1.0;
  if (u_flipY) uv.y = -uv.y;
  return uv;
}

// --- escape time -----------------------------------------------------------------------

vec3 escapeTime(vec2 p) {
  vec2 z = u_julia ? p : vec2(0.0);
  vec2 c = u_julia ? u_c : p;
  float b2 = u_bail * u_bail;
  if (!u_julia && u_power == 2 && u_coef == 1.0) {
    // The main cardioid and the period-2 bulb never escape: skip their iterations.
    float qx = c.x - 0.25;
    float q = qx * qx + c.y * c.y;
    if (q * (q + qx) <= 0.25 * c.y * c.y || (c.x + 1.0) * (c.x + 1.0) + c.y * c.y <= 0.0625) return interior();
  }
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    z = u_coef * cpow(z, u_power) + c;
    if (dot(z, z) > b2) {
      if (u_pygame) {
        // main.py: n counts the steps taken while |z| < 2; colour (24, 75·log10 n, 75·log10 n).
        float g = 75.0 * log(float(i)) / log(10.0) / 255.0;
        return vec3(24.0 / 255.0, g, g);
      }
      return shade(float(i));
    }
  }
  return u_pygame ? vec3(12.0, 211.0, 192.0) / 255.0 : interior();
}

// iterative_julia.py, its sine lines: z = c·sin z until |Im z| passes the threshold.
vec3 sineJulia(vec2 z) {
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    z = cmul(u_c, csin(z));
    if (!(abs(z.y) <= u_bail)) return shade(float(i));   // an overflow has escaped too
  }
  return interior();
}

// --- Newton's method -------------------------------------------------------------------

// NewtonRaphsonFinal.py: x − (x³ − 1)/(3x²), counted on the step it comes within
// 1.5e-5 of a root; each root's basin in its own palette, stretched over that basin.
vec3 newtonZ3(vec2 z) {
  const vec2 R0 = vec2(1.0, 0.0);
  const vec2 R1 = vec2(-0.5, -0.8660254037844386);
  const vec2 R2 = vec2(-0.5, 0.8660254037844386);
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    vec2 z2 = cmul(z, z);
    z = z - cdiv(cmul(z2, z) - vec2(1.0, 0.0), 3.0 * z2);
    float n = float(i);
    if (length(z - R0) <= 1.5e-5) return paletteRow(level(n), u_rootRows.x);
    if (length(z - R1) <= 1.5e-5) return paletteRow(level(n), u_rootRows.y);
    if (length(z - R2) <= 1.5e-5) return paletteRow(level(n), u_rootRows.z);
  }
  return paletteRow(0.0, u_rootRows.x);
}

// tan z without overflow: (sin 2x + i·sinh 2y) / (cos 2x + cosh 2y), → ±i far from the axis.
vec2 ctan(vec2 z) {
  if (abs(z.y) > 20.0) return vec2(0.0, sign(z.y));
  float d = cos(2.0 * z.x) + cosh(2.0 * z.y);
  return vec2(sin(2.0 * z.x), sinh(2.0 * z.y)) / d;
}

// NewtonRaphsonSin.py, the sin(x)/x line: x − (sin x / x) / (cos x / x − sin x / x²),
// i.e. x − x·sin x / (x·cos x − sin x), counted once |x| lands within 0.0055 above a
// multiple of π (np.mod(np.abs(x), np.pi)). Far from the roots it is written as
// x − x·tan x / (x − tan x), which float32 carries as far from the axis as numpy's
// float64 does; near 0 both halves cancel, so there it takes their series.
//
// Near a root kπ the step is followed as the error e = x − kπ itself, by its series.
// That matters: along the real axis Newton closes in from just below kπ, where the
// mod reads π − |e|, so numpy only counts such a point once float64 can no longer
// tell x from kπ — four steps or so later than float32 could, and prism shows a
// step. With e carried exactly, the count lands where float64 puts it; the last
// word, at float64's resolution, is the bit u_signs keeps for each k.
const float PI_HI = 3.140625;               // 8 bits: k·PI_HI is exact
const float PI_LO = 9.676535897932385e-4;   // π − PI_HI

bool settlesAbove(float k) {
  int i = int(k);
  if (i >= 8192) return true;
  uvec4 v = u_signs[i >> 7];
  int c = (i >> 5) & 3;
  uint w = c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w;
  return ((w >> uint(i & 31)) & 1u) == 1u;
}

vec3 newtonSinc(vec2 z) {
  bool near = false;
  float k = 0.0;
  float a = 0.0;
  vec2 e = vec2(0.0);
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    if (!near) {
      vec2 num;
      vec2 den;
      if (dot(z, z) < 0.0025) {
        vec2 z2 = cmul(z, z);
        num = z2 - cmul(z2, z2) / 6.0;                                     // x·sin x
        den = cmul(z2, z) * (-1.0 / 3.0) + cmul(cmul(z2, z2), z) / 30.0;   // x·cos x − sin x
      } else {
        vec2 t = ctan(z);
        num = cmul(z, t);
        den = z - t;
      }
      z = z - cdiv(num, den);
      if (any(isnan(z)) || any(isinf(z))) break;   // numpy: a nan is never marked
      // sin x / x is even, so its Newton map is odd: work on the right half-plane.
      vec2 w = z.x < 0.0 ? -z : z;
      k = floor(w.x / PI + 0.5);
      vec2 r = vec2((w.x - k * PI_HI) - k * PI_LO, w.y);
      if (k >= 1.0 && dot(r, r) < 1.0e-4) {
        near = true;
        a = k * PI;
        e = r;
      } else {
        float L = length(z);
        float n = floor(L / PI);
        float m = (L - n * PI_HI) - n * PI_LO;
        if (m >= 0.0 && m <= 0.0055) return shade(float(i));
        continue;
      }
    } else {
      // e ← e − (kπ + e)·sin e / ((kπ + e)·cos e − sin e), as
      // [(kπ + e)(e·cos e − sin e) − e·sin e] / [(kπ + e)·cos e − sin e], in series.
      vec2 e2 = cmul(e, e);
      vec2 e3 = cmul(e2, e);
      vec2 e4 = cmul(e2, e2);
      vec2 e5 = cmul(e4, e);
      vec2 ae = vec2(a + e.x, e.y);
      vec2 num = -cmul(ae, e3 / 3.0 - e5 / 30.0) - e2 + e4 / 6.0;
      vec2 den = cmul(ae, vec2(1.0, 0.0) - e2 / 2.0 + e4 / 24.0) - (e - e3 / 6.0 + e5 / 120.0);
      e = cdiv(num, den);
    }
    // |x| − kπ, and np.pi's own shortfall k·1.2246e-16, as float64 sees them.
    float d = (2.0 * a * e.x + dot(e, e)) / (length(vec2(a + e.x, e.y)) + a);
    if (d + k * 1.2246468e-16 >= 0.0 && d <= 0.0055) return shade(float(i));
    // float64 has run out of digits: x is fl(kπ) from here on, above np.pi·k or below for good.
    if (length(e) < a * 1.1102230e-16) return settlesAbove(k) ? shade(float(i)) : interior();
  }
  return interior();
}

// --- complex Collatz (CollatzConjecture.py) --------------------------------------------

vec3 collatz(vec2 z) {
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    // Far below the axis e^{iπz} is beyond float32 (not float64): there the step
    // multiplies z by at least e^60 — it has escaped.
    if (-PI * z.y > 60.0) return shade(float(i));
    // round(e^{iπz}) as numpy rounds a complex number: each part, half to even.
    float m = exp(-PI * z.y);
    vec2 e = roundEven(vec2(m * cos(PI * z.x), m * sin(PI * z.x)));
    z = ((7.0 * z + vec2(2.0, 0.0)) - cmul(e, 5.0 * z + vec2(2.0, 0.0))) / 4.0;
    if (any(isnan(z))) break;                    // abs(nan) > 1000 is False: never marked
    if (!(dot(z, z) <= 1.0e6)) return shade(float(i));
  }
  return interior();
}

// --- Thorn -----------------------------------------------------------------------------

vec3 thorn(vec2 p) {
  float x = p.x;
  float y = p.y;
  for (int n = 0; n <= ${MAX_LOOP}; n++) {
    if (n > u_iters) break;
    x = x / cos(y) + u_c.x;
    y = y / sin(x) + u_c.y;   // the new x, as Thorn.py's aliasing has it
    // numpy: |inf| escapes; a nan is never marked and stays 0; else |z| > 1000.
    if (isinf(x) || isinf(y)) return shade(float(n));
    if (isnan(x) || isnan(y)) return shade(0.0);
    if (x * x + y * y > 1.0e6) return shade(float(n));
  }
  return shade(0.0);
}

// --- Fraotic on the Clifford map -------------------------------------------------------

vec3 clifford(vec2 p) {
  float a = u_cliff.x, b = u_cliff.y, c = u_cliff.z, d = u_cliff.w;
  vec2 t = u_cliffTarget.xy;
  float r = u_cliffTarget.z;
  bool taxicab = u_cliffTarget.w > 0.5;
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    // Both from the old point, as his arrays have it.
    p += u_dt * vec2(sin(a * p.y) + c * cos(a * p.x), sin(b * p.x) + d * cos(b * p.y));
    vec2 q = abs(p - t);
    if ((taxicab ? q.x + q.y : length(p - t)) < r) return shade(float(i));
  }
  return interior();
}

// --- Fraotic on a 3D flow --------------------------------------------------------------

vec3 field(vec3 p) {
  float x = p.x, y = p.y, z = p.z;
#if FIELD == 0   // Thomas (b)
  float b = u_k0.x;
  return vec3(sin(y) - b * x, sin(z) - b * y, sin(x) - b * z);
#elif FIELD == 1 // Lorenz (σ, ρ, β), in his operation order
  return vec3(u_k0.x * (y - x), u_k0.y * x - y - x * z, x * y - u_k0.z * z);
#elif FIELD == 2 // Rucklidge (k, a)
  return vec3(-u_k0.x * x + u_k0.y * y - y * z, x, -z + y * y);
#elif FIELD == 3 // Lü (a, b, c)
  return vec3(u_k0.x * (y - x), u_k0.z * y - x * z, x * y - u_k0.y * z);
#elif FIELD == 4 // Halvorsen (a)
  float a = u_k0.x;
  return vec3(-a * x - 4.0 * y - 4.0 * z - y * y, -a * y - 4.0 * z - 4.0 * x - z * z, -a * z - 4.0 * x - 4.0 * y - x * x);
#elif FIELD == 5 // Sprott–Linz D (a)
  return vec3(-y, x + z, x * z + u_k0.x * y * y);
#elif FIELD == 6 // Sprott–Linz F (a)
  return vec3(y + z, -x + u_k0.x * y, x * x - z);
#else            // TSUCS 2 (a, b, c, d, e, f)
  return vec3(u_k0.x * (y - x) + u_k1.x * x * z, u_k1.z * y + u_k0.y * x - x * z, u_k0.z * z + x * y - u_k1.y * x * x);
#endif
}

vec3 stepFlow(vec3 p) {
#if RK4
  vec3 k1 = field(p);
  vec3 k2 = field(p + k1 * (u_dt / 2.0));
  vec3 k3 = field(p + k2 * (u_dt / 2.0));
  vec3 k4 = field(p + k3 * u_dt);
  return p + (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0 * u_dt;
#else
  return p + u_dt * field(p);
#endif
}

vec3 flow(vec2 uv) {
  // The slice: origin + s·u + t·v, its across axis turned about its up axis by the drag.
  vec3 u = u_axisU * cos(u_angle) + cross(u_axisV, u_axisU) * sin(u_angle);
  vec3 p = u_origin + (uv.x * u_bounds) * u + (uv.y * u_bounds) * u_axisV;
  for (int n = 1; n <= ${MAX_LOOP}; n++) {
    if (n > u_iters) break;
    float d = distance(p, u_center);
    if (d < u_radius) return shade(float(n));
    if (!(d <= 1000.0)) {
      if (!u_escLayer) return u_ink;
      vec3 e = paletteRow(pow(float(n) / u_escMax, 1.0 / u_escGamma), u_escRow);
      return mix(u_ink, e, u_escAlpha);
    }
    p = stepFlow(p);
  }
  return u_ink;
}

void main() {
  vec2 uv = unit();
  float aspect = u_size.x / u_size.y;
  vec2 p = u_view.xy + uv * vec2(u_view.z * aspect, u_view.z);
  vec3 col = u_ink;
#if MODE == 1
  col = escapeTime(p);
#elif MODE == 2
  col = sineJulia(p);
#elif MODE == 3 && SINC
  col = newtonSinc(p);
#elif MODE == 3
  col = newtonZ3(p);
#elif MODE == 4
  col = collatz(p);
#elif MODE == 5
  col = thorn(p);
#elif MODE == 6
  col = clifford(p);
#elif MODE == 7
  col = flow(uv * vec2(aspect, 1.0));
#endif
  outColor = vec4(col, 1.0);
}`;

const MODES: Record<Mode, number> = { none: 0, escape: 1, sine: 2, newton: 3, collatz: 4, thorn: 5, clifford: 6, flow: 7 };
const FIELDS: Record<FieldId, number> = { thomas: 0, lorenz: 1, rucklidge: 2, lu: 3, halvorsen: 4, sprottD: 5, sprottF: 6, tsucs2: 7 };
const INTERIOR = { ink: 0, max: 1, min: 2 } as const;
const DEFAULT_SLICE = { origin: [0, 0, 0] as Vec3, u: [1, 0, 0] as Vec3, v: [0, 0, 1] as Vec3 };

function decodePalettes(): Uint8Array {
  const rows = PALETTES.length;
  const data = new Uint8Array(256 * rows * 4);
  PALETTES.forEach((p, row) => {
    const bytes = Uint8Array.from(atob(p.data), (ch) => ch.charCodeAt(0));
    for (let i = 0; i < 256; i++) {
      data.set([bytes[i * 3], bytes[i * 3 + 1], bytes[i * 3 + 2], 255], (row * 256 + i) * 4);
    }
  });
  return data;
}

/**
 * For each k < 8192: does float64's nearest value to kπ sit at or above k·np.pi
 * (np.pi falls 1.2246e-16 short of π)? Where it does, Newton's sin z / z, settled on
 * kπ, reads mod(|x|, π) = 0 and is counted; where not, π − ε, and never is. Exact,
 * with BigInt; one bit per k, packed for u_signs.
 */
let SIGNS: Uint32Array | null = null;
function signTable(): Uint32Array {
  if (SIGNS) return SIGNS;
  const B = BigInt;
  const DIGITS = "314159265358979323846264338327950288419716939937510582097494459";
  const SHIFT = B(160);
  const pi = (B(DIGITS) << SHIFT) / B(10) ** B(DIGITS.length - 1); // π·2^160
  const np = B(7074237752028440) << (SHIFT - B(51)); //                  np.pi·2^160, exactly
  const out = new Uint32Array(256);
  for (let k = 1; k < 8192; k++) {
    const x = B(k) * pi;
    const drop = B(x.toString(2).length - 53); // round to 53 bits, half to even
    let q = x >> drop;
    const rem = x - (q << drop);
    const half = B(1) << (drop - B(1));
    if (rem > half || (rem === half && (q & B(1)) === B(1))) q += B(1);
    if (q << drop >= B(k) * np) out[k >> 5] |= 1 << (k & 31);
  }
  return (SIGNS = out);
}

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

/** The variant of the shader a picture needs: its mode, and a flow's field and integrator. */
function variant(p: FractalParams): string {
  const newton = p.mode === "newton";
  const flow = p.mode === "flow";
  return [
    `#define MODE ${MODES[p.mode]}`,
    `#define SINC ${newton && p.newton === "sinc" ? 1 : 0}`,
    `#define FIELD ${flow ? FIELDS[p.field ?? "thomas"] : 0}`,
    `#define RK4 ${flow && p.rk4 ? 1 : 0}`,
  ].join("\n");
}

export class FractalRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, Program>();
  private current: Program | null = null;
  private fbo: WebGLFramebuffer;
  private fboTex: WebGLTexture;
  private fboSize: [number, number] = [0, 0];
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, { maxDpr = 1.5 } = {}) {
    this.canvas = canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;

    const pal = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, PALETTES.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, decodePalettes());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fbo = gl.createFramebuffer()!;
    this.fboTex = gl.createTexture()!;

    // The cover's variant now, so a GPU that can't run the shader fails here, not mid-frame.
    this.use({ mode: "escape", iters: 1, max: 1, gamma: 1, palette: "site" });
  }

  /** Bind the shader variant `p` needs, compiling it the first time. */
  private use(p: FractalParams): void {
    const gl = this.gl;
    const key = variant(p);
    let prog = this.programs.get(key);
    if (!prog) {
      prog = { program: this.link(VERT, FRAG(key)), uniforms: new Map() };
      this.programs.set(key, prog);
      this.current = prog;
      gl.useProgram(prog.program);
      gl.uniform1i(this.u("u_pal"), 0);
      gl.uniform1f(this.u("u_rows"), PALETTES.length);
      gl.uniform3fv(this.u("u_ink"), INK);
      if (p.mode === "newton" && p.newton === "sinc") gl.uniform4uiv(this.u("u_signs"), signTable());
    }
    this.current = prog;
    gl.useProgram(prog.program);
  }

  private link(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  }

  private u(name: string): WebGLUniformLocation | null {
    const prog = this.current!;
    if (!prog.uniforms.has(name)) prog.uniforms.set(name, this.gl.getUniformLocation(prog.program, name));
    return prog.uniforms.get(name)!;
  }

  /** Match the drawing buffer to the canvas's CSS size. */
  private fit(): [number, number] {
    const w = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return [w, h];
  }

  private setUniforms(p: FractalParams, w: number, h: number, cells: number): void {
    const gl = this.gl;
    gl.uniform2f(this.u("u_size"), w, h);
    gl.uniform1i(this.u("u_julia"), p.julia ? 1 : 0);
    gl.uniform1i(this.u("u_grid"), cells > 0 ? 1 : 0);
    const [cx, cy] = p.center ?? [0, 0];
    gl.uniform3f(this.u("u_view"), cx, cy, p.half ?? 1.5);
    gl.uniform1i(this.u("u_iters"), Math.min(p.iters, MAX_LOOP));
    gl.uniform1f(this.u("u_max"), p.max);
    gl.uniform1f(this.u("u_lo"), p.min ? Math.pow(p.min / p.max, 1 / p.gamma) : 0);
    gl.uniform1f(this.u("u_gamma"), p.gamma);
    gl.uniform2f(this.u("u_c"), p.c?.[0] ?? 0, p.c?.[1] ?? 0);
    gl.uniform1i(this.u("u_power"), p.power ?? 2);
    gl.uniform1f(this.u("u_coef"), p.coef ?? 1);
    gl.uniform1f(this.u("u_bail"), p.bailout ?? (p.mode === "sine" ? 50 : 2));
    gl.uniform1i(this.u("u_interior"), INTERIOR[p.interior ?? "ink"]);
    gl.uniform1f(this.u("u_offset"), p.offset ?? 0);
    gl.uniform1f(this.u("u_least"), p.least ?? 0);
    gl.uniform1i(this.u("u_pygame"), p.pygame ? 1 : 0);
    gl.uniform1i(this.u("u_flipY"), p.flipY ? 1 : 0);
    gl.uniform1f(this.u("u_row"), PALETTE_ROW[p.palette]);

    const roots = p.roots ?? [p.palette, p.palette, p.palette];
    gl.uniform3f(this.u("u_rootRows"), PALETTE_ROW[roots[0]], PALETTE_ROW[roots[1]], PALETTE_ROW[roots[2]]);

    const cl = p.clifford;
    gl.uniform4f(this.u("u_cliff"), ...(cl?.abcd ?? [0, 0, 0, 0]));
    gl.uniform4f(
      this.u("u_cliffTarget"),
      cl?.target[0] ?? 0,
      cl?.target[1] ?? 0,
      cl?.radius ?? 1,
      cl?.metric === "l1" ? 1 : 0
    );

    const k = p.constants ?? [];
    gl.uniform3f(this.u("u_k0"), k[0] ?? 0, k[1] ?? 0, k[2] ?? 0);
    gl.uniform3f(this.u("u_k1"), k[3] ?? 0, k[4] ?? 0, k[5] ?? 0);
    gl.uniform1f(this.u("u_dt"), cl ? cl.dt : (p.dt ?? 0.01));
    const s = p.slice ?? DEFAULT_SLICE;
    gl.uniform3f(this.u("u_origin"), ...s.origin);
    gl.uniform3f(this.u("u_axisU"), ...s.u);
    gl.uniform3f(this.u("u_axisV"), ...s.v);
    const t = p.target ?? { center: [0, 0, 0], radius: 1 };
    gl.uniform3f(this.u("u_center"), ...t.center);
    gl.uniform1f(this.u("u_radius"), t.radius);
    gl.uniform1f(this.u("u_angle"), p.angle ?? 0);
    gl.uniform1f(this.u("u_bounds"), p.bounds ?? 1);
    const esc = p.escape && p.escape.max > 0 ? p.escape : null;
    gl.uniform1i(this.u("u_escLayer"), esc ? 1 : 0);
    if (esc) {
      gl.uniform1f(this.u("u_escRow"), PALETTE_ROW[esc.palette]);
      gl.uniform1f(this.u("u_escGamma"), esc.gamma);
      gl.uniform1f(this.u("u_escMax"), esc.max);
      gl.uniform1f(this.u("u_escAlpha"), esc.alpha);
    }
  }

  /**
   * Draw `p`. `scale` < 1 renders fewer pixels and stretches them (while a drag
   * is in progress); `cells` renders the grid itself.
   */
  render(p: FractalParams, scale = 1): void {
    const gl = this.gl;
    const [W, H] = this.fit();
    let w = W;
    let h = H;
    const cells = p.cells ?? 0;
    if (cells > 0) {
      const short = Math.min(W, H);
      w = Math.max(1, Math.round((cells * W) / short));
      h = Math.max(1, Math.round((cells * H) / short));
    } else if (scale < 1) {
      w = Math.max(1, Math.round(W * scale));
      h = Math.max(1, Math.round(H * scale));
    }
    const offscreen = w !== W || h !== H;

    try {
      this.use(p);
    } catch {
      this.clear(); // this variant won't compile here: ink rather than a broken frame
      return;
    }
    this.setUniforms(p, w, h, cells);

    if (!offscreen) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    if (this.fboSize[0] !== w || this.fboSize[1] !== h) {
      // Unit 1, so the palette stays bound to unit 0.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
      this.fboSize = [w, h];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, W, H, gl.COLOR_BUFFER_BIT, cells > 0 ? gl.NEAREST : gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Paint the whole canvas ink. */
  clear(): void {
    const gl = this.gl;
    this.fit();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(INK[0], INK[1], INK[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  dispose(): void {
    const gl = this.gl;
    this.programs.forEach((p) => gl.deleteProgram(p.program));
    this.programs.clear();
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.fboTex);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
