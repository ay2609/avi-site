/**
 * The watch walkthrough's scene: the board as separate parts, posed per
 * chapter and blended by one `progress` value (0 = the front-page turntable,
 * 4 = the face).
 *
 * Drawn like SolidCanvas — ink faces that only occlude, bone feature edges,
 * orthographic, unlit — but every part has its own group and line material,
 * so a chapter can lift its parts off the board and dim the rest.
 *
 * Input: one scroll gesture is one chapter (src/lib/stage/wheel.ts). Every
 * change of chapter plays as one timed transition on the travel ease.
 */
import * as THREE from "three";

import { TickManager, type TickData } from "@/lib/render/tick-manager";
import { WheelGesture } from "@/lib/stage/wheel";
import { themeFader } from "@/lib/theme/light";

import { CHAPTERS, DISPLAY, LAST_CHAPTER, type FaceButton } from "./chapters";
import { FACE_H, FACE_W, SovereignFace } from "./face";
import { decodeWatchModel, type PartInfo, type WatchModel } from "./model";

export const LOOK = {
  /** Orthographic half-height at zoom 1 (as SolidCanvas). */
  frustum: 0.8,
  edgeAngle: 24,
  ink: 0x0a0a0b,
  bone: 0xfafafa,
  /** Light mode (see lib/theme): paper faces, ink edges — the page's own --ink and --bone there. */
  paper: 0xf1efea,
  inkLine: 0x17171a,
  /** Line opacity: the front page, a part in focus, out of focus, the board out of focus. */
  edge: 0.62,
  focus: 0.8,
  dim: 0.1,
  boardDim: 0.18,
  /** Turntable, rad/s (negative is clockwise from above). */
  spin: -1,
  /** Passives rise this fraction of a chapter's lift; ICs and connectors rise all of it. */
  minorLift: 0.55,
  /** One chapter's transition, s. */
  step: 1.1,
  /**
   * Its curve, as CSS cubic-bezier(x1, y1, x2, y2). Softer than the stage's
   * expo.inOut (≈ 0.87, 0, 0.13, 1): the ramps in and out are longer and visible
   * rather than a pause and a lunge. Lower x1 / raise x2 for gentler ends still.
   */
  stepEase: [0.76, 0, 0.24, 1],
  /** Each further chapter in a jump (the index, Home / End) adds this, s. */
  stepPerChapter: 0.18,
  /** Back to the turntable when the article closes — the close flight's length, s. */
  home: 0.64,
  /**
   * Labels, leaders and traces come on this far (in chapters) before the move ends —
   * 0.2 is about the last third of `step` on `stepEase` — rather than after it.
   */
  calloutsAt: 0.2,
  /** Where the display waits, above the board in model space, when not on stage. */
  displayParked: 1.9,
} as const;

export interface Anchor {
  x: number;
  y: number;
}

export interface FrameInfo {
  progress: number;
  /** The chapter nearest the progress. */
  chapter: number;
  /**
   * Close enough to a chapter for its labels: within `calloutsAt` of the chapter
   * it's heading to (or resting on). The labels track the parts through the rest
   * of the move.
   */
  settled: boolean;
  /** Projected anchors (px, within the host) of the nearest chapter's callouts and trace. */
  anchors: Map<string, Anchor>;
}

