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

test('from 820 px the maker is two EVEN columns: the surface, then “As couples see it”', () => {
  // Owner-approved maker 2026-11-07: "at 820/1440 the form and the preview split evenly, and the preview is sized to
  // its content" — the surface first (left), the preview beside it.
  const src = read(MAKER);
  assert.match(src, /className="md:grid md:grid-cols-2 md:items-start md:gap-8"/, 'the two columns are no longer even from 820 px');
  const grid = src.indexOf('md:grid md:grid-cols-2');
  const form = src.indexOf('data-card-form=""', grid);
  const card = src.indexOf('data-maker-card=""', grid);
  assert.ok(grid > 0 && form > grid && card > form, 'the surface must come before the preview inside the two-column grid');
});

test('the preview stays in view beside the surface and is not drawn on a phone — a phone opens it from the pinned row', () => {
  const src = read(MAKER);
  const at = src.indexOf('data-maker-card=""');
  const tag = src.slice(src.lastIndexOf('<aside', at), src.indexOf('>', at));
  assert.match(tag, /md:sticky/, 'the preview no longer stays in view beside the surface');
  const classes = (tag.match(/className="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);
  assert.ok(classes.includes('hidden') && classes.includes('md:block'), 'the side preview shows on a phone, under the fields');
  for (const cls of classes.filter((c) => c !== 'hidden')) {
    assert.ok(cls.startsWith('md:'), `"${cls}" applies on a phone`);
  }
  assert.match(src, /<RoundButton label="As couples see it" onClick=\{\(\) => setSheet\('preview'\)\}/, 'the pinned row lost its Preview round');
  // Sized to its words: no fixed tall square in the pane.
  const pane = src.slice(at, src.indexOf('</aside>', at));
  assert.ok(!/\bh-\[(?:[3-9]\d\d)px\]|aspect-square/.test(pane), 'the preview pane is a tall fixed box again');
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
