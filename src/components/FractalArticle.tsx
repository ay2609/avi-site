"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import EndMark from "@/components/EndMark";
import { advance, DATA, WAY } from "@/components/furniture";
import AsciiPanel from "@/lib/ascii/AsciiPanel";
import { type Collection, dragOf, type Preset, presetName, THUMBS } from "@/lib/fractals/chapters";
import { FractalEngine } from "@/lib/fractals/engine";
import { sfx } from "@/lib/sound/sfx";
import { ARTICLES, type ArticleId } from "@/lib/stage/articles";
import { gsap, prefersReducedMotion, SplitText, stageBox } from "@/lib/stage/motion";

/** Height of one row of the chapter index, px — the marker moves in these. */
const INDEX_ROW = 22;
/** Finger travel that counts as a swipe to the next chapter, px. */
const SWIPE = 40;
/** Movement before a touch decides whether it is a swipe or a drag, px. */
const DECIDE = 8;
/** Box width below which the headline and index go under the box: a phone, not just a small window. */
const COMPACT_BELOW = 420;
/**
 * Side band (stage edge to the box) at and above which the index leaves the
 * picture for the band beside it, where it reads in the page's own contrast.
 * Narrower, it sits over the picture on a scrim.
 */
const COLUMNS_FROM = 240;
/** The front page's ASCII, px: finer than the panels' 10, for the detail in these two. */
const ASCII_SIZE = 8;
/** Most pictures in a row of the contact sheet, under a phone-sized box. */
const SHEET_ACROSS = 8;
/** What a drag does to the picture on screen. */
const DRAG_HINT = { c: "Drag to change it", slice: "Drag to turn the slice" } as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** One picture, from the contact sheet's one image; in light mode inverted as the picture itself is. */
function Thumb({ preset, on }: { preset: Preset; on: boolean }) {
  const at = THUMBS.order.indexOf(preset.id);
  const down = Math.ceil(THUMBS.order.length / THUMBS.across);
  const column = at % THUMBS.across;
  const row = Math.floor(at / THUMBS.across);
  return (
    <span
      aria-hidden
      className="invert-on-light block aspect-square w-full"
      style={
        on
          ? {
              backgroundImage: `url(${THUMBS.src})`,
              backgroundSize: `${THUMBS.across * 100}% ${down * 100}%`,
              backgroundPosition: `${(column / (THUMBS.across - 1)) * 100}% ${(row / Math.max(1, down - 1)) * 100}%`,
            }
          : undefined
      }
    />
  );
}

/**
 * Pictures from one shader as an article: the fractals and the chaotic
 * attractors, each a Collection (src/lib/fractals/chapters.ts). On the front
 * page it is an ASCII field (the Mandelbrot set, the Lorenz orbit); opened, the
 * characters give way to the picture in pixels and a walkthrough of every
 * picture, each a live port of Avi's own code. Each scroll or swipe is one picture, so none can be missed;
 * under the picture, its chapter's contact sheet shows all of them at once.
 */
