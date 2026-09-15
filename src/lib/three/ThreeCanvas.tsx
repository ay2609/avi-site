"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { useRouter } from "next/navigation";

import vertexShader from "@/lib/shaders/globe/positionColor.vert";
import fragmentShader from "@/lib/shaders/globe/positionColor.frag";
import { TickManager, type TickData } from "@/lib/render/tick-manager";
import { PopulationNetworkLayer } from "@/lib/three/network/PopulationNetworkLayer";

import { HybridCamera } from "./HybridCamera";

interface POI {
  name: string;
  path: string;
  lat: number;
  lng: number;
  element?: HTMLDivElement;
  object?: CSS2DObject;
  surfaceDot?: THREE.Mesh;
  textElement?: HTMLSpanElement;
  fx?: POILabelFx;
}

interface POILabelFx {
  wasVisible: boolean;
  typedChars: number;
  typingAccumulator: number;
}

const POI_DATA: POI[] = [
  { name: "ASCII", path: "/ascii", lat: 20, lng: 0 },
  { name: "BLACK HOLE", path: "/blackhole", lat: -30, lng: 60 },
  { name: "FRACTALS", path: "/fractals", lat: 45, lng: -120 },
  { name: "ISOLINES", path: "/isolines", lat: -10, lng: -40 },
  { name: "GLOBE", path: "/globe", lat: 60, lng: 150 },
];

const HYBRID_CAMERA_CONFIG = {
  fov: 60,
  near: 0.001,
  far: 1000,
  zoom: 1,
  minDistance: 2.2,
  maxDistance: 12.0,
  pinchZoomSensitivity: 0.0030,
  pinchZoomSmoothing: 14,
  initialProjectionBlend: 0.0,
  minProjectionBlend: 0.,
  maxProjectionBlend: 1.,
  wheelSensitivity: 0.0012,
  blendSmoothing: 10,
} as const;

const TOPOGRAPHY_CONFIG = {
  intervalCount: 5, // Number of contour bands across normalized elevation range.
  phaseSpeed: 0.10, // How fast contours drift through elevations.
  lineWidth: 1.1, // Multiplier for contour anti-alias width.
  lineBias: 0.0006, // Base contour softness.
  altitudeCutoffBottomPct: 0.30, // Cut off this fraction from lowest altitudes.
  altitudeCutoffTopPct: 0.10, // Cut off this fraction from highest altitudes.
  oceanIsoStrength: 0.15, // Visibility strength for contours in non-land areas.
  landIsoStrength: 0.50, // Visibility strength for contours in land areas.
  topoLineColor: 0xffffff, // Static for now; wired as uniform for dynamic updates later.
  gridLonCount: 36, // Vertical meridians around the globe.
  gridLatCount: 18, // Horizontal parallels from pole to pole.
  gridWidth: 1.5, // Grid anti-alias width multiplier.
  gridBias: 0.00035, // Base grid line softness.
  gridStrength: 0.11, // Grid visibility strength.
} as const;

const UNDERLINE_GRID_CONFIG = {
  color: 0x9ca3af,
  opacity: 0.0,
  radius: 0.29, // In plane UV space [0, 0.707], controls visible circular footprint.
  feather: 0.12, // Soft edge for the circular mask.
  gridScale: 8.0, // Number of grid cells across plane UV.
  lineWidth: 1.6, // Anti-aliased line thickness.
  sizeMultiplier: 2.0, // Plane size relative to globe radius.
  yOffset: 0.2, // Distance below globe bottom.
  pulseSpeed: 0.35,
  pulseAmount: 0.03,
} as const;

const POI_VISUAL_FX_CONFIG = {
  typingCharsPerSecond: 8,
} as const;

const POI_ANCHOR_CONFIG = {
  labelOffset: 0.22, // Additional distance from globe surface along the surface normal.
  surfaceDotSize: 0.015,
  connectorColor: "rgba(255, 255, 255, 0.3)",
  connectorWidth: 1.15,
  connectorDash: [2.5, 2.5],
  visibilityPlaneOffsetPerspective: -0.275, // In globe-radius units at full perspective.
  visibilityPlaneOffsetOrtho: 0.0, // In globe-radius units at full orthographic.
} as const;

