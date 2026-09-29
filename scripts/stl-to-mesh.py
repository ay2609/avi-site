#!/usr/bin/env python3
"""
Pack a binary STL into a compact indexed mesh for the site.

    python3 scripts/stl-to-mesh.py WatchESP.stl public/watch-esp.mesh

Format (little-endian):
    "AVIM"                       magic
    uint32 vertexCount
    uint32 indexCount
    uint32 indexBytes            2 or 4
    float32 scale[3]             half-extent per axis after centring, i.e.
                                 position = q / 32767 * scale
    int16  positions[vertexCount * 3]
    uint16|uint32 indices[indexCount]

The model is centred and normalised so its longest axis spans exactly 1,
matching what the wireframe blob did. Vertices are deduplicated exactly, so
smooth-shading and edge detection work in the browser.
"""
import struct
import sys


def main(src: str, dst: str) -> None:
    data = open(src, "rb").read()
    if data[:5] == b"solid" and b"facet" in data[:2000]:
        sys.exit("ASCII STL not supported; export binary")
    (n,) = struct.unpack_from("<I", data, 80)
    tri = struct.Struct("<12fH")

    verts: dict[tuple[float, float, float], int] = {}
    order: list[tuple[float, float, float]] = []
    indices: list[int] = []
    off = 84
    for _ in range(n):
        d = tri.unpack_from(data, off)
        off += 50
        for k in (3, 6, 9):
            v = (d[k], d[k + 1], d[k + 2])
            i = verts.get(v)
            if i is None:
                i = len(order)
                verts[v] = i
                order.append(v)
            indices.append(i)

    mn = [min(v[k] for v in order) for k in range(3)]
    mx = [max(v[k] for v in order) for k in range(3)]
    centre = [(mn[k] + mx[k]) / 2 for k in range(3)]
    longest = max(mx[k] - mn[k] for k in range(3))
    scale = [(mx[k] - mn[k]) / 2 / longest for k in range(3)]  # half-extents, normalised

    q = bytearray()
    for v in order:
        for k in range(3):
            s = scale[k]
            u = 0.0 if s == 0 else (v[k] - centre[k]) / longest / s  # -1..1
            q += struct.pack("<h", int(round(max(-1.0, min(1.0, u)) * 32767)))

    index_bytes = 2 if len(order) <= 0xFFFF else 4
    out = bytearray(b"AVIM")
    out += struct.pack("<III", len(order), len(indices), index_bytes)
    out += struct.pack("<3f", *scale)
    out += q
    out += struct.pack(f"<{len(indices)}{'H' if index_bytes == 2 else 'I'}", *indices)
    open(dst, "wb").write(out)
    print(
        f"{n} triangles -> {len(order)} vertices, {len(indices)} indices, "
        f"{len(out) / 1024:.0f} KB; extent {[round(2 * s, 3) for s in scale]}"
    )


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
