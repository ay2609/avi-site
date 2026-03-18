import {
  ARCHETYPE_CONFIG,
  MOVER_DWELL_MS,
  ROLE_ALPHA_MULTIPLIERS,
  ROLE_DRIFT_AMPLITUDE,
  ROLE_LINK_BUDGETS,
  ROLE_LINK_RANGES,
  ROLE_SIZE_MULTIPLIERS,
  ROLE_SPLIT,
} from "./catalog";
import { interpolateLanePoint, sampleHotspotPoint, sampleRemoteFieldPoint, shortestLongitudeDelta, wrapLongitude } from "./metro-fields";
import { MESH_TUNING } from "./tuning";
import type { Hotspot, MeshWorldGraph } from "./world-graph-types";
import type { NetworkArchetypeId, NetworkNodeState, NodeRole } from "./types";

interface WeightedArchetype {
  archetype: NetworkArchetypeId;
  weight: number;
}

interface RemoteClusterGroup {
  id: string;
  remoteFieldId: string;
  regionId: string;
  lat: number;
  lng: number;
  density: number;
  radiusDeg: number;
}

export interface NodeRuntimeSeed {
  nodeId: number;
  remoteFieldId: string | null;
  laneId: string | null;
  laneAnchorProgress: number;
  laneProgress: number;
  laneDirection: number;
  laneOffsetDeg: number;
  dwellRemainingMs: number;
}

export interface SpawnResult {
  nodes: NetworkNodeState[];
  runtimeSeeds: NodeRuntimeSeed[];
}

const CLUSTER_ARCHETYPES: readonly WeightedArchetype[] = [
  { archetype: "access_gateway", weight: 0.24 },
  { archetype: "home_iot_device", weight: 0.18 },
  { archetype: "civic_sensor", weight: 0.18 },
  { archetype: "industrial_device", weight: 0.12 },
  { archetype: "industrial_gateway", weight: 0.1 },
  { archetype: "infrastructure_hub", weight: 0.1 },
  { archetype: "aviation_hub", weight: 0.08 },
] as const;

const PERSON_ARCHETYPES: readonly WeightedArchetype[] = [
  { archetype: "personal_device", weight: 0.62 },
  { archetype: "wearable_device", weight: 0.22 },
  { archetype: "home_iot_device", weight: 0.08 },
  { archetype: "civic_sensor", weight: 0.08 },
] as const;

const BRIDGE_ARCHETYPES: readonly WeightedArchetype[] = [
  { archetype: "access_gateway", weight: 0.3 },
  { archetype: "industrial_gateway", weight: 0.18 },
  { archetype: "infrastructure_hub", weight: 0.24 },
  { archetype: "aviation_hub", weight: 0.12 },
  { archetype: "civic_sensor", weight: 0.1 },
  { archetype: "drone", weight: 0.06 },
] as const;

const MOVER_ARCHETYPES: readonly WeightedArchetype[] = [
  { archetype: "ground_vehicle", weight: 0.56 },
  { archetype: "drone", weight: 0.18 },
  { archetype: "aircraft", weight: 0.12 },
  { archetype: "personal_device", weight: 0.1 },
  { archetype: "wearable_device", weight: 0.04 },
] as const;

