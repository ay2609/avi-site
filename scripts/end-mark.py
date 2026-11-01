#!/usr/bin/env python3
"""
The end mark, cut from the watch's own copper: the F.Cu around the ESP32
module's thermal pad, a four-by-four grid of crosses with pin 1's corner
clipped. Writes it as vector artwork:

    src/lib/icon/end-mark.ts   the path, for components/EndMark.tsx
    public/end-mark.svg        the same, as a file for anywhere else

Run with KiCad's own Python, which has pcbnew:

    ~/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 \
        scripts/end-mark.py ~/workspaces/kicad-projects/WatchESP/WatchESP.kicad_pcb
"""
import os
import sys

import pcbnew

MODULE = "U7"
# The crop on the board, mm: left, top, side.
WINDOW = (125.53, 24.17, 6.29)
# The artwork's units per side.
VIEW = 96
# Rounded corners on the copper come as many short segments; closer than this
# to the line between their neighbours, a point adds nothing at this size.
TOLERANCE = 0.08


def window_polygon():
    x, y, side = (pcbnew.FromMM(v) for v in WINDOW)
    rect = pcbnew.SHAPE_POLY_SET()
    rect.NewOutline()
    for px, py in ((x, y), (x + side, y), (x + side, y + side), (x, y + side)):
        rect.Append(px, py)
    return rect


def copper(board):
    """Everything on F.Cu in the window: the ground pour and the module's pads."""
    polys = pcbnew.SHAPE_POLY_SET()
    for zone in board.Zones():
        if zone.IsOnLayer(pcbnew.F_Cu) and zone.IsFilled():
            polys.BooleanAdd(zone.GetFilledPolysList(pcbnew.F_Cu))
    for fp in board.GetFootprints():
        if fp.GetReference() == MODULE:
            for pad in fp.Pads():
                if pad.IsOnLayer(pcbnew.F_Cu):
                    pad.TransformShapeToPolygon(polys, pcbnew.F_Cu, 0, pcbnew.FromMM(0.002), pcbnew.ERROR_INSIDE)
    polys.Simplify()
    polys.BooleanIntersection(window_polygon())
    return polys


def to_view(chain):
    x0, y0, side = WINDOW
    scale = VIEW / side
    return [
        ((pcbnew.ToMM(chain.CPoint(k).x) - x0) * scale, (pcbnew.ToMM(chain.CPoint(k).y) - y0) * scale)
        for k in range(chain.PointCount())
    ]


def simplify(points):
    """Douglas-Peucker: keep a point only if the shape would move by more than TOLERANCE without it."""
    if not points:
        return points

    def stretch(a, b):
        ax, ay = points[a]
        dx, dy = points[b][0] - ax, points[b][1] - ay
        length = (dx * dx + dy * dy) ** 0.5
        worst, at = 0, None
        for i in range(a + 1, b):
            px, py = points[i][0] - ax, points[i][1] - ay
            # The distance to the segment, not its line, so a point past either end still counts.
            t = max(0, min(1, (px * dx + py * dy) / (length * length))) if length else 0
            d = ((px - t * dx) ** 2 + (py - t * dy) ** 2) ** 0.5
            if d > worst:
                worst, at = d, i
        if at is None or worst <= TOLERANCE:
            return [a]
        return stretch(a, at) + stretch(at, b)

    # A closed ring: split it at the point furthest from the first.
    far = max(range(len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
    points = points + [points[0]]
    return [points[i] for i in stretch(0, far) + stretch(far, len(points) - 1)]


def number(v):
    return f"{round(v, 1):g}"


def path(points):
    pts = [f"{number(x)} {number(y)}" for x, y in points]
    return "M" + "L".join(pts) + "Z"


def main(board_path):
    polys = copper(pcbnew.LoadBoard(os.path.expanduser(board_path)))
    parts = []
    for i in range(polys.OutlineCount()):
        parts.append(path(simplify(to_view(polys.COutline(i)))))
        for h in range(polys.HoleCount(i)):
            parts.append(path(simplify(to_view(polys.CHole(i, h)))))
    d = "".join(parts)

    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    with open(os.path.join(root, "public/end-mark.svg"), "w") as f:
        f.write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW} {VIEW}" fill="currentColor" fill-rule="evenodd">'
            f'<path d="{d}"/></svg>\n'
        )
    with open(os.path.join(root, "src/lib/icon/end-mark.ts"), "w") as f:
        f.write(
            "/** The end mark's artwork, written by scripts/end-mark.py from the watch's copper. Draw it with fill-rule evenodd. */\n"
            f"export const END_MARK_VIEW = {VIEW};\n"
            f'export const END_MARK_PATH = "{d}";\n'
        )
    print(f"{polys.OutlineCount()} outlines, {len(d)} bytes of path")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
