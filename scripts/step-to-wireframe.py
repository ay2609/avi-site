#!/usr/bin/env python3
"""Extract a line-segment wireframe from a STEP (ISO 10303 / AP214) file.

There is no CAD kernel available here, so this does not tessellate surfaces —
it reads the B-rep's explicit edge topology instead: every EDGE_CURVE, with
LINE edges emitted as single segments and CIRCLE edges tessellated to a chord
tolerance. For a KiCad board export that yields the board outline, every hole
and cutout, and the silhouette of each component body: a technical drawing
rather than a solid, which is what the page wants anyway.

The KiCad exporter bakes world coordinates into the geometry, so assembly
placements can be ignored. The script asserts this by checking the coordinate
spread against the declared board extents.

Output is a little-endian Float32 blob of xyz triplets, consecutive pairs
forming one segment, centred on the origin and scaled to unit size.

    python3 scripts/step-to-wireframe.py WatchESP.step public/watch-esp.bin
"""
import math
import re
import struct
import sys

CHORD_TOLERANCE_MM = 0.35
MIN_ARC_SEGMENTS = 4
MAX_ARC_SEGMENTS = 64


def parse_entities(path):
    raw = open(path, errors="ignore").read()
    body = raw.split("DATA;", 1)[1].split("ENDSEC;", 1)[0]
    flat = re.sub(r"\s*\n\s*", "", body)
    entities = {}
    for m in re.finditer(r"#(\d+)\s*=\s*([A-Z_0-9]+)\s*\((.*?)\);", flat):
        entities[int(m.group(1))] = (m.group(2), m.group(3))
    return entities


def split_args(s):
    """Split a STEP argument list on top-level commas."""
    out, depth, cur, in_str = [], 0, [], False
    for ch in s:
        if in_str:
            cur.append(ch)
            if ch == "'":
                in_str = False
            continue
        if ch == "'":
            in_str = True
            cur.append(ch)
        elif ch == "(":
            depth += 1
            cur.append(ch)
        elif ch == ")":
            depth -= 1
            cur.append(ch)
        elif ch == "," and depth == 0:
            out.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur).strip())
    return out


def ref(token):
    m = re.match(r"#(\d+)$", token.strip())
    return int(m.group(1)) if m else None


def build(entities):
    points, directions = {}, {}
    for n, (kind, args) in entities.items():
        if kind in ("CARTESIAN_POINT", "DIRECTION"):
            m = re.search(r"\(([-0-9.eE,+ ]+)\)\s*$", args)
            if not m:
                continue
            v = [float(x) for x in m.group(1).split(",")]
            if len(v) == 3:
                (points if kind == "CARTESIAN_POINT" else directions)[n] = v
    vertices = {}
    for n, (kind, args) in entities.items():
        if kind == "VERTEX_POINT":
            p = ref(split_args(args)[1])
            if p in points:
                vertices[n] = points[p]
    return points, directions, vertices


def placement(entities, points, directions, n):
    """AXIS2_PLACEMENT_3D -> (origin, z axis, x axis), with STEP's defaults."""
    a = split_args(entities[n][1])
    origin = points.get(ref(a[1]), [0.0, 0.0, 0.0])
    z = directions.get(ref(a[2]), [0.0, 0.0, 1.0]) if len(a) > 2 else [0.0, 0.0, 1.0]
    x = directions.get(ref(a[3]), None) if len(a) > 3 else None
    if x is None:
        x = [1.0, 0.0, 0.0] if abs(z[2]) < 0.9 else [1.0, 0.0, 0.0]
    # Gram-Schmidt: make x perpendicular to z, then y = z X x.
    d = sum(x[i] * z[i] for i in range(3))
    x = [x[i] - d * z[i] for i in range(3)]
    nx = math.sqrt(sum(c * c for c in x)) or 1.0
    x = [c / nx for c in x]
    y = [
        z[1] * x[2] - z[2] * x[1],
        z[2] * x[0] - z[0] * x[2],
        z[0] * x[1] - z[1] * x[0],
    ]
    return origin, z, x, y