interface Pose {
  yaw: number | null; // null = the turntable
  pitch: number;
  roll: number;
  zoom: number;
  look: THREE.Vector3;
  shift: [number, number];
  lift: Float32Array;
  opacity: Float32Array;
  display: number;
}

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** CSS cubic-bezier(x1, y1, x2, y2) as an easing function of time 0…1. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      const slope = dx(t);
      if (Math.abs(err) < 1e-6 || Math.abs(slope) < 1e-6) break;
      t -= err / slope;
    }
    if (Math.abs(sx(t) - x) > 1e-5) {
      // Newton wandered off (flat ends): bisect instead.
      let lo = 0;
      let hi = 1;
      t = x;
      while (hi - lo > 1e-6) {
        if (sx(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sy(t);
  };
}
/** expo.out — for a change of course mid-flight, so the motion carries on rather than stalls. */
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const stepEase = cubicBezier(...LOOK.stepEase);
const wrapNear = (a: number, ref: number) => ref + (((((a - ref) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
const isMajor = (ref: string) => /^(U|J|SW)\d/.test(ref);

export class WatchEngine {
  private readonly host: HTMLElement;
  private readonly onFrame?: (f: FrameInfo) => void;
  private readonly reduce: boolean;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly spinner = new THREE.Group();
  private readonly tilter = new THREE.Group();
  private readonly roller = new THREE.Group();
  private readonly ticker = new TickManager();
  private readonly resizeObserver: ResizeObserver;
  private readonly controller = new AbortController();
  private readonly disposables: { dispose(): void }[] = [];
  /** Every face and edge material, recoloured as the theme fades. */
  private readonly faceMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly lineMaterials: THREE.LineBasicMaterial[] = [];
  private readonly theme = themeFader();

  private model: WatchModel | null = null;
  private parts: { info: PartInfo; group: THREE.Group; edges: THREE.LineBasicMaterial }[] = [];
  private poses: Pose[] = [];
  private display: THREE.Group | null = null;
  private displayEdges: THREE.LineBasicMaterial | null = null;
  private displayHome = new THREE.Vector3();
  private lcdAnchor = new THREE.Vector3();
  private readonly face = new SovereignFace();
  private faceTexture: THREE.DataTexture | null = null;
  private faceOn = false;

  private progress = 0;
  /** The chapter the progress is travelling to (or resting on). */
  private target = 0;
  private tween: { from: number; to: number; start: number; ms: number; ease: (t: number) => number } | null =
    null;
  private interactive = false;
  private gesture = new WheelGesture();
  private spin = 0;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(host: HTMLElement, src: string, onFrame?: (f: FrameInfo) => void) {
    this.host = host;
    this.onFrame = onFrame;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.camera.position.set(0, 0, 4);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0" });
    host.appendChild(this.renderer.domElement);

    this.spinner.add(this.tilter);
    this.tilter.add(this.roller);
    this.scene.add(this.spinner);

    this.resize();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    // Belt and braces: resize observations only arrive with a rendering update.
    window.addEventListener("resize", this.resize);

    fetch(src, { signal: this.controller.signal })
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        if (this.disposed) return;
        this.build(decodeWatchModel(buffer));
        this.ticker.startLoop(this.frame);
      })
      .catch(() => {
        /* aborted on unmount, or the asset is missing — leave the box empty */
      });

    if ("getBattery" in navigator) {
      (navigator as Navigator & { getBattery(): Promise<{ level: number }> })
        .getBattery()
        .then((b) => (this.face.battery = b.level * 100))
        .catch(() => {});
    }
  }

  // --- Input -----------------------------------------------------------------

  /** Accept input (the article is open and has landed). */
  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.gesture.reset();
  }

  /** A wheel or swipe delta, px. One gesture moves one chapter. */
  wheel(dy: number): void {
    if (!this.interactive) return;
    const dir = this.gesture.feed(dy);
    if (dir) this.step(dir);
  }

  step(dir: number): void {
    this.go(this.target + dir);
  }

  go(chapter: number): void {
    if (!this.interactive) return;
    this.travel(clamp(Math.round(chapter), 0, LAST_CHAPTER));
  }

  /** Back to the turntable (the article is closing), in the time of the flight. */
  home(): void {
    this.setInteractive(false);
    this.travel(0, LOOK.home);
  }

  private travel(to: number, seconds?: number): void {
    if (to === this.target && (this.tween || this.progress === to)) return;
    this.target = to;
    if (this.reduce) {
      this.progress = to;
      this.tween = null;
      return;
    }
    const distance = Math.abs(to - this.progress);
    const s = seconds ?? LOOK.step + LOOK.stepPerChapter * Math.max(0, distance - 1);
    const ease = this.tween ? expoOut : stepEase;
    this.tween = { from: this.progress, to, start: performance.now(), ms: s * 1000, ease };
  }

  /** Pointer over the box, −1…1 each way: the face's accelerometer. */
  setTilt(x: number, y: number): void {
    this.face.tilt.x = clamp(x, -1, 1);
    this.face.tilt.y = clamp(y, -1, 1);
  }

  press(button: FaceButton): void {
    this.face.press(button);
  }

  // --- Scene -----------------------------------------------------------------

  private build(model: WatchModel): void {
    this.model = model;
    const faces = new THREE.MeshBasicMaterial({
      color: LOOK.ink,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.disposables.push(faces);
    this.faceMaterials.push(faces);

    for (const info of model.parts) {
      const geometry = new THREE.BufferGeometry();
      const [v0, vn] = info.v;
      const [i0, iN] = info.i;
      geometry.setAttribute("position", new THREE.BufferAttribute(model.positions.slice(v0 * 3, (v0 + vn) * 3), 3));
      geometry.setIndex(new THREE.BufferAttribute(model.indices.slice(i0, i0 + iN), 1));
      const edges = new THREE.EdgesGeometry(geometry, LOOK.edgeAngle);
      const material = new THREE.LineBasicMaterial({ color: LOOK.bone, transparent: true, opacity: LOOK.edge });
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, faces), new THREE.LineSegments(edges, material));
      this.roller.add(group);
      this.parts.push({ info, group, edges: material });
      this.lineMaterials.push(material);
      this.disposables.push(geometry, edges, material);
    }

    this.buildDisplay(model);
    this.poses = CHAPTERS.map((chapter) => this.pose(chapter));
    this.paint(this.theme.step(0).t);
  }

  /** The Waveshare module: board, glass, and the active area carrying the face. */
  private buildDisplay(model: WatchModel): void {
    const s = model.frame.scale;
    const board = model.parts[0];
    const boardTop = board.center[2] + board.size[2] / 2;
    const group = new THREE.Group();
    const faces = new THREE.MeshBasicMaterial({
      color: LOOK.ink,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const lines = new THREE.LineBasicMaterial({ color: LOOK.bone, transparent: true, opacity: LOOK.focus });
    this.displayEdges = lines;
    this.faceMaterials.push(faces);
    this.lineMaterials.push(lines);

    const box = (w: number, h: number, d: number, z: number) => {
      const g = new THREE.BoxGeometry(w * s, h * s, d * s);
      const e = new THREE.EdgesGeometry(g);
      const mesh = new THREE.Mesh(g, faces);
      const edge = new THREE.LineSegments(e, lines);
      mesh.position.z = edge.position.z = z * s;
      group.add(mesh, edge);
      this.disposables.push(g, e);
    };
    const [mw, mh, md] = DISPLAY.module;
    const [gw, gh, gd] = DISPLAY.glass;
    box(mw, mh, md, md / 2);
    box(gw, gh, gd, md + gd / 2);

    // Active area: a rounded rectangle, UVs mapped so framebuffer row 0 is the top.
    const [aw, ah] = DISPLAY.active;
    const r = DISPLAY.activeRadius;
    const shape = new THREE.Shape();
    const x0 = (-aw / 2) * s;
    const y0 = (-ah / 2) * s;
    const x1 = (aw / 2) * s;
    const y1 = (ah / 2) * s;
    const rr = r * s;
    shape.moveTo(x0 + rr, y0);
    shape.lineTo(x1 - rr, y0);
    shape.quadraticCurveTo(x1, y0, x1, y0 + rr);
    shape.lineTo(x1, y1 - rr);
    shape.quadraticCurveTo(x1, y1, x1 - rr, y1);
    shape.lineTo(x0 + rr, y1);
    shape.quadraticCurveTo(x0, y1, x0, y1 - rr);
    shape.lineTo(x0, y0 + rr);
    shape.quadraticCurveTo(x0, y0, x0 + rr, y0);
    const screen = new THREE.ShapeGeometry(shape, 12);
    const pos = screen.getAttribute("position");
    const uv = screen.getAttribute("uv");
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), 1 - (pos.getY(i) - y0) / (y1 - y0));
    }
    const texture = new THREE.DataTexture(this.face.fb.bytes, FACE_W, FACE_H, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.faceTexture = texture;
    const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const screenMesh = new THREE.Mesh(screen, screenMaterial);
    screenMesh.position.z = (md + gd) * s + 0.0005;
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(12)), lines);
    outline.position.z = screenMesh.position.z + 0.0005;
    group.add(screenMesh, outline);
    this.disposables.push(screen, screenMaterial, texture, outline.geometry, faces, lines);

    this.displayHome.set(board.center[0], board.center[1], boardTop + DISPLAY.hover * s);
    this.lcdAnchor.set((-gw / 2) * s, (gh / 4) * s, (md + gd) * s);
    group.position.copy(this.displayHome);
    group.visible = false;
    this.roller.add(group);
    this.display = group;
  }

  private pose(chapter: (typeof CHAPTERS)[number]): Pose {
    const model = this.model!;
    const { sheets = [], refs = [] } = chapter.focus;
    const inFocus = (p: PartInfo) => sheets.includes(p.sheet) || refs.includes(p.ref);
    const lift = new Float32Array(model.parts.length);
    const opacity = new Float32Array(model.parts.length);
    const look = new THREE.Vector3();
    let n = 0;
    model.parts.forEach((p, i) => {
      const focused = i > 0 && inFocus(p);
      lift[i] = focused ? chapter.lift * (isMajor(p.ref) ? 1 : LOOK.minorLift) : 0;
      opacity[i] = !chapter.dim ? LOOK.edge : focused ? LOOK.focus : i === 0 ? LOOK.boardDim : LOOK.dim;
      if (focused) {
        look.add(new THREE.Vector3(p.center[0], p.center[1], p.center[2] + lift[i]));
        n++;
      }
    });
    if (chapter.view.look) look.set(...chapter.view.look);
    else if (chapter.display) look.copy(this.displayHome);
    else if (n) look.divideScalar(n);

    const { yaw, pitch, roll, zoom, shift = [0, 0] } = chapter.view;
    const [hx, hy] = model.halfExtent;
    return {
      yaw: yaw === "spin" ? null : yaw * DEG,
      pitch: pitch * DEG,
      roll: roll === "diagonal" ? Math.atan2(hx, hy) : roll * DEG,
      zoom,
      look,
      shift,
      lift,
      opacity,
      display: chapter.display ? 1 : 0,
    };
  }

  private resize = (): void => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    const aspect = w / h;
    this.camera.left = -LOOK.frustum * aspect;
    this.camera.right = LOOK.frustum * aspect;
    this.camera.top = LOOK.frustum;
    this.camera.bottom = -LOOK.frustum;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // --- Frame -----------------------------------------------------------------

  private readonly scratch = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  /** Dark to light by `t` (0–1). The face is a screen and stays as it is. */
  private paint(t: number): void {
    const face = new THREE.Color(LOOK.ink).lerp(new THREE.Color(LOOK.paper), t);
    const line = new THREE.Color(LOOK.bone).lerp(new THREE.Color(LOOK.inkLine), t);
    for (const m of this.faceMaterials) m.color.copy(face);
    for (const m of this.lineMaterials) m.color.copy(line);
  }

  private frame = (data: TickData): void => {
    const now = performance.now();
    const dt = Math.min(Math.max(data.timeDiff, 0), 100) / 1000;

    const theme = this.theme.step(dt);
    if (theme.moved) this.paint(theme.t);

    if (this.tween) {
      const t = clamp((now - this.tween.start) / this.tween.ms, 0, 1);
      this.progress = lerp(this.tween.from, this.tween.to, this.tween.ease(t));
      if (t >= 1) {
        this.progress = this.tween.to;
        this.tween = null;
      }
    }
    const p = this.progress;

    // The turntable slows to a stop as the walkthrough leaves chapter 0.
    const turning = 1 - smooth(clamp(p / 0.35, 0, 1));
    if (!this.reduce) this.spin += LOOK.spin * dt * turning;
    const first = this.poses[1]?.yaw ?? 0;
    if (p === 0) this.spin = wrapNear(this.spin, first);

    const a = Math.min(Math.floor(p), LAST_CHAPTER);
    const b = Math.min(a + 1, LAST_CHAPTER);
    const f = p - a; // the tween already eases
    const A = this.poses[a];
    const B = this.poses[b];

    this.spinner.rotation.y = lerp(A.yaw ?? this.spin, B.yaw ?? this.spin, f);
    this.tilter.rotation.x = lerp(A.pitch, B.pitch, f);
    this.roller.rotation.z = lerp(A.roll, B.roll, f);
    const zoom = lerp(A.zoom, B.zoom, f);
    if (this.camera.zoom !== zoom) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }

    this.parts.forEach(({ group, edges }, i) => {
      group.position.z = lerp(A.lift[i], B.lift[i], f);
      edges.opacity = lerp(A.opacity[i], B.opacity[i], f);
    });

    // The display comes down from above the frame into its place over the board.
    const d = lerp(A.display, B.display, f);
    if (this.display) {
      this.display.visible = d > 0.001;
      this.display.position.set(
        this.displayHome.x,
        this.displayHome.y + (1 - smooth(d)) * LOOK.displayParked,
        this.displayHome.z
      );
      if (d > 0.001 && !this.faceOn) this.face.reset(now);
      this.faceOn = d > 0.001;
      if (this.faceOn && this.face.step(now, !this.reduce) && this.faceTexture) this.faceTexture.needsUpdate = true;
    }

    // Aim: the chapter's look point, wherever the rotation has carried it.
    this.scene.updateMatrixWorld();
    this.lookAt.lerpVectors(A.look, B.look, f);
    this.roller.localToWorld(this.lookAt);
    const shiftX = lerp(A.shift[0], B.shift[0], f) * ((2 * LOOK.frustum * this.width) / this.height / zoom);
    const shiftY = lerp(A.shift[1], B.shift[1], f) * ((2 * LOOK.frustum) / zoom);
    this.camera.position.set(this.lookAt.x - shiftX, this.lookAt.y - shiftY, 4);
    this.camera.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);

    if (this.onFrame) {
      const chapter = clamp(Math.round(p), 0, LAST_CHAPTER);
      const settled = Math.abs(this.target - p) <= LOOK.calloutsAt;
      this.onFrame({ progress: p, chapter, settled, anchors: this.anchors(chapter) });
    }
  };

  /** Screen positions of the tops of the parts a chapter labels or traces. */
  private anchors(chapter: number): Map<string, Anchor> {
    const out = new Map<string, Anchor>();
    const c = CHAPTERS[chapter];
    const refs = new Set([...c.callouts.map((o) => o.ref), ...(c.trace ?? [])]);
    for (const ref of refs) {
      if (ref === "LCD") {
        if (!this.display?.visible) continue;
        this.scratch.copy(this.lcdAnchor);
        this.display.localToWorld(this.scratch);
      } else {
        const part = this.parts.find((q) => q.info.ref === ref);
        if (!part) continue;
        const { center, size } = part.info;
        this.scratch.set(center[0], center[1], center[2] + size[2] / 2);
        part.group.localToWorld(this.scratch);
      }
      this.scratch.project(this.camera);
      out.set(ref, { x: ((this.scratch.x + 1) / 2) * this.width, y: ((1 - this.scratch.y) / 2) * this.height });
    }
    return out;
  }

  dispose(): void {
    this.disposed = true;
    this.controller.abort();
    this.ticker.stopLoop();
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.resize);
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
