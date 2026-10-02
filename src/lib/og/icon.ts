import { type IconTheme, landLookup, paintGlobe } from "@/lib/icon/globe";

import { LAND } from "./land";
import { encodePng } from "./png";

/**
 * The static icons: the tab globe's first frame (lib/icon/globe.ts), drawn
 * at build from the baked land mask, so the tab shows the same picture
 * before and after LiveIcon takes over. Server-only.
 */

const bits = Uint8Array.from(atob(LAND.bits), (ch) => ch.charCodeAt(0));
const landAt = landLookup(LAND.w, LAND.h, (i) => (bits[i >> 3] & (0x80 >> (i & 7))) !== 0);

/** The globe alone on transparency, `size` px square. */
export function globeIcon(size: number, theme: IconTheme = "dark"): Buffer {
  const d = new Uint8ClampedArray(size * size * 4);
  paintGlobe(d, size, 0, theme, landAt);
  return encodePng(size, size, d);
}

/** The globe at `inner` px on an opaque square of `ground` — for home screens, which drop alpha. */
export function globeTile(size: number, inner: number, ground: [number, number, number] = [10, 10, 11]): Buffer {
  const g = new Uint8ClampedArray(inner * inner * 4);
  paintGlobe(g, inner, 0, "dark", landAt);
  const d = new Uint8ClampedArray(size * size * 4);
  const o = Math.round((size - inner) / 2);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let [r, gg, b] = ground;
      const gx = x - o;
      const gy = y - o;
      if (gx >= 0 && gy >= 0 && gx < inner && gy < inner) {
        const j = (gy * inner + gx) * 4;
        const a = g[j + 3] / 255;
        r += (g[j] - r) * a;
        gg += (g[j + 1] - gg) * a;
        b += (g[j + 2] - b) * a;
      }
      d.set([r, gg, b, 255], i);
    }
  return encodePng(size, size, d);
}
