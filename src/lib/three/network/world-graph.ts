import { angularDistanceDeg } from "./metro-fields";
import type { BridgeLane, Hotspot, MeshWorldGraph, RemoteField, WorldRegionId } from "./world-graph-types";

type RawHotspot = [
  name: string,
  regionId: WorldRegionId,
  lat: number,
  lng: number,
  strength: number,
  radiusDeg: number,
  elongation: number,
  angleDeg: number,
  clusterBias: number,
  bridgeBias: number,
];

const HOTSPOT_DATA: RawHotspot[] = [
  ["New York", "north-america", 40.7128, -74.006, 1.0, 4.8, 1.45, 32, 0.94, 0.9],
  ["Boston", "north-america", 42.3601, -71.0589, 0.64, 2.6, 1.2, 28, 0.66, 0.64],
  ["Washington", "north-america", 38.9072, -77.0369, 0.66, 2.9, 1.24, 28, 0.68, 0.66],
  ["Chicago", "north-america", 41.8781, -87.6298, 0.78, 3.6, 1.28, 18, 0.74, 0.78],
  ["Atlanta", "north-america", 33.749, -84.388, 0.62, 3.0, 1.18, -8, 0.62, 0.72],
  ["Miami", "north-america", 25.7617, -80.1918, 0.58, 2.7, 1.16, -18, 0.58, 0.7],
  ["Dallas", "north-america", 32.7767, -96.797, 0.68, 3.2, 1.24, -12, 0.66, 0.78],
  ["Houston", "north-america", 29.7604, -95.3698, 0.6, 3.0, 1.2, -18, 0.62, 0.72],
  ["Denver", "north-america", 39.7392, -104.9903, 0.42, 2.4, 1.14, 8, 0.48, 0.58],
  ["Los Angeles", "north-america", 34.0522, -118.2437, 0.92, 4.3, 1.52, -14, 0.88, 0.9],
  ["San Francisco Bay", "north-america", 37.7749, -122.4194, 0.76, 3.5, 1.42, -18, 0.82, 0.82],
  ["Seattle", "north-america", 47.6062, -122.3321, 0.48, 2.8, 1.16, -6, 0.56, 0.68],
  ["Toronto", "north-america", 43.6532, -79.3832, 0.58, 3.0, 1.2, 26, 0.62, 0.66],
  ["Vancouver", "north-america", 49.2827, -123.1207, 0.38, 2.3, 1.14, 12, 0.48, 0.58],
  ["Mexico City", "north-america", 19.4326, -99.1332, 0.82, 4.0, 1.38, 8, 0.88, 0.84],
  ["Monterrey", "north-america", 25.6866, -100.3161, 0.42, 2.4, 1.16, -12, 0.46, 0.58],
  ["Bogota", "latin-america", 4.711, -74.0721, 0.58, 3.3, 1.3, 22, 0.64, 0.68],
  ["Panama City", "latin-america", 8.9824, -79.5199, 0.34, 2.0, 1.12, 6, 0.42, 0.62],
  ["Medellin", "latin-america", 6.2442, -75.5812, 0.34, 2.0, 1.12, 14, 0.4, 0.52],
  ["Lima", "latin-america", -12.0464, -77.0428, 0.52, 2.8, 1.22, -14, 0.54, 0.58],
  ["Sao Paulo", "latin-america", -23.5505, -46.6333, 0.92, 4.2, 1.38, -18, 0.92, 0.88],
  ["Rio de Janeiro", "latin-america", -22.9068, -43.1729, 0.58, 2.8, 1.18, -26, 0.56, 0.62],
  ["Buenos Aires", "latin-america", -34.6037, -58.3816, 0.58, 3.0, 1.2, -10, 0.6, 0.62],
  ["Santiago", "latin-america", -33.4489, -70.6693, 0.5, 2.6, 1.12, -16, 0.48, 0.56],
  ["London", "europe", 51.5072, -0.1276, 0.96, 4.2, 1.44, 22, 0.94, 0.92],
  ["Paris", "europe", 48.8566, 2.3522, 0.9, 4.0, 1.34, 18, 0.9, 0.88],
  ["Amsterdam", "europe", 52.3676, 4.9041, 0.62, 2.7, 1.18, 12, 0.62, 0.72],
  ["Brussels", "europe", 50.8503, 4.3517, 0.42, 2.2, 1.14, 12, 0.46, 0.58],
  ["Frankfurt", "europe", 50.1109, 8.6821, 0.62, 2.8, 1.16, 18, 0.62, 0.82],
  ["Rhine Ruhr", "europe", 51.4556, 7.0116, 0.58, 3.0, 1.34, 8, 0.62, 0.72],
  ["Berlin", "europe", 52.52, 13.405, 0.54, 2.8, 1.16, 22, 0.54, 0.62],
  ["Munich", "europe", 48.1351, 11.582, 0.44, 2.2, 1.14, 26, 0.46, 0.56],
  ["Madrid", "europe", 40.4168, -3.7038, 0.54, 2.8, 1.18, -6, 0.56, 0.62],
  ["Barcelona", "europe", 41.3874, 2.1686, 0.5, 2.5, 1.14, -12, 0.52, 0.58],
  ["Milan", "europe", 45.4642, 9.19, 0.5, 2.4, 1.12, 18, 0.48, 0.56],
  ["Rome", "europe", 41.9028, 12.4964, 0.44, 2.3, 1.12, 16, 0.46, 0.54],
  ["Warsaw", "europe", 52.2297, 21.0122, 0.4, 2.3, 1.12, 18, 0.44, 0.5],
  ["Stockholm", "europe", 59.3293, 18.0686, 0.32, 2.0, 1.12, 18, 0.36, 0.46],
  ["Istanbul", "europe", 41.0082, 28.9784, 0.6, 3.0, 1.18, 14, 0.6, 0.74],
  ["Cairo", "mena", 30.0444, 31.2357, 0.78, 3.8, 1.22, 10, 0.78, 0.74],
  ["Dubai", "mena", 25.2048, 55.2708, 0.64, 3.0, 1.18, 12, 0.64, 0.92],
  ["Riyadh", "mena", 24.7136, 46.6753, 0.48, 2.4, 1.12, -6, 0.46, 0.62],
  ["Tel Aviv", "mena", 32.0853, 34.7818, 0.34, 2.0, 1.1, -10, 0.38, 0.48],
  ["Casablanca", "mena", 33.5731, -7.5898, 0.32, 2.0, 1.1, 4, 0.34, 0.46],
  ["Lagos", "africa", 6.5244, 3.3792, 0.72, 3.3, 1.18, -8, 0.72, 0.66],
  ["Abidjan", "africa", 5.3599, -4.0083, 0.28, 1.8, 1.06, -4, 0.32, 0.38],
  ["Nairobi", "africa", -1.2921, 36.8219, 0.48, 2.6, 1.14, 22, 0.48, 0.58],
  ["Addis Ababa", "africa", 8.9806, 38.7578, 0.34, 2.0, 1.1, 18, 0.34, 0.44],
  ["Johannesburg", "africa", -26.2041, 28.0473, 0.5, 2.7, 1.16, 8, 0.5, 0.58],
  ["Cape Town", "africa", -33.9249, 18.4241, 0.32, 2.1, 1.08, 4, 0.34, 0.44],
  ["Delhi", "south-asia", 28.6139, 77.209, 0.98, 4.4, 1.38, 18, 0.96, 0.88],
  ["Mumbai", "south-asia", 19.076, 72.8777, 0.92, 4.2, 1.34, -12, 0.92, 0.86],
  ["Bengaluru", "south-asia", 12.9716, 77.5946, 0.72, 3.2, 1.22, -8, 0.72, 0.72],
  ["Hyderabad", "south-asia", 17.385, 78.4867, 0.62, 3.0, 1.18, -4, 0.62, 0.66],
  ["Chennai", "south-asia", 13.0827, 80.2707, 0.56, 2.8, 1.14, 6, 0.56, 0.62],
  ["Kolkata", "south-asia", 22.5726, 88.3639, 0.58, 3.0, 1.16, 14, 0.58, 0.64],
  ["Karachi", "south-asia", 24.8607, 67.0011, 0.56, 2.9, 1.16, -8, 0.54, 0.64],
  ["Dhaka", "south-asia", 23.8103, 90.4125, 0.78, 3.6, 1.18, 12, 0.78, 0.68],
  ["Beijing", "east-asia", 39.9042, 116.4074, 0.88, 4.0, 1.26, 14, 0.84, 0.82],
  ["Shanghai", "east-asia", 31.2304, 121.4737, 0.96, 4.4, 1.34, 10, 0.92, 0.9],
  ["Shenzhen", "east-asia", 22.5431, 114.0579, 0.74, 3.3, 1.18, -8, 0.76, 0.78],
  ["Hong Kong", "east-asia", 22.3193, 114.1694, 0.66, 2.8, 1.12, -10, 0.66, 0.88],
  ["Seoul", "east-asia", 37.5665, 126.978, 0.88, 3.8, 1.22, 16, 0.84, 0.82],
  ["Tokyo", "east-asia", 35.6762, 139.6503, 1.0, 4.5, 1.42, 20, 0.96, 0.94],
  ["Osaka", "east-asia", 34.6937, 135.5023, 0.66, 3.0, 1.16, 18, 0.64, 0.72],
  ["Taipei", "east-asia", 25.033, 121.5654, 0.56, 2.6, 1.14, 10, 0.54, 0.64],
  ["Singapore", "southeast-asia", 1.3521, 103.8198, 0.76, 3.2, 1.22, 8, 0.72, 0.94],
  ["Bangkok", "southeast-asia", 13.7563, 100.5018, 0.62, 3.0, 1.16, -4, 0.62, 0.66],
  ["Kuala Lumpur", "southeast-asia", 3.139, 101.6869, 0.5, 2.6, 1.12, 4, 0.48, 0.6],
  ["Jakarta", "southeast-asia", -6.2088, 106.8456, 0.82, 3.8, 1.26, -12, 0.82, 0.74],
  ["Manila", "southeast-asia", 14.5995, 120.9842, 0.64, 3.1, 1.14, 6, 0.64, 0.68],
  ["Ho Chi Minh City", "southeast-asia", 10.8231, 106.6297, 0.54, 2.7, 1.12, 4, 0.54, 0.58],
  ["Sydney", "oceania", -33.8688, 151.2093, 0.6, 3.1, 1.2, 12, 0.62, 0.78],
  ["Melbourne", "oceania", -37.8136, 144.9631, 0.52, 2.8, 1.14, 10, 0.52, 0.66],
  ["Perth", "oceania", -31.9523, 115.8613, 0.24, 1.9, 1.08, 0, 0.28, 0.42],
  ["Auckland", "oceania", -36.8509, 174.7645, 0.24, 1.9, 1.08, 10, 0.26, 0.42],
];

