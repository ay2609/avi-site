import GlobeCanvas from "@/lib/three/GlobeCanvas";

export default function Home() {
  return (
    <main className="relative h-screen w-full overflow-hidden bg-black text-white">
      <GlobeCanvas />
    </main>
  );
}
