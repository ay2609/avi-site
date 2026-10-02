import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ASCII_FIELDS, ASCII_RAMPS, type AsciiFieldId } from "@/lib/ascii/fields";
import { COVER_VIEW, COVER, coverRGB, escapeStep } from "@/lib/fractals/cover";
import { WORLD_GRAPH } from "@/lib/three/network/world-graph";
import { decodeWatchModel } from "@/lib/watch/model";

import { LAND } from "./land";
import { pngDataUrl } from "./png";

/**
 * The link previews' pictures, drawn at build time from the same sources as
 * the page — the fractal cover's colouring, the globe's land and network
 * hubs, the watch's board mesh, the ASCII fields — and handed back as PNG
 * data URLs for next/og. Everything is supersampled 2× and box-filtered down.
 */

const SS = 2;
type RGB = readonly [number, number, number];
const INK: RGB = [10, 10, 11];
const BONE: RGB = [230, 228, 223];
const VIOLET: RGB = [227, 107, 255]; // the network's core violet (catalog.ts)

/** A float RGB buffer at SS× with a box-filtered RGBA readout. */
function canvas(w: number, h: number, bg: RGB = INK) {
  const W = w * SS;
  const H = h * SS;
  const px = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) px.set(bg, i * 3);
  const mix = (x: number, y: number, c: RGB, a: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 3;
    const k = Math.min(1, a);
    px[i] += (c[0] - px[i]) * k;
    px[i + 1] += (c[1] - px[i + 1]) * k;
    px[i + 2] += (c[2] - px[i + 2]) * k;
  };
  const read = () => {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let j = 0; j < SS; j++)
          for (let i = 0; i < SS; i++) {
            const k = ((y * SS + j) * W + x * SS + i) * 3;
            r += px[k];
            g += px[k + 1];
            b += px[k + 2];
          }
        const o = (y * w + x) * 4;
        const n = SS * SS;
        out[o] = r / n;
        out[o + 1] = g / n;
        out[o + 2] = b / n;
        out[o + 3] = 255;
      }
    return pngDataUrl(w, h, out);
  };
  return { W, H, px, mix, read };
}

// --- The fractal cover -----------------------------------------------------------

/** The Mandelbrot cover, as the article opens on it: sunburst on ink. */
export function fractalArt(size: number): string {
  const c = canvas(size, size);
  const { center, half } = COVER_VIEW;
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const cr = center[0] + ((x + 0.5) / c.W - 0.5) * 2 * half;
      const ci = center[1] - ((y + 0.5) / c.H - 0.5) * 2 * half;
      const rgb = coverRGB(escapeStep(cr, ci, COVER.iters));
      if (rgb) c.px.set(rgb, (y * c.W + x) * 3);
    }
  return c.read();
}

// --- The globe -------------------------------------------------------------------

const landBits = Uint8Array.from(atob(LAND.bits), (ch) => ch.charCodeAt(0));
function isLand(lat: number, lng: number): boolean {
  const u = Math.floor(((lng + Math.PI) / (Math.PI * 2)) * LAND.w) % LAND.w;
  const v = Math.min(LAND.h - 1, Math.max(0, Math.floor(((Math.PI / 2 - lat) / Math.PI) * LAND.h)));
  const i = v * LAND.w + ((u + LAND.w) % LAND.w);
  return (landBits[i >> 3] & (0x80 >> (i & 7))) !== 0;
}

/**
 * The globe as the page shows it: ink ocean, land a shade up with its coast
 * drawn in bone, a graticule, and the network's busiest hubs lit violet with
 * a few links between neighbours. `lng0` is the longitude facing us (deg).
 */