const REMOTE_FIELDS: RemoteField[] = [
  { id: "great-plains", regionId: "north-america", lat: 38.0, lng: -98.0, strength: 0.28, radiusDeg: 7.0, elongation: 1.6, angleDeg: -10 },
  { id: "andes-spill", regionId: "latin-america", lat: -10.0, lng: -72.0, strength: 0.22, radiusDeg: 6.2, elongation: 1.8, angleDeg: -26 },
  { id: "eastern-europe", regionId: "europe", lat: 48.0, lng: 24.0, strength: 0.22, radiusDeg: 5.0, elongation: 1.4, angleDeg: 18 },
  { id: "anatolia", regionId: "mena", lat: 37.0, lng: 36.0, strength: 0.18, radiusDeg: 4.5, elongation: 1.3, angleDeg: 8 },
  { id: "sahara-edge", regionId: "africa", lat: 13.5, lng: 18.0, strength: 0.14, radiusDeg: 7.2, elongation: 2.0, angleDeg: -4 },
  { id: "east-africa-interior", regionId: "africa", lat: -5.0, lng: 33.0, strength: 0.2, radiusDeg: 5.0, elongation: 1.5, angleDeg: 18 },
  { id: "deccan", regionId: "south-asia", lat: 19.0, lng: 78.0, strength: 0.26, radiusDeg: 5.2, elongation: 1.4, angleDeg: -4 },
  { id: "western-china", regionId: "east-asia", lat: 33.0, lng: 100.0, strength: 0.14, radiusDeg: 6.5, elongation: 1.8, angleDeg: -10 },
  { id: "south-china-sea", regionId: "southeast-asia", lat: 11.0, lng: 111.0, strength: 0.16, radiusDeg: 6.8, elongation: 1.8, angleDeg: 20 },
  { id: "australian-interior", regionId: "oceania", lat: -26.0, lng: 134.0, strength: 0.12, radiusDeg: 6.0, elongation: 1.8, angleDeg: 4 },
];

