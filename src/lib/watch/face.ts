/**
 * sovereign OS, re-drawn in the browser.
 *
 * A 240 × 280 framebuffer and a line-for-line port of the drawing routines in
 * ~/workspaces/sovereign (components/st7789/st7789.c, fontbdf) and the two
 * screens in main/watch.c: the OS / sovereign boot and glitch, and the dial
 * face with the time, the tilt dial and the battery gauge. Integer maths is
 * truncated the way C truncates it, so shapes land on the same pixels.
 *
 * Colours follow the site, not the device: `color` is bone, `bg` is ink.
 * Stand-ins for the hardware: the clock is the reader's clock, the IMU is the
 * pointer, the battery is the reader's battery when the browser will say.
 */
import { LARGE, MEDIUM, SMALL, type BdfFont } from "./glyphs";
import type { FaceButton } from "./chapters";

export const FACE_W = 240;
export const FACE_H = 280;

/** ABGR, as a little-endian Uint32 view writes RGBA bytes. */
const abgr = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const COLOR = abgr(0xe6, 0xe4, 0xdf); // bone — theme->color
const BG = abgr(0x0a, 0x0a, 0x0b); // ink — theme->bg
const WHITE = abgr(0xfa, 0xfa, 0xfa); // WHITE

/** One simulated frame of the firmware's main loop, ms (≈ 25 fps). */
const FRAME_MS = 40;
/** How long the boot glitch runs before SNTP "syncs" and the dial face comes up. */
const SYNC_MS = 2600;

const trunc = Math.trunc;
const div = (a: number, b: number) => trunc(a / b);

interface Bitmap {
  w: number;
  h: number;
  yo: number;
  bits: Uint8Array;
}

const decoded = new WeakMap<BdfFont, Map<string, Bitmap>>();
function glyph(font: BdfFont, ch: string): Bitmap | undefined {
  let cache = decoded.get(font);
  if (!cache) {
    cache = new Map();
    for (const [key, g] of Object.entries(font.glyphs)) {
      const bits = new Uint8Array(g.w * g.h);
      g.rows.forEach((hex, row) => {
        for (let col = 0; col < g.w; col++) {
          const nibble = parseInt(hex[col >> 2] ?? "0", 16);
          bits[row * g.w + col] = (nibble >> (3 - (col & 3))) & 1;
        }
      });
      cache.set(key, { w: g.w, h: g.h, yo: g.yo, bits });
    }
    decoded.set(font, cache);
  }
  return cache.get(ch);
}

/** The panel's memory, and the driver's primitives over it. */
export class Framebuffer {
  readonly bytes = new Uint8Array(FACE_W * FACE_H * 4);
  private readonly px = new Uint32Array(this.bytes.buffer);

  pixel(x: number, y: number, c: number): void {
    if (x >= FACE_W || y >= FACE_H || x < 0 || y < 0) return;
    this.px[y * FACE_W + x] = c;
  }

  fillRect(x1: number, y1: number, x2: number, y2: number, c: number): void {
    // uint16 parameters: a negative start wraps past the edge and draws nothing.
    if (x1 < 0 || y1 < 0 || x1 >= FACE_W || y1 >= FACE_H) return;
    if (x2 >= FACE_W) x2 = FACE_W - 1;
    if (y2 >= FACE_H) y2 = FACE_H - 1;
    for (let j = y1; j <= y2; j++) this.px.fill(c, j * FACE_W + x1, j * FACE_W + x2 + 1);
  }

  fill(c: number): void {
    this.px.fill(c);
  }

  line(x1: number, y1: number, x2: number, y2: number, c: number): void {
    const dx = x2 > x1 ? x2 - x1 : x1 - x2;
    const dy = y2 > y1 ? y2 - y1 : y1 - y2;
    const sx = x2 > x1 ? 1 : -1;
    const sy = y2 > y1 ? 1 : -1;
    if (dx > dy) {
      let e = -dx;
      for (let i = 0; i <= dx; i++) {
        this.pixel(x1, y1, c);
        x1 += sx;
        e += 2 * dy;
        if (e >= 0) {
          y1 += sy;
          e -= 2 * dx;
        }
      }
    } else {
      let e = -dy;
      for (let i = 0; i <= dy; i++) {
        this.pixel(x1, y1, c);
        y1 += sy;
        e += 2 * dx;
        if (e >= 0) {
          x1 += sx;
          e -= 2 * dy;
        }
      }
    }
  }

