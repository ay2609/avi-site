/**
 * The fractals article's cover: the whole Mandelbrot set, still, in the
 * sunburst colouring (cmasher's, as his iterative_julia.py uses it —
 * t = (n / max)^(1/3.2)). The front page's ASCII field is this picture at
 * character resolution — the same view, each character tinted with the colour
 * its cell has here — and opening the article resolves it into pixels.
 */
import { PALETTE_ROW, PALETTES, type PaletteId } from "./palettes";
import type { FractalParams } from "./renderer";

type RGB = [number, number, number];

export const COVER_VIEW: { center: [number, number]; half: number } = { center: [-0.75, 0], half: 1.5 };

export const COVER = {
  mode: "escape",
  ...COVER_VIEW,
  iters: 300,
  max: 300,
  gamma: 3.2,
  palette: "sunburst",
} satisfies FractalParams;

/** Steps before c escapes |z| ≤ 2 under z → z² + c from 0, or 0 if it hasn't within `n`. */
export function escapeStep(cr: number, ci: number, n: number): number {
  let zr = 0;
  let zi = 0;
  for (let k = 1; k <= n; k++) {
    const r = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = r;
    if (zr * zr + zi * zi > 4) return k;
  }
  return 0;
}

const decoded = new Map<PaletteId, Uint8Array>();
function paletteBytes(id: PaletteId): Uint8Array {
  let bytes = decoded.get(id);
  if (!bytes) {
    bytes = Uint8Array.from(atob(PALETTES[PALETTE_ROW[id]].data), (ch) => ch.charCodeAt(0));
    decoded.set(id, bytes);
  }
  return bytes;
}

/** The cover's colour for escape step `k`, as the shader shades it; null for the set itself (ink). */
export function coverRGB(k: number): RGB | null {
  if (!k) return null;
  const t = Math.min(Math.pow(k / COVER.max, 1 / COVER.gamma), 1);
  const bytes = paletteBytes(COVER.palette);
  const i = Math.round(t * 255) * 3;
  return [bytes[i], bytes[i + 1], bytes[i + 2]];
}
