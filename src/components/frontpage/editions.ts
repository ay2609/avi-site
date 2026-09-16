/**
 * The two editions differ only in typographic voice — the layout skeleton is
 * held constant so the comparison is actually about the type.
 *
 * A: classic broadsheet. High-contrast serif masthead and headlines, humanist
 *    sans for body copy, mono reserved for metadata.
 * B: condensed grotesque. Tight uppercase condensed for masthead and heads,
 *    mono carrying far more of the page — labels, captions and furniture.
 */
export interface Edition {
  id: "a" | "b";
  name: string;
  /** Shown in the footer so it's obvious which one you're looking at. */
  colophon: string;

  masthead: string;
  mastheadRule: string;
  tagline: string;
  kicker: string;
  headline: string;
  deck: string;
  sectionHead: string;
  label: string;
  body: string;
  caption: string;
}

export const EDITION_A: Edition = {
  id: "a",
  name: "Edition A — Broadsheet",
  colophon: "Set in Playfair Display and Inter",

  masthead:
    "font-display text-[clamp(2.75rem,9vw,7.5rem)] font-black leading-[0.86] tracking-[-0.02em] text-paper",
  mastheadRule: "border-rule-strong",
  tagline:
    "font-mono-ui text-[10px] uppercase tracking-[0.42em] text-paper-faint",
  kicker:
    "font-mono-ui text-[10px] uppercase tracking-[0.3em] text-accent",
  headline:
    "font-display text-[clamp(1.75rem,3.4vw,3.15rem)] font-bold leading-[1.04] tracking-[-0.015em] text-paper",
  deck:
    "font-sans-ui text-[15px] leading-[1.5] text-paper-dim",
  sectionHead:
    "font-display text-[15px] font-bold uppercase tracking-[0.16em] text-paper",
  label:
    "font-mono-ui text-[9px] uppercase tracking-[0.26em] text-paper-faint",
  body:
    "font-sans-ui text-[13.5px] leading-[1.62] text-paper-dim",
  caption:
    "font-sans-ui text-[11px] italic leading-[1.45] text-paper-faint",
};

export const EDITION_B: Edition = {
  id: "b",
  name: "Edition B — Condensed",
  colophon: "Set in Barlow Condensed and JetBrains Mono",

  masthead:
    "font-condensed text-[clamp(3rem,10.5vw,9rem)] font-bold uppercase leading-[0.82] tracking-[-0.03em] text-paper",
  mastheadRule: "border-paper",
  tagline:
    "font-mono-ui text-[10px] uppercase tracking-[0.3em] text-paper-dim",
  kicker:
    "font-mono-ui text-[10px] uppercase tracking-[0.2em] text-accent",
  headline:
    "font-condensed text-[clamp(2rem,4.2vw,3.9rem)] font-bold uppercase leading-[0.94] tracking-[-0.01em] text-paper",
  deck:
    "font-mono-ui text-[12.5px] leading-[1.62] text-paper-dim",
  sectionHead:
    "font-condensed text-[17px] font-semibold uppercase tracking-[0.1em] text-paper",
  label:
    "font-mono-ui text-[9px] uppercase tracking-[0.2em] text-paper-faint",
  body:
    "font-sans-ui text-[13px] leading-[1.66] text-paper-dim",
  caption:
    "font-mono-ui text-[10px] leading-[1.5] text-paper-faint",
};