  private rot(x: number, y: number, xc: number, yc: number, angle: number): [number, number] {
    const rd = (-angle * Math.PI) / 180;
    return [trunc(x * Math.cos(rd) - y * Math.sin(rd) + xc), trunc(x * Math.sin(rd) + y * Math.cos(rd) + yc)];
  }

  lineAngle(x1: number, y1: number, x2: number, y2: number, xc: number, yc: number, angle: number, c: number): void {
    const [a, b] = this.rot(x1, y1, xc, yc, angle);
    const [d, e] = this.rot(x2, y2, xc, yc, angle);
    this.line(a, b, d, e, c);
  }

  rectAngle(xc: number, yc: number, w: number, h: number, angle: number, c: number): void {
    const hw = div(w, 2);
    const hh = div(h, 2);
    const [x1, y1] = this.rot(-hw, hh, xc, yc, angle);
    const [x2, y2] = this.rot(-hw, -hh, xc, yc, angle);
    const [x3, y3] = this.rot(hw, hh, xc, yc, angle);
    const [x4, y4] = this.rot(hw, -hh, xc, yc, angle);
    this.line(x1, y1, x2, y2, c);
    this.line(x1, y1, x3, y3, c);
    this.line(x2, y2, x4, y4, c);
    this.line(x3, y3, x4, y4, c);
  }

  fillRectAngle(xc: number, yc: number, w: number, h: number, xo: number, yo: number, angle: number, c: number): void {
    const hw = div(w, 2);
    const hh = div(h, 2);
    const p = [
      this.rot(-hw + xo, hh + yo, xc, yc, angle),
      this.rot(-hw + xo, -hh + yo, xc, yc, angle),
      this.rot(hw + xo, hh + yo, xc, yc, angle),
      this.rot(hw + xo, -hh + yo, xc, yc, angle),
    ].map(([x, y]) => ({ x, y }));
    type P = { x: number; y: number };
    const byY = (a: P[], i: number, j: number) => {
      if (a[i].y > a[j].y) [a[i], a[j]] = [a[j], a[i]];
    };
    const byN = (a: number[], i: number, j: number) => {
      if (a[i] > a[j]) [a[i], a[j]] = [a[j], a[i]];
    };
    // sortCoordinates4: a network, not a full sort — kept as written.
    byY(p, 0, 1);
    byY(p, 2, 3);
    byY(p, 0, 2);
    byY(p, 1, 3);
    byY(p, 1, 2);
    const sect = (a: P, b: P, y: number) =>
      a.y === b.y ? b.x : a.x + div((y - a.y) * (b.x - a.x), b.y - a.y);
    for (let y = p[0].y; y < p[3].y; y++) {
      const s = [sect(p[0], p[1], y), sect(p[0], p[2], y), sect(p[1], p[3], y), sect(p[2], p[3], y)];
      // sortPoints4, the same network over the four crossings.
      byN(s, 0, 1);
      byN(s, 2, 3);
      byN(s, 0, 2);
      byN(s, 1, 3);
      byN(s, 1, 2);
      const [from, to] =
        y < p[0].y + 2 || y > p[3].y - 2 || Math.abs(s[1] - s[2]) > 2 ? [s[1], s[2]] : [s[0], s[3]];
      for (let x = from; x <= to; x++) this.pixel(x, y, c);
    }
  }