export function spawnPopulation(graph: MeshWorldGraph, maxNodes: number, rng: () => number): SpawnResult {
  const quotas = buildRoleQuotas(maxNodes);
  const nodes: NetworkNodeState[] = [];
  const runtimeSeeds: NodeRuntimeSeed[] = [];
  const remoteClusterGroups = buildRemoteClusterGroups(graph, quotas.cluster, rng);

  for (let i = 0; i < quotas.cluster; i += 1) {
    const useRemote = remoteClusterGroups.length > 0 && rng() < MESH_TUNING.spawn.remoteClusterChance;
    const archetype = pickWeightedArchetype(CLUSTER_ARCHETYPES, rng);

    if (useRemote) {
      const remoteGroup = pickWeighted(remoteClusterGroups, rng, (group) => group.density);
      const point = sampleRemoteClusterPoint(remoteGroup, rng);
      const node = createNode(archetype, "cluster", point.lat, point.lng, {
        hotspotId: null,
        clusterGroupId: remoteGroup.id,
        regionId: remoteGroup.regionId,
        density: remoteGroup.density,
        rng,
      });

      node.id = nodes.length;
      nodes.push(node);
      runtimeSeeds.push({
        nodeId: node.id,
        remoteFieldId: remoteGroup.remoteFieldId,
        laneId: null,
        laneAnchorProgress: 0,
        laneProgress: 0,
        laneDirection: 1,
        laneOffsetDeg: 0,
        dwellRemainingMs: 0,
      });
      continue;
    }

    const hotspot = pickWeighted(graph.hotspots, rng, (candidate) => candidate.strength * candidate.clusterBias);
    const point = sampleRoleHotspotPoint(graph, hotspot, rng, "cluster");
    const node = createNode(archetype, "cluster", point.lat, point.lng, {
      hotspotId: hotspot.id,
      clusterGroupId: hotspot.id,
      regionId: hotspot.regionId,
      density: hotspot.strength,
      rng,
    });

    node.id = nodes.length;
    nodes.push(node);
    runtimeSeeds.push({
      nodeId: node.id,
      remoteFieldId: null,
      laneId: null,
      laneAnchorProgress: 0,
      laneProgress: 0,
      laneDirection: 1,
      laneOffsetDeg: 0,
      dwellRemainingMs: 0,
    });
  }

  for (let i = 0; i < quotas.person; i += 1) {
    const hotspot = pickWeighted(graph.hotspots, rng, (candidate) => candidate.strength * candidate.clusterBias);
    const archetype = pickWeightedArchetype(PERSON_ARCHETYPES, rng);
    const point = sampleRoleHotspotPoint(graph, hotspot, rng, "person");
    const node = createNode(archetype, "person", point.lat, point.lng, {
      hotspotId: hotspot.id,
      clusterGroupId: hotspot.id,
      regionId: hotspot.regionId,
      density: hotspot.strength,
      rng,
    });

    node.id = nodes.length;
    nodes.push(node);
    runtimeSeeds.push({
      nodeId: node.id,
      remoteFieldId: null,
      laneId: null,
      laneAnchorProgress: 0,
      laneProgress: 0,
      laneDirection: 1,
      laneOffsetDeg: 0,
      dwellRemainingMs: 0,
    });
  }

  for (let i = 0; i < quotas.bridge; i += 1) {
    const lane = pickWeighted(graph.bridgeLanes, rng, (candidate) => candidate.strength);
    const archetype = pickWeightedArchetype(BRIDGE_ARCHETYPES, rng);
    const laneAnchorProgress = randomRange(rng, MESH_TUNING.spawn.bridgeAnchorProgress);
    const laneOffsetDeg = (rng() - 0.5) * lane.thicknessDeg * MESH_TUNING.spawn.bridgeLaneOffsetScale;
    const point = interpolateLanePoint(lane, graph, laneAnchorProgress, laneOffsetDeg, (rng() - 0.5) * MESH_TUNING.spawn.bridgeCurveJitter);
    const hotspotId = laneAnchorProgress < 0.5 ? lane.fromHotspotId : lane.toHotspotId;
    const hotspot = graph.hotspotById.get(hotspotId);
    if (!hotspot) {
      continue;
    }

    const node = createNode(archetype, "bridge", point.lat, point.lng, {
      hotspotId,
      clusterGroupId: null,
      regionId: hotspot.regionId,
      density: hotspot.strength * 0.82 + lane.strength * 0.24,
      rng,
    });

    node.id = nodes.length;
    nodes.push(node);
    runtimeSeeds.push({
      nodeId: node.id,
      remoteFieldId: null,
      laneId: lane.id,
      laneAnchorProgress,
      laneProgress: laneAnchorProgress,
      laneDirection: rng() < 0.5 ? -1 : 1,
      laneOffsetDeg,
      dwellRemainingMs: 0,
    });
  }

  for (let i = 0; i < quotas.mover; i += 1) {
    const lane = pickWeighted(
      graph.bridgeLanes,
      rng,
      (candidate) => candidate.strength * (MESH_TUNING.spawn.moverLaneWeightThicknessBias + candidate.thicknessDeg),
    );
    const archetype = pickWeightedArchetype(MOVER_ARCHETYPES, rng);
    const laneDirection = rng() < 0.5 ? 1 : -1;
    const rawProgress = rng();
    const laneProgress = laneDirection === 1 ? rawProgress : 1 - rawProgress;
    const laneOffsetDeg = (rng() - 0.5) * lane.thicknessDeg * MESH_TUNING.spawn.moverLaneOffsetScale;
    const point = interpolateLanePoint(
      lane,
      graph,
      laneProgress,
      laneOffsetDeg,
      (rng() - 0.5) * (MESH_TUNING.spawn.moverCurveBias * 2 / 1.2),
    );
    const originHotspotId = laneDirection === 1 ? lane.fromHotspotId : lane.toHotspotId;
    const destinationHotspotId = laneDirection === 1 ? lane.toHotspotId : lane.fromHotspotId;
    const destinationHotspot = graph.hotspotById.get(destinationHotspotId);
    if (!destinationHotspot) {
      continue;
    }

    const node = createNode(archetype, "mover", point.lat, point.lng, {
      hotspotId: rawProgress < 0.45 ? originHotspotId : destinationHotspotId,
      clusterGroupId: null,
      regionId: destinationHotspot.regionId,
      density: destinationHotspot.strength,
      rng,
    });

    node.moverOriginHotspotId = originHotspotId;
    node.moverDestinationHotspotId = destinationHotspotId;
    node.moverProgress = rawProgress;
    node.moverSpeed = getMoverSpeed(archetype, rng);
    node.moverCurveBias = (rng() - 0.5) * MESH_TUNING.spawn.moverCurveBias;
    node.id = nodes.length;
    nodes.push(node);
    runtimeSeeds.push({
      nodeId: node.id,
      remoteFieldId: null,
      laneId: lane.id,
      laneAnchorProgress: 0,
      laneProgress: rawProgress,
      laneDirection,
      laneOffsetDeg,
      dwellRemainingMs: rng() < MESH_TUNING.spawn.moverInitialDwellChance ? randomBetween(rng, MOVER_DWELL_MS[0], MOVER_DWELL_MS[1]) : 0,
    });
  }

  return { nodes, runtimeSeeds };
}

