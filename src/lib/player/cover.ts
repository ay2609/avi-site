import type { Screen } from "@/lib/teardown/device";

/**
 * What the player's 64 × 64 OLED shows: the album cover. There's no firmware
 * yet, so the cover is the site's own — the seam's isovalues (a port of
 * FabriceNeyret2's "isovalues 3", shadertoy.com/view/ldfczS, CC BY-NC-SA 3.0;
 * see src/lib/iso/IsoField.tsx) in their original spectrum on black, run on
 * the CPU at the panel's resolution, so the terraces come out as pixels.
 */
export const COVER = 64;

/** Noise cells across the screen. */
const CELLS = 2.4;
/** The original's motion and fade at 60 Hz, per step, at its 470/8 px cell. */
const SHIFT = COVER / CELLS / (470 / 8);
const KEEP = Math.exp(-33 / 470);
/** One step of the feedback, ms (the original's 60 Hz). */
const STEP_MS = 1000 / 60;
/** Steps run at power-on, so the terraces are already grown. */
const WARM = 150;
/** Where the clock starts, s. */
const T0 = 7;

const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number, z: number) => fract(Math.sin(1e3 * (x + 57 * y - 13.7 * z)) * 4375.5453);
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const layer = (k: number) =>
    lerp(
      lerp(hash(ix, iy, iz + k), hash(ix + 1, iy, iz + k), fx),
      lerp(hash(ix, iy + 1, iz + k), hash(ix + 1, iy + 1, iz + k), fx),
      fy
    );
  return lerp(layer(0), layer(1), fz);
}
const noise = (x: number, y: number, z: number) => (noise3(x, y, z) + noise3(x + 11.5, y + 11.5, z + 11.5)) / 2;

export class AlbumCover implements Screen {
  readonly width = COVER;
  readonly height = COVER;
  readonly bytes = new Uint8Array(COVER * COVER * 4);

  private buf = new Float32Array(COVER * COVER * 3);
  private next = new Float32Array(COVER * COVER * 3);
  private readonly n = new Float32Array(COVER * COVER);
  private t = T0;
  private last = 0;

  reset(now: number): void {
    this.buf.fill(0);
    this.t = T0 - WARM / 60;
    for (let i = 0; i < WARM; i++) this.advance();
    this.last = now;
    this.write();
  }

  step(now: number, animate: boolean): boolean {
    if (!animate) return false;
    const steps = Math.min(4, Math.floor((now - this.last) / STEP_MS));
    if (steps < 1) return false;
    this.last += steps * STEP_MS;
    if (now - this.last > 4 * STEP_MS) this.last = now; // after a stall, don't run to catch up
    for (let i = 0; i < steps; i++) this.advance();
    this.write();
    return true;
  }

  /** One frame of isolines over the last frame, shifted and faded. */
  private advance(): void {
    const W = COVER;
    const { n, buf, next } = this;
    const cell = W / CELLS;
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) n[y * W + x] = noise((x + 0.5) / cell, (W - y - 0.5) / cell, 0.1 * this.t);
    const sx = SHIFT;
    const sy = -SHIFT * Math.sin(this.t);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const v = Math.sin(6.28 * 10 * n[i]);
        const dn = Math.abs(n[y * W + Math.min(W - 1, x + 1)] - n[i]) + Math.abs(n[Math.min(W - 1, y + 1) * W + x] - n[i]);
        const fw = Math.abs(6.28 * 10 * Math.cos(6.28 * 10 * n[i])) * dn + 1e-6;
        const a = 1 - smooth(Math.min(1, Math.max(0, (0.5 * Math.abs(v)) / fw)));
        const px = Math.min(W - 1, Math.max(0, x + sx));
        const py = Math.min(W - 1, Math.max(0, y + sy));
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);
        const x1 = Math.min(W - 1, x0 + 1);
        const y1 = Math.min(W - 1, y0 + 1);
        const tx = px - x0;
        const ty = py - y0;
        for (let c = 0; c < 3; c++) {
          const last = lerp(
            lerp(buf[(y0 * W + x0) * 3 + c], buf[(y0 * W + x1) * 3 + c], tx),
            lerp(buf[(y1 * W + x0) * 3 + c], buf[(y1 * W + x1) * 3 + c], tx),
            ty
          );
          const line = 0.5 + 0.5 * Math.sin(12 * n[i] + (c === 0 ? 0 : c === 1 ? 2.1 : -2.1));
          const trail = last * KEEP;
          next[i * 3 + c] = trail + (line - trail) * a;
        }
      }
    this.buf = next;
    this.next = buf;
    this.t += 1 / 60;
  }

  private write(): void {
    const { buf, bytes } = this;
    for (let i = 0; i < COVER * COVER; i++) {
      bytes[i * 4] = buf[i * 3] * 255;
      bytes[i * 4 + 1] = buf[i * 3 + 1] * 255;
      bytes[i * 4 + 2] = buf[i * 3 + 2] * 255;
      bytes[i * 4 + 3] = 255;
    }
  }
}
