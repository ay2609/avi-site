"use client";

import WebGLSimCanvas from "@/lib/webgl/WebGLSimCanvas";

export default function SimWebGLPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="p-4">
        <h1 className="text-xl tracking-wide">WebGL2 Sim (raw)</h1>
        <p className="text-sm opacity-70">
          Pure WebGL2 render loop (no Three.js). Resize the window and it should stay crisp.
        </p>
      </div>
      <WebGLSimCanvas />
    </main>
  );
}