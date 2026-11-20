/**
 * 🔒 A FLAT PRICE IS ONE NUMBER (HYBRID Card Maker drawing 17 Nov, "What this removes": *"On Price: 'Price covers' on a
 * flat price"*). The Card Maker's Flat price shows the Base price alone — unless the card ALREADY carries a guest cover
 * or an extra-guest price, which keeps both rows so a save never silently drops that charge.
 * Also: the Last-minute boxes are 72 px, as wide as Book ahead, so "mo" and "+%" are never clipped (review Gap 9).
 *
 * Sabotage (each seen red, then restored): `flatHasCover ?` removed → 1 · a Last-minute box back to 56 px → 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('1 · flat price draws Price covers only for a card that already has a cover', () => {
  const src = read('pricing-basis-editor.tsx');
  assert.match(src, /const flatHasCover = defaults\.base_pax != null \|\| defaults\.added_pax_price_php != null;/);
  assert.match(src, /return basis === 'fixed' \? \(\s*flatHasCover \? \(\s*<>\s*<TypedRow key="base_pax" name="Price covers"/, 'Price covers is drawn on every flat price again');
});

test('2 · the Last-minute boxes are wide enough for their words', () => {
  const src = read('canvas-maker.tsx');
  for (const id of ['last_minute_end_months', 'last_minute_surcharge_pct']) {
    const at = src.indexOf(`id="${id}"`);
    assert.ok(at > 0, `${id} is gone`);
    const tag = src.slice(at, src.indexOf('/>', at));
    assert.match(tag, /w-\[72px\]/, `${id} is narrower than Book ahead — its placeholder is clipped`);
  }
});