  polygon(xc: number, yc: number, n: number, r: number, angle: number, c: number): void {
    for (let i = 0; i < n; i++) {
      const [x1, y1] = this.rot(r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n), xc, yc, angle);
      const [x2, y2] = this.rot(
        r * Math.cos((2 * Math.PI * (i + 1)) / n),
        r * Math.sin((2 * Math.PI * (i + 1)) / n),
        xc,
        yc,
        angle
      );
      this.line(x1, y1, x2, y2, c);
    }
  }

  triangleAngle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    xc: number,
    yc: number,
    angle: number,
    c: number
  ): void {
    const [a, b] = this.rot(x1, y1, xc, yc, angle);
    const [d, e] = this.rot(x2, y2, xc, yc, angle);
    const [f, g] = this.rot(x3, y3, xc, yc, angle);
    this.line(a, b, d, e, c);
    this.line(a, b, f, g, c);
    this.line(d, e, f, g, c);
  }

  circle(x0: number, y0: number, r: number, c: number): void {
    let x = 0;
    let y = -r;
    let err = 2 - 2 * r;
    do {
      this.pixel(x0 - x, y0 + y, c);
      this.pixel(x0 - y, y0 - x, c);
      this.pixel(x0 + x, y0 - y, c);
      this.pixel(x0 + y, y0 + x, c);
      const old = err;
      if (old <= x) err += ++x * 2 + 1;
      if (old > y || err > x) err += ++y * 2 + 1;
    } while (y < 0);
  }

  fillCircle(x0: number, y0: number, r: number, c: number): void {
    let x = 0;
    let y = -r;
    let err = 2 - 2 * r;
    let change = true;
    do {
      if (change) {
        this.line(x0 - x, y0 - y, x0 - x, y0 + y, c);
        this.line(x0 + x, y0 - y, x0 + x, y0 + y, c);
      }
      const old = err;
      change = old <= x;
      if (change) err += ++x * 2 + 1;
      if (old > y || err > x) err += ++y * 2 + 1;
    } while (y <= 0);
  }

  roundRect(x1: number, y1: number, x2: number, y2: number, r: number, c: number): void {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    if (x2 - x1 < r || y2 - y1 < r) return;
    let x = 0;
    let y = -r;
    let err = 2 - 2 * r;
    do {
      if (x) {
        this.pixel(x1 + r - x, y1 + r + y, c);
        this.pixel(x2 - r + x, y1 + r + y, c);
        this.pixel(x1 + r - x, y2 - r - y, c);
        this.pixel(x2 - r + x, y2 - r - y, c);
      }
      const old = err;
      if (old <= x) err += ++x * 2 + 1;
      if (old > y || err > x) err += ++y * 2 + 1;
    } while (y < 0);
    this.line(x1 + r, y1, x2 - r, y1, c);
    this.line(x1 + r, y2, x2 - r, y2, c);
    this.line(x1, y1 + r, x1, y2 - r, c);
    this.line(x2, y1 + r, x2, y2 - r, c);
  }

  /** lcdDrawCharBDF2: bottom row first, `y` is the baseline; advance = BBX width + 2. */
  private char(font: BdfFont, ch: string, x: number, y: number, c: number, topRows?: number): number {
    const g = glyph(font, ch);
    if (!g) return x; // outside the loaded range (the firmware's '%'): nothing
    // lcdDrawCharBDF3 draws only the glyph's first `topRows` rows, ending 10px above the baseline.
    const rows = topRows ?? g.h;
    let yy = topRows ? y - topRows : y - g.yo;
    for (let row = rows; row > 0; row--) {
      if (row <= g.h) {
        for (let col = 0; col < g.w; col++) if (g.bits[(row - 1) * g.w + col]) this.pixel(x + col, yy, c);
      }
      yy--;
    }
    return x + g.w + 2;
  }

  /** lcdDrawString2 / lcdDrawString3: `y` is the top; strings sit on y + ref height. */
  string(font: BdfFont, text: string, x: number, y: number, c: number, topSlice = false): number {
    for (const ch of text) x = this.char(font, ch, x, y + font.ref.h, c, topSlice ? 10 : undefined);
    return x;
  }
}

