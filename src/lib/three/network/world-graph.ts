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

type HotspotPresetId = "global_hub" | "major_hub" | "regional_hub" | "gateway_hub" | "micro_hub";
type AnglePresetId =
  | "north-america east"
  | "north-america central"
  | "north-america west"
  | "mexico"
  | "latin-america andes"
  | "latin-america brazil"
  | "latin-america southern-cone"
  | "europe atlantic"
  | "europe central"
  | "europe mediterranean"
  | "europe nordic"
  | "mena gulf"
  | "mena maghreb"
  | "mena levant/iran"
  | "africa west"
  | "africa east"
  | "africa south/central"
  | "south-asia north/east"
  | "south-asia west"
  | "south-asia south"
  | "east-asia coastal"
  | "east-asia north"
  | "east-asia inland"
  | "japan/korea"
  | "southeast-asia mainland"
  | "southeast-asia archipelago"
  | "oceania east"
  | "oceania south/west";
type CorridorPresetId =
  | "transatlantic_major"
  | "americas_link"
  | "euro_africa_mena"
  | "gulf_southasia"
  | "southasia_sea"
  | "eastasia_pacific";
type RawCrossRegionLane = [fromName: string, toName: string, strength: number, curvature: number, thicknessDeg: number];
type PresetCrossRegionLane = [fromName: string, toName: string, presetId: CorridorPresetId];

interface PresetHotspotSeed {
  name: string;
  regionId: WorldRegionId;
  lat: number;
  lng: number;
  presetId: HotspotPresetId;
  anglePresetId: AnglePresetId;
}

const HOTSPOT_PRESETS = {
  global_hub: {
    strength: 0.78,
    radiusDeg: 3.4,
    elongation: 1.22,
    clusterBias: 0.78,
    bridgeBias: 0.84,
  },
  major_hub: {
    strength: 0.62,
    radiusDeg: 2.9,
    elongation: 1.16,
    clusterBias: 0.62,
    bridgeBias: 0.72,
  },
  regional_hub: {
    strength: 0.46,
    radiusDeg: 2.3,
    elongation: 1.12,
    clusterBias: 0.48,
    bridgeBias: 0.58,
  },
  gateway_hub: {
    strength: 0.54,
    radiusDeg: 2.5,
    elongation: 1.14,
    clusterBias: 0.5,
    bridgeBias: 0.82,
  },
  micro_hub: {
    strength: 0.2,
    radiusDeg: 1.5,
    elongation: 1.08,
    clusterBias: 0.24,
    bridgeBias: 0.34,
  },
} as const;

const ANGLE_PRESETS: Record<AnglePresetId, number> = {
  "north-america east": 26,
  "north-america central": -8,
  "north-america west": -14,
  mexico: 6,
  "latin-america andes": 18,
  "latin-america brazil": -16,
  "latin-america southern-cone": -10,
  "europe atlantic": 12,
  "europe central": 18,
  "europe mediterranean": -6,
  "europe nordic": 18,
  "mena gulf": 10,
  "mena maghreb": 4,
  "mena levant/iran": 12,
  "africa west": -6,
  "africa east": 18,
  "africa south/central": 8,
  "south-asia north/east": 14,
  "south-asia west": -8,
  "south-asia south": 0,
  "east-asia coastal": 10,
  "east-asia north": 14,
  "east-asia inland": 6,
  "japan/korea": 18,
  "southeast-asia mainland": 4,
  "southeast-asia archipelago": -12,
  "oceania east": 10,
  "oceania south/west": 6,
};

const CORRIDOR_PRESETS = {
  transatlantic_major: { strength: 0.72, curvature: 0.34, thicknessDeg: 0.3 },
  americas_link: { strength: 0.56, curvature: 0.24, thicknessDeg: 0.24 },
  euro_africa_mena: { strength: 0.56, curvature: 0.22, thicknessDeg: 0.24 },
  gulf_southasia: { strength: 0.66, curvature: 0.22, thicknessDeg: 0.26 },
  southasia_sea: { strength: 0.6, curvature: 0.2, thicknessDeg: 0.24 },
  eastasia_pacific: { strength: 0.68, curvature: 0.3, thicknessDeg: 0.28 },
} as const;

const NEIGHBOR_COUNT_BY_REGION_SIZE = [
  { min: 12, count: 4 },
  { min: 8, count: 3 },
  { min: 5, count: 2 },
  { min: 0, count: 2 },
] as const;