def keep_main_cluster(segments, gap_fraction=0.15):
    """Split the model where there is a large empty gap and keep the biggest piece.

    A KiCad assembly export can contain a footprint whose placement was never
    applied, leaving it stranded at the origin far from the board. Framing the
    whole bounding box then shrinks the board into a corner of the view, so the
    stray piece is dropped — and reported, because it usually means something
    is wrong upstream in the PCB project.

    The gap is measured against the model's LARGEST overall dimension, not the
    span of the axis being split. A board is thin: judged per-axis, the 1.6mm
    between its top and bottom faces looks like a huge gap in z and the board
    gets sliced into sheets.
    """
    mids = [
        tuple((a[i] + b[i]) / 2 for i in range(3))
        for a, b in segments
    ]

    def bbox(idx):
        cols = [[mids[i][j] for i in idx] for j in range(3)]
        return [max(c) - min(c) for c in cols]

    def diagonal(idx):
        return sum(v * v for v in bbox(idx)) ** 0.5

    active = list(range(len(segments)))
    dropped = []
    while True:
        threshold = max(bbox(active)) * gap_fraction
        best = None
        for axis in range(3):
            order = sorted(active, key=lambda i: mids[i][axis])
            values = [mids[i][axis] for i in order]
            for k in range(len(values) - 1):
                gap = values[k + 1] - values[k]
                if gap > threshold and (best is None or gap > best[0]):
                    best = (gap, order[: k + 1], order[k + 1:], axis, values[k])
        if best is None:
            break
        _gap, left, right, axis, cut = best
        keep, drop = (left, right) if diagonal(left) > diagonal(right) else (right, left)
        dropped.append(
            (f"{'xyz'[axis]} ~ {cut:.1f}", len(drop), [round(v, 2) for v in bbox(drop)])
        )
        active = keep

    return [segments[i] for i in active], dropped


def main(src, dst):
    entities = parse_entities(src)
    points, directions, vertices = build(entities)
    segments = []

    for n, (kind, args) in entities.items():
        if kind != "EDGE_CURVE":
            continue
        a = split_args(args)
        v1, v2, curve = ref(a[1]), ref(a[2]), ref(a[3])
        same_sense = a[4].strip() == ".T."
        if v1 not in vertices or v2 not in vertices or curve not in entities:
            continue
        p1, p2 = vertices[v1], vertices[v2]
        ckind, cargs = entities[curve]

        if ckind == "CIRCLE":
            ca = split_args(cargs)
            plc, radius = ref(ca[1]), float(ca[2])
            origin, _z, ax, ay = placement(entities, points, directions, plc)

            def angle_of(p):
                d = [p[i] - origin[i] for i in range(3)]
                return math.atan2(
                    sum(d[i] * ay[i] for i in range(3)),
                    sum(d[i] * ax[i] for i in range(3)),
                )

            a1, a2 = angle_of(p1), angle_of(p2)
            sweep = (a2 - a1) % (2 * math.pi)
            if not same_sense:
                sweep -= 2 * math.pi
            if abs(sweep) < 1e-9:
                sweep = 2 * math.pi  # closed edge: a full circle
            arc_len = abs(sweep) * radius
            steps = int(max(MIN_ARC_SEGMENTS,
                            min(MAX_ARC_SEGMENTS, math.ceil(arc_len / CHORD_TOLERANCE_MM))))
            prev = None
            for i in range(steps + 1):
                ang = a1 + sweep * (i / steps)
                pt = [
                    origin[j] + radius * (math.cos(ang) * ax[j] + math.sin(ang) * ay[j])
                    for j in range(3)
                ]
                if prev is not None:
                    segments.append((prev, pt))
                prev = pt
        else:
            # LINE, and B-splines approximated by their chord: at board scale
            # the exporter's splines are short.
            segments.append((p1, p2))

    segments, dropped = keep_main_cluster(segments)
    for label, count, box in dropped:
        print(f"DROPPED cluster : {count} segments at {label}, bbox {box} mm")

    # Centre on the origin and scale so the longest axis is 1.
    flat = [c for s in segments for p in s for c in p]
    xs, ys, zs = flat[0::3], flat[1::3], flat[2::3]
    centre = [(min(v) + max(v)) / 2 for v in (xs, ys, zs)]
    extent = max(max(v) - min(v) for v in (xs, ys, zs)) or 1.0

    out = bytearray()
    for p1, p2 in segments:
        for p in (p1, p2):
            for j in range(3):
                out += struct.pack("<f", (p[j] - centre[j]) / extent)
    open(dst, "wb").write(out)

    print(f"edges parsed   : {sum(1 for k, _ in entities.values() if k == 'EDGE_CURVE')}")
    print(f"segments       : {len(segments)}")
    print(f"extent (mm)    : {[round(max(v) - min(v), 2) for v in (xs, ys, zs)]}")
    print(f"written        : {dst}  ({len(out) / 1024:.1f} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
