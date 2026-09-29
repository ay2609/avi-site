"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { TickManager, type TickData } from "@/lib/render/tick-manager";

const VIEW = {
  /**
   * Orthographic half-height. The model is normalised to a longest axis of 1,
   * so on the diagonal it spans ~1.32; 0.8 leaves it a little air top and bottom.
   */
  frustum: 0.8,
  /** Fixed lean-back, in radians: a slight 8°, enough to read as a solid. */
  tiltX: -(8 * Math.PI) / 180,
  /** Roll the part in its own plane so its diagonal stands vertical. */
  diagonal: true,
  /** Turntable speed, radians per second; negative spins clockwise seen from above. */
  spin: -1,
  /** Feature edges are drawn where adjacent faces meet at more than this angle. */
  edgeAngle: 24,
  ink: 0x0a0a0b,
  bone: 0xfafafa,
  edgeOpacity: 0.62,
} as const;

interface SolidCanvasProps {
  /** A mesh packed by scripts/stl-to-mesh.py. */
  src: string;
}

/** Decode the AVIM format written by scripts/stl-to-mesh.py. */
function decode(buffer: ArrayBuffer): THREE.BufferGeometry {
  const view = new DataView(buffer);
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== "AVIM") {
    throw new Error("not an AVIM mesh");
  }
  const vertexCount = view.getUint32(4, true);
  const indexCount = view.getUint32(8, true);
  const indexBytes = view.getUint32(12, true);
  const scale = [view.getFloat32(16, true), view.getFloat32(20, true), view.getFloat32(24, true)];
  let off = 28;
  const q = new Int16Array(buffer, off, vertexCount * 3);
  off += vertexCount * 6;
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount * 3; i++) positions[i] = (q[i] / 32767) * scale[i % 3];
  const indices =
    indexBytes === 2
      ? new Uint16Array(buffer, off, indexCount)
      : new Uint32Array(buffer, off, indexCount);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/**
 * A solid on a turntable, drawn as a technical illustration: ink-filled faces
 * that occlude, with the feature edges in bone on top. The faces are there
 * to hide lines, not to be seen, so there is no lighting.
 */
export default function SolidCanvas({ src }: SolidCanvasProps) {
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

    // Turntable: tilt fixed on the inner group, spin about world up on the outer.
    const spinner = new THREE.Group();
    const tilter = new THREE.Group();
    tilter.rotation.x = VIEW.tiltX;
    spinner.add(tilter);
    scene.add(spinner);

    // Faces sit a hair behind the lines so edges never z-fight with them.
    const faceMaterial = new THREE.MeshBasicMaterial({
      color: VIEW.ink,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: VIEW.bone,
      transparent: true,
      opacity: VIEW.edgeOpacity,
    });
    const part = new THREE.Group();
    tilter.add(part);
    let geometry: THREE.BufferGeometry | null = null;
    let edges: THREE.EdgesGeometry | null = null;

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

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tickManager = new TickManager();
    let disposed = false;

    const render = (data: TickData) => {
      if (!reduceMotion) spinner.rotation.y += VIEW.spin * Math.max(data.timeDiff, 0) * 0.001;
      renderer.render(scene, camera);
    };

    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        if (disposed) return;
        geometry = decode(buffer);
        edges = new THREE.EdgesGeometry(geometry, VIEW.edgeAngle);
        part.add(new THREE.Mesh(geometry, faceMaterial));
        part.add(new THREE.LineSegments(edges, edgeMaterial));
        if (VIEW.diagonal) {
          // For a w × h rectangle, corner (w/2, h/2) lands on x = 0 after a
          // counter-clockwise roll of atan(w / h).
          geometry.computeBoundingBox();
          const size = new THREE.Vector3();
          geometry.boundingBox!.getSize(size);
          part.rotation.z = Math.atan2(size.x, size.y);
        }
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
      edges?.dispose();
      faceMaterial.dispose();
      edgeMaterial.dispose();
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
