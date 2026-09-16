import Link from "next/link";

import AsciiPanel from "@/lib/ascii/AsciiPanel";
import GlobeCanvas from "@/lib/three/GlobeCanvas";

import Dateline from "./Dateline";
import type { Edition } from "./editions";

/**
 * Placeholder column entries. Each slot becomes a real project; for now the
 * figure is an animated ASCII field so the page has the right density and
 * rhythm to judge the layout against.
 */
const LEFT_SLOTS = [
  {
    field: "terrain" as const,
    label: "Fig. 2",
    title: "Slot 01",
    caption: "Contour bands drifting through a noise field.",
  },
  {
    field: "lattice" as const,
    label: "Fig. 3",
    title: "Slot 02",
    caption: "A lattice breathing on a slow diagonal.",
  },
];

const RIGHT_SLOTS = [
  {
    field: "sphere" as const,
    label: "Fig. 4",
    title: "Slot 03",
    caption: "Shaded sphere, wireframe terminator sweeping west.",
  },
  {
    field: "flow" as const,
    label: "Fig. 5",
    title: "Slot 04",
    caption: "Advected noise; two sine layers warped against each other.",
  },
];

const INDEX_ENTRIES = [
  ["01", "Globe", "Three.js · GLSL"],
  ["02", "Mesh network", "Spatial hash · sim"],
  ["03", "Field bake", "Python · WebP"],
  ["04", "—", "Reserved"],
  ["05", "—", "Reserved"],
];

function Slot({
  edition,
  slot,
}: {
  edition: Edition;
  slot: { field: "terrain" | "flow" | "sphere" | "lattice"; label: string; title: string; caption: string };
}) {
  return (
    <figure className="border-t border-rule pt-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className={edition.label}>{slot.label}</span>
        <span className={edition.label}>{slot.title}</span>
      </div>
      <div className="flex justify-center overflow-hidden bg-ink-raised px-2 py-3">
        <AsciiPanel field={slot.field} cols={30} rows={18} />
      </div>
      <figcaption className={`${edition.caption} mt-2`}>{slot.caption}</figcaption>
    </figure>
  );
}

export default function FrontPage({ edition }: { edition: Edition }) {
  const other = edition.id === "a" ? "/b" : "/";
  const otherName = edition.id === "a" ? "Edition B" : "Edition A";

  return (
    <main className="grain min-h-screen bg-ink px-4 pb-16 pt-6 sm:px-8">
      <div className="mx-auto max-w-[1580px]">
        {/* ---- Dateline strip ---------------------------------------- */}
        <div
          className={`${edition.label} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y border-rule py-2`}
        >
          <span>Vol. I · No. 1</span>
          <Dateline />
          <span>{edition.name}</span>
        </div>

        {/* ---- Masthead --------------------------------------------- */}
        <header className="pt-8 text-center sm:pt-10">
          <h1 className={edition.masthead}>Avi Yadava</h1>
          <div
            className={`mx-auto mt-6 max-w-3xl border-t ${edition.mastheadRule} pt-3`}
          >
            <p className={edition.tagline}>
              Interactive Systems · Graphics · Software
            </p>
          </div>
        </header>

        <div className="rule-double mt-7" />

        {/* ---- Three-column well ------------------------------------ */}
        <div className="grid grid-cols-1 gap-8 pt-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_minmax(0,1fr)] lg:gap-0">
          {/* Left column */}
          <aside className="order-2 space-y-7 lg:order-none lg:pr-7">
            <h2 className={`${edition.sectionHead} border-b border-rule-strong pb-2`}>
              Dispatches
            </h2>
            {LEFT_SLOTS.map((slot) => (
              <Slot key={slot.title} edition={edition} slot={slot} />
            ))}
          </aside>

          {/* Centre well */}
          <section className="order-1 lg:order-none lg:border-x lg:border-rule lg:px-8">
            <p className={`${edition.kicker} mb-3`}>The Lead</p>
            <h2 className={edition.headline}>
              A Personal Atlas, Compiled In Real Time
            </h2>
            <p className={`${edition.deck} mt-4 max-w-2xl`}>
              Twenty-six hundred nodes, four thousand links and a camera that
              refuses to commit to perspective.
            </p>

            <div className="mt-6 border-y border-rule-strong py-4">
              <div className="aspect-[5/4] w-full">
                <GlobeCanvas />
              </div>
            </div>

            <p className={`${edition.caption} mt-3`}>
              Fig. 1 — Elevation contours read from a baked 2048×1024 field
              texture; the mesh re-solves every 220 ms. Drag to orbit, scroll to
              bend the projection between perspective and orthographic, space to
              halt rotation.
            </p>

            {/* Body copy, set in columns to finish the broadsheet read */}
            <div className="mt-7 border-t border-rule pt-5">
              <div className={`${edition.body} columns-1 gap-7 sm:columns-2`}>
                <p className="drop-cap mb-3">
                  The globe is the oldest thing in this repository and the only
                  one that survived the last cleanup. It began as a sphere with
                  a heightmap bolted on, acquired a camera that blends between
                  two projections, and then grew a mesh network across its
                  surface that nobody asked for.
                </p>
                <p className="mb-3">
                  Everything else here is placeholder. The columns flanking this
                  one will hold work — projects, writing, the occasional thing
                  that refuses to be either. For now they hold ASCII fields,
                  which at least have the courtesy to move.
                </p>
                <p className="mb-3">
                  The layout borrows its bones from a broadsheet: a masthead
                  that commits, rules that actually separate things, and a lead
                  well wide enough to be worth looking at. The reasoning is that
                  a newspaper page has to solve the same problem a portfolio
                  does — many unequal things, one surface, one glance.
                </p>
                <p>
                  What it is not is a newspaper. There is no ink, the headline
                  does not stay still, and the lead art spins. Consider that the
                  point.
                </p>
              </div>
            </div>
          </section>

          {/* Right column */}
          <aside className="order-3 space-y-7 lg:order-none lg:pl-7">
            <h2 className={`${edition.sectionHead} border-b border-rule-strong pb-2`}>
              The Index
            </h2>

            <ul className="space-y-0 border-t border-rule">
              {INDEX_ENTRIES.map(([n, title, meta]) => (
                <li
                  key={n}
                  className="flex items-baseline justify-between gap-3 border-b border-rule py-2"
                >
                  <span className={edition.label}>{n}</span>
                  <span className={`${edition.body} flex-1 text-paper`}>{title}</span>
                  <span className={edition.label}>{meta}</span>
                </li>
              ))}
            </ul>

            {RIGHT_SLOTS.map((slot) => (
              <Slot key={slot.title} edition={edition} slot={slot} />
            ))}
          </aside>
        </div>

        {/* ---- Footer ------------------------------------------------ */}
        <footer className="mt-14">
          <div className="rule-double" />
          <div
            className={`${edition.label} flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-3`}
          >
            <span>© 2026 Avi Yadava</span>
            <span>{edition.colophon}</span>
            <Link
              href={other}
              className="border-b border-paper-faint pb-px text-paper transition-colors hover:border-accent hover:text-accent"
            >
              Compare → {otherName}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
