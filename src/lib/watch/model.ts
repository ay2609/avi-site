/**
 * Decoder for the "AVP1" watch model written by scripts/glb-to-parts.py: the
 * board and every part on it as separate, contiguous slices of one buffer.
 *
 * Model space: X = KiCad X, Y = −KiCad Y, Z = up (component side), centred on
 * the bounding box and scaled so the longest axis spans 1.
 */

export interface PartInfo {
  ref: string;
  value: string;
  /** The schematic sheet the part was drawn on — how parts group into chapters. */
  sheet: string;
  /** [first vertex, vertex count] */
  v: [number, number];
  /** [first index, index count]; indices are relative to the part's first vertex. */
  i: [number, number];
  center: [number, number, number];
  size: [number, number, number];
}

export interface WatchModel {
  halfExtent: [number, number, number];
  /** model = (mm − center) · scale, with mm = (KiCad x, −KiCad y, up). */
  frame: { center: [number, number, number]; scale: number };
  parts: PartInfo[];
  positions: Float32Array;
  indices: Uint16Array;
}

export function decodeWatchModel(buffer: ArrayBuffer): WatchModel {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "AVP1") throw new Error("not an AVP1 model");
  const headerBytes = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerBytes)));

  let offset = 8 + headerBytes;
  const count = header.vertexCount * 3;
  const q = new Int16Array(buffer, offset, count);
  offset += count * 2;
  offset += (4 - (offset % 4)) % 4;

  const [hx, hy, hz] = header.halfExtent as number[];
  const positions = new Float32Array(count);
  for (let i = 0; i < count; i += 3) {
    positions[i] = (q[i] / 32767) * hx;
    positions[i + 1] = (q[i + 1] / 32767) * hy;
    positions[i + 2] = (q[i + 2] / 32767) * hz;
  }
  const indices = new Uint16Array(buffer, offset, header.indexCount);

  return {
    halfExtent: header.halfExtent,
    frame: header.frame,
    parts: header.parts,
    positions,
    indices,
  };
}

/** A KiCad board coordinate (mm) and height above it, in model space. */
export function fromKicad(model: WatchModel, x: number, y: number, up = 0): [number, number, number] {
  const { center, scale } = model.frame;
  return [(x - center[0]) * scale, (-y - center[1]) * scale, (up - center[2]) * scale];
}
