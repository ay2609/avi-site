import { LINK_TTL_MS } from "./catalog";
import { angularDistanceDeg, shortestLongitudeDelta } from "./metro-fields";
import { GeoSpatialHash } from "./spatial-hash";
import { MESH_TUNING } from "./tuning";
import type { NetworkLinkState, NetworkNodeState } from "./types";

interface CandidateLink {
  fromId: number;
  toId: number;
  kind: NetworkLinkState["kind"];
  score: number;
  ttlMs: number;
  isPinned: boolean;
}

export function solveMeshLinks(
  links: Map<string, NetworkLinkState>,
  nodes: NetworkNodeState[],
  spatialHash: GeoSpatialHash,
  options: {
    maxLinks: number;
    nowMs: number;
    solveIntervalMs: number;
    rng: () => number;
  },
): void {
  spatialHash.clear();
  for (const node of nodes) {
    spatialHash.insert(node.id, node.lat, node.lng);
  }

  const degrees = new Uint16Array(nodes.length);
  const adjacency = new Map<number, number[]>();
  let activeLinks = 0;

  for (const link of links.values()) {
    if (link.isPinned && link.kind === "local") {
      continue;
    }

    if (
      link.fade <= MESH_TUNING.links.hiddenLinkCutoff.fade &&
      link.targetStrength <= MESH_TUNING.links.hiddenLinkCutoff.targetStrength
    ) {
      continue;
    }

    pushNeighbor(adjacency, link.fromId, link.toId);
    pushNeighbor(adjacency, link.toId, link.fromId);
    if (
      link.targetStrength > MESH_TUNING.links.activeLinkCutoff.targetStrength ||
      link.fade > MESH_TUNING.links.activeLinkCutoff.fade
    ) {
      degrees[link.fromId] += 1;
      degrees[link.toId] += 1;
      activeLinks += 1;
    }
  }

  const solveWindowMs = options.solveIntervalMs * MESH_TUNING.links.solveWindowMultiplier;
  const refreshThreshold =
    MESH_TUNING.links.eligibleRefreshRatio[0] +
    options.rng() * (MESH_TUNING.links.eligibleRefreshRatio[1] - MESH_TUNING.links.eligibleRefreshRatio[0]);
  const candidates: CandidateLink[] = [];

  for (const node of nodes) {
    const solvePhase = ((options.nowMs + node.linkRefreshOffsetMs) % solveWindowMs) / solveWindowMs;
    if (solvePhase > refreshThreshold) {
      continue;
    }

    const nearbyIds = spatialHash.query(node.lat, node.lng, node.linkRangeDeg);
    const neighborIds = adjacency.get(node.id) ?? [];
    const neighborBearings = neighborIds.map((neighborId) => getBearingDeg(node, nodes[neighborId]));

    for (const neighborId of nearbyIds) {
      if (neighborId === node.id) {
        continue;
      }

      const neighbor = nodes[neighborId];
      const linkId = getLinkId(node.id, neighbor.id);
      const existing = links.get(linkId);
      const maxDistance = Math.min(node.linkRangeDeg, neighbor.linkRangeDeg);
      const distance = angularDistanceDeg(node.lat, node.lng, neighbor.lat, neighbor.lng);
      if (distance > maxDistance) {
        continue;
      }

      if (shouldSkipDynamicPair(node, neighbor, existing)) {
        continue;
      }

      if (!existing && (degrees[node.id] >= node.linkBudget || degrees[neighbor.id] >= neighbor.linkBudget)) {
        continue;
      }

      const proximity = 1 - clamp(distance / maxDistance, 0, 1);
      const sameHotspotBoost =
        node.hotspotId !== null && node.hotspotId === neighbor.hotspotId ? MESH_TUNING.links.scoreWeights.sameHotspot : 0;
      const sameRegionBoost =
        node.regionId === neighbor.regionId ? MESH_TUNING.links.scoreWeights.sameRegion : MESH_TUNING.links.scoreWeights.crossRegionPenalty;
      const bridgeBias =
        node.nodeRole === "bridge" || neighbor.nodeRole === "bridge" ? MESH_TUNING.links.scoreWeights.bridgeBias : 0;
      const clusterPersonBias =
        (node.nodeRole === "cluster" && neighbor.nodeRole === "person") || (node.nodeRole === "person" && neighbor.nodeRole === "cluster")
          ? MESH_TUNING.links.scoreWeights.clusterPersonBias
          : 0;
      const moverBias = node.nodeRole === "mover" || neighbor.nodeRole === "mover" ? MESH_TUNING.links.scoreWeights.moverBias : 0;
      const retainedBoost = existing ? MESH_TUNING.links.scoreWeights.retained : 0;
      const anglePenalty = getAnglePenalty(node, neighbor, neighborBearings);
      const score =
        proximity * MESH_TUNING.links.scoreWeights.proximity +
        sameHotspotBoost +
        sameRegionBoost +
        bridgeBias +
        clusterPersonBias +
        moverBias +
        retainedBoost -
        anglePenalty +
        (options.rng() - 0.5) * MESH_TUNING.links.scoreWeights.noise;

      const kind = inferLinkKind(node, neighbor, distance);
      const ttlRange = kind === "bridge" ? LINK_TTL_MS.bridge : LINK_TTL_MS.local;

      candidates.push({
        fromId: node.id,
        toId: neighbor.id,
        kind,
        score,
        ttlMs: randomBetween(options.rng, ttlRange[0], ttlRange[1]),
        isPinned:
          kind === "bridge" &&
          (node.nodeRole === "bridge" || neighbor.nodeRole === "bridge") &&
          distance > MESH_TUNING.links.pinnedBridgeDistanceThresholdDeg,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    const linkId = getLinkId(candidate.fromId, candidate.toId);
    const existing = links.get(linkId);

    if (!existing && activeLinks >= options.maxLinks) {
      break;
    }

    if (!existing) {
      const fromNode = nodes[candidate.fromId];
      const toNode = nodes[candidate.toId];
      if (degrees[fromNode.id] >= fromNode.linkBudget || degrees[toNode.id] >= toNode.linkBudget) {
        continue;
      }
    }

    const strength = clamp(candidate.score, MESH_TUNING.links.strengthClamp[0], MESH_TUNING.links.strengthClamp[1]);
    if (existing) {
      existing.kind = candidate.kind;
      existing.targetStrength = Math.max(existing.targetStrength, strength);
      existing.ttlMs = candidate.ttlMs;
      existing.ageMs = 0;
      existing.isPinned = existing.isPinned || candidate.isPinned;
      continue;
    }

    links.set(linkId, {
      id: linkId,
      fromId: Math.min(candidate.fromId, candidate.toId),
      toId: Math.max(candidate.fromId, candidate.toId),
      kind: candidate.kind,
      strength: 0,
      targetStrength: strength,
      fade: 0,
      ageMs: 0,
      ttlMs: candidate.ttlMs,
      isPinned: candidate.isPinned,
    });

    degrees[candidate.fromId] += 1;
    degrees[candidate.toId] += 1;
    activeLinks += 1;
  }
}

function inferLinkKind(source: NetworkNodeState, target: NetworkNodeState, distance: number): NetworkLinkState["kind"] {
  if (source.nodeRole === "bridge" || target.nodeRole === "bridge") {
    return "bridge";
  }
  if (source.regionId !== target.regionId || distance > MESH_TUNING.links.bridgeKindDistanceThresholdDeg) {
    return "bridge";
  }
  return "local";
}

function shouldSkipDynamicPair(
  source: NetworkNodeState,
  target: NetworkNodeState,
  existing: NetworkLinkState | undefined,
): boolean {
  if (existing?.isPinned && existing.kind === "local") {
    return true;
  }

  if (source.nodeRole === "cluster" && target.nodeRole === "cluster") {
    return true;
  }

  return false;
}

function getAnglePenalty(source: NetworkNodeState, target: NetworkNodeState, existingBearings: number[]): number {
  if (existingBearings.length === 0) {
    return 0;
  }

  const candidateBearing = getBearingDeg(source, target);
  let minDelta = 180;

  for (const bearing of existingBearings) {
    minDelta = Math.min(minDelta, shortestAngleDeltaDeg(bearing, candidateBearing));
  }

  if (minDelta < MESH_TUNING.links.anglePenalty.hardThresholdDeg) {
    return MESH_TUNING.links.anglePenalty.hardValue;
  }
  if (minDelta < MESH_TUNING.links.anglePenalty.softThresholdDeg) {
    return MESH_TUNING.links.anglePenalty.softValue;
  }
  return 0;
}

function getBearingDeg(source: NetworkNodeState, target: NetworkNodeState): number {
  const lngDelta = shortestLongitudeDelta(source.lng, target.lng);
  return (Math.atan2(target.lat - source.lat, lngDelta) * 180) / Math.PI;
}

function shortestAngleDeltaDeg(a: number, b: number): number {
  const delta = Math.abs((((b - a) % 360) + 540) % 360 - 180);
  return delta;
}

function getLinkId(a: number, b: number): string {
  return a < b ? `mesh:${a}:${b}` : `mesh:${b}:${a}`;
}

function pushNeighbor(map: Map<number, number[]>, nodeId: number, neighborId: number): void {
  const neighbors = map.get(nodeId);
  if (neighbors) {
    neighbors.push(neighborId);
  } else {
    map.set(nodeId, [neighborId]);
  }
}

function randomBetween(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
