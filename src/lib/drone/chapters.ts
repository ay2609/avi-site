import type { Chapter, Device } from "@/lib/teardown/device";

/**
 * The drone walkthrough: seven chapters over BYM's classroom drone, from the
 * design write-up (the brief, the frame, what lifts it, the brain, holding
 * still, the radios, how it got here). The page's order since Nov 4 puts it first:
 * drone, watch, fractals, player, attractors, and the walkthroughs lead on in that order. There's no CAD of the kit, so the model
 * is drawn from the parts' specs by scripts/drone-model.py: a MicoAir MVD30
 * Headless frame (136 mm wheelbase, its ring 193 × 181 × 26 mm), four 1407
 * motors under 3-inch tri-blades, the 36 mm H743 AIO on the stack, the 2S pack
 * strapped on top, the flow sensor under the plate.
 *
 * Refs are the model's own: PLATE is the carbon frame (the "board", part 0),
 * RING the moulded guard, M1–M4 and P1–P4 motors and props, FC the flight
 * controller, IFB the frame's interface board, BAT, FLOW, RX and TEL.
 * The drone stands upright on the stage (pitch −90), so yaw turns it about its
 * own up and `elevation` looks down on it, or up at what hangs under the plate;
 * the battery lifts off the top, and everything under the plate drops away.
 */

const MOTORS = ["M1", "M2", "M3", "M4"];
const PROPS = ["P1", "P2", "P3", "P4"];

export const CHAPTERS: Chapter[] = [
  {
    id: "drone",
    headline: "Classroom Drone",
    index: "Drone",
    story:
      "The drone we teach with at BYM (Build Young Minds), the drone education company I co-founded. I specified every part: it flies indoors near students, holds still on its own, and tells a laptop what it knows. Our first order was twenty kits.",
    facts: [
      { name: "Flight time", value: "About 15 min" },
      { name: "Weight", value: "About 290 g" },
      { name: "Props", value: '3" · guarded' },
      { name: "Autopilot", value: "ArduPilot" },
    ],
    view: { yaw: "spin", pitch: -90, roll: 0, elevation: 28, zoom: 1.2, look: [0, 0, 0] },
    focus: {},
    lift: 0,
    dim: false,
    callouts: [],
    display: false,
  },
  {
    id: "ring",
    headline: "Ring",
    story:
      "Near students the props can't be open. The MicoAir MVD30 frame wraps all four in one moulded ring, so the drone bounces off a wall or a person instead of cutting them.",
    view: { yaw: 145, pitch: -90, roll: 0, elevation: 34, zoom: 1.05 },
    focus: { refs: ["RING", "PLATE"] },
    lift: 0.06,
    dim: true,
    callouts: [
      { ref: "RING", name: "Prop guard", part: "193 × 181 mm" },
      { ref: "PLATE", name: "Carbon frame", part: "MVD30 · 3 mm" },
    ],
    display: false,
  },
  {
    id: "lift",
    headline: "Lift",
    story:
      "Four small motors spin three-blade props off a two-cell Li-ion pack. Li-ion holds more energy per gram than the usual LiPo but gives less current, and props this small stay within it: about 15 minutes in the air.",
    // From above: the props stay in their ducts, drawn up, and only the battery lifts off.
    view: { yaw: 210, pitch: -90, roll: 0, elevation: 40, zoom: 1.1 },
    focus: { refs: [...MOTORS, ...PROPS, "BAT"] },
    lift: 0.07,
    lifts: Object.fromEntries([...MOTORS, ...PROPS].map((r) => [r, 0])),
    dim: true,
    callouts: [
      { ref: "P2", name: "Props", part: "Gemfan 3052-3" },
      { ref: "M2", name: "Motors", part: "1407 · 4100 KV" },
      { ref: "BAT", name: "Battery", part: "2S · 3300 mAh" },
    ],
    display: false,
  },
  {
    id: "brain",
    headline: "Brain",
    story:
      "One 36 mm board is the flight controller and all four motor controllers, so each kit has one board to wire. It runs ArduPilot, the open-source autopilot, which can fly without GPS and talk to a ground station.",
    view: { yaw: 160, pitch: -90, roll: 0, elevation: -38, zoom: 2.3 },
    focus: { refs: ["FC", "IFB"] },
    lift: 0.08,
    dim: true,
    callouts: [
      { ref: "FC", name: "Flight controller", part: "H743 AIO" },
      { ref: "IFB", name: "USB and buzzer", part: "Interface" },
    ],
    display: false,
  },
  {
    id: "hover",
    headline: "Holding Still",
    index: "Hover",
    // From below, so the sensor dropping away from the cradle is in view.
    story:
      "Indoors there's no GPS, so the drone watches the floor. A tiny camera underneath sees it drift, and a light sensor measures its height. ArduPilot holds it in place from both, so a student can let go of the sticks.",
    view: { yaw: 200, pitch: -90, roll: 0, elevation: -48, zoom: 2.4 },
    focus: { refs: ["FLOW"] },
    lift: 0.1,
    dim: true,
    callouts: [{ ref: "FLOW", name: "Flow and height sensor", part: "MTF-02P" }],
    display: false,
  },
  {
    id: "radios",
    headline: "Radios",
    story:
      "It flies two ways, on two radios. A student flies it by hand over ExpressLRS. Over the LoRa telemetry link, the ground station we wrote flies it on its own and reads back its state twice a second.",
    view: { yaw: 150, pitch: -90, roll: 0, elevation: -32, zoom: 1.5 },
    focus: { refs: ["RX", "FC", "TEL"] },
    lift: 0.08,
    lifts: { FC: 0.5 },
    dim: true,
    callouts: [
      { ref: "RX", name: "Hand control", part: "ELRS 2.4 GHz" },
      { ref: "FC", name: "Autopilot", part: "MAVLink" },
      { ref: "TEL", name: "Ground station link", part: "LR24-F LoRa" },
    ],
    // The sticks come in, the autopilot flies, its state goes out.
    trace: ["RX", "FC", "TEL"],
    display: false,
  },
  {
    id: "first",
    headline: "First Build",
    index: "First",
    story:
      "This is our second design. The first was bigger, on a 3D-printed frame with 7-inch props, and flew well: stable, about 20 minutes. I shrank it for safety near students, onto a bought frame we could build in numbers.",
    view: { yaw: 145, pitch: -90, roll: 0, elevation: 30, zoom: 1.2 },
    focus: {},
    lift: 0,
    dim: false,
    callouts: [],
    display: false,
  },
];

export const DRONE: Device = {
  src: "/drone-parts.bin",
  chapters: CHAPTERS,
  major: /^(PLATE|RING|FC|BAT|FLOW|M\d|P\d)$/,
  // The ring's middle is empty and the plate's is under the battery: their numbers go on the band at the
  // front right and on the arm to it; a prop's on a blade, and a motor's on its pad, which is all of it that shows from above.
  anchors: {
    RING: [51 + 42.75 * Math.cos(Math.PI / 5), 45 + 42.75 * Math.sin(Math.PI / 5), 12],
    PLATE: [34, 30, 26],
    P2: [-80.2, 52, 4.2],
    M2: [-51, 45, 26],
  },
  // A built kit, on the front page and beside the opening words (Nov 4).
  cover: {
    src: "/drone-desk.jpg",
    alt: "A built kit drone on a desk: a clear moulded ring around four props, the flight controller and a battery lead in the middle, beside a white one-handed transmitter.",
  },
  next: { id: "watch", name: "Custom Digital Watch" },
};
