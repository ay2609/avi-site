"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { LABEL } from "@/components/furniture";
import { prefersReducedMotion } from "@/lib/stage/motion";
import { sfx } from "@/lib/sound/sfx";

/** The meter's characters, quiet to loud — the ASCII fields' own ramp. */
const RAMP = ".:-=+*#%";
const CELLS = 10;

/**
 * The masthead's sound switch, with a meter that reads what's actually
 * coming out of the speakers: one character per 70ms, scrolling left.
 * Turning it on flickers the name like a tube catching.
 */
export default function SoundToggle() {
  const on = useSyncExternalStore(
    (f) => sfx.subscribe(f),
    () => sfx.enabled,
    () => false
  );
  const meterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = meterRef.current;
    if (!el) return;
    const idle = RAMP[0].repeat(CELLS);
    if (!on) {
      el.textContent = idle;
      return;
    }
    const history: number[] = new Array(CELLS).fill(0);
    let buf: Float32Array<ArrayBuffer> | null = null;
    const id = window.setInterval(() => {
      const a = sfx.analyser;
      let level = 0;
      if (a) {
        if (!buf || buf.length !== a.fftSize) buf = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        // Gated under the echo's tail, then a curve so quiet ticks still register.
        level = rms < 0.003 ? 0 : Math.min(1, Math.sqrt(rms) * 2.2);
      }
      history.shift();
      history.push(level);
      el.textContent = history.map((v) => RAMP[Math.round(v * (RAMP.length - 1))]).join("");
    }, 70);
    return () => window.clearInterval(id);
  }, [on]);

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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title="Every sound on this page is synthesized live in your browser"
      className={`${LABEL} flex items-baseline gap-3 transition-colors hover:text-bone`}
    >
      <span>
        Sound — <span className={on ? "text-bone" : ""}>{on ? "On" : "Off"}</span>
      </span>
      <span ref={meterRef} aria-hidden className={`whitespace-pre ${on ? "text-bone" : "opacity-50"}`}>
        {RAMP[0].repeat(CELLS)}
      </span>
    </button>
  );
}