function sampleRoleHotspotPoint(
  graph: MeshWorldGraph,
  hotspot: Hotspot,
  rng: () => number,
  role: "cluster" | "person",
): { lat: number; lng: number } {
  const spread =
    role === "cluster"
      ? randomRange(rng, MESH_TUNING.spawn.clusterHotspotSpreadDeg)
      : randomRange(rng, MESH_TUNING.spawn.personHotspotSpreadDeg);
  let point = sampleHotspotPoint(hotspot, rng, spread);

  const blendChance = role === "cluster" ? MESH_TUNING.spawn.clusterBlendChance : MESH_TUNING.spawn.personBlendChance;
  if (rng() < blendChance) {
    const secondary = pickNearbyHotspot(graph, hotspot, rng);
    if (secondary) {
      const secondarySpread =
        role === "cluster"
          ? randomRange(rng, MESH_TUNING.spawn.clusterBlendSpreadDeg)
          : randomRange(rng, MESH_TUNING.spawn.personBlendSpreadDeg);
      const secondaryPoint = sampleHotspotPoint(secondary, rng, secondarySpread);
      const mix =
        role === "cluster"
          ? randomRange(rng, MESH_TUNING.spawn.clusterBlendMix)
          : randomRange(rng, MESH_TUNING.spawn.personBlendMix);
      point = {
        lat: lerp(point.lat, secondaryPoint.lat, mix),
        lng: blendLongitude(point.lng, secondaryPoint.lng, mix),
      };
    }
  }

  return point;
}

