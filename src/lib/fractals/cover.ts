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

/**
 * Light mode's slice of the palette. Sunburst darkens steadily from white to
 * black, so on paper it runs backwards over its saturated middle: the set's
 * edge (t = 1) at LIGHT_RANGE[0], deep crimson, out to [1], orange, at the
 * fringe — every character at least 5:1 against the page, where the pale
 * end would vanish.
 */
const LIGHT_RANGE = [0.24, 0.48] as const;

/**
 * The cover's colour for escape step `k`, as the shader shades it (in light
 * mode, on LIGHT_RANGE); null for the set itself.
 */
export function coverRGB(k: number, theme: "dark" | "light" = "dark"): RGB | null {
  if (!k) return null;
  let t = Math.min(Math.pow(k / COVER.max, 1 / COVER.gamma), 1);
  if (theme === "light") t = LIGHT_RANGE[1] + (LIGHT_RANGE[0] - LIGHT_RANGE[1]) * t;
  const bytes = paletteBytes(COVER.palette);
  const i = Math.round(t * 255) * 3;
  return [bytes[i], bytes[i + 1], bytes[i + 2]];
}
