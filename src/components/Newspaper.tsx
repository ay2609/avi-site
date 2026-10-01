"use client";

import type { ReactNode, Ref } from "react";

import AsciiPanel from "@/lib/ascii/AsciiPanel";
import Clock from "@/components/Clock";
import { LABEL } from "@/components/furniture";
import type { ArticleId } from "@/lib/stage/articles";
import { useOpenOnClick } from "@/lib/stage/click";
import type { Variant } from "@/lib/stage/motion";

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

/**
 * A headline set to span its box, above art that bleeds to the edges.
 * With `slot`, the art area is an empty box a document-level layer sits
 * over (see Stage), and the whole article opens on a single click — the
 * headline and label here, the art through its layer.
 */
function Article({
  label,
  title,
  ratio,
  children,
  slot,
}: {
  label: string;
  title: string;
  ratio: string;
  children?: ReactNode;
  slot?: { id: ArticleId; ref: Ref<HTMLDivElement>; onOpen: () => void };
}) {
  const click = useOpenOnClick(slot?.onOpen);
  return (
    <section
      data-article={slot?.id}
      className={`group fit relative border-b border-dashed border-rule ${slot ? "cursor-pointer outline-none" : ""}`}
      {...(slot && { role: "link", tabIndex: 0, "aria-label": `Open ${title}`, ...click })}
    >
      {slot && (
        /* Hover ring over the whole article — headline and art. A solid bone
           hairline that fades in over the section's dashed rules, bled 1px so
           it sits exactly on them. The art's layer sits above this section and
           takes the pointer there, so it mirrors its hover onto `data-hover`.
           Keyboard focus shows it too. */
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-px -top-px -bottom-px z-10 border border-bone opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[hover]:opacity-100"
        />
      )}
      <div className="px-4 pb-2 pt-4">
        <div className={LABEL}>{label}</div>
        <h2
          data-headline={slot?.id}
          className="font-serif-ui mt-1.5 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
          style={{ fontSize: fillSize(title, "4.5rem") }}
        >
          {title}
        </h2>
      </div>
      {slot ? (
        <div ref={slot.ref} data-slot={slot.id} className={`${ratio} w-full`} />
      ) : (
        <div className={`${ratio} w-full overflow-hidden`}>{children}</div>
      )}
    </section>
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
  /** Which transition variant is active (prototype). */
  fx: Variant;
  onToggleFx: () => void;
}

/** The front page as printed: the newspaper, minus the globe. */
export default function Newspaper({
  mainRef,
  slotRefs,
  onOpen,
  fx,
  onToggleFx,
}: NewspaperProps) {
  const openGlobe = useOpenOnClick(() => onOpen("globe"));
  return (
    <main
      ref={mainRef}
      className="mx-auto min-h-screen border-x border-rule"
      style={{ width: "clamp(320px, 70vw, 1400px)" }}
    >
      {/* 1 — Masthead */}
      <header
        data-push="up"
        className="fit border-b border-dashed border-rule px-4 pb-[18px] pt-[44px]"
      >
        <div className={`${LABEL} flex items-baseline justify-between gap-4`}>
          <span>Vol. I · No. 001</span>
          <Clock className="text-bone" />
        </div>
        <h1
          className="font-serif-ui mt-3 whitespace-nowrap uppercase leading-[0.82] tracking-[-0.03em] text-bone"
          style={{ fontSize: fillSize("Avi Yadava", "18rem", "2.4rem") }}
        >
          Avi Yadava
        </h1>
      </header>

      {/* 2 — The well. A fixed 17:10 split so every section keeps its
          proportion at any width; one column only on small screens. */}
      <div className="grid grid-cols-1 md:grid-cols-[17fr_10fr]">
        {/* Lead */}
        <section className="flex min-w-0 flex-col border-b border-dashed border-rule md:border-r">
          {/* The globe's layer covers this box and takes the pointer (a
              click opens it); the box itself only takes keyboard focus. */}
          <div
            ref={slotRefs.globe}
            data-slot="globe"
            role="link"
            tabIndex={0}
            aria-label="Open the globe"
            onKeyDown={openGlobe.onKeyDown}
            className="aspect-square w-full outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-bone"
          />
          <div
            data-push="down"
            className={`${LABEL} flex flex-wrap items-baseline justify-between gap-4 border-t border-dashed border-rule px-4 py-3`}
          >
            <span>Fig. 1 — An interactive globe, built to be wandered.</span>
            <span>Labels mark the work</span>
          </div>
          {/* Absorbs the height difference so the lead ends level with the
              rail — now carrying two panels rather than a striped blank. The
              min-height keeps them legible if the slack ever runs short. */}
          <div
            data-push="down"
            className="flex min-h-[180px] flex-1 border-t border-dashed border-rule"
          >
            <div className="flex-1 overflow-hidden border-r border-dashed border-rule">
              <AsciiPanel field="ripple" />
            </div>
            <div className="flex-1 overflow-hidden">
              <AsciiPanel field="lattice" />
            </div>
          </div>
        </section>

        {/* Rail */}
        <div data-push="right" className="flex min-w-0 flex-col">
          <Article
            label="/Project — ESP32 / KiCad"
            title="Watch"
            ratio="aspect-[4/3]"
            slot={{ id: "watch", ref: slotRefs.watch, onOpen: () => onOpen("watch") }}
          />

          <Article
            label="/Project — Python / NumPy"
            title="Fractals"
            ratio="aspect-square"
            slot={{ id: "fractals", ref: slotRefs.fractals, onOpen: () => onOpen("fractals") }}
          />

          <Article label="/Advected" title="Drift" ratio="aspect-[4/3]">
            <AsciiPanel field="flow" />
          </Article>
        </div>
      </div>

      {/* 3 — Contact */}
      <section
        data-push="down"
        className="flex flex-wrap items-end justify-between gap-6 border-b border-dashed border-rule px-4 pb-9 pt-8"
      >
        <div>
          <p className={LABEL}>/Contact</p>
          {CONTACT.email && (
            <a
              href={`mailto:${CONTACT.email}`}
              className="font-serif-ui mt-2 block tracking-[-0.015em] text-bone transition-colors hover:text-dim"
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

      {/* 4 — Footer */}
      <footer
        data-push="down"
        className={`${LABEL} flex items-center justify-between gap-4 px-4 py-[18px]`}
      >
        <span>Avi Yadava</span>
        {/* Prototype switch — compare the two transition variants. */}
        <button
          type="button"
          onClick={onToggleFx}
          className="cursor-pointer uppercase transition-colors hover:text-bone"
        >
          FX — <span className={fx === "iris" ? "text-bone" : ""}>Iris</span> /{" "}
          <span className={fx === "rule" ? "text-bone" : ""}>Rule cut</span>
        </button>
        <Clock format="date" />
      </footer>
    </main>
  );
}
