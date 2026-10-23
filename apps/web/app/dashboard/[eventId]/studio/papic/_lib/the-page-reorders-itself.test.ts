/**
 * THE PAPIC PAGE NO LONGER RE-ORDERS ITSELF BY PHASE — it is the camera, in ONE order.
 *
 * ⚖ History: owner 2026-09-22 had the page re-order by phase (setup before the day, the photographs after), ten
 * blocks, one DOM, CSS `order`. ⚖ 2026-10-23 (owner): *"Papic is the camera service. Gallery is the collection of
 * the files for that event."* What re-ordered by phase was the FILES — they moved to the event's Memories tab — so
 * the camera page has one order, the owner's: the way back · the credits band · the camera settings (the one line,
 * his five, the challenges) · what is made from the photos · Setup & help.
 *
 * 🔑 THIS GUARD STATES THE NEW RULE, NOT THE RETIRED ONE: a phase map coming back would re-introduce an order the
 * owner removed, and an interpolated `order-${n}` would silently do nothing (Tailwind never generates it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = stripComments(readFileSync(join(PAPIC, 'page.tsx'), 'utf8'));

test('no phase map is left on the page — one order', () => {
  assert.doesNotMatch(SRC, /\bBLOCK_ORDER\b/, 'the phase map is back');
  assert.doesNotMatch(SRC, /\bord\('/, 'a block asks its phase rank again');
  assert.doesNotMatch(SRC, /order-\$\{/, 'an interpolated order class — Tailwind never generates it');
});

test('the owner’s order: way back · credits · camera settings · made from photos · Setup & help', () => {
  const at = (needle: string) => {
    const i = SRC.indexOf(needle);
    assert.ok(i > 0, `${needle} is not on the page`);
    return i;
  };
  const seq = ['data-papic-back=""', '<PapicTopBand', '<PapicCameraSettings', '<MagazineCard', '<ShutterSection'].map(at);
  assert.deepEqual([...seq].sort((a, b) => a - b), seq, 'the camera page is out of the owner’s order');
});
