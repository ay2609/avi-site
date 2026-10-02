/**
 * The site's mark: "AY" in the watch's own font — ProFontWindows at 17 px,
 * the BDF the sovereign firmware draws its face with (font/MPFW12_C.bdf) —
 * set the way the watch's screen would show it, light pixels on a dark ground.
 *
 * A is 8 × 10 and Y 7 × 10; with a pixel between them the pair is exactly 16
 * wide, so at 16 px the icon is the font one-to-one. The letters sit on rows
 * 3–12, centred; rows 14–15 are the sound meter's when it's on (see LiveIcon).
 *
 * The alternative tab icon (`?icon=mark`); the globe is the default (LiveIcon).
 */

export const GRID = 16;

/** Each glyph as written in the BDF, "#" for a lit pixel. */
const A = [
  "...##...",
  "..####..",
  "..#..#..",
  ".##..##.",
  "##....##",
  "#......#",
  "########",
  "#......#",
  "#......#",
  "#......#",
];

const Y = [
  "#.....#",
  "#.....#",
  "#.....#",
  "#.....#",
  ".#...#.",
  "..###..",
  "...#...",
  "...#...",
  "...#...",
  "...#...",
];

/** Top row of the letters on the 16 × 16 grid. */
export const MARK_TOP = 3;

/** The mark's lit pixels on the 16 × 16 grid, as [x, y]. */
export const MARK: [number, number][] = [
  ...A.flatMap((row, y) => [...row].flatMap((c, x) => (c === "#" ? [[x, y + MARK_TOP] as [number, number]] : []))),
  ...Y.flatMap((row, y) => [...row].flatMap((c, x) => (c === "#" ? [[x + 9, y + MARK_TOP] as [number, number]] : []))),
];
