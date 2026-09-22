"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import Newspaper from "@/components/Newspaper";
import StageChrome from "@/components/StageChrome";
import GlobeCanvas from "@/lib/three/GlobeCanvas";
import {
  type Box,
  type Variant,
  EASE,
  Flip,
  INSET_NONE,
  SplitText,
  T,
  VARIANTS,
  box,
  gsap,
  insetTo,
  place,
  prefersReducedMotion,
  pushDistance,
  stageBox,
  useGSAP,
} from "@/lib/stage/motion";

const GLOBE_ROUTE = "/globe";
const FX_KEY = "avi-site:fx";
type PushDir = "up" | "right" | "down";

/**
 * The front page and its one expandable article.
 *
 * The URL is the state: `/` is the newspaper, `/globe` is the globe filling
 * the screen. Opening is a real router navigation; this component lives in
 * the (site) layout so nothing remounts and the globe is one <canvas> for
 * the life of the page.
 *
 * Layers, bottom to top:
 *   <main>        the newspaper (z-0)
 *   <StageChrome> the fullscreen periphery (z-20), clip-masked during flight
 *   globe layer   (z-30) — over its slot, or fixed to the viewport centre
 */
export default function Stage() {
  const router = useRouter();
  const pathname = usePathname();
  const expanded = pathname === GLOBE_ROUTE;

  const [fx, setFx] = useState<Variant>("iris");
  const fxRef = useRef<Variant>("iris");

  const mainRef = useRef<HTMLElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const expandedRef = useRef(expanded);
  const mounted = useRef(false);
  const openedFromHome = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const splitsRef = useRef<SplitText[] | null>(null);


  // --- Prototype switch ---------------------------------------------------

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FX_KEY) as Variant | null;
      if (saved && VARIANTS.includes(saved)) {
        setFx(saved);
        fxRef.current = saved;
      }
    } catch {}
  }, []);

  const toggleFx = useCallback(() => {
    const next = VARIANTS[(VARIANTS.indexOf(fxRef.current) + 1) % VARIANTS.length];
    fxRef.current = next;
    setFx(next);
    try {
      window.localStorage.setItem(FX_KEY, next);
    } catch {}
  }, []);

  // --- Queries -----------------------------------------------------------

  const q = useCallback(() => {
    const chrome = chromeRef.current!;
    return {
      rules: {
        x0: chrome.querySelector<HTMLElement>('[data-rule="x0"]')!,
        x1: chrome.querySelector<HTMLElement>('[data-rule="x1"]')!,
        y0: chrome.querySelector<HTMLElement>('[data-rule="y0"]')!,
        y1: chrome.querySelector<HTMLElement>('[data-rule="y1"]')!,
      },
      typed: [...chrome.querySelectorAll<HTMLElement>("[data-typed]")],
      landed: [...chrome.querySelectorAll<HTMLElement>("[data-land]")],
      pushed: [...rootRef.current!.querySelectorAll<HTMLElement>("main [data-push]")],
    };
  }, []);

  /** SplitText once; the chars are reused by every timeline. */
  const chars = useCallback(() => {
    splitsRef.current ??= q().typed.map((el) => SplitText.create(el, { type: "chars" }));
    return splitsRef.current.flatMap((s) => s.chars);
  }, [q]);

  // --- Placement -----------------------------------------------------------

  /** Rules along a box's four edges, running the full viewport when `full`. */
  const placeRules = useCallback((rules: ReturnType<typeof q>["rules"], b: Box, full: boolean) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const x = full ? { left: 0, width: W } : { left: b.left, width: b.width };
    const y = full ? { top: 0, height: H } : { top: b.top, height: b.height };
    Object.assign(rules.x0.style, { top: `${b.top}px`, left: `${x.left}px`, width: `${x.width}px`, height: "0px" });
    Object.assign(rules.x1.style, { top: `${b.top + b.height}px`, left: `${x.left}px`, width: `${x.width}px`, height: "0px" });
    Object.assign(rules.y0.style, { left: `${b.left}px`, top: `${y.top}px`, height: `${y.height}px`, width: "0px" });
    Object.assign(rules.y1.style, { left: `${b.left + b.width}px`, top: `${y.top}px`, height: `${y.height}px`, width: "0px" });
  }, []);

  /** The globe in its collapsed place, scrolling with the page. */
  const placeHome = useCallback(() => {
    const layer = layerRef.current;
    const slot = slotRef.current;
    if (!layer || !slot) return;
    gsap.set(layer, { clearProps: "transform" });
    place(layer, box(slot.getBoundingClientRect()), "doc");
  }, []);

  /** The globe and rules in their expanded place. */
  const placeStage = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const b = stageBox();
    place(layer, b, "fixed");
    placeRules(q().rules, b, true);
  }, [q, placeRules]);

  useLayoutEffect(() => {
    const replace = () => {
      if (tlRef.current?.isActive()) return; // leave a flight alone
      if (expandedRef.current) placeStage();
      else placeHome();
    };
    replace();
    const ro = new ResizeObserver(replace);
    if (slotRef.current) ro.observe(slotRef.current);
    if (mainRef.current) ro.observe(mainRef.current);
    window.addEventListener("resize", replace);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", replace);
    };
  }, [placeHome, placeStage]);

  // --- Timelines -----------------------------------------------------------

  /**
   * The open, built from wherever the globe currently is. Paused; the caller
   * plays it. Leaves the chrome visible and the globe on the stage (visually
   * still home, at progress 0).
   */
  const buildOpen = useCallback(
    (variant: Variant) => {
      const main = mainRef.current!;
      const layer = layerRef.current!;
      const chrome = chromeRef.current!;
      const slot = slotRef.current!;
      const { rules, landed, pushed } = q();
      const cs = chars();

      const slotBox = box(slot.getBoundingClientRect());
      const state = Flip.getState(layer);
      chrome.style.visibility = "visible";
      placeStage();

      let ruleFrom: Flip.FlipState | null = null;
      if (variant === "rule") {
        placeRules(rules, slotBox, false);
        ruleFrom = Flip.getState(Object.values(rules));
        placeRules(rules, stageBox(), true);
      }

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: EASE.travel },
        onComplete: () => {
          if (expandedRef.current) main.style.visibility = "hidden";
        },
      });
      tl.addLabel("fly", T.flyAt).addLabel("land", T.landAt);
      tl.add(Flip.from(state, { duration: T.fly, ease: EASE.travel }), "fly");
      tl.fromTo(
        chrome,
        { clipPath: insetTo(slotBox) },
        { clipPath: INSET_NONE, duration: T.fly },
        "fly"
      );
      if (ruleFrom) {
        tl.add(Flip.from(ruleFrom, { duration: T.fly, ease: EASE.travel }), "fly");
        tl.to(
          pushed,
          {
            x: (_, el: HTMLElement) => pushDistance(el, el.dataset.push as PushDir).x,
            y: (_, el: HTMLElement) => pushDistance(el, el.dataset.push as PushDir).y,
            duration: T.fly,
          },
          "fly"
        );
      }
      tl.fromTo(
        cs,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.01, stagger: { each: T.type / cs.length } },
        "land"
      );
      tl.fromTo(landed, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, "land");
      return tl;
    },
    [q, chars, placeStage, placeRules]
  );

  /** The close, from the stage back home. Plays immediately. */
  const buildClose = useCallback(
    (variant: Variant) => {
      const layer = layerRef.current!;
      const chrome = chromeRef.current!;
      const slot = slotRef.current!;
      const { rules, landed, pushed } = q();
      const cs = chars();
      const slotBox = box(slot.getBoundingClientRect());

      const state = Flip.getState(layer);
      const ruleFrom = variant === "rule" ? Flip.getState(Object.values(rules)) : null;
      // The slot sits inside sections the rule variant has pushed away —
      // measure with the push undone, then put it back so the timeline can
      // animate it home.
      const offsets = pushed.map((el) => ({
        x: gsap.getProperty(el, "x") as number,
        y: gsap.getProperty(el, "y") as number,
      }));
      gsap.set(pushed, { x: 0, y: 0 });
      placeHome();
      pushed.forEach((el, i) => gsap.set(el, offsets[i]));
      if (ruleFrom) placeRules(rules, slotBox, false);

      const tl = gsap.timeline({
        defaults: { ease: EASE.travel },
        onComplete: () => {
          if (!expandedRef.current) {
            chrome.style.visibility = "hidden";
            gsap.set(pushed, { clearProps: "transform" });
            placeHome();
          }
        },
      });
      tl.timeScale(T.closeSpeed);
      tl.addLabel("lift", 0).addLabel("fly", T.flyAt);
      tl.to(cs, { autoAlpha: 0, duration: 0.01, stagger: { each: 0.15 / cs.length, from: "end" } }, "lift");
      tl.to(landed, { autoAlpha: 0, duration: 0.15 }, "lift");
      tl.add(Flip.from(state, { duration: T.fly, ease: EASE.travel }), "lift");
      tl.fromTo(chrome, { clipPath: INSET_NONE }, { clipPath: insetTo(slotBox), duration: T.fly }, "lift");
      if (ruleFrom) {
        tl.add(Flip.from(ruleFrom, { duration: T.fly, ease: EASE.travel }), "lift");
        tl.to(pushed, { x: 0, y: 0, duration: T.fly }, "lift");
      }
      return tl;
    },
    [q, chars, placeHome, placeRules]
  );

  // --- Navigation ----------------------------------------------------------

  useEffect(() => {
    router.prefetch(GLOBE_ROUTE);
    router.prefetch("/");
  }, [router]);

  const open = useCallback(() => {
    openedFromHome.current = true;
    router.push(GLOBE_ROUTE);
  }, [router]);

  const close = useCallback(() => {
    if (openedFromHome.current) router.back();
    else router.push("/");
    openedFromHome.current = false;
  }, [router]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, close]);

  // --- The route transition --------------------------------------------------

  useGSAP(
    () => {
      expandedRef.current = expanded;
      const main = mainRef.current;
      const layer = layerRef.current;
      const chrome = chromeRef.current;
      if (!main || !layer || !chrome) return;

      const html = document.documentElement;
      const variant = fxRef.current;
      const { pushed, landed } = q();

      tlRef.current?.kill();
      const instant = !mounted.current || prefersReducedMotion();
      mounted.current = true;

      if (expanded) {
        html.style.overflow = "hidden";
        main.inert = true;
        chrome.style.visibility = "visible";

        if (instant) {
          placeStage();
          gsap.set(chrome, { clipPath: INSET_NONE });
          gsap.set([chars(), landed], { autoAlpha: 1 });
          main.style.visibility = "hidden";
          return;
        }
        tlRef.current = buildOpen(variant).play();
      } else {
        html.style.overflow = "";
        main.inert = false;
        main.style.visibility = "";

        if (instant) {
          placeHome();
          chrome.style.visibility = "hidden";
          gsap.set(pushed, { clearProps: "transform" });
          return;
        }
        tlRef.current = buildClose(variant);
      }
    },
    { dependencies: [expanded], scope: rootRef }
  );

  return (
    <div ref={rootRef} className="contents">
      <Newspaper
        mainRef={mainRef}
        slotRef={slotRef}
        onOpenGlobe={open}
        fx={fx}
        onToggleFx={toggleFx}
      />
      <StageChrome chromeRef={chromeRef} onClose={close} />

      {/* Double-click opens too: a single click belongs to orbiting, and a
          drag never produces a dblclick, so the two don't compete. */}
      <div
        ref={layerRef}
        data-globe-layer
        className="invisible absolute z-30"
        onDoubleClick={() => {
          if (!expandedRef.current) open();
        }}
      >
        <GlobeCanvas />
      </div>
    </div>
  );
}
