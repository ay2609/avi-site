import * as THREE from "three";

import { ARCHETYPE_CONFIG, NETWORK_DEFAULTS, NETWORK_VISIBILITY_CONFIG } from "./catalog";
import { NetworkSimulation } from "./simulation";
import { MESH_TUNING } from "./tuning";
import type { NetworkLayerOptions, NetworkLinkState, NetworkNodeState } from "./types";

const NODE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aSize;
  attribute float aPulse;

  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float pulse = 1.0 + ${MESH_TUNING.render.pointSize.pulseAmplitude.toFixed(2)} * sin(uTime * aPulse);
    float distanceScale = ${MESH_TUNING.render.pointSize.distanceScale.toFixed(1)} / max(${MESH_TUNING.render.pointSize.minPerspectiveDepth.toFixed(1)}, -mvPosition.z);
    gl_PointSize = clamp(aSize * pulse * distanceScale, ${MESH_TUNING.render.pointSize.minPixels.toFixed(1)}, ${MESH_TUNING.render.pointSize.maxPixels.toFixed(1)});
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NODE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord * 2.0 - 1.0;
    float square = max(abs(centered.x), abs(centered.y));
    float outer = 1.0 - smoothstep(0.86, 1.0, square);
    float inner = 1.0 - smoothstep(0.36, 0.62, square);
    float ring = clamp(outer - inner, 0.0, 1.0);
    float core = 1.0 - smoothstep(0.18, 0.34, length(centered));
    float glow = 1.0 - smoothstep(0.45, 1.05, length(centered));
    float alpha = max(ring, core * 0.7) + glow * 0.18;
    alpha *= vAlpha;

    if (alpha < 0.02) {
      discard;
    }

    vec3 color = vColor * (0.75 + glow * 0.4);
    gl_FragColor = vec4(color, alpha);
  }
