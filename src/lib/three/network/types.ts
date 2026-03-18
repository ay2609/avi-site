export type NetworkArchetypeId =
  | "personal_device"
  | "wearable_device"
  | "home_iot_device"
  | "civic_sensor"
  | "industrial_device"
  | "ground_vehicle"
  | "drone"
  | "aircraft"
  | "access_gateway"
  | "industrial_gateway"
  | "infrastructure_hub"
  | "aviation_hub";

export type NetworkLinkKind = "local" | "bridge";

export type NodeRole = "cluster" | "person" | "bridge" | "mover";

export interface NetworkArchetypeConfig {
  id: NetworkArchetypeId;
  label: string;
  subtypes: readonly string[];
  color: readonly [number, number, number];
  baseSize: number;
  baseAlpha: number;
  baseAltitude: number;
  altitudeJitter: number;
}

export interface NetworkNodeState {
  id: number;
  archetype: NetworkArchetypeId;
  subtype: string;
  lat: number;
  lng: number;
  altitude: number;
  baseAltitude: number;
  renderSize: number;
  alpha: number;
  activity: number;
  pulseRate: number;
  phase: number;
  hotspotId: string | null;
  clusterGroupId: string | null;
  regionId: string;
  nodeRole: NodeRole;
  driftRadiusDeg: number;
  driftTargetLat: number;
  driftTargetLng: number;
  velocityLat: number;
  velocityLng: number;
  moverOriginHotspotId: string | null;
  moverDestinationHotspotId: string | null;
  moverProgress: number;
  moverSpeed: number;
  moverCurveBias: number;
  linkBudget: number;
  linkRangeDeg: number;
  linkRefreshOffsetMs: number;
}

export interface NetworkLinkState {
  id: string;
  fromId: number;
  toId: number;
  kind: NetworkLinkKind;
  strength: number;
  targetStrength: number;
  fade: number;
  ageMs: number;
  ttlMs: number;
  isPinned: boolean;
}

export interface NetworkLayerOptions {
  enabled?: boolean;
  maxNodes?: number;
  maxLinks?: number;
  maxVisibleNodes?: number;
  maxVisibleLinks?: number;
  solveIntervalMs?: number;
}
