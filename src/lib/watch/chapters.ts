import type { Chapter, Device } from "@/lib/teardown/device";

import { SovereignFace } from "./face";

/**
 * The watch walkthrough: five chapters, each a camera, a set of parts lifted
 * off the board, and a few labelled parts (types in src/lib/teardown/device),
 * then the watch itself, on a wrist.
 */

export type FaceButton = "wake" | "sleep" | "next" | "back" | "spare";

export const CHAPTERS: Chapter[] = [
  {
    id: "watch",
    headline: "Custom Digital Watch",
    index: "Watch",
    story:
      "A smartwatch I designed from nothing: the circuit board in KiCad, the firmware in C. This walkthrough takes the board apart one system at a time and ends on the real thing.",
    facts: [
      { name: "Processor", value: "ESP32-S3" },
      { name: "Screen", value: '1.69" · 240 × 280' },
      { name: "Senses", value: "Motion, time, battery" },
      { name: "Firmware", value: "C · ESP-IDF" },
    ],
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
    story:
      "Power comes in through the USB-C port, charges a small lithium battery, and leaves as a steady 3.3 volts for everything else on the board. The line follows that path.",
    view: { yaw: 26, pitch: -40, roll: -12, zoom: 1.45 },
    focus: { sheets: ["USB-C", "LiPo Charger", "LiPo Connection", "Voltage Regulator"] },
    lift: 0.16,
    dim: true,
    callouts: [
      { ref: "J1", name: "USB-C port", part: "5 V in" },
      { ref: "D3", name: "Surge protection", part: "ESD × 3" },
      { ref: "D2", name: "One-way diode", part: "Schottky" },
      { ref: "U3", name: "Battery charger", part: "BQ24090" },
      { ref: "U2", name: "3.3 V regulator", part: "TPS79533" },
      { ref: "J2", name: "Battery connector", part: "Li-Po" },
    ],
    // The charger's output, the cell and the regulator's input are one net (the
    // BQ24090 has no separate system output), so the order along it is free:
    // U2 sits on the way from U3 to J2, and visiting it first keeps the line from
    // doubling back on itself.
    trace: ["J1", "D2", "U3", "U2", "J2"],
    display: false,
  },
  {
    id: "brain",
    headline: "Brain",
    story:
      "One chip runs the whole watch: an ESP32-S3, which sets the clock over Wi-Fi, reads the sensors, watches the buttons and draws the screen. The two small buttons beside it restart and reprogram it.",
    view: { yaw: -24, pitch: -52, roll: 8, zoom: 1.5 },
    focus: { sheets: ["ESP32-S3-WROOM-2", "MCU RST BOOT"] },
    lift: 0.14,
    dim: true,
    callouts: [
      { ref: "U7", name: "Processor and Wi-Fi", part: "ESP32-S3" },
      { ref: "SW2", name: "Reset button", part: "EN" },
      { ref: "SW1", name: "Programming button", part: "IO0" },
    ],
    display: false,
  },
  {
    id: "senses",
    headline: "Senses",
    story:
      "Three small chips tell the processor what's going on: how the watch is moving, what time it is, and how much battery is left. All three share one pair of wires, the line you see here, and answer when asked.",
    view: { yaw: 18, pitch: -58, roll: -4, zoom: 1.8, shift: [0, -0.04] },
    focus: { sheets: ["gyro", "Clock", "ADC"] },
    lift: 0.14,
    dim: true,
    callouts: [
      { ref: "U7", name: "Processor", part: "ESP32-S3" },
      { ref: "U5", name: "Clock", part: "DS3231M" },
      { ref: "U6", name: "Motion sensor", part: "ICM-42670-P" },
      { ref: "U1", name: "Battery reader", part: "MCP3427" },
    ],
    trace: ["U7", "U5", "U6", "U1"],
    display: false,
  },
  {
    id: "face",
    headline: "Face",
    story:
      "A 1.69-inch colour screen comes down onto the board showing the real watch face, redrawn here from the firmware. Its dial tilts with your pointer, as it does with your wrist on the watch. Try the buttons below.",
    view: { yaw: -14, pitch: -20, roll: 0, zoom: 1.2 },
    focus: { sheets: ["Buttons"] },
    lift: 0,
    dim: true,
    callouts: [
      { ref: "LCD", name: "Screen", part: "ST7789V2" },
      { ref: "SW3", name: "Wake", part: "IO18", press: "wake" },
      { ref: "SW7", name: "Sleep", part: "IO36", press: "sleep" },
      { ref: "SW6", name: "Next screen", part: "IO4", press: "next" },
      { ref: "SW4", name: "Back", part: "IO5", press: "back" },
      { ref: "SW5", name: "Spare button", part: "IO35" },
    ],
    display: true,
  },
  {
    // The board stays posed as the face, faded out under the photo.
    id: "wrist",
    headline: "On the Wrist",
    index: "Wrist",
    story: "The finished watch: the board in a white printed frame on a mesh band, running the face from the last chapter.",
    view: { yaw: -14, pitch: -20, roll: 0, zoom: 1.2 },
    focus: { sheets: ["Buttons"] },
    lift: 0,
    dim: true,
    callouts: [],
    display: true,
    photo: {
      src: "/watch-worn.jpg",
      alt: "The watch on a wrist: the board in a white printed frame on a mesh band, two grey buttons on its side, and the display showing 12:38:58 PM in blue line type beside wireframe polyhedra, the battery at 74.2.",
    },
  },
];

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

export const WATCH: Device = {
  src: "/watch-parts.bin",
  chapters: CHAPTERS,
  major: /^(U|J|SW)\d/,
  module: { ref: "LCD", ...DISPLAY, screen: () => new SovereignFace() },
  next: { id: "fractals", name: "Fractals" },
};
