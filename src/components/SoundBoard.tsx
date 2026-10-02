"use client";

import { useEffect } from "react";

import { pluckSeam } from "@/lib/ascii/fields";
import { ARTICLE_NOTES, sfx } from "@/lib/sound/sfx";

/**
 * Listens to the whole document and gives each thing its sound (see
 * lib/sound/sfx.ts), so no component has to know about audio:
 *
 *   an article, page side   its note on hover — the section and the art's
 *                           layer over it count as one thing
 *   a link or a button      a tap on hover (fundomo's list hover)
 *   anything pressable      a press
 *   [data-sfx="clock"]      the masthead clock: ticking while hovered
 *   [data-sfx="seam"]       the strip between the letter and the work: it
 *                           ripples where the cursor crosses it (silently)
 *
 * Hover sounds come from a mouse or pen, and from keyboard focus; a tap only
 * presses.
 */

interface Hit {
  key: unknown;
  enter: () => void;
  leave?: () => void;
}

const PRESSABLE =
  'button, a[href], [role="link"], [data-article], [data-layer]:not([data-open="true"]):not([data-docked="true"])';

/** The seam ripples once each time the cursor crosses into a new thirteenth of it. */
const FRETS = 13;

function resolve(target: EventTarget | null): Hit | null {
  if (!(target instanceof Element)) return null;

  const control = target.closest("button, a[href]");
  if (control) return { key: control, enter: () => sfx.tap() };

  const tagged = target.closest<HTMLElement>("[data-sfx]");
  if (tagged?.dataset.sfx === "clock") return { key: tagged, enter: () => sfx.clockOn(), leave: () => sfx.clockOff() };
  if (tagged?.dataset.sfx === "seam") return { key: tagged, enter: () => {} };

  const layer = target.closest<HTMLElement>("[data-layer]");
  if (layer) {
    if (layer.dataset.open === "true" || layer.dataset.docked === "true") return null;
    const id = layer.dataset.layer!;
    return { key: `article:${id}`, enter: () => sfx.ping(ARTICLE_NOTES[id]) };
  }
  const article = target.closest<HTMLElement>("[data-article]");
  if (article) {
    const id = article.dataset.article!;
    return { key: `article:${id}`, enter: () => sfx.ping(ARTICLE_NOTES[id]) };
  }
  return null;
}

export default function SoundBoard() {
  useEffect(() => {
    sfx.restore();

    let current: Hit | null = null;
    const become = (next: Hit | null) => {
      if (next?.key === current?.key) return;
      current?.leave?.();
      current = next;
      next?.enter();
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      become(resolve(e.target));
    };
    const out = (e: PointerEvent) => {
      // Leaving the window altogether.
      if (!e.relatedTarget) become(null);
    };
    const focus = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(":focus-visible")) become(resolve(e.target));
    };

    // The seam: a ripple each time the cursor crosses into a new fret.
    let fret = -1;
    const strum = (e: PointerEvent, tap = false) => {
      const seam = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-sfx="seam"]') : null;
      if (!seam) {
        fret = -1;
        return;
      }
      const r = seam.getBoundingClientRect();
      const f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.9999);
      const k = Math.floor(f * FRETS);
      if (k === fret && !tap) return;
      fret = k;
      // The field's x: the panel maps its width onto units of its height.
      pluckSeam((f - 0.5) * (r.width / r.height) + 0.5);
    };
    const move = (e: PointerEvent) => strum(e);

    const down = (e: PointerEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-sfx="seam"]')) return strum(e, true);
      if (e.target.closest(PRESSABLE)) sfx.press();
    };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", down);
    document.addEventListener("focusin", focus);
    return () => {
      become(null);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("focusin", focus);
    };
  }, []);

  return null;
}
