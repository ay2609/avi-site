"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import Newspaper from "@/components/Newspaper";
import StageChrome from "@/components/StageChrome";
import GlobeCanvas from "@/lib/three/GlobeCanvas";
import SolidCanvas from "@/lib/three/SolidCanvas";
import { ARTICLES, ARTICLE_IDS, type ArticleId, articleForPath } from "@/lib/stage/articles";
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

const FX_KEY = "avi-site:fx";
type PushDir = "up" | "right" | "down";

/**
 * An article's art, at document level. Sits over its slot in the newspaper
 * (absolute, scrolls with the page) or fixed to the stage. Double-click opens
 * it — a single click belongs to the art's own interaction, and a drag never
 * produces a dblclick, so the two don't compete.
 */
function Layer({
  id,
  layerRef,
  open,
  staged,
  ring,
  onOpen,
  children,
}: {
  id: ArticleId;
  layerRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  /** Dressed on the stage — open, or still closing. Above the chrome; the rest sit beneath it. */
  staged: boolean;
  /**
   * Draw the hover ring around the layer itself (the globe, whose slot is the
   * whole box). Articles drawn by `Article` ring their entire section instead
   * and only need the hover mirrored onto it, since this layer takes the
   * pointer over the art.
   */
  ring: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const mirror = (on: boolean) => {
    const section = document.querySelector<HTMLElement>(`[data-article="${id}"]`);
    if (!section) return;
    if (on && !open) section.setAttribute("data-hover", "");
    else section.removeAttribute("data-hover");
  };
  return (
    <div
      ref={layerRef}
      data-layer={id}
      data-open={open}
      className={`group invisible absolute ${staged ? "z-30" : "z-10"}`}
      onDoubleClick={() => {
        if (!open) onOpen();
      }}
      onPointerEnter={() => mirror(true)}
      onPointerLeave={() => mirror(false)}
    >
      {children}
      {ring && (
        /* Hover ring: a solid bone hairline that fades in over the section's
           dashed rules. Bled 1px so it sits exactly on the rules around the
           slot; hidden on the stage, whose rules are elsewhere. */
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-px top-0 -bottom-px border border-bone opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-data-[open=true]:hidden"
        />
      )}
    </div>
  );
}

/**
 * The front page and its expandable articles.
 *
 * The URL is the state: `/` is the newspaper, an article's route is that
 * article filling the screen. Opening is a real router navigation; this
 * component lives in the (site) layout so nothing remounts and each canvas
 * lives once for the life of the page.
 *
 * Layers, bottom to top:
 *   <main>        the newspaper (z-0)
 *   <StageChrome> the fullscreen periphery (z-20), clip-masked during flight
 *   art layers    (z-30) — over their slots, or the open one fixed to the stage
 */
export default function Stage() {
  const router = useRouter();
  const pathname = usePathname();
  const openId = articleForPath(pathname);

  const [fx, setFx] = useState<Variant>("iris");
  const fxRef = useRef<Variant>("iris");

  const mainRef = useRef<HTMLElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<ArticleId, RefObject<HTMLDivElement | null>>>({
    globe: { current: null },
    watch: { current: null },
  }).current;
  const layerRefs = useRef<Record<ArticleId, RefObject<HTMLDivElement | null>>>({
    globe: { current: null },
    watch: { current: null },
  }).current;

  const openRef = useRef<ArticleId | null>(openId);
  /** The article the chrome is dressed for: the open one, or the last opened while closing. */
  const stagedRef = useRef<ArticleId>(openId ?? "globe");
  if (openId) stagedRef.current = openId;
  const staged = ARTICLES[stagedRef.current];

  const mounted = useRef(false);
  const openedFromHome = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const splitsRef = useRef<{ id: ArticleId; splits: SplitText[] } | null>(null);

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

  /** SplitText for the staged article's copy; redone when the copy changes. */
  const chars = useCallback(() => {
    const id = stagedRef.current;
    if (splitsRef.current?.id !== id) {
      splitsRef.current?.splits.forEach((s) => s.revert());
      splitsRef.current = { id, splits: q().typed.map((el) => SplitText.create(el, { type: "chars" })) };
    }
    return splitsRef.current.splits.flatMap((s) => s.chars);
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

  /** An article's layer in its collapsed place, scrolling with the page. */
  const placeHome = useCallback((id: ArticleId) => {
    const layer = layerRefs[id].current;
    const slot = slotRefs[id].current;
    if (!layer || !slot) return;
    gsap.set(layer, { clearProps: "transform" });
    place(layer, box(slot.getBoundingClientRect()), "doc");
  }, [layerRefs, slotRefs]);

  /** An article's layer, the rules and the chrome's bands in their expanded place. */
  const placeStage = useCallback(
    (id: ArticleId) => {
      const layer = layerRefs[id].current;
      const chrome = chromeRef.current;
      if (!layer || !chrome) return;
      const b = stageBox(ARTICLES[id].aspect);
      place(layer, b, "fixed");
      placeRules(q().rules, b, true);
      chrome.style.setProperty("--sx", `${b.left}px`);
      chrome.style.setProperty("--sy", `${b.top}px`);
      chrome.style.setProperty("--sw", `${b.width}px`);
      chrome.style.setProperty("--sh", `${b.height}px`);
    },
    [layerRefs, q, placeRules]
  );

  const placeAll = useCallback(() => {
    for (const id of ARTICLE_IDS) {
      if (id === openRef.current) placeStage(id);
      else placeHome(id);
    }
  }, [placeHome, placeStage]);

  useLayoutEffect(() => {
    const replace = () => {
      if (tlRef.current?.isActive()) return; // leave a flight alone
      placeAll();
    };
    replace();
    const ro = new ResizeObserver(replace);
    for (const id of ARTICLE_IDS) if (slotRefs[id].current) ro.observe(slotRefs[id].current!);
    if (mainRef.current) ro.observe(mainRef.current);
    window.addEventListener("resize", replace);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", replace);
    };
  }, [placeAll, slotRefs]);

  // --- Timelines -----------------------------------------------------------

  /**
   * The open, built from wherever the article currently is. Paused; the
   * caller plays it. Leaves the chrome visible and the art on the stage
   * (visually still home, at progress 0).
   */
  const buildOpen = useCallback(
    (id: ArticleId, variant: Variant) => {
      const main = mainRef.current!;
      const layer = layerRefs[id].current!;
      const chrome = chromeRef.current!;
      const slot = slotRefs[id].current!;
      const { rules, landed, pushed } = q();
      const cs = chars();

      const slotBox = box(slot.getBoundingClientRect());
      const state = Flip.getState(layer);
      chrome.style.visibility = "visible";
      placeStage(id);

      let ruleFrom: Flip.FlipState | null = null;
      if (variant === "rule") {
        placeRules(rules, slotBox, false);
        ruleFrom = Flip.getState(Object.values(rules));
        placeRules(rules, stageBox(ARTICLES[id].aspect), true);
      }

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: EASE.travel },
        onComplete: () => {
          if (openRef.current) main.style.visibility = "hidden";
        },
      });
      tl.addLabel("fly", T.flyAt).addLabel("land", T.landAt);
      tl.add(Flip.from(state, { duration: T.fly, ease: EASE.travel }), "fly");
      tl.fromTo(chrome, { clipPath: insetTo(slotBox) }, { clipPath: INSET_NONE, duration: T.fly }, "fly");
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
      tl.fromTo(cs, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, stagger: { each: T.type / cs.length } }, "land");
      tl.fromTo(landed, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, "land");
      return tl;
    },
    [layerRefs, slotRefs, q, chars, placeStage, placeRules]
  );

  /** The close, from the stage back home. Plays immediately. */
  const buildClose = useCallback(
    (id: ArticleId, variant: Variant) => {
      const layer = layerRefs[id].current!;
      const chrome = chromeRef.current!;
      const slot = slotRefs[id].current!;
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
      placeHome(id);
      pushed.forEach((el, i) => gsap.set(el, offsets[i]));
      if (ruleFrom) placeRules(rules, slotBox, false);

      const tl = gsap.timeline({
        defaults: { ease: EASE.travel },
        onComplete: () => {
          if (!openRef.current) {
            chrome.style.visibility = "hidden";
            gsap.set(pushed, { clearProps: "transform" });
            placeAll();
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
    [layerRefs, slotRefs, q, chars, placeHome, placeRules, placeAll]
  );

  // --- Navigation ----------------------------------------------------------

  useEffect(() => {
    for (const id of ARTICLE_IDS) router.prefetch(ARTICLES[id].route);
    router.prefetch("/");
  }, [router]);

  const open = useCallback(
    (id: ArticleId) => {
      openedFromHome.current = true;
      document.querySelector(`[data-article="${id}"]`)?.removeAttribute("data-hover");
      router.push(ARTICLES[id].route);
    },
    [router]
  );

  const close = useCallback(() => {
    if (openedFromHome.current) router.back();
    else router.push("/");
    openedFromHome.current = false;
  }, [router]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  // --- The route transition --------------------------------------------------

  useGSAP(
    () => {
      const prev = openRef.current;
      openRef.current = openId;
      const main = mainRef.current;
      const chrome = chromeRef.current;
      if (!main || !chrome) return;

      const html = document.documentElement;
      const variant = fxRef.current;
      const { pushed, landed } = q();

      tlRef.current?.kill();
      // First paint, reduced motion, or a jump straight from one article to
      // another (browser history): no flight, just the right placements.
      const instant = !mounted.current || prefersReducedMotion() || (prev && openId && prev !== openId);
      mounted.current = true;

      if (openId) {
        html.style.overflow = "hidden";
        main.inert = true;
        chrome.style.visibility = "visible";

        if (instant) {
          placeAll();
          gsap.set(chrome, { clipPath: INSET_NONE });
          gsap.set([chars(), landed], { autoAlpha: 1 });
          main.style.visibility = "hidden";
          return;
        }
        tlRef.current = buildOpen(openId, variant).play();
      } else {
        html.style.overflow = "";
        main.inert = false;
        main.style.visibility = "";

        if (instant || !prev) {
          placeAll();
          chrome.style.visibility = "hidden";
          gsap.set(pushed, { clearProps: "transform" });
          return;
        }
        tlRef.current = buildClose(prev, variant);
      }
    },
    { dependencies: [openId], scope: rootRef }
  );

  return (
    <div ref={rootRef} className="contents">
      <Newspaper mainRef={mainRef} slotRefs={slotRefs} onOpen={open} fx={fx} onToggleFx={toggleFx} />
      <StageChrome chromeRef={chromeRef} article={staged} onClose={close} />

      <Layer
        id="globe"
        layerRef={layerRefs.globe}
        open={openId === "globe"}
        staged={staged.id === "globe"}
        ring
        onOpen={() => open("globe")}
      >
        <GlobeCanvas />
      </Layer>
      <Layer
        id="watch"
        layerRef={layerRefs.watch}
        open={openId === "watch"}
        staged={staged.id === "watch"}
        ring={false}
        onOpen={() => open("watch")}
      >
        {/* The watch's PCB with its components, from the STL (packed by
            scripts/stl-to-mesh.py), on a turntable. */}
        <SolidCanvas src="/watch-esp.mesh" />
      </Layer>
    </div>
  );
}
