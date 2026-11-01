#!/usr/bin/env node
/**
 * The fractals' contact sheet: every preset's picture, shot from the running
 * site in dark mode (the page inverts them for light, as it does the pictures),
 * into one image, public/fractal-thumbs.jpg. The order and the row length are
 * THUMBS in src/lib/fractals/chapters.ts. Re-run it when a preset changes.
 *
 *   npm run build, serve it, then, with Playwright resolvable and ffmpeg installed:
 *   node scripts/fractal-thumbs.mjs http://127.0.0.1:8787
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2] ?? "http://127.0.0.1:8787";
const ACROSS = 8;
const SIDE = 128;
const SETTLE = 2500;

const dir = mkdtempSync(join(tmpdir(), "fractal-thumbs-"));
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
await page.addInitScript(() => localStorage.setItem("avi-site:theme", "dark"));
await page.goto(`${base}/fractals`, { waitUntil: "networkidle" });
await page.waitForTimeout(SETTLE);

const layer = page.locator('[data-layer="fractals"]');
let n = 0;
for (const chapter of [1, 2]) {
  await page.keyboard.press(String(chapter));
  await page.waitForTimeout(SETTLE);
  const tiles = layer.locator('[data-deck] ol[aria-label] button');
  const count = await tiles.count();
  for (let k = 0; k < count; k++) {
    await tiles.nth(k).click();
    await page.waitForTimeout(SETTLE);
    // The picture alone: its canvases, with what sits over them hidden.
    await layer.locator(".fit").evaluate((el) => (el.style.visibility = "hidden"));
    await layer.locator("canvas").first().locator("..").screenshot({ path: join(dir, `${String(n++).padStart(2, "0")}.png`) });
    await layer.locator(".fit").evaluate((el) => (el.style.visibility = "visible"));
  }
}
await browser.close();

execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-pattern_type", "glob", "-i", join(dir, "*.png"),
  "-vf", `scale=${SIDE}:${SIDE}:flags=lanczos,tile=${ACROSS}x${Math.ceil(n / ACROSS)}`,
  "-frames:v", "1", "-q:v", "4", "public/fractal-thumbs.jpg",
]);
rmSync(dir, { recursive: true });
console.log(`${n} pictures in public/fractal-thumbs.jpg`);
