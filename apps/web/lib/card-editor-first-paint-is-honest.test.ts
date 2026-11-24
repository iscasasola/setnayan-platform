/**
 * 👻 THE CARD EDITOR'S FIRST PAINT IS HONEST (supplier walk on live, 24 Nov 2026; controller brief).
 *
 * Measured on live: opening a complete, live card drew "PHOTOS 0 of 5" and "Couples can see it · still missing: a
 * cover photo · a price · what's included", then corrected 1–2 s later. The maker reads its facts off the live form,
 * which exists only after hydration, and drew the EMPTY snapshot as if it were the card (CLAUDE.md rule 4).
 *
 * Fails if the photo count or either status line renders before the first form read, or the live-card price wait
 * fires off the empty snapshot.
 * SABOTAGE (seen red, restored): drop `snapRead ?` from the Photos aside · drop the `!snapRead ?` skeleton.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '..', 'app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8');

test('the photo count waits for the first form read', () => {
  assert.match(SRC, /aside=\{snapRead \? `\$\{formatCount\(\(snap\.hasCover/);
});

test('both status lines draw a skeleton until the first read', () => {
  const skeletons = SRC.match(/\{!snapRead \? \(\s*<Sk /g) ?? [];
  assert.equal(skeletons.length, 2, 'the phone status line and the preview status line each wait');
  const lines = SRC.match(/data-maker-status=\{status\.tone\}/g) ?? [];
  assert.equal(lines.length, 2);
});

test('the read marks itself done, and the live-price wait needs it', () => {
  assert.match(SRC, /setSnap\(next\);\s*\}\s*setSnapRead\(true\);/);
  assert.match(SRC, /const liveNeedsPrice = snapRead && /);
});