function buildRemoteClusterGroups(graph: MeshWorldGraph, clusterQuota: number, rng: () => number): RemoteClusterGroup[] {
  if (graph.remoteFields.length === 0) {
    return [];
  }

  const groups: RemoteClusterGroup[] = [];
  const targetRemoteNodes = Math.max(1, Math.round(clusterQuota * MESH_TUNING.spawn.remoteClusterChance));

  for (const remoteField of graph.remoteFields) {
    const desiredGroups = clampInt(
      Math.round(MESH_TUNING.spawn.remoteClusterGroupsBase + remoteField.strength * MESH_TUNING.spawn.remoteClusterGroupsScale),
      1,
      Math.max(1, targetRemoteNodes),
    );

    for (let index = 0; index < desiredGroups; index += 1) {
      const seedPoint = sampleRemoteFieldPoint(
        remoteField,
        rng,
        randomRange(rng, MESH_TUNING.spawn.remoteClusterSeedSpreadDeg),
      );
      groups.push({
        id: `remote:${remoteField.id}:${index}`,
        remoteFieldId: remoteField.id,
        regionId: remoteField.regionId,
        lat: seedPoint.lat,
        lng: seedPoint.lng,
        density: remoteField.strength,
        radiusDeg: randomRange(rng, MESH_TUNING.spawn.remoteClusterRadiusDeg),
      });
    }
  }

  return groups;
}

function sampleRemoteClusterPoint(group: RemoteClusterGroup, rng: () => number): { lat: number; lng: number } {
  const theta = rng() * Math.PI * 2;
  const radius = Math.sqrt(rng()) * group.radiusDeg;
  const lngScale = Math.max(Math.cos((group.lat * Math.PI) / 180), 0.35);
  return {
    lat: clamp(group.lat + Math.sin(theta) * radius, -84, 84),
    lng: wrapLongitude(group.lng + (Math.cos(theta) * radius) / lngScale),
  };
}

