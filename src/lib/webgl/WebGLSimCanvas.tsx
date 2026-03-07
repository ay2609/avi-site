"use client";

import { useEffect, useRef } from "react";

export default function WebGLSimCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    let raf = 0;

    const resize = () => {
      // Device-pixel-ratio aware sizing
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = (t: number) => {
      resize();

      // Placeholder: animated clear color (super basic sanity check)
      const s = 0.5 + 0.5 * Math.sin(t * 0.001);
      gl.clearColor(0.05 + 0.2 * s, 0.05, 0.05, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      raf = requestAnimationFrame(render);
    };

    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="w-full">
      {/* fixed height for now; later you’ll likely do full-screen */}
      <canvas ref={canvasRef} className="block h-[70vh] w-full" />
    </div>
  );
}