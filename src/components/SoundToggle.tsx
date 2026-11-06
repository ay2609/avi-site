"use client";

import { useSyncExternalStore } from "react";

import EndMark from "@/components/EndMark";
import { prefersReducedMotion } from "@/lib/stage/motion";
import { sfx } from "@/lib/sound/sfx";

/**
 * The sound switch is the end mark at the foot of the page (Nov 6; it was a
 * "Sound — Off" label with a level meter in the masthead). Off, it's the mark
 * as it was; on, it inverts, the mark cut out of a bone square like the
 * walkthroughs' key tiles. Turning it on flickers the name like a tube
 * catching.
 */
export default function SoundToggle() {
  const on = useSyncExternalStore(
    (f) => sfx.subscribe(f),
    () => sfx.enabled,
    () => false
  );

  const toggle = () => {
    const next = !sfx.enabled;
    sfx.toggle();
    if (!next || prefersReducedMotion()) return;
    // The name catches like a tube: hard steps, no fades.
    document.querySelector<HTMLElement>("[data-masthead]")?.animate(
      [1, 0.15, 1, 0.3, 1, 0.1, 0.8, 1].map((opacity) => ({ opacity, easing: "step-end" })),
      { duration: 520 }
    );
  };

  // The square bleeds 4px past the mark on every side, so the bar keeps its height; the ::after makes it 44px to tap.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label="Sound"
      title={`Sound ${on ? "on" : "off"}: every sound on this page is synthesized live in your browser`}
      className={`relative -m-1 flex cursor-pointer p-1 after:absolute after:-inset-3 after:content-[''] ${
        on ? "bg-bone text-ink" : "text-bone hover:text-dim"
      }`}
    >
      <EndMark size={20} className="block" />
    </button>
  );
}