export default function ThreeCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    const camera = new HybridCamera({
      fov: HYBRID_CAMERA_CONFIG.fov,
      aspect: host.clientWidth / host.clientHeight,
      near: HYBRID_CAMERA_CONFIG.near,
      far: HYBRID_CAMERA_CONFIG.far,
      zoom: HYBRID_CAMERA_CONFIG.zoom,
      focusDistance: 4,
      projectionBlend: HYBRID_CAMERA_CONFIG.initialProjectionBlend,
    });
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.setSize(host.clientWidth, host.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0px";
    renderer.domElement.style.left = "0px";
    renderer.domElement.style.zIndex = "0";
    host.appendChild(renderer.domElement);

    const connectorCanvas = document.createElement("canvas");
    const connectorCtx = connectorCanvas.getContext("2d");
    connectorCanvas.style.position = "absolute";
    connectorCanvas.style.top = "0px";
    connectorCanvas.style.left = "0px";
    connectorCanvas.style.pointerEvents = "none";
    connectorCanvas.style.zIndex = "1";
    host.appendChild(connectorCanvas);

    const debugZoomEl = document.createElement("div");
    debugZoomEl.style.position = "absolute";
    debugZoomEl.style.top = "12px";
    debugZoomEl.style.left = "12px";
    debugZoomEl.style.zIndex = "3";
    debugZoomEl.style.pointerEvents = "none";
    debugZoomEl.style.padding = "6px 8px";
    debugZoomEl.style.border = "1px solid rgba(255,255,255,0.18)";
    debugZoomEl.style.background = "rgba(0,0,0,0.58)";
    debugZoomEl.style.color = "rgba(255,255,255,0.9)";
    debugZoomEl.style.fontFamily = "monospace";
    debugZoomEl.style.fontSize = "11px";
    debugZoomEl.style.letterSpacing = "0.06em";
    debugZoomEl.style.textTransform = "uppercase";
    debugZoomEl.textContent = "Zoom 0.000";
    host.appendChild(debugZoomEl);

    // --- CSS2D Renderer for Labels ---
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(host.clientWidth, host.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.left = "0px";
    labelRenderer.domElement.style.zIndex = "2";
    labelRenderer.domElement.style.pointerEvents = "none";
    host.appendChild(labelRenderer.domElement);


    // --- Globe ---
    const textureLoader = new THREE.TextureLoader();
    const landTexture = textureLoader.load("/water_16k.png");
    const heightTexture = textureLoader.load("/World_elevation_map.png");

    landTexture.colorSpace = THREE.NoColorSpace;
    heightTexture.colorSpace = THREE.NoColorSpace;


    const globeRadius = 2;
    const geometry = new THREE.SphereGeometry(globeRadius, 128, 128);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLandTexture: { value: landTexture },
        uHeightTexture: { value: heightTexture },
        opacity: { value: 0.9 },
        uTime: { value: 0 },
        uIntervalCount: { value: TOPOGRAPHY_CONFIG.intervalCount },
        uPhaseSpeed: { value: TOPOGRAPHY_CONFIG.phaseSpeed },
        uLineWidth: { value: TOPOGRAPHY_CONFIG.lineWidth },
        uLineBias: { value: TOPOGRAPHY_CONFIG.lineBias },
        uAltitudeCutoffBottomPct: { value: TOPOGRAPHY_CONFIG.altitudeCutoffBottomPct },
        uAltitudeCutoffTopPct: { value: TOPOGRAPHY_CONFIG.altitudeCutoffTopPct },
        uOceanIsoStrength: { value: TOPOGRAPHY_CONFIG.oceanIsoStrength },
        uLandIsoStrength: { value: TOPOGRAPHY_CONFIG.landIsoStrength },
        uTopoLineColor: { value: new THREE.Color(TOPOGRAPHY_CONFIG.topoLineColor) },
        uGridLonCount: { value: TOPOGRAPHY_CONFIG.gridLonCount },
        uGridLatCount: { value: TOPOGRAPHY_CONFIG.gridLatCount },
        uGridWidth: { value: TOPOGRAPHY_CONFIG.gridWidth },
        uGridBias: { value: TOPOGRAPHY_CONFIG.gridBias },
        uGridStrength: { value: TOPOGRAPHY_CONFIG.gridStrength },
      },
      transparent: true,
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    const networkLayer = new PopulationNetworkLayer(globeRadius);
    globe.add(networkLayer.group);
    void networkLayer.init();

    // --- Underline Grid Plane ---
    const underlineGeometry = new THREE.PlaneGeometry(
      globeRadius * UNDERLINE_GRID_CONFIG.sizeMultiplier,
      globeRadius * UNDERLINE_GRID_CONFIG.sizeMultiplier
    );
    const underlineMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(UNDERLINE_GRID_CONFIG.color) },
        uOpacity: { value: UNDERLINE_GRID_CONFIG.opacity },
        uRadius: { value: UNDERLINE_GRID_CONFIG.radius },
        uFeather: { value: UNDERLINE_GRID_CONFIG.feather },
        uGridScale: { value: UNDERLINE_GRID_CONFIG.gridScale },
        uLineWidth: { value: UNDERLINE_GRID_CONFIG.lineWidth },
        uPulseSpeed: { value: UNDERLINE_GRID_CONFIG.pulseSpeed },
        uPulseAmount: { value: UNDERLINE_GRID_CONFIG.pulseAmount },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;

        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uRadius;
        uniform float uFeather;
        uniform float uGridScale;
        uniform float uLineWidth;
        uniform float uPulseSpeed;
        uniform float uPulseAmount;

        float gridMask(vec2 uv, float scale, float width) {
          vec2 gridUv = uv * scale;
          vec2 cell = abs(fract(gridUv) - 0.5);
          vec2 fw = fwidth(gridUv);
          float gx = 1.0 - smoothstep(0.0, fw.x * width, cell.x);
          float gy = 1.0 - smoothstep(0.0, fw.y * width, cell.y);
          return max(gx, gy);
        }

        void main() {
          float grid = gridMask(vUv, uGridScale, uLineWidth);

          vec2 centeredUv = vUv - vec2(0.5);
          float dist = length(centeredUv);
          float circleMask = 1.0 - smoothstep(uRadius, uRadius + uFeather, dist);

          float pulse = 1.0 + uPulseAmount * sin(uTime * uPulseSpeed * 6.2831853);
          float alpha = grid * circleMask * uOpacity * pulse;

          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    const underlinePlane = new THREE.Mesh(underlineGeometry, underlineMaterial);
    underlinePlane.rotation.x = -Math.PI * 0.5;
    underlinePlane.position.y = -globeRadius - UNDERLINE_GRID_CONFIG.yOffset;
    scene.add(underlinePlane);

    // --- Lights (camera-following) ---
    const ambient = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambient);

    const mainLight = new THREE.PointLight(0xffffff, 90, 0, 2);
    camera.add(mainLight);
    scene.add(camera);

    // --- Points of Interest ---
    const updatePoiLabelFx = (
      poi: POI,
      shouldBeVisible: boolean,
      deltaSeconds: number
    ) => {
      if (!poi.textElement || !poi.fx) return;

      const fx = poi.fx;
      const labelTextEl = poi.textElement;

      if (!shouldBeVisible) {
        fx.wasVisible = false;
        fx.typedChars = 0;
        fx.typingAccumulator = 0;
        labelTextEl.textContent = "";
        labelTextEl.style.opacity = "0";
        return;
      }

      if (!fx.wasVisible) {
        fx.wasVisible = true;
        fx.typedChars = 0;
        fx.typingAccumulator = 0;
        labelTextEl.textContent = "";
      }

      fx.typingAccumulator += deltaSeconds * POI_VISUAL_FX_CONFIG.typingCharsPerSecond;
      const nextTypedChars = Math.min(
        poi.name.length,
        Math.floor(fx.typingAccumulator)
      );

      if (nextTypedChars !== fx.typedChars) {
        fx.typedChars = nextTypedChars;
        labelTextEl.textContent = poi.name.slice(0, fx.typedChars);
      }
      labelTextEl.style.opacity = "1";
    };

    const surfaceDotGeometry = new THREE.SphereGeometry(
      POI_ANCHOR_CONFIG.surfaceDotSize,
      10,
      10
    );
    const surfaceDotMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });

    const pois = POI_DATA.map(poi => {
      const phi = (90 - poi.lat) * (Math.PI / 180);
      const theta = (poi.lng + 180) * (Math.PI / 180);

      const x = -(globeRadius * Math.sin(phi) * Math.cos(theta));
      const z = globeRadius * Math.sin(phi) * Math.sin(theta);
      const y = globeRadius * Math.cos(phi);
      const surfacePosition = new THREE.Vector3(x, y, z);
      const labelPosition = surfacePosition
        .clone()
        .normalize()
        .multiplyScalar(globeRadius + POI_ANCHOR_CONFIG.labelOffset);

      const div = document.createElement("div");
      div.className = "poi-label";
      div.innerHTML = `
        <div class="flex flex-col items-center group cursor-pointer pointer-events-auto">
          <div class="w-2 h-2 bg-cyan-400 rounded-full mb-1 shadow-[0_0_10px_#22d3ee]"></div>
          <div class="poi-label-card px-2 py-1 bg-black/80 border border-cyan-500/50 backdrop-blur-sm text-[10px] text-cyan-400 tracking-[0.2em] uppercase font-mono group-hover:bg-cyan-500 group-hover:text-black">
            <span class="poi-label-text"></span>
          </div>
        </div>
      `;

      div.onclick = () => {
        router.push(poi.path);
      };

      const label = new CSS2DObject(div);
      label.position.copy(labelPosition);
      globe.add(label);

      const surfaceDot = new THREE.Mesh(surfaceDotGeometry, surfaceDotMaterial);
      surfaceDot.position.copy(surfacePosition);
      globe.add(surfaceDot);

      const textElement = div.querySelector(".poi-label-text") as HTMLSpanElement | null;

      if (textElement) {
        textElement.textContent = "";
        textElement.style.opacity = "0";
      }

      return {
        ...poi,
        element: div,
        object: label,
        surfaceDot,
        textElement: textElement ?? undefined,
        fx: {
          wasVisible: false,
          typedChars: 0,
          typingAccumulator: 0,
        },
      };
    });

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = false;
    controls.autoRotate = false; // We'll handle rotation ourselves for smoother control

    // --- State for Animation ---
    const autoSpinSpeed = 0.002;
    let projectionBlendTarget: number = HYBRID_CAMERA_CONFIG.initialProjectionBlend;
    let projectionBlendCurrent: number = projectionBlendTarget;
    let cameraDistanceTarget: number = THREE.MathUtils.clamp(
      camera.position.distanceTo(controls.target),
      HYBRID_CAMERA_CONFIG.minDistance,
      HYBRID_CAMERA_CONFIG.maxDistance
    );
    let currentSpinSpeed = autoSpinSpeed;
    let isAutoSpinPaused = false;
    let isUserInteracting = false;
    let lastInteractionTime = 0;

    controls.addEventListener('start', () => {
      isUserInteracting = true;
    });

    controls.addEventListener("end", () => {
      isUserInteracting = false;
      lastInteractionTime = performance.now();
    });

    const resizeConnectorCanvas = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      connectorCanvas.width = Math.max(1, Math.floor(w * dpr));
      connectorCanvas.height = Math.max(1, Math.floor(h * dpr));
      connectorCanvas.style.width = `${w}px`;
      connectorCanvas.style.height = `${h}px`;

      if (connectorCtx) {
        connectorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      if (event.ctrlKey) {
        // Trackpad pinch commonly arrives as ctrl+wheel events.
        cameraDistanceTarget = THREE.MathUtils.clamp(
          cameraDistanceTarget * Math.exp(event.deltaY * HYBRID_CAMERA_CONFIG.pinchZoomSensitivity),
          HYBRID_CAMERA_CONFIG.minDistance,
          HYBRID_CAMERA_CONFIG.maxDistance
        );
        return;
      }

      projectionBlendTarget = THREE.MathUtils.clamp(
        projectionBlendTarget + event.deltaY * HYBRID_CAMERA_CONFIG.wheelSensitivity,
        HYBRID_CAMERA_CONFIG.minProjectionBlend,
        HYBRID_CAMERA_CONFIG.maxProjectionBlend
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      event.preventDefault();
      isAutoSpinPaused = !isAutoSpinPaused;

      if (isAutoSpinPaused) {
        currentSpinSpeed = 0;
        return;
      }

      // Resume with the normal auto-spin ramp instead of snapping immediately.
      lastInteractionTime = performance.now() - 1001;
    };

    host.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.setSize(w, h);
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      resizeConnectorCanvas();
    };

    resize();
    window.addEventListener("resize", resize);

    const tickManager = new TickManager();

    const cameraPosition = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();
    const globeWorldPosition = new THREE.Vector3();
    const visibilityPlanePoint = new THREE.Vector3();
    const visibilityPlaneNormal = new THREE.Vector3();
    const poiWorldPosition = new THREE.Vector3();
    const poiPlaneOffset = new THREE.Vector3();
    const projectedPoint = new THREE.Vector3();
    const lineDashPattern = [...POI_ANCHOR_CONFIG.connectorDash];

    const render = (data: TickData) => {
      const now = data.timestamp;
      const deltaSeconds = Math.max(data.timeDiff, 0) * 0.001;
      const blendAlpha = 1.0 - Math.exp(-HYBRID_CAMERA_CONFIG.blendSmoothing * deltaSeconds);

      projectionBlendCurrent = THREE.MathUtils.lerp(
        projectionBlendCurrent,
        projectionBlendTarget,
        blendAlpha
      );
      projectionBlendCurrent = THREE.MathUtils.clamp(
        projectionBlendCurrent,
        HYBRID_CAMERA_CONFIG.minProjectionBlend,
        HYBRID_CAMERA_CONFIG.maxProjectionBlend
      );

      material.uniforms.uTime.value = now * 0.001;
      underlineMaterial.uniforms.uTime.value = now * 0.001;

      // Handle Auto-Spin Acceleration
      if (isAutoSpinPaused) {
        currentSpinSpeed = 0;
      } else if (!isUserInteracting) {
        const timeSinceLastInteraction = now - lastInteractionTime;
        if (timeSinceLastInteraction > 1000) {
          currentSpinSpeed = THREE.MathUtils.lerp(currentSpinSpeed, autoSpinSpeed, 0.01);
        } else {
          currentSpinSpeed = THREE.MathUtils.lerp(currentSpinSpeed, 0, 0.05);
        }
      } else {
        currentSpinSpeed = 0;
      }

      globe.rotation.y += currentSpinSpeed;

      controls.update();

      const offsetFromTarget = camera.position.clone().sub(controls.target);
      const currentDistance = Math.max(offsetFromTarget.length(), 1e-6);
      const zoomAlpha =
        1.0 - Math.exp(-HYBRID_CAMERA_CONFIG.pinchZoomSmoothing * deltaSeconds);
      const smoothedDistance = THREE.MathUtils.lerp(
        currentDistance,
        cameraDistanceTarget,
        zoomAlpha
      );

      offsetFromTarget.normalize().multiplyScalar(smoothedDistance);
      camera.position.copy(controls.target).add(offsetFromTarget);

      // Match the orthographic framing to the globe's projected silhouette, not
      // just the center target plane. Using the tangent depth keeps the globe's
      // on-screen radius stable while blending between perspective and ortho.
      const cameraTargetDistance = camera.position.distanceTo(controls.target);
      const globeSilhouetteDistance = Math.sqrt(
        Math.max(
          cameraTargetDistance * cameraTargetDistance - globeRadius * globeRadius,
          (camera.near + 1e-4) * (camera.near + 1e-4)
        )
      );
      camera.focusDistance = Math.max(globeSilhouetteDistance, camera.near + 1e-4);
      camera.projectionBlend = projectionBlendCurrent;
      camera.updateProjectionMatrix();

      // Update POI visibility by cutting the globe with a camera-relative plane.
      camera.getWorldPosition(cameraPosition);
      camera.getWorldDirection(cameraForward);
      globe.getWorldPosition(globeWorldPosition);
      const projectionBlendRange = Math.max(
        Number(HYBRID_CAMERA_CONFIG.maxProjectionBlend - HYBRID_CAMERA_CONFIG.minProjectionBlend),
        1e-6
      );
      const normalizedProjectionBlend =
        THREE.MathUtils.clamp(
          (projectionBlendCurrent - HYBRID_CAMERA_CONFIG.minProjectionBlend) /
            projectionBlendRange,
          0,
          1
        );
      const normalizedDistanceZoom = THREE.MathUtils.clamp(
        1 -
          (camera.position.distanceTo(controls.target) - HYBRID_CAMERA_CONFIG.minDistance) /
            Math.max(0.0001, HYBRID_CAMERA_CONFIG.maxDistance - HYBRID_CAMERA_CONFIG.minDistance),
        0,
        1
      );
      const debugZoomLevel = THREE.MathUtils.clamp(
        normalizedDistanceZoom * 0.67 + normalizedProjectionBlend * 0.33,
        0,
        1
      );
      debugZoomEl.textContent =
        `Zoom ${debugZoomLevel.toFixed(3)}  Dist ${camera.position.distanceTo(controls.target).toFixed(2)}  Proj ${normalizedProjectionBlend.toFixed(3)}`;
      const visibilityPlaneOffset = THREE.MathUtils.lerp(
        POI_ANCHOR_CONFIG.visibilityPlaneOffsetPerspective,
        POI_ANCHOR_CONFIG.visibilityPlaneOffsetOrtho,
        normalizedProjectionBlend
      );
      visibilityPlanePoint
        .copy(globeWorldPosition)
        .addScaledVector(cameraForward, visibilityPlaneOffset * globeRadius);
      visibilityPlaneNormal.copy(cameraForward).multiplyScalar(-1);

      const visiblePois: POI[] = [];
      pois.forEach((poi) => {
        poi.surfaceDot?.getWorldPosition(poiWorldPosition);
        const signedPlaneDistance = poiPlaneOffset
          .copy(poiWorldPosition)
          .sub(visibilityPlanePoint)
          .dot(visibilityPlaneNormal);
        const shouldShow = signedPlaneDistance >= 0;

        if (shouldShow) {
          poi.element!.style.opacity = "1";
          poi.element!.style.pointerEvents = "auto";
          visiblePois.push(poi);
        } else {
          poi.element!.style.opacity = "0";
          poi.element!.style.pointerEvents = "none";
        }

        if (poi.surfaceDot) {
          poi.surfaceDot.visible = shouldShow;
        }

        updatePoiLabelFx(poi, shouldShow, deltaSeconds);
      });

      networkLayer.update(
        {
          camera,
          globe,
          projectionBlend: normalizedProjectionBlend,
          timestampMs: now,
        },
        deltaSeconds
      );

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);

      if (!connectorCtx) return;

      const hostWidth = host.clientWidth;
      const hostHeight = host.clientHeight;
      const hostRect = host.getBoundingClientRect();

      connectorCtx.clearRect(0, 0, hostWidth, hostHeight);
      connectorCtx.lineWidth = POI_ANCHOR_CONFIG.connectorWidth;
      connectorCtx.strokeStyle = POI_ANCHOR_CONFIG.connectorColor;
      connectorCtx.lineCap = "round";
      connectorCtx.setLineDash(lineDashPattern);

      for (const poi of visiblePois) {
        if (!poi.surfaceDot || !poi.element) continue;

        poi.surfaceDot.getWorldPosition(projectedPoint);
        projectedPoint.project(camera);

        if (projectedPoint.z < -1 || projectedPoint.z > 1) continue;

        const anchorX = (projectedPoint.x * 0.5 + 0.5) * hostWidth;
        const anchorY = (-projectedPoint.y * 0.5 + 0.5) * hostHeight;

        const labelCard = poi.element.querySelector(".poi-label-card") as HTMLDivElement | null;
        const targetElement = labelCard ?? poi.element;
        const rect = targetElement.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) continue;

        const topCorners = [
          { x: rect.left - hostRect.left, y: rect.top - hostRect.top },
          { x: rect.right - hostRect.left, y: rect.top - hostRect.top },
        ];
        const bottomCorners = [
          { x: rect.right - hostRect.left, y: rect.bottom - hostRect.top },
          { x: rect.left - hostRect.left, y: rect.bottom - hostRect.top },
        ];
        const labelCenterY = rect.top - hostRect.top + rect.height * 0.5;
        const corners = anchorY <= labelCenterY ? topCorners : bottomCorners;

        const currentOpacity = Number.parseFloat(getComputedStyle(poi.element).opacity);
        if (!Number.isFinite(currentOpacity) || currentOpacity <= 0) continue;
        connectorCtx.globalAlpha = THREE.MathUtils.clamp(currentOpacity, 0, 1);

        for (let i = 0; i < 2; i += 1) {
          connectorCtx.beginPath();
          connectorCtx.moveTo(anchorX, anchorY);
          connectorCtx.lineTo(corners[i].x, corners[i].y);
          connectorCtx.stroke();
        }
      }

      connectorCtx.globalAlpha = 1;
      connectorCtx.setLineDash([]);
    };

    tickManager.startLoop(render);

    return () => {
      host.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resize);
      tickManager.stopLoop();
      controls.dispose();
      underlineGeometry.dispose();
      underlineMaterial.dispose();
      surfaceDotGeometry.dispose();
      surfaceDotMaterial.dispose();
      networkLayer.dispose();
      renderer.dispose();
      debugZoomEl.remove();
      connectorCanvas.remove();
      labelRenderer.domElement.remove();
      host.removeChild(renderer.domElement);
    };
  }, [router]);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div ref={hostRef} className="h-full w-full" />
      <style jsx global>{`
        .poi-label {
          transition: opacity 0.5s ease;
          user-select: none;
        }
      `}</style>
    </div>
  );
}
