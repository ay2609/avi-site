#!/usr/bin/env python3
"""
BYM's classroom drone as a parts model for its walkthrough, drawn from the
parts' specs (there's no CAD of the kit), packed in the same "AVP1" format as
the boards (see glb-to-parts.py), so the teardown engine draws it like one.

    python3 scripts/drone-model.py public/drone-parts.bin

Needs numpy, shapely and manifold3d (the CAD toolkit's venv has all three).

Sources, all in mm:
  - Frame, MicoAir MVD30 Headless: MicoAir's plate drawing (119.2 × 113, 3 mm
    carbon, motors 102 across and 90 fore-aft, so 136 on the diagonal; AIO
    holes 25.5 square turned 45°) and ring drawing (193 × 181, 26 tall with
    the plate). The ring is four open ducts in one moulding, with a cradle in
    the middle that the plate screws down onto.
  - On this frame the motors hang under the arms and the props spin inside
    the ring; the flight controller, the interface board, the flow sensor and
    the receiver sit under the plate, and the battery is strapped on top.
  - Motors, Emax ECO Micro 1407: bell Ø18.8, about 12.5 tall, 12 × 12 mount.
  - Props, Gemfan Flash 3052-3: Ø76, three blades, 6 mm hub.
  - Flight controller, MicoAir H743 V2 AIO: 36 × 36 × 8.
  - Battery, 2S Li-ion 3300 mAh: 70 × 37 × 18 (two 18650s side by side).
  - Where the receiver and the telemetry radio sit is a guess: the receiver
    behind the flow sensor, as MicoAir shows it; the LR24-F in the front pocket
    the camera version's head would fill.

Frame: x right, y forward (the plate's notched end), z up from the feet.
Curved walls are prisms of enough facets that only their rims draw as lines.
"""
import json
import math
import os
import struct
import sys

import manifold3d as m3d
import numpy as np
from shapely import affinity
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

SEG = 96  # facets in a full circle

# Heights, from the ring drawing's side view (26 mm from the feet to the plate's top).
FEET = 2.0  # the cradle's floor sits this far up
RING_Z = (4.6, 12.0)
PLATE_Z = (23.0, 26.0)

MOTOR = [(51.0, 45.0), (-51.0, 45.0), (-51.0, -45.0), (51.0, -45.0)]  # M1…M4: front right, then anticlockwise
DUCT_R = 40.0  # inside of a duct; the prop is 38
WALL_R = 45.5  # outside: 193 / 2 − 51 across, 181 / 2 − 45 fore-aft


