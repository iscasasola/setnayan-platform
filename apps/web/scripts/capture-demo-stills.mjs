#!/usr/bin/env node
/**
 * capture-demo-stills.mjs — photograph each Studio feature's native demo
 * scenes, one JPEG per scene, into public/add-ons/demo/stills/<slug>-<n>.jpg.
 *
 * WHY: the product pages' feature spotlights (`_components/marketing/
 * _spotlights.tsx`) show "one picture of the product" per idea. The picture is
 * the SAME scene the Studio card renders and `capture-demo-videos.mjs` records
 * — a frame of the real UI, never a drawn mock-up — so it cannot drift from the
 * product. A still, not the live React scene, because pulling the whole
 * client demo module into a static SEO page for one picture is JS weight
 * Lighthouse (a required check) would pay for.
 *
 * HOW: drives the internal `/demo-capture/[slug]?scene=N&plain=1` route
 * (dev/CI-only) — `scene` pins one frame, `plain` drops the caption strip (a
 * spotlight sets its own title). Same geometry as the recorder, and the same
 * three-numbers-are-one-measurement rule: viewport 460×972 · deviceScaleFactor
 * 2 · the reel's `zoom: 2`. `lint-demo-capture-geometry.mjs` guards it.
 *
 * SLUGS are DERIVED from rich-demo-slugs.ts, never re-typed (the video script's
 * lesson: a hand-typed list silently stopped recording the eighth product).
 *
 *   pnpm capture:stills                 # every slug, every scene
 *   pnpm capture:stills setnayan-ai     # one slug
 *
 * Needs the dev server up (default http://localhost:3000; override with BASE).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';

// 🔑 THE ONE COMMENT STRIPPER. Not a local regex — `lint-one-comment-stripper`
// forbids that, and the reason is specific: a naive two-replace strips BLOCK
// comments first, so a line comment containing `video/*` opens a comment that
// closes at the next real `*/` and blanks everything between, after which a
// guard asserts against a blank and passes.
import { stripComments } from './port-controls.mjs';

// The repo installs `@playwright/test`; a bare `playwright` may or may not be
// resolvable from apps/web depending on hoisting. Both export `chromium`.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('@playwright/test'));
}
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT_DIR = join(__dirname, '..', 'public', 'add-ons', 'demo', 'stills');

// Comments are stripped from the WHOLE file before the block is sliced: a
// retired slug lives on in that file as a `// 'led' removed …` comment, and a
// quoted word inside a comment is not a slug. (Measured: without this the
// recorder spent 30s timing out on `led`, a demo that has not existed since
// 2026-08-11.)
const SLUGS_SRC = stripComments(
  readFileSync(join(__dirname, '..', 'app', '_components', 'app-store', 'rich-demo-slugs.ts'), 'utf8'),
);
const SLUGS_BLOCK = SLUGS_SRC.slice(
  SLUGS_SRC.indexOf('RICH_DEMO_SLUGS'),
  SLUGS_SRC.indexOf('] as const'),
);
const ALL_SLUGS = (SLUGS_BLOCK.match(/'([a-z0-9-]+)'/g) || []).map((s) => s.slice(1, -1));
if (ALL_SLUGS.length === 0) {
  throw new Error(
    'capture-demo-stills: parsed 0 slugs from rich-demo-slugs.ts — did its shape change? ' +
      'Refusing to run rather than silently capturing nothing.',
  );
}
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ALL_SLUGS;

/**
 * How many scenes a slug has is READ FROM THE REEL (`data-reel-count`), never
 * typed here and never guessed from the pixels. The first version stopped at
 * the first byte-identical frame — and animated scenes never repeat a frame,
 * so Papic got eight "scenes" for four. The reel now states its count.
 */
async function loadScene(page, slug, n) {
  await page.goto(`${BASE}/demo-capture/${slug}?scene=${n}&plain=1`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  // A cold dev server compiles the route on first hit; the second attempt is
  // the real measurement. Retry ONCE rather than failing the whole run.
  try {
    await page.waitForSelector('[data-reel-ready]', { timeout: 30000 });
  } catch {
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[data-reel-ready]', { timeout: 30000 });
  }
  await page.waitForTimeout(700); // let the scene's own animation settle
  return page;
}

async function captureSlug(browser, slug) {
  const context = await browser.newContext({
    viewport: { width: 460, height: 972 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const written = [];
  try {
    await loadScene(page, slug, 0);
    const count = Number(await page.getAttribute('[data-reel-ready]', 'data-reel-count'));
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`${slug}: the reel reported no scenes (data-reel-count=${count})`);
    }
    for (let n = 0; n < count; n++) {
      if (n > 0) await loadScene(page, slug, n);
      const shown = Number(await page.getAttribute('[data-reel-ready]', 'data-reel-scene'));
      if (shown !== n) throw new Error(`${slug}: asked for scene ${n}, reel showed ${shown}`);
      const buf = await page.screenshot({ type: 'jpeg', quality: 82, scale: 'css' });
      const file = join(OUT_DIR, `${slug}-${n}.jpg`);
      writeFileSync(file, buf);
      written.push(file);
    }
    // A scene that was removed leaves a stale still behind; sweep anything
    // numbered past the reel's count so the folder always mirrors the scenes.
    for (let n = count; n < count + 16; n++) {
      const stale = join(OUT_DIR, `${slug}-${n}.jpg`);
      if (existsSync(stale)) rmSync(stale);
    }
  } finally {
    await context.close();
  }
  return written;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const failed = [];
  try {
    console.log(`Capturing stills for ${slugs.length} demo(s) from ${BASE} → ${OUT_DIR}`);
    for (const slug of slugs) {
      try {
        const files = await captureSlug(browser, slug);
        const kb = (f) => Math.round(readFileSync(f).length / 1024);
        console.log(`  ✓ ${slug}: ${files.length} scene(s) — ${files.map((f) => `${kb(f)}KB`).join(' · ')}`);
      } catch (e) {
        // One slug failing must not hide the rest — record it and go on, then
        // exit non-zero so nobody mistakes a partial run for a complete one.
        failed.push(slug);
        console.log(`  ✗ ${slug}: ${String(e).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failed.length) throw new Error(`stills not captured for: ${failed.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
