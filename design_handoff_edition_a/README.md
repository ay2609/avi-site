# Handoff: Front page — "Edition A"

## Overview
Redesign of the avi-site front page (`src/app/page.tsx`). Keeps the existing layout idea — an 80vw well, headline + label above each article, art bleeding to the section edges, animated ASCII rails, the live Three.js globe as the lead — and restyles it as a dark, single-tone newspaper: Instrument Serif headlines, IBM Plex Mono 300 furniture, slash section labels, a scrolling ticker, a live clock, and a zoom readout over the globe.

## About the design files
`Avi Yadava Edition A.dc.html` is a **design reference built in HTML**, not production code. Recreate it inside the existing Next.js / Tailwind codebase using its patterns (`Article`, `fillSize`, `AsciiPanel`, `GlobeCanvas`, `WireframeCanvas`). Do not ship the HTML.

Open the reference in a browser to see it live (it needs `ascii-panel.js` and `assets/globe.png` next to it). `Avi Yadava Edition B.dc.html` is an alternate layout for comparison only — do not implement it.

## Fidelity
**High-fidelity.** Colors, type, spacing and rules are final. Copy is placeholder where noted.

## What to keep from the existing site (wire the real thing in)
- `GlobeCanvas` replaces the static `assets/globe.png`. Keep it square (`aspect-square`), bleeding to the section edges.
- `AsciiPanel` + `fields.ts` unchanged. `ascii-panel.js` in this bundle is a straight port for the prototype — ignore it.
- `fillSize()` for column-filling headlines. Re-tune the advance constants for Instrument Serif caps (roughly 0.55–0.65 em per cap, W ≈ 0.9, I ≈ 0.3) so the word spans ~92% of its container.
- `.fit` (container-type) and the `.hatch` pattern.
- `WireframeCanvas` (`/watch-esp.bin`) is not on the front page in this edition; it can become the "Board" placeholder art if wanted.

## Page structure (top to bottom)
Wrapper `<main>`: `width: clamp(320px, 80vw, 1600px); margin: 0 auto; border-left/right: 1px solid RULE; min-height: 100vh`. **Outer rules solid, every inner rule dashed** (`1px dashed RULE`).

1. **Masthead** — `padding: 44px 16px 18px`, bottom dashed rule, container-type inline-size.
   - Row above the name: `justify-between`, mono 10px, tracking .18em, uppercase, DIM. Left `VOL. I · NO. 001`. Right: live clock in BONE, format `FRI 19 SEP 2026  ·  14:03:22`, ticks every second.
   - `<h1>AVI YADAVA</h1>` Instrument Serif 400, `font-size: clamp(2.4rem, 17cqw, 18rem)`, line-height .82, letter-spacing -.03em, uppercase, nowrap. Fills ~96% of well width.
2. **Kicker row** — `padding: 12px 16px`, dashed bottom rule, mono 10px DIM tracking .18em uppercase, three words spread with `justify-between`: `INTERACTIVE · GRAPHICS · SOFTWARE`.
3. **Ticker** — 30px tall, dashed bottom rule, overflow hidden. Content: `COMPLACENCY IS A SIN` repeated, mono 10px tracking .18em, each phrase followed by a DIM `◆` (margin-left 56px) with 28px horizontal padding. Two copies of the strip in a row; CSS `translateX(0 → -50%)` linear infinite, **45s**. Respect `prefers-reduced-motion` (pause).
4. **The well** — flex row, wraps below ~620px.
   - **Lead (globe)**: `flex: 8 1 380px`, right dashed rule, bottom dashed rule, flex column.
     - Label row `padding: 16px 16px 12px`, mono 10px DIM: left `/LEAD — THREE.JS / GLSL`, right `SCROLL TO ZOOM`. No headline.
     - Art: square, `border-top` dashed, `cursor: crosshair`, `user-select: none`. `GlobeCanvas` fills it.
     - HUD overlays (mono 11px, line-height 1.7, tracking .08em, 14px from edges):
       - top-left BONE: `ZOOM  1.00×` then a 16-cell bar in DIM: `|` filled / `.` empty, filled = round((zoom−1)/2 × 16).
       - top-right DIM, right-aligned: `CUR  xx yy` (cursor position 00–99 in the frame, `—` when outside) and the time `HH:MM:SS`.
       - bottom-left DIM: `GLOBE — 2026`. bottom-right DIM: `100 %` (zoom × 100).
       - Bind ZOOM to the real camera distance from `HybridCamera` (map min…max distance → 1.00×…3.00×) instead of the prototype's wheel-driven fake.
     - Caption row under the art: `padding: 12px 16px`, dashed top rule, mono 10px DIM tracking .18em uppercase: left `FIG. 1 — AN INTERACTIVE GLOBE, BUILT TO BE WANDERED.` right `LABELS MARK THE WORK`.
     - Hatch spacer: `flex: 1; min-height: 48px`, dashed top rule, `.hatch` pattern — absorbs the height difference so the lead ends level with the rail.
   - **Rail**: `flex: 3 1 220px`, flex column, three `Article`s, each with dashed bottom rule:
     1. `/TERRACED` — **RELIEF** — AsciiPanel `terrain`, 4:3
     2. `/PROJECT — 2025` — **FRACTALS** — 1:1 hatch placeholder with mono 10px DIM caption `PROJECT STILL — 1:1` bottom-left (replace with the real project still)
     3. `/ADVECTED` — **DRIFT** — AsciiPanel `flow`, 4:3
     - Article header `padding: 16px 16px 8px`; label mono 10px DIM tracking .18em uppercase; headline Instrument Serif 400 `clamp(1rem, <fill>cqw, 4.5rem)`, line-height .86, letter-spacing -.02em, uppercase, nowrap, `margin-top: 6px`.
     - ASCII panel text: Plex Mono 300 10px / 1.15, color `rgba(230,228,223,.5)`.
