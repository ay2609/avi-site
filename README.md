# avi-site

Personal website of Avi Yadava (halcyn.dev).

A dark, single-tone broadsheet front page where the articles are graphics rather than
prose. Sections are separated only by 1px dashed hairlines; each carries a mono
slash-label, a serif headline sized to span its box, and art that bleeds to the
section's edges. A live Three.js globe is the lead; the watch's PCB spins on a
turntable in the rail; animated ASCII fields fill the rest. The globe and the watch
open to full screen at their own routes.

## The page

Top to bottom (`src/components/Newspaper.tsx`):

1. **Masthead** — `VOL. I · NO. 001`, a live clock, and `AVI YADAVA` sized to span
   the column.
2. **The well** — a fixed 17:10 grid, one column below 768px.
   - Lead: the globe (square), its caption, and a two-up `ripple` / `lattice`
     ASCII strip that levels the lead with the rail.
   - Rail: **Watch** (the PCB, 4:3), **Fractals** (the Mandelbrot set in ASCII, 1:1),
     **Drift** (`flow` ASCII field, 4:3).
3. **Contact** — `avi@halcyn.dev` (Cloudflare Email Routing → Gmail), LinkedIn, GitHub.
4. **Footer** — name, the `FX — IRIS / RULE CUT` prototype switch, date.

## Design

One tone in four values, two typefaces, hairline rules. No radii, shadows, cards or
accent colours.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0a0a0b` | the page |
| `--bone` | `#e6e4df` | text, the hover ring, line art |
| `--dim` | `#8a8987` | labels, meta, captions |
| `--rule` | `#2a2a2c` | every hairline |
| `--ascii` | bone at 50% | ASCII fields |
| `--stripe` | bone at 10% | the `.hatch` placeholder fill |
| `--panel` | `#111113` | reserved, unused |

The only colour on the site is the purple of the globe's mesh-network nodes, and it
lives in the WebGL layer, never in CSS.

- **Instrument Serif 400** — masthead, headlines, the contact address.
- **IBM Plex Mono 300** — everything else: 10px, uppercase, tracking 0.18em, `--dim`
  (the `LABEL` class string in `src/components/furniture.ts`).
- Headlines are sized in `cqw` against a `.fit` container by `fillSize()` in
  `Newspaper.tsx`, which sums a per-letter advance so one word spans its box at any
  width.
- Text is inset 16px; art bleeds to the rules.
- All motion respects `prefers-reduced-motion`.

Tokens are defined in `src/app/globals.css`; fonts in `src/lib/fonts.ts`.

## Expandable articles

Opening an article is a real router navigation (`/globe`, `/watch`, each with its own
`<title>`). The art FLIPs from its box on the page to a centred stage box of the same
aspect, the stage's periphery is revealed by a `clip-path` mask, and the stage labels
type in once everything has landed. Esc, `ESC — BACK TO THE FRONT PAGE` or browser
back reverses it at 1.25× speed. A cold load of an article route renders the open
state with no animation.

Two variants, switchable from the footer (stored in `localStorage["avi-site:fx"]`):

- **Iris** — the frame widens around the art; the newspaper doesn't move.
- **Rule cut** — the stage's four rules travel out from the slot's edges and push the
  newspaper's sections off the grid.

### How it's built

- `src/app/(site)/layout.tsx` renders `<Stage />`; every page under it returns `null`.
  Layouts persist across sibling navigations, so each WebGL canvas is created once.
  The pathname is the only state.
- `Stage.tsx` owns the newspaper, the stage chrome and one document-level **layer**
  per article. A layer sits over its empty slot in the newspaper (absolute, scrolling
  with the page) or is fixed to the stage when open.
- Stacking: `<main>` z-0 · `StageChrome` z-20 · the staged article's layer z-30 ·
  other layers z-10.
- Every flight is `Flip.getState` → imperative placement → `Flip.from`, on one GSAP
  timeline with `fly` / `land` labels. Timings and easing are in
  `src/lib/stage/motion.ts`.

### Adding an article

1. Add an entry to `src/lib/stage/articles.ts`: `id`, `route`, `aspect`, and the
   stage copy (`kicker`, `caption`, `controls`, `title`).
2. Add `src/app/(site)/<id>/page.tsx` returning `null` and exporting
   `metadata.title`.
