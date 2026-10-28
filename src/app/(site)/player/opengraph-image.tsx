import { boardArt } from "@/lib/og/art";
import { articleCard, OG_SIZE } from "@/lib/og/card";

/** The player's link preview: its board as the turntable draws it, from its mesh. */

export const dynamic = "force-static";
export const alt = "Player — the board of Avi Yadava's Tiny Music Player, as line art";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return articleCard({
    label: "/Project — STM32 / KiCad",
    title: "Player",
    dek: "The Tiny Music Player: a pocket player for lossless files and wired headphones, with a tiny screen for the album art.",
    path: "/player",
    art: boardArt("public/player-parts.bin", 560, 540, -58, 50),
    artW: 560,
    artH: 540,
  });
}
