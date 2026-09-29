"use client";

import type { Ref } from "react";

import Clock from "@/components/Clock";
import { LABEL } from "@/components/furniture";
import type { Article } from "@/lib/stage/articles";


/**
 * The periphery of an expanded article: the newspaper's grid, grown to the
 * viewport. The article's box is `--sx --sy --sw --sh` (set by the stage);
 * its four edges extend as dashed hairlines to the screen edges, which
 * leaves four bands around it for furniture.
 *
 * Rule geometry is set from JS (see Stage.placeRules) so the rule variant can
 * fly them in from the slot's edges. Text carries `data-typed` and is typed
 * in, character by character, once everything has landed; `data-land` text
 * simply appears then (the clock, whose content changes every second, can't
 * be split). Keyed by article so a change of copy remounts the text nodes.
 */
export default function StageChrome({
  chromeRef,
  article,
  onClose,
}: {
  chromeRef: Ref<HTMLDivElement>;
  article: Article;
  onClose: () => void;
}) {
  const rule = "absolute border-dashed border-rule";
  const band = `${LABEL} absolute flex`;

  return (
    <div ref={chromeRef} data-stage-chrome className="invisible fixed inset-0 z-20 bg-ink">
      <div data-rule="x0" className={`${rule} border-t`} />
      <div data-rule="x1" className={`${rule} border-t`} />
      <div data-rule="y0" className={`${rule} border-l`} />
      <div data-rule="y1" className={`${rule} border-l`} />

      <div key={article.id} className="contents">
        {/* Top band */}
        <div
          className={`${band} items-center justify-between gap-4 px-4`}
          style={{ left: "var(--sx)", width: "var(--sw)", top: 0, height: "var(--sy)" }}
        >
          <span data-typed className="whitespace-nowrap">
            {article.kicker}
          </span>
          <button
            data-typed
            type="button"
            onClick={onClose}
            className="cursor-pointer whitespace-nowrap uppercase text-bone transition-colors hover:text-dim"
          >
            <span className="max-sm:hidden">Esc — Back to the front page</span>
            <span className="sm:hidden">Esc — Back</span>
          </button>
        </div>

        {/* Bottom band */}
        <div
          className={`${band} items-center justify-between gap-4 px-4`}
          style={{
            left: "var(--sx)",
            width: "var(--sw)",
            top: "calc(var(--sy) + var(--sh))",
            bottom: 0,
          }}
        >
          <span data-typed className={`sm:whitespace-nowrap ${article.phoneCaption === false ? "max-sm:hidden" : ""}`}>
            {article.caption}
          </span>
          <Clock data-land className="ml-auto whitespace-nowrap text-bone" />
        </div>

        {/* Side bands — vertical furniture, read bottom-to-top like a spine. */}
        {article.spines !== false && (
          <>
            <div
              className={`${band} items-center justify-center`}
              style={{ left: 0, width: "var(--sx)", top: "var(--sy)", height: "var(--sh)" }}
            >
              <span
                data-typed
                className="whitespace-nowrap max-sm:hidden"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Vol. I · No. 001
              </span>
            </div>
            <div
              className={`${band} items-center justify-center`}
              style={{
                left: "calc(var(--sx) + var(--sw))",
                right: 0,
                top: "var(--sy)",
                height: "var(--sh)",
              }}
            >
              <span data-typed className="whitespace-nowrap max-sm:hidden" style={{ writingMode: "vertical-rl" }}>
                {article.controls}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
