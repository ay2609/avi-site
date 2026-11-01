import type { Chapter, Device } from "@/lib/teardown/device";

import { PocketPlayer } from "./pocket";

/**
 * The player walkthrough: six chapters over the Tiny Music Player's board
 * (rev C, layout v3, from ~/workspaces/kicad-projects/Tiny Music Player; baked
 * by scripts/player-board.sh). The schematic is one flat sheet, so each
 * chapter names its parts: a chip and the passives the layout ties to it
 * (pcb/intent.json there). The cells, the jack and the microSD socket hang
 * under the board and drop away from it; the OLED glass lifts off the top.
 *
 * The chapters follow a song: off the card, through the brain, out the jack,
 * then what powers it all, and the screen last, because that chapter plays.
 *
 * Along the stick (KiCad x): the USB-C plug and the screen, the brain, the
 * controls, the cells beneath, then power and audio and the jack at the end.
 * On the stage it stands up, plug at the top (roll −90), so it keeps to the
 * middle of the box and the labels have the sides; yaw turns it about its
 * length to show what has lifted.
 */

const POWER = [
  "BT1",
  ...["U3", "C1", "C2", "R2"], // charger
  ...["U11", "C31", "Q2", "Q3", "R26", "R27"], // cell protection
  ...["Q1", "C3", "D1"], // power path
  ...["U4", "C5", "C7"], // 3.0 V
  ...["U5", "C10", "C11", "L2", "R17"], // 1.8 V buck
  ...["U9", "C6", "C29", "R22", "R23"], // the switched 3.0 V for the card and the screen
  ...["R3", "R4", "R15", "R16"], // battery and VBUS sense
];

const BRAIN = [
  ...["U1", "C4", "C17", "C21", "C22", "C23", "C24", "C25", "C26", "C27", "C28", "C32", "C33", "C34", "C37"],
  ...["L3", "R5", "R6", "R7", "R8", "R9", "R10", "R18", "R32"],
  ...["Y1", "C35", "C36"],
];

const LIBRARY = [
  ...["J3", "C12", "C13"], // microSD
  ...["J1", "R1", "U2"], // USB-C, ESD
  ...["U12", "C8", "C9"], // the USB PHY's 3.3 V
];

const SOUND = [
  ...["U8", "C38", "C39", "C40", "C41", "C42", "C43", "C44", "C45", "C46", "C47", "C48", "C49", "C50", "C51", "R19"],
  ...["X1", "C52", "R28", "R34", "X2", "C53", "R29", "R35"], // the two clocks
  ...["U13", "C60", "C61", "U14", "C54", "C55", "R36", "U15", "C56", "C57", "U16", "C58", "C59"], // level shifters
  ...["J2", "D3", "D4", "R20", "R21", "R25", "R37"], // the jack
];

const FACE = [
  "OLED",
  ...["DS1", "C14", "C15", "C16", "C62", "R11"], // the panel's connector
  ...["U7", "C18", "C19", "C20", "D2", "L1", "R12", "R13", "U10", "C30", "R14", "R24"], // its 12 V
  ...["SW1", "SW2", "SW3"],
];