const CROSS_REGION_LANES: Array<[string, string, number, number, number]> = [
  ["New York", "London", 0.96, 0.42, 0.38],
  ["Boston", "London", 0.58, 0.34, 0.28],
  ["Washington", "Paris", 0.58, 0.34, 0.28],
  ["Miami", "Bogota", 0.52, 0.24, 0.24],
  ["Mexico City", "Bogota", 0.52, 0.18, 0.22],
  ["Sao Paulo", "Madrid", 0.6, 0.36, 0.28],
  ["Buenos Aires", "Sao Paulo", 0.54, 0.18, 0.2],
  ["London", "Casablanca", 0.4, 0.2, 0.18],
  ["London", "Dubai", 0.74, 0.28, 0.28],
  ["Frankfurt", "Dubai", 0.72, 0.22, 0.26],
  ["Istanbul", "Cairo", 0.54, 0.16, 0.22],
  ["Cairo", "Riyadh", 0.48, 0.14, 0.2],
  ["Dubai", "Mumbai", 0.82, 0.22, 0.3],
  ["Riyadh", "Karachi", 0.44, 0.18, 0.2],
  ["Karachi", "Delhi", 0.48, 0.14, 0.2],
  ["Mumbai", "Singapore", 0.78, 0.24, 0.28],
  ["Chennai", "Singapore", 0.52, 0.18, 0.22],
  ["Dhaka", "Bangkok", 0.46, 0.16, 0.2],
  ["Singapore", "Hong Kong", 0.68, 0.24, 0.26],
  ["Singapore", "Sydney", 0.56, 0.34, 0.28],
  ["Shanghai", "Tokyo", 0.76, 0.22, 0.26],
  ["Seoul", "Tokyo", 0.68, 0.18, 0.24],
  ["Taipei", "Tokyo", 0.54, 0.18, 0.24],
  ["Los Angeles", "Tokyo", 0.86, 0.4, 0.34],
  ["San Francisco Bay", "Tokyo", 0.82, 0.38, 0.32],
  ["Seattle", "Tokyo", 0.56, 0.34, 0.28],
  ["Vancouver", "Tokyo", 0.46, 0.34, 0.26],
  ["Lagos", "London", 0.44, 0.24, 0.24],
  ["Nairobi", "Dubai", 0.46, 0.18, 0.22],
  ["Johannesburg", "Dubai", 0.48, 0.28, 0.24],
  ["Johannesburg", "Mumbai", 0.4, 0.26, 0.22],
];

