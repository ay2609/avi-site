"use client";

import type { CSSProperties, ReactNode, Ref } from "react";

import AsciiPanel from "@/lib/ascii/AsciiPanel";
import WireframeCanvas from "@/lib/three/WireframeCanvas";
import Clock from "@/components/Clock";
import { LABEL } from "@/components/furniture";
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

/** A headline set to span its box, above art that bleeds to the edges. */
function Article({
  label,
  title,
  ratio,
  children,
}: {
  label: string;
  title: string;
  ratio: string;
  children: ReactNode;
}) {
  return (
    <section className="fit border-b border-dashed border-rule">
      <div className="px-4 pb-2 pt-4">
        <p className={LABEL}>{label}</p>
        <h2
          className="font-serif-ui mt-1.5 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone"
          style={{ fontSize: fillSize(title, "4.5rem") }}
        >
          {title}
        </h2>
      </div>
      <div className={`${ratio} w-full overflow-hidden`}>{children}</div>
    </section>
  );
}

const TICKER_PHRASE = "Complacency is a sin";
const TICKER_SECONDS = 45;

/** One pass of the ticker; the strip renders two of these back to back. */
function TickerRun() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="px-7">
          {TICKER_PHRASE.toUpperCase()}
          <span className="ml-14 text-dim">◆</span>
        </span>
      ))}
    </>
  );
}

const WORK = [
  ["01", "Globe", "Three.js · 2026"],
  ["02", "Fractals", "GLSL · 2025"],
  ["03", "Watch", "ESP32 / KiCad · 2025"],
  ["04", "Body", "Lambert · 2024"],
];

const ARCHIVE = [
  ["012", "Globe", "26.09"],
  ["011", "Watch", "26.04"],
  ["010", "Drift", "25.11"],
  ["009", "Relief", "25.08"],
  ["008", "Lattice", "25.05"],
  ["007", "Scan", "25.02"],
  ["006", "Weave", "24.10"],
];

const SOCIALS = ["Instagram", "Are.na", "Github"];

interface NewspaperProps {
  /** The <main> element, so the stage can recede it. */
  mainRef: Ref<HTMLElement>;
  /**
   * The empty square the globe appears to sit in. The globe itself is a
   * document-level layer positioned over this slot (see GlobeLayer), which is
   * what lets it fly to full screen without leaving the newspaper's flow.
   */
  slotRef: Ref<HTMLDivElement>;
  /** Open the lead article. */
  onOpenGlobe: () => void;
  /** Which transition variant is active (prototype). */
  fx: Variant;
  onToggleFx: () => void;
}

/** The front page as printed: the newspaper, minus the globe. */
export default function Newspaper({
  mainRef,
  slotRef,
  onOpenGlobe,
  fx,
  onToggleFx,
}: NewspaperProps) {
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

      {/* 2 — Ticker */}
      <div
        data-push="up"
        className="flex h-[30px] items-center overflow-hidden border-b border-dashed border-rule"
      >
        <div
          className="ticker-strip font-mono-ui flex w-max whitespace-nowrap text-[10px] leading-none tracking-[0.18em]"
          style={{ "--ticker-speed": `${TICKER_SECONDS}s` } as CSSProperties}
        >
          <TickerRun />
          <TickerRun />
        </div>
      </div>

      {/* 3 — The well */}
      <div className="flex flex-wrap">
        {/* Lead */}
        <section className="flex flex-[17_1_380px] flex-col border-b border-r border-dashed border-rule">
          <div
            data-push="up"
            className={`${LABEL} flex items-baseline justify-end gap-4 px-4 pb-3 pt-4`}
          >
            <button
              type="button"
              onClick={onOpenGlobe}
              className="cursor-pointer uppercase text-bone transition-colors hover:text-dim"
            >
              Open — /globe ↗
            </button>
          </div>
          <div
            ref={slotRef}
            data-globe-slot
            className="aspect-square w-full border-t border-dashed border-rule"
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
        <div data-push="right" className="flex flex-[10_1_220px] flex-col">
          <Article label="/Project — ESP32 / KiCad" title="Watch" ratio="aspect-[4/3]">
            {/* The watch's PCB, traced from the KiCad STEP export (see
                scripts/step-to-wireframe.py), on a turntable. */}
            <WireframeCanvas src="/watch-esp.bin" />
          </Article>

          <Article label="/Project — 2025" title="Fractals" ratio="aspect-square">
            <div className="hatch relative h-full w-full">
              <span className={`${LABEL} absolute bottom-3 left-4`}>
                Project still — 1:1
              </span>
            </div>
          </Article>

          <Article label="/Advected" title="Drift" ratio="aspect-[4/3]">
            <AsciiPanel field="flow" />
          </Article>
        </div>
      </div>

      {/* 4 — Work + Archive */}
      <div data-push="down" className="flex flex-wrap border-b border-dashed border-rule">
        <section className="flex-[17_1_380px] border-r border-dashed border-rule px-4 pb-7 pt-4">
          <p className={LABEL}>/Selected work (04)</p>
          <ul className="mt-4">
            {WORK.map(([index, title, meta], i) => (
              <li
                key={index}
                className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-4 border-t border-dashed border-rule py-4 text-bone transition-colors hover:text-dim ${
                  i === WORK.length - 1 ? "border-b" : ""
                }`}
              >
                <span className="font-mono-ui text-[11px] text-dim">{index}</span>
                <span
                  className="font-serif-ui tracking-[-0.02em]"
                  style={{ fontSize: "clamp(28px, 4vw, 56px)" }}
                >
                  {title}
                </span>
                <span className={LABEL}>{meta}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex-[10_1_220px] px-4 pb-7 pt-4">
          <p className={LABEL}>/Archive (12)</p>
          <ul className="mt-4">
            {ARCHIVE.map(([index, title, date]) => (
              <li
                key={index}
                className="font-mono-ui grid grid-cols-[34px_1fr_auto] items-baseline gap-[10px] border-t border-dashed border-rule py-[9px] text-[11px]"
              >
                <span className="text-dim">{index}</span>
                <span className="text-bone">{title}</span>
                <span className="text-dim">{date}</span>
              </li>
            ))}
          </ul>
          <p className={`${LABEL} mt-[18px]`}>Full index →</p>
        </section>
      </div>

      {/* 5 — Contact */}
      <section
        data-push="down"
        className="flex flex-wrap items-end justify-between gap-6 border-b border-dashed border-rule px-4 pb-9 pt-8"
      >
        <div>
          <p className={LABEL}>/Contact</p>
          <a
            href="mailto:hello@aviyadava.com"
            className="font-serif-ui mt-2 block tracking-[-0.015em] text-bone transition-colors hover:text-dim"
            style={{ fontSize: "clamp(28px, 4.5vw, 56px)" }}
          >
            hello@aviyadava.com
          </a>
        </div>
        <nav className="flex flex-wrap gap-7">
          {SOCIALS.map((name) => (
            <a
              key={name}
              href="#"
              className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-bone transition-colors hover:text-dim"
            >
              {name}
            </a>
          ))}
        </nav>
      </section>

      {/* 6 — Footer */}
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
