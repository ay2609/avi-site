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
import Backdrop, { BACKDROP, spotFor } from "@/components/Backdrop";
import LiveIcon from "@/components/LiveIcon";
import SoundBoard from "@/components/SoundBoard";
import StageChrome from "@/components/StageChrome";
import { LABEL } from "@/components/furniture";
import FractalArticle from "@/components/FractalArticle";
import WatchArticle from "@/components/WatchArticle";
import GlobeCanvas from "@/lib/three/GlobeCanvas";
import { ARTICLES, ARTICLE_IDS, type ArticleId, articleForPath } from "@/lib/stage/articles";
import { useOpenOnClick } from "@/lib/stage/click";
import { sfx } from "@/lib/sound/sfx";
import {
  type Box,
  type Variant,
  EASE,
  Flip,
  INSET_NONE,
  MINI,
  SplitText,
  T,
  box,
  gsap,
  insetTo,
  miniBox,
  place,
  prefersReducedMotion,
  pushDistance,
  stageBox,
  useGSAP,
} from "@/lib/stage/motion";

/** The transition (see motion.ts): "iris", or "rule" for the rule cut. */
const FX: Variant = "iris";
type PushDir = "up" | "right" | "down";

/** A backdrop sits under every art layer on the page, over the chrome on the stage. */
function raiseBackdrop(el: HTMLElement, staged: boolean) {
  gsap.set(el, staged ? { zIndex: 25 } : { clearProps: "zIndex" });
}

/**
 * An article's art, at document level. Sits over its slot in the newspaper
 * (absolute, scrolls with the page) or fixed to the stage. On the page a
 * single click opens it — not the end of a drag (the globe orbits there); on
 * the stage clicks belong to the art (see useOpenOnClick, and `open` in Stage
 * for clicks mid-flight).
 */
