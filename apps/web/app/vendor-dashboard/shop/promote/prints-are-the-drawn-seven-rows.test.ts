/**
 * prints-are-the-drawn-seven-rows.test.ts — 🪪 PRINTS IS THE DRAWING'S BLOCK (audit #7901 items 1–2, owner 16 Nov).
 *
 * Drawing `supplier_shop_clean_2026-11-16` (Promote › Prints): "Prints" stays the heading; under it the line
 * "Marketing materials, printed out" and its counts; then ONE row per piece (name · size, then its line), each opening
 * the shipped sheet on that piece. The Shop's Prints tile wears the same line. The section's icon is a calling card (the
 * rows themselves carry no icon).
 *
 *   1. The rows are `PRINT_PIECES.map` — never a typed list — and each opens the sheet on its own piece (`setBig`).
 *   2. No count is typed: "15 designs" / "7 pieces" appear nowhere outside comments; they are read from the tables.
 *   3. One line, two places: `PRINTS_LINE` in the section and on the Shop's tile.
 *   4. The section's icon is `IdCard`; `Printer` is gone from the section.
 *
 * SABOTAGE (each run once, each went red): type "15 designs · 7 pieces" back → 1; drop `setBig` from a row → 1; type
 * the tile's line → 1; put `Printer` back → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PRINT_DESIGNS, PRINT_PIECES, PRINTS_LINE, printsCountLine } from '@/lib/supplier-prints';

const R = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const SECTION = stripComments(R('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx'));
const COVER = stripComments(R('app/vendor-dashboard/shop/_components/shop-cover.tsx'));

test('one row per piece, each opening the sheet on that piece', () => {
  assert.equal(PRINT_PIECES.length, 7, 'the drawing has seven pieces');
  assert.deepEqual(
    PRINT_PIECES.map((p) => p.name),
    ['Calling card', 'A5 mini standee', 'Door print', 'Booth backdrop', 'Booth / office tarp', 'Roll-up banner', 'Table-front'],
  );
  assert.match(SECTION, /PRINT_PIECES\.map\(\(p\) => \(\s*<button[\s\S]{0,200}?setBig\(\{ kind: 'piece', piece: p \}\);\s*setOpen\(true\);/, 'a row does not open its own piece');
  assert.match(SECTION, /data-shop-prints-piece=\{p\.id\}/);
  assert.match(SECTION, /\{p\.name\}[\s\S]{0,160}\{p\.size\}[\s\S]{0,200}\{p\.line\}/, 'a row is not name · size, then its line');
});

test('no count is typed — both are read from the tables', () => {
  assert.equal(printsCountLine(), `${PRINT_DESIGNS.length} designs · ${PRINT_PIECES.length} pieces`);
  assert.doesNotMatch(SECTION, /\b15 designs\b|\b7 pieces\b|\b15 looks\b/, 'a count is typed');
  assert.match(SECTION, /\{printsCountLine\(\)\}/);
});

test('one line, in the section and on the Shop\'s Prints tile', () => {
  assert.equal(PRINTS_LINE, 'Marketing materials, printed out');
  assert.match(SECTION, /\{PRINTS_LINE\}/);
  assert.match(COVER, /data-shop-quick="promote"[\s\S]{0,700}\{PRINTS_LINE\}/, 'the Shop tile does not wear the line');
  assert.doesNotMatch(COVER, /Marketing materials, printed out/, 'the tile types its own copy of the line');
  assert.match(COVER, /data-shop-quick="promote"/); // the tile is "Promote" since 17 Nov (owner), still worded with this line
  // The tile is one of the quick row's three (`the-quick-row-is-the-drawn-three.test.ts`); it opens the shipped Promote sheet.
  assert.match(COVER, /onClick=\{\(\) => openSheet\('promote'\)\}[^>]*data-shop-quick="promote"/, 'the tile does not open the shipped Promote sheet');
});

test('the icon is a calling card, not a printer', () => {
  assert.match(SECTION, /<IdCard aria-hidden/);
  assert.doesNotMatch(SECTION, /\bPrinter\b/);
});
