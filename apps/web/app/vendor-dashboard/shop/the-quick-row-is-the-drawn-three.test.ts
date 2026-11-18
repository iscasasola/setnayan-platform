/**
 * GUARD — THE SHOP COVER'S QUICK ROW IS THE DRAWN THREE (controller re-audit of #7901, 17 Nov; P1 drawing
 * `supplier_shop_clean_2026-11-16`, `.quick`: three centred white lifted tiles, each a 40 px icon square). The first tile
 * is PRINTS and opens the prints ALONE (owner 17 Nov, superseding that morning's rename to Promote: *"then we should just
 * have promote button and find gifts there? That also means change Promote on Shop to Prints"*).
 *
 *   1. Three tiles, in the drawn order, in one 3-column row.
 *   2. Each opens a place that already ships: Prints is the shipped prints section alone (`PromoteBody part="prints"` —
 *      no gifts, no stories read); Your gifts is its own `#gifts` section (which
 *      exists in its component); Plan is the cover's `#plan` door, worded from `planLabel` — no read.
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
  assert.ok(!ROW.includes('>Promote<'), 'the tile says Promote again (owner 17 Nov, later: it is Prints)');
  for (const w of ['>Prints<', '>Your gifts<', '>Plan<']) assert.ok(ROW.includes(w), `the tile word ${w} is gone`);
});

test('2 · each tile opens a shipped place, with no new read', () => {
  assert.match(ROW, /onClick=\{\(\) => openSheet\('prints'\)\}[^>]*data-shop-quick="prints"/);
  assert.match(COVER, /<ParamSheet open=\{sheet === 'prints'\}[\s\S]{0,120}title="Prints" body=\{printsBody\}/, 'the Prints screen is not its own sheet');
  const body = read('promote/_components/promote-body.tsx');
  assert.match(body, /const withRest = withPromote && part !== 'prints';/, 'the Prints screen reads the gifts / stories too');
  assert.match(body, /giftsPromise = withRest \?/);
  assert.match(body, /sharePromise = withRest \?/);
  assert.match(read('page.tsx'), /printsBody=\{\s*<Suspense[\s\S]{0,80}?<PromoteBody search=\{qrSearch\} part="prints" \/>/);
  assert.match(ROW, /openPromoteAt\('gifts'\)[^>]*data-shop-quick="gifts"/);
  assert.match(ROW, /<a href="#plan"[^>]*data-shop-quick="plan"/);
  assert.match(ROW, /\{d\.planLabel\} plan/);
  // "Buy gifts" sells, so the iPhone app never shows it (App Store #5/#14 — `lib/store-shell.test.ts`).
  assert.match(ROW, /data-web-only="">Buy gifts</, 'the selling words show in the iPhone app');
  assert.match(read('promote/_components/shop-prints-section.tsx'), /<section id="prints"/);
  assert.match(read('promote/_components/shop-gifts-section.tsx'), /<section id="gifts"/);
  assert.match(COVER, /const openPromoteAt = \(section: 'gifts'\) => \{\s*openSheet\('promote'\);/);
});

test('3 · a white lifted tile with no line, a 40 px icon square on the wash', () => {
  const tile = COVER.match(/const QUICK_TILE =\s*'([^']*)'/)?.[1] ?? '';
  assert.match(tile, /bg-\[rgb\(var\(--sn-frame-bg\)\)\]/);
  assert.match(tile, /shadow-\[var\(--sn-frame-shadow-tile\)\]/);
  assert.match(tile, /items-center/);
  assert.doesNotMatch(tile, /\bborder\b/, 'a quick tile is never a bordered card');
  assert.match(COVER, /function QuickIcon[\s\S]*?h-10 w-10[^"]*bg-\[var\(--surface-soft\)\]/);
});