export const CHAPTERS: Chapter[] = [
  {
    id: "player",
    headline: "Tiny Music Player",
    index: "Player",
    story:
      "A pocket music player for lossless files and wired headphones, with a tiny screen for the album art. It's what I'm building now: the board is designed and routed, but hasn't been made yet.",
    facts: [
      { name: "Processor", value: "STM32U5" },
      { name: "Sound", value: "CS43131" },
      { name: "Library", value: "microSD" },
      { name: "Screen", value: '0.6" · 64 × 64' },
    ],
    view: { yaw: "spin", pitch: -8, roll: "diagonal", zoom: 1.25, look: [0, 0, 0] },
    focus: {},
    lift: 0,
    dim: false,
    callouts: [],
    display: false,
  },
  {
    id: "library",
    headline: "Library",
    // Nearly edge-on, so the plug rising off the top and the card socket
    // dropping off the bottom are both in view.
    story:
      "Your music lives on a microSD card as lossless files. Plug the player's USB-C end into a computer and the card shows up as a drive, so loading songs is a drag and drop. The same plug charges it.",
    view: { yaw: 72, pitch: -12, roll: -90, zoom: 2.7 },
    focus: { refs: LIBRARY },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "J3", name: "microSD socket", part: "Lossless" },
      { ref: "J1", name: "USB-C plug", part: "Drive + charge" },
      { ref: "U2", name: "Surge protection", part: "USBLC6" },
      { ref: "U12", name: "3.3 V for USB", part: "TPS7A20" },
    ],
    display: false,
  },
  {
    id: "brain",
    headline: "Brain",
    story:
      "An STM32U5 sits in the middle of it all: it reads each song off the card, hands it to the sound chip, and talks USB to the computer.",
    view: { yaw: -30, pitch: -24, roll: -90, zoom: 3.1 },
    focus: { refs: BRAIN },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "U1", name: "Processor", part: "STM32U5" },
      { ref: "Y1", name: "USB clock", part: "16 MHz" },
      { ref: "L3", name: "Core's power coil", part: "SMPS" },
    ],
    display: false,
  },
  {
    id: "sound",
    headline: "Sound",
    story:
      "The music crosses to the CS43131, which turns it into an analog signal and drives your headphones directly from the jack. It has two clocks because music comes in two families of sample rate.",
    view: { yaw: -32, pitch: -22, roll: -90, zoom: 2.7 },
    focus: { refs: SOUND },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "U14", name: "Level shifter", part: "3.0 ↔ 1.8 V" },
      { ref: "U8", name: "DAC and headphone amp", part: "CS43131" },
      { ref: "X1", name: "48 kHz clock", part: "24.576 MHz" },
      { ref: "X2", name: "44.1 kHz clock", part: "22.5792 MHz" },
      { ref: "J2", name: "Headphone jack", part: "3.5 mm · 2 Vrms" },
    ],
    // Samples across the level shift, into the DAC, out the jack.
    trace: ["U14", "U8", "J2"],
    display: false,
  },
  {
    id: "power",
    headline: "Power",
    story:
      "Two small 10440 cells sit under the board, about 700 mAh together. A charger fills them from the USB plug, a guard chip protects them, and two regulators make the voltages the rest of the board runs on.",
    view: { yaw: 34, pitch: -22, roll: -90, zoom: 2.3 },
    focus: { refs: POWER },
    lift: 0.1,
    dim: true,
    callouts: [
      { ref: "U3", name: "Charger", part: "MCP73832" },
      { ref: "BT1", name: "Two cells", part: "2 × 10440" },
      { ref: "U11", name: "Battery guard", part: "BQ29700" },
      { ref: "U4", name: "3.0 V regulator", part: "TPS7A20" },
      { ref: "U5", name: "1.8 V converter", part: "TPS62843" },
    ],
    // Through the charger into the cells, and out of them through the guard.
    trace: ["U3", "BT1", "U11"],
    display: false,
  },
  {
    id: "face",
    headline: "Face",
    // Sideways, plug to the left, the way it's held to look at the screen; the
    // controls are the island under it (TeardownArticle), not labels.
    story:
      "A 0.6-inch colour OLED, 64 pixels a side, showing the album cover at its own low resolution. This one plays: 30-second previews of my playlist, filtered to sound like a tiny player into cheap earbuds.",
    view: { yaw: 8, pitch: -30, roll: 0, zoom: 3.3, shift: [0.1, 0.08] },
    focus: { refs: FACE },
    lift: 0.05,
    lifts: { OLED: 2 },
    dim: true,
    callouts: [],
    display: true,
  },
];

export const PLAYER: Device = {
  src: "/player-parts.bin",
  chapters: CHAPTERS,
  major: /^(U|J|SW|BT|DS|OLED)\d*$/,
  next: { id: "fractals", name: "Fractals" },
  // The OLED's active area, where the playlist's covers show: 10.73 mm square, set 1.6 mm in from the glass's
  // far edge (REVISION-B Part 7), the image upright with the stick sideways.
  screen: { ref: "OLED", center: [114.04, 112.5], size: [10.73, 10.73], up: "+y", screen: () => new PocketPlayer() },
};
