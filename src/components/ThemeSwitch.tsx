"use client";

import { HIT, LABEL } from "@/components/furniture";
import { type Theme, switchTheme, useTheme } from "@/lib/theme/light";

const OPTIONS: readonly [Theme, string][] = [
  ["light", "Light"],
  ["dark", "Dark"],
];

/**
 * The masthead's light and dark: two words, the current one lit and marked
 * with a filled dot. A first visit follows the system (see lib/theme); a
 * choice here is remembered, and the globe bends to match it.
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
            onClick={() => switchTheme(value)}
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