const W32 = MEDIUM.ref.w;
const H32 = MEDIUM.ref.h;
const W52 = LARGE.ref.w;
const H52 = LARGE.ref.h;
const W12 = SMALL.ref.w;
const H12 = SMALL.ref.h;
const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** The watch: screens, buttons, backlight — main/watch.c's ST7789 task. */
export class SovereignFace {
  readonly fb = new Framebuffer();
  /** Accelerometer stand-in, in g (±1), set from the pointer. */
  tilt = { x: 0, y: 0 };
  /** 0–100, or null when unknown. */
  battery: number | null = null;
  backlight = true;

  private screen = 0;
  private opening = 0; // stage of the boot sequence, 5 = done
  private stageAt = 0;
  private syncAt = 0;
  private lastFrame = 0;
  private lastBattery = -Infinity;
  private i = 0;
  private needsUpdate = true;
  private last = { h: -1, m: -1, s: -1 };
  private smooth = { x: 0, y: 0 };

  /** Power on: boot sequence, the glitch while Wi-Fi syncs the clock, then the dial face. */
  reset(now: number): void {
    this.screen = 0;
    this.opening = 0;
    this.stageAt = now;
    this.syncAt = now + SYNC_MS;
    this.lastFrame = now - FRAME_MS;
    this.backlight = true;
    this.needsUpdate = true;
    this.fb.fill(BG);
  }

  press(button: FaceButton): void {
    if (button === "wake") {
      if (!this.backlight) {
        this.backlight = true;
        this.needsUpdate = true;
      }
      return;
    }
    if (!this.backlight) return; // asleep until IO18
    if (button === "sleep") {
      this.fb.fill(BG);
      this.backlight = false;
    } else if (button === "next" || button === "back") {
      this.screen = this.screen === 0 ? 1 : 0; // two screens: up and down both toggle
      this.syncAt = Infinity;
      this.fb.fill(BG);
      this.needsUpdate = true;
    }
    // IO35 is wired but unassigned on its own.
  }

  /** Advance to `now`. Returns true when the framebuffer changed. */
  step(now: number, animate = true): boolean {
    if (!this.backlight) return false;
    if (now - this.lastFrame < FRAME_MS) return false;
    this.lastFrame = now;

    if (this.screen === 0 && now >= this.syncAt) {
      // ds3231 task: SNTP has set the clock, go to the face.
      this.screen = 1;
      this.syncAt = Infinity;
      this.fb.fill(BG);
      this.needsUpdate = true;
    }
    if (this.screen === 0) this.bootOrGlitch(now);
    else this.dial(now, animate);
    return true;
  }

  private bootOrGlitch(now: number): void {
    const fb = this.fb;
    const os = "OS";
    const sov = "sovereign";
    const len1 = os.length * W52;
    const len2 = sov.length * W32;
    const osX = div(FACE_W - 9 * W32, 2);
    const osY = div(FACE_H + H32, 2);
    const sovX = div(FACE_W - len2, 2);
    const sovY = div(FACE_H - H32, 2);

    const text = () => {
      fb.string(LARGE, os, osX + 2, osY + 2, COLOR);
      fb.string(MEDIUM, sov, sovX, sovY, COLOR);
    };
    const rings = () => {
      fb.roundRect(osX, osY, osX + len1 + 4, osY + H52 + 4, 5, COLOR);
      fb.line(osX, osY, osX, osY + 6, COLOR);
      fb.line(osX + len1 + 4, osY, osX + len1 + 4, osY + 6, COLOR);
      fb.roundRect(sovX, sovY, div(FACE_W + len2, 2) + 2, osY, 5, COLOR);
    };

    if (this.opening < 5) {
      // The opening sequence: each stage holds for the firmware's vTaskDelay.
      const holds = [100, 150, 150, 150, 0];
      if (now - this.stageAt < holds[Math.max(0, this.opening - 1)] && this.opening > 0) return;
      this.stageAt = now;
      switch (this.opening) {
        case 0:
          fb.fill(BG);
          text();
          break;
        case 1:
          rings();
          break;
        case 2:
          fb.fillRect(osX, osY, osX + len1 + 4, osY + H52 + 6, COLOR);
          fb.fillRect(sovX, sovY, div(FACE_W + len2, 2) + 2, osY, COLOR);
          break;
        case 3:
          fb.fill(BG);
          text();
          rings();
          break;
        case 4:
          fb.fill(BG);
          text();
          break;
      }
      this.opening++;
      return;
    }

    // The idle glitch: "sovereign" cut 10px from the top, halves shifted apart.
    fb.fillRect(osX - 10, osY, osX + len1 + 4 + 10, osY + H52 + 6, BG);
    fb.fillRect(sovX - 10, sovY, div(FACE_W + len2, 2) + 2 + 10, osY + 10, BG);
    const shift = trunc(10 * Math.random());
    fb.string(MEDIUM, sov, sovX - shift, sovY, COLOR);
    fb.fillRect(sovX - 10, sovY, div(FACE_W + len2, 2) + 2 + 10, sovY + 15, BG);
    fb.string(LARGE, os, osX + 2, osY + 2, COLOR);
    fb.string(MEDIUM, sov, sovX + shift, sovY, COLOR, true);
  }

