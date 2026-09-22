import type { ReactNode } from "react";

import Stage from "@/components/Stage";

/**
 * Every front-page route shares this layout, and layouts persist across
 * sibling navigations — so the newspaper and the globe's WebGL context are
 * mounted exactly once. The pages beneath are empty: the URL is the state,
 * and <Stage> reads it.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Stage />
      {children}
    </>
  );
}
