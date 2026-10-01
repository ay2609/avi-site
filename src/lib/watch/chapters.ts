/**
 * The watch walkthrough: five chapters, each a camera, a set of parts lifted
 * off the board, and a few labelled parts.
 *
 * Parts are named by reference designator; `sheets` pulls in every part drawn
 * on those schematic sheets (see the parts table in public/watch-parts.bin).
 * Angles are degrees. Copy is set in the site's label style (uppercase by CSS).
 */

export type FaceButton = "wake" | "sleep" | "next" | "back" | "spare";

export interface Callout {
  /** A reference designator, or "LCD" for the display module. */
  ref: string;
  text: string;
  /** In the FACE chapter, a label that presses that button on the face. */
  press?: FaceButton;
  /** Force the label's column; by default it goes on the side its part is on. */
  side?: "left" | "right";
}

export interface ChapterView {
  /** Turntable angle; "spin" keeps the front-page turntable turning. */
  yaw: number | "spin";
  pitch: number;
  /** Rotation in the board's own plane; "diagonal" stands the board's diagonal upright. */
  roll: number | "diagonal";
  zoom: number;
  /** Where the camera looks, in model space; default: the lifted parts' centre. */
  look?: [number, number, number];
  /** Shifts the subject within the box, in fractions of the box (x right, y up). */
  shift?: [number, number];
}

export interface Chapter {
  id: string;
  headline: string;
  view: ChapterView;
  /** Parts lifted and drawn at full line weight. */
  focus: { sheets?: string[]; refs?: string[] };
  /** How far focused parts rise, in model units (the board's long side is 1). */
  lift: number;
  /** Everything outside the focus is drawn faintly. */
  dim: boolean;
  callouts: Callout[];
  /** A path drawn through these parts, in order (the power path, the I²C bus). */
  trace?: string[];
  /** The display module is on the stage. */
  display: boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    id: "watch",
    headline: "Watch",
    view: { yaw: "spin", pitch: -8, roll: "diagonal", zoom: 1, look: [0, 0, 0] },
    focus: {},
    lift: 0,
    dim: false,
    callouts: [],
    display: false,
  },
  {
    id: "power",
    headline: "Power",
    view: { yaw: 26, pitch: -58, roll: -12, zoom: 1.55 },
    focus: { sheets: ["USB-C", "LiPo Charger", "LiPo Connection", "Voltage Regulator"] },
    lift: 0.16,
    dim: true,
    callouts: [
      { ref: "J1", text: "USB-C" },
      { ref: "D3", text: "ESD × 3" },
      { ref: "D2", text: "Schottky" },
      { ref: "U3", text: "BQ24090 charger" },
      { ref: "J2", text: "Li-Po cell" },
      { ref: "U2", text: "TPS79533 · 3.3 V" },
    ],
    trace: ["J1", "D2", "U3", "J2", "U2"],
    display: false,
  },
  {
    id: "brain",
    headline: "Brain",
    view: { yaw: -24, pitch: -52, roll: 8, zoom: 1.75 },
    focus: { sheets: ["ESP32-S3-WROOM-2", "MCU RST BOOT"] },
    lift: 0.14,
    dim: true,
    callouts: [
      { ref: "U7", text: "ESP32-S3 · 8 MB flash", side: "left" },
      { ref: "SW1", text: "Boot · IO0" },
      { ref: "SW2", text: "Reset · EN" },
    ],
    display: false,
  },
  {
    id: "senses",
    headline: "Senses",
    view: { yaw: 18, pitch: -58, roll: -4, zoom: 2.1, shift: [0, -0.04] },
    focus: { sheets: ["gyro", "Clock", "ADC"] },
    lift: 0.14,
    dim: true,
    callouts: [
      { ref: "U6", text: "ICM-42670-P · motion" },
      { ref: "U5", text: "DS3231M · clock" },
      { ref: "U1", text: "MCP3427 · battery" },
      { ref: "U7", text: "Bus master", side: "left" },
    ],
    trace: ["U7", "U5", "U6", "U1"],
    display: false,
  },
  {
    id: "face",
    headline: "Face",
    view: { yaw: -14, pitch: -20, roll: 0, zoom: 1.2 },
    focus: { sheets: ["Buttons"] },
    lift: 0,
    dim: true,
    callouts: [
      { ref: "LCD", text: "ST7789V2" },
      { ref: "SW3", text: "IO18 · wake", press: "wake" },
      { ref: "SW7", text: "IO36 · sleep", press: "sleep" },
      { ref: "SW5", text: "IO35", press: "spare" },
      { ref: "SW6", text: "IO4 · next", press: "next" },
      { ref: "SW4", text: "IO5 · back", press: "back" },
    ],
    display: true,
  },
];

export const LAST_CHAPTER = CHAPTERS.length - 1;

/**
 * The Waveshare 1.69" LCD module, in millimetres. Module and active area are
 * from Waveshare's spec; the glass outline and corner radius are estimates.
 */
export const DISPLAY = {
  module: [31.5, 39, 1.6],
  glass: [30.1, 36.2, 1.5],
  active: [27.97, 32.63],
  activeRadius: 4,
  /** Height of the module's underside above the board's origin when shown, mm. */
  hover: 10.5,
  pixels: [240, 280],
} as const;
