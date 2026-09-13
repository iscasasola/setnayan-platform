/**
 * S2 · draw-overlays.ts — the three named invariants, against a RECORDING canvas
 * context (same technique program-compositor.test.ts uses: the draw-call log is the
 * assertion, not a rasterised pixel).
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { EMPTY_FRAME } from '../panood-program-bridge';
import { stripComments } from '../strip-comments';
import { toWireFrame } from './program-plan';
import { LOWER_THIRD_BAR_COLOR, REFERENCE_LAYOUT } from './encoder-layout';
import {
  drawOverlays,
  shouldDrawOverlays,
  type OverlayCanvasContext,
  type OverlayImageCache,
} from './draw-overlays';
import type { ResolvedOverlays } from '../live-studio-overlays';

type Call = readonly unknown[];

function recordingCtx(): { ctx: OverlayCanvasContext; calls: Call[] } {
  const calls: Call[] = [];
  const ctx: OverlayCanvasContext = {
    save() {},
    restore() {},
    fillRect: (x, y, w, h) => calls.push(['fillRect', x, y, w, h, ctx.fillStyle]),
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    fill: () => calls.push(['fill', ctx.fillStyle]),
    stroke: () => calls.push(['stroke', ctx.strokeStyle]),
    fillText: (text, x, y) => calls.push(['fillText', text, x, y, ctx.fillStyle]),
    measureText: (text) => ({ width: text.length * 10 }),
    drawImage: (image, x, y, w, h) => calls.push(['drawImage', image, x, y, w, h]),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  return { ctx, calls };
}

function fillTextCalls(calls: Call[], text?: string): Call[] {
  return calls.filter((c) => c[0] === 'fillText' && (text === undefined || c[1] === text));
}

const NO_OVERLAYS: ResolvedOverlays = { monogram: null, lowerThird: null, eventQr: null };

/* ── INVARIANT 1 — lowerThird.forced always draws, in the locked colour ──────────── */

test('INVARIANT 1 — lowerThird !== null is drawn', () => {
  const { ctx, calls } = recordingCtx();
  const overlays: ResolvedOverlays = {
    ...NO_OVERLAYS,
    lowerThird: { title: 'THE SMITHS', subtitle: null, forced: false },
  };
  drawOverlays(ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '' });
  const titles = fillTextCalls(calls, 'THE SMITHS');
  assert.equal(titles.length, 1);
});

test('INVARIANT 1 — lowerThird.forced draws the title in the locked bar colour, never white', () => {
  const { ctx, calls } = recordingCtx();
  const overlays: ResolvedOverlays = {
    ...NO_OVERLAYS,
    lowerThird: { title: 'POWERED BY SETNAYAN', subtitle: 'Free live stream · setnayan.com', forced: true },
  };
  drawOverlays(ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '' });
  const titleCalls = fillTextCalls(calls, 'POWERED BY SETNAYAN');
  assert.equal(titleCalls.length, 1, 'the forced title is drawn exactly once');
  const call = titleCalls[0];
  assert.ok(call);
  const fillStyleAtDraw = call[4];
  assert.equal(fillStyleAtDraw, LOWER_THIRD_BAR_COLOR, 'forced ⇒ the locked colour, not the unforced white');
});

test('INVARIANT 1 — an empty title (paid, enabled, blank) falls back to the couple\'s monogram text, never an empty strip', () => {
  const { ctx, calls } = recordingCtx();
  const overlays: ResolvedOverlays = { ...NO_OVERLAYS, lowerThird: { title: '', subtitle: null, forced: false } };
  drawOverlays(ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: 'J & M' });
  assert.equal(fillTextCalls(calls, 'J & M').length, 1);
  assert.equal(fillTextCalls(calls, '').length, 0, 'never draws an empty string as the title');
});

/* ── INVARIANT 2 — no lib/encoder file may reference the decision functions ───────── */

test('INVARIANT 2 — lib/encoder never references resolveOverlays | canPublishMultiCam | decideWatermark', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  assert.ok(files.length > 5, 'sanity: the directory listing actually found the module files');
  const banned = /\b(resolveOverlays|canPublishMultiCam|decideWatermark)\b/;
  for (const f of files) {
    const stripped = stripComments(readFileSync(join(dir, f), 'utf8'));
    assert.doesNotMatch(stripped, banned, `${f} must not call resolveOverlays/canPublishMultiCam/decideWatermark`);
  }
});

/* ── INVARIANT 3 — nothing on program (EMPTY_FRAME) ⇒ no overlay drawn ────────────── */

