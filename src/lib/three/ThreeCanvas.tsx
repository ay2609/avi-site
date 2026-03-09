"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { useRouter } from "next/navigation";

import vertexShader from "@/lib/shaders/globe/positionColor.vert";
import fragmentShader from "@/lib/shaders/globe/positionColor.frag";
import { TickManager, type TickData } from "@/lib/render/tick-manager";

interface POI {
  name: string;
  path: string;
  lat: number;
  lng: number;
  element?: HTMLDivElement;
  object?: CSS2DObject;
}

const POI_DATA: POI[] = [
  { name: "ASCII", path: "/ascii", lat: 20, lng: 0 },
  { name: "BLACK HOLE", path: "/blackhole", lat: -30, lng: 60 },
  { name: "FRACTALS", path: "/fractals", lat: 45, lng: -120 },
  { name: "ISOLINES", path: "/isolines", lat: -10, lng: -40 },
  { name: "GLOBE", path: "/globe", lat: 60, lng: 150 },
];

const TOPOGRAPHY_CONFIG = {
  intervalCount: 20, // Number of contour bands across normalized elevation range.
  phaseSpeed: 0.04, // How fast contours drift through elevations.
  lineWidth: 1.1, // Multiplier for contour anti-alias width.
  lineBias: 0.0006, // Base contour softness.
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

    const camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    // --- CSS2D Renderer for Labels ---
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(host.clientWidth, host.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    host.appendChild(labelRenderer.domElement);


    // --- Globe ---
    const textureLoader = new THREE.TextureLoader();
    const landTexture = textureLoader.load("/water_16k.png");
    const heightTexture = textureLoader.load("/World_elevation_map.png");

    landTexture.colorSpace = THREE.NoColorSpace;
    heightTexture.colorSpace = THREE.NoColorSpace;


    const globeRadius = 2;
    const geometry = new THREE.SphereGeometry(globeRadius, 32, 32);
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
      },
      transparent: true,
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // --- Lights (camera-following) ---
    const ambient = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambient);

    const mainLight = new THREE.PointLight(0xffffff, 90, 0, 2);
    camera.add(mainLight);
    scene.add(camera);

    // --- Points of Interest ---
    const pois = POI_DATA.map(poi => {
      const phi = (90 - poi.lat) * (Math.PI / 180);
      const theta = (poi.lng + 180) * (Math.PI / 180);

      const x = -(globeRadius * Math.sin(phi) * Math.cos(theta));
      const z = globeRadius * Math.sin(phi) * Math.sin(theta);
      const y = globeRadius * Math.cos(phi);

      const div = document.createElement('div');
      div.className = 'poi-label';
      div.innerHTML = `
        <div class="flex flex-col items-center group cursor-pointer pointer-events-auto">
          <div class="w-2 h-2 bg-cyan-400 rounded-full mb-1 shadow-[0_0_10px_#22d3ee]"></div>
          <div class="px-2 py-1 bg-black/80 border border-cyan-500/50 backdrop-blur-sm text-[10px] text-cyan-400 tracking-[0.2em] uppercase font-mono transition-all group-hover:bg-cyan-500 group-hover:text-black">
            ${poi.name}
          </div>
        </div>
      `;
      
      div.onclick = () => {
        router.push(poi.path);
      };

      const label = new CSS2DObject(div);
      label.position.set(x, y, z);
      globe.add(label);

      return { ...poi, element: div, object: label };
    });

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = true;
    controls.autoRotate = false; // We'll handle rotation ourselves for smoother control

    // --- State for Animation ---
    const autoSpinSpeed = 0.002;
    let currentSpinSpeed = autoSpinSpeed;
    let isUserInteracting = false;
    let lastInteractionTime = 0;

    controls.addEventListener('start', () => {
      isUserInteracting = true;
    });

    controls.addEventListener("end", () => {
      isUserInteracting = false;
      lastInteractionTime = performance.now();
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    };

    window.addEventListener("resize", resize);

    const tickManager = new TickManager();
    const render = (data: TickData) => {
      const now = data.timestamp;
      material.uniforms.uTime.value = now * 0.001;

      // Handle Auto-Spin Acceleration
      if (!isUserInteracting) {
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

      // Update POI visibility (closest few)
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);

      const poiDistances = pois.map((poi) => {
        const worldPos = new THREE.Vector3();
        poi.object?.getWorldPosition(worldPos);
        const dist = worldPos.distanceTo(cameraPosition);
        const dot = worldPos.normalize().dot(cameraPosition.clone().normalize());
        return { poi, dist, visible: dot > 0.2 };
      });

      poiDistances.sort((a, b) => a.dist - b.dist);

      poiDistances.forEach((item, index) => {
        if (item.visible && index < 3) {
          item.poi.element!.style.opacity = "1";
          item.poi.element!.style.pointerEvents = "auto";
        } else {
          item.poi.element!.style.opacity = "0";
          item.poi.element!.style.pointerEvents = "none";
        }
      });

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    tickManager.startLoop(render);

    return () => {
      window.removeEventListener("resize", resize);
      tickManager.stopLoop();
      controls.dispose();
      renderer.dispose();
      labelRenderer.domElement.remove();
      host.removeChild(renderer.domElement);
    };
  }, [router]);

  return (
    <div className="relative h-[80vh] w-full overflow-hidden">
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
