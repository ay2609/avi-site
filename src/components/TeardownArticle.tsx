"use client";

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import EndMark from "@/components/EndMark";
import { advance, DATA, LABEL, WAY } from "@/components/furniture";
import { sfx } from "@/lib/sound/sfx";
import { ARTICLES, type ArticleId } from "@/lib/stage/articles";
import { gsap, prefersReducedMotion, SplitText } from "@/lib/stage/motion";
import type { Device, Playing } from "@/lib/teardown/device";
import { type Anchor, type FrameInfo, TeardownEngine } from "@/lib/teardown/engine";

/** Height of one row of the chapter index, px — the scrub marker moves in these. */
const INDEX_ROW = 22;
/** How fast a chapter's marks come on: lines draw, numbers step on, s. */
const LINES_IN = 0.28;
const MARK_STAGGER = 0.05;
/** Finger travel that counts as a swipe to the next chapter, px. */
const SWIPE = 40;
/** A number on the board: its side, how far it stands off its part, and the gap kept between two, px. */
const MARK = 18;
const MARK_REACH = 26;
const MARK_GAP = 4;
/** Box width below which the words go under the box instead of beside the board. */
const COMPACT_BELOW = 560;

/** The words' column beside the board, px, for a box this wide: its CSS width, clamp(18rem, 33cqw, 24rem). */
const columnWidth = (box: number) => (box < COMPACT_BELOW ? 0 : Math.min(384, Math.max(288, box * 0.33)));

