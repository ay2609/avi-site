import { boardArt } from "@/lib/og/art";
import { articleCard, OG_SIZE } from "@/lib/og/card";

/** The drone's link preview: its frame and parts as the turntable draws them, from its mesh. */

export const dynamic = "force-static";
export const alt = "Classroom Drone — BYM's indoor drone, ring-guarded, as line art";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return articleCard({
    label: "/Project — ArduPilot / MAVLink",
    title: "Classroom Drone",
    titleSize: 92,
    dek: "A small drone for BYM’s classrooms: it flies indoors near students and holds still on its own.",
    path: "/drone",
    art: boardArt("public/drone-parts.bin", 560, 540, -28, 52),
    artW: 560,
    artH: 540,
  });
}
