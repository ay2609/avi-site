"use client";

import type { ReactNode, Ref } from "react";

import AsciiPanel from "@/lib/ascii/AsciiPanel";
import Clock from "@/components/Clock";
import SoundToggle from "@/components/SoundToggle";
import ThemeSwitch from "@/components/ThemeSwitch";
import { HIT, LABEL } from "@/components/furniture";
import type { AsciiFieldId } from "@/lib/ascii/fields";
import type { ArticleId } from "@/lib/stage/articles";
import { useOpenOnClick } from "@/lib/stage/click";

/**
 * Size text to span its container.
 *
 * Headlines are set in `cqw` against the nearest `.fit` ancestor, so one
 * component fills a 220px rail and a 900px well without per-word tuning.
 * The advance figures are for Instrument Serif capitals at the tracking used
 * below — most caps sit near 0.6em, with W and M much wider and I much
 * narrower. `max` keeps the hierarchy: the masthead outranks everything
 * however short the word is.
 */
const ADVANCE: Record<string, number> = {
  " ": 0.26,
  I: 0.3,
  J: 0.45,
  L: 0.52,
  M: 0.85,
  W: 0.9,
};

function fillSize(text: string, max: string, min = "1rem"): string {
  const advance = [...text.toUpperCase()].reduce(
    (sum, ch) => sum + (ADVANCE[ch] ?? 0.6),
    0
  );
  return `clamp(${min}, ${((0.92 * 100) / advance).toFixed(1)}cqw, ${max})`;
}

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

/**
 * The watch's rail keeps the width it had at the old 70vw page (10/27 of it),
 * so the board stays the same size; the fractals take what's left.
 */
const WORK_COLS = "md:grid-cols-[calc(clamp(320px,70vw,1400px)*10/27)_minmax(0,1fr)]";

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
 * A headline set to span its box, a line of copy, and art that bleeds to the
 * edges. Every article grows to fill its column, so a tier's two columns end
 * level; the slack goes around the art.
 *
 * The art is an empty slot a document-level layer sits over (see Stage),
 * centred in whatever height the column gives it, and the whole article opens
 * on a single click.
 */
function Article({
  title,
  max = "4.5rem",
  dek,
  ratio,
  slot,
}: {
  title: string;
  /** The headline's ceiling: a lead outranks the rail. */
  max?: string;
  dek?: ReactNode;
  ratio: string;
  slot: { id: ArticleId; ref: Ref<HTMLDivElement>; onOpen: () => void };
}) {
  const click = useOpenOnClick(slot.onOpen);
  return (
    <section
      data-article={slot.id}
      className="group fit relative flex flex-1 cursor-pointer flex-col border-b border-dashed border-rule outline-none"
      role="link"
      tabIndex={0}
      aria-label={`Open ${title}`}
      {...click}
    >
      {/* Hover ring over the whole article — headline and art. A solid bone
          hairline that flickers on over the section's dashed rules, bled 1px so
          it sits exactly on them. The art's layer sits above this section and
          takes the pointer there, so it mirrors its hover onto `data-hover`.
          Keyboard focus shows it too. */}
      <div
        aria-hidden
        className="ring-flicker pointer-events-none absolute -inset-x-px -top-px -bottom-px z-10 border border-bone"
      />
      <div className="px-4 pb-3 pt-4">
        <div className={`${LABEL} flex justify-end`}>
          <OpenCue className="group-hover:text-bone group-focus-visible:text-bone group-data-[hover]:text-bone" />
        </div>
        <h2
          data-headline={slot.id}
          className="font-serif-ui mt-1.5 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
          style={{ fontSize: fillSize(title, max) }}
        >
          {title}
        </h2>
        {dek && <p className="font-text-ui mt-3 max-w-[30rem] text-[0.95rem] leading-[1.5] text-dim">{dek}</p>}
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <div ref={slot.ref} data-slot={slot.id} className={`${ratio} w-full`} />
      </div>
    </section>
  );
}

/**
 * A spot held for work still to be picked: nothing but ASCII, at least
 * `ratio` tall and growing to level its tier.
 */
function Placeholder({ field, ratio, className = "" }: { field: AsciiFieldId; ratio: string; className?: string }) {
  return (
    <div aria-hidden className={`${ratio} w-full flex-1 overflow-hidden border-b border-dashed border-rule ${className}`}>
      <AsciiPanel field={field} />
    </div>
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
            <p className="font-text-ui mt-1 text-[0.95rem] italic leading-[1.5] text-dim">
              The world, give or take. Open it and scroll to bend the view; bend it past halfway and
              the page turns to paper.
            </p>
          </figcaption>
        </figure>
      </div>

      {/* A seam between the letter and the work: a strip of ASCII three
          characters tall (10px / 1.15 → 34.5px), the width of the page. The
          cursor sets it rippling (SoundBoard). */}
      <div aria-hidden data-sfx="seam" className="h-[34.5px] overflow-hidden border-b border-dashed border-rule">
        <AsciiPanel field="seam" minRows={3} />
      </div>

      {/* 3 — The work. Rail left: the watch, and a spot held open beside the
          fractals, which run long. Lead right: the fractals, big. One column
          on phones, in the same order as on the desktop and the Tab key. */}
      <div data-push="down" className={`grid grid-cols-1 ${WORK_COLS}`}>
        <div className={`${COLUMN} ${RULE_R}`}>
          <Article
            title="Watch"
            dek={
              <>
                My freshman-year project: a smartwatch designed from nothing, the board in KiCad and the
                firmware in C. Open it to take it apart.
              </>
            }
            ratio="aspect-[4/3]"
            slot={{ id: "watch", ref: slotRefs.watch, onOpen: () => onOpen("watch") }}
          />
          <Placeholder field="lattice" ratio="aspect-[4/3]" className="max-md:hidden" />
        </div>
        <div className={COLUMN}>
          <Article
            title="Fractals"
            max="8rem"
            dek={
              <>
                Live ports of the Python I wrote in high school, from the Mandelbrot set to chaotic
                attractors, in the colour maps I picked back then.
              </>
            }
            ratio="aspect-square"
            slot={{ id: "fractals", ref: slotRefs.fractals, onOpen: () => onOpen("fractals") }}
          />
        </div>
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
