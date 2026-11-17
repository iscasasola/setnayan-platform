/**
 * the-strip-shortens-before-it-slides.test.ts — walk W1-B11, 16 Nov 2026.
 *
 * At 375 px Your details' pinned row — "Shop · Details ▾ · Not yet verified · 0/3 documents in · 3/6 details done · ⚙"
 * — ran past its strip: tightened (number over word) it was still too wide, so it slid under its fade and the last door
 * read cut. The fit pass (`pin-doors.tsx`) now has a third step before the slide: each door's SHORT word — the word the
 * folded line already uses (`[data-folded]`) — under `[data-short]`. Held as properties:
 *   1 · the fit order is flat → tight → short → slides, written before paint;
 *   2 · a door with a `short` word draws it under `[data-short]` as under `[data-folded]`;
 *   3 · Your details' long words carry a short one, and with them the three doors fit the room a 375-px row leaves.
 *
 * SABOTAGE (each seen red): `data-short` set after `data-slides` → 1 · the `[[data-short]_&]` variants dropped → 2 ·
 * the 'docs' figure's `short` removed → 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { detailsFigures } from '@/lib/shop-section-figures';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('1 · the fit pass shortens the words before it slides', () => {
  const src = code('pin-doors.tsx');
  const tight = src.indexOf("el.setAttribute('data-tight', '')");
  const short = src.indexOf("el.setAttribute('data-short', '')");
  const slides = src.indexOf("el.setAttribute('data-slides', '')");
  assert.ok(tight > 0 && short > tight && slides > short, 'the strip slides before it uses its short words');
  assert.match(src, /el\.removeAttribute\('data-short'\);/, 'a wider screen keeps the short words');
});

test('2 · a door draws its short word under [data-short], as on the folded line', () => {
  const src = code('pin-door.tsx');
  assert.match(src, /\[\[data-folded\]_&\]:hidden \[\[data-short\]_&\]:hidden">\{word\}/);
  assert.match(src, /hidden \[\[data-folded\]_&\]:inline \[\[data-short\]_&\]:inline">\{short\}/);
});

test('3 · Your details’ doors fit a 375-px row once short', () => {
  const f = detailsFigures({ verified: false, docsIn: 0, docsTotal: 3, done: 3, of: 6 });
  for (const x of f) if (x.word.length > 8) assert.ok(x.short && x.short.length <= 8, `"${x.word}" has no short word`);
  // Tight + short: each door is as wide as the wider of its number and its word. ~7 px a character at 15 px bold
  // (numbers), ~6 px at 11 px (words), + 8 px of padding; the strip has ~167 px at 375 (343 inside the gutters, less the
  // "Shop · Details ▾" pick, the ⚙ and the gaps).
  const width = f.reduce((w, x) => w + Math.max((x.value ?? '—').length * 7, (x.short ?? x.word).length * 6) + 8 + 2, 0);
  assert.ok(width <= 167, `the three doors need ~${width}px — they slide at 375`);
});
