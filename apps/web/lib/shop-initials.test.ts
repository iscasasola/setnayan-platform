/**
 * shopInitials — the shared shop/vendor monogram helper (lib/shop-initials.ts).
 *
 * The bug: several hand-rolled `initials(name)` copies took the literal first
 * CHARACTER of the first and last whitespace-separated word. For
 * "Saysay Live Band & Hosting (FIXTURE)" the last "word" is "(FIXTURE)", so
 * the monogram rendered "S(" — a punctuation character, in a UI slot that is
 * supposed to hold two letters.
 *
 * Run: `pnpm test:unit` (globs lib/**\/*.test.ts + app/**\/*.test.ts, tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopInitials } from './shop-initials';

test('the exact reported fixture never renders a bracket', () => {
  const got = shopInitials('Saysay Live Band & Hosting (FIXTURE)');
  assert.equal(got, 'SL', 'first two real words, not the trailing "(FIXTURE)" artifact');
  assert.match(got, /^[A-Z0-9]+$/, 'letters/digits only — never "(" or any other symbol');
});

test('never returns a non-alphanumeric character, for names that DO carry real letters/digits', () => {
  const hostiles = [
    'Saysay Live Band & Hosting (FIXTURE)',
    '(Untitled) Studio',
    '& Co Events',
    '*** Draft *** Photography',
    '123 Party Rentals',
    'Ñoel Catering',
    "O'Brien's Flowers",
    'A',
    'A B C D',
  ];
  for (const name of hostiles) {
    const got = shopInitials(name);
    assert.ok(got.length > 0, `must return something for "${name}"`);
    assert.doesNotMatch(
      got,
      /[^\p{L}\p{N}]/u,
      `"${name}" → "${got}" must be letters/digits only`,
    );
  }
});

test('a name with NOTHING alphanumeric falls back — the fallback itself is exempt from the letters/digits rule', () => {
  assert.equal(shopInitials('   '), '·');
  assert.equal(shopInitials('!!!'), '·');
});

test('two-word names keep behaving exactly as before (no regression)', () => {
  assert.equal(shopInitials('Bloom Studio'), 'BS');
  assert.equal(shopInitials('Juan Dela Cruz'), 'JD');
});

test('a single word takes its own first two characters', () => {
  assert.equal(shopInitials('Setnayan'), 'SE');
});

test('unicode letters (e.g. Ñ) survive — not stripped as "punctuation"', () => {
  assert.equal(shopInitials('Ñoel Studio'), 'ÑS');
});

test('nothing alphanumeric at all falls back to the caller-chosen fallback', () => {
  assert.equal(shopInitials('   '), '·');
  assert.equal(shopInitials('!!!'), '·');
  assert.equal(shopInitials('', 2, 'SN'), 'SN');
});

test('respects a custom fallback (front-door callers keep their own "SN")', () => {
  assert.equal(shopInitials('(((', 2, 'SN'), 'SN');
});