function pickNearbyHotspot(graph: MeshWorldGraph, hotspot: Hotspot, rng: () => number): Hotspot | null {
  const regionHotspots = graph.hotspotsByRegion.get(hotspot.regionId) ?? [];
  const candidates = regionHotspots
    .filter((candidate) => candidate.id !== hotspot.id)
    .map((candidate) => ({
      candidate,
      score: 1 / Math.max(0.4, angularDistanceApprox(hotspot.lat, hotspot.lng, candidate.lat, candidate.lng)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (candidates.length === 0) {
    return null;
  }

  return pickWeighted(candidates, rng, (entry) => entry.score * (0.5 + entry.candidate.clusterBias)).candidate;
}

function createNode(
  archetype: NetworkArchetypeId,
  nodeRole: NodeRole,
  lat: number,
  lng: number,
  options: {
    hotspotId: string | null;
    clusterGroupId: string | null;
    regionId: string;
    density: number;
    rng: () => number;
  },
): NetworkNodeState {
  const config = ARCHETYPE_CONFIG[archetype];
  const { rng } = options;
  const sizeMultiplier = randomBetween(rng, ROLE_SIZE_MULTIPLIERS[nodeRole][0], ROLE_SIZE_MULTIPLIERS[nodeRole][1]);
  const alphaMultiplier = randomBetween(rng, ROLE_ALPHA_MULTIPLIERS[nodeRole][0], ROLE_ALPHA_MULTIPLIERS[nodeRole][1]);

  return {
    id: 0,
    archetype,
    subtype: pickItem(config.subtypes, rng),
    lat,
    lng,
    altitude: config.baseAltitude + rng() * config.altitudeJitter,
    baseAltitude: config.baseAltitude,
    renderSize:
      config.baseSize *
      sizeMultiplier *
      (MESH_TUNING.spawn.densitySizeScaleBase + options.density * MESH_TUNING.spawn.densitySizeScaleWeight),
    alpha: clamp(config.baseAlpha * alphaMultiplier, 0.16, 1),
    activity: clamp(
      MESH_TUNING.spawn.activityBase +
        options.density * MESH_TUNING.spawn.densityActivityWeight +
        MESH_TUNING.spawn.roleActivityBoost[nodeRole] +
        rng() * MESH_TUNING.spawn.activityNoise,
      0.14,
      1,
    ),
    pulseRate: randomBetween(
      rng,
      MESH_TUNING.spawn.pulseRateRange[nodeRole][0],
      MESH_TUNING.spawn.pulseRateRange[nodeRole][1],
    ),
    phase: rng() * Math.PI * 2,
    hotspotId: options.hotspotId,
    clusterGroupId: options.clusterGroupId,
    regionId: options.regionId,
    nodeRole,
    driftRadiusDeg: randomBetween(rng, ROLE_DRIFT_AMPLITUDE[nodeRole][0], ROLE_DRIFT_AMPLITUDE[nodeRole][1]),
    driftTargetLat: lat,
    driftTargetLng: lng,
    velocityLat: 0,
    velocityLng: 0,
    moverOriginHotspotId: null,
    moverDestinationHotspotId: null,
    moverProgress: 0,
    moverSpeed: nodeRole === "mover" ? getMoverSpeed(archetype, rng) : 0,
    moverCurveBias: (rng() - 0.5) * (MESH_TUNING.spawn.moverCurveBias * (2 / 3)),
    linkBudget: randomInt(rng, ROLE_LINK_BUDGETS[nodeRole][0], ROLE_LINK_BUDGETS[nodeRole][1]),
    linkRangeDeg: randomBetween(rng, ROLE_LINK_RANGES[nodeRole][0], ROLE_LINK_RANGES[nodeRole][1]),
    linkRefreshOffsetMs: rng() * 4000,
  };
}

function buildRoleQuotas(maxNodes: number): Record<NodeRole, number> {
  const quotas: Record<NodeRole, number> = {
    cluster: Math.floor(maxNodes * ROLE_SPLIT.cluster),
    person: Math.floor(maxNodes * ROLE_SPLIT.person),
    bridge: Math.floor(maxNodes * ROLE_SPLIT.bridge),
    mover: Math.floor(maxNodes * ROLE_SPLIT.mover),
  };

  let assigned = quotas.cluster + quotas.person + quotas.bridge + quotas.mover;
  while (assigned < maxNodes) {
    quotas.cluster += 1;
    assigned += 1;
  }

  return quotas;
}

function pickWeightedArchetype(items: readonly WeightedArchetype[], rng: () => number): NetworkArchetypeId {
  return pickWeighted(items, rng, (item) => item.weight).archetype;
}

function pickWeighted<T>(items: readonly T[], rng: () => number, weightFn: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0.0001, weightFn(item)), 0);
  let cursor = rng() * total;

  for (const item of items) {
    cursor -= Math.max(0.0001, weightFn(item));
    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function pickItem<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function getMoverSpeed(archetype: NetworkArchetypeId, rng: () => number): number {
  switch (archetype) {
    case "ground_vehicle":
      return randomBetween(rng, MESH_TUNING.spawn.moverSpeeds.ground_vehicle[0], MESH_TUNING.spawn.moverSpeeds.ground_vehicle[1]);
    case "drone":
      return randomBetween(rng, MESH_TUNING.spawn.moverSpeeds.drone[0], MESH_TUNING.spawn.moverSpeeds.drone[1]);
    case "aircraft":
      return randomBetween(rng, MESH_TUNING.spawn.moverSpeeds.aircraft[0], MESH_TUNING.spawn.moverSpeeds.aircraft[1]);
    case "wearable_device":
      return randomBetween(rng, MESH_TUNING.spawn.moverSpeeds.wearable_device[0], MESH_TUNING.spawn.moverSpeeds.wearable_device[1]);
    case "personal_device":
      return randomBetween(rng, MESH_TUNING.spawn.moverSpeeds.personal_device[0], MESH_TUNING.spawn.moverSpeeds.personal_device[1]);
    default:
      return randomBetween(rng, MESH_TUNING.spawn.moverSpeeds.default[0], MESH_TUNING.spawn.moverSpeeds.default[1]);
  }
}

function angularDistanceApprox(latA: number, lngA: number, latB: number, lngB: number): number {
  const lngDelta = shortestLongitudeDelta(lngA, lngB);
  return Math.hypot(latB - latA, lngDelta * Math.max(Math.cos((latA * Math.PI) / 180), 0.35));
}

function blendLongitude(a: number, b: number, t: number): number {
  return wrapLongitude(a + shortestLongitudeDelta(a, b) * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randomBetween(rng, min, max + 1));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function randomRange(rng: () => number, range: readonly [number, number]): number {
  return randomBetween(rng, range[0], range[1]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