/** A number, in the key and on the board: the same little tile in both. */
const TILE = "font-mono-ui flex shrink-0 items-center justify-center text-[10px] font-normal leading-none tabular-nums";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The stage headline's size: the usual, wrapping within the column beside the
 * board; under a phone-sized box it sits on one line across the width, a long
 * one (the article's name) set smaller to fit.
 */
function headlineSize(text: string): CSSProperties {
  return { "--compact": `min(2.25rem, ${(92 / advance(text)).toFixed(2)}cqw)` } as CSSProperties;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

/** The island's buttons: rewind (or the track before), play or pause, skip. */
const ICONS = {
  prev: "M5 4h2v16H5zM20 4v16L8.5 12z",
  play: "M7 4v16l13-8z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  next: "M17 4h2v16h-2zM4 4v16l11.5-8z",
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden fill="currentColor">
      <path d={d} />
    </svg>
  );
}

/**
 * The player's controls, up front: an island under the board with the cover
 * as the OLED draws it (its 64 px, scaled up without smoothing), the track,
 * its time, and rewind, play / pause and skip. The track links to Spotify,
 * where the full song is and where the 30-second preview comes from.
 */
function Island({ now, onPress }: { now: Playing; onPress: (button: string) => void }) {
  const progress = now.duration > 0 ? Math.min(1, now.elapsed / now.duration) : 0;
  const button = "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors";
  return (
    <div
      role="group"
      aria-label="Player"
      className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-full border border-bone bg-ink py-2 pl-2 pr-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a remote 64 px cover, shown at its own pixels */}
      <img
        src={now.cover}
        alt=""
        width={64}
        height={64}
        className="h-11 w-11 shrink-0 rounded-full [image-rendering:pixelated]"
      />
      <div className="min-w-0 flex-1">
        <a
          href={now.url}
          target="_blank"
          rel="noreferrer"
          className="font-text-ui block truncate text-[0.95rem] leading-tight text-bone hover:underline"
        >
          {now.title}
        </a>
        <div className={`${LABEL} mt-0.5 truncate uppercase tracking-[0.18em]`}>
          {now.artist} · {now.elapsed > 0 ? clock(now.elapsed) : `${pad(now.index + 1)} / ${pad(now.count)}`} ·{" "}
          <a href={now.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-bone">
            Spotify ↗
          </a>
        </div>
      </div>
      <button type="button" aria-label="Rewind" onClick={() => onPress("prev")} className={`${button} text-bone hover:bg-rule`}>
        <Icon d={ICONS.prev} />
      </button>
      <button
        type="button"
        aria-label={now.playing ? "Pause" : "Play"}
        onClick={() => onPress("play")}
        className={`${button} bg-bone text-ink hover:opacity-80`}
      >
        <Icon d={now.playing ? ICONS.pause : ICONS.play} />
      </button>
      <button type="button" aria-label="Skip" onClick={() => onPress("next")} className={`${button} text-bone hover:bg-rule`}>
        <Icon d={ICONS.next} />
      </button>
      {/* Where the preview is, along the island's foot. */}
      <div aria-hidden className="absolute bottom-0 left-0 h-px bg-bone" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

/** A story that ends here: the end mark stays on the line with the last word. */
function Closed({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ") + 1;
  return (
    <>
      {text.slice(0, cut)}
      <span className="whitespace-nowrap">
        {text.slice(cut)}
        <EndMark className="ml-[0.45em]" />
      </span>
    </>
  );
}

/**
 * A board as an article (the watch, the player): a teardown in chapters, set
 * like a newspaper story beside its figure. On the front page it is the
 * turntable; once its stage has landed, each scroll or swipe moves one chapter
 * (see the device's chapters, e.g. src/lib/watch/chapters.ts).
 *
 * The left column reads top to bottom: the headline, what this part of the
 * thing does in plain words, a key of its parts numbered in the story's order
 * (the same numbers stand on the board), and the way on. Pointing at a line of
 * the key draws its part at full weight and runs a leader to it. Under a
 * phone-sized box the column goes under the board and fills the screen.
 *
 * The headline is typed in when it changes, marks step on as the board arrives,
 * and the words come straight on so there's nothing to wait for. Nothing here
 * is shown while the article is flying between the page and the stage.
 */
export default function TeardownArticle({
  id,
  device,
  open,
  landed,
}: {
  id: ArticleId;
  device: Device;
  open: boolean;
  landed: boolean;
}) {
  const router = useRouter();
  const CHAPTERS = device.chapters;
  const LAST_CHAPTER = CHAPTERS.length - 1;
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const engineRef = useRef<TeardownEngine | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLOListElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const anchorsRef = useRef<Map<string, Anchor>>(new Map());

  /** The latest props, for an engine created after they arrived (remounts, hot reload). */
  const stateRef = useRef({ open, landed });
  useLayoutEffect(() => {
    stateRef.current = { open, landed };
  }, [open, landed]);

  const [chapter, setChapter] = useState(0);
  const [settled, setSettled] = useState(false);
  /** What the screen is playing, if it plays (the player's last chapter). */
  const [now, setNow] = useState<Playing | null>(null);
  /** A small box (phones): the words move under it. */
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  /** The line of the key being pointed at; it only counts in the chapter it was pointed at in. */
  const [pointing, setPointing] = useState<{ chapter: number; ref: string } | null>(null);
  const pointed = pointing?.chapter === chapter ? pointing.ref : null;
  const pointedRef = useRef<string | null>(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = el.clientWidth < COMPACT_BELOW;
      compactRef.current = next;
      setCompact(next);
      engineRef.current?.setInset(stateRef.current.open ? columnWidth(el.clientWidth) : 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown = useRef({ chapter: 0, settled: false });

  // --- Marks on the board ------------------------------------------------------

  /** Stand a number off each part, clear of the others, the words and the index. */
  const layout = useCallback(() => {
    const overlay = overlayRef.current;
    const layer = marksRef.current;
    const svg = svgRef.current;
    if (!overlay || !layer || !svg) return;
    const W = overlay.clientWidth;
    const H = overlay.clientHeight;
    const anchors = anchorsRef.current;
    const box = overlay.getBoundingClientRect();
    const column = columnWidth(W);
    const index = compactRef.current ? null : indexRef.current?.getBoundingClientRect();

    for (const dot of svg.querySelectorAll<SVGRectElement>("[data-dot]")) {
      const a = anchors.get(dot.dataset.dot!);
      if (!a) continue;
      dot.setAttribute("x", String(a.x - 1.5));
      dot.setAttribute("y", String(a.y - 1.5));
    }

    const items = [...layer.querySelectorAll<HTMLElement>("[data-mark]")]
      .map((el) => ({ el, ref: el.dataset.mark!, a: anchors.get(el.dataset.mark!) }))
      .filter((it): it is { el: HTMLElement; ref: string; a: Anchor } => !!it.a);
    const cx = items.reduce((sum, it) => sum + it.a.x, 0) / (items.length || 1);
    const cy = items.reduce((sum, it) => sum + it.a.y, 0) / (items.length || 1);
    // Outward from the middle of the chapter's parts, so the numbers keep off the parts and the path between them.
    const at = items.map(({ a }) => {
      const dx = a.x - cx || 1;
      const dy = a.y - cy || -1;
      const d = Math.hypot(dx, dy);
      return { x: a.x + (dx / d) * MARK_REACH, y: a.y + (dy / d) * MARK_REACH };
    });
    const room = MARK + MARK_GAP;
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < at.length; i++) {
        for (let j = i + 1; j < at.length; j++) {
          const dx = at[j].x - at[i].x;
          const dy = at[j].y - at[i].y;
          if (Math.abs(dx) >= room || Math.abs(dy) >= room) continue;
          if (Math.abs(dx) > Math.abs(dy)) {
            const push = ((room - Math.abs(dx)) / 2) * (dx < 0 ? -1 : 1);
            at[i].x -= push;
            at[j].x += push;
          } else {
            const push = ((room - Math.abs(dy)) / 2) * (dy < 0 ? -1 : 1);
            at[i].y -= push;
            at[j].y += push;
          }
        }
      }
      for (const p of at) {
        p.x = Math.min(Math.max(p.x, column + room), W - room);
        p.y = Math.min(Math.max(p.y, room), H - room);
        if (index && p.x > index.left - box.left - room) p.y = Math.max(p.y, index.bottom - box.top + room);
      }
    }
    items.forEach(({ el, ref, a }, i) => {
      el.style.transform = `translate(${at[i].x - MARK / 2}px, ${at[i].y - MARK / 2}px)`;
      svg.querySelector<SVGPathElement>(`[data-stem="${ref}"]`)?.setAttribute("d", `M${a.x},${a.y} L${at[i].x},${at[i].y}`);
    });

    // The leader from the line being pointed at, across to its number.
    const reach = svg.querySelector<SVGPathElement>("[data-reach]");
    if (reach) {
      const k = items.findIndex((it) => it.ref === pointedRef.current);
      const row = k >= 0 && column ? storyRef.current?.querySelector(`[data-row="${pointedRef.current}"]`) : null;
      if (row) {
        const r = row.getBoundingClientRect();
        reach.setAttribute("d", `M${column},${r.top + r.height / 2 - box.top} H${at[k].x} V${at[k].y}`);
      } else {
        reach.setAttribute("d", "");
      }
    }

    const trace = svg.querySelector<SVGPathElement>("[data-trace]");
    const refs = CHAPTERS[shown.current.chapter].trace ?? [];
    if (trace && refs.length) {
      const pts = refs.map((r) => anchors.get(r)).filter((a): a is Anchor => !!a);
      trace.setAttribute("d", pts.map((a, i) => `${i ? "L" : "M"}${a.x},${a.y}`).join(" "));
    }
  }, [CHAPTERS]);

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
        if (stateRef.current.landed) sfx.detent();
      }
      if (f.settled !== shown.current.settled) {
        shown.current.settled = f.settled;
        setSettled(f.settled);
      }
      if (f.settled) layout();
    };
    const engine = new TeardownEngine(host, device, onFrame);
    engine.setInteractive(stateRef.current.open && stateRef.current.landed);
    engineRef.current = engine;
    const screen = engine.screen;
    const unlisten = screen?.status && screen.subscribe?.(() => setNow(screen.status!()));
    if (screen?.status) setNow(screen.status());
    return () => {
      unlisten?.();
      engine.dispose();
      engineRef.current = null;
    };
  }, [device, layout]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!open) engine.home();
    else engine.setInteractive(landed);
    // The board moves over for the words as the article opens, and back as it closes.
    engine.setInset(open ? columnWidth(overlayRef.current?.clientWidth ?? 0) : 0);
  }, [open, landed]);

  useEffect(() => {
    pointedRef.current = pointed;
    engineRef.current?.point(pointed);
  }, [pointed]);

  // --- Input while on stage ------------------------------------------------------

  useEffect(() => {
    if (!open || !landed) return;
    const engine = () => engineRef.current;
    /** The words are taller than their room (a small screen): a scroll over them scrolls them. */
    const overWords = (e: Event) => {
      const story = storyRef.current;
      return !!story && story.scrollHeight > story.clientHeight + 2 && story.contains(e.target as Node);
    };
    const onWheel = (e: WheelEvent) => {
      if (overWords(e)) return;
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
      engine()?.wheel((Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * scale);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      // On a screen that plays, Space is its play button.
      if (k === " " && CHAPTERS[shown.current.chapter].display && engine()?.screen?.status) {
        engine()?.press("play");
        e.preventDefault();
        return;
      }
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
      touchY = overWords(e) ? null : (e.touches[0]?.clientY ?? null);
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
  }, [open, landed, CHAPTERS, LAST_CHAPTER]);

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

  // On landing the headline is already in place — it flew there — so nothing
  // is typed; on a change of chapter it is.
  const wasVisible = useRef(false);
  useLayoutEffect(() => {
    const landing = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!visible) return;
    const copy = overlayRef.current?.querySelector("[data-chapter-copy]") ?? null;
    return type(copy, 0.4, landing ? "[data-flies]" : undefined);
  }, [visible, chapter, type]);

  const marksOn = visible && settled && (CHAPTERS[chapter].callouts.length > 0 || !!CHAPTERS[chapter].trace);
  useLayoutEffect(() => {
    if (!marksOn) return;
    layout();
    const lines = svgRef.current ? [...svgRef.current.querySelectorAll("[data-draw]")] : [];
    const dots = svgRef.current ? [...svgRef.current.querySelectorAll("rect")] : [];
    const marks = marksRef.current ? [...marksRef.current.querySelectorAll("[data-mark]")] : [];
    if (prefersReducedMotion()) return;
    // The path draws in the order it runs, and the numbers step on along it.
    const tl = gsap.timeline();
    tl.fromTo(lines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: LINES_IN, ease: "expo.out" });
    tl.fromTo(dots, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, stagger: MARK_STAGGER }, 0);
    tl.fromTo(marks, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, stagger: MARK_STAGGER }, 0);
    return () => {
      tl.kill();
      gsap.set(marks, { clearProps: "opacity,visibility" });
    };
  }, [marksOn, chapter, compact, layout, CHAPTERS]);

  const c = CHAPTERS[chapter];
  const photo = CHAPTERS.find((ch) => ch.photo)?.photo;
  const showPhoto = visible && !!c.photo;
  const go = (k: number) => engineRef.current?.go(k);
  const press = (button: string) => engineRef.current?.press(button);
  const point = (ref: string, on: boolean) =>
    setPointing((was) => (on ? { chapter, ref } : was?.ref === ref ? null : was));
  const nameOf = (k: number) => CHAPTERS[k].index ?? CHAPTERS[k].headline;
  const onward = device.next;
  const island = visible && c.display && now ? <Island now={now} onPress={press} /> : null;

  return (
    <div className="relative h-full w-full">
      {/* The board fades out under the last chapter's photo (the watch's). */}
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-hidden transition-opacity duration-500"
        style={{ opacity: showPhoto ? 0 : 1 }}
      />

      <div
        ref={overlayRef}
        aria-hidden={!visible}
        className="fit pointer-events-none absolute inset-0"
        // Closed, what's laid out under the box mustn't add to the length of the front page.
        style={{ visibility: visible ? "visible" : "hidden", overflow: open ? "visible" : "hidden" }}
      >
        {/* The words, in a column beside the board. Positions come from container
            queries, not state, so the stage can measure where the headline will
            land the moment the box is placed. */}
        <article
          ref={storyRef}
          data-story
          className="pointer-events-auto absolute bottom-0 left-px top-px flex w-[clamp(18rem,33cqw,24rem)] flex-col overflow-y-auto border-r border-dashed border-rule bg-ink px-4 pt-4 @max-[559px]:inset-y-auto @max-[559px]:left-0 @max-[559px]:top-full @max-[559px]:h-[calc(100dvh-44px-75cqw)] @max-[559px]:w-full @max-[559px]:border-r-0 @max-[559px]:pt-2"
        >
          {/* The chapters as ticks, on a phone: the index's job in a line, tall enough for a thumb. */}
          {compact && (
            <ol className="mb-1 flex shrink-0 gap-1">
              {CHAPTERS.map((ch, k) => (
                <li key={ch.id} className="flex-1">
                  <button
                    type="button"
                    aria-label={`Chapter ${k + 1}: ${nameOf(k)}`}
                    aria-current={k === chapter ? "step" : undefined}
                    tabIndex={visible ? 0 : -1}
                    onClick={() => go(k)}
                    className="flex h-7 w-full cursor-pointer items-center"
                  >
                    <span className={`block w-full ${k <= chapter ? "h-[2px] bg-bone" : "h-px bg-rule"}`} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div data-chapter-copy key={c.id} className="contents">
            {/* The newspaper's headline flies here when the article opens (see Stage). */}
            <h3
              data-typed
              data-flies
              data-stage-headline={id}
              className="font-serif-ui shrink-0 uppercase leading-[0.86] tracking-[-0.02em] text-bone [font-size:clamp(2.25rem,7cqw,4.5rem)] [text-wrap:balance] @max-[559px]:whitespace-nowrap @max-[559px]:[font-size:var(--compact)]"
              style={headlineSize(c.headline)}
            >
              {c.headline}
            </h3>
            <p
              aria-live="polite"
              className="story-in font-text-ui mt-3 shrink-0 text-[clamp(1.0625rem,1.85cqw,1.25rem)] leading-[1.4] text-bone @max-[559px]:text-[1.0625rem]"
            >
              {chapter === LAST_CHAPTER ? <Closed text={c.story} /> : c.story}
            </p>
          </div>

          {/* On a phone the player's controls sit with the words, under the board. */}
          {compact && island && <div className="mt-4 shrink-0">{island}</div>}

          {/* The key, set like a box score: its numbers stand on the board too. */}
          {c.callouts.length > 0 && (
            <ol key={`key-${c.id}`} className="story-in mt-5 shrink-0 border-b border-dashed border-rule">
              {c.callouts.map((o, k) => (
                <li key={o.ref} className="border-t border-dashed border-rule">
                  <button
                    type="button"
                    data-row={o.ref}
                    tabIndex={visible ? 0 : -1}
                    onPointerEnter={(e) => e.pointerType === "mouse" && point(o.ref, true)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && point(o.ref, false)}
                    onFocus={() => point(o.ref, true)}
                    onBlur={() => point(o.ref, false)}
                    onClick={() => o.press && press(o.press)}
                    className={`flex min-h-8 w-full items-center gap-2.5 py-1 text-left outline-none ${
                      o.press || compact ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`${TILE} h-4 w-4 ${pointed && pointed !== o.ref ? "border border-rule text-dim" : "bg-bone text-ink"}`}
        {/* In from the box's top and left by a pixel: the stage's rules on those edges lie just inside it, and the
            column's ground would hide them. */}
                    >
                      {k + 1}
                    </span>
                    <span
                      className={`font-text-ui text-[1rem] leading-tight transition-colors ${
                        pointed && pointed !== o.ref ? "text-dim" : "text-bone"
                      }`}
                    >
                      <span className={o.press ? "border-b border-dashed border-dim hover:border-bone" : ""}>{o.name}</span>
                    </span>
                    {o.part && <span className={`${DATA} ml-auto whitespace-nowrap pl-2 text-right text-dim`}>{o.part}</span>}
                  </button>
                </li>
              ))}
            </ol>
          )}

          {/* The opening chapter: the thing at a glance, in the same setting. */}
          {c.facts && (
            <dl key={`facts-${c.id}`} className="story-in mt-5 shrink-0 border-b border-dashed border-rule">
              {c.facts.map((f) => (
                <div key={f.name} className="flex min-h-8 items-center gap-2.5 border-t border-dashed border-rule py-1">
                  <dt className="font-text-ui text-[1rem] leading-tight text-bone">{f.name}</dt>
                  <dd className={`${DATA} m-0 ml-auto whitespace-nowrap pl-2 text-right text-dim`}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* The way on, at the foot of the column: named, so it's clear where it goes, and
              in view even when the words have to scroll on a small screen. */}
          <div className="sticky bottom-0 mt-auto flex shrink-0 items-center justify-between gap-4 bg-ink pb-4 pt-5 @max-[559px]:pb-5">
            {chapter > 0 ? (
              <button type="button" tabIndex={visible ? 0 : -1} onClick={() => go(chapter - 1)} className={`${WAY} text-dim hover:text-bone`}>
                ← {nameOf(chapter - 1)}
              </button>
            ) : (
              <span />
            )}
            {chapter < LAST_CHAPTER ? (
              <button type="button" tabIndex={visible ? 0 : -1} onClick={() => go(chapter + 1)} className={`${WAY} text-bone hover:text-dim`}>
                <span className="border-b border-dashed border-dim pb-px">Next — {nameOf(chapter + 1)}</span> →
              </button>
            ) : (
              onward && (
                <button
                  type="button"
                  tabIndex={visible ? 0 : -1}
                  onClick={() => router.replace(ARTICLES[onward.id].route)}
                  className={`${WAY} text-bone hover:text-dim`}
                >
                  <span className="border-b border-dashed border-dim pb-px">{onward.name}</span> →
                </button>
              )
            )}
          </div>
        </article>

        {/* Index, top right: the chapters, with a marker that follows the scrub. */}
        <nav aria-label="Chapters" className="absolute right-4 top-4 @max-[559px]:hidden">
          <div className="relative pl-4">
            <div ref={markerRef} aria-hidden className="absolute left-0 top-[2px] h-3 w-px bg-bone" />
            <ol ref={indexRef} className={`${DATA} text-dim`}>
              {CHAPTERS.map((ch, k) => (
                <li key={ch.id} style={{ height: INDEX_ROW }}>
                  <button
                    type="button"
                    tabIndex={visible ? 0 : -1}
                    onClick={() => go(k)}
                    aria-current={k === chapter ? "step" : undefined}
                    className={`pointer-events-auto cursor-pointer uppercase transition-colors ${
                      k === chapter ? "text-bone" : "hover:text-bone"
                    }`}
                  >
                    {pad(k)} {nameOf(k)}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {/* The player's island: centred at the foot of the board, beside the words. */}
        {!compact && island && (
          <div
            className="absolute bottom-5 left-[clamp(18rem,33cqw,24rem)] right-0 flex justify-center px-4"
          >
            <div className="w-full max-w-[28rem]">{island}</div>
          </div>
        )}

        {/* The real thing, framed like a print beside the words (filling the box
            on a phone). Black and white so it sits in the page; colour when
            hovered, or always without a hover. */}
        {photo && (
          <figure
            aria-hidden={!showPhoto}
            className={`absolute bottom-4 left-[calc(clamp(18rem,33cqw,24rem)+16px)] right-4 m-0 aspect-[1512/1209] transition-opacity duration-500 @max-[559px]:inset-0 @max-[559px]:aspect-auto ${
              showPhoto ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a static export: no image optimiser */}
            <img
              src={photo.src}
              alt={photo.alt}
              width={1512}
              height={1209}
              decoding="async"
              className={`h-full w-full border border-rule object-cover grayscale transition-[filter] duration-700 hover:grayscale-0 [@media(hover:none)]:grayscale-0 ${
                showPhoto ? "pointer-events-auto" : ""
              }`}
            />
          </figure>
        )}

        {/* The path, and each number's stem to its part. */}
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full overflow-visible"
          style={{ visibility: marksOn ? "visible" : "hidden" }}
        >
          {marksOn && c.trace && (
            <path
              data-trace
              data-draw
              pathLength={1}
              strokeDasharray="1 1"
              fill="none"
              stroke="var(--bone)"
              strokeWidth={1}
            />
          )}
          {marksOn && <path data-reach fill="none" stroke="var(--bone)" strokeWidth={1} />}
          {marksOn &&
            c.callouts.map((o) => (
              <g key={`${c.id}-${o.ref}`}>
                <path
                  data-stem={o.ref}
                  data-draw
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

        {/* The numbers on the board, the same as the key's. One that presses a
            button on the face does that here too. */}
        <div ref={marksRef} aria-hidden className="absolute inset-0">
          {marksOn &&
            c.callouts.map((o, k) => (
              <button
                key={`${c.id}-${o.ref}`}
                type="button"
                tabIndex={-1}
                data-mark={o.ref}
                onPointerEnter={(e) => e.pointerType === "mouse" && point(o.ref, true)}
                onPointerLeave={(e) => e.pointerType === "mouse" && point(o.ref, false)}
                onClick={() => o.press && press(o.press)}
                className={`${TILE} pointer-events-auto absolute left-0 top-0 ${
                  o.press ? "cursor-pointer" : "cursor-default"
                } ${pointed && pointed !== o.ref ? "border border-bone bg-ink text-bone" : "bg-bone text-ink"}`}
                style={{ width: MARK, height: MARK }}
              >
                {k + 1}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
