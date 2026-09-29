#!/usr/bin/env python3
"""
Pack KiCad's GLB export of the watch board into a mesh whose parts are
addressable, for the watch walkthrough.

    python3 scripts/glb-to-parts.py \
        "~/Documents/KiCad Projects/WatchESP/WatchESP.glb" \
        "~/Documents/KiCad Projects/WatchESP/WatchESP.kicad_pcb" \
        public/watch-parts.bin

KiCad (File > Export > GLB) writes one top-level node per footprint, named by
its reference designator, plus unnamed nodes for the board itself. The board
file supplies what the GLB doesn't: each part's value and the schematic sheet
it was drawn on, which is how parts are grouped into chapters.

Coordinates: the GLB is in metres with Y up and Z = KiCad's Y. Output is in the
same frame as the old STL mesh — X = KiCad X, Y = -KiCad Y, Z = up — centred on
the bounding box and scaled so the longest axis spans exactly 1, so every view
setting carries over unchanged.

Format "AVP1" (little-endian):
    "AVP1"                     magic
    uint32 headerBytes
    header                     UTF-8 JSON, space-padded to a multiple of 4:
                               { vertexCount, indexCount, halfExtent[3],
                                 frame: { center[3], scale },  # mm -> model
                                 parts: [{ ref, value, sheet, v: [start, count],
                                           i: [start, count], center[3], size[3] }] }
    int16  positions[vertexCount * 3]   q / 32767 * halfExtent, padded to 4 bytes
    uint16 indices[indexCount]          relative to the part's first vertex

Vertices and indices are grouped by part, so each part is a contiguous slice
that can be uploaded as its own geometry. Vertices are deduplicated exactly
within a part, so edge detection works in the browser. Part 0 is the board.
"""
import json
import os
import re
import struct
import sys

import numpy as np

COMPONENT_TYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
COMPONENT_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    data = open(path, "rb").read()
    magic, _version, _length = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF", "not a GLB"
    offset, doc, blob = 12, None, None
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        chunk = data[offset + 8 : offset + 8 + size]
        if kind == b"JSON":
            doc = json.loads(chunk)
        elif kind == b"BIN\x00":
            blob = chunk
        offset += 8 + size
    return doc, blob


def accessor(doc, blob, index):
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    dtype = COMPONENT_TYPES[acc["componentType"]]
    width = COMPONENT_COUNTS[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride")
    itemsize = np.dtype(dtype).itemsize * width
    if stride and stride != itemsize:
        raw = np.frombuffer(blob, np.uint8, count=stride * acc["count"], offset=start)
        raw = raw.reshape(acc["count"], stride)[:, :itemsize].copy()
        return raw.view(dtype).reshape(acc["count"], width)
    return np.frombuffer(blob, dtype, count=acc["count"] * width, offset=start).reshape(acc["count"], width)


def local_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    s = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    r = np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )
    m = np.eye(4)
    m[:3, :3] = r * s
    m[:3, 3] = t
    return m


def collect(doc, blob, node_index, parent, out):
    """Every triangle under a node, in world space, as (positions, indices)."""
    node = doc["nodes"][node_index]
    world = parent @ local_matrix(node)
    if "mesh" in node:
        for prim in doc["meshes"][node["mesh"]]["primitives"]:
            if prim.get("mode", 4) != 4:
                continue
            pos = accessor(doc, blob, prim["attributes"]["POSITION"]).astype(np.float64)
            pos = (np.c_[pos, np.ones(len(pos))] @ world.T)[:, :3]
            if "indices" in prim:
                idx = accessor(doc, blob, prim["indices"]).reshape(-1).astype(np.int64)
            else:
                idx = np.arange(len(pos))
            out.append((pos, idx))
    for child in node.get("children", []):
        collect(doc, blob, child, world, out)


def kicad_parts(path):
    """ref -> (value, sheet, x, y) from the board file, keyed by ref and position."""
    text = open(path).read()
    parts = {}
    for chunk in text.split("\n\t(footprint ")[1:]:
        ref = re.search(r'\(property "Reference" "([^"]*)"', chunk)
        val = re.search(r'\(property "Value" "([^"]*)"', chunk)
        sheet = re.search(r'\(sheetname "([^"]*)"\)', chunk)
        at = re.search(r"\(at ([-\d.]+) ([-\d.]+)", chunk)
        if not ref or not at:
            continue
        parts.setdefault(ref.group(1), []).append(
            (val.group(1) if val else "", sheet.group(1) if sheet else "", float(at.group(1)), float(at.group(2)))
        )
    return parts


