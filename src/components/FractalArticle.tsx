"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { LABEL } from "@/components/furniture";
import AsciiPanel from "@/lib/ascii/AsciiPanel";
import { CHAPTERS, LAST_CHAPTER } from "@/lib/fractals/chapters";
import { FractalEngine, type Readout } from "@/lib/fractals/engine";
import { gsap, prefersReducedMotion, SplitText } from "@/lib/stage/motion";

/** Height of one row of the chapter index, px — the marker moves in these. */
const INDEX_ROW = 16;
/** Finger travel that counts as a swipe to the next chapter, px. */
const SWIPE = 40;
/** Movement before a touch decides whether it is a swipe or a drag, px. */
const DECIDE = 8;
/** Box width below which the furniture moves outside the box (as the watch). */
const COMPACT_BELOW = 560;
/** Below this the code starts folded to its file line, so it doesn't cover the picture. */
const CODE_OPEN_FROM = 700;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fractals as an article. On the front page it is the Mandelbrot set in ASCII,
 * its iterations rising and falling; opened, the characters give way to pixels
 * and a walkthrough in six chapters (src/lib/fractals/chapters.ts) — each
 * scroll or swipe is one, and each shows a piece of Avi's code beside a live
 * port of it.
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
  const [readout, setReadout] = useState<Readout | null>(null);
  const [codeOpen, setCodeOpen] = useState(true);
  const compactRef = useRef(false);

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
      onChapter: setChapter,
      onPreset: setPreset,
      onReadout: setReadout,
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
    let wasWide: boolean | null = null;
    const check = () => {
      const w = el.clientWidth;
      compactRef.current = w > 0 && w < COMPACT_BELOW;
      const wide = w >= CODE_OPEN_FROM;
      if (w > 0 && wide !== wasWide) {
        wasWide = wide;
        setCodeOpen(wide);
      }
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
    const splits = [...root.querySelectorAll<HTMLElement>(selector)].map((el) =>
      // Code keeps its line breaks and indents; everything else splits into words as well as
      // chars, so a wrapping line still breaks between words.
      el.tagName === "PRE"
        ? SplitText.create(el, { type: "chars", reduceWhiteSpace: false })
        : SplitText.create(el, { type: "words,chars" })
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
  const wasVisible = useRef(false);
  useLayoutEffect(() => {
    const landing = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!visible) return;
    const copy = overlayRef.current?.querySelector("[data-chapter-copy]") ?? null;
    return type(copy, 0.45, landing ? "[data-flies]" : undefined);
  }, [visible, chapter, preset, type]);

  const c = CHAPTERS[chapter];
  const p = c.presets?.[preset];
  const excerpt = p?.excerpt ?? c.excerpt;
  const go = (k: number) => engineRef.current?.go(k);
  const draggable = visible && (c.id === "julia" || c.id === "fraotic");

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
          className="absolute inset-0 h-full w-full transition-opacity duration-300 ease-out"
          style={{ opacity: open ? 1 : 0 }}
        />
        <canvas ref={drawRef} aria-hidden className="absolute inset-0 h-full w-full" style={{ opacity: visible ? 1 : 0 }} />
      </div>

      <div
        ref={overlayRef}
        aria-hidden={!visible}
        className="fit pointer-events-none absolute inset-0"
        style={{ visibility: visible ? "visible" : "hidden" }}
      >
        {/* Scrims: the pictures run to the edges; the type needs a little ink behind it. */}
        <div className="absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-ink/60 to-transparent @max-[560px]:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-t from-ink/70 to-transparent @max-[560px]:hidden" />

        <div data-chapter-copy key={`${c.id}-${preset}`} className="contents">
          {/* Headline, top left; the presets below it. */}
          <div className="absolute left-4 top-4 @max-[560px]:top-auto @max-[560px]:bottom-[calc(100%+16px)]">
            <p data-typed className={LABEL}>
              Chapter {pad(chapter)} / {pad(LAST_CHAPTER)}
              {c.kicker ? ` — ${c.kicker}` : ""}
            </p>
            {/* The newspaper's FRACTALS flies here when the article opens (see Stage). */}
            <h3
              data-typed
              data-flies
              data-stage-headline="fractals"
              className="font-serif-ui mt-1.5 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
              style={{ fontSize: "clamp(2.25rem, 7cqw, 4.5rem)" }}
            >
              {c.headline}
            </h3>
            {c.presets && (
              <div className="mt-4 @max-[560px]:hidden">
                <ul className={LABEL}>
                  {c.presets.map((q, k) => (
                    <li key={q.id} style={{ height: INDEX_ROW }}>
                      <button
                        type="button"
                        tabIndex={visible ? 0 : -1}
                        onClick={() => engineRef.current?.setPreset(k)}
                        className={`pointer-events-auto cursor-pointer uppercase tracking-[0.18em] transition-colors ${
                          k === preset ? "text-bone" : "hover:text-bone"
                        }`}
                      >
                        <span data-typed>
                          {k === preset ? "▸ " : "  "}
                          {q.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {p?.note && (
                  <p data-typed className={`${LABEL} mt-3 max-w-[36cqw]`}>
                    {p.note}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom left: his code, then the caption. */}
          <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-32px)] flex-col items-start gap-3 @max-[560px]:bottom-auto @max-[560px]:top-[calc(100%+16px)]">
            {excerpt && (
              <figure className="max-w-full border border-rule bg-ink/85 px-3 py-2 @max-[560px]:hidden">
                {/* The file line folds and unfolds the code. */}
                <figcaption>
                  <button
                    type="button"
                    tabIndex={visible ? 0 : -1}
                    aria-expanded={codeOpen}
                    onClick={() => setCodeOpen((o) => !o)}
                    className={`${LABEL} pointer-events-auto cursor-pointer text-left uppercase transition-colors hover:text-bone`}
                  >
                    {/* The sign changes without a retype, so it sits outside the typed text. */}
                    <span className="inline-block w-3">{codeOpen ? "−" : "+"}</span>
                    <span data-typed>
                      {excerpt.file} · {excerpt.year}
                    </span>
                  </button>
                </figcaption>
                {codeOpen && (
                  <pre
                    data-typed
                    className="font-mono-ui mt-2 overflow-hidden whitespace-pre leading-[1.55] text-bone"
                    style={{ fontSize: "clamp(9px, 1.3cqw, 11px)" }}
                  >
                    {excerpt.code}
                  </pre>
                )}
              </figure>
            )}
            <p data-typed className={`${LABEL} max-w-[78cqw] @max-[560px]:max-w-none`}>
              {c.caption}
            </p>
          </div>

          {/* Figures, under the index — live where the chapter has something moving. Keys and
              values are set as written (math stays lower case), so no text-transform here.
              Phones have no room for them beside the caption and the stage's clock. */}
          <dl
            className="font-mono-ui absolute right-4 grid grid-cols-[auto_auto] gap-x-4 text-right text-[11px] leading-[1.7] tracking-[0.08em] @max-[560px]:hidden"
            style={{ top: 16 + INDEX_ROW * CHAPTERS.length + 20 }}
          >
            {(readout?.rows ?? c.figures.map(([key, value]) => ({ key, value, lit: false }))).map((r) => (
              <Fragment key={r.key}>
                <dt data-typed className={r.lit ? "text-bone" : "text-dim"}>
                  {r.key}
                </dt>
                {/* Values change while the chapter runs, so they are not typed (SplitText would freeze them). */}
                <dd className="whitespace-nowrap normal-case text-bone">{r.value}</dd>
              </Fragment>
            ))}
          </dl>
        </div>

        {/* Index, top right: the chapters, with a marker that travels. */}
        <nav className="absolute right-4 top-4 @max-[560px]:top-auto @max-[560px]:bottom-[calc(100%+16px)]">
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
