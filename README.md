# avi-site

Personal website with an interactive 3D globe and network visualization, built with Next.js and Three.js.

## What it is

A personal portfolio/homepage. The centerpiece is a `/globe` page that renders an interactive
3D globe (`three-globe` + `@react-three/fiber`), alongside a custom "world graph" / mesh-network
visualization (`src/lib/three/network/`) with its own tunable parameters. GSAP and Framer Motion
handle animation and page transitions elsewhere on the site.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Three.js, react-three-fiber / drei, three-globe
- GSAP, Framer Motion

## Status

Actively evolving — the globe and network-graph visuals are the main focus of ongoing work.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.
