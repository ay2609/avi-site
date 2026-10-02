import { WORLD_GRAPH } from "@/lib/three/network/world-graph";

/**
 * The tab icon's globe, painted pixel by pixel into an RGBA buffer: land from
 * the globe's baked field, lit from the upper left, a hairline rim so it
 * holds on any tab bar, and the network's busiest hubs breathing violet.
 *
 * One painter for both: LiveIcon turns it in the open tab (land read from
 * the field the page already loads), and the static icons in src/app
 * (icon.tsx, apple-icon.tsx) are its first frame, drawn at build (land from
 * src/lib/og/land.ts), so the tab doesn't change picture when the page wakes.
 */

export type LandAt = (lat: number, lng: number) => boolean;
export type IconTheme = "dark" | "light";

export const GLOBE = {
  /** One turn, s. */
  period: 18,
  /** The axis tipped toward the viewer, so the north reads (rad). */
  tilt: 0.38,
  dark: { ocean: [30, 30, 34], land: [196, 194, 189], rim: [230, 228, 223], hub: [227, 107, 255] },
  light: { ocean: [230, 228, 223], land: [104, 101, 96], rim: [23, 23, 26], hub: [118, 52, 150] },
} as const;

/** The busiest hubs, brightest first, each with its own breathing beat. */
const HUBS = [...WORLD_GRAPH.hotspots]
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 28)
  .map((h, i) => ({ lat: (h.lat * Math.PI) / 180, lng: (h.lng * Math.PI) / 180, phase: i * 2.39996 }));

/** Paint the globe `t` s into its turn into `d` (size × size RGBA, cleared). */
export function paintGlobe(d: Uint8ClampedArray, size: number, t: number, theme: IconTheme, landAt: LandAt): void {
  const pal = GLOBE[theme];
  const R = size / 2 - size * 0.047;
  const c = size / 2;
  const spin = (t / GLOBE.period) * Math.PI * 2;
  const ct = Math.cos(GLOBE.tilt);
  const st = Math.sin(GLOBE.tilt);
  d.fill(0);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - c) / R;
      const y = (c - (py + 0.5)) / R;
      const r2 = x * x + y * y;
      if (r2 > 1.12) continue;
      const i = (py * size + px) * 4;
      const r = Math.sqrt(r2);
      if (r2 >= 1) {
        // A hairline rim just outside, so it holds on any tab bar.
        const rim = Math.max(0, 1 - Math.abs(r - 1.02) * R);
        d[i] = pal.rim[0];
        d[i + 1] = pal.rim[1];
        d[i + 2] = pal.rim[2];
        d[i + 3] = Math.round(rim * 120);
        continue;
      }
      // Coverage at the limb, so the disc's edge is smooth.
      const edge = Math.min(1, Math.max(0, (1.06 - r) * R * 0.9));
      const z = Math.sqrt(1 - r2);
      // Untilt, then read the latitude and the longitude under the spin.
      const y2 = y * ct + z * st;
      const z2 = -y * st + z * ct;
      const lat = Math.asin(Math.max(-1, Math.min(1, y2)));
      let lng = Math.atan2(x, z2) + spin;
      lng = ((((lng + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      const base = landAt(lat, lng) ? pal.land : pal.ocean;
      // Lit from the upper left; the far side of the limb falls off.
      const shade = 0.55 + 0.45 * Math.max(0, x * -0.35 + y * 0.35 + z * 0.87);
      d[i] = base[0] * shade;
      d[i + 1] = base[1] * shade;
      d[i + 2] = base[2] * shade;
      d[i + 3] = Math.round(edge * 255);
    }
  }

  // The hubs facing us, a pixel each at tab size, breathing.
  const dot = Math.max(1, Math.round(size / 32));
  for (const h of HUBS) {
    const lng = h.lng - spin;
    const x = Math.cos(h.lat) * Math.sin(lng);
    const y2 = Math.sin(h.lat);
    const z2 = Math.cos(h.lat) * Math.cos(lng);
    const y = y2 * ct - z2 * st;
    const z = y2 * st + z2 * ct;
    if (z < 0.15) continue;
    const glow = 0.55 + 0.45 * Math.sin(t * 2.2 + h.phase);
    const cx = Math.round(c + x * R - dot / 2);
    const cy = Math.round(c - y * R - dot / 2);
    for (let j = 0; j < dot; j++)
      for (let k = 0; k < dot; k++) {
        const px = cx + k;
        const py = cy + j;
        if (px < 0 || py < 0 || px >= size || py >= size) continue;
        const i = (py * size + px) * 4;
        for (let ch = 0; ch < 3; ch++) d[i + ch] = d[i + ch] + (pal.hub[ch] - d[i + ch]) * glow;
        d[i + 3] = 255;
      }
  }
}

/** A land lookup over an equirectangular grid (row 0 at 90° N, column 0 at 180° W). */
export function landLookup(w: number, h: number, isLand: (index: number) => boolean): LandAt {
  return (lat, lng) => {
    const u = ((Math.floor(((lng + Math.PI) / (Math.PI * 2)) * w) % w) + w) % w;
    const v = Math.min(h - 1, Math.max(0, Math.floor(((Math.PI / 2 - lat) / Math.PI) * h)));
    return isLand(v * w + u);
  };
}
