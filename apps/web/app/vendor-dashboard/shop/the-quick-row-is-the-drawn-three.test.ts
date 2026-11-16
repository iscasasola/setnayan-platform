/**
 * GUARD — THE SHOP COVER'S QUICK ROW IS THE DRAWN THREE (controller re-audit of #7901, 17 Nov; P1 drawing
 * `supplier_shop_clean_2026-11-16`, `.quick`: Prints · Your gifts · Plan, three centred white lifted tiles, each a 40 px
 * icon square).
 *
 *   1. Three tiles, in the drawn order, in one 3-column row.
 *   2. Each opens a place that already ships: Prints and Your gifts are the Promote sheet's own sections (`#prints`,
 *      `#gifts`, which exist in their components); Plan is the cover's `#plan` door, worded from `planLabel` — no read.
 *   3. The tile is the frame's white with its lift and no line (never a bordered card), the icon square 40 px on the wash.
 *
 * Sabotage: drop the Plan tile (1 red) · point Your gifts at `prints` (2 red) · give the tile a border (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const COVER = stripComments(readFileSync(join(import.meta.dirname, '_components/shop-cover.tsx'), 'utf8'));
const ROW = COVER.slice(COVER.indexOf('data-shop-quick-row=""'), COVER.indexOf('</div>', COVER.indexOf('data-shop-quick-row=""')));
const read = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8');

test('1 · three tiles — Prints · Your gifts · Plan — in one 3-column row', () => {
  assert.match(COVER, /className="grid grid-cols-3[^"]*" data-shop-quick-row=""/);
  const tiles = [...ROW.matchAll(/data-shop-quick="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(tiles, ['prints', 'gifts', 'plan']);
  for (const w of ['>Prints<', '>Your gifts<', '>Plan<']) assert.ok(ROW.includes(w), `the tile word ${w} is gone`);
});

test('2 · each tile opens a shipped place, with no new read', () => {
  assert.match(ROW, /openPromoteAt\('prints'\)[^>]*data-shop-quick="prints"/);
  assert.match(ROW, /openPromoteAt\('gifts'\)[^>]*data-shop-quick="gifts"/);
  assert.match(ROW, /<a href="#plan"[^>]*data-shop-quick="plan"/);
  assert.match(ROW, /\{d\.planLabel\} plan/);
  assert.match(read('promote/_components/shop-prints-section.tsx'), /<section id="prints"/);
  assert.match(read('promote/_components/shop-gifts-section.tsx'), /<section id="gifts"/);
  assert.match(COVER, /const openPromoteAt = \(section: 'prints' \| 'gifts'\) => \{\s*openSheet\('promote'\);/);
});

test('3 · a white lifted tile with no line, a 40 px icon square on the wash', () => {
  const tile = COVER.match(/const QUICK_TILE =\s*'([^']*)'/)?.[1] ?? '';
  assert.match(tile, /bg-\[rgb\(var\(--sn-frame-bg\)\)\]/);
  assert.match(tile, /shadow-\[var\(--sn-frame-shadow-tile\)\]/);
  assert.match(tile, /items-center/);
  assert.doesNotMatch(tile, /\bborder\b/, 'a quick tile is never a bordered card');
  assert.match(COVER, /function QuickIcon[\s\S]*?h-10 w-10[^"]*bg-\[var\(--surface-soft\)\]/);
});