export default function FractalArticle({
  id,
  collection,
  open,
  landed,
}: {
  id: ArticleId;
  collection: Collection;
  open: boolean;
  landed: boolean;
}) {
  const router = useRouter();
  const CHAPTERS = collection.chapters;
  const LAST_CHAPTER = CHAPTERS.length - 1;
  const hostRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FractalEngine | null>(null);

  const [chapter, setChapter] = useState(0);
  const [preset, setPreset] = useState(0);
  const compactRef = useRef(false);
  /** A small box (phones): the headline and index go under it, and the sheet takes rows. */
  const [compact, setCompact] = useState(false);
  /** The index in the side band rather than over the picture. */
  const [columns, setColumns] = useState(false);
  /** The picture the pointer is over in the sheet: its name shows until it leaves. */
  const [hovered, setHovered] = useState<number | null>(null);

  const stateRef = useRef({ open, landed });
  useLayoutEffect(() => {
    stateRef.current = { open, landed };
  }, [open, landed]);

  // --- Engine ----------------------------------------------------------------------

  useEffect(() => {
    const gl = glRef.current;
    const draw = drawRef.current;
    if (!gl || !draw) return;
    const engine = new FractalEngine(gl, draw, CHAPTERS, {
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
  }, [CHAPTERS]);

  useEffect(() => {
    engineRef.current?.setOpen(open, landed);
  }, [open, landed]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const check = () => {
      const w = el.clientWidth;
      compactRef.current = w > 0 && w < COMPACT_BELOW;
      setCompact(compactRef.current);
      // From the stage box, not this one: on the page the overlay is the slot's size.
      const { aspect, reads, foot } = ARTICLES[id];
      const b = stageBox(aspect, reads, foot);
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
  }, [id]);

  // --- Input while on stage -----------------------------------------------------------

  useEffect(() => {
    if (!open || !landed) return;
    const engine = () => engineRef.current;
    const host = hostRef.current;
    /** What's under the picture is taller than its room (a small screen): a scroll over it scrolls it. */
    const overDeck = (e: Event) => {
      const deck = deckRef.current;
      return !!deck && deck.scrollHeight > deck.clientHeight + 2 && deck.contains(e.target as Node);
    };

    const onWheel = (e: WheelEvent) => {
      if (overDeck(e)) return;
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

    // Touch: a vertical swipe is a scroll (one picture); a horizontal one drags, where a
    // picture takes a drag. A tap on a phone's picture is the next one too.
    let touch: { x: number; y: number; axis: "x" | "y" | null; swiped: boolean } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch = t && !overDeck(e) ? { x: t.clientX, y: t.clientY, axis: null, swiped: false } : null;
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
    const onClick = (e: MouseEvent) => {
      if (!compactRef.current || (e.target as HTMLElement).closest("button")) return;
      engine()?.step(1);
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
  }, [open, landed, LAST_CHAPTER]);

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

  // On landing the headline is already in place — it flew there — so nothing is typed.
  // A new chapter types its headline in; the words beside it come straight on.
  const wasVisible = useRef(false);
  useLayoutEffect(() => {
    const landing = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!visible) return;
    const copy = overlayRef.current?.querySelector("[data-chapter-copy]") ?? null;
    return type(copy, 0.45, landing ? "[data-flies]" : undefined);
  }, [visible, chapter, type]);

  /** One chapter has no need of an index. */
  const indexed = CHAPTERS.length > 1;
  const c = CHAPTERS[chapter];
  /** On a phone, where the words start: below the headline and the index beside it. */
  const under = 24 + Math.max(36, indexed ? CHAPTERS.length * INDEX_ROW : 0);
  const go = (k: number) => engineRef.current?.go(k);
  const pick = (k: number) => engineRef.current?.setPreset(k);
  const step = (dir: number) => engineRef.current?.step(dir);
  const list = c.presets ?? [];
  const current = c.presets?.[preset];
  const draggable = visible && dragOf(current) !== null;
  const dragHint = current && dragOf(current) ? DRAG_HINT[dragOf(current)!] : null;
  const tab = visible ? 0 : -1;
  const showing = hovered !== null && list[hovered] ? hovered : preset;
  const name = list[showing];
  const atFirst = chapter === 0 && (!current || preset === 0);
  const atEnd = chapter === LAST_CHAPTER && (!current || preset === list.length - 1);
  const atChapterEnd = !current || preset === list.length - 1;
  const onward = collection.next;

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
          <AsciiPanel field={collection.field} style={{ fontSize: ASCII_SIZE }} />
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
        // Closed, what's laid out under the box mustn't add to the length of the front page.
        style={{ visibility: visible ? "visible" : "hidden", overflow: open ? "visible" : "hidden" }}
      >
        {/* Scrim: the pictures run to the edges; the headline needs a little ink behind it. */}
        <div className="absolute inset-x-0 top-0 h-[24%] bg-gradient-to-b from-ink/90 via-ink/60 to-transparent @max-[419px]:hidden" />
        {/* …and the index a lot more, when it sits over the picture: some pictures
            (prism, the sine Julia) are nearly white. */}
        <div
          className={`absolute right-0 top-0 h-[9rem] max-h-full w-[16rem] max-w-full @max-[419px]:hidden ${columns || !indexed ? "hidden" : ""}`}
          style={{
            background:
              "radial-gradient(farthest-side at 100% 0, color-mix(in srgb, var(--ink) 85%, transparent), color-mix(in srgb, var(--ink) 75%, transparent) 60%, transparent)",
          }}
        />

        <div data-chapter-copy key={c.id} className="contents">
          {/* Headline, top left of the picture; under it on a phone, beside it on a short screen. */}
          <div
            className={`absolute left-4 top-4 @max-[419px]:top-[calc(100%+14px)] [@media(max-height:479px)]:!left-[calc(100%+16px)] [@media(max-height:479px)]:!top-0`}
          >
            {/* The newspaper's headline flies here when the article opens (see Stage). */}
            <h3
              data-typed
              data-flies
              data-stage-headline={id}
              className="font-serif-ui whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
              style={{ fontSize: `min(clamp(2.25rem, 7cqw, 4.5rem), ${(92 / advance(c.headline)).toFixed(2)}cqw)` }}
            >
              {c.headline}
            </h3>
          </div>
        </div>

        {/* Index, top right — or in the band right of the picture: the chapters and how many pictures
            each holds, with a marker that travels. */}
        {indexed && (
          <nav
            aria-label="Chapters"
            className={`absolute top-4 @max-[419px]:left-auto @max-[419px]:right-4 @max-[419px]:top-[calc(100%+12px)] [@media(max-height:479px)]:!top-0 [@media(max-height:479px)]:!right-[calc(100cqw+32px-100vw)] ${
              columns ? "left-[calc(100%+16px)] w-max" : "right-4"
            }`}
          >
            <div className="relative pl-4">
              <div ref={markerRef} aria-hidden className="absolute left-0 top-[2px] h-3 w-px bg-bone" />
              <ol className={`${DATA} text-dim`}>
                {CHAPTERS.map((ch, k) => (
                  <li key={ch.id} style={{ height: INDEX_ROW }}>
                    <button
                      type="button"
                      tabIndex={tab}
                      onClick={() => go(k)}
                      aria-current={k === chapter ? "step" : undefined}
                      className={`pointer-events-auto relative cursor-pointer uppercase transition-colors ${
                        k === chapter ? "text-bone" : "hover:text-bone"
                      }`}
                    >
                      {pad(k)} {ch.headline}
                      {ch.presets && <span className="ml-[0.8em] tabular-nums opacity-70">{ch.presets.length}</span>}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        )}

        {/* What's on screen, its name, and the chapter's contact sheet: under the picture, below the
            headline on a phone, beside the picture on a short screen. Its height is the article's `foot`. */}
        <div
          ref={deckRef}
          data-deck
          className={`pointer-events-auto absolute inset-x-0 top-full flex h-[136px] flex-col gap-2 overflow-y-auto px-4 pb-3 pt-3 @max-[600px]:gap-1 @max-[600px]:pb-1.5 @max-[600px]:pt-2 @max-[419px]:h-[calc(100dvh-44px-100cqw)] @max-[419px]:gap-2 @max-[419px]:pb-3 @max-[419px]:pt-[var(--under)] [@media(max-height:479px)]:!inset-x-auto [@media(max-height:479px)]:!left-full [@media(max-height:479px)]:!top-0 [@media(max-height:479px)]:!h-full [@media(max-height:479px)]:!w-[calc(100vw-100cqw-16px)] [@media(max-height:479px)]:!pt-[var(--under)]`}
          style={{ "--under": `${under}px` } as CSSProperties}
        >
          <p key={c.id} className="story-in font-text-ui m-0 shrink-0 text-[1.0625rem] leading-snug text-bone @max-[600px]:text-[0.95rem] @max-[419px]:text-[1.0625rem]">
            {c.line}
          </p>

          <div className="flex min-h-5 shrink-0 items-baseline gap-3">
            {name ? (
              <>
                <span className={`${DATA} tabular-nums text-dim`}>
                  {pad(showing + 1)} / {pad(list.length)}
                </span>
                <span
                  aria-live="polite"
                  className={`font-text-ui truncate text-[1rem] leading-tight text-bone ${name.math ? "italic" : ""}`}
                >
                  {presetName(name)}
                  {atEnd && showing === preset && <EndMark className="ml-[0.45em]" />}
                </span>
              </>
            ) : (
              <span className="font-text-ui truncate text-[1rem] leading-tight text-bone">Mandelbrot</span>
            )}
            <span className="ml-auto flex shrink-0 items-baseline gap-5">
              {dragHint && (
                <span className={`${DATA} whitespace-nowrap text-dim @max-[419px]:hidden`}>{dragHint}</span>
              )}
              {!atFirst && (
                <button
                  type="button"
                  tabIndex={tab}
                  aria-label="Previous picture"
                  onClick={() => step(-1)}
                  className={`${WAY} text-dim hover:text-bone`}
                >
                  ←
                </button>
              )}
              {!atEnd ? (
                <button type="button" tabIndex={tab} onClick={() => step(1)} className={`${WAY} text-bone hover:text-dim`}>
                  <span className="border-b border-dashed border-dim pb-px">
                    Next{atChapterEnd ? ` — ${CHAPTERS[chapter + 1].headline}` : ""}
                  </span>{" "}
                  →
                </button>
              ) : (
                onward && (
                  <button
                    type="button"
                    tabIndex={tab}
                    onClick={() => router.replace(ARTICLES[onward.id].route)}
                    className={`${WAY} text-bone hover:text-dim`}
                  >
                    <span className="border-b border-dashed border-dim pb-px">{onward.name}</span> →
                  </button>
                )
              )}
            </span>
          </div>

          {dragHint && <p className={`${DATA} m-0 shrink-0 text-dim @min-[420px]:hidden`}>{dragHint}</p>}

          {/* All of the chapter's pictures at once, the one on screen ringed. */}
          {current ? (
            <ol
              aria-label={`${c.headline}: pictures`}
              className="m-0 grid shrink-0 list-none gap-1 p-0"
              style={{
                gridTemplateColumns: compact
                  ? `repeat(${SHEET_ACROSS}, minmax(0, 1fr))`
                  : `repeat(${list.length}, minmax(0, 48px))`,
              }}
            >
              {list.map((p, k) => (
                <li key={p.id}>
                  <button
                    type="button"
                    tabIndex={tab}
                    aria-label={presetName(p)}
                    aria-current={k === preset || undefined}
                    title={presetName(p)}
                    onClick={() => pick(k)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(k)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(null)}
                    className={`block w-full cursor-pointer outline-offset-1 ${
                      k === preset ? "outline outline-1 outline-bone" : "hover:outline hover:outline-1 hover:outline-dim"
                    }`}
                  >
                    <Thumb preset={p} on={visible} />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            // The opening picture has no others of its own: the sheet says where the rest are.
            <ol className="m-0 flex shrink-0 list-none gap-5 p-0">
              {CHAPTERS.map(
                (ch, k) =>
                  ch.presets && (
                    <li key={ch.id}>
                      <button
                        type="button"
                        tabIndex={tab}
                        onClick={() => go(k)}
                        className="group flex cursor-pointer items-center gap-2.5 text-left"
                      >
                        <span className="block w-10 shrink-0 group-hover:outline group-hover:outline-1 group-hover:outline-offset-1 group-hover:outline-dim">
                          <Thumb preset={ch.presets[0]} on={visible} />
                        </span>
                        <span className="font-text-ui text-[1rem] leading-tight text-bone">{ch.headline}</span>
                        <span className={`${DATA} tabular-nums text-dim`}>{ch.presets.length}</span>
                      </button>
                    </li>
                  )
              )}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
