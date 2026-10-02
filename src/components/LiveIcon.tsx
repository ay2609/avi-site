"use client";

import { useEffect } from "react";

import { type LandAt, landLookup, paintGlobe } from "@/lib/icon/globe";
import { GRID, MARK } from "@/lib/icon/mark";
import { sfx } from "@/lib/sound/sfx";
import { getTheme, onTheme } from "@/lib/theme/light";

/**
 * The tab's icon, redrawn while the page is open:
 *
 *   globe  (the icon) The globe, turning — land from the same baked field
 *          the big one draws, the network's busiest hubs lit violet, paper
 *          in light mode (lib/icon/globe.ts).
 *   mark   (the alternative, `?icon=mark`; `?icon=globe` goes back, and the
 *          choice is remembered) "AY" in the watch's font (lib/icon/mark.ts),
 *          lit like its screen; with the sound on, the bottom rows become the
 *          switch's level meter.
 *
 * The static icons (src/app/icon.tsx, apple-icon.tsx) are the globe's first
 * frame and stand in until this runs, and for bookmarks and search results.
 */

type Mode = "mark" | "globe";
const KEY = "avi-site:icon";
const SIZE = 32;

const INK = { dark: "#0a0a0b", light: "#f1efea" };
const BONE = { dark: "#e6e4df", light: "#17171a" };
const METER = { dark: "rgba(230,228,223,0.55)", light: "rgba(23,23,26,0.55)" };

function chooseMode(): Mode {
  let mode: Mode = "globe";
  try {
    const asked = new URLSearchParams(window.location.search).get("icon");
    if (asked === "globe" || asked === "mark") window.localStorage.setItem(KEY, asked);
    const saved = window.localStorage.getItem(KEY);
    if (saved === "mark") mode = "mark";
  } catch {}
  return mode;
}

const ICON_LINKS = 'link[rel="icon"], link[rel="shortcut icon"]';

/**
 * Point every icon link at the current frame; hand back a way to put them
 * back. Next streams its metadata in after hydration (and again on a route
 * change), so links that arrive later are taken over as they land.
 */
function takeIcons(): { show: (url: string) => void; restore: () => void } {
  const saved = new Map<HTMLLinkElement, { href: string; type: string; sizes: string | null }>();
  let url = "";
  const point = (l: HTMLLinkElement) => {
    if (!saved.has(l)) saved.set(l, { href: l.href, type: l.type, sizes: l.getAttribute("sizes") });
    if (!url || l.href === url) return;
    l.type = "image/png";
    l.removeAttribute("sizes");
    l.href = url;
  };
  const all = () => document.querySelectorAll<HTMLLinkElement>(ICON_LINKS).forEach(point);
  let own: HTMLLinkElement | null = null;
  if (!document.querySelector(ICON_LINKS)) {
    own = document.createElement("link");
    own.rel = "icon";
    document.head.appendChild(own);
  }
  const watch = new MutationObserver(all);
  watch.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  return {
    show(next) {
      if (next === url) return;
      url = next;
      all();
    },
    restore() {
      watch.disconnect();
      for (const [l, { href, type, sizes }] of saved) {
        l.href = href;
        l.type = type;
        if (sizes) l.setAttribute("sizes", sizes);
      }
      own?.remove();
    },
  };
}

// --- mark ----------------------------------------------------------------------

/** Meter history, one column per grid pixel, 0…2 rows tall (rows 14–15, under the letters). */
const meter: number[] = new Array(GRID).fill(0);

function drawMark(ctx: CanvasRenderingContext2D, withMeter: boolean): void {
  const theme = getTheme();
  const px = SIZE / GRID;
  ctx.fillStyle = INK[theme];
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = BONE[theme];
  for (const [x, y] of MARK) ctx.fillRect(x * px, y * px, px, px);
  if (!withMeter) return;
  ctx.fillStyle = METER[theme];
  meter.forEach((h, x) => {
    if (h > 0) ctx.fillRect(x * px, (GRID - h) * px, px, h * px);
  });
}

function readLevel(buf: Float32Array<ArrayBuffer>): number {
  const a = sfx.analyser;
  if (!a) return 0;
  a.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  return rms < 0.003 ? 0 : Math.min(2, Math.ceil(Math.sqrt(rms) * 2.2 * 2));
}

// --- globe ---------------------------------------------------------------------

/** Land, read from the globe's baked field (the page has it cached already). */
async function loadLand(): Promise<LandAt | null> {
  const img = new Image();
  img.src = "/globe-field-2048.webp";
  try {
    await img.decode();
  } catch {
    return null;
  }
  const w = 360;
  const h = 180;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  const rgba = g.getImageData(0, 0, w, h).data;
  // The field packs the land mask into green (scripts/bake-globe-field.py).
  return landLookup(w, h, (i) => rgba[i * 4 + 1] > 127);
}

// --- The component -------------------------------------------------------------

export default function LiveIcon() {
  useEffect(() => {
    const mode = chooseMode();
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const icons = takeIcons();
    const show = () => icons.show(canvas.toDataURL("image/png"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    const offs: (() => void)[] = [];

    if (mode === "mark") {
      const buf = new Float32Array(2048);
      const paint = () => {
        drawMark(ctx, sfx.enabled);
        show();
      };
      // With the sound on, the meter scrolls; with it off, the mark only
      // changes when the theme does.
      const sync = () => {
        clearInterval(timer);
        meter.fill(0);
        paint();
        if (!sfx.enabled) return;
        timer = setInterval(() => {
          meter.shift();
          meter.push(readLevel(buf));
          paint();
        }, 90);
      };
      sync();
      offs.push(onTheme(paint), sfx.subscribe(sync));
    } else {
      const img = ctx.createImageData(SIZE, SIZE);
      const start = performance.now();
      void loadLand().then((land) => {
        if (!land || disposed) return;
        const frame = () => {
          paintGlobe(img.data, SIZE, still ? 0 : (performance.now() - start) / 1000, getTheme(), land);
          ctx.putImageData(img, 0, 0);
          show();
        };
        frame();
        if (!still) timer = setInterval(frame, 80);
        offs.push(onTheme(frame));
      });
    }

    return () => {
      disposed = true;
      clearInterval(timer);
      offs.forEach((off) => off());
      icons.restore();
    };
  }, []);

  return null;
}
