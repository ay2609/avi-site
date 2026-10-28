# Avi's front page

My personal website, live at [aviyadava.com](https://aviyadava.com/) (halcyn.dev redirects there).

It's laid out like the front page of a newspaper where every article is a picture. Spin the globe and bend its projection (bend it past halfway and the whole page turns to paper, and stays that way next visit), open the watch to take my smartwatch's board apart one chapter at a time, do the same with the Tiny Music Player I'm building now, or open Fractals to walk through live ports of the code I wrote in high school, from the Mandelbrot set to chaotic attractors. Clicking an article grows it to full screen at its own address, and Esc folds it back into the page. Every article opens from the keyboard too, and motion respects reduced-motion settings.

## Development

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000/. Run `npm run lint` and `npx tsc --noEmit` before pushing; there's no test suite.

The site is a Next.js app exported as plain static files (`output: "export"`, built to `out/`). The routes' pages are empty: the stage in the shared layout draws the articles in the browser and moves between them, so there's no server code. `public/` holds the globe's baked elevation texture and the watch's parts, and `scripts/` has the Python pipelines that produce those and the generated tables in `src/lib`.

## Publishing

Cloudflare deploys `main` automatically after a push: Workers Builds runs `npm clean-install`, `npm run build` and `npx wrangler deploy`, and `wrangler.jsonc` serves `out/` as static assets with `404.html` for missing pages. aviyadava.com, www.aviyadava.com, halcyn.dev and www.halcyn.dev are custom domains on the `avi-site` Worker; `worker/index.ts` runs first and sends everything but aviyadava.com there with a 301. Other branches don't build, so a push to `main` is a release. Mail to avi@halcyn.dev is forwarded by Cloudflare Email Routing.

## Main files

- `src/components/Newspaper.tsx`: the front page — masthead, articles, contact and footer.
- `src/components/Stage.tsx`, `StageChrome.tsx` and `src/lib/stage/`: opening and closing articles — the article registry and routes, the GSAP transitions, click-to-open, and the one-scroll-one-chapter gesture.
- `src/lib/three/GlobeCanvas.tsx`, `src/lib/shaders/globe/` and `src/lib/three/network/`: the globe's contour shader, perspective-to-orthographic camera and mesh network.
- `src/components/Backdrop.tsx`: the faint ASCII field behind the open globe.
- `src/components/TeardownArticle.tsx` and `src/lib/teardown/`: a board taken apart in chapters — the engine, the parts decoder and the device type the watch and the player share.
- `src/lib/watch/`: the watch's five chapters, and a re-creation of the watch face my firmware draws.
- `src/lib/player/`: the Tiny Music Player's six chapters, and the album cover its 64 × 64 OLED shows (the seam's isovalues, at the panel's resolution).
- `src/components/FractalArticle.tsx` and `src/lib/fractals/`: the fractals walkthrough — one WebGL shader porting my Python, the Mandelbrot cover and the Julia and Fraotic presets.
- `src/lib/ascii/`: the animated ASCII fields on the page.
- `scripts/`: offline pipelines for the globe texture, the watch and player parts (`player-board.sh` exports the player's board from KiCad and adds the parts KiCad has no model for), the firmware's glyphs and the fractal palettes.

The watch's and the player's boards come from my KiCad projects and its face from my ESP32 firmware. The fractal colours are matplotlib's and CMasher's colormaps, the ones my original code used. Fonts are Instrument Serif and IBM Plex Mono, both under the OFL, loaded with `next/font`.
