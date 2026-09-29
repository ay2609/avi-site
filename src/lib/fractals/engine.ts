/**
 * The fractals walkthrough's scenes: what the shader draws in each chapter,
 * what the 2D overlay draws over it (the dot grid, the attractor, the
 * Lissajous table), what the figures read, and how one chapter hands over to
 * the next — the picture re-resolves from a coarse grid, the article's motif.
 *
 * Input is the walkthrough's usual: one scroll gesture is one chapter
 * (WheelGesture). In Julia and Fraotic a drag moves the one thing that chapter
 * is about — c, or the slice.
 */
import { CHAPTERS, LAST_CHAPTER, type Preset } from "./chapters";
import { FractalRenderer, paletteColor, type FractalParams } from "./renderer";
import { WheelGesture } from "@/lib/stage/wheel";
import {
  FLOWS,
  LISSAJOUS,
  dotGrid,
  formatComplex,
  orbit,
  traceFlow,
  type Flow,
  type Vec2,
} from "./systems";

export interface Readout {
  rows: { key: string; value: string; lit?: boolean }[];
  note?: string;
}

export interface EngineCallbacks {
  /** 0…LAST_CHAPTER, eased — the index marker follows it. */
  onProgress: (progress: number) => void;
  onChapter: (chapter: number) => void;
  /** Live figures for the chapter on stage (null = use the chapter's fixed ones). */
  onReadout: (readout: Readout | null) => void;
  onPreset: (index: number) => void;
}

export const TUNE = {
  /** Chapter to chapter: the index marker's travel, s. */
  travel: 0.55,
  /** The re-resolve on a change of chapter: cells across, one step each `resolveStep` s. */
  resolveCells: [16, 48, 144, 0],
  resolveStep: 0.08,
  /** Landing: from the ASCII's resolution up. */
  landCells: [48, 144, 0],
  landStep: 0.12,
  /** Cells shown while the article flies (matches the front page's ASCII). */
  flightCells: 48,
  /** Drag previews render at this fraction of the pixels. */
  dragScale: 0.45,
  /** The cover's slow zoom into seahorse valley and back, s per round trip. */
  coverPeriod: 48,
  coverTarget: [-0.7453, 0.1127] as Vec2,
  coverDeepest: 0.05,
  /** ITERATE: seconds per step of z → z² + c, and how many steps a round runs. */
  iterateStep: 0.75,
  iterateSteps: 12,
  /** RESOLVE: seconds per setting, and on the last one before it starts over. */
  resolveHold: 1.9,
  resolveLast: 4.5,
  maxDpr: 1.5,
} as const;

const INK = "#0a0a0b";
const BONE = "#e6e4df";
const DIM = "#8a8987";
const RULE = "#2a2a2c";

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad = (n: number) => String(n).padStart(2, "0");
const sub = (n: number) => String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);

type Mode = "page" | "flying" | "stage";

interface Resolve {
  cells: readonly number[];
  step: number;
  start: number;
}

export class FractalEngine {
  private renderer: FractalRenderer | null = null;
  private ctx: CanvasRenderingContext2D | null;
  private mode: Mode = "page";
  private chapter = 0;
  private progress = 0;
  private travelFrom = 0;
  private travelStart = 0;
  private sceneStart = 0;
  private presets: Record<string, number> = { julia: 0, fraotic: 0 };
  private juliaC: Vec2 | null = null;
  private angle = 0;
  private dragging = false;
  private resolve: Resolve | null = null;
  private dirtyGL = true;
  private raf = 0;
  private gesture = new WheelGesture();
  private readoutKey = "";
  private orbits = new Map<Flow["id"], Float64Array>();
  private reduce: boolean;
  private disposed = false;

  constructor(
    private glCanvas: HTMLCanvasElement,
    private overlay: HTMLCanvasElement,
    private cb: EngineCallbacks
  ) {
    this.ctx = overlay.getContext("2d");
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.addEventListener("resize", this.onResize);
  }

  // --- Lifecycle ----------------------------------------------------------------

  private ensureRenderer(): FractalRenderer | null {
    if (this.renderer) return this.renderer;
    try {
      this.renderer = new FractalRenderer(this.glCanvas, { maxDpr: TUNE.maxDpr });
    } catch {
      this.renderer = null; // no WebGL2: the overlays still work, the picture stays ink
    }
    return this.renderer;
  }