export const WORLD_GRAPH = createWorldGraph();

function createWorldGraph(): MeshWorldGraph {
  const hotspots = HOTSPOT_DATA.map(([name, regionId, lat, lng, strength, radiusDeg, elongation, angleDeg, clusterBias, bridgeBias]) => ({
    id: slugify(name),
    name,
    lat,
    lng,
    regionId,
    strength,
    radiusDeg,
    elongation,
    angleDeg,
    clusterBias,
    bridgeBias,
  }));

  const hotspotById = new Map<string, Hotspot>();
  const hotspotsByRegion = new Map<WorldRegionId, Hotspot[]>();

  for (const hotspot of hotspots) {
    hotspotById.set(hotspot.id, hotspot);
    const regionHotspots = hotspotsByRegion.get(hotspot.regionId);
    if (regionHotspots) {
      regionHotspots.push(hotspot);
    } else {
      hotspotsByRegion.set(hotspot.regionId, [hotspot]);
    }
  }

  const bridgeLaneMap = new Map<string, BridgeLane>();

  for (const regionHotspots of hotspotsByRegion.values()) {
    addRegionalBridgeLanes(regionHotspots, bridgeLaneMap);
  }

  for (const [fromName, toName, strength, curvature, thicknessDeg] of CROSS_REGION_LANES) {
    const fromHotspot = hotspotById.get(slugify(fromName));
    const toHotspot = hotspotById.get(slugify(toName));
    if (!fromHotspot || !toHotspot) {
      continue;
    }

    addBridgeLane(bridgeLaneMap, {
      id: getLaneId(fromHotspot.id, toHotspot.id),
      fromHotspotId: fromHotspot.id,
      toHotspotId: toHotspot.id,
      strength,
      curvature,
      thicknessDeg,
    });
  }

  const bridgeLanes = [...bridgeLaneMap.values()];
  const bridgeLanesByHotspotId = new Map<string, BridgeLane[]>();

  for (const lane of bridgeLanes) {
    pushLane(bridgeLanesByHotspotId, lane.fromHotspotId, lane);
    pushLane(bridgeLanesByHotspotId, lane.toHotspotId, lane);
  }

  return {
    hotspots,
    bridgeLanes,
    remoteFields: REMOTE_FIELDS,
    hotspotById,
    hotspotsByRegion,
    bridgeLanesByHotspotId,
  };
}

