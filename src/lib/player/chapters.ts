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
    view: { yaw: "spin", pitch: -8, roll: "diagonal", zoom: 1.25, look: [0, 0, 0] },
    focus: {},
    lift: 0,
    dim: false,
    callouts: [],
    display: false,
  },
  {
    id: "power",
    headline: "Power",
    view: { yaw: 34, pitch: -22, roll: -90, zoom: 1.7 },
    focus: { refs: POWER },
    lift: 0.1,
    dim: true,
    callouts: [
      { ref: "BT1", text: "2 × 10440 · 700 mAh" },
      { ref: "U3", text: "MCP73832 charger" },
      { ref: "U11", text: "BQ29700 · cell guard" },
      { ref: "U4", text: "TPS7A20 · 3.0 V" },
      { ref: "U5", text: "TPS62843 · 1.8 V" },
    ],
    // Through the charger into the cells, and out of them through the guard.
    trace: ["U3", "BT1", "U11"],
    display: false,
  },
  {
    id: "brain",
    headline: "Brain",
    view: { yaw: -30, pitch: -24, roll: -90, zoom: 2.6 },
    focus: { refs: BRAIN },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "U1", text: "STM32U5 · Cortex-M33", side: "left" },
      { ref: "Y1", text: "16 MHz · USB clock" },
      { ref: "L3", text: "Core SMPS" },
    ],
    display: false,
  },
  {
    id: "library",
    headline: "Library",
    // Nearly edge-on, so the plug rising off the top and the card socket
    // dropping off the bottom are both in view.
    view: { yaw: 72, pitch: -12, roll: -90, zoom: 2.2 },
    focus: { refs: LIBRARY },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "J1", text: "USB-C · drive + charge" },
      { ref: "U2", text: "USBLC6 · ESD" },
      { ref: "J3", text: "microSD · lossless" },
      { ref: "U12", text: "TPS7A20 · 3.3 V USB" },
    ],
    display: false,
  },
  {
    id: "sound",
    headline: "Sound",
    view: { yaw: -32, pitch: -22, roll: -90, zoom: 2.1 },
    focus: { refs: SOUND },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "U8", text: "CS43131 · DAC + amp" },
      { ref: "X1", text: "24.576 MHz · 48 kHz" },
      { ref: "X2", text: "22.5792 MHz · 44.1 kHz" },
      { ref: "U14", text: "I²S · 3.0 ↔ 1.8 V" },
      { ref: "J2", text: "3.5 mm · 2 Vrms" },
    ],
    // Samples across the level shift, into the DAC, out the jack.
    trace: ["U14", "U8", "J2"],
    display: false,
  },
  {
    id: "face",
    headline: "Face",
    // Sideways, plug to the left, the way it's held to look at the screen; the
    // controls are the island under it (TeardownArticle), not labels.
    view: { yaw: 8, pitch: -30, roll: 0, zoom: 2.3, shift: [0.04, 0.1] },
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
  // The OLED's active area, where the playlist's covers show: 10.73 mm square, set 1.6 mm in from the glass's
  // far edge (REVISION-B Part 7), the image upright with the stick sideways.
  screen: { ref: "OLED", center: [114.04, 112.5], size: [10.73, 10.73], up: "+y", screen: () => new PocketPlayer() },
};
