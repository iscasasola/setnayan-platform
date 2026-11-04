/**
 * more-settings-lines-up.test.ts — one icon column, one text column, inside "More settings" too.
 * Owner, 2026-11-04: "alignments for the more settings is wrong" — the nested rows' marks sat in a 32 px box behind an
 * extra 4 px inset, so their names started ~4 px off the rows above, and what they opened onto started at the edge.
 * Measured after the fix (WebKit 390×844, /dev/card-maker-lab): every row's mark at x=16, every name at x=64.
 * Sabotage (2026-11-04): SubIcon back to `h-8 w-8` → red; restored green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, '_components/canvas-maker.tsx'), 'utf8'));
const box = (fn: string) => src.slice(src.indexOf(`function ${fn}(`)).match(/className="grid (h-\d+ w-\d+) /)?.[1];

test('a nested row’s mark sits in the same box as the row above it', () => {
  assert.equal(box('RowIcon'), 'h-10 w-10');
  assert.equal(box('SubIcon'), box('RowIcon'), 'nested marks are a different width — names no longer line up');
});

test('every top-level row puts its name on the fold head’s column (40 px mark + 8 px gap)', () => {
  assert.match(src, /items-center gap-2 py-2" data-maker-row="name"/);
  const row = src.slice(src.indexOf('function MakerRow('), src.indexOf('function SlotRows('));
  assert.equal((row.match(/items-center gap-2 py-2/g) ?? []).length, 2, 'a MakerRow form went back to a different gap');
});

test('Discounts says, in its ⓘ, that a quote can always go lower', () => {
  const at = src.indexOf('data="m-disc"');
  const body = src.slice(at, src.indexOf('<DiscountsEditor', at));
  assert.match(body, /<InfoTip label="Starting offers"/);
  assert.ok(body.includes('Starting offers. You can give a bigger discount in any quote.'), 'the Discounts ⓘ line is gone');
});

test('what a nested fold opens onto starts on the name column, with no extra inset', () => {
  const at = src.indexOf('data-maker-more=""');
  const tag = src.slice(src.lastIndexOf('<div', at), at);
  assert.match(tag, /\[&>\[data-fold\]>\[data-fold-body\]>div>\*\]:pl-12/);
  assert.ok(!/\bpl-1\b/.test(tag), 'the extra 4 px inset is back');
});
