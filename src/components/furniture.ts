/** The mono label style used for every piece of furniture on the page. */
export const LABEL =
  "font-mono-ui text-[10px] uppercase tracking-[0.18em] text-dim";

/**
 * A hit area 44px tall around a line of 10px furniture, drawn by an empty
 * ::after so the type and the layout stay as they are. Phones need it.
 */
export const HIT =
  "relative after:absolute after:-inset-x-2 after:-inset-y-[15px] after:content-['']";
