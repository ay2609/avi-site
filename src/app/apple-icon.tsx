import { globeTile } from "@/lib/og/icon";

/** The home-screen icon: the globe's first frame on the page's ink (iOS rounds the corners). */

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new Response(new Uint8Array(globeTile(180, 148)), { headers: { "Content-Type": "image/png" } });
}
