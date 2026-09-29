"use client";

import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { LABEL } from "@/components/furniture";
import { gsap, prefersReducedMotion, SplitText } from "@/lib/stage/motion";
import { CHAPTERS, LAST_CHAPTER, type Callout } from "@/lib/watch/chapters";
import { type Anchor, type FrameInfo, WatchEngine } from "@/lib/watch/engine";

/** Height of one row of the chapter index, px — the scrub marker moves in these. */
const INDEX_ROW = 16;
/** How fast a chapter's labels come on: leaders draw, labels type, s. */
const LINES_IN = 0.28;
const LABELS_IN = 0.16;
const LINE_STAGGER = 0.02;
/** Finger travel that counts as a swipe to the next chapter, px. */
const SWIPE = 40;
/** Minimum vertical gap between callout labels, px. */
const LABEL_GAP = 22;
/** Space between the box's edges and anything set inside it (the site's inset). */
const INSET = 16;
/** Box width below which the furniture moves outside the box and part labels are dropped. */
const COMPACT_BELOW = 560;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The watch as an article: a teardown in five chapters. On the front page it
 * is the turntable; once its stage has landed, each scroll or swipe moves one
 * chapter (see src/lib/watch/chapters.ts) and the furniture inside the box —
 * headline, index, caption, figures, labelled parts — follows along.
 *
 * Text is typed in when it changes and lines are drawn in; nothing inside the
 * box is shown while the article is flying between the page and the stage.
 */
