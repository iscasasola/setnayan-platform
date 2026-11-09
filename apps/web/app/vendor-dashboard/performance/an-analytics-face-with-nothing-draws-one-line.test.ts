/**
 * an-analytics-face-with-nothing-draws-one-line.test.ts — Shop › Analytics' five faces, when there is nothing to
 * draw, draw ONE honest line and nothing else.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * Build 3's empty-mode walk (9 Nov, the go-live gate "empty modes included") caught two lies on one carousel:
 *   · a REFUSED read drew "Couldn't load" under grey bars and a "—" — the picture said there was a number;
 *   · a BRAND-NEW shop drew bars and "3 of 3 placed" — the lab handed a new shop's cover a busy shop's numbers.
 * And the face's ground was `var(--m-card,#fff)` — a token defined nowhere, so the card stayed white in dark.
 *
 * Pins, each against the mistake it would catch:
 *   1. CardFace's `quiet` branch draws the line alone — it never renders `children` (no chart beside the line);
 *   2. the ground is the app's card token, never a literal white fallback;
 *   3. every one of the five faces passes `quiet`, so none can draw an empty chart under a failed or empty read;
 *   4. the price face no longer draws its dashed placeholder rail when there is no band.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(__dirname, '_components');
const read = (f: string) => stripComments(readFileSync(join(DIR, f), 'utf8'));

test('1 · a quiet face draws the line alone, never the picture', () => {
  const src = read('card-face.tsx');
  const m = src.match(/\{quiet \? \(([\s\S]*?)\) : \(/);
  assert.ok(m, 'CardFace must branch on `quiet`');
  assert.match(m![1]!, /\{line\}/, 'the quiet branch draws the line');
  assert.doesNotMatch(m![1]!, /children/, 'the quiet branch must not draw the picture');
});

test('2 · the face ground is a token, never a literal white', () => {
  const src = read('card-face.tsx');
  assert.match(src, /bg-\[color:var\(--m-paper\)\]/);
  assert.doesNotMatch(src, /#fff\b|#ffffff\b|bg-white\b/i);
});

test('3 · all five faces can go quiet', () => {
  for (const f of ['capacity-card.tsx', 'conversion-deals-card.tsx', 'price-position-card.tsx', 'roi-attribution-card.tsx', 'funnel-benchmark-card.tsx']) {
    const src = read(f);
    const face = src.match(/<CardFace[\s\S]*?>/);
    assert.ok(face, `${f} draws a CardFace`);
    assert.match(face![0], /\bquiet=\{/, `${f}'s CardFace must pass quiet`);
  }
});

test('4 · no placeholder rail under a price face with no band', () => {
  assert.doesNotMatch(read('price-position-card.tsx'), /border-dashed/);
});
