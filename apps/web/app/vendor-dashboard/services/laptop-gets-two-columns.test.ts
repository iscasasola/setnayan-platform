/**
 * laptop-gets-two-columns.test.ts — the maker on a laptop: the card in its own column beside the rows, and a phone
 * untouched.
 *
 * HISTORY. S4 / SUP-10 (2026-09) pinned the card beside the guided pass's question with two CSS classes
 * (`.sn-canvas-pass-pin` / `.sn-canvas-pass-hide`). The simpler maker (supplier-easy step 3, 2026-10-14) retired the
 * guided pass and moved every field from portalled sheets into in-page folds, so there is no "question open" state to
 * pin around any more. The RULE survives in a plainer shape, and this file now holds it:
 *
 *   1 · from 701 up (`tab:`, the supplier frame's line — lane 5, 2026-11-12; was 820 / md+) the maker splits evenly — the fields left, "As couples see it" right — and the preview STAYS
 *       in view (sticky) (makers prototype 7 Nov 2026 § 3, superseding the 340 px card-left column of 2026-10-14);
 *   2 · on a phone the preview is the pinned row's Eye sheet, so nothing sticky covers the fields;
 *   3 · every sheet that is left (kind · who it's for · the 🏷 ask · preview · delete) docks right on a laptop, as
 *       before, and keeps its phone veil.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';

test('the maker reads back', () => {
  assert.ok(read(MAKER).length > 5000, 'the maker read back empty');
});

test('from 701 up the maker splits evenly: the surface, then "As couples see it"', () => {
  /* SUPERSEDED 2026-11-07 — DECISION_LOG "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS,
     NEVER NEW ONES" + makers prototype § 3: "At 820 and 1440 the surface and 'As couples see it' split evenly". The
     card was a 340 px column LEFT of the rows at lg+; it is now an equal column RIGHT of the fields at md+. */
  const src = read(MAKER);
  assert.match(src, /className="tab:grid tab:grid-cols-2 tab:items-start tab:gap-8" data-maker-split=""/);
  const grid = src.indexOf('data-maker-split=""');
  const form = src.indexOf('data-card-form=""', grid);
  const card = src.indexOf('data-maker-card=""', grid);
  assert.ok(grid > 0 && form > grid && card > form, 'the fields must come before the preview inside the split');
});

test('the preview stays in view from 701 up, and is PINNED at the top on a phone (Lane E, owner 9 Nov: "Ok")', () => {
  const src = read(MAKER);
  const at = src.indexOf('data-maker-card=""');
  const tag = src.slice(src.lastIndexOf('<aside', at), at);
  assert.match(tag, /tab:sticky/, 'the preview no longer stays in view beside the fields');
  const classes = (tag.match(/className="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);
  assert.ok(classes.includes('hidden') && classes.includes('tab:block'), 'the side preview must hide on a phone (it is the sheet there)');
  for (const cls of classes.filter((c) => c !== 'hidden')) {
    assert.ok(cls.startsWith('tab:'), `"${cls}" applies on a phone — there the preview is the pinned card`);
  }
  // 🔁 2026-11-09 (Build 3 Lane E): the 👁 button and its sheet are gone — the card is pinned under the row on a phone.
  assert.doesNotMatch(src, /setSheet\('preview'\)|id="canvas-preview"/, 'the 👁 preview sheet is back');
  const pinned = src.slice(src.lastIndexOf('<div', src.indexOf('data-maker-card-pinned=""')), src.indexOf('data-maker-card-pinned=""'));
  assert.match(pinned, /sticky top-0/, 'the phone card is not pinned');
  assert.match(pinned, /tab:hidden/, 'the pinned card doubles the side preview from 701 up');
});

test('every sheet docks right on a laptop, and keeps its veil on a phone', () => {
  const src = read(MAKER);
  const at = src.indexOf('function CanvasSheet(');
  assert.notEqual(at, -1, 'CanvasSheet is gone');
  const sheetSrc = src.slice(at, src.indexOf('createPortal(', at) + 3000);
  const column = "'lg:inset-y-0 lg:left-auto lg:right-0 lg:mx-0 lg:my-auto lg:h-fit lg:max-h-[86dvh] lg:max-w-[420px] lg:rounded-3xl lg:mr-6'";
  assert.ok(sheetSrc.includes(column), 'the laptop column classes are gone');
  for (const cls of column.slice(1, -1).split(' ')) {
    assert.ok(cls.startsWith('lg:'), `"${cls}" in the laptop column applies on a phone`);
  }
  /* The phone veil is the one scrim (owner 2026-10-29, `lib/one-scrim.test.ts`); the laptop's catcher is clear. */
  assert.match(sheetSrc, /<OverlayBackdrop onClose=\{onClose\} className="lg:hidden" \/>/, 'the phone veil changed');
  assert.match(
    sheetSrc,
    /<button type="button" aria-label="Close" tabIndex=\{-1\} onClick=\{onClose\} className="absolute inset-0 hidden cursor-default lg:block" \/>/,
    'the laptop veils the card it is editing, or a tap beside the sheet no longer closes it',
  );
});