def main(glb_path, pcb_path, out_path):
    doc, blob = read_glb(os.path.expanduser(glb_path))
    board = kicad_parts(os.path.expanduser(pcb_path))
    root = doc["scenes"][doc.get("scene", 0)]["nodes"]

    groups = {}  # ref -> list of (pos, idx)
    origins = {}  # ref -> node translation, to pick between duplicate refs
    for top in root:
        for child in doc["nodes"][top].get("children", []) or [top]:
            name = doc["nodes"][child].get("name", "")
            ref = name if name and not name.startswith("=>") else "PCB"
            tris = []
            collect(doc, blob, child, np.eye(4), tris)
            groups.setdefault(ref, []).extend(tris)
            if ref != "PCB":
                origins[ref] = doc["nodes"][child].get("translation", [0, 0, 0])

    # GLB (x, y_up, z = kicad y) in metres -> (x, -kicad y, up) in mm.
    def to_model(p):
        return np.c_[p[:, 0], -p[:, 2], p[:, 1]] * 1000.0

    order = ["PCB"] + sorted((r for r in groups if r != "PCB"), key=lambda r: (re.sub(r"\d", "", r), int(re.sub(r"\D", "", r) or 0)))
    meshes = []
    for ref in order:
        pos = np.concatenate([to_model(p) for p, _ in groups[ref]])
        base, idx = 0, []
        for p, i in groups[ref]:
            idx.append(i + base)
            base += len(p)
        idx = np.concatenate(idx)
        # exact dedup within the part
        uniq, inverse = np.unique(np.round(pos, 6), axis=0, return_inverse=True)
        meshes.append((ref, uniq, inverse.reshape(-1)[idx]))

    allpos = np.concatenate([m[1] for m in meshes])
    lo, hi = allpos.min(0), allpos.max(0)
    center = (lo + hi) / 2
    scale = 1.0 / (hi - lo).max()
    half = (hi - lo) / 2 * scale

    parts, positions, indices = [], [], []
    v0 = i0 = 0
    for ref, pos, idx in meshes:
        n = (pos - center) * scale
        assert len(n) < 65536, f"{ref}: too many vertices for uint16 indices"
        q = np.round(n / half * 32767).clip(-32767, 32767).astype("<i2")
        plo, phi = n.min(0), n.max(0)
        if ref == "PCB":
            value, sheet = "PCB", "Board"
        else:
            options = board.get(ref, [("", "", 0, 0)])
            ox, oz = origins[ref][0] * 1000, origins[ref][2] * 1000
            value, sheet, _, _ = min(options, key=lambda o: (o[2] - ox) ** 2 + (o[3] - oz) ** 2)
        parts.append(
            {
                "ref": ref,
                "value": value,
                "sheet": sheet,
                "v": [v0, len(n)],
                "i": [i0, len(idx)],
                "center": [round(float(c), 5) for c in (plo + phi) / 2],
                "size": [round(float(c), 5) for c in phi - plo],
            }
        )
        positions.append(q)
        indices.append(idx.astype("<u2"))
        v0 += len(n)
        i0 += len(idx)

    header = json.dumps(
        {
            "vertexCount": v0,
            "indexCount": i0,
            "halfExtent": [round(float(h), 6) for h in half],
            # model = (mm - center) * scale, with mm = (kicad x, -kicad y, up)
            "frame": {"center": [round(float(c), 4) for c in center], "scale": round(float(scale), 8)},
            "parts": parts,
        },
        separators=(",", ":"),
    ).encode()
    header += b" " * (-len(header) % 4)
    pos_bytes = np.concatenate(positions).tobytes()
    pos_bytes += b"\0" * (-len(pos_bytes) % 4)
    with open(out_path, "wb") as f:
        f.write(b"AVP1")
        f.write(struct.pack("<I", len(header)))
        f.write(header)
        f.write(pos_bytes)
        f.write(np.concatenate(indices).tobytes())

    size_mm = (hi - lo)
    print(f"{len(parts)} parts, {v0} vertices, {i0 // 3} triangles -> {out_path} ({os.path.getsize(out_path) / 1024:.0f} KB)")
    print(f"extent {size_mm[0]:.2f} x {size_mm[1]:.2f} x {size_mm[2]:.2f} mm, normalised {half[0]*2:.3f} x {half[1]*2:.3f} x {half[2]*2:.3f}")
    for p in parts:
        print(f"  {p['ref']:<5} {p['value']:<24} {p['sheet']:<20} tris {p['i'][1] // 3:>6}  centre {p['center']}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
