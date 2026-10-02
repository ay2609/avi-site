import { globeArt } from "@/lib/og/art";
import { articleCard, OG_SIZE } from "@/lib/og/card";

/** The globe's link preview: its land, coasts and the network's busiest hubs. */

export const dynamic = "force-static";
export const alt = "Globe — an interactive globe with a live mesh network, by Avi Yadava";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return articleCard({
    label: "/Globe — Three.js / GLSL",
    title: "Globe",
    dek: "Drag it round, scroll to bend it flat — bend it past halfway and the whole page turns to paper.",
    path: "/globe",
    art: globeArt(520, -75),
    artW: 520,
    artH: 520,
  });
}
