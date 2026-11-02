import { attractorArt } from "@/lib/og/art";
import { articleCard, OG_SIZE } from "@/lib/og/card";

/** The attractors' link preview: the Lorenz orbit, traced as the article traces it. */

export const dynamic = "force-static";
export const alt = "Chaotic Attractors — the Lorenz attractor, traced from Avi Yadava's Python";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return articleCard({
    label: "/Project — Python / NumPy",
    title: "Chaotic Attractors",
    titleSize: 94,
    dek: "How long each point takes to fall into a chaotic orbit, ported from my own Python.",
    path: "/attractors",
    art: attractorArt(540),
    artW: 540,
    artH: 540,
  });
}
