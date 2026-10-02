import { fractalArt } from "@/lib/og/art";
import { articleCard, OG_SIZE } from "@/lib/og/card";

/** The fractals' link preview: the cover, computed with the cover's own colouring. */

export const dynamic = "force-static";
export const alt = "Fractals — the Mandelbrot set in Avi Yadava's sunburst colouring";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return articleCard({
    label: "/Project — Python / NumPy",
    title: "Fractals",
    dek: "Live ports of the Python I wrote in high school, from the Mandelbrot set to chaotic attractors.",
    path: "/fractals",
    art: fractalArt(540),
    artW: 540,
    artH: 540,
  });
}
