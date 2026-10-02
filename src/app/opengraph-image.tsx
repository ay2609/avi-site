import { asciiRows, globeArt } from "@/lib/og/art";
import { card, colors, label, OG_SIZE, rule, serif } from "@/lib/og/card";

/**
 * The front page's link preview: a clipping of the masthead — the name, the
 * letter's first lines beside the globe, and the seam's ASCII frozen at build.
 * The articles override it with their own (src/app/(site)/<id>/).
 */

export const dynamic = "force-static";
export const alt = "Avi Yadava — the front page of halcyn.dev";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const strip = asciiRows("seam", 118, 3, 8.4, 15);
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
        <div style={{ display: "flex", flexDirection: "column", width: 700, padding: "20px 24px", borderRight: rule }}>
          <div style={{ ...label, display: "flex" }}>/About</div>
          <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 40, lineHeight: 1.16, color: colors.bone, marginTop: 16 }}>
            Computer science and robotics at the University of Maryland. Embedded work, and the places where
            software, hardware and design meet.
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <img src={globeArt(270)} width={270} height={270} alt="" />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Plex Mono",
          fontSize: 14,
          lineHeight: "15px",
          color: "rgba(230,228,223,0.5)",
          whiteSpace: "pre",
          padding: "6px 0 8px",
          overflow: "hidden",
        }}
      >
        {strip.map((row, i) => (
          <span key={i}>{row}</span>
        ))}
      </div>
    </div>
  );
}
