#!/usr/bin/env python3
"""Bake the globe's packed field texture from the original source maps.

The site originally shipped two raw assets totalling ~80 MB:

    public/World_elevation_map.png   21600x10800 RGBA   75.3 MB
    public/water_16k.png             16200x8100  grey    5.0 MB

The fragment shader only ever read the red channel of each, and its
getHeightField() blurred the elevation across +/-0.0012 in UV space — which
band-limits the height field to roughly 833 cycles across the map. Everything
past ~2048px of width was therefore invisible to the effect.

This script collapses both maps into one small RGB texture:

    R = height, with the shader's 5-tap cross blur already applied
        (wrapped horizontally, which also removes a seam artifact the
        original had at the antimeridian)
    G = land mask, pre-inverted so the shader reads it directly
    B = unused

That takes the fragment shader from six texture fetches to one, and the
payload from 80 MB to 0.87 MB (2048) or 3.2 MB (4096).

The source maps were removed from public/ once baked; recover them from git
history (they are present up to commit 7b8cce6) if you need to re-run this.

Usage:
    python3 scripts/bake-globe-field.py path/to/World_elevation_map.png \
                                        path/to/water_16k.png
"""
import os
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

STEP = 0.0012          # must match the shader's original stepUv
W_CENTER, W_NEIGHBOR = 0.48, 0.13   # must match its 5-tap weights
RESOLUTIONS = (2048, 4096)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public")


def uv_blur(a, step=STEP):
    """Reproduce the shader's getHeightField(): a 5-tap cross at +/-step in UV.

    Offsets are fractional texels, so each tap is bilinearly interpolated.
    Wraps in x (longitude is continuous), clamps in y (poles are not).
    """
    h, w = a.shape
    dx, dy = step * w, step * h

    def shift(arr, offset, axis):
        i0 = int(np.floor(offset))
        frac = offset - np.floor(offset)
        if axis == 1:
            a0 = np.roll(arr, -i0, axis=1)
            a1 = np.roll(arr, -(i0 + 1), axis=1)
        else:
            rows = np.arange(arr.shape[0])
            a0 = arr[np.clip(rows + i0, 0, arr.shape[0] - 1)]
            a1 = arr[np.clip(rows + i0 + 1, 0, arr.shape[0] - 1)]
        return a0 * (1 - frac) + a1 * frac

    a = a.astype(np.float32)
    neighbors = (shift(a, dy, 0) + shift(a, -dy, 0)
                 + shift(a, dx, 1) + shift(a, -dx, 1))
    return a * W_CENTER + neighbors * W_NEIGHBOR


def main(elevation_path, water_path):
    print(f"reading {elevation_path} ...")
    with Image.open(elevation_path) as im:
        height = np.asarray(im.getchannel(0))      # shader read .r only
    print(f"  {height.shape[1]}x{height.shape[0]}")

    print(f"reading {water_path} ...")
    with Image.open(water_path) as im:
        water = np.asarray(im.convert("L"))        # white ocean / black land
    print(f"  {water.shape[1]}x{water.shape[0]}")

    for width in RESOLUTIONS:
        h = width // 2
        print(f"baking {width}x{h} ...")
        # BOX = true area average; avoids the ringing a Lanczos kernel would
        # introduce into a height field.
        small_height = np.asarray(
            Image.fromarray(height).resize((width, h), Image.BOX), dtype=np.float32)
        small_water = np.asarray(
            Image.fromarray(water).resize((width, h), Image.BOX), dtype=np.float32)

        packed = np.zeros((h, width, 3), dtype=np.uint8)
        packed[..., 0] = np.round(np.clip(uv_blur(small_height), 0, 255))
        packed[..., 1] = np.round(255.0 - small_water)

        out = os.path.normpath(os.path.join(OUT_DIR, f"globe-field-{width}.webp"))
        # method=3 is ~200x faster than method=6 for a ~1% size penalty here.
        Image.fromarray(packed, "RGB").save(out, lossless=True, quality=100, method=3)
        print(f"  wrote {out}  ({os.path.getsize(out) / 1e6:.2f} MB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
