import type { NetworkArchetypeConfig, NetworkArchetypeId, NetworkLayerOptions, NodeRole } from "./types";
import { MESH_TUNING } from "./tuning";

export const NETWORK_ARCHETYPES: readonly NetworkArchetypeId[] = [
  "personal_device",
  "wearable_device",
  "home_iot_device",
  "civic_sensor",
  "industrial_device",
  "ground_vehicle",
  "drone",
  "aircraft",
  "access_gateway",
  "industrial_gateway",
  "infrastructure_hub",
  "aviation_hub",
];

export const NETWORK_DEFAULTS: Required<NetworkLayerOptions> = {
  enabled: true,
  maxNodes: MESH_TUNING.network.maxNodes,
  maxLinks: MESH_TUNING.network.maxLinks,
  maxVisibleNodes: MESH_TUNING.network.maxVisibleNodes,
  maxVisibleLinks: MESH_TUNING.network.maxVisibleLinks,
  solveIntervalMs: MESH_TUNING.network.solveIntervalMs,
};

export const NETWORK_VISIBILITY_CONFIG = {
  visibilityPlaneOffsetPerspective: MESH_TUNING.visibility.planeOffsetPerspective,
  visibilityPlaneOffsetOrtho: MESH_TUNING.visibility.planeOffsetOrtho,
} as const;

export const ROLE_SPLIT: Record<NodeRole, number> = MESH_TUNING.roles.split;

export const ROLE_LINK_BUDGETS: Record<NodeRole, readonly [number, number]> = MESH_TUNING.roles.linkBudgets;

export const ROLE_LINK_RANGES: Record<NodeRole, readonly [number, number]> = MESH_TUNING.roles.linkRangesDeg;

export const ROLE_DRIFT_AMPLITUDE: Record<NodeRole, readonly [number, number]> = MESH_TUNING.roles.driftAmplitudeDeg;

export const ROLE_SIZE_MULTIPLIERS: Record<NodeRole, readonly [number, number]> = MESH_TUNING.roles.sizeMultipliers;

export const ROLE_ALPHA_MULTIPLIERS: Record<NodeRole, readonly [number, number]> = MESH_TUNING.roles.alphaMultipliers;

export const LINK_TTL_MS = MESH_TUNING.links.ttlMs;

export const MOVER_DWELL_MS = MESH_TUNING.spawn.moverDwellMs;

const CORE_VIOLET: readonly [number, number, number] = [0.89, 0.42, 1.0];
const SOFT_VIOLET: readonly [number, number, number] = [0.78, 0.45, 0.98];
const HOT_MAGENTA: readonly [number, number, number] = [1.0, 0.56, 0.96];
const PALE_SIGNAL: readonly [number, number, number] = [0.95, 0.9, 0.99];
const WARM_SIGNAL: readonly [number, number, number] = [1.0, 0.74, 0.92];

export const ARCHETYPE_CONFIG: Record<NetworkArchetypeId, NetworkArchetypeConfig> = {
  personal_device: {
    id: "personal_device",
    label: "Personal Device",
    subtypes: ["Phone", "Tablet", "Laptop"],
    color: SOFT_VIOLET,
    baseSize: 2.0,
    baseAlpha: 0.72,
    baseAltitude: 0.02,
    altitudeJitter: 0.008,
  },
  wearable_device: {
    id: "wearable_device",
    label: "Wearable",
    subtypes: ["Watch", "Band", "Body Sensor"],
    color: WARM_SIGNAL,
    baseSize: 1.45,
    baseAlpha: 0.62,
    baseAltitude: 0.02,
    altitudeJitter: 0.006,
  },
  home_iot_device: {
    id: "home_iot_device",
    label: "Home IoT",
    subtypes: ["Camera", "Thermostat", "Speaker", "Appliance"],
    color: HOT_MAGENTA,
    baseSize: 1.7,
    baseAlpha: 0.58,
    baseAltitude: 0.016,
    altitudeJitter: 0.006,
  },
  civic_sensor: {
    id: "civic_sensor",
    label: "Civic Sensor",
    subtypes: ["Traffic Light", "Street Cam", "Parking Sensor", "Smart Billboard"],
    color: HOT_MAGENTA,
    baseSize: 1.8,
    baseAlpha: 0.66,
    baseAltitude: 0.022,
    altitudeJitter: 0.008,
  },
  industrial_device: {
    id: "industrial_device",
    label: "Industrial Device",
    subtypes: ["Factory Robot", "Warehouse Scanner", "PLC", "CNC"],
    color: HOT_MAGENTA,
    baseSize: 1.95,
    baseAlpha: 0.68,
    baseAltitude: 0.026,
    altitudeJitter: 0.008,
  },
  ground_vehicle: {
    id: "ground_vehicle",
    label: "Ground Vehicle",
    subtypes: ["Car", "Truck", "Bus", "Van"],
    color: SOFT_VIOLET,
    baseSize: 1.8,
    baseAlpha: 0.82,
    baseAltitude: 0.03,
    altitudeJitter: 0.012,
  },
  drone: {
    id: "drone",
    label: "Drone",
    subtypes: ["Delivery Drone", "Inspection Drone", "Survey Drone"],
    color: PALE_SIGNAL,
    baseSize: 1.55,
    baseAlpha: 0.88,
    baseAltitude: 0.072,
    altitudeJitter: 0.032,
  },
  aircraft: {
    id: "aircraft",
    label: "Aircraft",
    subtypes: ["Passenger Jet", "Cargo Plane", "Regional Jet"],
    color: PALE_SIGNAL,
    baseSize: 1.4,
    baseAlpha: 0.92,
    baseAltitude: 0.16,
    altitudeJitter: 0.05,
  },
  access_gateway: {
    id: "access_gateway",
    label: "Access Gateway",
    subtypes: ["Cell Tower", "Wi-Fi AP", "Roadside Unit", "Building Router"],
    color: CORE_VIOLET,
    baseSize: 2.25,
    baseAlpha: 0.82,
    baseAltitude: 0.028,
    altitudeJitter: 0.01,
  },
  industrial_gateway: {
    id: "industrial_gateway",
    label: "Industrial Gateway",
    subtypes: ["Factory Edge Gateway", "Warehouse Controller", "OT Bridge"],
    color: CORE_VIOLET,
    baseSize: 2.45,
    baseAlpha: 0.84,
    baseAltitude: 0.034,
    altitudeJitter: 0.012,
  },
  infrastructure_hub: {
    id: "infrastructure_hub",
    label: "Infrastructure Hub",
    subtypes: ["Datacenter", "Cloud Region", "Logistics Core", "Municipal Core"],
    color: PALE_SIGNAL,
    baseSize: 2.7,
    baseAlpha: 0.9,
    baseAltitude: 0.044,
    altitudeJitter: 0.014,
  },
  aviation_hub: {
    id: "aviation_hub",
    label: "Aviation Hub",
    subtypes: ["Airport", "ATC Station", "Radar Node"],
    color: PALE_SIGNAL,
    baseSize: 2.55,
    baseAlpha: 0.88,
    baseAltitude: 0.06,
    altitudeJitter: 0.016,
  },
};
