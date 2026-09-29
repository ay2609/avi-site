/**
 * The expandable articles. Each has a slot in the newspaper, a document-level
 * layer that carries its art, a route, and the copy the stage shows around it.
 */
export type ArticleId = "globe" | "watch";

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
    title: "Globe — Avi Yadava",
  },
  watch: {
    id: "watch",
    route: "/watch",
    aspect: 4 / 3,
    kicker: "/02 — Watch — ESP32 / KiCad",
    caption: "Fig. 2 — A custom ESP32-S3 smartwatch, board and firmware.",
    controls: "Turntable · Esc to close",
    title: "Watch — Avi Yadava",
  },
};

export const ARTICLE_IDS = Object.keys(ARTICLES) as ArticleId[];

export function articleForPath(pathname: string): ArticleId | null {
  return ARTICLE_IDS.find((id) => ARTICLES[id].route === pathname) ?? null;
}
