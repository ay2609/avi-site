"use client";

import AsciiPanel from "@/lib/ascii/AsciiPanel";
import type { AsciiFieldId } from "@/lib/ascii/fields";
import type { Box } from "@/lib/stage/motion";

/**
 * A near-invisible ASCII field over the whole viewport, after caponier.io's —
 * large characters, tilted, slowly turning — turned right down so it reads as
 * texture on the ink rather than as a picture. The stage shows it through a
 * window (see Stage): the slot on hover, the whole viewport once open.
 *
 * Its strength is the `--backdrop` custom property on an ancestor, so the
 * stage can tween it: `preview` in the slot, where it has little room to be
 * seen, thinning to `opacity` as it spreads over the page.
 *
 * The spotlight: the strength falls off as a gaussian from the centre of the
 * art — exp(−r² / 2σ²) — so the field is lit around the subject and gone at
 * the edges. The centre and size come from `--spot-x`, `--spot-y`, `--spot-r`
 * (unitless px, r = 3σ) on an ancestor; the stage sets them with `spotFor`, so
 * the light travels and grows with the art as it opens.
 */
export const BACKDROP = {
  /** Strength at the spotlight's centre, on the stage and in the slot. */
  opacity: 0.08,
  preview: 0.16,
  fontSize: 11,
  tilt: -5,
  fps: 20,
  spot: {
    /** σ as a fraction of the art box's longer side. */
    sigma: 0.4,
    /** Strength left at the far edges, as a fraction of the centre's (0 = none). */
    floor: 0,
  },
} as const;

/** The spotlight's custom properties for an art box: its centre, and 3σ. */
export function spotFor(b: Box) {
  return {
    "--spot-x": b.left + b.width / 2,
    "--spot-y": b.top + b.height / 2,
    "--spot-r": 3 * BACKDROP.spot.sigma * Math.max(b.width, b.height),
  };
}

// A radial-gradient can't take a function, so the curve is sampled into stops
// over 0…3σ; past 3σ it holds its last value (~1% above the floor).
const STOPS = 16;
const GAUSSIAN = Array.from({ length: STOPS + 1 }, (_, i) => {
  const t = i / STOPS; // r / 3σ
  const { floor } = BACKDROP.spot;
  const a = floor + (1 - floor) * Math.exp(-4.5 * t * t);
  return `rgba(0,0,0,${a.toFixed(3)}) ${(t * 100).toFixed(2)}%`;
}).join(", ");
const SPOTLIGHT =
  "radial-gradient(circle calc(var(--spot-r, 1e5) * 1px) at " +
  `calc(var(--spot-x, 0) * 1px) calc(var(--spot-y, 0) * 1px), ${GAUSSIAN})`;

export default function Backdrop({ field }: { field: AsciiFieldId }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        opacity: `var(--backdrop, ${BACKDROP.opacity})`,
        maskImage: SPOTLIGHT,
        WebkitMaskImage: SPOTLIGHT,
      }}
    >
      {/* Oversized so the tilt never shows a corner. */}
      <div className="absolute -inset-[12%]" style={{ transform: `rotate(${BACKDROP.tilt}deg)` }}>
        <AsciiPanel
          field={field}
          fps={BACKDROP.fps}
          style={{ fontSize: BACKDROP.fontSize, lineHeight: 1, color: "var(--bone)" }}
        />
      </div>
    </div>
  );
}
