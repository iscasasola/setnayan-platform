/**
 * GUARD — THE SHOP COVER'S SECOND LINE IS THE DRAWN FIVE (owner 19 Nov 2026: *"profile photo Share then view Shop / Then
 * Promote, QR, Prints, Gifts, Plan"*; drawing `shop_final_with_spaces_2026-11-19`, Part 1, approved "i approve the design
 * already"). RE-AIMED from `the-quick-row-is-the-drawn-three` (17 Nov: Prints · Your gifts · Plan in a 3-column row) — the
 * same three tiles and doors, joined by Promote and QR, five EQUAL buttons (the Button Rule, owner 9 Nov).
 *
 *   1. Five tiles, in the owner's order, in one 5-column row; Share sits on line one, between the logo and View shop.
 *   2. Each opens the place it opened before: Promote and QR their own sheets; Prints the prints ALONE (owner 17 Nov —
 *      no gifts, no stories read); Gifts the Promote sheet's `#gifts`; Plan the cover's `#plan` door, named from
 *      `planLabel` — no read. No tile carries selling words (the iPhone app shows the row as is).
 *   3. The tile is the frame's white with its lift and no line (never a bordered card), the icon square on the wash.
 *   4. The plan link is off the cover photo (one thing, one door: the Plan tile), and the Cover door and Upload pill are
 *      gone — the photo itself is the door.
 *
 * Sabotage: drop the Plan tile (1 red) · point Gifts at `prints` (2 red) · give the tile a border (3 red) · put
 * `data-shop-plan` back on the hero (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const COVER = stripComments(readFileSync(join(import.meta.dirname, '_components/shop-cover.tsx'), 'utf8'));
const ROW = COVER.slice(COVER.indexOf('data-shop-quick-row=""'), COVER.indexOf('</div>', COVER.indexOf('data-shop-quick-row=""')));
const read = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8');

test('1 · five tiles — Promote · QR · Prints · Gifts · Plan — in one 5-column row; Share on line one', () => {
  assert.match(COVER, /className="grid grid-cols-5[^"]*" data-shop-quick-row=""/);
  const tiles = [...ROW.matchAll(/data-shop-quick="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(tiles, ['promote', 'qr', 'prints', 'gifts', 'plan']);
  for (const w of ['>Promote<', '>QR<', '>Prints<', '>Gifts<', '>Plan<']) assert.ok(ROW.includes(w), `the tile word ${w} is gone`);
  // Line one: the logo, then Share, then View shop — in that order.
  const one = COVER.slice(COVER.indexOf('data-shop-cover-line="one"'), COVER.indexOf('data-shop-quick-row=""'));
  const at = ['data-tour="shop-logo"', 'data-shop-cover-icon="share"', 'data-view-shop=""'].map((k) => one.indexOf(k));
  assert.ok(at.every((n) => n >= 0), 'line one lost the logo, Share or View shop');
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'line one is not logo · Share · View shop');
});

test('2 · each tile opens a shipped place, with no new read', () => {
  assert.match(ROW, /onClick=\{\(\) => openSheet\('promote'\)\}[^>]*data-shop-quick="promote"/);
  assert.match(ROW, /onClick=\{\(\) => openSheet\('qr'\)\}[^>]*data-shop-quick="qr"/);
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
  // No tile sells: "Buy gifts" left with the small lines, so the iPhone app can show the row as it is (App Store #5/#14).
  assert.doesNotMatch(ROW, /\bBuy\b/, 'a tile carries selling words the iPhone app would show');
  assert.match(read('promote/_components/shop-prints-section.tsx'), /<section id="prints"/);
  assert.match(read('promote/_components/shop-gifts-section.tsx'), /<section id="gifts"/);
  assert.match(COVER, /const openPromoteAt = \(section: 'gifts'\) => \{\s*openSheet\('promote'\);/);
});

test('3 · a white lifted tile with no line, an icon square on the wash', () => {
  const tile = COVER.match(/const QUICK_TILE =\s*'([^']*)'/)?.[1] ?? '';
  assert.match(tile, /bg-\[rgb\(var\(--sn-frame-bg\)\)\]/);
  assert.match(tile, /shadow-\[var\(--sn-frame-shadow-tile\)\]/);
  assert.match(tile, /items-center/);
  assert.doesNotMatch(tile, /\bborder\b/, 'a quick tile is never a bordered card');
  assert.match(COVER, /function QuickIcon[\s\S]*?h-8 w-8[^"]*bg-\[var\(--surface-soft\)\]/);
});

test('4 · one door each: no plan link on the photo, no Cover door, no Upload pill — the photo is the door', () => {
  assert.doesNotMatch(COVER, /data-shop-plan=/, 'the plan link is back on the cover photo (the Plan tile is its door)');
  assert.doesNotMatch(COVER, /data-shop-cover-edit=/, 'the Cover door is back beside the photo');
  assert.doesNotMatch(COVER, /HERO_UPLOAD_PILL|upload=\{/, 'the Upload pill is back on the Shop cover');
  assert.match(COVER, /photoDoor=\{[\s\S]{0,200}<PortfolioUploadDoor facts=\{d\.uploadFacts\} coverPick/, 'a tap on the cover photo does not open the picker');
  assert.match(COVER, /<PhotoPickLabel[\s\S]{0,120}data="shop-logo"/, 'a tap on the logo does not open the picker');
});
