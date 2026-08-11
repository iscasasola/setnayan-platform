#!/usr/bin/env node
/**
 * capture-demo-videos.mjs — record each Studio feature's native on-card demo
 * scenes into a looping MP4 + poster JPG under public/add-ons/demo/.
 *
 * It drives the dev server's internal /demo-capture/[slug] route (which renders
 * the SAME RICH_SCENES the in-app card uses), so the video is always a faithful
 * recording of the live demo — never a hand-made mock that can drift.
 *
 * Pipeline: Playwright (chromium) records the reel as webm → ffmpeg transcodes
 * to H.264 MP4 (phase-aligned 12s loop) + Playwright screenshots the poster.
 *
 * ffmpeg: Playwright's bundled ffmpeg is VP8-only, so this needs a real ffmpeg
 * with libx264. Point FFMPEG_BIN at one (e.g. the `ffmpeg-static` npm binary)
 * or have `ffmpeg` on PATH. No new app dependency — this is out-of-tree tooling.
 *
 * Usage (from apps/web, with `pnpm dev` already running):
 *   FFMPEG_BIN=/path/to/ffmpeg node scripts/capture-demo-videos.mjs            # all slugs
 *   FFMPEG_BIN=/path/to/ffmpeg node scripts/capture-demo-videos.mjs papic      # one slug
 *   CAPTURE_BASE_URL=http://localhost:3001 node scripts/capture-demo-videos.mjs
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'add-ons', 'demo');
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000';
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';

// DERIVED from RICH_DEMO_SLUGS, never re-typed.
//
// 🔑 This was a HAND-TYPED MIRROR and it drifted the first time the real list
// changed. When the LED wall backdrop was removed on 2026-08-11, `'led'` stayed
// here as the 8th of 14 slugs. A slug with no scenes renders "unknown demo
// slug" and never sets `data-reel-ready`, so capture() blocks for its full
// 30s timeout and the unguarded loop aborts the process — leaving the SIX
// slugs after it silently never re-recorded, with the first seven already
// overwritten. A half-finished run that reports failure still leaves the
// cards playing stale footage for features nobody thinks were touched.
//
// Parsed out of the .ts source rather than imported because this is a plain
// .mjs script with no TypeScript loader. The file is a flat `as const` array
// of quoted slugs and exists precisely to be read by non-bundler consumers.
const SLUGS_SRC = readFileSync(
  join(__dirname, '..', 'app', '_components', 'app-store', 'rich-demo-slugs.ts'),
  'utf8',
);
const SLUGS_BLOCK = SLUGS_SRC.slice(
  SLUGS_SRC.indexOf('RICH_DEMO_SLUGS'),
  SLUGS_SRC.indexOf('] as const'),
).replace(/\/\/[^\n]*/g, ' '); // strip comments — a commented-out slug is not a slug
const ALL_SLUGS = (SLUGS_BLOCK.match(/'([a-z0-9-]+)'/g) || []).map((s) => s.slice(1, -1));
if (ALL_SLUGS.length === 0) {
  throw new Error(
    'capture-demo-videos: parsed 0 slugs from rich-demo-slugs.ts — did its shape change? ' +
      'Refusing to run rather than silently capturing nothing.',
  );
}

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ALL_SLUGS;

function ffmpegOk() {
  try {
    execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function capture(browser, slug) {
  const work = mkdtempSync(join(tmpdir(), `reel-${slug}-`));
  const context = await browser.newContext({
    viewport: { width: 230, height: 486 },
    deviceScaleFactor: 2,
    recordVideo: { dir: work, size: { width: 460, height: 972 } },
  });
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.goto(`${BASE}/demo-capture/${slug}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[data-reel-ready]', { timeout: 30000 });
    await page.waitForTimeout(700); // let scene 0 settle for the poster
    await page.screenshot({
      path: join(OUT_DIR, `${slug}.jpg`),
      type: 'jpeg',
      quality: 82,
    });
    await page.waitForTimeout(12700); // ~one 12s loop + the 0.5s seek headroom
  } finally {
    await context.close(); // flushes the webm
  }
  const webm = await video.path();

  // -ss 0.5 -t 12 trims a phase-aligned 12s window: the loop point lands 0.5s
  // into scene 0 at BOTH ends (12.5s = exactly one 12s period later), so it
  // loops seamlessly. fps 24 + crf 28 keeps the file small (UI footage).
  const mp4 = join(OUT_DIR, `${slug}.mp4`);
  execFileSync(
    FFMPEG,
    [
      '-y', '-ss', '0.5', '-i', webm, '-t', '12',
      '-an',
      '-vf', 'fps=24,scale=460:972:flags=lanczos',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      mp4,
    ],
    { stdio: 'ignore' },
  );
  rmSync(work, { recursive: true, force: true });

  const kb = (p) => Math.round(statSync(p).size / 1024);
  console.log(`  ✓ ${slug}: ${kb(mp4)}KB mp4 + ${kb(join(OUT_DIR, `${slug}.jpg`))}KB poster`);
}

async function main() {
  if (!ffmpegOk()) {
    console.error(
      `ffmpeg not runnable at "${FFMPEG}". Set FFMPEG_BIN to a libx264 build ` +
        `(e.g. \`node -e "console.log(require('ffmpeg-static'))"\`).`,
    );
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Capturing ${slugs.length} demo(s) from ${BASE} → ${OUT_DIR}`);
  const browser = await chromium.launch();
  try {
    for (const slug of slugs) {
      await capture(browser, slug);
    }
  } finally {
    await browser.close();
  }
  console.log('Done. Register the generated slugs in RICH_MEDIA (studio-card-demo.tsx).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