export default function WatchArticle({ open, landed }: { open: boolean; landed: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WatchEngine | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLOListElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const figuresRef = useRef<HTMLDListElement>(null);
  const calloutsRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const anchorsRef = useRef<Map<string, Anchor>>(new Map());

  /** The latest props, for an engine created after they arrived (remounts, hot reload). */
  const stateRef = useRef({ open, landed });
  useLayoutEffect(() => {
    stateRef.current = { open, landed };
  }, [open, landed]);

  const [chapter, setChapter] = useState(0);
  const [settled, setSettled] = useState(false);
  /** A small box (phones): furniture moves into the bands above and below it, labels give way. */
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = el.clientWidth < COMPACT_BELOW;
      compactRef.current = next;
      setCompact(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown = useRef({ chapter: 0, settled: false });

  // --- Callout layout ---------------------------------------------------------

  /** Place labels in two columns inside the box and route a leader to each part. */
  const layout = useCallback(() => {
    const overlay = overlayRef.current;
    const layer = calloutsRef.current;
    const svg = svgRef.current;
    if (!overlay || !layer || !svg) return;
    const W = overlay.clientWidth;
    const H = overlay.clientHeight;
    const anchors = anchorsRef.current;
    const box = overlay.getBoundingClientRect();
    const below = (el: HTMLElement | null) => (el ? el.getBoundingClientRect().bottom - box.top + 12 : INSET);
    const above = (el: HTMLElement | null) => (el ? el.getBoundingClientRect().top - box.top - 12 : H - INSET);
    const bounds = {
      left: [below(headRef.current), above(captionRef.current)],
      right: [below(indexRef.current), above(figuresRef.current)],
    };

    for (const dot of svg.querySelectorAll<SVGRectElement>("[data-dot]")) {
      const a = anchors.get(dot.dataset.dot!);
      if (!a) continue;
      dot.setAttribute("x", String(a.x - 1.5));
      dot.setAttribute("y", String(a.y - 1.5));
    }

    const labels = compactRef.current ? [] : [...layer.querySelectorAll<HTMLElement>("[data-callout]")];
    const items = labels
      .map((el) => ({ el, ref: el.dataset.callout!, a: anchors.get(el.dataset.callout!), side: el.dataset.side }))
      .filter((it): it is { el: HTMLElement; ref: string; a: Anchor; side: string | undefined } => !!it.a);

    for (const side of ["left", "right"] as const) {
      const group = items
        .filter((it) => (it.side ?? (it.a.x < W / 2 ? "left" : "right")) === side)
        .sort((p, q) => p.a.y - q.a.y);
      const [top, bottom] = bounds[side];
      const ys = group.map((it) => Math.min(Math.max(it.a.y, top), bottom));
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + LABEL_GAP);
      for (let i = ys.length - 1; i >= 0; i--) {
        const limit = i === ys.length - 1 ? bottom : ys[i + 1] - LABEL_GAP;
        ys[i] = Math.min(ys[i], limit);
      }
      group.forEach((it, rank) => {
        const w = it.el.offsetWidth;
        const y = ys[rank];
        const x = side === "left" ? INSET : W - INSET - w;
        it.el.style.transform = `translate(${x}px, ${y - it.el.offsetHeight / 2}px)`;
        const start = side === "left" ? INSET + w + 8 : W - INSET - w - 8;
        const dir = side === "left" ? 1 : -1;
        let elbow = start + dir * (14 + rank * 6);
        if (dir * (it.a.x - elbow) < 4) elbow = it.a.x;
        const path = svg.querySelector<SVGPathElement>(`[data-leader="${it.ref}"]`);
        path?.setAttribute("d", `M${start},${y} H${elbow} V${it.a.y} H${it.a.x}`);
      });
    }

    const trace = svg.querySelector<SVGPathElement>("[data-trace]");
    const refs = CHAPTERS[shown.current.chapter].trace ?? [];
    if (trace && refs.length) {
      const pts = refs.map((r) => anchors.get(r)).filter((a): a is Anchor => !!a);
      trace.setAttribute("d", pts.map((a, i) => `${i ? "L" : "M"}${a.x},${a.y}`).join(" "));
    }
  }, []);

  // --- Engine ------------------------------------------------------------------

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onFrame = (f: FrameInfo) => {
      anchorsRef.current = f.anchors;
      if (markerRef.current) markerRef.current.style.transform = `translateY(${f.progress * INDEX_ROW}px)`;
      if (f.chapter !== shown.current.chapter) {
        shown.current.chapter = f.chapter;
        setChapter(f.chapter);
      }
      if (f.settled !== shown.current.settled) {
        shown.current.settled = f.settled;
        setSettled(f.settled);
      }
      if (f.settled) layout();
    };
    const engine = new WatchEngine(host, "/watch-parts.bin", onFrame);
    engine.setInteractive(stateRef.current.open && stateRef.current.landed);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [layout]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!open) engine.home();
    else engine.setInteractive(landed);
  }, [open, landed]);

  // --- Input while on stage ------------------------------------------------------

  useEffect(() => {
    if (!open || !landed) return;
    const engine = () => engineRef.current;
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
    // A swipe is a scroll: one chapter per swipe, once it has travelled SWIPE px.
    let touchY: number | null = null;
    let swiped = false;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
      swiped = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      e.preventDefault();
      if (!swiped && Math.abs(touchY - y) > SWIPE) {
        engine()?.step(Math.sign(touchY - y));
        swiped = true;
      }
    };
    const onTouchEnd = () => {
      touchY = null;
    };
    const onPointer = (e: PointerEvent) => {
      const r = hostRef.current?.getBoundingClientRect();
      if (!r) return;
      engine()?.setTilt(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("pointermove", onPointer);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [open, landed]);

  // --- Typing and drawing in ------------------------------------------------------

  const visible = open && landed;

  /** Type in every `[data-typed]` under `root` (except `skip`), over `seconds`. */
  const type = useCallback((root: Element | null, seconds: number, skip?: string) => {
    if (!root) return () => {};
    const selector = skip ? `[data-typed]:not(${skip})` : "[data-typed]";
    const splits = [...root.querySelectorAll<HTMLElement>(selector)].map((el) =>
      // words as well as chars, so a wrapping line still breaks between words
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

  // On landing the headline is already in place — it flew there — so only the
  // rest is typed; on a change of chapter everything is.
  const wasVisible = useRef(false);
  useLayoutEffect(() => {
    const landing = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!visible) return;
    const copy = overlayRef.current?.querySelector("[data-chapter-copy]") ?? null;
    return type(copy, 0.4, landing ? "[data-flies]" : undefined);
  }, [visible, chapter, type]);

  const calloutsOn = visible && settled && (CHAPTERS[chapter].callouts.length > 0 || !!CHAPTERS[chapter].trace);
  useLayoutEffect(() => {
    if (!calloutsOn) return;
    layout();
    const untype = type(calloutsRef.current, LABELS_IN);
    const lines = svgRef.current ? [...svgRef.current.querySelectorAll("path")] : [];
    const dots = svgRef.current ? [...svgRef.current.querySelectorAll("rect")] : [];
    if (prefersReducedMotion()) return untype;
    const tl = gsap.timeline();
    tl.fromTo(
      lines,
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: LINES_IN, ease: "expo.out", stagger: LINE_STAGGER }
    );
    tl.fromTo(dots, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, stagger: LINE_STAGGER }, 0);
    return () => {
      tl.kill();
      untype();
    };
  }, [calloutsOn, chapter, compact, layout, type]);

  const c = CHAPTERS[chapter];
  const go = (k: number) => engineRef.current?.go(k);
  const press = (o: Callout) => o.press && engineRef.current?.press(o.press);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0 overflow-hidden" />

      <div
        ref={overlayRef}
        aria-hidden={!visible}
        className="fit pointer-events-none absolute inset-0"
        style={{ visibility: visible ? "visible" : "hidden" }}
      >
        <div data-chapter-copy key={c.id} className="contents">
          {/* Headline, top left */}
          {/* Positions come from container queries, not state, so the stage can
              measure where the headline will land the moment the box is placed. */}
          <div
            ref={headRef}
            className="absolute left-4 top-4 @max-[560px]:top-auto @max-[560px]:bottom-[calc(100%+16px)]"
          >
            <p data-typed className={LABEL}>
              Chapter {pad(chapter)} / {pad(LAST_CHAPTER)}
            </p>
            {/* The newspaper's WATCH flies here when the article opens (see Stage). */}
            <h3
              data-typed
              data-flies
              data-stage-headline="watch"
              className="font-serif-ui mt-1.5 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
              style={{ fontSize: "clamp(2.25rem, 7cqw, 4.5rem)" }}
            >
              {c.headline}
            </h3>
          </div>

          {/* Caption, bottom left */}
          <p
            ref={captionRef}
            data-typed
            className={`${LABEL} absolute bottom-4 left-4 max-w-[55%] @max-[560px]:bottom-auto @max-[560px]:top-[calc(100%+16px)] @max-[560px]:max-w-[44%]`}
          >
            {c.caption}
          </p>

          {/* Figures, bottom right — HUD readouts */}
          <dl
            ref={figuresRef}
            className="font-mono-ui absolute bottom-4 right-4 grid grid-cols-[auto_auto] gap-x-4 text-right text-[11px] uppercase leading-[1.7] tracking-[0.08em] @max-[560px]:bottom-auto @max-[560px]:top-[calc(100%+16px)]"
          >
            {c.figures.map(([k, v]) => (
              <Fragment key={k}>
                <dt data-typed className="text-dim">
                  {k}
                </dt>
                <dd data-typed className="text-bone">
                  {v}
                </dd>
              </Fragment>
            ))}
          </dl>
        </div>

        {/* Index, top right: the chapters, with a marker that follows the scrub. */}
        <nav className="absolute right-4 top-4 @max-[560px]:top-auto @max-[560px]:bottom-[calc(100%+16px)]">
          <div className="relative pl-4">
            <div
              ref={markerRef}
              aria-hidden
              className="absolute left-0 top-[3px] h-[10px] w-px bg-bone"
            />
            <ol ref={indexRef} className={LABEL}>
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

        {/* Leaders and traces */}
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full overflow-visible"
          style={{ visibility: calloutsOn ? "visible" : "hidden" }}
        >
          {calloutsOn && c.trace && (
            <path
              data-trace
              pathLength={1}
              strokeDasharray="1 1"
              fill="none"
              stroke="var(--bone)"
              strokeWidth={1}
            />
          )}
          {calloutsOn &&
            c.callouts.map((o) => (
              <g key={`${c.id}-${o.ref}`}>
                <path
                  data-leader={o.ref}
                  visibility={compact ? "hidden" : "visible"}
                  pathLength={1}
                  strokeDasharray="1 1"
                  fill="none"
                  stroke="var(--dim)"
                  strokeWidth={1}
                />
                <rect data-dot={o.ref} width={3} height={3} fill="var(--bone)" />
              </g>
            ))}
        </svg>

        {/* Labels */}
        <div ref={calloutsRef} className="absolute inset-0">
          {calloutsOn &&
            !compact &&
            c.callouts.map((o) => {
              const body: ReactNode = (
                <>
                  <span className="text-bone">{o.ref}</span> — {o.text}
                </>
              );
              return o.press ? (
                <button
                  key={`${c.id}-${o.ref}`}
                  type="button"
                  data-callout={o.ref}
                  data-side={o.side}
                  data-typed
                  onClick={() => press(o)}
                  className={`${LABEL} pointer-events-auto absolute left-0 top-0 cursor-pointer whitespace-nowrap uppercase transition-colors hover:text-bone`}
                >
                  {body}
                </button>
              ) : (
                <span
                  key={`${c.id}-${o.ref}`}
                  data-callout={o.ref}
                  data-side={o.side}
                  data-typed
                  className={`${LABEL} absolute left-0 top-0 whitespace-nowrap`}
                >
                  {body}
                </span>
              );
            })}
        </div>
      </div>
    </div>
  );
}
