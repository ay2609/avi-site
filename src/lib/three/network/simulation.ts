import { MOVER_DWELL_MS } from "./catalog";
import { interpolateLanePoint, sampleHotspotPoint, sampleRemoteFieldPoint, shortestLongitudeDelta, wrapLongitude } from "./metro-fields";
import { solveMeshLinks } from "./ephemeral-links";
import { GeoSpatialHash } from "./spatial-hash";
import { spawnPopulation, type NodeRuntimeSeed } from "./spawn";
import { MESH_TUNING } from "./tuning";
import type { NetworkLinkState, NetworkNodeState } from "./types";
import { WORLD_GRAPH } from "./world-graph";
import type { MeshWorldGraph } from "./world-graph-types";

interface NodeRuntimeState extends NodeRuntimeSeed {
  moving: boolean;
  nextRetargetMs: number;
}

export class NetworkSimulation {
  readonly graph: MeshWorldGraph = WORLD_GRAPH;
  readonly nodes: NetworkNodeState[] = [];
  readonly links = new Map<string, NetworkLinkState>();

  private readonly spatialHash = new GeoSpatialHash(MESH_TUNING.network.spatialHashCellSizeDeg);
  private readonly rng = createRng(0x1e0fbead);
  private readonly runtimeStates: NodeRuntimeState[] = [];
  private elapsedMs = 0;
  private timeSinceSolveMs = 0;

  constructor(
    private readonly maxNodes: number,
    private readonly maxLinks: number,
    private readonly solveIntervalMs: number,
  ) {}

  initialize(): void {
    this.nodes.length = 0;
    this.links.clear();
    this.runtimeStates.length = 0;
    this.elapsedMs = 0;
    this.timeSinceSolveMs = 0;

    const spawned = spawnPopulation(this.graph, this.maxNodes, this.rng);
    this.nodes.push(...spawned.nodes);
    this.runtimeStates.push(
      ...spawned.runtimeSeeds.map((seed) => ({
        ...seed,
        moving: seed.dwellRemainingMs <= 0,
        nextRetargetMs: 0,
      })),
    );
    this.initializeRoleRuntimeState();
    this.seedClusterMeshLinks();

    solveMeshLinks(this.links, this.nodes, this.spatialHash, {
      maxLinks: this.maxLinks,
      nowMs: this.elapsedMs,
      solveIntervalMs: this.solveIntervalMs,
      rng: this.rng,
    });
  }

  update(deltaSeconds: number): void {
    const deltaMs = deltaSeconds * 1000;
    this.elapsedMs += deltaMs;
    this.timeSinceSolveMs += deltaMs;

    for (const node of this.nodes) {
      const runtime = this.runtimeStates[node.id];
      if (!runtime) {
        continue;
      }

      if (node.nodeRole === "cluster") {
        this.updateClusterNode(node);
      } else if (node.nodeRole === "person") {
        this.updatePersonNode(node, runtime, deltaSeconds);
      } else if (node.nodeRole === "bridge") {
        this.updateBridgeNode(node, runtime, deltaSeconds);
      } else {
        this.updateMoverNode(node, runtime, deltaSeconds, deltaMs);
      }

      this.updateNodeEnergy(node, runtime, deltaSeconds);
    }

    if (this.timeSinceSolveMs >= this.solveIntervalMs) {
      this.timeSinceSolveMs = 0;
      solveMeshLinks(this.links, this.nodes, this.spatialHash, {
        maxLinks: this.maxLinks,
        nowMs: this.elapsedMs,
        solveIntervalMs: this.solveIntervalMs,
        rng: this.rng,
      });
    }

    this.updateLinkTransitions(deltaSeconds, deltaMs);
  }

  private initializeRoleRuntimeState(): void {
    for (const node of this.nodes) {
      const runtime = this.runtimeStates[node.id];
      if (!runtime) {
        continue;
      }

      runtime.nextRetargetMs =
        node.nodeRole === "person"
          ? randomRange(this.rng, MESH_TUNING.motion.personInitialRetargetDelayMs)
          : randomRange(this.rng, MESH_TUNING.motion.clusterInitialRetargetDelayMs);
    }
  }

