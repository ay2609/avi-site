"""
The paper's tooth: a tile of flecks and fibres for the light theme's ground,
so the warm newsprint reads as paper rather than a flat colour.

Writes public/paper-tooth.png, a 320 px tile (shown at 320 CSS px), near-black
marks on transparent: a few hundred specks a pixel or two across, a handful of
larger flecks, and short curved fibres, all faint. The tile wraps (every mark
is drawn at its wrapped copies too), so no seam shows.

    python3 scripts/paper-tooth.py   (needs Pillow and numpy)
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 320
SCALE = 4  # drawn at 4x, then reduced, for soft edges
OUT = Path(__file__).resolve().parent.parent / "public" / "paper-tooth.png"

rng = random.Random(1405)
big = Image.new("L", (SIZE * SCALE, SIZE * SCALE), 0)
d = ImageDraw.Draw(big)


def wrapped(x: float, y: float):
    """The point and its copies across the tile's edges."""
    for dx in (-SIZE, 0, SIZE):
        for dy in (-SIZE, 0, SIZE):
            yield (x + dx) * SCALE, (y + dy) * SCALE


def speck(x: float, y: float, r: float, a: int) -> None:
    for cx, cy in wrapped(x, y):
        # A little irregular: a few overlapping dots rather than one disc.
        for _ in range(3):
            ox, oy = rng.uniform(-r, r) * SCALE * 0.4, rng.uniform(-r, r) * SCALE * 0.4
            rr = r * SCALE * rng.uniform(0.6, 1.0)
            d.ellipse((cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr), fill=a)


def fibre(x: float, y: float, length: float, a: int) -> None:
    angle = rng.uniform(0, math.tau)
    bend = rng.uniform(-0.08, 0.08)
    pts = []
    px, py = x, y
    for _ in range(int(length)):
        pts.append((px, py))
        angle += bend + rng.uniform(-0.05, 0.05)
        px += math.cos(angle)
        py += math.sin(angle)
    for dx in (-SIZE, 0, SIZE):
        for dy in (-SIZE, 0, SIZE):
            d.line([((p[0] + dx) * SCALE, (p[1] + dy) * SCALE) for p in pts], fill=a, width=int(0.5 * SCALE))


for _ in range(420):
    speck(rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(0.35, 0.7), rng.randint(60, 140))
for _ in range(14):
    speck(rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(0.9, 1.5), rng.randint(90, 170))
for _ in range(10):
    fibre(rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(8, 22), rng.randint(40, 80))

alpha = big.resize((SIZE, SIZE), Image.LANCZOS)
# The marks are the page's ink (#17171a), faint: the alpha above is scaled down to at most ~22%.
alpha = alpha.point(lambda v: int(v * 0.22))
tile = Image.new("RGBA", (SIZE, SIZE), (23, 23, 26, 0))
tile.putalpha(alpha)
tile.save(OUT, optimize=True)
print(f"{OUT} ({OUT.stat().st_size // 1024} KB)")
