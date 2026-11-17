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

/* Re-aimed 2026-11-17 (Card Maker HYBRID, owner-approved — "Folds become framed groups", REMOVES 8): the nested folds and
   their marks are gone from More settings. The claim — one column inside it — now holds because every group is the ONE
   frame (MakerGroup) holding Form rows, whose names all start on the frame's edge; no nested mark is left to misalign. */
test('inside More settings every group is the one frame, and no nested mark is left to misalign', () => {
  assert.equal(box('RowIcon'), 'h-10 w-10');
  assert.ok(!src.includes('function SubIcon('), 'nested marks are back inside More settings');
  const more = src.slice(src.indexOf('data-maker-more=""'), src.indexOf('</Fold>', src.indexOf('data-maker-more=""')));
  assert.ok((more.match(/<MakerGroup id="/g) ?? []).length >= 6, 'More settings is no longer framed groups');
  assert.ok(!/<Fold\b/.test(more), 'a nested fold is back inside More settings');
});

test('every top-level row puts its name on the fold head’s column (40 px mark + 8 px gap)', () => {
  /* The Name row left this rule on 2026-11-07: the first page now follows the makers prototype's one rhythm (label ·
     48 px box · hint — DECISION_LOG "THE FOUR MAKERS ARE APPROVED…", § 3), held by lib/the-card-gift-is-one-dropdown
     .test.ts. MakerRow — still drawn inside More settings — keeps the column. */
  const row = src.slice(src.indexOf('function MakerRow('), src.indexOf('function SlotRows('));
  assert.equal((row.match(/items-center gap-2 py-2/g) ?? []).length, 2, 'a MakerRow form went back to a different gap');
});

test('Discounts says, in its ⓘ, that a quote can always go lower', () => {
  const at = src.indexOf('data-maker-group-row="m-disc"');
  const body = src.slice(at, src.indexOf('<DiscountsEditor', at));
  assert.ok(at > 0 && body.length > 0, 'the Discounts row is gone');
  assert.match(body, /about=\{\{ title: 'Starting offers'/);
  assert.ok(body.includes('Starting offers. You can give a bigger discount in any quote.'), 'the Discounts ⓘ line is gone');
});

test('what a group opens onto starts on the name column, with no extra inset', () => {
  const at = src.indexOf('data-maker-more=""');
  const tag = src.slice(src.lastIndexOf('<div', at), at);
  assert.ok(!/\bpl-\d+\b/.test(tag), 'an extra inset is back on More settings');
  const group = src.slice(src.indexOf('function MakerGroup('), src.indexOf('function byCategory('));
  assert.match(group, /!px-3\.5/, 'the frame lost its 14 px sides (the drawing’s .fr)');
});
