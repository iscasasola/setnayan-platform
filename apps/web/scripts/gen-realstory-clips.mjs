#!/usr/bin/env node
// ============================================================================
// gen-realstory-clips.mjs — Ken Burns 5s clips for the Real Stories showcase
// ============================================================================
//
// Bakes gentle 5-second Ken Burns MP4s from the EXISTING sample stills in
// public/realstories/, for the "As the Day Unfolded" living chapters on the two
// showcase editions (Maria & Juan · Sofia Reyes). No AI imagery — one still in,
// one slow-motion clip out.
//
// ⚠ zoompan gotcha (this repo's history): zoompan emits `d` frames PER INPUT
// FRAME. Feed it a SINGLE still (NOT `-loop 1 -t 5`) or you get a 275MB monster
// (one 5s clip per input frame). One image input → d=120 → exactly 120 frames.
//
// Output: 5s · 24fps · 720p-class · H.264 yuv420p · +faststart · NO audio.
// Target ≤1.2MB/clip. Run from apps/web:  node scripts/gen-realstory-clips.mjs
// ============================================================================

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, '..', 'public', 'realstories');
const OUT_DIR = join(SRC_DIR, 'clips');

const FPS = 24;
const SECS = 5;
const FRAMES = FPS * SECS; // 120
// Landscape 720p-class canvas for the zoompan super-sample, downscaled to the
// output. zoompan works on an up-scaled frame so the gentle zoom stays crisp.
const OUT_W = 1280;
const OUT_H = 720;
const SS = 4; // super-sample factor for the zoompan working canvas

// Each entry: source still + a motion. Motions are gentle (≤1.12 zoom / slow
// pan) so the clip reads as a living photograph, never a zoom stunt.
//  - zoom-in:   1.00 → 1.12 centered
//  - pan-left:  slow horizontal drift at a slight zoom
//  - pan-up:    slow vertical drift at a slight zoom
//  - zoom-slow: 1.00 → 1.08 (very gentle, for the calmer moments)
const CLIPS = [
  // Maria & Juan (wedding) — 4 clips
  { name: 'mj-garden-march', src: 'maria-juan-tagaytay.jpg', motion: 'zoom-in' },
  { name: 'mj-the-vows', src: 'maria-juan-g1.jpg', motion: 'zoom-slow' },
  { name: 'mj-first-dance', src: 'maria-juan-g2.jpg', motion: 'pan-left' },
  { name: 'mj-money-dance', src: 'maria-juan-g3.jpg', motion: 'zoom-in' },
  // Sofia Reyes (debut) — 2 clips (only one still exists → two distinct motions)
  { name: 'sofia-staircase', src: 'sofia-reyes-makati.jpg', motion: 'zoom-in' },
  { name: 'sofia-last-dance', src: 'sofia-reyes-makati.jpg', motion: 'pan-left' },
];

// Build the zoompan expression for a motion. `on` is the output-frame index,
// 0..FRAMES-1. We drive z/x/y off `on/(FRAMES-1)` so the motion completes over
// exactly the 5 seconds and starts/ends still.
function zoompanVf(motion) {
  const T = `(on/${FRAMES - 1})`; // 0 → 1 across the clip
  const base = `scale=${OUT_W * SS}:${OUT_H * SS}:force_original_aspect_ratio=increase,crop=${OUT_W * SS}:${OUT_H * SS}`;
  let z, x, y;
  switch (motion) {
    case 'zoom-in':
      z = `1.00+0.12*${T}`;
      x = `iw/2-(iw/zoom/2)`;
      y = `ih/2-(ih/zoom/2)`;
      break;
    case 'zoom-slow':
      z = `1.00+0.08*${T}`;
      x = `iw/2-(iw/zoom/2)`;
      y = `ih/2-(ih/zoom/2)`;
      break;
    case 'pan-left':
      // hold a gentle zoom, drift the crop window left→right slightly
      z = `1.10`;
      x = `(iw-iw/zoom)*(0.15+0.35*${T})`;
      y = `ih/2-(ih/zoom/2)`;
      break;
    case 'pan-up':
      z = `1.10`;
      x = `iw/2-(iw/zoom/2)`;
      y = `(ih-ih/zoom)*(0.55-0.35*${T})`;
      break;
    default:
      z = `1.00`;
      x = `iw/2-(iw/zoom/2)`;
      y = `ih/2-(ih/zoom/2)`;
  }
  const zp = `zoompan=z='${z}':x='${x}':y='${y}':d=${FRAMES}:s=${OUT_W}x${OUT_H}:fps=${FPS}`;
  // scale=out_range=tv normalizes the JPEG full-range (yuvj420p) source down to
  // limited-range yuv420p so the H.264 pixfmt is the standard yuv420p (not yuvj).
  return `${base},${zp},scale=out_range=tv,format=yuv420p`;
}

function ffmpegOk() {
  try {
    execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function make(clip) {
  const srcPath = join(SRC_DIR, clip.src);
  const outPath = join(OUT_DIR, `${clip.name}.mp4`);
  // SINGLE image input — NO -loop 1 -t 5. zoompan d=FRAMES makes the duration.
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-i', srcPath,
      '-an',
      '-vf', zoompanVf(clip.motion),
      '-frames:v', String(FRAMES),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      outPath,
    ],
    { stdio: 'ignore' },
  );
  const kb = Math.round(statSync(outPath).size / 1024);
  console.log(`  ✓ ${clip.name}.mp4  ${kb}KB  (${clip.src} · ${clip.motion})`);
  return statSync(outPath).size;
}

function main() {
  if (!ffmpegOk()) {
    console.error(`ffmpeg not runnable at "${FFMPEG}". Set FFMPEG_BIN.`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  for (const c of CLIPS) total += make(c);
  console.log(`\nDone. ${CLIPS.length} clips · ${(total / 1024 / 1024).toFixed(2)}MB total.`);
}

main();
