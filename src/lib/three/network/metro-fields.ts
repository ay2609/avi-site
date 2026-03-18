import type { BridgeLane, Hotspot, MeshWorldGraph, RemoteField } from "./world-graph-types";

export interface GeoSample {
  lat: number;
  lng: number;
}

export function sampleHotspotPoint(hotspot: Hotspot, rng: () => number, spread = 1): GeoSample {
  const angle = ((hotspot.angleDeg + (rng() - 0.5) * 34) * Math.PI) / 180;
  const radial = hotspot.radiusDeg * spread * Math.pow(rng(), 0.62);
  const major = radial * hotspot.elongation;
  const minor = radial / Math.max(hotspot.elongation, 1);
  const lobe = (rng() - 0.5) * radial * 0.44 * hotspot.clusterBias;
  const x = Math.cos(angle) * major * (0.22 + rng() * 0.96) + lobe;
  const y = Math.sin(angle) * minor * (0.3 + rng() * 0.92);

  return offsetPoint(hotspot.lat, hotspot.lng, y, x);
}

export function sampleRemoteFieldPoint(field: RemoteField, rng: () => number, spread = 1): GeoSample {
  const angle = ((field.angleDeg + (rng() - 0.5) * 48) * Math.PI) / 180;
  const radial = field.radiusDeg * spread * Math.sqrt(rng());
  const major = radial * field.elongation;
  const minor = radial / Math.max(field.elongation, 1);
  const x = Math.cos(angle) * major * (0.28 + rng() * 0.9);
  const y = Math.sin(angle) * minor * (0.28 + rng() * 0.9);

  return offsetPoint(field.lat, field.lng, y, x);
}

export function sampleBridgeLanePoint(
  lane: BridgeLane,
  graph: MeshWorldGraph,
  rng: () => number,
  progress = biasedProgress(rng),
): GeoSample {
  const lateralOffset = (rng() - 0.5) * lane.thicknessDeg;
  return interpolateLanePoint(lane, graph, progress, lateralOffset, (rng() - 0.5) * 0.08);
}

export function interpolateLanePoint(
  lane: BridgeLane,
  graph: MeshWorldGraph,
  progress: number,
  lateralOffsetDeg = 0,
  curvatureOffset = 0,
): GeoSample {
  const from = graph.hotspotById.get(lane.fromHotspotId);
  const to = graph.hotspotById.get(lane.toHotspotId);
  if (!from || !to) {
    return { lat: 0, lng: 0 };
  }

  return interpolateArc(
    from.lat,
    from.lng,
    to.lat,
    to.lng,
    progress,
    lane.curvature + curvatureOffset,
    lateralOffsetDeg,
  );
}

export function interpolateArc(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  progress: number,
  curvature: number,
  lateralOffsetDeg = 0,
): GeoSample {
  const t = clamp(progress, 0, 1);
  const lngDelta = shortestLongitudeDelta(fromLng, toLng);
  const baseLat = lerp(fromLat, toLat, t);
  const baseLng = wrapLongitude(fromLng + lngDelta * t);
  const tangentLat = toLat - fromLat;
  const tangentLng = lngDelta;
  const tangentLength = Math.max(Math.hypot(tangentLat, tangentLng), 1e-5);
  const normalLat = -tangentLng / tangentLength;
  const normalLng = tangentLat / tangentLength;
  const distance = angularDistanceDeg(fromLat, fromLng, toLat, toLng);
  const arcMagnitude = Math.sin(Math.PI * t) * distance * curvature * 0.18;
  const combinedOffset = arcMagnitude + lateralOffsetDeg;

  return offsetPoint(baseLat, baseLng, normalLat * combinedOffset, normalLng * combinedOffset);
}

export function angularDistanceDeg(latA: number, lngA: number, latB: number, lngB: number): number {
  const phi1 = (latA * Math.PI) / 180;
  const phi2 = (latB * Math.PI) / 180;
  const dPhi = ((latB - latA) * Math.PI) / 180;
  const dLambda = (shortestLongitudeDelta(lngA, lngB) * Math.PI) / 180;
  const haversine =
    Math.sin(dPhi * 0.5) * Math.sin(dPhi * 0.5) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda * 0.5) * Math.sin(dLambda * 0.5);

  return (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(1 - haversine, 0))) * 180) / Math.PI;
}

export function shortestLongitudeDelta(a: number, b: number): number {
  let delta = wrapLongitude(b) - wrapLongitude(a);
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  return delta;
}

export function wrapLongitude(lng: number): number {
  let normalized = ((lng + 180) % 360 + 360) % 360 - 180;
  if (normalized === -180) {
    normalized = 180;
  }
  return normalized;
}

export function offsetPoint(lat: number, lng: number, latOffsetDeg: number, lngOffsetDeg: number): GeoSample {
  const nextLat = clamp(lat + latOffsetDeg, -84, 84);
  const cosLat = Math.max(Math.cos((nextLat * Math.PI) / 180), 0.25);

  return {
    lat: nextLat,
    lng: wrapLongitude(lng + lngOffsetDeg / cosLat),
  };
}

function biasedProgress(rng: () => number): number {
  const raw = rng();
  return raw < 0.5 ? Math.pow(raw * 2, 0.88) * 0.5 : 1 - Math.pow((1 - raw) * 2, 0.88) * 0.5;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