  /** The article's place: on the page, flying, or landed on the stage. */
  setOpen(open: boolean, landed: boolean): void {
    const next: Mode = !open ? "page" : landed ? "stage" : "flying";
    if (next === this.mode) return;
    const was = this.mode;
    this.mode = next;
    if (next === "page") {
      this.gesture.reset();
      this.dragging = false;
      this.setChapter(0, true);
      this.drawCoverStill();
      this.stop();
      return;
    }
    this.ensureRenderer();
    if (next === "flying") {
      this.setChapter(0, true);
      this.drawCoverStill();
      return;
    }
    // Landed: resolve up from the ASCII's grid, then the walkthrough runs.
    if (was !== "stage") {
      this.sceneStart = performance.now();
      this.resolve = this.reduce ? null : { cells: TUNE.landCells, step: TUNE.landStep, start: performance.now() };
      this.dirtyGL = true;
      this.start();
    }
  }

  /** The cover as it looks the moment the page's ASCII hands over: its grid, its view. */
  private drawCoverStill(): void {
    const r = this.renderer;
    if (!r) return;
    r.render({ ...this.coverParams(0), cells: TUNE.flightCells, iters: 30, max: 30 });
    this.ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  private start(): void {
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    window.removeEventListener("resize", this.onResize);
    this.renderer?.dispose();
    this.renderer = null;
  }

  private onResize = () => {
    this.dirtyGL = true;
    if (this.mode === "stage") this.start();
  };

  // --- Chapters -------------------------------------------------------------------

  wheel(dy: number): void {
    if (this.mode !== "stage") return;
    const dir = this.gesture.feed(dy);
    if (dir) this.step(dir);
  }

  step(dir: number): void {
    this.go(this.chapter + dir);
  }

  go(k: number): void {
    if (this.mode !== "stage") return;
    const next = clamp(Math.round(k), 0, LAST_CHAPTER);
    if (next === this.chapter) return;
    this.setChapter(next, false);
    this.start();
  }

  private setChapter(k: number, instant: boolean): void {
    const changed = k !== this.chapter;
    this.travelFrom = instant ? k : this.progress;
    this.travelStart = performance.now();
    this.chapter = k;
    if (instant) {
      this.progress = k;
      this.cb.onProgress(k);
    }
    this.sceneStart = performance.now();
    this.juliaC = null;
    this.angle = 0;
    if (changed || instant) {
      this.cb.onChapter(k);
      this.presets = instant ? { julia: 0, fraotic: 0 } : this.presets;
      this.cb.onPreset(this.presetIndex());
    }
    this.resolve =
      instant || this.reduce ? null : { cells: TUNE.resolveCells, step: TUNE.resolveStep, start: performance.now() };
    this.dirtyGL = true;
    // Now, not a frame later: React renders the new chapter and its figures together.
    this.readoutKey = "";
    this.emitReadout(0);
  }

  private get id() {
    return CHAPTERS[this.chapter].id;
  }

  private presetIndex(): number {
    return this.presets[this.id] ?? 0;
  }

  private preset(): Preset | null {
    const list = CHAPTERS[this.chapter].presets;
    return list ? list[this.presetIndex()] : null;
  }

  setPreset(i: number): void {
    const list = CHAPTERS[this.chapter].presets;
    if (!list || this.mode !== "stage") return;
    const next = ((i % list.length) + list.length) % list.length;
    if (next === this.presetIndex()) return;
    this.presets[this.id] = next;
    this.juliaC = null;
    this.angle = 0;
    this.resolve = this.reduce ? null : { cells: TUNE.resolveCells, step: TUNE.resolveStep, start: performance.now() };
    this.dirtyGL = true;
    this.readoutKey = "";
    this.cb.onPreset(next);
    this.emitReadout((performance.now() - this.sceneStart) / 1000);
    this.start();
  }

  // --- Dragging (Julia's c, Fraotic's slice) -----------------------------------------

  /** Does the chapter on stage take a drag? */
  get draggable(): boolean {
    return this.mode === "stage" && (this.id === "julia" || this.id === "fraotic");
  }

  dragStart(): void {
    if (!this.draggable) return;
    this.dragging = true;
  }

  /** A drag of (dx, dy) CSS px. */
  drag(dx: number, dy: number): void {
    if (!this.dragging) return;
    const w = this.glCanvas.clientWidth || 1;
    const p = this.preset();
    if (!p) return;
    if (this.id === "julia") {
      const c = this.juliaC ?? [...(p.params.c ?? [0, 0])];
      // A tenth of the view per box width: c is a fine control.
      const k = ((p.params.half ?? 1.5) * 2 * 0.1) / w;
      this.juliaC = [c[0] + dx * k, c[1] - dy * k];
    } else {
      this.angle += (dx / w) * Math.PI;
    }
    this.dirtyGL = true;
    this.start();
  }

  dragEnd(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.dirtyGL = true; // once more at full resolution
    this.start();
  }

  // --- Scenes -------------------------------------------------------------------

  private coverParams(t: number): FractalParams {
    const s = this.reduce ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / TUNE.coverPeriod);
    const half = 1.5 * Math.pow(TUNE.coverDeepest / 1.5, s);
    const k = half / 1.5;
    const [px, py] = TUNE.coverTarget;
    // Zoom toward the target where it sits on screen: centre = P + (C₀ − P)·k.
    const center: Vec2 = [px + (-0.75 - px) * k, py + (0 - py) * k];
    const iters = Math.round(300 + 300 * s);
    return { mode: "escape", center, half, iters, max: iters, gamma: 3.2, palette: "site" };
  }