const LEGACY_HOTSPOT_DATA: RawHotspot[] = [
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

const EXPANDED_HOTSPOT_DATA: PresetHotspotSeed[] = [
  { name: "Philadelphia", regionId: "north-america", lat: 39.9526, lng: -75.1652, presetId: "major_hub", anglePresetId: "north-america east" },
  { name: "Phoenix", regionId: "north-america", lat: 33.4484, lng: -112.074, presetId: "major_hub", anglePresetId: "north-america west" },
  { name: "Montreal", regionId: "north-america", lat: 45.5017, lng: -73.5673, presetId: "major_hub", anglePresetId: "north-america east" },
  { name: "Minneapolis-Saint Paul", regionId: "north-america", lat: 44.9778, lng: -93.265, presetId: "regional_hub", anglePresetId: "north-america central" },
  { name: "Detroit-Windsor", regionId: "north-america", lat: 42.3314, lng: -83.0458, presetId: "regional_hub", anglePresetId: "north-america east" },
  { name: "Guadalajara", regionId: "latin-america", lat: 20.6597, lng: -103.3496, presetId: "major_hub", anglePresetId: "mexico" },
  { name: "Cali", regionId: "latin-america", lat: 3.4516, lng: -76.532, presetId: "regional_hub", anglePresetId: "latin-america andes" },
  { name: "Belo Horizonte", regionId: "latin-america", lat: -19.9167, lng: -43.9345, presetId: "major_hub", anglePresetId: "latin-america brazil" },
  { name: "Brasilia", regionId: "latin-america", lat: -15.7939, lng: -47.8828, presetId: "major_hub", anglePresetId: "latin-america brazil" },
  { name: "Curitiba", regionId: "latin-america", lat: -25.4296, lng: -49.2719, presetId: "regional_hub", anglePresetId: "latin-america brazil" },
  { name: "Recife", regionId: "latin-america", lat: -8.0476, lng: -34.877, presetId: "regional_hub", anglePresetId: "latin-america brazil" },
  { name: "Vienna", regionId: "europe", lat: 48.2082, lng: 16.3738, presetId: "major_hub", anglePresetId: "europe central" },
  { name: "Hamburg", regionId: "europe", lat: 53.5511, lng: 9.9937, presetId: "major_hub", anglePresetId: "europe central" },
  { name: "Zurich", regionId: "europe", lat: 47.3769, lng: 8.5417, presetId: "major_hub", anglePresetId: "europe central" },
  { name: "Prague", regionId: "europe", lat: 50.0755, lng: 14.4378, presetId: "regional_hub", anglePresetId: "europe central" },
  { name: "Lisbon", regionId: "europe", lat: 38.7223, lng: -9.1393, presetId: "major_hub", anglePresetId: "europe atlantic" },
  { name: "Dublin", regionId: "europe", lat: 53.3498, lng: -6.2603, presetId: "major_hub", anglePresetId: "europe atlantic" },
  { name: "Copenhagen", regionId: "europe", lat: 55.6761, lng: 12.5683, presetId: "regional_hub", anglePresetId: "europe nordic" },
  { name: "Tehran", regionId: "mena", lat: 35.6892, lng: 51.389, presetId: "major_hub", anglePresetId: "mena levant/iran" },
  { name: "Abu Dhabi", regionId: "mena", lat: 24.4539, lng: 54.3773, presetId: "gateway_hub", anglePresetId: "mena gulf" },
  { name: "Doha", regionId: "mena", lat: 25.2854, lng: 51.531, presetId: "gateway_hub", anglePresetId: "mena gulf" },
  { name: "Jeddah", regionId: "mena", lat: 21.4858, lng: 39.1925, presetId: "gateway_hub", anglePresetId: "mena gulf" },
  { name: "Kuwait City", regionId: "mena", lat: 29.3759, lng: 47.9774, presetId: "gateway_hub", anglePresetId: "mena gulf" },
  { name: "Algiers", regionId: "mena", lat: 36.7538, lng: 3.0588, presetId: "major_hub", anglePresetId: "mena maghreb" },
  { name: "Kinshasa", regionId: "africa", lat: -4.4419, lng: 15.2663, presetId: "major_hub", anglePresetId: "africa south/central" },
  { name: "Dar es Salaam", regionId: "africa", lat: -6.7924, lng: 39.2083, presetId: "major_hub", anglePresetId: "africa east" },
  { name: "Accra", regionId: "africa", lat: 5.6037, lng: -0.187, presetId: "major_hub", anglePresetId: "africa west" },
  { name: "Dakar", regionId: "africa", lat: 14.7167, lng: -17.4677, presetId: "regional_hub", anglePresetId: "africa west" },
  { name: "Lahore", regionId: "south-asia", lat: 31.5204, lng: 74.3587, presetId: "major_hub", anglePresetId: "south-asia north/east" },
  { name: "Ahmedabad", regionId: "south-asia", lat: 23.0225, lng: 72.5714, presetId: "major_hub", anglePresetId: "south-asia west" },
  { name: "Pune", regionId: "south-asia", lat: 18.5204, lng: 73.8567, presetId: "major_hub", anglePresetId: "south-asia west" },
  { name: "Surat", regionId: "south-asia", lat: 21.1702, lng: 72.8311, presetId: "regional_hub", anglePresetId: "south-asia west" },
  { name: "Guangzhou", regionId: "east-asia", lat: 23.1291, lng: 113.2644, presetId: "major_hub", anglePresetId: "east-asia coastal" },
  { name: "Chengdu", regionId: "east-asia", lat: 30.5728, lng: 104.0668, presetId: "major_hub", anglePresetId: "east-asia inland" },
  { name: "Chongqing", regionId: "east-asia", lat: 29.563, lng: 106.5516, presetId: "major_hub", anglePresetId: "east-asia inland" },
  { name: "Wuhan", regionId: "east-asia", lat: 30.5928, lng: 114.3055, presetId: "major_hub", anglePresetId: "east-asia inland" },
  { name: "Hangzhou", regionId: "east-asia", lat: 30.2741, lng: 120.1551, presetId: "major_hub", anglePresetId: "east-asia coastal" },
  { name: "Tianjin", regionId: "east-asia", lat: 39.0842, lng: 117.2, presetId: "regional_hub", anglePresetId: "east-asia north" },
  { name: "Hanoi", regionId: "southeast-asia", lat: 21.0278, lng: 105.8342, presetId: "major_hub", anglePresetId: "southeast-asia mainland" },
  { name: "Surabaya", regionId: "southeast-asia", lat: -7.2575, lng: 112.7521, presetId: "major_hub", anglePresetId: "southeast-asia archipelago" },
  { name: "Yangon", regionId: "southeast-asia", lat: 16.8661, lng: 96.1951, presetId: "regional_hub", anglePresetId: "southeast-asia mainland" },
  { name: "Brisbane", regionId: "oceania", lat: -27.4698, lng: 153.0251, presetId: "major_hub", anglePresetId: "oceania east" },
  { name: "Adelaide", regionId: "oceania", lat: -34.9285, lng: 138.6007, presetId: "regional_hub", anglePresetId: "oceania south/west" },
  { name: "Honolulu", regionId: "north-america", lat: 21.3069, lng: -157.8583, presetId: "micro_hub", anglePresetId: "north-america west" },
  { name: "McMurdo Station", regionId: "antarctica", lat: -77.8419, lng: 166.6863, presetId: "micro_hub", anglePresetId: "oceania south/west" },
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

const CROSS_REGION_LANES: RawCrossRegionLane[] = [
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

const PRESET_CROSS_REGION_LANES: PresetCrossRegionLane[] = [
  ["Chicago", "London", "transatlantic_major"],
  ["Toronto", "London", "transatlantic_major"],
  ["Montreal", "Paris", "transatlantic_major"],
  ["Philadelphia", "London", "transatlantic_major"],
  ["New York", "Frankfurt", "transatlantic_major"],
  ["Boston", "Amsterdam", "transatlantic_major"],
  ["Miami", "Panama City", "americas_link"],
  ["Miami", "Sao Paulo", "americas_link"],
  ["Atlanta", "Bogota", "americas_link"],
  ["Houston", "Bogota", "americas_link"],
  ["Mexico City", "Lima", "americas_link"],
  ["Guadalajara", "Los Angeles", "americas_link"],
  ["Madrid", "Bogota", "euro_africa_mena"],
  ["Madrid", "Mexico City", "euro_africa_mena"],
  ["Paris", "Algiers", "euro_africa_mena"],
  ["Paris", "Dakar", "euro_africa_mena"],
  ["London", "Johannesburg", "euro_africa_mena"],
  ["Frankfurt", "Tehran", "euro_africa_mena"],
  ["Istanbul", "Dubai", "euro_africa_mena"],
  ["Rome", "Cairo", "euro_africa_mena"],
  ["Lisbon", "Sao Paulo", "euro_africa_mena"],
  ["Casablanca", "Dakar", "euro_africa_mena"],
  ["Dubai", "Delhi", "gulf_southasia"],
  ["Abu Dhabi", "Mumbai", "gulf_southasia"],
  ["Doha", "Karachi", "gulf_southasia"],
  ["Jeddah", "Cairo", "gulf_southasia"],
  ["Nairobi", "Doha", "gulf_southasia"],
  ["Riyadh", "Lahore", "gulf_southasia"],
  ["Kolkata", "Bangkok", "southasia_sea"],
  ["Dhaka", "Singapore", "southasia_sea"],
  ["Chennai", "Kuala Lumpur", "southasia_sea"],
  ["Mumbai", "Jakarta", "southasia_sea"],
  ["Bengaluru", "Singapore", "southasia_sea"],
  ["Delhi", "Bangkok", "southasia_sea"],
  ["Guangzhou", "Singapore", "eastasia_pacific"],
  ["Shanghai", "Seoul", "eastasia_pacific"],
  ["Shenzhen", "Manila", "eastasia_pacific"],
  ["Taipei", "Manila", "eastasia_pacific"],
  ["Tokyo", "Sydney", "eastasia_pacific"],
  ["Seoul", "Los Angeles", "eastasia_pacific"],
  ["Shanghai", "San Francisco Bay", "eastasia_pacific"],
  ["Tokyo", "Singapore", "eastasia_pacific"],
  ["Melbourne", "Singapore", "eastasia_pacific"],
];

export const WORLD_GRAPH = createWorldGraph();

function createWorldGraph(): MeshWorldGraph {
  const hotspots = [
    ...LEGACY_HOTSPOT_DATA.map(createLegacyHotspot),
    ...EXPANDED_HOTSPOT_DATA.map(createPresetHotspot),
  ];

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
    addCuratedLane(bridgeLaneMap, hotspotById, fromName, toName, strength, curvature, thicknessDeg);
  }

  for (const [fromName, toName, presetId] of PRESET_CROSS_REGION_LANES) {
    const preset = CORRIDOR_PRESETS[presetId];
    addCuratedLane(bridgeLaneMap, hotspotById, fromName, toName, preset.strength, preset.curvature, preset.thicknessDeg);
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

function createLegacyHotspot([
  name,
  regionId,
  lat,
  lng,
  strength,
  radiusDeg,
  elongation,
  angleDeg,
  clusterBias,
  bridgeBias,
]: RawHotspot): Hotspot {
  return {
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
  };
}

function createPresetHotspot(seed: PresetHotspotSeed): Hotspot {
  const preset = HOTSPOT_PRESETS[seed.presetId];
  return {
    id: slugify(seed.name),
    name: seed.name,
    lat: seed.lat,
    lng: seed.lng,
    regionId: seed.regionId,
    strength: preset.strength,
    radiusDeg: preset.radiusDeg,
    elongation: preset.elongation,
    angleDeg: ANGLE_PRESETS[seed.anglePresetId],
    clusterBias: preset.clusterBias,
    bridgeBias: preset.bridgeBias,
  };
}

function addRegionalBridgeLanes(hotspots: Hotspot[], bridgeLaneMap: Map<string, BridgeLane>): void {
  const neighborCount = getRegionalNeighborCount(hotspots.length);

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

function getRegionalNeighborCount(hotspotCount: number): number {
  for (const tier of NEIGHBOR_COUNT_BY_REGION_SIZE) {
    if (hotspotCount >= tier.min) {
      return tier.count;
    }
  }

  return 2;
}

function addCuratedLane(
  bridgeLaneMap: Map<string, BridgeLane>,
  hotspotById: Map<string, Hotspot>,
  fromName: string,
  toName: string,
  strength: number,
  curvature: number,
  thicknessDeg: number,
): void {
  const fromHotspot = hotspotById.get(slugify(fromName));
  const toHotspot = hotspotById.get(slugify(toName));
  if (!fromHotspot || !toHotspot) {
    return;
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