function addRegionalBridgeLanes(hotspots: Hotspot[], bridgeLaneMap: Map<string, BridgeLane>): void {
  const neighborCount = hotspots.length >= 8 ? 3 : 2;

  for (const hotspot of hotspots) {
    const neighbors = hotspots
      .filter((candidate) => candidate.id !== hotspot.id)
      .map((candidate) => ({
        candidate,
        distance: angularDistanceDeg(hotspot.lat, hotspot.lng, candidate.lat, candidate.lng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, neighborCount);

    for (const { candidate, distance } of neighbors) {
      const strength = clamp((hotspot.bridgeBias + candidate.bridgeBias) * 0.5 + (1 - distance / 18) * 0.25, 0.28, 0.82);
      const curvature = clamp(0.08 + distance * 0.012 + Math.abs(hotspot.angleDeg - candidate.angleDeg) * 0.0012, 0.12, 0.42);
      const thicknessDeg = clamp(0.16 + distance * 0.018, 0.18, 0.64);

      addBridgeLane(bridgeLaneMap, {
        id: getLaneId(hotspot.id, candidate.id),
        fromHotspotId: hotspot.id,
        toHotspotId: candidate.id,
        strength,
        curvature,
        thicknessDeg,
      });
    }
  }
}

function addBridgeLane(bridgeLaneMap: Map<string, BridgeLane>, lane: BridgeLane): void {
  const existing = bridgeLaneMap.get(lane.id);
  if (existing) {
    existing.strength = Math.max(existing.strength, lane.strength);
    existing.curvature = Math.max(existing.curvature, lane.curvature);
    existing.thicknessDeg = Math.max(existing.thicknessDeg, lane.thicknessDeg);
    return;
  }

  if (lane.fromHotspotId > lane.toHotspotId) {
    bridgeLaneMap.set(lane.id, {
      ...lane,
      fromHotspotId: lane.toHotspotId,
      toHotspotId: lane.fromHotspotId,
    });
    return;
  }

  bridgeLaneMap.set(lane.id, lane);
}

function pushLane(map: Map<string, BridgeLane[]>, hotspotId: string, lane: BridgeLane): void {
  const lanes = map.get(hotspotId);
  if (lanes) {
    lanes.push(lane);
  } else {
    map.set(hotspotId, [lane]);
  }
}

function getLaneId(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
