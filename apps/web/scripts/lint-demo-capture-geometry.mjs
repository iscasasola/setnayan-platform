#!/usr/bin/env node
/**
 * lint-demo-capture-geometry — the capture viewport, the video size and the
 * reel's zoom are ONE measurement. This fails if they stop agreeing.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Every looping clip under `public/add-ons/demo/` shipped THREE QUARTERS EMPTY
 * for an unknown length of time. The recorder was given a 230×486 viewport and
 * asked for a 460×972 video, and Playwright's contract is explicit that it
 * only ever scales a page **down**: "Actual picture of each page will be
 * scaled down if necessary to fit the specified size." So each frame was
 * composited 1:1 into the top-left corner of a larger canvas and the rest was
 * padded flat grey.
 *
 * 🔑 IT WAS INVISIBLE BECAUSE NOTHING LOOKED. The files existed, were the right
 * dimensions, played, looped, and weighed the documented ~50 KB. Every check
 * anyone would think to write passed. It was found only by drawing a frame to
 * a canvas and scanning a row of pixels — content ended at x=229 of 460 — and
 * the deployed `papic.mp4` was byte-identical to the repo's, so `/papic`'s own
 * "this is all of it" section had been showing mostly nothing.
 *
 * ─── WHY THIS GUARD IS SOURCE-LEVEL AND NOT PIXEL-LEVEL ───────────────────
 * The honest check is "decode a frame and confirm content spans the full
 * width", and that needs ffmpeg — which the README itself says is NOT present
 * by default (Playwright's bundled build is VP8-only, so regeneration requires
 * pointing FFMPEG_BIN at a real libx264 binary). A required CI step that needs
 * a binary CI does not have is a step that gets skipped or deleted.
 *
 * So this guards the CAUSE instead of the symptom: the three numbers that must
 * agree. That is a real mechanism — the defect was a viewport smaller than the
 * frame it was recorded into, and this makes that state unshippable.
 *
 * ⚠ WHAT IT CANNOT SEE: whether the clips currently ON DISK were captured with
 * the correct geometry. Regenerating is a manual step (see the folder README).
 * If you change these numbers, RE-RECORD — this guard will happily pass while
 * stale assets sit beside it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'capture-demo-videos.mjs');
const REEL = join(HERE, '..', 'app', 'demo-capture', '[slug]', 'reel.tsx');

const fail = (msg) => {
  console.error(`\n✖ demo-capture geometry\n\n${msg}\n`);
  process.exit(1);
};

const script = readFileSync(SCRIPT, 'utf8');
const reel = readFileSync(REEL, 'utf8');

const viewport = script.match(/viewport:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
const size = script.match(/recordVideo:[^}]*size:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
if (!viewport) fail('Could not find the capture `viewport` in capture-demo-videos.mjs.');
if (!size) fail('Could not find `recordVideo.size` in capture-demo-videos.mjs.');

const [vw, vh] = [Number(viewport[1]), Number(viewport[2])];
const [sw, sh] = [Number(size[1]), Number(size[2])];

// ── 1 · The recorder can only scale DOWN. A viewport smaller than the video
//        size is the exact bug: the frame gets padded, not enlarged.
if (vw < sw || vh < sh) {
  fail(
    `The capture viewport (${vw}×${vh}) is SMALLER than the recorded video ` +
      `(${sw}×${sh}).\n\n` +
      'Playwright only ever scales a page DOWN to fit `recordVideo.size`, so\n' +
      'every frame will be composited into the top-left corner of a larger\n' +
      'canvas and the rest padded flat. That is exactly how every demo clip\n' +
      'shipped three quarters empty.\n\n' +
      'Make the viewport at least the video size, and zoom the reel stage to\n' +
      'fill it (see `zoom` in app/demo-capture/[slug]/reel.tsx).',
  );
}

// ── 2 · The stage must actually FILL that viewport, or the padding just moves
//        from the recorder into the page.
const stage = reel.match(/\.reel\{[^}]*width:\s*(\d+)px;\s*height:\s*(\d+)px;/);
if (!stage) fail('Could not find the `.reel` stage size in reel.tsx.');
const zoom = reel.match(/\.reel\{[^}]*zoom:\s*([\d.]+)/s);
const z = zoom ? Number(zoom[1]) : 1;
const [rw, rh] = [Number(stage[1]) * z, Number(stage[2]) * z];

if (rw !== vw || rh !== vh) {
  fail(
    `The reel stage renders ${rw}×${rh} (${stage[1]}×${stage[2]} at zoom ${z}) ` +
      `but the capture viewport is ${vw}×${vh}.\n\n` +
      'The stage must fill the viewport exactly, or the recording carries dead\n' +
      'space around it — the same defect, moved from the recorder into the page.\n\n' +
      'These three are ONE measurement: the viewport, recordVideo.size, and the\n' +
      "reel's zoom. Change one, change all three — and RE-RECORD the clips\n" +
      '(public/add-ons/demo/README.md), because this guard cannot see stale assets.',
  );
}

console.log(
  `✓ demo-capture geometry — stage ${stage[1]}×${stage[2]} @${z} = viewport ${vw}×${vh} = video ${sw}×${sh}`,
);