  private seedClusterMeshLinks(): void {
    const clusterNodesByGroup = new Map<string, NetworkNodeState[]>();

    for (const node of this.nodes) {
      if (node.nodeRole !== "cluster" || !node.clusterGroupId) {
        continue;
      }

      const nodes = clusterNodesByGroup.get(node.clusterGroupId);
      if (nodes) {
        nodes.push(node);
      } else {
        clusterNodesByGroup.set(node.clusterGroupId, [node]);
      }
    }

    for (const groupNodes of clusterNodesByGroup.values()) {
      for (const node of groupNodes) {
        const maxLinks = randomRangeInt(this.rng, MESH_TUNING.spawn.clusterStructuralLinksPerNode);
        const candidates = groupNodes
          .filter((candidate) => candidate.id !== node.id)
          .map((candidate) => ({
            node: candidate,
            distance: angularDistanceApprox(node.lat, node.lng, candidate.lat, candidate.lng),
          }))
          .filter((candidate) => candidate.distance <= MESH_TUNING.spawn.clusterStructuralMaxDistanceDeg)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, maxLinks);

        for (const candidate of candidates) {
          const id = getLinkId(node.id, candidate.node.id);
          if (this.links.has(id)) {
            continue;
          }

          const proximity = 1 - clamp(candidate.distance / MESH_TUNING.spawn.clusterStructuralMaxDistanceDeg, 0, 1);
          const strength = lerp(
            MESH_TUNING.spawn.clusterStructuralStrength[0],
            MESH_TUNING.spawn.clusterStructuralStrength[1],
            proximity,
          );

          this.links.set(id, {
            id,
            fromId: Math.min(node.id, candidate.node.id),
            toId: Math.max(node.id, candidate.node.id),
            kind: "local",
            strength,
            targetStrength: strength,
            fade: 1,
            ageMs: 0,
            ttlMs: Number.POSITIVE_INFINITY,
            isPinned: true,
          });
        }
      }
    }

