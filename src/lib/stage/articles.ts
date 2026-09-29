import type { AsciiFieldId } from "@/lib/ascii/fields";

/**
 * The expandable articles. Each has a slot in the newspaper, a document-level
 * layer that carries its art, a route, and the copy the stage shows around it.
 */
export type ArticleId = "globe" | "watch" | "fractals";

export interface Article {
  id: ArticleId;
  route: string;
  /** Width / height of its box, on the page and on the stage. */
  aspect: number;
  /** Top band, left. */
  kicker: string;
  /** Bottom band, left. */
  caption: string;
  /** Right spine. */
  controls: string;
  /** Show the vertical text in the side bands (edition left, controls right). Default true. */
  spines?: boolean;
  /** A near-invisible animated ASCII field behind the whole stage. */
  backdrop?: AsciiFieldId;
  /**
   * Show `caption` in the bottom band on phones. Default true; off where the
   * article sets its own caption below its box there and the two would collide.
   */
  phoneCaption?: boolean;
  /** `<title>` when open. */
  title: string;
}

export const ARTICLES: Record<ArticleId, Article> = {
  globe: {
    id: "globe",
    route: "/globe",
    aspect: 1,
    kicker: "/01 — Globe — Three.js / GLSL",
    caption: "Fig. 1 — An interactive globe, built to be wandered.",
    controls: "Drag to orbit · Wheel to bend · Space to pause",
    spines: false,
    backdrop: "crate",
    title: "Globe — Avi Yadava",
  },
  watch: {
    id: "watch",
    route: "/watch",
    aspect: 4 / 3,
    kicker: "/02 — Watch — ESP32 / KiCad",
    caption: "Fig. 2 — A custom ESP32-S3 smartwatch, board and firmware.",
    controls: "Scroll to walk through · Esc to close",
    title: "Watch — Avi Yadava",
  },
  fractals: {
    id: "fractals",
    route: "/fractals",
    aspect: 1,
    kicker: "/03 — Fractals — NumPy / GLSL",
    caption: "Fig. 3 — A year of high school spent drawing fractals, and what came after.",
    controls: "Scroll to walk through · Drag to explore · Esc to close",
    phoneCaption: false,
    title: "Fractals — Avi Yadava",
  },
};

export const ARTICLE_IDS = Object.keys(ARTICLES) as ArticleId[];

export function articleForPath(pathname: string): ArticleId | null {
  return ARTICLE_IDS.find((id) => ARTICLES[id].route === pathname) ?? null;
}
