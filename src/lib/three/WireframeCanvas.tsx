"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { TickManager, type TickData } from "@/lib/render/tick-manager";

const VIEW = {
  /** Orthographic half-height. The model is normalised to a longest axis of 1. */
  frustum: 0.54,
  /** Fixed tilt, so the part reads as a solid rather than a flat outline. */
  tiltX: -0.62,
  /** Turntable speed, radians per second. */
  spin: 0.28,
  color: 0xfafafa,
  opacity: 0.62,
} as const;

interface WireframeCanvasProps {
  /** A Float32 blob of xyz triplets; consecutive pairs form one segment. */
  src: string;
}

/**
 * Renders a line-segment wireframe on a turntable. The data comes from
 * scripts/step-to-wireframe.py, which reads a STEP file's edge topology
 * directly — there is no CAD kernel in the browser, and none is needed for a
 * technical drawing.
 */
export default function WireframeCanvas({ src }: WireframeCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    host.appendChild(renderer.domElement);

    // Turntable: the tilt is fixed on the inner group, the spin is applied
    // about world up on the outer one.
    const spinner = new THREE.Group();
    const tilter = new THREE.Group();
    tilter.rotation.x = VIEW.tiltX;
    spinner.add(tilter);
    scene.add(spinner);

    const material = new THREE.LineBasicMaterial({
      color: VIEW.color,
      transparent: true,
      opacity: VIEW.opacity,
    });
    let geometry: THREE.BufferGeometry | null = null;
    let lines: THREE.LineSegments | null = null;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      camera.left = -VIEW.frustum * aspect;
      camera.right = VIEW.frustum * aspect;
      camera.top = VIEW.frustum;
      camera.bottom = -VIEW.frustum;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const tickManager = new TickManager();
    let disposed = false;

    const render = (data: TickData) => {
      if (!reduceMotion) {
        spinner.rotation.y += VIEW.spin * Math.max(data.timeDiff, 0) * 0.001;
      }
      renderer.render(scene, camera);
    };

    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (disposed) return;
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(buffer), 3)
        );
        lines = new THREE.LineSegments(geometry, material);
        tilter.add(lines);
        tickManager.startLoop(render);
      })
      .catch(() => {
        /* aborted on unmount, or the asset is missing — leave the box empty */
      });

    return () => {
      disposed = true;
      controller.abort();
      tickManager.stopLoop();
      resizeObserver.disconnect();
      geometry?.dispose();
      material.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [src]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
