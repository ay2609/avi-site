"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { LABEL } from "@/components/furniture";
import AsciiPanel from "@/lib/ascii/AsciiPanel";
import { CHAPTERS, dragOf, LAST_CHAPTER, presetRows } from "@/lib/fractals/chapters";
import { FractalEngine } from "@/lib/fractals/engine";
import { sfx } from "@/lib/sound/sfx";
import { gsap, prefersReducedMotion, SplitText, stageBox } from "@/lib/stage/motion";

/** Height of one row of the chapter index, px — the marker moves in these. */
const INDEX_ROW = 16;
/** Finger travel that counts as a swipe to the next chapter, px. */
const SWIPE = 40;
/** Movement before a touch decides whether it is a swipe or a drag, px. */
const DECIDE = 8;
/** Box width below which the furniture moves outside the box (as the watch). */
const COMPACT_BELOW = 560;
/**
 * Side band (stage edge to the box) at and above which the presets and the
 * index leave the picture for the bands either side of it, where they read in
 * the page's own contrast. Narrower, they sit over the picture on scrims.
 */
const COLUMNS_FROM = 240;
/** A preset label that is maths: as written, not in the furniture's capitals. */
const MATH = "normal-case tracking-[0.06em] text-[11px]";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fractals as an article. On the front page it is the Mandelbrot set in ASCII,
 * its iterations rising and falling, each character in the colour its cell has
 * in the cover; opened, the characters give way to that picture in pixels and a
 * walkthrough in four chapters (src/lib/fractals/chapters.ts) — each scroll or
 * swipe is one, each a live port of Avi's own code.
 */