5. **Work + Archive** — flex row, dashed bottom rule.
   - **/SELECTED WORK (04)**: `flex: 8 1 380px`, `padding: 16px 16px 28px`, right dashed rule. Header row mono 10px DIM. Four rows, each `grid-template-columns: 40px minmax(0,1fr) auto; gap 16px; padding 16px 0; border-top dashed` (last also border-bottom): index `01` mono 11px DIM · title Instrument Serif `clamp(28px, 4vw, 56px)` letter-spacing -.02em · meta mono 10px DIM uppercase tracking .18em. Rows: Globe / Three.js · 2026, Fractals / GLSL · 2025, Board / KiCad / STEP · 2025, Body / Lambert · 2024. Hover: text → DIM.
   - **/ARCHIVE (12)**: `flex: 3 1 220px`, `padding: 16px 16px 28px`. Seven rows `grid-template-columns: 34px 1fr auto; gap 10px; padding 9px 0; border-top dashed`, mono 11px: `012 · Globe · 26.09` etc. (index DIM, title BONE, date DIM). Then `FULL INDEX →` mono 10px DIM, margin-top 18px.
6. **/CONTACT** — `padding: 32px 16px 36px`, dashed bottom rule, flex wrap `justify-between`, `align-items: flex-end`. Label mono 10px DIM; `hello@aviyadava.com` Instrument Serif `clamp(28px, 4.5vw, 56px)` letter-spacing -.015em as a mailto. Right: `INSTAGRAM  ARE.NA  GITHUB` mono 10px uppercase tracking .18em, gap 28px.
7. **Footer** — `padding: 18px 16px`, mono 10px DIM uppercase tracking .18em, `justify-between`: `AVI YADAVA` / today as `DD.MM.YYYY`.

## Interactions & behavior
- Clock: `setInterval` 1s; clear on unmount.
- Ticker: pure CSS keyframe; pause under reduced motion.
- Globe HUD: zoom and cursor readouts update on wheel / pointermove; cursor shows `—` on leave. Globe transform transition in the prototype (`.18s ease-out`) is irrelevant once the real camera drives it.
- Links: BONE → DIM on hover, no underline. `::selection` inverts (BONE bg, INK text).
- Responsive: well columns wrap (lead first, rail second, then work, archive) below ~620px; masthead scales with `cqw`.

## State
`now: Date`, `zoom: number (1–3)`, `cursor: {x,y} | null`. All local to the page.

## Design tokens
- INK `#0a0a0b` (page) · panel/notes `#111113`
- BONE `#e6e4df` (text) · DIM `#8a8987` (labels, meta) · RULE `#2a2a2c`
- ASCII ink `rgba(230,228,223,.5)`; hatch stripe `rgba(230,228,223,.1)` (`repeating-linear-gradient(45deg, transparent 0 2px, stripe 7px, stripe 7px)`)
- Type: **Instrument Serif** 400 (Google Fonts) for masthead, headlines, work titles, email. **IBM Plex Mono** 300 for everything else (swap the codebase's Inter/JetBrains Mono in `fonts.ts`).
- Mono sizes: 10px labels (tracking .18em, uppercase), 11px lists/HUD (tracking .02–.08em).
- Spacing: 16px horizontal gutter everywhere; 44px masthead top; 12/16/28px vertical rhythm.
- Rules: 1px; solid outer, dashed inner. No radii, no shadows, no color accents.

## Assets
- `assets/globe.png` — screenshot of the real globe, prototype only. Replace with `GlobeCanvas`.
- `ascii-panel.js` — prototype port of `src/lib/ascii`. Use the existing TSX.

## Files
- `Avi Yadava Edition A.dc.html` — the design to implement
- `Avi Yadava Edition B.dc.html` — alternate, reference only
- `ascii-panel.js`, `assets/globe.png` — prototype dependencies
