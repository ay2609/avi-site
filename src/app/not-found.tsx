import type { Metadata } from "next";
import Link from "next/link";

import { advance, HIT, LABEL } from "@/components/furniture";

export const metadata: Metadata = { title: "Misprint — Avi Yadava" };

/**
 * The 404: a misprint. The front page's masthead and frame, with the name's
 * second ink left off register (`.misprint`, globals.css), and a line back to
 * the front page. No stage, no globe: just the sheet that came out wrong.
 */
export default function NotFound() {
  return (
    <main className="mx-auto min-h-screen border-x border-rule" style={{ width: "clamp(320px, 65.5vw, 1310px)" }}>
      <header className="fit border-b border-dashed border-rule px-4 pb-[18px] pt-[44px]">
        <div className={`${LABEL} flex items-baseline justify-between gap-x-6`}>
          <span>Error 404</span>
          <Link href="/" className={`${HIT} text-bone transition-colors hover:text-dim`}>
            Front page ↗
          </Link>
        </div>
        <h1
          data-ink="Avi Yadava"
          className="misprint font-serif-ui mt-3 whitespace-nowrap uppercase leading-[0.82] tracking-[-0.03em] text-bone"
          style={{ fontSize: `clamp(2.4rem, ${((0.92 * 100) / advance("Avi Yadava")).toFixed(1)}cqw, 18rem)` }}
        >
          Avi Yadava
        </h1>
      </header>
      <section className="fit border-b border-dashed border-rule px-4 pb-10 pt-4">
        <h2
          className="font-serif-ui mt-2 leading-[0.9] tracking-[-0.02em] text-bone"
          style={{ fontSize: "clamp(2.5rem, 9cqw, 5rem)" }}
        >
          Misprint.
        </h2>
        <p className="font-text-ui mt-6 max-w-[36rem] text-[1.125rem] leading-[1.6] text-bone">
          Nothing was printed at this address. The{" "}
          <Link
            href="/"
            className="underline decoration-dashed decoration-1 decoration-dim underline-offset-[0.22em] transition-colors hover:decoration-bone"
          >
            front page
          </Link>{" "}
          has everything in this edition.
        </p>
      </section>
    </main>
  );
}
