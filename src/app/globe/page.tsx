"use client";

import ThreeCanvas from "@/lib/three/ThreeCanvas";

export default function SimThreePage() {
  return (
    <main className="relative h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute left-0 top-0 z-10 p-4">
      </div>
      <ThreeCanvas />
    </main>
  );
}
