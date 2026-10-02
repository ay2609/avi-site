/**
 * The fractals walkthrough's scenes: what the shader draws in each chapter,
 * what the 2D overlay draws over it (the attractor or the map's orbit), and
 * how one chapter hands over to the next — the picture re-resolves from a
 * coarse grid, the article's motif.
 *
 * Input is the walkthrough's usual: one scroll gesture is one chapter
 * (WheelGesture). A drag moves the one thing a picture is about — a Julia's c,
 * or a basin's slice — where it has one (dragOf in chapters.ts).
 */
import { CHAPTERS, dragOf, LAST_CHAPTER, type Preset } from "./chapters";
import { COVER } from "./cover";
import { FractalRenderer, type FractalParams } from "./renderer";
import { WheelGesture } from "@/lib/stage/wheel";
import {
  CLIFFORDS,
  FLOWS,
  traceClifford,
  traceFlow,
  type Clifford,
  type Flow,
  type Vec2,
  type Vec3,
} from "./systems";

export interface EngineCallbacks {
  /** 0…LAST_CHAPTER, eased — the index marker follows it. */
  onProgress: (progress: number) => void;
  onChapter: (chapter: number) => void;
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
  /** Steps the front page's ASCII reaches at most — the still shown while the article flies. */
  flightIters: 30,
  maxDpr: 1.5,
} as const;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
  private presets: Record<string, number> = { julia: 0, fraotic: 0 };
  private juliaC: Vec2 | null = null;
  private angle = 0;
  private dragging = false;
  private resolve: Resolve | null = null;
  private dirtyGL = true;
  private raf = 0;
  private gesture = new WheelGesture();
  private orbits = new Map<string, Float64Array>();
  /** The Clifford orbit, plotted once per map and canvas size. */
  private scatter: { key: string; canvas: HTMLCanvasElement } | null = null;
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
      this.resolve = this.reduce ? null : { cells: TUNE.landCells, step: TUNE.landStep, start: performance.now() };
      this.dirtyGL = true;
      this.start();
    }
  }

  /**
   * The cover as it looks the moment the page's ASCII hands over: its grid, its
   * view, its steps — and its colours, which the ASCII already wears (same max).
   */
  private drawCoverStill(): void {
    const r = this.renderer;
    if (!r) return;
    r.render({ ...COVER, cells: TUNE.flightCells, iters: TUNE.flightIters });
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
    this.cb.onPreset(next);
    this.start();
  }

  // --- Dragging (Julia's c, Fraotic's slice) -----------------------------------------

  /** Does the picture on stage take a drag? */
  get draggable(): boolean {
    return this.mode === "stage" && dragOf(this.preset() ?? undefined) !== null;
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
    const kind = dragOf(p ?? undefined);
    if (!p || !kind) return;
    if (kind === "c") {
      const c = this.juliaC ?? [...(p.params.c ?? [0, 0])];
      // A tenth of the view per box width: c is a fine control.
      const k = ((p.params.half ?? 1.5) * 2 * 0.1) / w;
      this.juliaC = [c[0] + dx * k, c[1] - dy * k];
    } else {
      // Half a turn per box width, about the slice's up axis.
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

  private sceneParams(): FractalParams | null {
    switch (this.id) {
      case "fractals":
        return COVER; // still: it changes only when it re-resolves
      case "julia": {
        const p = this.preset()!;
        return this.juliaC ? { ...p.params, c: this.juliaC } : p.params;
      }
      case "fraotic":
        return this.basinParams(this.preset()!);
      default:
        return null;
    }
  }

  /** A Fraotic preset with its system filled in: the flow's field, step, slice and target, or the map's. */
  private basinParams(p: Preset): FractalParams {
    if (p.flow) {
      const f = FLOWS[p.flow];
      return {
        field: f.field,
        constants: f.constants,
        dt: f.dt,
        rk4: f.rk4,
        slice: f.slice,
        bounds: f.bounds,
        target: f.target,
        ...p.params,
        angle: (p.params.angle ?? 0) + this.angle,
      };
    }
    if (p.clifford) {
      const c = CLIFFORDS[p.clifford];
      return {
        center: c.view.center,
        half: c.view.half,
        clifford: { abcd: c.abcd, dt: c.dt, target: c.target, radius: c.radius, metric: c.metric },
        ...p.params,
      };
    }
    return p.params;
  }

  // --- The frame -----------------------------------------------------------------

  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.mode !== "stage") return;
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
    const params = this.sceneParams();
    if (r && this.dirtyGL) {
      if (!params) r.clear();
      else if (cells) r.render({ ...params, cells: params.cells ? Math.min(params.cells, cells) : cells });
      else r.render(params, this.dragging ? TUNE.dragScale : 1);
      this.dirtyGL = false;
    }

    // Overlay
    this.drawOverlay();

    const busy = !!this.resolve || tt < 1 || this.dragging;
    if (busy) this.start();
  };

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

  private drawOverlay(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const [w, h, dpr] = this.fitOverlay();
    ctx.clearRect(0, 0, w, h);
    if (this.id === "fraotic") {
      const p = this.preset();
      if (p?.flow) this.drawAttractor(ctx, w, h, dpr, FLOWS[p.flow], this.basinParams(p));
      else if (p?.clifford) this.drawScatter(ctx, w, h, dpr, CLIFFORDS[p.clifford]);
    }
  }

  // FRAOTIC — the attractor, drawn faintly over its own basin, as lorenz.py does.
  private drawAttractor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    flow: Flow,
    params: FractalParams
  ): void {
    let pts = this.orbits.get(flow.id);
    if (!pts) {
      // lorenz.py draws the first 20k points, TCSA.py all of them; tens of thousands is plenty on screen.
      pts = traceFlow(flow, flow.trace);
      this.orbits.set(flow.id, pts);
    }
    const { origin: O, u: U, v: V } = params.slice ?? flow.slice;
    const B = params.bounds ?? flow.bounds;
    // The slice's across axis, turned about its up axis as the shader turns it.
    const th = params.angle ?? 0;
    const VxU: Vec3 = [V[1] * U[2] - V[2] * U[1], V[2] * U[0] - V[0] * U[2], V[0] * U[1] - V[1] * U[0]];
    const A: Vec3 = [0, 1, 2].map((k) => U[k] * Math.cos(th) + VxU[k] * Math.sin(th)) as Vec3;
    const aspect = w / h;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.6 * dpr;
    ctx.beginPath();
    for (let i = 0; i < pts.length / 3; i++) {
      // Onto the slice: across = (p − o)·a, up = (p − o)·v.
      const dx = pts[i * 3] - O[0];
      const dy = pts[i * 3 + 1] - O[1];
      const dz = pts[i * 3 + 2] - O[2];
      const u = dx * A[0] + dy * A[1] + dz * A[2];
      const v = dx * V[0] + dy * V[1] + dz * V[2];
      const x = w / 2 + (u / (B * aspect)) * (w / 2);
      const y = h / 2 - (v / B) * (h / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // FRAOTIC on the Clifford map — the orbit's points over its basin, white at 0.6 a
  // hit, as his overlay plots them (a map jumps, so points, not a line).
  private drawScatter(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, c: Clifford): void {
    const key = `${c.id}:${w}x${h}`;
    if (this.scatter?.key !== key) {
      let pts = this.orbits.get(`clifford:${c.id}`);
      if (!pts) {
        pts = traceClifford(c);
        this.orbits.set(`clifford:${c.id}`, pts);
      }
      const hits = new Uint16Array(w * h);
      const dot = Math.max(1, Math.round(dpr));
      const [cx, cy] = c.view.center;
      const half = c.view.half;
      const aspect = w / h;
      for (let i = 0; i < pts.length / 2; i++) {
        const px = Math.round(w / 2 + ((pts[i * 2] - cx) / (half * aspect)) * (w / 2));
        const py = Math.round(h / 2 - ((pts[i * 2 + 1] - cy) / half) * (h / 2));
        for (let a = 0; a < dot; a++)
          for (let b = 0; b < dot; b++) {
            const x = px + a;
            const y = py + b;
            if (x >= 0 && x < w && y >= 0 && y < h && hits[y * w + x] < 64) hits[y * w + x]++;
          }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d");
      if (!g) return;
      const img = g.createImageData(w, h);
      for (let i = 0; i < hits.length; i++) {
        if (!hits[i]) continue;
        img.data.set([255, 255, 255, Math.round(255 * (1 - Math.pow(0.4, hits[i])))], i * 4);
      }
      g.putImageData(img, 0, 0);
      this.scatter = { key, canvas };
    }
    ctx.drawImage(this.scatter.canvas, 0, 0);
  }
}
