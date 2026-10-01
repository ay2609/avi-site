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
  /** Bottom band, left: how to work the art (Esc is the button in the top band). */
  controls: string;
  /** A near-invisible animated ASCII field behind the whole stage. */
  backdrop?: AsciiFieldId;
  /** `<title>` when open. */
  title: string;
}

export const ARTICLES: Record<ArticleId, Article> = {
  globe: {
    id: "globe",
    route: "/globe",
    aspect: 1,
    kicker: "/Globe — Three.js / GLSL",
    controls: "Drag to orbit · Scroll to bend · Space to pause",
    backdrop: "crate",
    title: "Globe — Avi Yadava",
  },
  watch: {
    id: "watch",
    route: "/watch",
    aspect: 4 / 3,
    kicker: "/Watch — ESP32 / KiCad",
    controls: "Scroll to walk through",
    title: "Watch — Avi Yadava",
  },
  fractals: {
    id: "fractals",
    route: "/fractals",
    aspect: 1,
    kicker: "/Fractals — NumPy / GLSL",
    controls: "Scroll to walk through · Drag to explore",
    title: "Fractals — Avi Yadava",
  },
};

export const ARTICLE_IDS = Object.keys(ARTICLES) as ArticleId[];

export function articleForPath(pathname: string): ArticleId | null {
  return ARTICLE_IDS.find((id) => ARTICLES[id].route === pathname) ?? null;
}
