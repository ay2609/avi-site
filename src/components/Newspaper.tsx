"use client";

import type { ReactNode, Ref } from "react";

import AsciiPanel from "@/lib/ascii/AsciiPanel";
import Clock from "@/components/Clock";
import { LABEL } from "@/components/furniture";
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
 * A headline set to span its box, a line of copy, and art that bleeds to the
 * edges. Every article grows to fill its column, so a tier's two columns end
 * level; the slack goes around the art.
 *
 * The art is an empty slot a document-level layer sits over (see Stage),
 * centred in whatever height the column gives it, and the whole article opens
 * on a single click.
 */
function Article({
  label,
  title,
  max = "4.5rem",
  dek,
  ratio,
  slot,
}: {
  label: string;
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
          hairline that fades in over the section's dashed rules, bled 1px so
          it sits exactly on them. The art's layer sits above this section and
          takes the pointer there, so it mirrors its hover onto `data-hover`.
          Keyboard focus shows it too. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-px -top-px -bottom-px z-10 border border-bone opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[hover]:opacity-100"
      />
      <div className="px-4 pb-3 pt-4">
        <div className={LABEL}>{label}</div>
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
function Placeholder({ field, ratio }: { field: AsciiFieldId; ratio: string }) {
  return (
    <div aria-hidden className={`${ratio} w-full flex-1 overflow-hidden border-b border-dashed border-rule`}>
      <AsciiPanel field={field} />
    </div>
  );
}

/**
 * The address is on the domain (Cloudflare Email Routing forwards it, Sep 29);
 * `null` hides the serif line. Links open in a new tab. No phone.
 */
const CONTACT: { email: string | null; links: readonly (readonly [string, string])[] } = {
  email: "avi@halcyn.dev",
  links: [
    ["LinkedIn", "https://www.linkedin.com/in/ay2609/"],
    ["GitHub", "https://github.com/ay2609"],
  ],
};

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
        <div className={`${LABEL} flex justify-end`}>
          <Clock className="text-bone" />
        </div>
        <h1
          className="font-serif-ui mt-3 whitespace-nowrap uppercase leading-[0.82] tracking-[-0.03em] text-bone"
          style={{ fontSize: fillSize("Avi Yadava", "18rem", "2.4rem") }}
        >
          Avi Yadava
        </h1>
      </header>

      {/* 2 — Lead left: the letter. Rail right: the globe as its figure —
          still alive, still the switch for the lights. */}
      <div data-push="down" className="grid grid-cols-1 md:grid-cols-[17fr_10fr]">
        <section className={`${COLUMN} ${RULE_R} fit border-b border-dashed border-rule px-4 pb-10 pt-4`}>
          <p className={LABEL}>/About</p>
          <h2
            className="font-serif-ui mt-1.5 leading-[0.9] tracking-[-0.02em] text-bone"
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
              robotics education startup.
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
          <figcaption className="flex-1 border-t border-dashed border-rule px-4 pb-4 pt-3">
            <span className={LABEL}>Fig. 1</span>
            <p className="font-text-ui mt-1 text-[0.95rem] italic leading-[1.5] text-dim">
              The world, give or take. Scroll over it to bend the view; bend it past halfway and the
              page turns to paper.
            </p>
          </figcaption>
        </figure>
      </div>

      {/* A seam between the letter and the work: a strip of ASCII three
          characters tall (10px / 1.15 → 34.5px), the width of the page. */}
      <div aria-hidden className="h-[34.5px] overflow-hidden border-b border-dashed border-rule">
        <AsciiPanel field="seam" minRows={3} />
      </div>

      {/* 3 — The work. Rail left: the watch and a spot held open. Lead
          right: the fractals, big. On phones the lead comes first. */}
      <div data-push="down" className={`grid grid-cols-1 ${WORK_COLS}`}>
        <div className={`${COLUMN} md:order-2`}>
          <Article
            label="/Project — Python / NumPy"
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
        <div className={`${COLUMN} ${RULE_R} md:order-1`}>
          <Article
            label="/Project — ESP32 / KiCad"
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
          <Placeholder field="lattice" ratio="aspect-[4/3]" />
        </div>
      </div>

      {/* 4 — Two more spots held open, the wide one on the left again. */}
      <div data-push="down" className="grid grid-cols-1 md:grid-cols-[17fr_10fr]">
        <div className={`${COLUMN} ${RULE_R}`}>
          <Placeholder field="flow" ratio="aspect-[2/1]" />
        </div>
        <div className={COLUMN}>
          <Placeholder field="ripple" ratio="aspect-[4/3]" />
        </div>
      </div>

      {/* 5 — Contact */}
      <section
        data-push="down"
        className="flex flex-wrap items-end justify-between gap-6 border-b border-dashed border-rule px-4 pb-9 pt-4"
      >
        <div>
          <p className={LABEL}>/Contact</p>
          <p className={`${PROSE} mt-8 text-dim`}>If you&rsquo;d like to say hi, write to</p>
          {CONTACT.email && (
            <a
              href={`mailto:${CONTACT.email}`}
              className="font-serif-ui mt-1 block tracking-[-0.015em] text-bone transition-colors hover:text-dim"
              style={{ fontSize: "clamp(28px, 4.5vw, 56px)" }}
            >
              {CONTACT.email}
            </a>
          )}
        </div>
        <nav className="flex flex-wrap gap-7">
          {CONTACT.links.map(([name, href]) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-bone transition-colors hover:text-dim"
            >
              {name}
            </a>
          ))}
        </nav>
      </section>
    </main>
  );
}
