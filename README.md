# avi-site

Personal website. Currently a single full-screen scene: an interactive shader globe.

## What's here

`/` renders `GlobeCanvas` — a sphere drawn with a custom GLSL material that derives
animated topographic contour lines and a lat/long graticule from a baked elevation
field. A mesh-network layer (`src/lib/three/network/`) sits on the globe surface: nodes
spawn against a world graph of hotspots, bridge lanes and remote fields, link up by
role, drift, and are culled to the visible hemisphere.

### The field texture

The globe reads one packed RGB texture, `public/globe-field-<res>.webp`:
R is elevation with the shader's 5-tap blur pre-applied, G is a land mask. It replaces
the two raw source maps (21600x10800 elevation + 16200x8100 water, ~80 MB combined)
that the shader was only ever reading one channel of — and, because the shader blurs
elevation across ±0.0012 UV, could not resolve detail past ~2048px of width anyway.

Both 2048 (0.87 MB) and 4096 (3.2 MB) ship; switch with `FIELD_TEXTURE.resolution` in
`GlobeCanvas.tsx`. 4096 keeps more granular contour break-up at full zoom; at normal
globe distance the two are indistinguishable. Regenerate either with
`scripts/bake-globe-field.py` (the source maps live in git history up to `7b8cce6`).

Everything is raw Three.js — no react-three-fiber, no three-globe.

## Controls

| Input | Effect |
| --- | --- |
| Drag | Orbit the globe (pauses auto-spin, which ramps back after ~1s) |
| Wheel / two-finger scroll | Blend the camera between perspective and orthographic |
| Pinch (ctrl+wheel) | Dolly in and out |
| Space | Toggle auto-spin |

The readout in the top-left shows the normalized zoom, camera distance and projection blend.

## Layout

```
src/app/            Next.js app router — one route
src/lib/three/      GlobeCanvas (scene, camera, loop), HybridCamera
src/lib/three/network/   Mesh-network sim: world graph, spawn, links, tuning
src/lib/shaders/    Globe vertex + fragment shaders
src/lib/render/     Frame tick manager
scripts/            Offline texture bake
public/             Packed globe field textures
```

Visual parameters live in named config objects at the top of `GlobeCanvas.tsx`
(`GLOBE_CONFIG`, `HYBRID_CAMERA_CONFIG`, `TOPOGRAPHY_CONFIG`) and, for the network layer,
in `src/lib/three/network/tuning.ts`.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Three.js.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.
