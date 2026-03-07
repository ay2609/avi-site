"use client";

import ThreeCanvas from "@/lib/three/ThreeCanvas";

export default function SimThreePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="p-4">
        <h1 className="text-xl tracking-wide">Three.js Sim</h1>
        <p className="text-sm opacity-70">
          Vanilla Three.js scene inside Next.js (App Router).
        </p>
      </div>
      <ThreeCanvas />
    </main>
  );
}