import { globeIcon } from "@/lib/og/icon";

/** The tab icon before the page wakes: the turning globe's first frame (see LiveIcon). */

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new Response(new Uint8Array(globeIcon(32)), { headers: { "Content-Type": "image/png" } });
}
