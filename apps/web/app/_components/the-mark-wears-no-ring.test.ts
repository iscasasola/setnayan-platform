/**
 * THE MARK WEARS NO RING (owner 2026-09-21: "a circle on the monogram that is
 * not part of the monogram. remove that").
 *
 * Every uploaded / AI monogram was drawn inside a 2px ring in the monogram
 * colour on a cream disc. The couple never designed that frame. The mark now
 * renders as itself; only a dark surface (`plate`) gets a plain cream disc,
 * and never a ring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const mark = stripComments(readFileSync(join(__dirname, 'bespoke-monogram-mark.tsx'), 'utf8'));
const hero = stripComments(readFileSync(join(__dirname, 'hero-monogram.tsx'), 'utf8'));

test('the bespoke mark draws no ring', () => {
  assert.doesNotMatch(mark, /\bborder-\d|\bborder\b(?!-)|borderColor|\bring-\d/, 'a ring is back around the monogram');
});

test('the cream disc appears only when a dark surface asks for it', () => {
  assert.match(mark, /plate \? 'overflow-hidden rounded-full bg-cream' : ''/);
  assert.equal((mark.match(/rounded-full/g) ?? []).length, 1, 'one disc, and only behind `plate`');
});

test('the hero passes plate through to the bespoke mark', () => {
  assert.match(hero, /<BespokeMonogramMark[^>]*plate=\{plate\}/);
});
