"use client";

import type { Ref } from "react";

import { HIT, LABEL } from "@/components/furniture";
import type { Article } from "@/lib/stage/articles";

/**
 * The periphery of an expanded article: the newspaper's grid, grown to the
 * viewport. The article's box is `--sx --sy --sw --sh` (set by the stage);
 * its four edges extend as dashed hairlines to the screen edges, which
 * leaves four bands around it: the kicker and Esc above, the controls below,
 * and nothing at the sides. Touch screens get their own words for both: no
 * Esc key to name, and swipes rather than a wheel.
 *
 * Rule geometry is set from JS (see Stage.placeRules) so the rule variant can
 * fly them in from the slot's edges. Text carries `data-typed` and is typed
 * in, character by character, once everything has landed. Keyed by article
 * so a change of copy remounts the text nodes.
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
            className={`${HIT} cursor-pointer whitespace-nowrap uppercase text-bone transition-colors hover:text-dim`}
          >
            <span className="pointer-coarse:hidden">Esc — </span>
            <span className="hidden pointer-coarse:inline">← </span>
            Back
          </button>
        </div>

        {/* Bottom band — how to work the art, set right: the docked globe's
            window sits bottom left. The mouse's words are too long for a
            phone's band, so a narrow window with a mouse shows none. */}
        <div
          className={`${band} items-center justify-end gap-4 px-4`}
          style={{
            left: "var(--sx)",
            width: "var(--sw)",
            top: "calc(var(--sy) + var(--sh))",
            bottom: 0,
          }}
        >
          <span data-typed className="whitespace-nowrap max-sm:hidden pointer-coarse:hidden">
            {article.controls}
          </span>
          <span data-typed className="hidden whitespace-nowrap pointer-coarse:inline">
            {article.touch}
          </span>
        </div>
      </div>
    </div>
  );
}
