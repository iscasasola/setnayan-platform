/**
 * march-place.test.ts — a keyed guest who walks reads their place, their
 * partner and who walks before them (owner 2026-09-29, DECISION_LOG "THE
 * WEDDING MARCH ON THE INVITATION TELLS EACH ENTOURAGE MEMBER THEIR ROLE…"),
 * counted over the SAME `buildEntourage` groups the invitation prints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEntourage, type EntourageGuestRow } from './entourage';
import { marchOrdinal, marchPlaceLine, marchPlaceOf } from './march-place';

const row = (id: string, first: string, last: string, role: string, extra: Partial<EntourageGuestRow> = {}): EntourageGuestRow => ({
  guest_id: id,
  first_name: first,
  last_name: last,
  role,
  ...extra,
});

// Parents (2 lines: groom's then bride's), then a sponsor pair, then a bearer.
const ROWS: EntourageGuestRow[] = [
  row('gp', 'Ramon', 'Casasola', 'groom_parents'),
  row('bp', 'Lita', 'Reyes', 'bride_parents'),
  row('nong', 'Ben', 'Cruz', 'principal_sponsor_ninong', { march: { walk_no: 0, place_in_walk: 0 } }),
  row('nang', 'Nena', 'Cruz', 'principal_sponsor_ninang', { march: { walk_no: 0, place_in_walk: 1 } }),
  row('ring', 'Migo', 'Santos', 'ring_bearer'),
];

test('a pair walks as one line: each is told their partner and who walks just before', () => {
  const groups = buildEntourage(ROWS);
  const nang = marchPlaceOf(groups, 'nang')!;
  assert.equal(nang.position, 3);
  assert.equal(nang.partner, 'Ben Cruz');
  assert.equal(nang.after, 'Lita Reyes');
  assert.equal(marchPlaceLine(nang), 'You walk 3rd, with Ben Cruz, after Lita Reyes.');
  const ring = marchPlaceOf(groups, 'ring')!;
  assert.equal(marchPlaceLine(ring), 'You walk 4th, after Ben Cruz and Nena Cruz.');
});

test('the one who leads walks first; a guest who does not walk has no place', () => {
  const groups = buildEntourage(ROWS);
  assert.equal(marchPlaceLine(marchPlaceOf(groups, 'gp')!), 'You walk first.');
  assert.equal(marchPlaceOf(groups, 'someone-else'), null);
  assert.equal(marchPlaceOf(groups, null), null);
});

test('the couple’s own section order moves the count — one order, not a second sort', () => {
  // Sponsors first, as the couple arranged the sections.
  const groups = buildEntourage(ROWS, ['principal_sponsors', 'parents']);
  assert.equal(marchPlaceOf(groups, 'nong')!.position, 1);
  assert.equal(marchPlaceOf(groups, 'gp')!.position, 2);
  assert.equal(marchPlaceOf(groups, 'gp')!.after, 'Ben Cruz and Nena Cruz');
});

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(marchOrdinal), [
    'first', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st',
  ]);
});
