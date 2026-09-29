/**
 * One WebGL2 fragment shader that draws every picture in the fractals article,
 * with Avi's maps, stopping rules and colourings:
 *
 *  - escape   z → z² + c, Mandelbrot (z₀ = 0) or Julia (z₀ = pixel); escape at |z| > 2.
 *  - thorn    X ← X / cos Y + cx, then Y ← Y / sin X + cy with the *new* X
 *             (numpy aliasing in Thorn.py — it is what gives the thorns); bailout 1000.
 *  - thomas / lorenz   "Fraotic": each pixel is a starting point on a slice; it is
 *             stepped with forward Euler until it enters the sphere around the
 *             attractor (the orbit's mean, radius its farthest point) — the colour
 *             is how many steps that took — or passes 1000 from it (ink).
 *
 * Colour is his: t = (n / max)^(1/γ) through one of the baked palettes
 * (palettes.ts). `cells` renders on an N-cell grid and scales it up with nearest
 * filtering — his 9×9 and 27×27 Mandelbrots, and the article's resolve.
 */
import { PALETTE_ROW, PALETTES, type PaletteId } from "./palettes";

export type Mode = "none" | "escape" | "thorn" | "thomas" | "lorenz";

export interface FractalParams {
  mode: Mode;
  /** Plane centre and half-height; the width follows the canvas. Fraotic: unused. */
  center?: [number, number];
  half?: number;
  /** Julia (z₀ = pixel, c fixed) instead of Mandelbrot (z₀ = 0, c = pixel). */
  julia?: boolean;
  /** Julia c; Thorn (cx, cy). */
  c?: [number, number];
  iters: number;
  /** Normalisation: his image maximum. */
  max: number;
  /** Colour exponent: t = (n/max)^(1/gamma). 1 = linear. */
  gamma: number;
  palette: PaletteId;
  /** Points that never escape: ink, or the top of the palette (the early Julias). */
  interior?: "ink" | "max";
  /** Count offset (his recursive versions counted from 0). */
  offset?: number;
  /** The first Julia's own colours (pygame, main.py). */
  pygame?: boolean;
  /** Mirror vertically (imshow without origin="lower"). */
  flipY?: boolean;
  /** Render on an N-cell grid across the shorter side, sampled like linspace. 0 = per pixel. */
  cells?: number;
  /** Fraotic: slice centre and radius of the target sphere, slice angle about z. */
  target?: { center: [number, number, number]; radius: number };
  angle?: number;
  dt?: number;
  bounds?: number;
  /**
   * Fraotic: colour the points that fly off too (his commented-out `alt_mapp`
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

const FRAG = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 u_size;
uniform int u_mode;
uniform bool u_julia;
uniform bool u_grid;
uniform vec3 u_view;
uniform int u_iters;
uniform float u_max;
uniform float u_gamma;
uniform vec2 u_c;
uniform bool u_interiorMax;
uniform float u_offset;
uniform bool u_pygame;
uniform bool u_flipY;
uniform sampler2D u_pal;
uniform float u_row;
uniform float u_rows;
uniform vec3 u_ink;
uniform vec3 u_center;
uniform float u_radius;
uniform float u_angle;
uniform float u_dt;
uniform float u_bounds;
uniform float u_thomasB;
uniform bool u_escLayer;
uniform float u_escRow;
uniform float u_escGamma;
uniform float u_escMax;
uniform float u_escAlpha;

out vec4 outColor;

vec3 paletteRow(float t, float row) {
  t = clamp(t, 0.0, 1.0);
  return texture(u_pal, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, (row + 0.5) / u_rows)).rgb;
}

vec3 palette(float t) {
  return paletteRow(t, u_row);
}

vec3 shade(float n) {
  return palette(pow(max(n + u_offset, 0.0) / u_max, 1.0 / u_gamma));
}

vec3 interior() {
  return u_interiorMax ? palette(1.0) : u_ink;
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

vec3 escapeTime(vec2 p) {
  vec2 z = u_julia ? p : vec2(0.0);
  vec2 c = u_julia ? u_c : p;
  if (!u_julia) {
    // The main cardioid and the period-2 bulb never escape: skip their iterations.
    float qx = c.x - 0.25;
    float q = qx * qx + c.y * c.y;
    if (q * (q + qx) <= 0.25 * c.y * c.y || (c.x + 1.0) * (c.x + 1.0) + c.y * c.y <= 0.0625) return interior();
  }
  for (int i = 1; i <= ${MAX_LOOP}; i++) {
    if (i > u_iters) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) {
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

vec3 field(vec3 p) {
  if (u_mode == 3) return vec3(sin(p.y) - u_thomasB * p.x, sin(p.z) - u_thomasB * p.y, sin(p.x) - u_thomasB * p.z);
  return vec3(10.0 * (p.y - p.x), 28.0 * p.x - p.y - p.x * p.z, p.x * p.y - 2.667 * p.z);
}

vec3 fraotic(vec2 uv) {
  // lorenz.py: x across, z down the image, on the plane y = 0; rotated about the vertical through the centre.
  float s = uv.x * u_bounds;
  vec3 p = vec3(u_center.x + s * cos(u_angle), s * sin(u_angle), u_center.z + uv.y * u_bounds);
  for (int n = 1; n <= ${MAX_LOOP}; n++) {
    if (n > u_iters) break;
    float d = distance(p, u_center);
    if (d < u_radius) return shade(float(n));
    if (!(d <= 1000.0)) {
      if (!u_escLayer) return u_ink;
      vec3 e = paletteRow(pow(float(n) / u_escMax, 1.0 / u_escGamma), u_escRow);
      return mix(u_ink, e, u_escAlpha);
    }
    p += u_dt * field(p);
  }
  return u_ink;
}

void main() {
  vec2 uv = unit();
  float aspect = u_size.x / u_size.y;
  vec2 p = u_view.xy + uv * vec2(u_view.z * aspect, u_view.z);
  vec3 col = u_ink;
  if (u_mode == 1) col = escapeTime(p);
  else if (u_mode == 2) col = thorn(p);
  else if (u_mode == 3 || u_mode == 4) col = fraotic(uv * vec2(aspect, 1.0));
  outColor = vec4(col, 1.0);
}`;

const MODES: Record<Mode, number> = { none: 0, escape: 1, thorn: 2, thomas: 3, lorenz: 4 };

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

export class FractalRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
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
    this.program = this.link(VERT, FRAG);
    gl.useProgram(this.program);

    const pal = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, PALETTES.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, decodePalettes());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u("u_pal"), 0);
    gl.uniform1f(this.u("u_rows"), PALETTES.length);
    gl.uniform3fv(this.u("u_ink"), INK);
    gl.uniform1f(this.u("u_thomasB"), 0.208186);

    this.fbo = gl.createFramebuffer()!;
    this.fboTex = gl.createTexture()!;
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
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name)!;
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

    gl.useProgram(this.program);
    gl.uniform2f(this.u("u_size"), w, h);
    gl.uniform1i(this.u("u_mode"), MODES[p.mode]);
    gl.uniform1i(this.u("u_julia"), p.julia ? 1 : 0);
    gl.uniform1i(this.u("u_grid"), cells > 0 ? 1 : 0);
    const [cx, cy] = p.center ?? [0, 0];
    gl.uniform3f(this.u("u_view"), cx, cy, p.half ?? 1.5);
    gl.uniform1i(this.u("u_iters"), Math.min(p.iters, MAX_LOOP));
    gl.uniform1f(this.u("u_max"), p.max);
    gl.uniform1f(this.u("u_gamma"), p.gamma);
    gl.uniform2f(this.u("u_c"), p.c?.[0] ?? 0, p.c?.[1] ?? 0);
    gl.uniform1i(this.u("u_interiorMax"), p.interior === "max" ? 1 : 0);
    gl.uniform1f(this.u("u_offset"), p.offset ?? 0);
    gl.uniform1i(this.u("u_pygame"), p.pygame ? 1 : 0);
    gl.uniform1i(this.u("u_flipY"), p.flipY ? 1 : 0);
    gl.uniform1f(this.u("u_row"), PALETTE_ROW[p.palette]);
    const t = p.target ?? { center: [0, 0, 0], radius: 1 };
    gl.uniform3f(this.u("u_center"), ...t.center);
    gl.uniform1f(this.u("u_radius"), t.radius);
    gl.uniform1f(this.u("u_angle"), p.angle ?? 0);
    gl.uniform1f(this.u("u_dt"), p.dt ?? 0.01);
    gl.uniform1f(this.u("u_bounds"), p.bounds ?? 1);
    gl.uniform1i(this.u("u_escLayer"), p.escape ? 1 : 0);
    if (p.escape) {
      gl.uniform1f(this.u("u_escRow"), PALETTE_ROW[p.escape.palette]);
      gl.uniform1f(this.u("u_escGamma"), p.escape.gamma);
      gl.uniform1f(this.u("u_escMax"), p.escape.max);
      gl.uniform1f(this.u("u_escAlpha"), p.escape.alpha);
    }

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
    gl.deleteProgram(this.program);
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.fboTex);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