export default function FractalArticle({ open, landed }: { open: boolean; landed: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FractalEngine | null>(null);

  const [chapter, setChapter] = useState(0);
  const [preset, setPreset] = useState(0);
  const compactRef = useRef(false);
  /** The presets and index in the side bands rather than over the picture. */
  const [columns, setColumns] = useState(false);

  const chapterRef = useRef(0);
  const presetRef = useRef(0);
  useLayoutEffect(() => {
    chapterRef.current = chapter;
    presetRef.current = preset;
  }, [chapter, preset]);

  const stateRef = useRef({ open, landed });
  useLayoutEffect(() => {
    stateRef.current = { open, landed };
  }, [open, landed]);

  // --- Engine ----------------------------------------------------------------------

  useEffect(() => {
    const gl = glRef.current;
    const draw = drawRef.current;
    if (!gl || !draw) return;
    const engine = new FractalEngine(gl, draw, {
      onProgress: (p) => {
        if (markerRef.current) markerRef.current.style.transform = `translateY(${p * INDEX_ROW}px)`;
      },
      onChapter: (k) => {
        setChapter(k);
        if (stateRef.current.landed) sfx.detent();
      },
      onPreset: setPreset,
    });
    engine.setOpen(stateRef.current.open, stateRef.current.landed);
    engineRef.current = engine;
    // Dev only: lets the console drive and inspect it (see codebase-state.md, "Viewing the site").
    if (process.env.NODE_ENV !== "production") (window as unknown as { __fractals?: unknown }).__fractals = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setOpen(open, landed);
  }, [open, landed]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const check = () => {
      const w = el.clientWidth;
      compactRef.current = w > 0 && w < COMPACT_BELOW;
      // From the stage box, not this one: on the page the overlay is the slot's size.
      const b = stageBox(1);
      el.style.setProperty("--band", `${b.left}px`);
      setColumns(b.left >= COLUMNS_FROM && b.width >= COMPACT_BELOW);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  // --- Input while on stage -----------------------------------------------------------

  useEffect(() => {
    if (!open || !landed) return;
    const engine = () => engineRef.current;
    const host = hostRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
      engine()?.wheel((Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * scale);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // Space over the docked globe pauses it instead
      const k = e.key;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(k)) engine()?.step(1);
      else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(k)) engine()?.step(-1);
      else if (k === "Home") engine()?.go(0);
      else if (k === "End") engine()?.go(LAST_CHAPTER);
      else if (/^[0-9]$/.test(k)) engine()?.go(Number(k));
      else return;
      e.preventDefault();
    };

    // Touch: a vertical swipe is a scroll (one chapter); a horizontal one drags, where a
    // chapter takes a drag. A tap on a phone steps through that chapter's presets.
    let touch: { x: number; y: number; axis: "x" | "y" | null; swiped: boolean } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) touch = { x: t.clientX, y: t.clientY, axis: null, swiped: false };
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!touch || !t) return;
      e.preventDefault();
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (!touch.axis && Math.hypot(dx, dy) > DECIDE) {
        touch.axis = Math.abs(dx) > Math.abs(dy) && engine()?.draggable ? "x" : "y";
        if (touch.axis === "x") engine()?.dragStart();
      }
      if (touch.axis === "y" && !touch.swiped && Math.abs(dy) > SWIPE) {
        engine()?.step(Math.sign(-dy));
        touch.swiped = true;
      } else if (touch.axis === "x") {
        engine()?.drag(dx, 0);
        touch.x = t.clientX;
      }
    };
    const onTouchEnd = () => {
      if (touch?.axis === "x") engine()?.dragEnd();
      touch = null;
    };

    // Mouse and pen: drag on the picture.
    let last: { x: number; y: number; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      last = { x: e.clientX, y: e.clientY, moved: false };
      if (engine()?.draggable) {
        engine()?.dragStart();
        host?.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (dx || dy) last.moved = true;
      engine()?.drag(dx, dy);
      last.x = e.clientX;
      last.y = e.clientY;
    };
    const onUp = () => {
      last = null;
      engine()?.dragEnd();
    };
    // Phones have no preset list: a tap on the picture moves to the next preset.
    const onClick = (e: MouseEvent) => {
      if (!compactRef.current || (e.target as HTMLElement).closest("button")) return;
      const presets = CHAPTERS[chapterRef.current].presets;
      if (presets) engine()?.setPreset(presetRef.current + 1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    host?.addEventListener("pointerdown", onDown);
    host?.addEventListener("pointermove", onMove);
    host?.addEventListener("pointerup", onUp);
    host?.addEventListener("pointercancel", onUp);
    host?.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      host?.removeEventListener("pointerdown", onDown);
      host?.removeEventListener("pointermove", onMove);
      host?.removeEventListener("pointerup", onUp);
      host?.removeEventListener("pointercancel", onUp);
      host?.removeEventListener("click", onClick);
    };
  }, [open, landed]);

  // --- Typing in -----------------------------------------------------------------------

  const visible = open && landed;

  /** Type in every `[data-typed]` under `root` (except `skip`), over `seconds`. */
  const type = useCallback((root: Element | null, seconds: number, skip?: string) => {
    if (!root) return () => {};
    const selector = skip ? `[data-typed]:not(${skip})` : "[data-typed]";
    // Words as well as chars, so a wrapping line still breaks between words.
    const splits = [...root.querySelectorAll<HTMLElement>(selector)].map((el) =>
      SplitText.create(el, { type: "words,chars" })
    );
    const chars = splits.flatMap((s) => s.chars);
    if (prefersReducedMotion() || !chars.length) return () => splits.forEach((s) => s.revert());
    const tween = gsap.fromTo(
      chars,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.01, stagger: { each: seconds / chars.length } }
    );
    return () => {
      tween.kill();
      splits.forEach((s) => s.revert());
    };
  }, []);

  // On landing the headline is already in place — it flew there — so only the rest is typed.
  // A new chapter types in again; a new preset only moves the marker (the typed text
  // itself never changes while it is split into characters).
  const wasVisible = useRef(false);
  useLayoutEffect(() => {
    const landing = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!visible) return;
    const copy = overlayRef.current?.querySelector("[data-chapter-copy]") ?? null;
    return type(copy, 0.45, landing ? "[data-flies]" : undefined);
  }, [visible, chapter, type]);

  const c = CHAPTERS[chapter];
  const go = (k: number) => engineRef.current?.go(k);
  const pick = (k: number) => engineRef.current?.setPreset(k);
  const draggable = visible && dragOf(c.presets?.[preset]) !== null;
  const list = c.presets ?? [];
  const rows = presetRows(list);
  const tab = visible ? 0 : -1;
  const presetClass = (k: number, math?: boolean) =>
    `pointer-events-auto cursor-pointer transition-colors ${math ? MATH : "uppercase tracking-[0.18em]"} ${
      k === preset ? "text-bone" : "hover:text-bone"
    }`;

  return (
    <div className="relative h-full w-full">
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-hidden bg-ink"
        style={{ cursor: draggable ? "grab" : undefined, touchAction: visible ? "none" : undefined }}
      >
        {/* The front page: the Mandelbrot set in ASCII. It hands over to the canvas as the article opens. */}
        <div
          aria-hidden
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{ opacity: open ? 0 : 1 }}
        >
          <AsciiPanel field="mandel" />
        </div>
        <canvas
          ref={glRef}
          aria-hidden
          className="invert-on-light absolute inset-0 h-full w-full transition-opacity duration-300 ease-out"
          style={{ opacity: open ? 1 : 0 }}
        />
        <canvas ref={drawRef} aria-hidden className="invert-on-light absolute inset-0 h-full w-full" style={{ opacity: visible ? 1 : 0 }} />
      </div>

      <div
        ref={overlayRef}
        aria-hidden={!visible}
        className="fit pointer-events-none absolute inset-0"
        style={{ visibility: visible ? "visible" : "hidden" }}
      >
        {/* Scrim: the pictures run to the edges; the type needs a little ink behind it. */}
        <div className="absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-ink/60 to-transparent @max-[560px]:hidden" />
        {/* …and the index and the preset list a lot more, when they sit over the picture: some
            pictures (prism, the sine Julia) are nearly white. */}
        <div
          className={`absolute right-0 top-0 h-[9rem] max-h-full w-[16rem] max-w-full @max-[560px]:hidden ${columns ? "hidden" : ""}`}
          style={{
            background:
              "radial-gradient(farthest-side at 100% 0, color-mix(in srgb, var(--ink) 85%, transparent), color-mix(in srgb, var(--ink) 75%, transparent) 60%, transparent)",
          }}
        />
        {c.presets && !columns && (
          <div
            className="absolute left-0 top-0 h-[32rem] max-h-full w-[30rem] max-w-full @max-[560px]:hidden"
            style={{
              background:
                "radial-gradient(farthest-side at 0 0, color-mix(in srgb, var(--ink) 85%, transparent), color-mix(in srgb, var(--ink) 75%, transparent) 65%, transparent)",
            }}
          />
        )}

        <div data-chapter-copy key={c.id} className="contents">
          {/* Headline, top left. */}
          <div className="absolute left-4 top-4 @max-[560px]:top-auto @max-[560px]:bottom-[calc(100%+16px)]">
            {/* The newspaper's FRACTALS flies here when the article opens (see Stage). */}
            <h3
              data-typed
              data-flies
              data-stage-headline="fractals"
              className="font-serif-ui whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
              style={{ fontSize: "clamp(2.25rem, 7cqw, 4.5rem)" }}
            >
              {c.headline}
            </h3>
          </div>
          {/* The presets: under the headline — or, with room, in the band left of the picture,
              hard against its rule. One row per preset; a group's variants share a row as chips. */}
          {c.presets && (
            <div
              className={
                columns
                  ? "absolute right-[calc(100%+16px)] top-4 @max-[560px]:hidden"
                  : "absolute left-4 @max-[560px]:hidden"
              }
              style={
                columns
                  ? { width: "calc(var(--band) - 32px)" }
                  : { top: "calc(16px + clamp(2.25rem, 7cqw, 4.5rem) * 0.86 + 16px)" }
              }
            >
              <ul className={LABEL}>
                {rows.map((row) => {
                  const active = row.items.includes(preset);
                  return (
                    <li
                      key={row.items[0]}
                      className={`flex items-baseline ${columns ? "flex-wrap" : "whitespace-nowrap"}`}
                      style={{ minHeight: INDEX_ROW }}
                    >
                      <span aria-hidden className={`w-[1.6em] shrink-0 text-bone ${active ? "" : "invisible"}`}>
                        <span data-typed>▸</span>
                      </span>
                      {row.items.length === 1 ? (
                        <button
                          type="button"
                          tabIndex={tab}
                          aria-current={active || undefined}
                          onClick={() => pick(row.items[0])}
                          className={presetClass(row.items[0], row.math)}
                        >
                          <span data-typed>{row.label}</span>
                        </button>
                      ) : (
                        <>
                          {/* The group's name opens it at its first variant; inside it, it stays put. */}
                          <button
                            type="button"
                            tabIndex={tab}
                            onClick={() => !active && pick(row.items[0])}
                            className={`pointer-events-auto mr-[1.2em] uppercase tracking-[0.18em] transition-colors ${
                              active ? "text-bone" : "cursor-pointer hover:text-bone"
                            }`}
                          >
                            <span data-typed>{row.label}</span>
                          </button>
                          {row.items.map((k, j) => (
                            <Fragment key={k}>
                              {j > 0 && (
                                <span aria-hidden className="px-[0.6em]">
                                  <span data-typed>·</span>
                                </span>
                              )}
                              <button
                                type="button"
                                tabIndex={tab}
                                aria-current={k === preset || undefined}
                                aria-label={`${row.label} ${list[k].label}`}
                                onClick={() => pick(k)}
                                className={presetClass(k, list[k].math)}
                              >
                                <span data-typed>{list[k].label}</span>
                              </button>
                            </Fragment>
                          ))}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Index, top right — or in the band right of the picture: the chapters, with a marker that travels. */}
        <nav
          className={`absolute top-4 @max-[560px]:top-auto @max-[560px]:bottom-[calc(100%+16px)] ${
            columns ? "left-[calc(100%+16px)] w-max" : "right-4"
          }`}
        >
          <div className="relative pl-4">
            <div ref={markerRef} aria-hidden className="absolute left-0 top-[3px] h-[10px] w-px bg-bone" />
            <ol className={LABEL}>
              {CHAPTERS.map((ch, k) => (
                <li key={ch.id} style={{ height: INDEX_ROW }}>
                  <button
                    type="button"
                    tabIndex={visible ? 0 : -1}
                    onClick={() => go(k)}
                    className={`pointer-events-auto cursor-pointer uppercase tracking-[0.18em] transition-colors ${
                      k === chapter ? "text-bone" : "hover:text-bone"
                    }`}
                  >
                    {pad(k)} {ch.headline}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </div>
  );
}
