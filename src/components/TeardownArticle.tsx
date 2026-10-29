"use client";

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { advance, LABEL } from "@/components/furniture";
import { sfx } from "@/lib/sound/sfx";
import type { ArticleId } from "@/lib/stage/articles";
import { gsap, prefersReducedMotion, SplitText } from "@/lib/stage/motion";
import type { Callout, Device, Playing } from "@/lib/teardown/device";
import { type Anchor, type FrameInfo, TeardownEngine } from "@/lib/teardown/engine";

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
/** The longest label, in characters, that fits one of two columns under a phone-sized box. */
const TWO_UP_CHARS = 22;

/**
 * A callout that presses a button on the face: dashed underneath, like the
 * links in the prose. A border, not text-decoration, since the typing splits
 * the label into inline blocks that an underline skips.
 */
const PRESSABLE = "border-b border-dashed border-dim pb-px hover:border-bone";

function CalloutText({ o }: { o: Callout }) {
  return (
    <>
      <span className="text-bone">{o.ref}</span> — {o.text}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The box's headline size: up to the usual, but a long one no wider than
 * HEADLINE_SHARE of the box, so it clears the index; on a phone a long one
 * wraps at a smaller size.
 */
const HEADLINE_SHARE = 0.56;
function headlineSize(text: string): CSSProperties {
  const a = advance(text);
  return {
    "--wide": `min(clamp(2.25rem, 7cqw, 4.5rem), ${((HEADLINE_SHARE * 100) / a).toFixed(2)}cqw)`,
    "--compact": a > 7 ? "1.6rem" : "clamp(2.25rem, 7cqw, 4.5rem)",
  } as CSSProperties;
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

/**
 * A board as an article (the watch, the player): a teardown in chapters. On
 * the front page it is the turntable; once its stage has landed, each scroll
 * or swipe moves one chapter (see the device's chapters, e.g.
 * src/lib/watch/chapters.ts) and the furniture inside the box — headline,
 * index, labelled parts — follows along.
 *
 * Text is typed in when it changes and lines are drawn in; nothing inside the
 * box is shown while the article is flying between the page and the stage.
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
  const CHAPTERS = device.chapters;
  const LAST_CHAPTER = CHAPTERS.length - 1;
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TeardownEngine | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLOListElement>(null);
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
  /** What the screen is playing, if it plays (the player's last chapter). */
  const [now, setNow] = useState<Playing | null>(null);
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
    const bounds = {
      left: [below(headRef.current), H - INSET],
      right: [below(indexRef.current), H - INSET],
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
      if (e.defaultPrevented) return; // Space over the docked globe pauses it instead
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
  }, [calloutsOn, chapter, compact, layout, type, CHAPTERS]);

  const c = CHAPTERS[chapter];
  /** A long list goes in two columns under a small box, when every label fits half its width. */
  const twoUp = c.callouts.length > 4 && c.callouts.every((o) => o.ref.length + 3 + o.text.length <= TWO_UP_CHARS);
  const go = (k: number) => engineRef.current?.go(k);
  const pressLabel = (o: Callout) => o.press && engineRef.current?.press(o.press);
  const press = (button: string) => engineRef.current?.press(button);

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
            {/* The newspaper's headline flies here when the article opens (see Stage). */}
            {/* One line, kept clear of the index; a long one (the article's
                name) sets smaller to fit. On a phone, beside the index above
                the box, a long one wraps instead (Stage's copy wraps with it). */}
            <h3
              data-typed
              data-flies
              data-stage-headline={id}
              className="font-serif-ui whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone [font-size:var(--wide)] [text-wrap:balance] @max-[560px]:max-w-[calc(100cqw-148px)] @max-[560px]:whitespace-normal @max-[560px]:[font-size:var(--compact)]"
              style={headlineSize(c.headline)}
            >
              {c.headline}
            </h3>
          </div>
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
                    {pad(k)} {ch.index ?? ch.headline}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {/* The player's island: centred at the foot of the box, or under it on a phone. */}
        {visible && c.display && now && (
          <div className="absolute bottom-5 left-1/2 w-[min(28rem,calc(100%-32px))] -translate-x-1/2 @max-[560px]:bottom-auto @max-[560px]:top-[calc(100%+16px)]">
            <Island now={now} onPress={press} />
          </div>
        )}

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

        {/* Labels: on the leaders beside the board, or, in a box too small for
            leaders (a phone), listed under it. A label that presses a button
            on the face is underlined like a link. */}
        <div ref={calloutsRef} className="absolute inset-0">
          {calloutsOn &&
            !compact &&
            c.callouts.map((o) => {
              const body = <CalloutText o={o} />;
              return o.press ? (
                <button
                  key={`${c.id}-${o.ref}`}
                  type="button"
                  data-callout={o.ref}
                  data-side={o.side}
                  data-typed
                  onClick={() => pressLabel(o)}
                  className={`${LABEL} ${PRESSABLE} pointer-events-auto absolute left-0 top-0 cursor-pointer whitespace-nowrap uppercase transition-colors hover:text-bone`}
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
          {calloutsOn && compact && c.callouts.length > 0 && (
            <ul
              className={`${LABEL} absolute left-4 right-4 top-[calc(100%+16px)] ${
                twoUp ? "columns-2 gap-x-3 whitespace-nowrap" : ""
              }`}
            >
              {c.callouts.map((o) => (
                <li key={`${c.id}-${o.ref}`} className="mb-1 break-inside-avoid">
                  {o.press ? (
                    <button
                      type="button"
                      data-typed
                      onClick={() => pressLabel(o)}
                      className={`${PRESSABLE} pointer-events-auto cursor-pointer uppercase tracking-[0.18em] transition-colors hover:text-bone`}
                    >
                      <CalloutText o={o} />
                    </button>
                  ) : (
                    <span data-typed>
                      <CalloutText o={o} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