3. In `Newspaper.tsx`, give the `Article` a `slot` instead of children.
4. In `Stage.tsx`, add a `<Layer>` with the art inside, and the id to the `slotRefs` /
   `layerRefs` maps.

## The art

- **Globe** — `src/lib/three/GlobeCanvas.tsx`. Raw Three.js with a custom GLSL
  material (`src/lib/shaders/globe/`) that draws animated topographic contours and a
  graticule from a baked elevation field; a hybrid perspective↔orthographic camera
  (`HybridCamera.js`); and a mesh-network layer (`src/lib/three/network/`) whose
  nodes spawn against a world graph of hotspots, link up by role, drift, and are
  culled to the visible hemisphere. The HUD (bend, cursor, clock, %) is written
  imperatively.
- **Watch** — `src/lib/three/SolidCanvas.tsx`. The watch PCB with its components,
  drawn as a technical illustration: ink-filled faces that occlude, bone feature
  edges on top, orthographic camera, on a turntable.
- **ASCII fields** — `src/lib/ascii/`. `AsciiPanel` measures its box and fills it
  with a character grid; `fields.ts` holds the scalar fields (`flow`, `ripple`,
  `lattice` in use; `terrain`, `sphere`, `spiral`, `weave`, `scan` available).
  Fields are built from areas, not thin lines, so they survive the coarse grid.
- `src/lib/render/tick-manager.ts` is the shared `requestAnimationFrame` loop.

## Controls

| Input | Effect |
| --- | --- |
| Drag the globe | Orbit (pauses auto-spin, which ramps back after ~1s) |
| Wheel over the globe | Bend the camera between perspective and orthographic; elsewhere the page scrolls |
| Space, cursor over the globe | Toggle auto-spin |
| Click the article (a drag on the globe orbits instead); Enter when focused | Open the article |
| Esc, `ESC — BACK`, or browser back | Close it |

## Assets and scripts

| Output | Built by | From |
| --- | --- | --- |
| `public/globe-field-2048.webp`, `-4096.webp` | `scripts/bake-globe-field.py` | the original elevation + water maps (in git history up to `7b8cce6`) |
| `public/watch-esp.mesh` | `scripts/stl-to-mesh.py` | `WatchESP.stl` |
| `public/watch-esp.bin` | `scripts/step-to-wireframe.py` | `WatchESP.step` (older wireframe; its renderer, `WireframeCanvas.tsx`, is currently unused) |

The globe texture packs pre-blurred height into R and a land mask into G; 2048 is the
default, 4096 is available via `FIELD_TEXTURE.resolution`. The `.mesh` format
("AVIM") is quantised int16 positions plus indices, exactly deduplicated so edges can
be found in the browser.

```bash
python3 scripts/stl-to-mesh.py WatchESP.stl public/watch-esp.mesh
```

`design_handoff_edition_a/` holds the Edition A design the front page was built from
(Edition B is reference only).

## Layout

```
src/app/                  root layout, globals.css
src/app/(site)/           the front page and the article routes (all render null)
src/components/           Stage, StageChrome, Newspaper, Clock, furniture
src/lib/stage/            article registry, GSAP motion helpers
src/lib/three/            GlobeCanvas, HybridCamera, SolidCanvas, WireframeCanvas
src/lib/three/network/    mesh-network sim: world graph, spawn, links, tuning
src/lib/shaders/globe/    globe vertex + fragment shaders (loaded as raw strings)
src/lib/ascii/            AsciiPanel and its fields
src/lib/render/           frame tick manager
scripts/                  offline asset pipelines
public/                   globe field textures, watch mesh
```

## Where the knobs live

- Globe: `GLOBE_CONFIG`, `HYBRID_CAMERA_CONFIG`, `TOPOGRAPHY_CONFIG`, `FIELD_TEXTURE`,
  `HUD_BARS` at the top of `GlobeCanvas.tsx`
- Mesh network: `src/lib/three/network/tuning.ts`
- Watch turntable: `VIEW` at the top of `SolidCanvas.tsx`
- Transition timings, easing, stage gutter: `src/lib/stage/motion.ts`
- Stage copy per article: `src/lib/stage/articles.ts`
- Page copy, contact: `src/components/Newspaper.tsx`

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Three.js, GSAP 3.15 (Flip,
SplitText, CustomEase) with `@gsap/react`. Fonts via `next/font/google`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.