export function globeArt(size: number, lng0 = -40, tilt = 18): string {
  const c = canvas(size, size);
  const R = c.W / 2 - 3 * SS;
  const cx = c.W / 2;
  const cy = c.H / 2;
  const t = (tilt * Math.PI) / 180;
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const l0 = (lng0 * Math.PI) / 180;

  // Screen → (lat, lng), or null off the disc.
  const geo = (x: number, y: number): [number, number, number] | null => {
    const nx = (x + 0.5 - cx) / R;
    const ny = (cy - (y + 0.5)) / R;
    const r2 = nx * nx + ny * ny;
    if (r2 >= 1) return null;
    const nz = Math.sqrt(1 - r2);
    const y2 = ny * ct + nz * st;
    const z2 = -ny * st + nz * ct;
    return [Math.asin(Math.max(-1, Math.min(1, y2))), Math.atan2(nx, z2) + l0, nz];
  };
  // (lat, lng) → screen, and whether it faces us.
  const screen = (lat: number, lng: number): [number, number, number] => {
    const L = lng - l0;
    const x = Math.cos(lat) * Math.sin(L);
    const y2 = Math.sin(lat);
    const z2 = Math.cos(lat) * Math.cos(L);
    const y = y2 * ct - z2 * st;
    const z = y2 * st + z2 * ct;
    return [cx + x * R, cy - y * R, z];
  };

  const land = new Uint8Array(c.W * c.H);
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const g = geo(x, y);
      if (!g) continue;
      const [lat, lng, nz] = g;
      const isL = isLand(lat, lng);
      land[y * c.W + x] = isL ? 2 : 1;
      const shade = 0.6 + 0.4 * nz;
      const base: RGB = isL ? [36, 36, 40] : [17, 17, 19];
      c.px.set([base[0] * shade, base[1] * shade, base[2] * shade], (y * c.W + x) * 3);
      // Graticule every 30°, a hairline.
      const dLat = Math.abs(((lat * 180) / Math.PI + 90) % 30 - 15);
      const dLng = Math.abs(((((lng * 180) / Math.PI) % 30) + 30) % 30 - 15);
      const near = Math.min(15 - dLat, (15 - dLng) * Math.cos(lat));
      if (near < 0.28) c.mix(x, y, [52, 52, 57], 0.9 * shade);
    }
  // The coast: where land meets sea, in bone.
  for (let y = 1; y < c.H - 1; y++)
    for (let x = 1; x < c.W - 1; x++) {
      const v = land[y * c.W + x];
      if (v !== 2) continue;
      if (land[y * c.W + x + 1] === 1 || land[y * c.W + x - 1] === 1 || land[(y + 1) * c.W + x] === 1 || land[(y - 1) * c.W + x] === 1)
        c.mix(x, y, BONE, 0.62);
    }
  // The limb.
  for (let a = 0; a < Math.PI * 2; a += 0.5 / R) c.mix(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), BONE, 0.5);

  // The network: the busiest hubs, linked to their nearest neighbours.
  const hubs = [...WORLD_GRAPH.hotspots].sort((a, b) => b.strength - a.strength).slice(0, 70);
  const rad = (d: number) => (d * Math.PI) / 180;
  const linked = new Set<string>();
  for (const a of hubs) {
    const near = hubs
      .filter((b) => b !== a)
      .map((b) => ({ b, d: Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos(rad(a.lat))) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const { b, d } of near) {
      const key = [a.id, b.id].sort().join("|");
      if (d > 25 || linked.has(key)) continue;
      linked.add(key);
      for (let s = 0; s <= 1; s += 0.004) {
        const lat = rad(a.lat + (b.lat - a.lat) * s);
        const lng = rad(a.lng + (b.lng - a.lng) * s);
        const [x, y, z] = screen(lat, lng);
        if (z > 0.05) c.mix(Math.round(x), Math.round(y), VIOLET, 0.35 * z);
      }
    }
  }
  for (const h of hubs) {
    const [x, y, z] = screen(rad(h.lat), rad(h.lng));
    if (z < 0.08) continue;
    const r = (2.2 + h.strength * 2.4) * SS;
    for (let j = -r * 3; j <= r * 3; j++)
      for (let i = -r * 3; i <= r * 3; i++) {
        const d = Math.hypot(i, j) / r;
        const a = d < 1 ? 1 : Math.exp(-(d - 1) * 1.6) * 0.35;
        c.mix(Math.round(x + i), Math.round(y + j), VIOLET, a * z);
      }
  }
  return c.read();
}

// --- The watch's board -----------------------------------------------------------

/**
 * The board as line art, the way the page's turntable draws it: the mesh's
 * feature edges (creases over 28° and open edges, as THREE.EdgesGeometry
 * finds them), with hidden lines removed against a depth buffer of the solid.
 */