function Layer({
  id,
  layerRef,
  open,
  staged,
  ring,
  docked = false,
  framed = false,
  onOpen,
  onHover,
  children,
}: {
  id: ArticleId;
  layerRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  /**
   * The globe, docked in its window while another article is open: it keeps
   * its input to itself (the article listens on the window for wheel and
   * swipes) and a click doesn't open it.
   */
  docked?: boolean;
  /** Docked and landed: the window's frame shows. */
  framed?: boolean;
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
  /** Pointer over the art on the page (the stage's backdrop previews in the slot). */
  onHover?: (on: boolean) => void;
  children: ReactNode;
}) {
  const click = useOpenOnClick(open || docked ? undefined : onOpen);
  const keep = docked ? (e: { stopPropagation(): void }) => e.stopPropagation() : undefined;
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
      data-docked={docked}
      data-framed={framed}
      className={`group invisible absolute ${staged ? "z-30" : "z-10"} ${open || docked ? "" : "cursor-pointer"}`}
      onPointerDownCapture={click.onPointerDownCapture}
      onClick={click.onClick}
      onWheel={keep}
      onTouchStart={keep}
      onTouchMove={keep}
      onPointerEnter={() => {
        mirror(true);
        onHover?.(true);
      }}
      onPointerLeave={() => {
        mirror(false);
        onHover?.(false);
      }}
    >
      {children}
      {ring && (
        /* Hover ring: a solid bone hairline that flickers on over the section's
           dashed rules. Bled 1px so it sits exactly on the rules around the
           slot (the masthead's above the globe); hidden on the stage, whose
           rules are elsewhere. */
        <div
          aria-hidden
          className="ring-flicker pointer-events-none absolute -inset-px border border-bone group-data-[open=true]:hidden group-data-[docked=true]:hidden"
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

  /** The article whose flight has finished — its own furniture and input come on then. */
  const [landedId, setLandedId] = useState<ArticleId | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<ArticleId, RefObject<HTMLDivElement | null>>>({
    globe: { current: null },
    watch: { current: null },
    fractals: { current: null },
  }).current;
  const layerRefs = useRef<Record<ArticleId, RefObject<HTMLDivElement | null>>>({
    globe: { current: null },
    watch: { current: null },
    fractals: { current: null },
  }).current;

  const openRef = useRef<ArticleId | null>(openId);
  /** The article the chrome is dressed for: the open one, or the last opened while closing. */
  const stagedRef = useRef<ArticleId>(openId ?? "globe");
  if (openId) stagedRef.current = openId;
  const staged = ARTICLES[stagedRef.current];

  const mounted = useRef(false);
  const openedFromHome = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  /** The headline in flight between the newspaper and the stage (see flyHeadline). */
  const ghostRef = useRef<HTMLDivElement | null>(null);
  /** Each article's backdrop layer, if it has one, and which article's art is hovered. */
  const backdrops = useRef(new Map<ArticleId, HTMLDivElement>());
  const hoveredRef = useRef<ArticleId | null>(null);
  const splitsRef = useRef<{ id: ArticleId; splits: SplitText[] } | null>(null);

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
      pushed: [...rootRef.current!.querySelectorAll<HTMLElement>("main [data-push]")],
    };
  }, []);

  /** SplitText for the staged article's copy; redone when the copy changes. */
  const chars = useCallback(() => {
    const id = stagedRef.current;
    if (splitsRef.current?.id !== id) {
      splitsRef.current?.splits.forEach((s) => s.revert());
      splitsRef.current = { id, splits: q().typed.map((el) => SplitText.create(el, { type: "words,chars" })) };
    }
    return splitsRef.current.splits.flatMap((s) => s.chars);
  }, [q]);

  // --- The headline --------------------------------------------------------
  //
  // An article with a headline on the page (`[data-headline=id]`) and one on
  // the stage (`[data-stage-headline=id]`) flies it between the two: a copy at
  // document level travels with the art — position and font size, so the type
  // stays crisp — and hands over to the real one at each end.

  const headlines = useCallback(
    (id: ArticleId) => ({
      page: mainRef.current?.querySelector<HTMLElement>(`[data-headline="${id}"]`) ?? null,
      stage: rootRef.current?.querySelector<HTMLElement>(`[data-stage-headline="${id}"]`) ?? null,
    }),
    []
  );

  /** A copy of `from`, fixed over it, reading `text`. Reuses one already in flight. */
  const ghostFrom = useCallback((from: HTMLElement, text: string) => {
    if (ghostRef.current) return ghostRef.current;
    const r = from.getBoundingClientRect();
    const g = document.createElement("div");
    g.setAttribute("aria-hidden", "true");
    g.className =
      "font-serif-ui pointer-events-none fixed z-40 m-0 whitespace-nowrap uppercase leading-[0.86] tracking-[-0.02em] text-bone";
    g.textContent = text;
    Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, fontSize: getComputedStyle(from).fontSize });
    document.body.appendChild(g);
    ghostRef.current = g;
    return g;
  }, []);

  /** Drop any copy in flight and show both real headlines' owners again. */
  const dropGhost = useCallback(() => {
    ghostRef.current?.remove();
    ghostRef.current = null;
    rootRef.current?.querySelectorAll<HTMLElement>("[data-headline], [data-stage-headline]").forEach((el) => {
      el.style.visibility = "";
    });
  }, []);

  useEffect(() => () => ghostRef.current?.remove(), []);

  // --- The backdrop -----------------------------------------------------------
  //
  // An article with a `backdrop` has one ASCII field over the whole viewport,
  // seen through a window (a clip-path): the art's slot while it's hovered on
  // the page, growing to the viewport with the mask as the article opens, and
  // shrinking back on close. Only the window moves — the field stays put in the
  // viewport and never scales, so the hover preview *is* the stage's backdrop.
  // z-5 on the page (under every art layer), z-25 on the stage (over the chrome,
  // under the staged art).

  const windowOnSlot = useCallback(
    (id: ArticleId) => {
      const el = backdrops.current.get(id);
      const slot = slotRefs[id].current;
      if (!el || !slot) return;
      const b = box(slot.getBoundingClientRect());
      gsap.set(el, { clipPath: insetTo(b), ...spotFor(b) });
    },
    [slotRefs]
  );

  const hover = useCallback(
    (id: ArticleId, on: boolean) => {
      if (on) hoveredRef.current = id;
      else if (hoveredRef.current === id) hoveredRef.current = null;
      const el = backdrops.current.get(id);
      // Mid-flight the window belongs to the transition; close checks hoveredRef when it lands.
      if (!el || openRef.current || tlRef.current?.isActive()) return;
      if (on) {
        windowOnSlot(id);
        gsap.set(el, { "--backdrop": BACKDROP.preview });
      }
      // The hover ring's timing: 300ms, ease-out.
      gsap.to(el, { autoAlpha: on ? 1 : 0, duration: 0.3, ease: "power1.out", overwrite: "auto" });
    },
    [windowOnSlot]
  );

  useEffect(() => {
    const follow = () => {
      const open = openRef.current;
      if (!open) {
        if (hoveredRef.current) windowOnSlot(hoveredRef.current);
        return;
      }
      // Open: the spotlight stays on the art's stage box as the window resizes.
      const el = backdrops.current.get(open);
      if (el && !tlRef.current?.isActive()) gsap.set(el, spotFor(stageBox(ARTICLES[open].aspect)));
    };
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [windowOnSlot]);

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
    gsap.set(layer, { clearProps: "transform,zIndex" });
    place(layer, box(slot.getBoundingClientRect()), "doc");
  }, [layerRefs, slotRefs]);

  /** The globe in its window, bottom left, over everything (another article is open). */
  const placeMini = useCallback(() => {
    const layer = layerRefs.globe.current;
    if (!layer) return;
    gsap.set(layer, { clearProps: "transform", zIndex: 40 });
    place(layer, miniBox(), "fixed");
  }, [layerRefs]);

  /** An article's layer, the rules and the chrome's bands in their expanded place. */
  const placeStage = useCallback(
    (id: ArticleId) => {
      const layer = layerRefs[id].current;
      const chrome = chromeRef.current;
      if (!layer || !chrome) return;
      const b = stageBox(ARTICLES[id].aspect);
      gsap.set(layer, { clearProps: "zIndex" });
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
      else if (id === "globe" && openRef.current) placeMini();
      else placeHome(id);
    }
  }, [placeHome, placeStage, placeMini]);

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
      const { rules, pushed } = q();
      const cs = chars();

      const slotBox = box(slot.getBoundingClientRect());
      const state = Flip.getState(layer);
      chrome.style.visibility = "visible";
      placeStage(id);

      // Another article: the globe flies from the page to its window.
      const globe = id === "globe" ? null : layerRefs.globe.current;
      const globeFrom = globe ? Flip.getState(globe) : null;
      if (globe) placeMini();

      let ruleFrom: Flip.FlipState | null = null;
      if (variant === "rule") {
        placeRules(rules, slotBox, false);
        ruleFrom = Flip.getState(Object.values(rules));
        placeRules(rules, stageBox(ARTICLES[id].aspect), true);
      }

      // The headline: where it lands is measured now, with the art in its
      // stage box and before the Flip below puts it back visually.
      const head = headlines(id);
      let headTo: { left: number; top: number; fontSize: string } | null = null;
      let ghost: HTMLDivElement | null = null;
      if (head.page && head.stage) {
        head.stage.style.visibility = "";
        const r = head.stage.getBoundingClientRect();
        headTo = { left: r.left, top: r.top, fontSize: getComputedStyle(head.stage).fontSize };
        ghost = ghostFrom(head.page, head.page.textContent ?? "");
        head.page.style.visibility = "hidden";
      }

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: EASE.travel },
        onComplete: () => {
          if (!openRef.current) return;
          main.style.visibility = "hidden";
          setLandedId(openRef.current);
          // Hand over once the stage's own headline has rendered: two frames.
          const g = ghostRef.current;
          ghostRef.current = null;
          if (g) requestAnimationFrame(() => requestAnimationFrame(() => g.remove()));
        },
      });
      tl.addLabel("fly", T.flyAt).addLabel("land", T.landAt);
      tl.add(Flip.from(state, { duration: T.fly, ease: EASE.travel }), "fly");
      if (globeFrom) tl.add(Flip.from(globeFrom, { duration: T.fly, ease: EASE.travel }), "fly");
      tl.fromTo(chrome, { clipPath: insetTo(slotBox) }, { clipPath: INSET_NONE, duration: T.fly }, "fly");
      if (ghost && headTo) tl.to(ghost, { ...headTo, duration: T.fly }, "fly");
      for (const [other, el] of backdrops.current) if (other !== id) gsap.set(el, { autoAlpha: 0 });
      const backdrop = backdrops.current.get(id);
      if (backdrop) {
        raiseBackdrop(backdrop, true);
        tl.fromTo(
          backdrop,
          { clipPath: insetTo(slotBox), "--backdrop": BACKDROP.preview, ...spotFor(slotBox) },
          {
            clipPath: INSET_NONE,
            "--backdrop": BACKDROP.opacity,
            ...spotFor(stageBox(ARTICLES[id].aspect)),
            duration: T.fly,
          },
          "fly"
        );
        tl.to(backdrop, { autoAlpha: 1, duration: 0.2, ease: "power1.out" }, 0);
      }
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
      // The labels typing in chatter as they go.
      tl.call(() => sfx.chatter(cs.length, T.type), undefined, "land");
      return tl;
    },
    [layerRefs, slotRefs, q, chars, placeStage, placeMini, placeRules, headlines, ghostFrom]
  );

  /** The close, from the stage back home. Plays immediately. */
  const buildClose = useCallback(
    (id: ArticleId, variant: Variant) => {
      const layer = layerRefs[id].current!;
      const chrome = chromeRef.current!;
      const slot = slotRefs[id].current!;
      const { rules, pushed } = q();
      const cs = chars();
      const slotBox = box(slot.getBoundingClientRect());

      // The headline goes home as the page's word (the walkthrough may be on
      // another chapter; the board is going back to chapter 00 as well). The
      // copy starts over the stage's headline, so it's made before anything moves.
      const head = headlines(id);
      let ghost: HTMLDivElement | null = null;
      if (head.page && (ghostRef.current || head.stage)) {
        ghost = ghostFrom(head.stage!, head.page.textContent ?? "");
        ghost.textContent = head.page.textContent ?? "";
        if (head.stage) head.stage.style.visibility = "hidden";
        head.page.style.visibility = "hidden";
      }

      const state = Flip.getState(layer);
      const globe = id === "globe" ? null : layerRefs.globe.current;
      const globeFrom = globe ? Flip.getState(globe) : null;
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
      if (globe) {
        placeHome("globe");
        gsap.set(globe, { zIndex: 40 }); // over the chrome until it lands (placeAll clears it)
      }
      const pageBox = head.page?.getBoundingClientRect();
      pushed.forEach((el, i) => gsap.set(el, offsets[i]));
      if (ruleFrom) placeRules(rules, slotBox, false);

      const backdrop = backdrops.current.get(id);
      const tl = gsap.timeline({
        defaults: { ease: EASE.travel },
        onComplete: () => {
          if (!openRef.current) {
            chrome.style.visibility = "hidden";
            gsap.set(pushed, { clearProps: "transform" });
            placeAll();
            dropGhost();
            if (backdrop) {
              raiseBackdrop(backdrop, false);
              if (hoveredRef.current !== id) gsap.to(backdrop, { autoAlpha: 0, duration: 0.3, ease: "power1.out" });
            }
          }
        },
      });
      tl.timeScale(T.closeSpeed);
      tl.addLabel("lift", 0).addLabel("fly", T.flyAt);
      tl.to(cs, { autoAlpha: 0, duration: 0.01, stagger: { each: 0.15 / cs.length, from: "end" } }, "lift");
      tl.add(Flip.from(state, { duration: T.fly, ease: EASE.travel }), "lift");
      if (globeFrom) tl.add(Flip.from(globeFrom, { duration: T.fly, ease: EASE.travel }), "lift");
      tl.fromTo(chrome, { clipPath: INSET_NONE }, { clipPath: insetTo(slotBox), duration: T.fly }, "lift");
      if (backdrop)
        tl.fromTo(
          backdrop,
          { clipPath: INSET_NONE, "--backdrop": BACKDROP.opacity, ...spotFor(stageBox(ARTICLES[id].aspect)) },
          { clipPath: insetTo(slotBox), "--backdrop": BACKDROP.preview, ...spotFor(slotBox), duration: T.fly },
          "lift"
        );
      if (ghost && head.page && pageBox) {
        const fontSize = getComputedStyle(head.page).fontSize;
        tl.to(ghost, { left: pageBox.left, top: pageBox.top, fontSize, duration: T.fly }, "lift");
      }
      if (ruleFrom) {
        tl.add(Flip.from(ruleFrom, { duration: T.fly, ease: EASE.travel }), "lift");
        tl.to(pushed, { x: 0, y: 0, duration: T.fly }, "lift");
      }
      return tl;
    },
    [layerRefs, slotRefs, q, chars, placeHome, placeRules, placeAll, headlines, ghostFrom, dropGhost]
  );

  // --- Navigation ----------------------------------------------------------

  useEffect(() => {
    for (const id of ARTICLE_IDS) router.prefetch(ARTICLES[id].route);
    router.prefetch("/");
  }, [router]);

  const open = useCallback(
    (id: ArticleId) => {
      // A click on the art as it flies home would turn it around mid-flight.
      if (tlRef.current?.isActive()) return;
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
      const variant = FX;
      const { pushed } = q();

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
          dropGhost();
          placeAll();
          for (const [id, el] of backdrops.current) {
            raiseBackdrop(el, id === openId);
            gsap.set(
              el,
              id === openId
                ? {
                    clipPath: INSET_NONE,
                    autoAlpha: 1,
                    "--backdrop": BACKDROP.opacity,
                    ...spotFor(stageBox(ARTICLES[id].aspect)),
                  }
                : { autoAlpha: 0 }
            );
          }
          gsap.set(chrome, { clipPath: INSET_NONE });
          gsap.set(chars(), { autoAlpha: 1 });
          main.style.visibility = "hidden";
          setLandedId(openId);
          return;
        }
        tlRef.current = buildOpen(openId, variant).play();
        sfx.sweep(true, T.fly);
      } else {
        setLandedId(null);
        html.style.overflow = "";
        main.inert = false;
        main.style.visibility = "";

        if (instant || !prev) {
          dropGhost();
          placeAll();
          for (const el of backdrops.current.values()) {
            raiseBackdrop(el, false);
            gsap.set(el, { autoAlpha: 0 });
          }
          chrome.style.visibility = "hidden";
          gsap.set(pushed, { clearProps: "transform" });
          return;
        }
        tlRef.current = buildClose(prev, variant);
        sfx.sweep(false, T.fly / T.closeSpeed);
      }
    },
    { dependencies: [openId], scope: rootRef }
  );

  return (
    <div ref={rootRef} className="contents">
      <SoundBoard />
      <LiveIcon />
      <Newspaper mainRef={mainRef} slotRefs={slotRefs} onOpen={open} />
      <StageChrome chromeRef={chromeRef} article={staged} onClose={close} />
      {ARTICLE_IDS.map((id) => {
        const field = ARTICLES[id].backdrop;
        if (!field) return null;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) backdrops.current.set(id, el);
              else backdrops.current.delete(id);
            }}
            data-backdrop={id}
            aria-hidden
            className="pointer-events-none invisible fixed inset-0 z-[5] opacity-0"
          >
            <Backdrop field={field} />
          </div>
        );
      })}

      <Layer
        id="globe"
        layerRef={layerRefs.globe}
        open={openId === "globe"}
        staged={staged.id === "globe"}
        ring
        docked={openId !== null && openId !== "globe"}
        framed={landedId !== null && landedId !== "globe"}
        onOpen={() => open("globe")}
        onHover={(on) => hover("globe", on)}
      >
        {/* Its window while docked: a hairline frame and a title bar above the
            box, shown once the article has landed. Behind the canvas, so the
            globe sits on the page's ground. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px -z-10 border border-bone bg-ink opacity-0 transition-opacity duration-200 ease-out group-data-[framed=true]:opacity-100"
          style={{ top: -MINI.bar - 1 }}
        >
          <div
            className={`${LABEL} flex items-center justify-between gap-2 border-b border-bone px-2`}
            style={{ height: MINI.bar }}
          >
            <span>/Globe</span>
            <span className="max-sm:hidden">Scroll to bend</span>
          </div>
        </div>
        <GlobeCanvas />
      </Layer>
      <Layer
        id="watch"
        layerRef={layerRefs.watch}
        open={openId === "watch"}
        staged={staged.id === "watch"}
        ring={false}
        onOpen={() => open("watch")}
        onHover={(on) => hover("watch", on)}
      >
        {/* The watch's board, part by part — a turntable on the page, a
            teardown in chapters on the stage (src/lib/watch). */}
        <WatchArticle open={openId === "watch"} landed={landedId === "watch"} />
      </Layer>
      <Layer
        id="fractals"
        layerRef={layerRefs.fractals}
        open={openId === "fractals"}
        staged={staged.id === "fractals"}
        ring={false}
        onOpen={() => open("fractals")}
        onHover={(on) => hover("fractals", on)}
      >
        {/* Avi's fractal work — ASCII on the page, a walkthrough of live
            ports of his code on the stage (src/lib/fractals). */}
        <FractalArticle open={openId === "fractals"} landed={landedId === "fractals"} />
      </Layer>
    </div>
  );
}