    this.seedRemoteClusterBridges(clusterNodesByGroup);
  }

  private seedRemoteClusterBridges(clusterNodesByGroup: Map<string, NetworkNodeState[]>): void {
    const remoteGroups = Array.from(clusterNodesByGroup.entries())
      .filter(([groupId, nodes]) => groupId.startsWith("remote:") && nodes.length > 0)
      .map(([groupId, nodes]) => ({
        groupId,
        nodes,
        regionId: nodes[0].regionId,
        center: getGroupCenter(nodes),
      }));

    for (const source of remoteGroups) {
      const maxLinks = randomRangeInt(this.rng, MESH_TUNING.spawn.remoteClusterInterconnectCount);
      const nearbyGroups = remoteGroups
        .filter((candidate) => candidate.groupId !== source.groupId && candidate.regionId === source.regionId)
        .map((candidate) => ({
          candidate,
          distance: angularDistanceApprox(
            source.center.lat,
            source.center.lng,
            candidate.center.lat,
            candidate.center.lng,
          ),
        }))
        .filter((entry) => entry.distance <= MESH_TUNING.spawn.remoteClusterInterconnectDistanceDeg)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxLinks);

      for (const entry of nearbyGroups) {
        const pair = getClosestNodePair(source.nodes, entry.candidate.nodes);
        if (!pair) {
          continue;
        }

        const id = getLinkId(pair.a.id, pair.b.id);
        if (this.links.has(id)) {
          continue;
        }

        const proximity = 1 - clamp(entry.distance / MESH_TUNING.spawn.remoteClusterInterconnectDistanceDeg, 0, 1);
        const strength = lerp(
          MESH_TUNING.spawn.clusterStructuralStrength[0] * 0.72,
          MESH_TUNING.spawn.clusterStructuralStrength[1] * 0.88,
          proximity,
        );

        this.links.set(id, {
          id,
          fromId: Math.min(pair.a.id, pair.b.id),
          toId: Math.max(pair.a.id, pair.b.id),
          kind: "local",
          strength,
          targetStrength: strength,
          fade: 1,
          ageMs: 0,
          ttlMs: Number.POSITIVE_INFINITY,
          isPinned: true,
        });
      }
    }
  }

  private updateClusterNode(node: NetworkNodeState): void {
    node.velocityLat = 0;
    node.velocityLng = 0;
    node.driftTargetLat = node.lat;
    node.driftTargetLng = node.lng;
    node.altitude =
      node.baseAltitude +
      Math.sin(this.elapsedMs * 0.0008 * node.pulseRate + node.phase) *
        MESH_TUNING.motion.clusterAltitudePulseAmplitude *
        (MESH_TUNING.motion.clusterAltitudePulseMix[0] + node.activity * MESH_TUNING.motion.clusterAltitudePulseMix[1]);
  }

  private updatePersonNode(node: NetworkNodeState, runtime: NodeRuntimeState, deltaSeconds: number): void {
    if (this.elapsedMs >= runtime.nextRetargetMs || isNearTarget(node)) {
      this.assignPersonTarget(node, runtime);
      runtime.nextRetargetMs = this.elapsedMs + randomRange(this.rng, MESH_TUNING.motion.personRetargetDelayMs);
    }

    const targetLngDelta = shortestLongitudeDelta(node.lng, node.driftTargetLng);
    node.velocityLat = lerp(node.velocityLat, node.driftTargetLat - node.lat, clamp(deltaSeconds * MESH_TUNING.motion.personRetargetResponse, 0, 1));
    node.velocityLng = lerp(node.velocityLng, targetLngDelta, clamp(deltaSeconds * MESH_TUNING.motion.personRetargetResponse, 0, 1));
    node.lat = clamp(node.lat + node.velocityLat * deltaSeconds * MESH_TUNING.motion.personMoveSpeed, -84, 84);
    node.lng = wrapLongitude(node.lng + node.velocityLng * deltaSeconds * MESH_TUNING.motion.personMoveSpeed);
    node.altitude =
      node.baseAltitude +
      Math.sin(this.elapsedMs * 0.001 * node.pulseRate + node.phase) *
        MESH_TUNING.motion.personAltitudePulseAmplitude *
        (MESH_TUNING.motion.personAltitudePulseMix[0] + node.activity * MESH_TUNING.motion.personAltitudePulseMix[1]);
  }

  private updateBridgeNode(node: NetworkNodeState, runtime: NodeRuntimeState, deltaSeconds: number): void {
    if (!runtime.laneId) {
      this.updatePersonNode(node, runtime, deltaSeconds);
      return;
    }

    const lane = this.graph.bridgeLanes.find((candidate) => candidate.id === runtime.laneId);
    if (!lane) {
      this.updatePersonNode(node, runtime, deltaSeconds);
      return;
    }

    const span = MESH_TUNING.motion.bridgeLaneSpanBase + node.driftRadiusDeg * MESH_TUNING.motion.bridgeLaneSpanDriftScale;
    runtime.laneProgress +=
      runtime.laneDirection *
      deltaSeconds *
      (MESH_TUNING.motion.bridgeLaneDriftSpeedBase + node.activity * MESH_TUNING.motion.bridgeLaneDriftActivityScale);

    if (runtime.laneProgress < runtime.laneAnchorProgress - span || runtime.laneProgress > runtime.laneAnchorProgress + span) {
      runtime.laneDirection *= -1;
      runtime.laneProgress = clamp(runtime.laneProgress, runtime.laneAnchorProgress - span, runtime.laneAnchorProgress + span);
    }

    const point = interpolateLanePoint(lane, this.graph, runtime.laneProgress, runtime.laneOffsetDeg, node.moverCurveBias * 0.4);
    node.driftTargetLat = point.lat;
    node.driftTargetLng = point.lng;
    node.velocityLat = lerp(node.velocityLat, point.lat - node.lat, clamp(deltaSeconds * MESH_TUNING.motion.bridgeRetargetResponse, 0, 1));
    node.velocityLng = lerp(node.velocityLng, shortestLongitudeDelta(node.lng, point.lng), clamp(deltaSeconds * MESH_TUNING.motion.bridgeRetargetResponse, 0, 1));
    node.lat = clamp(node.lat + node.velocityLat * deltaSeconds * MESH_TUNING.motion.bridgeMoveSpeed, -84, 84);
    node.lng = wrapLongitude(node.lng + node.velocityLng * deltaSeconds * MESH_TUNING.motion.bridgeMoveSpeed);
    node.hotspotId = runtime.laneProgress < 0.5 ? lane.fromHotspotId : lane.toHotspotId;
    node.altitude =
      node.baseAltitude +
      MESH_TUNING.motion.bridgeAltitudeBaseOffset +
      Math.sin(this.elapsedMs * 0.0011 * node.pulseRate + node.phase) *
        MESH_TUNING.motion.bridgeAltitudePulseAmplitude *
        (MESH_TUNING.motion.bridgeAltitudePulseMix[0] + node.activity * MESH_TUNING.motion.bridgeAltitudePulseMix[1]);
  }

  private updateMoverNode(node: NetworkNodeState, runtime: NodeRuntimeState, deltaSeconds: number, deltaMs: number): void {
    if (!runtime.laneId) {
      this.assignNextMoverLane(node, runtime, node.hotspotId);
    }

    const lane = runtime.laneId ? this.graph.bridgeLanes.find((candidate) => candidate.id === runtime.laneId) : undefined;
    if (!lane) {
      this.updatePersonNode(node, runtime, deltaSeconds);
      return;
    }

    if (!runtime.moving) {
      runtime.dwellRemainingMs = Math.max(0, runtime.dwellRemainingMs - deltaMs);
      node.moverProgress = 0;

      const destinationId = node.moverDestinationHotspotId;
      if (destinationId) {
        const destination = this.graph.hotspotById.get(destinationId);
        if (destination) {
          node.hotspotId = destination.id;
          node.regionId = destination.regionId;
          node.lat = lerp(node.lat, destination.lat, clamp(deltaSeconds * MESH_TUNING.motion.moverDestinationLerp, 0, 1));
          node.lng =
            wrapLongitude(
              node.lng +
                shortestLongitudeDelta(node.lng, destination.lng) *
                  clamp(deltaSeconds * MESH_TUNING.motion.moverDestinationLerp, 0, 1),
            );
        }
      }

      if (runtime.dwellRemainingMs <= 0) {
        this.assignNextMoverLane(node, runtime, node.moverDestinationHotspotId ?? node.hotspotId);
      }
      return;
    }

    node.moverProgress = clamp(node.moverProgress + node.moverSpeed * deltaSeconds, 0, 1.02);
    const laneProgress = runtime.laneDirection === 1 ? node.moverProgress : 1 - node.moverProgress;
    const point = interpolateLanePoint(lane, this.graph, laneProgress, runtime.laneOffsetDeg, node.moverCurveBias);
    node.velocityLat = point.lat - node.lat;
    node.velocityLng = shortestLongitudeDelta(node.lng, point.lng);
    node.lat = point.lat;
    node.lng = point.lng;
    node.altitude =
      node.baseAltitude +
      MESH_TUNING.motion.moverAltitudeBaseOffset +
      Math.sin(this.elapsedMs * 0.0015 * node.pulseRate + node.phase) *
        MESH_TUNING.motion.moverAltitudePulseAmplitude *
        (MESH_TUNING.motion.moverAltitudePulseMix[0] + node.activity * MESH_TUNING.motion.moverAltitudePulseMix[1]);

    if (node.moverProgress >= 1) {
      runtime.moving = false;
      runtime.dwellRemainingMs = randomBetween(this.rng, MOVER_DWELL_MS[0], MOVER_DWELL_MS[1]);
      node.moverProgress = 0;
      node.hotspotId = node.moverDestinationHotspotId;
      const destination = node.moverDestinationHotspotId ? this.graph.hotspotById.get(node.moverDestinationHotspotId) : undefined;
      if (destination) {
        node.regionId = destination.regionId;
      }
    }
  }

  private assignPersonTarget(node: NetworkNodeState, runtime: NodeRuntimeState): void {
    if (runtime.remoteFieldId) {
      const remoteField = this.graph.remoteFields.find((field) => field.id === runtime.remoteFieldId);
      if (remoteField) {
        const point = sampleRemoteFieldPoint(remoteField, this.rng, 0.08 + node.driftRadiusDeg * 1.8);
        node.driftTargetLat = point.lat;
        node.driftTargetLng = point.lng;
        return;
      }
    }

    if (node.hotspotId) {
      const hotspot = this.graph.hotspotById.get(node.hotspotId);
      if (hotspot) {
        const spread = clamp(0.12 + node.driftRadiusDeg * 1.8, 0.12, 0.58);
        const point = sampleHotspotPoint(hotspot, this.rng, spread);
        node.driftTargetLat = point.lat;
        node.driftTargetLng = point.lng;
        return;
      }
    }

    node.driftTargetLat = clamp(node.lat + (this.rng() - 0.5) * node.driftRadiusDeg, -84, 84);
    node.driftTargetLng = wrapLongitude(node.lng + (this.rng() - 0.5) * node.driftRadiusDeg);
  }

  private assignNextMoverLane(node: NetworkNodeState, runtime: NodeRuntimeState, currentHotspotId: string | null): void {
    const originId = currentHotspotId ?? node.hotspotId ?? pickWeightedHotspot(this.graph, this.rng).id;
    const origin = this.graph.hotspotById.get(originId) ?? pickWeightedHotspot(this.graph, this.rng);
    const connectedLanes = this.graph.bridgeLanesByHotspotId.get(origin.id) ?? [];
    const lane =
      connectedLanes.length > 0 && this.rng() < MESH_TUNING.motion.moverNextConnectedLaneChance
        ? pickWeighted(connectedLanes, this.rng, (candidate) => candidate.strength)
        : pickWeighted(this.graph.bridgeLanes, this.rng, (candidate) => candidate.strength);

    runtime.laneId = lane.id;
    runtime.laneDirection = lane.fromHotspotId === origin.id ? 1 : lane.toHotspotId === origin.id ? -1 : this.rng() < 0.5 ? 1 : -1;
    runtime.laneOffsetDeg = (this.rng() - 0.5) * lane.thicknessDeg * MESH_TUNING.spawn.moverLaneOffsetScale;
    runtime.moving = true;
    runtime.dwellRemainingMs = 0;
    node.moverProgress = 0;
    node.moverOriginHotspotId = runtime.laneDirection === 1 ? lane.fromHotspotId : lane.toHotspotId;
    node.moverDestinationHotspotId = runtime.laneDirection === 1 ? lane.toHotspotId : lane.fromHotspotId;
    node.moverCurveBias = (this.rng() - 0.5) * MESH_TUNING.motion.moverCurveBiasRange;
    node.hotspotId = node.moverOriginHotspotId;
    node.regionId = origin.regionId;
  }

  private updateNodeEnergy(node: NetworkNodeState, runtime: NodeRuntimeState, deltaSeconds: number): void {
    const hotspotStrength = node.hotspotId ? (this.graph.hotspotById.get(node.hotspotId)?.strength ?? 0.18) : 0.16;
    const roleBias =
      node.nodeRole === "mover"
        ? runtime.moving
          ? MESH_TUNING.motion.roleEnergyBias.moverMoving
          : MESH_TUNING.motion.roleEnergyBias.moverIdle
        : node.nodeRole === "person"
          ? MESH_TUNING.motion.roleEnergyBias.person
        : node.nodeRole === "bridge"
          ? MESH_TUNING.motion.roleEnergyBias.bridge
          : MESH_TUNING.motion.roleEnergyBias.cluster;
    const pulse = Math.sin(this.elapsedMs * 0.001 * node.pulseRate + node.phase) * MESH_TUNING.motion.pulseEnergyAmplitude;
    const targetActivity = clamp(roleBias + hotspotStrength * MESH_TUNING.motion.hotspotEnergyWeight + pulse, 0.14, 1);
    node.activity = lerp(node.activity, targetActivity, clamp(deltaSeconds * MESH_TUNING.motion.energyLerpSpeed, 0, 1));
  }

  private updateLinkTransitions(deltaSeconds: number, deltaMs: number): void {
    const removal: string[] = [];

    for (const [id, link] of this.links) {
      link.ageMs += deltaMs;

      if (link.ageMs >= link.ttlMs && link.targetStrength > 0.01) {
        link.targetStrength = link.isPinned ? link.targetStrength * MESH_TUNING.links.decay.pinnedStrengthRetain : 0;
      }

      const easing =
        1 -
        Math.exp(
          -deltaSeconds *
            (link.kind === "bridge" ? MESH_TUNING.links.decay.bridgeEasing : MESH_TUNING.links.decay.localEasing),
        );
      link.strength = lerp(link.strength, link.targetStrength, easing);

      if (link.targetStrength > 0.03) {
        link.fade = Math.min(
          1,
          link.fade +
            deltaSeconds *
              (link.kind === "bridge" ? MESH_TUNING.links.decay.bridgeFadeIn : MESH_TUNING.links.decay.localFadeIn),
        );
      } else {
        link.fade = Math.max(
          0,
          link.fade -
            deltaSeconds *
              (link.kind === "bridge" ? MESH_TUNING.links.decay.bridgeFadeOut : MESH_TUNING.links.decay.localFadeOut),
        );
      }

      if (link.fade <= 0.01 && link.targetStrength <= 0.01) {
        removal.push(id);
      }
    }

    for (const id of removal) {
      this.links.delete(id);
    }
  }
}