export function watchArt(w: number, h: number, yawDeg = -28, pitchDeg = 52): string {
  const file = readFileSync(join(process.cwd(), "public/watch-parts.bin"));
  const model = decodeWatchModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  const c = canvas(w, h);
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const [cy0, sy0, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  const scale = Math.min(c.W, c.H) * 0.86;

  // Model → screen (x, y) and depth (bigger is nearer).
  const P = model.positions;
  const n = P.length / 3;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    const x1 = x * cy0 - y * sy0;
    const y1 = x * sy0 + y * cy0;
    sx[i] = c.W / 2 + x1 * scale;
    sy[i] = c.H / 2 - (y1 * cp + z * sp) * scale;
    sz[i] = -y1 * sp + z * cp;
  }

  // The solid, into a depth buffer.
  const zbuf = new Float32Array(c.W * c.H).fill(-Infinity);
  const tris: [number, number, number][] = [];
  for (const part of model.parts) {
    const [v0] = part.v;
    const [i0, count] = part.i;
    for (let k = 0; k < count; k += 3)
      tris.push([v0 + model.indices[i0 + k], v0 + model.indices[i0 + k + 1], v0 + model.indices[i0 + k + 2]]);
  }
  for (const [a, b, d] of tris) {
    const minX = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[d])));
    const maxX = Math.min(c.W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[d])));
    const minY = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[d])));
    const maxY = Math.min(c.H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[d])));
    const area = (sx[b] - sx[a]) * (sy[d] - sy[a]) - (sy[b] - sy[a]) * (sx[d] - sx[a]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((sx[b] - px) * (sy[d] - py) - (sy[b] - py) * (sx[d] - px)) / area;
        const w1 = ((sx[d] - px) * (sy[a] - py) - (sy[d] - py) * (sx[a] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[d];
        const i = y * c.W + x;
        if (z > zbuf[i]) zbuf[i] = z;
      }
  }

  // Feature edges, welded by position (the export splits vertices at creases).
  const key = (i: number) => `${Math.round(P[i * 3] * 2e4)},${Math.round(P[i * 3 + 1] * 2e4)},${Math.round(P[i * 3 + 2] * 2e4)}`;
  const edges = new Map<string, { a: number; b: number; n: [number, number, number]; feature: boolean; faces: number }>();
  const COS = Math.cos((28 * Math.PI) / 180);
  for (const tri of tris) {
    const [a, b, d] = tri;
    const ux = P[b * 3] - P[a * 3];
    const uy = P[b * 3 + 1] - P[a * 3 + 1];
    const uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[d * 3] - P[a * 3];
    const vy = P[d * 3 + 1] - P[a * 3 + 1];
    const vz = P[d * 3 + 2] - P[a * 3 + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const [p, q] of [
      [a, b],
      [b, d],
      [d, a],
    ]) {
      const kp = key(p);
      const kq = key(q);
      const k = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
      const e = edges.get(k);
      if (!e) edges.set(k, { a: p, b: q, n: [nx, ny, nz], feature: false, faces: 1 });
      else {
        e.faces++;
        if (e.n[0] * nx + e.n[1] * ny + e.n[2] * nz < COS) e.feature = true;
      }
    }
  }

  // Draw what the solid doesn't hide.
  const EPS = 0.006;
  for (const e of edges.values()) {
    if (!e.feature && e.faces === 2) continue;
    const [x0, y0, z0] = [sx[e.a], sy[e.a], sz[e.a]];
    const [x1, y1, z1] = [sx[e.b], sy[e.b], sz[e.b]];
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 1;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const x = Math.round(x0 + (x1 - x0) * f);
      const y = Math.round(y0 + (y1 - y0) * f);
      if (x < 0 || y < 0 || x >= c.W || y >= c.H) continue;
      const z = z0 + (z1 - z0) * f;
      if (z < zbuf[y * c.W + x] - EPS) continue;
      c.mix(x, y, BONE, 0.85);
      c.mix(x + 1, y, BONE, 0.35);
      c.mix(x, y + 1, BONE, 0.35);
    }
  }
  return c.read();
}

// --- ASCII -----------------------------------------------------------------------

/**
 * A field as the page's AsciiPanel would draw it into `cols` × `rows` cells
 * of `charW` × `lineH` px, frozen at `t` s.
 */
export function asciiRows(id: AsciiFieldId, cols: number, rows: number, charW: number, lineH: number, t = 12): string[] {
  const fn = ASCII_FIELDS[id];
  const ramp = ASCII_RAMPS[id];
  const vw = cols * charW;
  const vh = rows * lineH;
  const shorter = Math.min(vw, vh);
  const sxs = vw / shorter;
  const sys = vh / shorter;
  const out: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    const v = (y / Math.max(rows - 1, 1) - 0.5) * sys + 0.5;
    for (let x = 0; x < cols; x++) {
      const u = (x / (cols - 1) - 0.5) * sxs + 0.5;
      const value = Math.min(1, Math.max(0, fn(u, v, t)));
      line += ramp[Math.round(value * (ramp.length - 1))];
    }
    out.push(line);
  }
  return out;
}
