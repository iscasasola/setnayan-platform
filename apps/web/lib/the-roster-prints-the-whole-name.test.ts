/**
 * The roster prints the WHOLE name, and `guestDisplayName` must never be
 * widened to do it.
 *
 * ── THE HISTORY THIS ENCODES ──────────────────────────────────────────────
 * Two sessions independently wrote the same function into lib/guests.ts on the
 * same day — `guestFullName` (shipped, #5492) and `guestFormalName` (this
 * branch). Identical: same five parts, same order, same display_name-first
 * rule. The merge CONFLICTED, which forced the collapse instead of letting two
 * mechanisms for one question land side by side. `guestFullName` survived
 * because it returns `null` when nothing usable remains, so a caller can drop a
 * row rather than print an empty line.
 *
 * 🔑 THE ASSERTION THAT MATTERS IS THE SEPARATION, not the composition.
 * `guestDisplayName` feeds **83 call sites** — seating cards, QR labels, the
 * caterer export, the print routes, the Patiktok booth. The tempting
 * "simplification" is to make it return the full name and delete the other, and
 * that would silently push "Atty. Ma. Teresita Sacdalan Sison-Baluis Jr." onto a
 * printed place card sized for two words. These tests fail if anyone does.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { guestFullName, guestDisplayName } from './guests';

const base = {
  display_name: null,
  name_prefix: null,
  first_name: 'Claire',
  middle_name: null,
  last_name: 'Buanhog',
  name_suffix: null,
};

test('THE REGRESSION: the parts the host typed actually appear', () => {
  // Reported from the live roster 2026-09-14 — these were set on the detail
  // page, saved correctly, and the list still read "Claire Buanhog".
  assert.equal(
    guestFullName({ ...base, name_prefix: 'Ms.', middle_name: 'Estoras' }),
    'Ms. Claire Estoras Buanhog',
  );
  assert.equal(
    guestFullName({
      ...base,
      first_name: 'Indalecio',
      last_name: 'Casasola',
      name_prefix: 'Mr.',
      middle_name: 'Sacdalan',
      name_suffix: 'II',
    }),
    'Mr. Indalecio Sacdalan Casasola II',
  );
});

test('🔑 guestDisplayName MUST STAY COMPACT — 83 call sites print it', () => {
  // Seating cards, QR labels, caterer export, print routes, the booth. If this
  // ever passes as equal, someone widened the compact name and every printed
  // place card just grew four words.
  const g = { ...base, name_prefix: 'Atty.', middle_name: 'Estoras', name_suffix: 'Jr.' };
  assert.equal(guestDisplayName(g), 'Claire Buanhog');
  assert.notEqual(guestFullName(g), guestDisplayName(g));
});

test('a guest with no extra parts reads exactly as before', () => {
  assert.equal(guestFullName(base), 'Claire Buanhog');
  assert.equal(guestFullName(base), guestDisplayName(base));
});

test('an explicit display_name still wins — a title never overrides it', () => {
  const g = { ...base, display_name: 'Tita Claire', name_prefix: 'Ms.', middle_name: 'Estoras' };
  assert.equal(guestFullName(g), 'Tita Claire');
  assert.equal(guestFullName(g), guestDisplayName(g));
});

test('absent parts leave no double spaces', () => {
  assert.equal(guestFullName({ ...base, name_suffix: 'Jr.' }), 'Claire Buanhog Jr.');
  assert.ok(!(guestFullName({ ...base, name_prefix: 'Dr.' }) ?? '').includes('  '));
});

test('nothing usable returns null — the roster falls back, the invitation drops the row', () => {
  // The null is load-bearing in BOTH directions: the entourage drops such a
  // row, and the roster renders `guestFullName(g) ?? guestDisplayName(g)`
  // because a list row must still show something.
  assert.equal(guestFullName({ ...base, first_name: '   ', last_name: '\t' }), null);
});