`;

const LINK_VERTEX_SHADER = `
  attribute vec4 aColorAlpha;

  varying vec4 vColorAlpha;

  void main() {
    vColorAlpha = aColorAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINK_FRAGMENT_SHADER = `
  varying vec4 vColorAlpha;

  void main() {
    gl_FragColor = vColorAlpha;
  }
`;

interface UpdateArgs {
  camera: THREE.Camera;
  globe: THREE.Object3D;
  projectionBlend: number;
  timestampMs: number;
}

export class PopulationNetworkLayer {
  readonly group = new THREE.Group();

  private readonly options: Required<NetworkLayerOptions>;
  private readonly nodesGeometry = new THREE.BufferGeometry();
  private readonly linksGeometry = new THREE.BufferGeometry();
  private readonly nodesMaterial: THREE.ShaderMaterial;
  private readonly linksMaterial: THREE.ShaderMaterial;
  private readonly nodesPoints: THREE.Points;
  private readonly linksSegments: THREE.LineSegments;
  private readonly localNodePosition = new THREE.Vector3();
  private readonly worldNodePosition = new THREE.Vector3();
  private readonly worldLinkStart = new THREE.Vector3();
  private readonly worldLinkEnd = new THREE.Vector3();
  private readonly planeDelta = new THREE.Vector3();
  private readonly cameraForward = new THREE.Vector3();
  private readonly globeWorldPosition = new THREE.Vector3();
  private readonly visibilityPlanePoint = new THREE.Vector3();
  private readonly visibilityPlaneNormal = new THREE.Vector3();
  private simulation: NetworkSimulation | null = null;
  private nodePositionArray: Float32Array;
  private nodeColorArray: Float32Array;
  private nodeAlphaArray: Float32Array;
  private nodeSizeArray: Float32Array;
  private nodePulseArray: Float32Array;
  private linkPositionArray: Float32Array;
  private linkColorAlphaArray: Float32Array;
  private visibleNodeIds: Uint32Array;
  private visibleNodeMask: Uint8Array;
  private ready = false;
  private disposed = false;

  constructor(private readonly globeRadius: number, options: NetworkLayerOptions = {}) {
    this.options = {
      ...NETWORK_DEFAULTS,
      ...options,
    };

    this.nodePositionArray = new Float32Array(this.options.maxVisibleNodes * 3);
    this.nodeColorArray = new Float32Array(this.options.maxVisibleNodes * 3);
    this.nodeAlphaArray = new Float32Array(this.options.maxVisibleNodes);
    this.nodeSizeArray = new Float32Array(this.options.maxVisibleNodes);
    this.nodePulseArray = new Float32Array(this.options.maxVisibleNodes);
    this.linkPositionArray = new Float32Array(this.options.maxVisibleLinks * 2 * 3);
    this.linkColorAlphaArray = new Float32Array(this.options.maxVisibleLinks * 2 * 4);
    this.visibleNodeIds = new Uint32Array(this.options.maxVisibleNodes);
    this.visibleNodeMask = new Uint8Array(this.options.maxNodes);

    this.nodesGeometry.setAttribute("position", new THREE.BufferAttribute(this.nodePositionArray, 3));
    this.nodesGeometry.setAttribute("aColor", new THREE.BufferAttribute(this.nodeColorArray, 3));
    this.nodesGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.nodeAlphaArray, 1));
    this.nodesGeometry.setAttribute("aSize", new THREE.BufferAttribute(this.nodeSizeArray, 1));
    this.nodesGeometry.setAttribute("aPulse", new THREE.BufferAttribute(this.nodePulseArray, 1));
    this.nodesGeometry.setDrawRange(0, 0);

    this.linksGeometry.setAttribute("position", new THREE.BufferAttribute(this.linkPositionArray, 3));
    this.linksGeometry.setAttribute("aColorAlpha", new THREE.BufferAttribute(this.linkColorAlphaArray, 4));
    this.linksGeometry.setDrawRange(0, 0);

    this.nodesMaterial = new THREE.ShaderMaterial({
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
      },
      blending: THREE.NormalBlending,
    });

    this.linksMaterial = new THREE.ShaderMaterial({
      vertexShader: LINK_VERTEX_SHADER,
      fragmentShader: LINK_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });

    this.nodesPoints = new THREE.Points(this.nodesGeometry, this.nodesMaterial);
    this.linksSegments = new THREE.LineSegments(this.linksGeometry, this.linksMaterial);

    this.linksSegments.renderOrder = 3;
    this.nodesPoints.renderOrder = 4;

    this.group.add(this.linksSegments);
    this.group.add(this.nodesPoints);
  }

  async init(): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    try {
      if (this.disposed) {
        return;
      }

      this.simulation = new NetworkSimulation(this.options.maxNodes, this.options.maxLinks, this.options.solveIntervalMs);
      this.simulation.initialize();
      this.ready = true;
    } catch (error) {
      console.error("Failed to initialize population network layer", error);
      this.ready = false;
    }
  }

  update({ camera, globe, projectionBlend, timestampMs }: UpdateArgs, deltaSeconds: number): void {
    if (!this.ready || !this.simulation) {
      return;
    }

    this.simulation.update(deltaSeconds);
    this.nodesMaterial.uniforms.uTime.value = timestampMs * 0.001;

    camera.getWorldDirection(this.cameraForward);
    globe.getWorldPosition(this.globeWorldPosition);

    const visibilityPlaneOffset = THREE.MathUtils.lerp(
      NETWORK_VISIBILITY_CONFIG.visibilityPlaneOffsetPerspective,
      NETWORK_VISIBILITY_CONFIG.visibilityPlaneOffsetOrtho,
      projectionBlend
    );

    this.visibilityPlanePoint
      .copy(this.globeWorldPosition)
      .addScaledVector(this.cameraForward, visibilityPlaneOffset * this.globeRadius);
    this.visibilityPlaneNormal.copy(this.cameraForward).multiplyScalar(-1);

    let visibleNodeCount = 0;

    for (const node of this.simulation.nodes) {
      if (visibleNodeCount >= this.options.maxVisibleNodes) {
        break;
      }

      setNodeVector(node, this.localNodePosition, this.globeRadius);
      this.worldNodePosition.copy(this.localNodePosition).applyMatrix4(globe.matrixWorld);

      const signedDistance = this.planeDelta
        .copy(this.worldNodePosition)
        .sub(this.visibilityPlanePoint)
        .dot(this.visibilityPlaneNormal);

      if (signedDistance < 0) {
        continue;
      }

      const config = ARCHETYPE_CONFIG[node.archetype];
      const positionIndex = visibleNodeCount * 3;
      const colorIndex = visibleNodeCount * 3;

      this.nodePositionArray[positionIndex] = this.localNodePosition.x;
      this.nodePositionArray[positionIndex + 1] = this.localNodePosition.y;
      this.nodePositionArray[positionIndex + 2] = this.localNodePosition.z;
      this.nodeColorArray[colorIndex] = config.color[0];
      this.nodeColorArray[colorIndex + 1] = config.color[1];
      this.nodeColorArray[colorIndex + 2] = config.color[2];
      this.nodeAlphaArray[visibleNodeCount] = getNodeAlpha(node);
      this.nodeSizeArray[visibleNodeCount] = node.renderSize;
      this.nodePulseArray[visibleNodeCount] = node.pulseRate;
      this.visibleNodeIds[visibleNodeCount] = node.id;
      this.visibleNodeMask[node.id] = 1;

      visibleNodeCount += 1;
    }

    this.nodesGeometry.setDrawRange(0, visibleNodeCount);
    markDirty(this.nodesGeometry);

    let visibleLinkCount = 0;

    for (const link of this.simulation.links.values()) {
      if (visibleLinkCount >= this.options.maxVisibleLinks) {
        break;
      }

      if (link.fade <= 0.02) {
        continue;
      }

      if (this.visibleNodeMask[link.fromId] !== 1 || this.visibleNodeMask[link.toId] !== 1) {
        continue;
      }

      const fromNode = this.simulation.nodes[link.fromId];
      const toNode = this.simulation.nodes[link.toId];
      setNodeVector(fromNode, this.worldLinkStart, this.globeRadius);
      setNodeVector(toNode, this.worldLinkEnd, this.globeRadius);

      const linePositionIndex = visibleLinkCount * 6;
      this.linkPositionArray[linePositionIndex] = this.worldLinkStart.x;
      this.linkPositionArray[linePositionIndex + 1] = this.worldLinkStart.y;
      this.linkPositionArray[linePositionIndex + 2] = this.worldLinkStart.z;
      this.linkPositionArray[linePositionIndex + 3] = this.worldLinkEnd.x;
      this.linkPositionArray[linePositionIndex + 4] = this.worldLinkEnd.y;
      this.linkPositionArray[linePositionIndex + 5] = this.worldLinkEnd.z;

      const color = getLinkColor(link);
      const alpha = getLinkAlpha(link);
      const colorIndex = visibleLinkCount * 8;

      for (let vertex = 0; vertex < 2; vertex += 1) {
        const offset = colorIndex + vertex * 4;
        this.linkColorAlphaArray[offset] = color[0];
        this.linkColorAlphaArray[offset + 1] = color[1];
        this.linkColorAlphaArray[offset + 2] = color[2];
        this.linkColorAlphaArray[offset + 3] = alpha;
      }

      visibleLinkCount += 1;
    }

    this.linksGeometry.setDrawRange(0, visibleLinkCount * 2);
    markDirty(this.linksGeometry);

    for (let i = 0; i < visibleNodeCount; i += 1) {
      this.visibleNodeMask[this.visibleNodeIds[i]] = 0;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.group.remove(this.linksSegments);
    this.group.remove(this.nodesPoints);
    this.nodesGeometry.dispose();
    this.linksGeometry.dispose();
    this.nodesMaterial.dispose();
    this.linksMaterial.dispose();
  }
}

