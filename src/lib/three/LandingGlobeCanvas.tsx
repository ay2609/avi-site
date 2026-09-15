"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import vertexShader from "@/lib/shaders/globe/positionColor.vert";
import fragmentShader from "@/lib/shaders/globe/positionColor.frag";
import { TickManager, type TickData } from "@/lib/render/tick-manager";
import { PopulationNetworkLayer } from "@/lib/three/network/PopulationNetworkLayer";

export interface LandingPoi {
  name: string;
  path: string;
  lat: number;
  lng: number;
}

export const LANDING_POIS: LandingPoi[] = [
  { name: "ASCII", path: "/ascii", lat: 20, lng: 0 },
  { name: "BLACK HOLE", path: "/blackhole", lat: -30, lng: 60 },
  { name: "FRACTALS", path: "/fractals", lat: 45, lng: -120 },
  { name: "ISOLINES", path: "/isolines", lat: -10, lng: -40 },
  { name: "GLOBE", path: "/globe", lat: 60, lng: 150 },
];

interface LandingGlobeCanvasProps {
  activePoiPath: string | null;
}

const TOPOGRAPHY_CONFIG = {
  intervalCount: 5,
  phaseSpeed: 0.1,
  lineWidth: 1.1,
  lineBias: 0.0006,
  altitudeCutoffBottomPct: 0.3,
  altitudeCutoffTopPct: 0.1,
  oceanIsoStrength: 0.15,
  landIsoStrength: 0.5,
  topoLineColor: 0xffffff,
  gridLonCount: 36,
  gridLatCount: 18,
  gridWidth: 1.5,
  gridBias: 0.00035,
  gridStrength: 0.11,
} as const;

const FRONT_VECTOR = new THREE.Vector3(0, 0, 1);

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export default function LandingGlobeCanvas({ activePoiPath }: LandingGlobeCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const activePoiPathRef = useRef<string | null>(activePoiPath);

  useEffect(() => {
    activePoiPathRef.current = activePoiPath;
  }, [activePoiPath]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    const camera = new THREE.PerspectiveCamera(58, host.clientWidth / host.clientHeight, 0.001, 1000);
    camera.position.set(0, 0, 5.25);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    host.appendChild(renderer.domElement);

    const sceneGroup = new THREE.Group();
    scene.add(sceneGroup);

    const textureLoader = new THREE.TextureLoader();
    const landTexture = textureLoader.load("/water_16k.png");
    const heightTexture = textureLoader.load("/World_elevation_map.png");
    landTexture.colorSpace = THREE.NoColorSpace;
    heightTexture.colorSpace = THREE.NoColorSpace;

    const globeRadius = 2.05;
    const geometry = new THREE.SphereGeometry(globeRadius, 128, 128);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLandTexture: { value: landTexture },
        uHeightTexture: { value: heightTexture },
        opacity: { value: 0.94 },
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
    sceneGroup.add(globe);

    const networkLayer = new PopulationNetworkLayer(globeRadius);
    globe.add(networkLayer.group);
    void networkLayer.init();

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const pointLight = new THREE.PointLight(0xffffff, 40, 0, 2);
    pointLight.position.set(0, 0, 5.25);
    scene.add(pointLight);

    const targetQuaternion = new THREE.Quaternion();
    const focusVector = new THREE.Vector3();
    const tickManager = new TickManager();

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const render = (data: TickData) => {
      const deltaSeconds = Math.max(data.timeDiff, 0) * 0.001;
      const activePoi = LANDING_POIS.find((poi) => poi.path === activePoiPathRef.current) ?? null;
      const focusAlpha = 1.0 - Math.exp(-4.5 * deltaSeconds);

      material.uniforms.uTime.value = data.timestamp * 0.001;

      if (activePoi) {
        focusVector.copy(latLngToVector3(activePoi.lat, activePoi.lng, 1)).normalize();
        targetQuaternion.setFromUnitVectors(focusVector, FRONT_VECTOR);
        sceneGroup.quaternion.slerp(targetQuaternion, focusAlpha);
      } else {
        sceneGroup.rotation.y += deltaSeconds * 0.18;
      }

      networkLayer.update(
        {
          camera,
          globe,
          projectionBlend: 0,
          timestampMs: data.timestamp,
        },
        deltaSeconds,
      );

      renderer.render(scene, camera);
    };

    resize();
    window.addEventListener("resize", resize);
    tickManager.startLoop(render);

    return () => {
      window.removeEventListener("resize", resize);
      tickManager.stopLoop();
      networkLayer.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
