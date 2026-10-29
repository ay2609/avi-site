/** The mono label style used for every piece of furniture on the page. */
export const LABEL =
  "font-mono-ui text-[10px] uppercase tracking-[0.18em] text-dim";

/**
 * How wide a line of Instrument Serif capitals is, in em, at the tracking the
 * headlines use — most caps sit near 0.6em, with W and M much wider and I much
 * narrower. Sizes text in `cqw` to fit its container without per-word tuning.
 */
const ADVANCE: Record<string, number> = {
  " ": 0.26,
  I: 0.3,
  J: 0.45,
  L: 0.52,
  M: 0.85,
  W: 0.9,
};

export function advance(text: string): number {
  return [...text.toUpperCase()].reduce((sum, ch) => sum + (ADVANCE[ch] ?? 0.6), 0);
}

/**
 * A hit area 44px tall around a line of 10px furniture, drawn by an empty
 * ::after so the type and the layout stay as they are. Phones need it.
 */
export const HIT =
  "relative after:absolute after:-inset-x-2 after:-inset-y-[15px] after:content-['']";