function pickWeightedHotspot(graph: MeshWorldGraph, rng: () => number) {
  return pickWeighted(graph.hotspots, rng, (hotspot) => hotspot.strength);
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

function createRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isNearTarget(node: NetworkNodeState): boolean {
  return Math.abs(node.driftTargetLat - node.lat) + Math.abs(shortestLongitudeDelta(node.lng, node.driftTargetLng)) < node.driftRadiusDeg * 0.4;
}

function angularDistanceApprox(latA: number, lngA: number, latB: number, lngB: number): number {
  const lngDelta = shortestLongitudeDelta(lngA, lngB);
  return Math.hypot(latB - latA, lngDelta * Math.max(Math.cos((latA * Math.PI) / 180), 0.35));
}

function getGroupCenter(nodes: NetworkNodeState[]): { lat: number; lng: number } {
  if (nodes.length === 0) {
    return { lat: 0, lng: 0 };
  }

  let latSum = 0;
  let xSum = 0;
  let ySum = 0;

  for (const node of nodes) {
    latSum += node.lat;
    const radians = (node.lng * Math.PI) / 180;
    xSum += Math.cos(radians);
    ySum += Math.sin(radians);
  }

  return {
    lat: latSum / nodes.length,
    lng: (Math.atan2(ySum / nodes.length, xSum / nodes.length) * 180) / Math.PI,
  };
}

function getClosestNodePair(
  sourceNodes: readonly NetworkNodeState[],
  targetNodes: readonly NetworkNodeState[],
): { a: NetworkNodeState; b: NetworkNodeState } | null {
  let closest: { a: NetworkNodeState; b: NetworkNodeState } | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const source of sourceNodes) {
    for (const target of targetNodes) {
      const distance = angularDistanceApprox(source.lat, source.lng, target.lat, target.lng);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = { a: source, b: target };
      }
    }
  }

  return closest;
}

function getLinkId(a: number, b: number): string {
  return a < b ? `mesh:${a}:${b}` : `mesh:${b}:${a}`;
}

function randomBetween(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function randomRange(rng: () => number, range: readonly [number, number]): number {
  return randomBetween(rng, range[0], range[1]);
}

function randomRangeInt(rng: () => number, range: readonly [number, number]): number {
  return Math.floor(randomBetween(rng, range[0], range[1] + 1));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
