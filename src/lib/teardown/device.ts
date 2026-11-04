/**
 * What a teardown walks through: a board baked by scripts/glb-to-parts.py,
 * its chapters, and its screen. The watch (src/lib/watch) and the player
 * (src/lib/player) are each one of these, drawn by the same engine and
 * article (engine.ts, components/TeardownArticle).
 *
 * Parts are named by reference designator; `sheets` pulls in every part drawn
 * on those schematic sheets (see the parts table in the board's .bin).
 * Angles are degrees. A chapter's `story` and its key are what a reader reads:
 * plain words first, part numbers beside them for those who want them.
 */

import type { ArticleId } from "@/lib/stage/articles";

/** One line of a chapter's key, numbered in the order of its story and on the board. */
export interface Callout {
  /** A reference designator, or the display module's `ref`. */
  ref: string;
  /** What it is, in plain words. */
  name: string;
  /** Its part number or value, set small beside the name. */
  part?: string;
  /** A line that presses that button on the screen (the watch's face). */
  press?: string;
}

export interface ChapterView {
  /** Turntable angle; "spin" keeps the front-page turntable turning. */
  yaw: number | "spin";
  pitch: number;
  /** Rotation in the board's own plane; "diagonal" stands the board's diagonal upright. */
  roll: number | "diagonal";
  zoom: number;
  /**
   * The camera's height over the turntable, applied outside the yaw: with pitch −90 (the subject
   * upright) yaw turns it about its own up and this looks down on it (or up, negative). Default 0.
   */
  elevation?: number;
  /** Where the camera looks, in model space; default: the lifted parts' centre. */
  look?: [number, number, number];
  /** Shifts the subject within the box, in fractions of the box (x right, y up). */
  shift?: [number, number];
}

export interface Chapter {
  id: string;
  /** The box's headline; the first chapter's is the article's name, as on the page. */
  headline: string;
  /** The chapter index's entry, when the headline is too long for it. */
  index?: string;
  /** What this part of the thing does, in a sentence or two, for anyone. */
  story: string;
  /** The opening chapter's facts at a glance, set like the key. */
  facts?: { name: string; value: string }[];
  view: ChapterView;
  /** Parts lifted and drawn at full line weight. */
  focus: { sheets?: string[]; refs?: string[] };
  /**
   * How far focused parts move off the board, in model units (the board's
   * long side is 1): up from the top, down from the bottom.
   */
  lift: number;
  /** Parts that move further than the rest of the focus: this many times the lift. */
  lifts?: Record<string, number>;
  /** Everything outside the focus is drawn faintly. */
  dim: boolean;
  callouts: Callout[];
  /** A path drawn through these parts, in order (the power path, the I²C bus). */
  trace?: string[];
  /** The screen is on (the watch: its display module is on the stage). */
  display: boolean;
  /**
   * The real thing, at the end: a photo that takes the board's place beside
   * the story (black and white until hovered). In public/.
   */
  photo?: { src: string; alt: string };
}

/** What a screen that plays music is playing (the player's), for the article to show. */
export interface Playing {
  index: number;
  count: number;
  title: string;
  artist: string;
  /** The track on Spotify. */
  url: string;
  /** Its album cover at the screen's resolution. */
  cover: string;
  playing: boolean;
  /** s */
  elapsed: number;
  duration: number;
  /** Where the tracks come from. */
  source: { name: string; url: string };
}

/** A framebuffer something draws into, RGBA with row 0 at the top. */
export interface Screen {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  /** Power on. */
  reset(now: number): void;
  /** Advance to `now`; true when the pixels changed. */
  step(now: number, animate: boolean): boolean;
  /** Pointer over the box, −1…1 each way (the watch's accelerometer). */
  tilt?: { x: number; y: number };
  /** 0–100, or null when unknown. */
  battery?: number | null;
  press?(button: string): void;
  /** The screen goes off (its chapter left, or the article closed). */
  sleep?(): void;
  /** What's playing, and a way to hear when it changes. */
  status?(): Playing | null;
  subscribe?(f: () => void): () => void;
}

export interface Device {
  /** The baked board in public/. */
  src: string;
  chapters: Chapter[];
  /** Refs that rise a chapter's whole lift; the others rise LOOK.minorLift of it. */
  major: RegExp;
  /**
   * Where a part's number stands, in the model's mm, for parts whose middle is the wrong place
   * (the drone's ring, whose middle is empty). Default: the top of the part, or the middle of one under the board.
   */
  anchors?: Record<string, readonly [number, number, number]>;
  /** Where the last chapter sends the reader on to. */
  next?: { id: ArticleId; name: string };
  /**
   * The watch: a display module kept off the board that comes down onto it in
   * the chapters with `display`. Sizes in mm; `ref` names it in callouts.
   */
  module?: {
    ref: string;
    module: readonly [number, number, number];
    glass: readonly [number, number, number];
    active: readonly [number, number];
    activeRadius: number;
    /** Height of the module's underside above the board's origin when shown, mm. */
    hover: number;
    screen: () => Screen;
  };
  /**
   * The player: a screen on the top face of one of the board's parts, lit in
   * the chapters with `display`. Its active area in KiCad mm; `up` is the
   * direction on the board the image's top faces ("-x": toward the plug; "+y":
   * the board's top edge in model space, upright when the board lies sideways).
   */
  screen?: {
    ref: string;
    center: [number, number];
    size: [number, number];
    up: "-x" | "+y";
    screen: () => Screen;
  };
}
