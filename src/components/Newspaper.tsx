"use client";

import type { ReactNode, Ref } from "react";

import IsoField from "@/lib/iso/IsoField";
import Clock from "@/components/Clock";
import SoundToggle from "@/components/SoundToggle";
import ThemeSwitch from "@/components/ThemeSwitch";
import { advance, HIT, LABEL } from "@/components/furniture";
import type { ArticleId } from "@/lib/stage/articles";
import { useOpenOnClick } from "@/lib/stage/click";

/**
 * Size text to span its container.
 *
 * Headlines are set in `cqw` against the nearest `.fit` ancestor, so one
 * component fills a 220px rail and a 900px well without per-word tuning (the
 * advance figures are in furniture.ts). `max` keeps the hierarchy: the
 * masthead outranks everything however short the word is.
 */
function fillSize(text: string, max: string, min = "1rem"): string {
  return `clamp(${min}, ${((0.92 * 100) / advance(text)).toFixed(1)}cqw, ${max})`;
}

/**
 * The projects' names, each a full description (Oct 29: "Custom Digital
 * Watch", not "Watch"), at one size across the tiles: the longest one spans
 * its tile, on one line, inside the tile's padding.
 */
const TITLES = {
  watch: "Custom Digital Watch",
  player: "Tiny Music Player",
  fractals: "Fractals",
} as const;
const TITLE_SIZE = `clamp(1.5rem, ${(86 / Math.max(...Object.values(TITLES).map(advance))).toFixed(2)}cqw, 4rem)`;

/** Body copy, in the text face — Instrument Serif is for titles only. */
const PROSE = "font-text-ui text-[1.125rem] leading-[1.6] text-bone";

/** A link inside prose: a dashed hairline under it, solid bone on hover. */
const INLINE =
  "underline decoration-dashed decoration-1 decoration-dim underline-offset-[0.22em] transition-colors hover:decoration-bone";

/**
 * The page's width. The margins either side are 17.25vw — 15% wider than the
 * 15vw they were (Oct 1), for a narrower, more newspaper-like column.
 */
const WELL = "clamp(320px, 65.5vw, 1310px)";

/** A column of a tier: stacks its articles, the last one taking any slack. */
const COLUMN = "flex min-w-0 flex-col";
const RULE_R = "md:border-r md:border-dashed md:border-rule";

/** A link inside prose; it opens in a new tab. */
function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={INLINE} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/**
 * Says the thing opens, on the label line, for readers with no hover to find
 * out with. The whole article is the link; this is only its sign.
 */
function OpenCue({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`whitespace-nowrap transition-colors ${className}`}>
      Open ↗
    </span>
  );
}

/**
 * One project's tile (Oct 27: every project the same): "Open ↗" set right,
 * its name, a line of copy, and its art at 4:3 across the foot, bleeding to
 * the rules.
 *
 * The art is an empty slot a document-level layer sits over (see Stage), and
 * the whole tile opens on a single click.
 */
function Article({
  title,
  dek,
  slot,
}: {
  title: string;
  dek?: ReactNode;
  slot: { id: ArticleId; ref: Ref<HTMLDivElement>; onOpen: () => void };
}) {
  const click = useOpenOnClick(slot.onOpen);
  return (
    <section
      data-article={slot.id}
      className="group fit relative flex cursor-pointer flex-col border-b border-dashed border-rule outline-none md:odd:border-r"
      role="link"
      tabIndex={0}
      aria-label={`Open ${title}`}
      {...click}
    >
      {/* Hover ring over the whole tile — words and art. A solid bone
          hairline that flickers on over the tile's dashed rules, bled 1px so
          it sits exactly on them. The art's layer sits above this section and
          takes the pointer there, so it mirrors its hover onto `data-hover`.
          Keyboard focus shows it too. */}
      <div
        aria-hidden
        className="ring-flicker pointer-events-none absolute -inset-x-px -top-px -bottom-px z-10 border border-bone"
      />
      <div className="px-4 pb-4 pt-4">
        <div className={`${LABEL} flex justify-end`}>
          <OpenCue className="group-hover:text-bone group-focus-visible:text-bone group-data-[hover]:text-bone" />
        </div>
        <h2
          data-headline={slot.id}
          className="font-serif-ui mt-1.5 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
          style={{ fontSize: TITLE_SIZE }}
        >
          {title}
        </h2>
        {dek && <p className="font-text-ui mt-3 max-w-[30rem] text-[0.95rem] leading-[1.5] text-dim">{dek}</p>}
      </div>
      {/* The art, the same 4:3 in every tile, set at the foot so a row's tiles end level. */}
      <div className="mt-auto border-t border-dashed border-rule">
        <div ref={slot.ref} data-slot={slot.id} className="aspect-[4/3] w-full" />
      </div>
    </section>
  );
}

/** The footer's links, set right; they open in a new tab. (The email left the page Oct 22.) */
const LINKS: readonly (readonly [string, string])[] = [
  ["LinkedIn", "https://www.linkedin.com/in/ay2609/"],
  ["GitHub", "https://github.com/ay2609"],
];

interface NewspaperProps {
  /** The <main> element, so the stage can recede it. */
  mainRef: Ref<HTMLElement>;
  /**
   * The empty boxes the articles appear to sit in. Each article's art is a
   * document-level layer positioned over its slot (see Stage), which is what
   * lets it fly to full screen without leaving the newspaper's flow.
   */
  slotRefs: Record<ArticleId, Ref<HTMLDivElement>>;
  /** Open an article. */
  onOpen: (id: ArticleId) => void;
}

