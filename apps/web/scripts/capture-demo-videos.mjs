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
import { mkdtempSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'add-ons', 'demo');
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000';
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';

// Mirror of RICH_DEMO_SLUGS (studio-card-demo.tsx) — the 14 features with scenes.
const ALL_SLUGS = [
  'papic', 'save-the-date', 'animated-monogram', 'mood-board', 'custom-qr-guest',
  'photo-delivery', 'patiktok', 'led', 'indoor-blueprint', 'setnayan-ai',
  'landing-page', 'music-creator', 'pakanta', 'playlist',
];

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
