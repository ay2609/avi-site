"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import vertexShader from "@/lib/shaders/globe/positionColor.vert";
import fragmentShader from "@/lib/shaders/globe/positionColor.frag";
import { TickManager, type TickData } from "@/lib/render/tick-manager";
import { PopulationNetworkLayer } from "@/lib/three/network/PopulationNetworkLayer";

import { HybridCamera } from "./HybridCamera";

/** Geometry and idle-motion of the globe itself. */
const GLOBE_CONFIG = {
  radius: 2,
  segments: 128,
  backgroundColor: 0x050505,
  autoSpinSpeed: 0.002, // Radians per frame once idle spin has ramped back up.
  spinResumeDelayMs: 1000, // Idle time after a drag before auto-spin ramps back in.
  spinRampUp: 0.01, // Lerp factor toward full auto-spin.
  spinRampDown: 0.05, // Lerp factor toward zero right after interaction.
} as const;

/**
 * Camera that blends continuously between perspective and orthographic.
 * Wheel drives the blend; pinch (ctrl+wheel) drives dolly distance.
 */
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
  minProjectionBlend: 0.0,
  maxProjectionBlend: 1.0,
  wheelSensitivity: 0.0012,
  blendSmoothing: 10,
} as const;

/** Animated elevation contours and lat/long graticule drawn by the globe shader. */
const TOPOGRAPHY_CONFIG = {
  intervalCount: 5, // Number of contour bands across normalized elevation range.
  phaseSpeed: 0.10, // How fast contours drift through elevations.
  lineWidth: 1.1, // Multiplier for contour anti-alias width.
  lineBias: 0.0006, // Base contour softness.
  altitudeCutoffBottomPct: 0.30, // Cut off this fraction from lowest altitudes.
  altitudeCutoffTopPct: 0.10, // Cut off this fraction from highest altitudes.
  oceanIsoStrength: 0.15, // Visibility strength for contours in non-land areas.
  landIsoStrength: 0.50, // Visibility strength for contours in land areas.
  topoLineColor: 0xffffff,
  gridLonCount: 36, // Vertical meridians around the globe.
  gridLatCount: 18, // Horizontal parallels from pole to pole.
  gridWidth: 1.5, // Grid anti-alias width multiplier.
  gridBias: 0.00035, // Base grid line softness.
  gridStrength: 0.11, // Grid visibility strength.
} as const;

/**
 * Packed field texture baked from the original 21600x10800 elevation map and
 * 16200x8100 water mask (80 MB combined). R = height with the shader's 5-tap
 * blur pre-applied, G = land mask. Both resolutions ship; 4096 keeps more
 * granular detail at full zoom, 2048 is ~4x lighter and identical at normal
 * globe distance. Regenerate with scripts/bake-globe-field.py.
 */
const FIELD_TEXTURE = {
  resolution: 2048 as 2048 | 4096,
} as const;

/** Weighting used for the single 0..1 "zoom" figure in the HUD readout. */
const HUD_CONFIG = {
  distanceWeight: 0.67,
  projectionWeight: 0.33,
} as const;