/**
 * The front page as printed. Below the masthead, tiers whose wide column
 * swaps sides each time — the letter and the globe, then the work — so the
 * page zig-zags like a broadsheet. One column below 768px.
 */
export default function Newspaper({
  mainRef,
  slotRefs,
  onOpen,
}: NewspaperProps) {
  const openGlobe = useOpenOnClick(() => onOpen("globe"));
  return (
    <main
      ref={mainRef}
      className="mx-auto min-h-screen border-x border-rule"
      style={{ width: WELL }}
    >
      {/* 1 — Masthead */}
      <header
        data-push="up"
        className="fit border-b border-dashed border-rule px-4 pb-[18px] pt-[44px]"
      >
        {/* Above the name, whose glyphs overhang its box and would take the clicks. */}
        <div className={`${LABEL} relative z-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2`}>
          <SoundToggle />
          <ThemeSwitch />
          {/* Ticks aloud while hovered, with the sound on. */}
          <Clock className="text-bone" data-sfx="clock" />
        </div>
        <h1
          data-masthead
          className="font-serif-ui mt-3 whitespace-nowrap uppercase leading-[0.82] tracking-[-0.03em] text-bone"
          style={{ fontSize: fillSize("Avi Yadava", "18rem", "2.4rem") }}
        >
          Avi Yadava
        </h1>
      </header>

      {/* 2 — Lead left: the letter. Rail right: the globe as its figure. */}
      <div data-push="down" className="grid grid-cols-1 md:grid-cols-[17fr_10fr]">
        <section className={`${COLUMN} ${RULE_R} fit border-b border-dashed border-rule px-4 pb-10 pt-4`}>
          <h2
            className="font-serif-ui mt-2 leading-[0.9] tracking-[-0.02em] text-bone"
            style={{ fontSize: "clamp(2.5rem, 9cqw, 5rem)" }}
          >
            Hi, I&rsquo;m Avi.
          </h2>
          <div className={`${PROSE} mt-6 max-w-[36rem] space-y-4`}>
            <p>
              I&rsquo;m a student at the University of Maryland, studying computer science and robotics.
              I&rsquo;m most interested in embedded work, and in the places where software, hardware and
              design meet.
            </p>
            <p>
              I&rsquo;m the executive director of <A href="https://startupshell.org/">Startup Shell</A>, and
              I&rsquo;m building <A href="https://www.bymrobotics.org/">BYM</A> (Build Young Minds), a drone
              robotics education startup. I&rsquo;m also currently working as a robotics engineering intern
              for a UMD research lab.
              <span aria-hidden className="end-mark" />
            </p>
          </div>
        </section>

        {/* The globe's layer covers the square and takes the pointer (a click
            opens it); the box itself only takes keyboard focus. */}
        <figure className={`${COLUMN} border-b border-dashed border-rule`}>
          <div
            ref={slotRefs.globe}
            data-slot="globe"
            role="link"
            tabIndex={0}
            aria-label="Open the globe"
            onKeyDown={openGlobe.onKeyDown}
            className="aspect-square w-full outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-bone"
          />
          {/* The caption opens the globe too, as an article's headline does. */}
          <figcaption
            className="group flex-1 cursor-pointer border-t border-dashed border-rule px-4 pb-4 pt-3"
            onPointerDownCapture={openGlobe.onPointerDownCapture}
            onClick={openGlobe.onClick}
          >
            <div className={`${LABEL} flex justify-end`}>
              <OpenCue className="group-hover:text-bone" />
            </div>
          </figcaption>
        </figure>
      </div>

      {/* A seam between the letter and the work: a band of isovalues in the
          page's own tone (Oct 22; it was a strip of ASCII), the width of the
          page, with the hub violet printed under it off register as a second
          ink. The cursor still strums it with the sound on (SoundBoard). */}
      <div aria-hidden data-sfx="seam" className="h-[96px] overflow-hidden border-b border-dashed border-rule">
        <IsoField palette="ink" scale={1.6} second />
      </div>

      {/* 3 — The work: equal tiles, two across (one on phones), each the same
          anatomy — name, a line, its art at 4:3 — so a new
          project is one more tile. */}
      <div data-push="down" className="grid grid-cols-1 md:grid-cols-2">
        <Article
          title={TITLES.watch}
          dek={
            <>
              My freshman-year project: a smartwatch designed from nothing, the board in KiCad and the firmware
              in C. Open it to take it apart.
            </>
          }
          slot={{ id: "watch", ref: slotRefs.watch, onOpen: () => onOpen("watch") }}
        />
        <Article
          title={TITLES.fractals}
          dek={
            <>
              Live ports of the Python I wrote in high school, from the Mandelbrot set to chaotic attractors, in
              the colour maps I picked back then.
            </>
          }
          slot={{ id: "fractals", ref: slotRefs.fractals, onOpen: () => onOpen("fractals") }}
        />
        <Article
          title={TITLES.player}
          dek={
            <>
              What I&rsquo;m building now: a pocket player for lossless files and wired headphones, with a tiny
              screen for the album art. Open it to take the board apart.
            </>
          }
          slot={{ id: "player", ref: slotRefs.player, onOpen: () => onOpen("player") }}
        />
      </div>

      {/* 5 — The footer: a bar with the links, set right. */}
      <footer data-push="down" className="flex justify-end gap-7 border-b border-dashed border-rule px-4 py-4">
        {LINKS.map(([name, href]) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${HIT} font-mono-ui text-[10px] uppercase tracking-[0.18em] text-bone transition-colors hover:text-dim`}
          >
            {name}
          </a>
        ))}
      </footer>
    </main>
  );
}