  private resolveStep(): number {
    const st = TUNE.resolveHold;
    const total = st * 4 + TUNE.resolveLast;
    const t = ((performance.now() - this.sceneStart) / 1000) % total;
    return this.reduce ? 4 : Math.min(4, Math.floor(t / st));
  }

  private static readonly RESOLVE_STEPS = [
    { cells: 9, center: [0, 0] as Vec2, iters: 10, lit: "" },
    { cells: 27, center: [0, 0] as Vec2, iters: 10, lit: "Resolution" },
    { cells: 0, center: [0, 0] as Vec2, iters: 10, lit: "Resolution" },
    { cells: 0, center: [-0.75, 0] as Vec2, iters: 10, lit: "Centre" },
    { cells: 0, center: [-0.75, 0] as Vec2, iters: 1000, lit: "Iterations" },
  ];

  private sceneParams(t: number): FractalParams | null {
    switch (this.id) {
      case "fractals":
        return this.coverParams(t);
      case "resolve": {
        const s = FractalEngine.RESOLVE_STEPS[this.resolveStep()];
        return {
          mode: "escape",
          center: s.center,
          half: 1.5,
          iters: s.iters,
          max: s.iters,
          gamma: 3.2,
          palette: "site",
          cells: s.cells,
        };
      }
      case "julia": {
        const p = this.preset()!;
        return { ...p.params, c: this.juliaC ?? p.params.c };
      }
      case "fraotic": {
        const p = this.preset()!;
        const flow = FLOWS[p.params.mode === "lorenz" ? "lorenz" : "thomas"];
        return { ...p.params, target: flow.target, dt: flow.dt, bounds: flow.bounds, angle: this.angle };
      }
      default:
        return null;
    }
  }

  /** Does this chapter's picture change by itself every frame? */
  private get animatedGL(): boolean {
    return this.id === "fractals" && !this.reduce;
  }