export default function GlobeCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(GLOBE_CONFIG.backgroundColor);

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
    renderer.domElement.style.inset = "0";
    host.appendChild(renderer.domElement);

    // --- Globe ---
    const textureLoader = new THREE.TextureLoader();
    const fieldTexture = textureLoader.load(
      `/globe-field-${FIELD_TEXTURE.resolution}.webp`
    );
    fieldTexture.colorSpace = THREE.NoColorSpace; // raw data, not color
    fieldTexture.wrapS = THREE.RepeatWrapping; // continuous across the antimeridian
    fieldTexture.wrapT = THREE.ClampToEdgeWrapping;
    fieldTexture.minFilter = THREE.LinearMipmapLinearFilter;
    fieldTexture.magFilter = THREE.LinearFilter;
    fieldTexture.generateMipmaps = true;
    fieldTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const globeRadius = GLOBE_CONFIG.radius;
    const globeGeometry = new THREE.SphereGeometry(
      globeRadius,
      GLOBE_CONFIG.segments,
      GLOBE_CONFIG.segments
    );
    const globeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uFieldTexture: { value: fieldTexture },
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
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);

    // Mesh-network layer rides on the globe so it rotates with it.
    const networkLayer = new PopulationNetworkLayer(globeRadius);
    globe.add(networkLayer.group);
    void networkLayer.init();

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = false; // Wheel is reserved for the projection blend.

    // --- Interaction state ---
    let projectionBlendTarget: number = HYBRID_CAMERA_CONFIG.initialProjectionBlend;
    let projectionBlendCurrent: number = projectionBlendTarget;
    let cameraDistanceTarget: number = THREE.MathUtils.clamp(
      camera.position.distanceTo(controls.target),
      HYBRID_CAMERA_CONFIG.minDistance,
      HYBRID_CAMERA_CONFIG.maxDistance
    );
    let currentSpinSpeed: number = GLOBE_CONFIG.autoSpinSpeed;
    let isAutoSpinPaused = false;
    let isUserInteracting = false;
    let lastInteractionTime = 0;

    controls.addEventListener("start", () => {
      isUserInteracting = true;
    });

    controls.addEventListener("end", () => {
      isUserInteracting = false;
      lastInteractionTime = performance.now();
    });

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      if (event.ctrlKey) {
        // Trackpad pinch commonly arrives as ctrl+wheel events.
        cameraDistanceTarget = THREE.MathUtils.clamp(
          cameraDistanceTarget *
            Math.exp(event.deltaY * HYBRID_CAMERA_CONFIG.pinchZoomSensitivity),
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
      lastInteractionTime = performance.now() - (GLOBE_CONFIG.spinResumeDelayMs + 1);
    };

    host.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.setSize(w, h);
      renderer.setSize(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    // --- Render loop ---
    const tickManager = new TickManager();

    const render = (data: TickData) => {
      const now = data.timestamp;
      const deltaSeconds = Math.max(data.timeDiff, 0) * 0.001;
      const blendAlpha =
        1.0 - Math.exp(-HYBRID_CAMERA_CONFIG.blendSmoothing * deltaSeconds);

      projectionBlendCurrent = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(projectionBlendCurrent, projectionBlendTarget, blendAlpha),
        HYBRID_CAMERA_CONFIG.minProjectionBlend,
        HYBRID_CAMERA_CONFIG.maxProjectionBlend
      );

      globeMaterial.uniforms.uTime.value = now * 0.001;

      // Auto-spin: stops while dragging, ramps back in after a beat of stillness.
      if (isAutoSpinPaused || isUserInteracting) {
        currentSpinSpeed = 0;
      } else if (now - lastInteractionTime > GLOBE_CONFIG.spinResumeDelayMs) {
        currentSpinSpeed = THREE.MathUtils.lerp(
          currentSpinSpeed,
          GLOBE_CONFIG.autoSpinSpeed,
          GLOBE_CONFIG.spinRampUp
        );
      } else {
        currentSpinSpeed = THREE.MathUtils.lerp(
          currentSpinSpeed,
          0,
          GLOBE_CONFIG.spinRampDown
        );
      }

      globe.rotation.y += currentSpinSpeed;

      controls.update();

      // Smooth the dolly distance toward its target along the current view ray.
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

      const projectionBlendRange = Math.max(
        HYBRID_CAMERA_CONFIG.maxProjectionBlend - HYBRID_CAMERA_CONFIG.minProjectionBlend,
        1e-6
      );
      const normalizedProjectionBlend = THREE.MathUtils.clamp(
        (projectionBlendCurrent - HYBRID_CAMERA_CONFIG.minProjectionBlend) /
          projectionBlendRange,
        0,
        1
      );
      const normalizedDistanceZoom = THREE.MathUtils.clamp(
        1 -
          (cameraTargetDistance - HYBRID_CAMERA_CONFIG.minDistance) /
            Math.max(
              1e-4,
              HYBRID_CAMERA_CONFIG.maxDistance - HYBRID_CAMERA_CONFIG.minDistance
            ),
        0,
        1
      );
      const hudZoomLevel = THREE.MathUtils.clamp(
        normalizedDistanceZoom * HUD_CONFIG.distanceWeight +
          normalizedProjectionBlend * HUD_CONFIG.projectionWeight,
        0,
        1
      );

      if (hudRef.current) {
        hudRef.current.textContent =
          `Zoom ${hudZoomLevel.toFixed(3)}  ` +
          `Dist ${cameraTargetDistance.toFixed(2)}  ` +
          `Proj ${normalizedProjectionBlend.toFixed(3)}`;
      }

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
    };

    tickManager.startLoop(render);

    return () => {
      host.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resize);
      tickManager.stopLoop();
      controls.dispose();
      networkLayer.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      fieldTexture.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="h-full w-full" />
      <div
        ref={hudRef}
        className="pointer-events-none absolute left-3 top-3 z-10 select-none border border-white/20 bg-black/60 px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white/90"
      >
        Zoom 0.000 Dist 0.00 Proj 0.000
      </div>
    </div>
  );
}
