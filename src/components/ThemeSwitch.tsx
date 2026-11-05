"use client";

import { HIT, LABEL } from "@/components/furniture";
import { type Theme, switchTheme, useTheme } from "@/lib/theme/light";

const OPTIONS: readonly [Theme, string][] = [
  ["dark", "Dark"],
  ["light", "Light"],
];

/**
 * Light and dark, in the masthead and in the top band of every open article:
 * two words, the current one lit and marked with a filled dot. Either word
 * flips to the other theme (Nov 4), so a reader can't click and see nothing
 * happen. A first visit is dark (see lib/theme); a choice here is remembered,
 * and the globe bends to match it.
 */
export default function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div role="group" aria-label="Theme" className={`${LABEL} flex items-baseline gap-4`}>
      {OPTIONS.map(([value, name]) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => switchTheme(theme === "dark" ? "light" : "dark")}
            className={`${HIT} cursor-pointer uppercase tracking-[0.18em] transition-colors ${
              on ? "text-bone" : "hover:text-bone"
            }`}
          >
            <span aria-hidden>{on ? "● " : "○ "}</span>
            {name}
          </button>
        );
      })}
    </div>
  );
}