  // --- The frame -----------------------------------------------------------------

  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.mode !== "stage") return;
    const t = (now - this.sceneStart) / 1000;

    // Index marker
    const tt = clamp((now - this.travelStart) / (TUNE.travel * 1000), 0, 1);
    const p = this.travelFrom + (this.chapter - this.travelFrom) * easeInOut(tt);
    if (p !== this.progress) {
      this.progress = p;
      this.cb.onProgress(p);
    }

    // Resolve
    let cells: number | undefined;
    if (this.resolve) {
      const i = Math.floor((now - this.resolve.start) / (this.resolve.step * 1000));
      if (i >= this.resolve.cells.length) this.resolve = null;
      else cells = this.resolve.cells[i] || undefined;
      this.dirtyGL = true;
    }

    // Picture
    const r = this.renderer;
    const params = this.sceneParams(t);
    if (this.id === "resolve") {
      const step = this.resolveStep();
      if (step !== this.lastResolveStep) {
        this.lastResolveStep = step;
        this.dirtyGL = true;
      }
    }
    if (r && (this.dirtyGL || this.animatedGL)) {
      if (!params) r.clear();
      else if (cells) r.render({ ...params, cells: params.cells ? Math.min(params.cells, cells) : cells });
      else r.render(params, this.dragging ? TUNE.dragScale : 1);
      this.dirtyGL = false;
    }

    // Overlay and figures
    this.drawOverlay(t);
    this.emitReadout(t);

    const busy =
      this.animatedGL ||
      !!this.resolve ||
      tt < 1 ||
      this.dragging ||
      this.id === "iterate" ||
      this.id === "resolve" ||
      this.id === "lissajous";
    if (busy) this.start();
  };

  private lastResolveStep = -1;

  // --- Overlay drawing ------------------------------------------------------------

  private fitOverlay(): [number, number, number] {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.overlay.clientWidth * dpr);
    const h = Math.round(this.overlay.clientHeight * dpr);
    if (this.overlay.width !== w || this.overlay.height !== h) {
      this.overlay.width = w;
      this.overlay.height = h;
    }
    return [w, h, dpr];
  }

  private drawOverlay(t: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const [w, h, dpr] = this.fitOverlay();
    ctx.clearRect(0, 0, w, h);
    if (this.id === "iterate") this.drawIterate(ctx, w, h, dpr, t);
    else if (this.id === "fraotic") this.drawAttractor(ctx, w, h, dpr);
    else if (this.id === "lissajous") this.drawLissajous(ctx, w, h, dpr, t);
  }

  // ITERATE — the video's dot grid: 81 points of c, each one hopping to z² + c.
  private grid = dotGrid(9, 1.5);
  private gridOrbits = this.grid.map((c) => orbit(c, TUNE.iterateSteps));
  private fateA = orbit([1.25, 1.25], TUNE.iterateSteps);
  private fateB = orbit([-1.15, 0.23], TUNE.iterateSteps);

  /** Where the round is: step index (0 = z₁ = c) and the fraction of the hop to the next. */
  private iterateClock(t: number): { n: number; f: number; round: number; phase: "hop" | "pixels" } {
    const steps = TUNE.iterateSteps;
    const hops = (steps - 1) * TUNE.iterateStep;
    const round = 0.8 + hops + 4.5;
    const tr = this.reduce ? round - 1 : t % round;
    if (tr < 0.8) return { n: 0, f: 0, round: tr, phase: "hop" };
    const hopT = tr - 0.8;
    if (hopT >= hops) return { n: steps - 1, f: 0, round: tr, phase: "pixels" };
    const n = Math.floor(hopT / TUNE.iterateStep);
    const f = clamp((hopT - n * TUNE.iterateStep) / (TUNE.iterateStep * 0.6), 0, 1);
    return { n, f: easeInOut(f), round: tr, phase: "hop" };
  }

  private drawIterate(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number): void {
    const half = 2.25; // the plane shown: |z| = 2 fits with room
    const s = Math.min(w, h) / (2 * half);
    const X = (x: number) => w / 2 + x * s;
    const Y = (y: number) => h / 2 - y * s;
    const clock = this.iterateClock(t);
    const fadeIn = clamp(clock.round / 0.5, 0, 1);

    // |z| = 2
    ctx.save();
    ctx.globalAlpha = 0.6 * fadeIn;
    ctx.strokeStyle = DIM;
    ctx.lineWidth = dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 2 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const cell = 0.375 * s; // grid spacing: 3 / 8
    const dot = Math.max(3 * dpr, Math.round(Math.min(w, h) * 0.0065));
    this.grid.forEach((c, i) => {
      const zs = this.gridOrbits[i];
      const esc = zs.findIndex((z) => !(Math.hypot(z[0], z[1]) <= 2));
      const escaped = esc !== -1 && esc <= clock.n;

      if (clock.phase === "pixels") {
        // The survivors are the set; the rest are coloured by the step they left on.
        const a = clamp((clock.round - (0.8 + (TUNE.iterateSteps - 1) * TUNE.iterateStep)) / 0.6, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = esc === -1 ? INK : paletteColor("site", Math.pow((esc + 1) / TUNE.iterateSteps, 1 / 3.2));
        ctx.fillRect(X(c[0]) - cell / 2, Y(c[1]) - cell / 2, cell + 0.5, cell + 0.5);
        if (esc === -1) {
          ctx.strokeStyle = RULE;
          ctx.lineWidth = dpr;
          ctx.strokeRect(X(c[0]) - cell / 2, Y(c[1]) - cell / 2, cell, cell);
        }
        return;
      }

      // The c marker stays where the dot began; it goes when its dot escapes.
      ctx.globalAlpha = fadeIn * (escaped ? 0.15 : 0.55);
      ctx.fillStyle = DIM;
      ctx.fillRect(X(c[0]) - dot / 2, Y(c[1]) - dot / 2, dot, dot);

      // The dot: hopping from zₙ to zₙ₊₁.
      if (esc !== -1 && esc < clock.n) return;
      const a = zs[clock.n];
      const b = zs[Math.min(clock.n + 1, zs.length - 1)];
      const leaving = esc === clock.n + 1;
      const f = clock.f;
      const lerp = (u: number, v: number) => (Number.isFinite(v) ? u + (v - u) * f : u);
      const x = lerp(a[0], b[0]);
      const y = lerp(a[1], b[1]);
      ctx.globalAlpha = fadeIn * (esc === clock.n ? 0 : leaving ? 1 - f : 1);
      ctx.fillStyle = BONE;
      ctx.fillRect(X(x) - dot / 2, Y(y) - dot / 2, dot, dot);
    });
    ctx.globalAlpha = 1;
  }

  // FRAOTIC — the attractor, drawn faintly over its own basin, as lorenz.py does.
  private drawAttractor(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const p = this.preset();
    if (!p) return;
    const flow = FLOWS[p.params.mode === "lorenz" ? "lorenz" : "thomas"];
    let pts = this.orbits.get(flow.id);
    if (!pts) {
      // lorenz.py draws the first 20k points, TCSA.py all of them; 40k is plenty on screen.
      pts = traceFlow(flow, flow.id === "lorenz" ? 20000 : 40000);
      this.orbits.set(flow.id, pts);
    }
    const [cx, , cz] = flow.target.center;
    const B = flow.bounds;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const aspect = w / h;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.6 * dpr;
    ctx.beginPath();
    for (let i = 0; i < pts.length / 3; i++) {
      // Onto the slice: across = (x − cx)·cosθ + y·sinθ, up = z − cz.
      const u = (pts[i * 3] - cx) * cos + pts[i * 3 + 1] * sin;
      const v = pts[i * 3 + 2] - cz;
      const x = w / 2 + (u / (B * aspect)) * (w / 2);
      const y = h / 2 - (v / B) * (h / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // LISSAJOUS — MovingCircle6.py: one circle per column and per row, spaced 3, radius 1.15.
  private drawLissajous(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number): void {
    const { columns, rows, period } = LISSAJOUS;
    const R = 1.15;
    const span = { x0: -R * 1.5, x1: columns.length * 3 + R * 1.5, y0: -(rows.length - 1) * 3 - R * 1.5, y1: 3 + R * 1.5 };
    // Leave the headline's band above and the caption's below.
    const area = { top: h * 0.24, bottom: h * 0.74, left: w * 0.05, right: w * 0.95 };
    const s = Math.min((area.right - area.left) / (span.x1 - span.x0), (area.bottom - area.top) / (span.y1 - span.y0));
    const ox = (area.left + area.right) / 2 - ((span.x0 + span.x1) / 2) * s;
    const oy = (area.top + area.bottom) / 2 + ((span.y0 + span.y1) / 2) * s;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy - y * s;
    const time = this.reduce ? period : t;
    const phi = (r: number, tt: number) => (2 * Math.PI * r * tt) / period;
    const colX = (j: number, tt: number) => (j + 1) * 3 + R * Math.cos(phi(columns[j], tt));
    const rowY = (i: number, tt: number) => -i * 3 + R * Math.sin(phi(rows[i], tt));

    ctx.save();
    ctx.lineWidth = dpr;
    // Circles
    ctx.strokeStyle = DIM;
    ctx.globalAlpha = 0.5;
    columns.forEach((_, j) => {
      ctx.beginPath();
      ctx.arc(X((j + 1) * 3), Y(3), R * s, 0, Math.PI * 2);
      ctx.stroke();
    });
    rows.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc(X(0), Y(-i * 3), R * s, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Projection lines
    if (!this.reduce) {
      ctx.globalAlpha = 0.22;
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      columns.forEach((_, j) => {
        const x = X(colX(j, time));
        ctx.beginPath();
        ctx.moveTo(x, Y(3 + R * Math.sin(phi(columns[j], time))));
        ctx.lineTo(x, Y(span.y0));
        ctx.stroke();
      });
      rows.forEach((_, i) => {
        const y = Y(rowY(i, time));
        ctx.beginPath();
        ctx.moveTo(X(R * Math.cos(phi(rows[i], time))), y);
        ctx.lineTo(X(span.x1), y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    // Curves: the last ten seconds of each (his deque held 1000 ticks of 10 ms).
    ctx.strokeStyle = BONE;
    ctx.globalAlpha = 0.85;
    const from = Math.max(0, time - period);
    const samples = 360;
    rows.forEach((_, i) => {
      columns.forEach((_, j) => {
        ctx.beginPath();
        for (let k = 0; k <= samples; k++) {
          const tt = from + ((time - from) * k) / samples;
          const x = X(colX(j, tt));
          const y = Y(rowY(i, tt));
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    });
    // Points
    ctx.globalAlpha = 1;
    ctx.fillStyle = BONE;
    const d = Math.max(3, Math.round(2 * dpr));
    const dotAt = (x: number, y: number) => ctx.fillRect(X(x) - d / 2, Y(y) - d / 2, d, d);
    columns.forEach((r, j) => dotAt(colX(j, time), 3 + R * Math.sin(phi(r, time))));
    rows.forEach((r, i) => dotAt(R * Math.cos(phi(r, time)), rowY(i, time)));
    ctx.restore();
  }

  // --- Figures ---------------------------------------------------------------------

  private emitReadout(t: number): void {
    const r = this.readout(t);
    const key = JSON.stringify(r);
    if (key === this.readoutKey) return;
    this.readoutKey = key;
    this.cb.onReadout(r);
  }

  private readout(t: number): Readout | null {
    switch (this.id) {
      case "iterate": {
        const { n, phase } = this.iterateClock(t);
        const step = phase === "pixels" ? TUNE.iterateSteps : n + 1;
        const left = this.gridOrbits.filter((zs) => zs.slice(0, step).every((z) => Math.hypot(z[0], z[1]) <= 2)).length;
        return {
          rows: [
            { key: "STEP", value: `z${sub(step)} OF z${sub(TUNE.iterateSteps)}` },
            { key: "c = 1.25 + 1.25i", value: formatComplex(this.fateA[step - 1]) },
            { key: "c = −1.15 + 0.23i", value: formatComplex(this.fateB[step - 1]) },
            { key: "LEFT", value: `${pad(left)} / 81`, lit: phase === "pixels" },
          ],
        };
      }
      case "resolve": {
        const i = this.resolveStep();
        const s = FractalEngine.RESOLVE_STEPS[i];
        const px = Math.round(this.glCanvas.clientWidth * Math.min(window.devicePixelRatio || 1, TUNE.maxDpr));
        return {
          rows: [
            { key: "RESOLUTION", value: s.cells ? `${s.cells} × ${s.cells}` : `${px} × ${px}`, lit: s.lit === "Resolution" },
            { key: "CENTRE", value: s.center[0] ? "−0.75 + 0i" : "0 + 0i", lit: s.lit === "Centre" },
            { key: "ITERATIONS", value: String(s.iters), lit: s.lit === "Iterations" },
          ],
        };
      }
      case "julia": {
        const p = this.preset()!;
        const c = this.juliaC ?? p.params.c ?? [0, 0];
        const thorn = p.params.mode === "thorn";
        return {
          rows: [
            thorn
              ? { key: "cx, cy", value: `${c[0].toFixed(3)}, ${c[1].toFixed(3)}`, lit: !!this.juliaC }
              : { key: "c", value: formatComplex(c).replace(/(\d\.\d{3})\d/g, "$1"), lit: !!this.juliaC },
            { key: thorn ? "MAP" : "ITERATE", value: thorn ? "X / cos Y,  Y / sin X" : "z² + c" },
            { key: "ITERATIONS", value: String(p.params.iters) },
            { key: "COLOUR", value: p.params.pygame ? "RGB, BY HAND" : p.params.palette.toUpperCase() },
          ],
          note: p.note,
        };
      }
      case "fraotic": {
        const p = this.preset()!;
        const flow = FLOWS[p.params.mode === "lorenz" ? "lorenz" : "thomas"];
        const deg = ((((this.angle * 180) / Math.PI) % 360) + 360) % 360;
        return {
          rows: [
            { key: "SYSTEM", value: flow.id === "thomas" ? "THOMAS · b 0.208186" : "LORENZ · 10, 28, 2.667" },
            { key: "STEP", value: `EULER · dt ${flow.dt}` },
            { key: "SLICE", value: `${Math.round(deg)}° ABOUT z`, lit: this.angle !== 0 },
            { key: "TARGET", value: `r ${flow.target.radius.toFixed(2)} AT THE MEAN` },
          ],
          note: p.note,
        };
      }
      default:
        return null;
    }
  }
}
