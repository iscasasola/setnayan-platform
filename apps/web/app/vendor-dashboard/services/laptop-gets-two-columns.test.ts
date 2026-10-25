/**
 * laptop-gets-two-columns.test.ts — the maker on a laptop: the card in its own column beside the rows, and a phone
 * untouched.
 *
 * HISTORY. S4 / SUP-10 (2026-09) pinned the card beside the guided pass's question with two CSS classes
 * (`.sn-canvas-pass-pin` / `.sn-canvas-pass-hide`). The simpler maker (supplier-easy step 3, 2026-10-14) retired the
 * guided pass and moved every field from portalled sheets into in-page folds, so there is no "question open" state to
 * pin around any more. The RULE survives in a plainer shape, and this file now holds it:
 *
 *   1 · at lg+ the maker is two columns — the card left, the rows right — and the card STAYS in view (sticky);
 *   2 · below lg the card scrolls with the page (the prototype's phone: a sticky card would cover a third of a 667 px
 *       screen while the rows are filled — measured in the lab walk);
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

test('at lg+ the maker is two columns: the card, then the rows', () => {
  const src = read(MAKER);
  assert.match(src, /className="lg:grid lg:grid-cols-\[minmax\(0,340px\)_minmax\(0,1fr\)\] lg:items-start lg:gap-8"/);
  const grid = src.indexOf('lg:grid lg:grid-cols-');
  const card = src.indexOf('data-maker-card=""', grid);
  const form = src.indexOf('data-card-form=""', grid);
  assert.ok(grid > 0 && card > grid && form > card, 'the card must come before the rows inside the two-column grid');
});

test('the card stays in view on a laptop and scrolls on a phone — sticky at lg only', () => {
  const src = read(MAKER);
  const at = src.indexOf('data-maker-card=""');
  const tag = src.slice(src.lastIndexOf('<div', at), at);
  assert.match(tag, /lg:sticky/, 'the card no longer stays in view on a laptop');
  for (const cls of (tag.match(/className="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)) {
    assert.ok(cls.startsWith('lg:'), `"${cls}" applies on a phone — the card must scroll with the page there`);
  }
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
  assert.match(
    sheetSrc,
    /["']absolute inset-0 bg-ink\/40 backdrop-blur-sm lg:cursor-default lg:bg-transparent lg:backdrop-blur-none["']/,
    'the phone veil changed, or the laptop still veils the card it is editing',
  );
});
