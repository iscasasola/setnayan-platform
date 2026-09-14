/**
 * The formal name is what the ROSTER shows. Its whole reason to exist is that
 * `guestDisplayName` must stay short for 83 other call sites (seating cards,
 * QR labels, the caterer export), so these two must be able to differ — and
 * must never silently become the same thing.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { guestFormalName, guestDisplayName } from './guests';

const base = {
  display_name: null,
  name_prefix: null,
  first_name: 'Claire',
  middle_name: null,
  last_name: 'Buanhog',
  name_suffix: null,
};

test('THE REGRESSION: the parts the host typed actually appear', () => {
  // Measured on the live roster 2026-09-14 — the host edited these and the
  // guest list still read "Claire Buanhog".
  assert.equal(
    guestFormalName({ ...base, name_prefix: 'Ms.', middle_name: 'Estoras' }),
    'Ms. Claire Estoras Buanhog',
  );
  assert.equal(
    guestFormalName({
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

test('a guest with no parts reads exactly as before', () => {
  assert.equal(guestFormalName(base), 'Claire Buanhog');
  assert.equal(guestFormalName(base), guestDisplayName(base));
});

test('absent parts leave no double spaces', () => {
  assert.equal(guestFormalName({ ...base, name_suffix: 'Jr.' }), 'Claire Buanhog Jr.');
  assert.ok(!guestFormalName({ ...base, name_prefix: 'Dr.' }).includes('  '));
});

test('an explicit display_name still wins — a title never overrides it', () => {
  const g = { ...base, display_name: 'Tita Claire', name_prefix: 'Ms.', middle_name: 'Estoras' };
  assert.equal(guestFormalName(g), 'Tita Claire');
  assert.equal(guestFormalName(g), guestDisplayName(g));
});

test('whitespace-only parts are dropped, not rendered as gaps', () => {
  assert.equal(
    guestFormalName({ ...base, name_prefix: '   ', middle_name: '\t', name_suffix: ' ' }),
    'Claire Buanhog',
  );
});

test('the two functions genuinely differ when parts exist', () => {
  // If this ever passes as equal, guestDisplayName has been widened and the
  // print surfaces are now receiving five-part names.
  const g = { ...base, name_prefix: 'Atty.', middle_name: 'Estoras', name_suffix: 'Jr.' };
  assert.notEqual(guestFormalName(g), guestDisplayName(g));
  assert.equal(guestDisplayName(g), 'Claire Buanhog');
});
