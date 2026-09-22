"use client";

import type { CSSProperties, Ref } from "react";

import Clock from "@/components/Clock";
import { LABEL } from "@/components/furniture";
import { STAGE_GUTTER } from "@/lib/stage/motion";

/**
 * The periphery of the expanded globe: the newspaper's grid, grown to the
 * viewport. The square's four edges extend as dashed hairlines to the screen
 * edges, which leaves four bands around it for furniture.
 *
 * Text carries `data-typed` and is typed in, character by character, once
 * everything has landed; `data-land` text simply appears then (the clock,
 * whose content changes every second, can't be split).
 *
 * Rule geometry is set from JS (see Stage.placeStage) so the rule variant can
 * fly them in from the slot's edges.
 */
export default function StageChrome({
  chromeRef,
  onClose,
}: {
  chromeRef: Ref<HTMLDivElement>;
  onClose: () => void;
}) {
  const style = {
    "--g": `${STAGE_GUTTER}px`,
    "--side": "max(120px, min(100vw - var(--g) * 2, 100vh - var(--g) * 2))",
    "--edge": "calc(50% - var(--side) / 2)",
  } as CSSProperties;

  const rule = "absolute border-dashed border-rule";

  return (
    <div
      ref={chromeRef}
      data-stage-chrome
      className="invisible fixed inset-0 z-20 bg-ink"
      style={style}
    >
      <div data-rule="x0" className={`${rule} border-t`} />
      <div data-rule="x1" className={`${rule} border-t`} />
      <div data-rule="y0" className={`${rule} border-l`} />
      <div data-rule="y1" className={`${rule} border-l`} />

      {/* Top band */}
      <div
        className={`${LABEL} absolute top-0 flex items-center justify-between gap-4 px-4`}
        style={{ left: "var(--edge)", width: "var(--side)", height: "var(--edge)" }}
      >
        <span data-typed className="whitespace-nowrap">
          /Lead — Three.js / GLSL
        </span>
        <button
          data-typed
          type="button"
          onClick={onClose}
          className="cursor-pointer whitespace-nowrap uppercase text-bone transition-colors hover:text-dim"
        >
          Esc — Back to the front page
        </button>
      </div>

      {/* Bottom band */}
      <div
        className={`${LABEL} absolute bottom-0 flex items-center justify-between gap-4 px-4`}
        style={{ left: "var(--edge)", width: "var(--side)", height: "var(--edge)" }}
      >
        <span data-typed className="whitespace-nowrap">
          Fig. 1 — An interactive globe, built to be wandered.
        </span>
        {/* Live text can't be split into chars — it simply appears at "land". */}
        <Clock data-land className="whitespace-nowrap text-bone" />
      </div>

      {/* Side bands — vertical furniture, read bottom-to-top like a spine. */}
      <div
        className={`${LABEL} absolute left-0 flex items-center justify-center`}
        style={{ top: "var(--edge)", height: "var(--side)", width: "var(--edge)" }}
      >
        <span
          data-typed
          className="whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Vol. I · No. 001
        </span>
      </div>
      <div
        className={`${LABEL} absolute right-0 flex items-center justify-center`}
        style={{ top: "var(--edge)", height: "var(--side)", width: "var(--edge)" }}
      >
        <span
          data-typed
          className="whitespace-nowrap"
          style={{ writingMode: "vertical-rl" }}
        >
          Drag to orbit · Wheel to bend · Space to pause
        </span>
      </div>
    </div>
  );
}
