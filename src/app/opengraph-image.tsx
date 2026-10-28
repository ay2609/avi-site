import { globeArt, isoArt } from "@/lib/og/art";
import { card, colors, OG_SIZE, rule, serif } from "@/lib/og/card";

/**
 * The front page's link preview: a clipping of the page as it opens — the
 * name, "Hi, I'm Avi." and a line about him beside the globe, and the seam's
 * isovalues in ink, all drawn at build (Oct 22; the seam was ASCII). The
 * articles override it with their own (src/app/(site)/<id>/).
 */

export const dynamic = "force-static";
export const alt = "Avi Yadava — the front page of aviyadava.com";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The band's height; the column inside the outer rules is 1040 wide, 1038 between them. */
const SEAM_H = 92;

export default function Image() {
  return card(
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          ...serif,
          display: "flex",
          fontSize: 198,
          lineHeight: 0.82,
          letterSpacing: "-0.03em",
          padding: "22px 24px 18px",
          borderBottom: rule,
        }}
      >
        Avi Yadava
      </div>
      <div style={{ display: "flex", flex: 1, borderBottom: rule }}>
        <div style={{ display: "flex", flexDirection: "column", width: 700, padding: "22px 24px", borderRight: rule }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Instrument Serif",
              fontSize: 64,
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
              color: colors.bone,
            }}
          >
            Hi, I&rsquo;m Avi.
          </div>
          <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 34, lineHeight: 1.18, color: colors.dim, marginTop: 18 }}>
            Computer science and robotics at the University of Maryland. Embedded work, and the places where
            software, hardware and design meet.
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <img src={globeArt(232)} width={232} height={232} alt="" />
        </div>
      </div>
      <img src={isoArt(1038, SEAM_H)} width={1038} height={SEAM_H} alt="" />
    </div>
  );
}
