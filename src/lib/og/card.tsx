import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

import { ImageResponse } from "next/og";

/**
 * The link previews (opengraph-image.tsx in src/app and each article's
 * route): the front page's furniture at 1200 × 630 — one column between solid
 * outer rules, dashed rules inside, mono labels, Instrument Serif headlines —
 * built once per deploy. The fonts are TTF/OTF copies in ./fonts (OFL; the
 * page itself loads woff2 through next/font, which next/og can't read).
 */

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  ink: "#0a0a0b",
  bone: "#e6e4df",
  dim: "#8a8987",
  rule: "#2a2a2c",
};

const font = (file: string) => readFileSync(join(process.cwd(), "src/lib/og/fonts", file));

function fonts() {
  return [
    { name: "Instrument Serif", data: font("InstrumentSerif-Regular.ttf"), weight: 400 as const, style: "normal" as const },
    { name: "Plex Mono", data: font("IBMPlexMono-Light.otf"), weight: 300 as const, style: "normal" as const },
  ];
}

/** The build's date, as the masthead clock writes the day. */
export function dateline(now = new Date()): string {
  return now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "America/New_York" })
    .replace(",", "")
    .toUpperCase();
}

export const label = {
  fontFamily: "Plex Mono",
  fontSize: 15,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: C.dim,
};

export const serif = {
  fontFamily: "Instrument Serif",
  color: C.bone,
  textTransform: "uppercase" as const,
};

export const rule = `1px dashed ${C.rule}`;
export const colors = C;

/** The page: ink, a 1040 px column between solid rules, the masthead's label row. */
export function card(children: ReactNode, right = dateline()): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", background: C.ink }}>
        <div
          style={{
            width: 1040,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderLeft: `1px solid ${C.rule}`,
            borderRight: `1px solid ${C.rule}`,
          }}
        >
          <div style={{ ...label, display: "flex", justifyContent: "space-between", padding: "26px 24px 0" }}>
            <span>halcyn.dev</span>
            <span style={{ color: C.bone }}>{right}</span>
          </div>
          {children}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts() }
  );
}

/**
 * An article's preview: its label, headline and a line of copy on the left,
 * its art on the right bleeding to the rules, as the rail draws it.
 */
export function articleCard(opts: { label: string; title: string; dek: string; path: string; art: string; artW: number; artH: number }) {
  return card(
    <div style={{ display: "flex", flex: 1, marginTop: 18, borderTop: rule }}>
      <div style={{ display: "flex", flexDirection: "column", width: 470, padding: "22px 24px 26px", borderRight: rule }}>
        <div style={{ ...label, display: "flex" }}>{opts.label}</div>
        <div style={{ ...serif, display: "flex", fontSize: 132, lineHeight: 0.86, letterSpacing: "-0.02em", marginTop: 14 }}>
          {opts.title}
        </div>
        <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 31, lineHeight: 1.18, color: C.dim, marginTop: 26 }}>
          {opts.dek}
        </div>
        <div style={{ ...label, display: "flex", marginTop: "auto", color: C.bone }}>{`Avi Yadava — ${opts.path}`}</div>
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders <img>, not next/image */}
        <img src={opts.art} width={opts.artW} height={opts.artH} alt="" />
      </div>
    </div>
  );
}