function setNodeVector(node: NetworkNodeState, target: THREE.Vector3, globeRadius: number): THREE.Vector3 {
  const phi = (90 - node.lat) * (Math.PI / 180);
  const theta = (node.lng + 180) * (Math.PI / 180);
  const radius = globeRadius + node.altitude;

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return target.set(x, y, z);
}

function getNodeAlpha(node: NetworkNodeState): number {
  const roleBoost = MESH_TUNING.render.nodeAlphaRoleBoost[node.nodeRole];
  return clamp(
    node.alpha * (MESH_TUNING.render.nodeAlphaBase + node.activity * MESH_TUNING.render.nodeAlphaActivityWeight) * roleBoost,
    MESH_TUNING.render.nodeAlphaClamp[0],
    MESH_TUNING.render.nodeAlphaClamp[1],
  );
}

function getLinkColor(link: NetworkLinkState): readonly [number, number, number] {
  switch (link.kind) {
    case "local":
      return [0.79, 0.43, 0.97];
    case "bridge":
      return link.isPinned ? [0.93, 0.84, 0.99] : [0.88, 0.62, 0.98];
  }
}

function getLinkAlpha(link: NetworkLinkState): number {
  if (link.kind === "bridge") {
    return clamp(
      link.fade *
        (MESH_TUNING.render.linkAlpha.bridgeBase +
          link.strength *
            (link.isPinned
              ? MESH_TUNING.render.linkAlpha.pinnedBridgeStrengthWeight
              : MESH_TUNING.render.linkAlpha.bridgeStrengthWeight)),
      0,
      link.isPinned ? MESH_TUNING.render.linkAlpha.pinnedBridgeMax : MESH_TUNING.render.linkAlpha.bridgeMax,
    );
  }
  return clamp(
    link.fade * (MESH_TUNING.render.linkAlpha.localBase + link.strength * MESH_TUNING.render.linkAlpha.localStrengthWeight),
    0,
    MESH_TUNING.render.linkAlpha.localMax,
  );
}

function markDirty(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute("position");
  position.needsUpdate = true;

  for (const key of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(key);
    attribute.needsUpdate = true;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
