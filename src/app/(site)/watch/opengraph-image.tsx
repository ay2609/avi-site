import { watchArt } from "@/lib/og/art";
import { articleCard, OG_SIZE } from "@/lib/og/card";

/** The watch's link preview: the board as the turntable draws it, from its mesh. */

export const dynamic = "force-static";
export const alt = "Watch — the board of Avi Yadava's ESP32 smartwatch, as line art";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return articleCard({
    label: "/Project — ESP32 / KiCad",
    title: "Watch",
    dek: "My freshman-year project: a smartwatch designed from nothing, the board in KiCad and the firmware in C.",
    path: "/watch",
    art: watchArt(560, 540),
    artW: 560,
    artH: 540,
  });
}