  private dial(now: number, animate: boolean): void {
    const fb = this.fb;
    const cx = FACE_W - 40;
    const cy = FACE_H - 40;
    const cx2 = FACE_W - 130;
    const cy2 = FACE_H - 80;
    const cx3 = FACE_W - 30;
    const cy3 = 45;

    if (animate) this.i = (this.i + 1) % 720;
    const i = this.i;
    const half = trunc(-i / 2);

    // Circle 1
    fb.fillCircle(cx, cy, 110, BG);
    for (let x = -40; x <= 40; x += 20) {
      fb.lineAngle(-50, x, 50, x, cx, cy, 45 + half, COLOR);
      fb.lineAngle(-50, x, 50, x, cx, cy, -45 + half, COLOR);
    }
    for (let x = 0; x < 360; x += 45) {
      fb.fillRectAngle(cx, cy, 40, 26, 0, 50 + 12, x + half, BG);
      fb.lineAngle(75, 0, 106, 0, cx, cy, x + i, COLOR);
    }
    for (let x = 0; x < 360; x += 45) fb.lineAngle(0, 0, 71, 0, cx, cy, x + half, COLOR);
    fb.rectAngle(cx, cy, 150, 150, i, COLOR);
    fb.rectAngle(cx, cy, 150, 150, i + 45, COLOR);
    fb.polygon(cx, cy, 8, 106, i, COLOR);
    fb.rectAngle(cx, cy, 100, 100, half, COLOR);
    fb.rectAngle(cx, cy, 100, 100, half + 45, COLOR);
    fb.polygon(cx, cy, 8, 71, half, COLOR);
    fb.triangleAngle(0, 106, -11, 75, 11, 75, cx, cy, i, WHITE);
    fb.triangleAngle(0, 71, -11, 50, 11, 50, cx, cy, half, WHITE);

    // Circle 2
    fb.fillCircle(cx3, cy3, 75, BG);
    fb.polygon(cx3, cy3, 3, 45, -i - 90, COLOR);
    fb.polygon(cx3, cy3, 3, 45, -i + 90, COLOR);
    fb.circle(cx3, cy3, 45, COLOR);
    fb.circle(cx3, cy3, 21, COLOR);
    fb.polygon(cx3, cy3, 3, 70, -i + 90, COLOR);
    fb.circle(cx3, cy3, 70, COLOR);

    // Time: HH / MM / SS stacked, each redrawn only when it changes.
    const t = new Date();
    const xpos = 8;
    const base = 19;
    const h24 = t.getHours();
    if (h24 !== this.last.h || this.needsUpdate) {
      const hour = h24 % 12 === 0 ? 12 : h24 % 12;
      const hh = two(hour);
      fb.fillRect(xpos - 1, base - 1, xpos + hh.length * W52 + 1, base + H52 + 2, BG);
      fb.string(LARGE, hh, xpos, base, COLOR);
      fb.string(SMALL, "H", xpos + 2 * W52 + 5, base + H52 - H12, COLOR);
      fb.fillRect(xpos, base + 3 * H52 + 10, xpos + 2 * W32, base + 4 * H52 + 12, BG);
      fb.string(MEDIUM, h24 < 12 ? "AM" : "PM", xpos, base + 3 * H52 + 10, COLOR);
      this.last.h = h24;
    }
    if (t.getMinutes() !== this.last.m || this.needsUpdate) {
      const y = base + (H52 + 2);
      const mm = two(t.getMinutes());
      fb.fillRect(xpos - 1, y - 1, xpos + mm.length * W52 + 1, y + H52 + 2, BG);
      fb.string(LARGE, mm, xpos, y, COLOR);
      fb.string(SMALL, "M", xpos + 2 * W52 + 5, y + H52 - H12, COLOR);
      this.last.m = t.getMinutes();
    }
    if (t.getSeconds() !== this.last.s || this.needsUpdate) {
      const y = base + 2 * (H52 + 2);
      const ss = two(t.getSeconds());
      fb.fillRect(xpos - 1, y - 1, xpos + ss.length * W52 + 1, y + H52 + 2, BG);
      fb.string(LARGE, ss, xpos, y, COLOR);
      fb.string(SMALL, "S", xpos + 2 * W52 + 5, y + H52 - H12, COLOR);
      this.last.s = t.getSeconds();
    }
    this.needsUpdate = false;

    // Tilt dial: raw ±4 g accelerometer counts (8192 / g) through convert_to_degrees.
    this.smooth.x += (this.tilt.x - this.smooth.x) * 0.25;
    this.smooth.y += (this.tilt.y - this.smooth.y) * 0.25;
    const deg = (g: number) => g * 90 + 0.5; // (counts · 90 / 8192) + 0.5, counts = g · 8192
    const angX = trunc(deg(this.smooth.x) / 1.5) + 180;
    const angY = trunc(deg(this.smooth.y) * 1.25) + 180;
    fb.fillCircle(cx2, cy2, 45, BG);
    fb.fillRectAngle(cx2, cy2, 60, 60, 0, 0, angX + 45, COLOR);
    fb.fillRectAngle(cx2, cy2, 60, 60, 0, 0, angX, COLOR);
    fb.fillCircle(cx2, cy2, 34, BG);
    fb.circle(cx2, cy2, 34, COLOR);
    fb.rectAngle(cx2, cy2, 48, 48, angX, COLOR);
    fb.rectAngle(cx2, cy2, 48, 48, angX + 45, COLOR);
    fb.polygon(cx2, cy2, 8, 42, angX, COLOR);
    fb.triangleAngle(42, 0, 0, -15, 0, 15, cx2, cy2, angX, WHITE);
    fb.triangleAngle(-42, 0, 0, -15, 0, 15, cx2, cy2, angX, WHITE);
    fb.fillCircle(cx, cy, 37, BG);
    fb.rectAngle(cx, cy, 45, 45, angY, COLOR);
    fb.rectAngle(cx, cy, 45, 45, angY + 45, COLOR);
    fb.polygon(cx, cy, 8, 32, angY, COLOR);
    fb.triangleAngle(32, 0, 0, -10, 0, 10, cx, cy, angY + 90, WHITE);
    fb.triangleAngle(-32, 0, 0, -10, 0, 10, cx, cy, angY + 90, WHITE);

    // Battery, twice a second (the ADC task sleeps 500 ms between reads).
    if (now - this.lastBattery >= 500) {
      this.lastBattery = now;
      const pct = Math.min(100, Math.max(1, this.battery ?? 100));
      const xb = 24;
      const yb = 232;
      fb.fillRect(xb, yb - 3, xb + 4 * W12 + 14, yb + H12 + 10, BG);
      fb.string(SMALL, `${pct.toFixed(1)}%`, xb, yb - 3, COLOR);
      fb.fillRect(xb - 16, yb - 40, xb - 4, yb + H12, BG);
      fb.roundRect(xb - 4, yb + H12, xb - 16, yb - 40, 3, COLOR);
      fb.fillRect(xb - 14, yb + H12 - 2 - trunc((36 + H12) * (pct / 100)), xb - 6, yb + H12 - 2, COLOR);
    }
  }
}