def circle(x, y, r, seg=SEG):
    return Point(x, y).buffer(r, quad_segs=max(4, seg // 4))


def extrude(shape, z0, z1):
    """A shapely (multi)polygon as a prism from z0 to z1."""
    polys = list(shape.geoms) if isinstance(shape, MultiPolygon) else [shape]
    out = m3d.Manifold()
    for p in polys:
        p = p.simplify(0.01)
        rings = [np.array(p.exterior.coords[:-1])]
        rings += [np.array(i.coords[:-1]) for i in p.interiors]
        cs = m3d.CrossSection([r.tolist() for r in rings], m3d.FillRule.EvenOdd)
        out += m3d.Manifold.extrude(cs, z1 - z0).translate([0, 0, z0])
    return out


def block(x0, x1, y0, y1, z0, z1):
    return extrude(box(x0, y0, x1, y1), z0, z1)


def cyl(x, y, r, z0, z1, seg=SEG):
    return extrude(circle(x, y, r, seg), z0, z1)


# --- The frame -----------------------------------------------------------------


def plate():
    """The carbon plate: centre body, four arms to cross-shaped motor pads, the tail."""
    body = Polygon(
        [(-24, 22.6), (24, 22.6), (28.5, 12), (28.5, -15), (21, -22), (13.5, -30), (12, -42), (13, -58.7),
         (-13, -58.7), (-12, -42), (-13.5, -30), (-21, -22), (-28.5, -15), (-28.5, 12)]
    )
    ears = [circle(sx * 12.5, 24.5, 4.2, 32) for sx in (-1, 1)]
    arms, pads = [], []
    for mx, my in MOTOR:
        ang = math.atan2(my, mx)
        L = math.hypot(mx, my)
        arm = box(0, -3.2, L, 3.2)
        arms.append(affinity.rotate(arm, ang, origin=(0, 0), use_radians=True))
        lobes = [circle(mx + 8.5 * math.cos(a), my + 8.5 * math.sin(a), 2.6, 24) for a in np.arange(4) * math.pi / 2]
        # The pad, its four lobes for the screws, and the necks between them.
        necks = [affinity.translate(affinity.rotate(box(-2.2, 0, 2.2, 8.5), a, origin=(0, 0)), mx, my) for a in (0, 90, 180, 270)]
        pads.append(unary_union([circle(mx, my, 6.2, 48), *lobes, *necks]))
    shape = unary_union([body, *ears, *arms, *pads]).buffer(1.2).buffer(-1.2)
    # Notch between the ears, slots and holes.
    holes = [box(-7.5, 20.4, 7.5, 23)]
    holes += [circle(mx, my, 3.0, 32) for mx, my in MOTOR]
    for mx, my in MOTOR:
        holes += [circle(mx + 8.5 * math.cos(a), my + 8.5 * math.sin(a), 1.0, 16) for a in np.arange(4) * math.pi / 2]
    holes += [circle(x, y, 1.0, 16) for x, y in ((0, 18.0), (0, -18.0), (18.0, 0), (-18.0, 0))]  # AIO, 25.5 square at 45°
    for sx in (-1, 1):
        holes.append(box(sx * 24.5 - 1.75, -8, sx * 24.5 + 1.75, 3).buffer(1.75, quad_segs=6).buffer(-1.6, quad_segs=6))
        holes.append(box(sx * 14.5 - 1.6, -12, sx * 14.5 + 1.6, -4).buffer(1.5, quad_segs=6).buffer(-1.4, quad_segs=6))
        holes.append(circle(sx * 24, 16.5, 1.0, 16))
        holes.append(circle(sx * 24, -16.5, 1.0, 16))
        holes.append(circle(sx * 8.5, -36, 1.0, 16))
    holes.append(box(-1.6, -16, 1.6, -6).buffer(1.5, quad_segs=6).buffer(-1.4, quad_segs=6))
    holes.append(box(-6, -53, 6, -48))
    shape = shape.difference(unary_union(holes))
    out = extrude(shape, *PLATE_Z)
    # The battery strap's two arches, and the XT30 on the tail.
    for sy in (-1, 1):
        arch = Polygon([(-21.5, 0), (-21.5, 9), (21.5, 9), (21.5, 0), (19.5, 0), (19.5, 7), (-19.5, 7), (-19.5, 0)])
        out += extrude(arch, -1.6, 1.6).rotate([90, 0, 0]).translate([0, sy * 14, PLATE_Z[1]])
    out += block(-5, 5, -46, -38, PLATE_Z[1], PLATE_Z[1] + 5)
    return out


def ring():
    """The moulded guard: four ducts in one ring, the cradle under the plate, its gussets and feet."""
    centres = MOTOR
    hull = MultiPolygon([circle(x, y, WALL_R) for x, y in centres]).convex_hull
    # Concave necks between the ducts, tangent to both: the side ones tight, front and back nearly flat.
    side = 18.5
    fore = 125.0
    necks = [circle(sx * (78 + side), 0, side) for sx in (-1, 1)] + [circle(0, sy * (82.7 + fore), fore, 512) for sy in (-1, 1)]
    outline = hull.difference(unary_union(necks))
    ducts = unary_union([circle(x, y, DUCT_R) for x, y in centres])
    middle = box(-51, -45, 51, 45).difference(unary_union([circle(x, y, WALL_R) for x, y in centres]))
    band = outline.difference(ducts).difference(middle)
    out = extrude(band, *RING_Z)
    # A lip around the top of the outside, a step in from the edge.
    lip = outline.difference(outline.buffer(-1.6)).difference(ducts)
    out += extrude(lip, RING_Z[1], RING_Z[1] + 1.2)

    # The cradle: a floor with a window for the flow sensor, four posts up to the plate, a front pocket.
    floor = box(-16, -30, 16, 36).difference(box(-9, -20, 9, 22))
    out += extrude(floor, FEET, FEET + 2.2)
    for x, y in ((-14, 34), (14, 34), (-14, -28), (14, -28)):
        out += block(x - 2.2, x + 2.2, y - 2.2, y + 2.2, FEET, PLATE_Z[0])
    pocket = box(-14, 36, 14, 62).difference(box(-11.5, 38.5, 11.5, 59.5))
    out += extrude(pocket, FEET, RING_Z[1] + 2)
    out += block(-14, 14, 36, 62, FEET, FEET + 1.6)
    # Gussets from the side necks and from the back to the cradle.
    for sx in (-1, 1):
        g = Polygon([(sx * 16, -3), (sx * 74, -1.4), (sx * 74, 1.4), (sx * 16, 3)])
        out += extrude(g, RING_Z[0], RING_Z[1] - 2)
    out += block(-1.6, 1.6, -82, -30, RING_Z[0], RING_Z[1] - 2)
    # Feet under the ring.
    for x, y in ((-60, 0), (60, 0), (-30, 62), (30, 62), (-30, -62), (30, -62)):
        out += cyl(x, y, 2.2, 0, RING_Z[0], 24)
    return out


# --- What goes on it -----------------------------------------------------------


def motor(x, y):
    """A 1407 hung under its pad: the base, the bell, the shaft down to the prop."""
    out = cyl(x, y, 7.0, PLATE_Z[0] - 2.4, PLATE_Z[0], 48)
    out += cyl(x, y, 9.4, PLATE_Z[0] - 14.4, PLATE_Z[0] - 2.4, 64)
    out += cyl(x, y, 5.0, PLATE_Z[0] - 15.6, PLATE_Z[0] - 14.4, 32)
    return out


def prop(x, y, hand):
    """A Gemfan 3052-3: three swept blades on a 6 mm hub, at the ring's height."""
    z_hub = (PLATE_Z[0] - 21.6, PLATE_Z[0] - 15.6)
    z_blade = (z_hub[0] + 1.6, z_hub[0] + 2.8)
    r_tip = 38.0
    rs = np.linspace(3.8, r_tip, 28)
    width = np.interp(rs, [3.8, 10, 22, 32, 36.5, 38], [6.5, 9.5, 11.1, 9.5, 6.5, 1.5])
    sweep = 0.38 * (rs / r_tip) ** 2  # rad, the tip swept back
    lead = [(r * math.cos(s + w / 2 / r), r * math.sin(s + w / 2 / r)) for r, s, w in zip(rs, sweep, width)]
    trail = [(r * math.cos(s - w / 2 / r), r * math.sin(s - w / 2 / r)) for r, s, w in zip(rs, sweep, width)]
    blade = Polygon(lead + trail[::-1]).buffer(0)
    blades = unary_union([affinity.rotate(blade, k * 120, origin=(0, 0)) for k in range(3)])
    if hand < 0:
        blades = affinity.scale(blades, xfact=-1, origin=(0, 0))
    blades = affinity.translate(blades, x, y)
    out = extrude(blades, *z_blade)
    out += cyl(x, y, 4.5, *z_hub, 40)
    out += cyl(x, y, 3.0, z_hub[0] - 2.0, z_hub[0], 6)  # the prop nut
    return out


def flight_controller():
    """The H743 AIO under the plate, turned 45° to its holes: the board, its chips, grommets up to the plate."""
    z0 = PLATE_Z[0] - 7.0
    out = extrude(affinity.rotate(box(-18, -18, 18, 18).buffer(1.5).buffer(-1.5), 45, origin=(0, 0)), z0, z0 + 1.6)
    out += block(-5, 5, -5, 5, z0 - 1.4, z0).rotate([0, 0, 45])  # the H743
    for k in range(4):  # the four ESCs' FETs, toward each motor
        a = math.pi / 4 + k * math.pi / 2
        cx, cy = 10.5 * math.cos(a), 10.5 * math.sin(a)
        out += extrude(affinity.rotate(box(-3.2, -2.2, 3.2, 2.2), math.degrees(a) + 90, origin=(0, 0)).buffer(0), z0 - 1.1, z0).translate([cx, cy, 0])
    out += block(-3, 3, 9, 15, z0 - 1.8, z0)  # a connector at the front corner
    for x, y in ((0, 18.0), (0, -18.0), (18.0, 0), (-18.0, 0)):
        out += cyl(x, y, 2.3, z0 + 1.6, PLATE_Z[0], 24)
    return out


def interface_board():
    """The frame's interface board under the tail: USB-C out the back, the buzzer, BOOT."""
    z0 = PLATE_Z[0] - 4.6
    out = extrude(box(-12, -58, 12, -33).buffer(1).buffer(-1), z0, z0 + 1.6)
    out += block(-4.5, 4.5, -59.5, -52, z0 - 3.2, z0)  # USB-C
    out += cyl(-5.5, -40, 4.5, z0 - 5, z0, 40)  # buzzer
    out += block(4, 7, -46, -43, z0 - 1.2, z0)  # BOOT
    return out


def battery():
    """Two 18650s side by side under shrink wrap, fore-aft on the plate, and the strap over them."""
    z0 = PLATE_Z[1] + 1.0
    w, h, L, c = 37.0, 18.0, 70.0, 4.0
    profile = Polygon([(-w / 2 + c, 0), (w / 2 - c, 0), (w / 2, c), (w / 2, h - c), (w / 2 - c, h), (-w / 2 + c, h),
                       (-w / 2, h - c), (-w / 2, c)])
    out = extrude(profile, -L / 2, L / 2).rotate([90, 0, 0]).translate([0, -4, z0])
    strap = Polygon([(-w / 2 - 1.4, -1), (-w / 2 - 1.4, h + 1.2), (w / 2 + 1.4, h + 1.2), (w / 2 + 1.4, -1),
                     (w / 2, -1), (w / 2, h), (-w / 2, h), (-w / 2, -1)])
    out += extrude(strap, -10, 10).rotate([90, 0, 0]).translate([0, -2, z0])
    out += block(-3, 3, -56, -39, z0 + 2, z0 + 5)  # its lead and XT30 back to the tail
    return out


def flow_sensor():
    """The MTF-02P in the cradle's floor: board, the flow camera's lens, the ToF window."""
    z1 = FEET + 2.2
    out = block(-7.5, 7.5, 2, 20, z1 - 3.2, z1)
    out += cyl(0, 14.5, 2.6, z1 - 4.6, z1 - 3.2, 32)
    out += block(-3.5, 3.5, 5, 8.5, z1 - 3.9, z1 - 3.2)
    return out


def receiver():
    """The ELRS Lite behind the flow sensor, its flat antenna out to a T at the back of the ring."""
    z1 = FEET + 2.2
    out = block(-5.5, 5.5, -18, -7, z1 - 2.6, z1)
    out += block(-0.6, 0.6, -76, -18, z1 - 1.8, z1 - 0.6)
    out += block(-16, 16, -77.2, -76, z1 - 1.8, z1 - 0.6)
    return out


def telemetry():
    """The LR24-F LoRa radio in the front pocket, its antenna up out of it."""
    out = block(-10, 10, 40, 58, FEET + 1.6, FEET + 9.6)
    out += block(-3, 3, 51, 55, FEET + 9.6, FEET + 12.6)  # its connector
    out += cyl(0, 53, 2.6, FEET + 12.6, FEET + 24, 32)
    return out


# --- Packing (the AVP1 layout of glb-to-parts.py) ---------------------------------


def mesh(manifold):
    m = manifold.to_mesh()
    pos = np.asarray(m.vert_properties, dtype=np.float64)[:, :3]
    idx = np.asarray(m.tri_verts, dtype=np.int64).reshape(-1)
    uniq, inverse = np.unique(np.round(pos, 5), axis=0, return_inverse=True)
    return uniq, inverse.reshape(-1)[idx]


def main(out_path):
    parts = [("PLATE", "MVD30 plate", plate()), ("RING", "MVD30 ring", ring())]
    for k, (x, y) in enumerate(MOTOR):
        parts.append((f"M{k + 1}", "ECO 1407 4100KV", motor(x, y)))
    for k, (x, y) in enumerate(MOTOR):
        # Diagonal pairs turn the same way; props in.
        parts.append((f"P{k + 1}", "Gemfan 3052-3", prop(x, y, 1 if k % 2 == 0 else -1)))
    parts += [
        ("FC", "H743 V2 AIO", flight_controller()),
        ("IFB", "Interface board", interface_board()),
        ("BAT", "2S Li-ion 3300mAh", battery()),
        ("FLOW", "MTF-02P", flow_sensor()),
        ("RX", "ELRS Lite", receiver()),
        ("TEL", "LR24-F", telemetry()),
    ]
    meshes = [(ref, value, *mesh(m)) for ref, value, m in parts]

    allpos = np.concatenate([p for _, _, p, _ in meshes])
    lo, hi = allpos.min(0), allpos.max(0)
    center = (lo + hi) / 2
    scale = 1.0 / (hi - lo).max()
    half = (hi - lo) / 2 * scale

    info, positions, indices = [], [], []
    v0 = i0 = 0
    for ref, value, pos, idx in meshes:
        n = (pos - center) * scale
        assert len(n) < 65536, f"{ref}: too many vertices for uint16 indices"
        q = np.round(n / half * 32767).clip(-32767, 32767).astype("<i2")
        plo, phi = n.min(0), n.max(0)
        info.append({
            "ref": ref, "value": value, "sheet": "", "v": [v0, len(n)], "i": [i0, len(idx)],
            "center": [round(float(c), 5) for c in (plo + phi) / 2],
            "size": [round(float(c), 5) for c in phi - plo],
        })
        positions.append(q)
        indices.append(idx.astype("<u2"))
        v0 += len(n)
        i0 += len(idx)

    header = json.dumps({
        "vertexCount": v0, "indexCount": i0,
        "halfExtent": [round(float(h), 6) for h in half],
        "frame": {"center": [round(float(c), 4) for c in center], "scale": round(float(scale), 8)},
        "parts": info,
    }, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    pos_bytes = np.concatenate(positions).tobytes()
    pos_bytes += b"\0" * (-len(pos_bytes) % 4)
    with open(out_path, "wb") as f:
        f.write(b"AVP1")
        f.write(struct.pack("<I", len(header)))
        f.write(header)
        f.write(pos_bytes)
        f.write(np.concatenate(indices).tobytes())

    size = hi - lo
    print(f"{len(info)} parts, {v0} vertices, {i0 // 3} triangles -> {out_path} ({os.path.getsize(out_path) / 1024:.0f} KB)")
    print(f"extent {size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f} mm")
    for p in info:
        print(f"  {p['ref']:<6} {p['value']:<20} tris {p['i'][1] // 3:>6}  centre {p['center']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