test('INVARIANT 3 — shouldDrawOverlays(EMPTY_FRAME) is false; a real camera flips it true', () => {
  const emptyWire = toWireFrame(EMPTY_FRAME);
  assert.equal(emptyWire.hasStream, false);
  assert.equal(emptyWire.hasSecondaryStream, false);
  assert.equal(shouldDrawOverlays(emptyWire), false, 'nothing on program = nothing to brand');

  const liveWire = toWireFrame({ ...EMPTY_FRAME, source: 'cam1', stream: {} as MediaStream });
  assert.equal(shouldDrawOverlays(liveWire), true);

  const secondaryOnlyWire = toWireFrame({ ...EMPTY_FRAME, secondaryStream: {} as MediaStream });
  assert.equal(shouldDrawOverlays(secondaryOnlyWire), true);
});

test('INVARIANT 3 (wiring) — program-canvas.worker.ts actually gates the draw behind shouldDrawOverlays', () => {
  const src = stripComments(readFileSync(join(__dirname, 'program-canvas.worker.ts'), 'utf8'));
  assert.match(src, /shouldDrawOverlays\(frame\)/, 'the overlay hook must check the gate before calling drawOverlays');
  assert.match(src, /drawOverlays\(/, 'and must actually call drawOverlays when it passes');
});

/* ── general drawing behaviour, not otherwise covered above ───────────────────────── */

test('null overlays draws nothing at all', () => {
  const { ctx, calls } = recordingCtx();
  drawOverlays(ctx, null, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '' });
  assert.equal(calls.length, 0);
});

test('monogram with no mark uploaded draws the derived-initials pill, not an image', () => {
  const { ctx, calls } = recordingCtx();
  const overlays: ResolvedOverlays = {
    ...NO_OVERLAYS,
    monogram: { text: 'J&M', position: 'top-right', markDataUri: null },
  };
  drawOverlays(ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '' });
  assert.equal(fillTextCalls(calls, 'J&M').length, 1);
  assert.equal(calls.filter((c) => c[0] === 'drawImage').length, 0);
});

test('monogram with a cached mark draws the image, not the text pill', () => {
  const { ctx, calls } = recordingCtx();
  const cache: OverlayImageCache = new Map([
    ['data:image/svg+xml;base64,ZmFrZQ==', { status: 'ready', bitmap: 'FAKE_BITMAP' }],
  ]);
  const overlays: ResolvedOverlays = {
    ...NO_OVERLAYS,
    monogram: { text: 'J&M', position: 'top-right', markDataUri: 'data:image/svg+xml;base64,ZmFrZQ==' },
  };
  drawOverlays(ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '', imageCache: cache });
  assert.equal(fillTextCalls(calls, 'J&M').length, 0, 'no fallback pill once a mark is ready');
  const images = calls.filter((c) => c[0] === 'drawImage');
  assert.equal(images.length, 1);
  const image = images[0];
  assert.ok(image);
  assert.equal(image[1], 'FAKE_BITMAP');
});

test('monogram with a NOT-YET-cached mark draws nothing this tick — no placeholder, no throw', () => {
  const { ctx, calls } = recordingCtx();
  const cache: OverlayImageCache = new Map();
  const overlays: ResolvedOverlays = {
    ...NO_OVERLAYS,
    monogram: { text: 'J&M', position: 'top-right', markDataUri: 'data:image/svg+xml;base64,ZmFrZQ==' },
  };
  assert.doesNotThrow(() => {
    drawOverlays(ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '', imageCache: cache });
  });
  assert.equal(calls.length, 0);
  // The miss kicks off a load — the SAME url is now in the cache (as 'loading' or
  // resolved, depending on the microtask queue), so a second call in the same tick
  // never fetches twice.
  assert.ok(cache.has('data:image/svg+xml;base64,ZmFrZQ=='));
});

test('event QR draws only when a qrSrc is actually available', () => {
  const withUrl = recordingCtx();
  const cache: OverlayImageCache = new Map([['https://x/qr.png', { status: 'ready', bitmap: 'QR_BITMAP' }]]);
  const overlays: ResolvedOverlays = { ...NO_OVERLAYS, eventQr: { position: 'top-left' } };
  drawOverlays(withUrl.ctx, overlays, REFERENCE_LAYOUT, {
    qrSrc: 'https://x/qr.png',
    lowerThirdFallback: '',
    imageCache: cache,
  });
  assert.equal(withUrl.calls.filter((c) => c[0] === 'drawImage').length, 1);

  const withoutUrl = recordingCtx();
  drawOverlays(withoutUrl.ctx, overlays, REFERENCE_LAYOUT, { qrSrc: null, lowerThirdFallback: '' });
  assert.equal(withoutUrl.calls.length, 0, 'eventQr present but no qrSrc (slug-less event) ⇒ nothing drawn');
});
