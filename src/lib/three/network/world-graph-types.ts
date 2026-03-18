export type WorldRegionId =
  | "north-america"
  | "latin-america"
  | "europe"
  | "mena"
  | "africa"
  | "south-asia"
  | "east-asia"
  | "southeast-asia"
  | "oceania";

export interface Hotspot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  regionId: WorldRegionId;
  strength: number;
  radiusDeg: number;
  elongation: number;
  angleDeg: number;
  clusterBias: number;
  bridgeBias: number;
}

export interface BridgeLane {
  id: string;
  fromHotspotId: string;
  toHotspotId: string;
  strength: number;
  curvature: number;
  thicknessDeg: number;
}

export interface RemoteField {
  id: string;
  regionId: WorldRegionId;
  lat: number;
  lng: number;
  strength: number;
  radiusDeg: number;
  elongation: number;
  angleDeg: number;
}

export interface MeshWorldGraph {
  hotspots: Hotspot[];
  bridgeLanes: BridgeLane[];
  remoteFields: RemoteField[];
  hotspotById: Map<string, Hotspot>;
  hotspotsByRegion: Map<WorldRegionId, Hotspot[]>;
  bridgeLanesByHotspotId: Map<string, BridgeLane[]>;
}
