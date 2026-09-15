/**
 * entourage.test — what a guest may read, in the order an invitation prints it.
 *
 * Three things are worth pinning and the rest is layout:
 *   · THE FENCE. `guests.role` also carries `guest`, `vip`, `family`, `helper`
 *     and both halves of the couple. This list publishes NAMES to everyone who
 *     can open the page, so a role drifting into it is a privacy defect, not a
 *     cosmetic one — and the fence is a allow-list, which is the only shape
 *     that stays closed when a new role is added to the enum.
 *   · THE ORDER, because it is the whole reason this module is not a `map`.
 *   · A LABEL FOR EVERY PUBLISHED ROLE. A published role with no label renders
 *     a name with nothing beside it, which is exactly the "names only" the
 *     owner ruled against.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEntourage,
  peopleOf,
  roleLabel,
  personName,
  ENTOURAGE_ROLES,
  type EntourageGuestRow,
} from './entourage';

const row = (over: Partial<EntourageGuestRow>): EntourageGuestRow => ({
  display_name: null,
  first_name: 'A',
  last_name: 'B',
  role: 'guest',
  extra_roles: null,
  ...over,
});

test('every published role carries a label', () => {
  const unlabelled = ENTOURAGE_ROLES.filter((r) => roleLabel(r) === null);
  assert.deepEqual(unlabelled, [], `published with no label: ${unlabelled.join(', ')}`);
});

test('the groups print in invitation order — sponsors before the entourage proper', () => {
  const groups = buildEntourage([
    row({ first_name: 'Lito', role: 'groomsman' }),
    row({ first_name: 'Rosa', role: 'principal_sponsor' }),
    row({ first_name: 'Mia', role: 'flower_girl' }),
    row({ first_name: 'Ent', role: 'bride_parents' }),
    row({ first_name: 'Cel', role: 'candle_sponsor' }),
    row({ first_name: 'Ana', role: 'maid_of_honor' }),
    row({ first_name: 'Bea', role: 'bridesmaid' }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.key),
    [
      'parents',
      'principal_sponsors',
      'secondary_sponsors',
      'honour',
      'bridesmaids_groomsmen',
      'bearers',
    ],
  );
});

test('a role nobody holds draws no heading', () => {
  const groups = buildEntourage([row({ first_name: 'Bea', role: 'bridesmaid' })]);
  assert.deepEqual(groups.map((g) => g.key), ['bridesmaids_groomsmen']);
});

test('the fence: plain guests, the couple and the generic roles are never published', () => {
  const groups = buildEntourage([
    row({ first_name: 'Nobody', role: 'guest' }),
    row({ first_name: 'Bride', role: 'bride' }),
    row({ first_name: 'Groom', role: 'groom' }),
    row({ first_name: 'Veep', role: 'vip' }),
    row({ first_name: 'Kin', role: 'family' }),
    row({ first_name: 'Hand', role: 'helper' }),
    row({ first_name: 'Host', role: 'host' }),
  ]);
  assert.deepEqual(groups, []);
});

test('a guest who holds two roles stands in both places', () => {
  const groups = buildEntourage([
    row({ first_name: 'Bea', role: 'bridesmaid', extra_roles: ['candle_sponsor'] }),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.key, peopleOf(g).map((p) => `${p.name}:${p.role}`)]),
    [
      ['secondary_sponsors', ['Bea B:candle_sponsor']],
      ['bridesmaids_groomsmen', ['Bea B:bridesmaid']],
    ],
  );
});

test('a row with no usable name is dropped, not printed blank', () => {
  const groups = buildEntourage([
    row({ display_name: '   ', first_name: '', last_name: '', role: 'bridesmaid' }),
    row({ first_name: 'Bea', last_name: 'Reyes', role: 'bridesmaid' }),
  ]);
  assert.deepEqual(peopleOf(groups[0]!).map((p) => p.name), ['Bea Reyes']);
});

test('the couple’s chosen display name wins over the composed one', () => {
  assert.equal(
    personName({ display_name: 'Tita Rosa', first_name: 'Rosario', last_name: 'Cruz' }),
    'Tita Rosa',
  );
  assert.equal(personName({ first_name: 'Rosario', last_name: 'Cruz' }), 'Rosario Cruz');
  assert.equal(personName({ first_name: null, last_name: null }), null);
});

/*
  🔴 THE WHOLE NAME. Measured on one real wedding: of 72 entourage rows, 66
  carried a prefix — Atty., Comm., Associate Dean — and the invitation printed
  none of them. These are that wedding's own shapes, not invented ones.
*/
test('the entourage prints prefix, middle name and suffix — not just first + last', () => {
  assert.equal(
    personName({ name_prefix: 'Atty.', first_name: 'Arnaldo', middle_name: 'M.', last_name: 'Espinas' }),
    'Atty. Arnaldo M. Espinas',
  );
  assert.equal(
    personName({ name_prefix: 'Associate Dean', first_name: 'Cecilio', last_name: 'Duka' }),
    'Associate Dean Cecilio Duka',
  );
  assert.equal(
    personName({ name_prefix: 'Atty.', first_name: 'Cherry', middle_name: 'Liez O.', last_name: 'Rafal-Roble' }),
    'Atty. Cherry Liez O. Rafal-Roble',
  );
  assert.equal(
    personName({ first_name: 'Juan', last_name: 'Cruz', name_suffix: 'Jr.' }),
    'Juan Cruz Jr.',
  );
});

test('an absent part leaves no double space', () => {
  // `${prefix} ${first} ${middle} ${last}` with three of them empty is the bug
  // this pins: a name must never carry a run of spaces a reader can see.
  const name = personName({ name_prefix: null, first_name: 'Bea', middle_name: null, last_name: 'Reyes', name_suffix: null });
  assert.equal(name, 'Bea Reyes');
  assert.ok(name && !/\s{2}/.test(name), 'a missing part left a double space');
});

test('a row that is nothing but whitespace is still dropped', () => {
  assert.equal(
    personName({ name_prefix: '  ', first_name: ' ', middle_name: '', last_name: '   ', name_suffix: null }),
    null,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   PAIRING — owner 2026-09-14: "two columns, paired across. but if the other
   side is left blank, then keep that line blank."

   The fixtures below are the REAL pairs from a live wedding (Cale & Ice,
   measured 2026-09-15) rather than invented ones: a Ninong with his Ninang, a
   same-role sponsor couple, and a bridesmaid with a groomsman — which is the
   case that forced two groups into one, because a pair split across two
   headings can never share a line.
   ══════════════════════════════════════════════════════════════════════════ */

const paired = (
  id: string,
  first: string,
  role: string,
  pair: string | null,
): EntourageGuestRow => ({
  guest_id: id,
  pair_with_guest_id: pair,
  first_name: first,
  last_name: 'X',
  role,
  extra_roles: null,
  display_name: null,
});

test('a Ninong and his Ninang share one line — him left, her right', () => {
  const [g] = buildEntourage([
    paired('a', 'Richard', 'principal_sponsor_ninong', 'b'),
    paired('b', 'Shirley', 'principal_sponsor_ninang', 'a'),
  ]);
  assert.equal(g!.rows.length, 1, 'the pair did not share a line');
  assert.deepEqual(
    g!.rows[0]!.map((p) => p?.name ?? null),
    ['Richard X', 'Shirley X'],
    'the sides are wrong — a Filipino invitation prints Ninong then Ninang',
  );
});

test('…and the Ninang still lands on the right when she is listed first', () => {
  /* Order of arrival must not decide the column when the ROLE can. */
  const [g] = buildEntourage([
    paired('b', 'Shirley', 'principal_sponsor_ninang', 'a'),
    paired('a', 'Richard', 'principal_sponsor_ninong', 'b'),
  ]);
  assert.deepEqual(g!.rows[0]!.map((p) => p?.name ?? null), ['Richard X', 'Shirley X']);
});

test('🔴 a bridesmaid pairs with a GROOMSMAN — the case that merged two groups', () => {
  const groups = buildEntourage([
    paired('g', 'Gerardine', 'bridesmaid', 'h'),
    paired('h', 'Gericho', 'groomsman', 'g'),
  ]);
  assert.deepEqual(groups.map((x) => x.key), ['bridesmaids_groomsmen'], 'they must share one group');
  assert.deepEqual(groups[0]!.rows[0]!.map((p) => p?.name ?? null), ['Gerardine X', 'Gericho X']);
});

test('a same-role pair still pairs — nothing in the role says which side', () => {
  const [g] = buildEntourage([
    paired('k', 'Katrina', 'candle_sponsor', 'c'),
    paired('c', 'Christopher', 'candle_sponsor', 'k'),
  ]);
  assert.equal(g!.rows.length, 1);
  assert.deepEqual(g!.rows[0]!.map((p) => p?.name ?? null), ['Katrina X', 'Christopher X']);
});

test('⚖ an unpartnered name KEEPS ITS LINE, with the other side blank', () => {
  const groups = buildEntourage([
    paired('g', 'Gerardine', 'bridesmaid', null),
    paired('h', 'Gericho', 'groomsman', null),
  ]);
  const rows = groups[0]!.rows.map((r) => r.map((p) => p?.name ?? null));
  assert.deepEqual(
    rows,
    [['Gerardine X', null], [null, 'Gericho X']],
    'an unpaired groomsman slid into the left column — he must stay on his own side',
  );
});

test('the legacy principal_sponsor sits left with an empty right — gender is not stored', () => {
  const [g] = buildEntourage([paired('p', 'Nelson', 'principal_sponsor', null)]);
  assert.deepEqual(g!.rows[0]!.map((p) => p?.name ?? null), ['Nelson X', null]);
});

test('🔑 a HALF-pair prints both people, once each — never drops one', () => {
  /* A points at B; B points at nobody. Unreachable through pair_guests(), which
     writes both halves in one statement — this is what the page does if one
     ever appears anyway. */
  const groups = buildEntourage([
    paired('a', 'Ana', 'candle_sponsor', 'b'),
    paired('b', 'Ben', 'candle_sponsor', null),
  ]);
  const names = peopleOf(groups[0]!).map((p) => p.name);
  assert.deepEqual(names.sort(), ['Ana X', 'Ben X'], 'somebody was dropped by a dangling pair');
  assert.equal(groups[0]!.rows.length, 2, 'a half-pair must not share a line');
});

test('a pointer at somebody outside this group does not steal them', () => {
  const groups = buildEntourage([
    paired('a', 'Ana', 'candle_sponsor', 'z'),
    paired('z', 'Zed', 'flower_girl', 'a'),
  ]);
  const sponsors = groups.find((g) => g.key === 'secondary_sponsors')!;
  const bearers = groups.find((g) => g.key === 'bearers')!;
  assert.deepEqual(sponsors.rows[0]!.map((p) => p?.name ?? null), ['Ana X', null]);
  assert.deepEqual(peopleOf(bearers).map((p) => p.name), ['Zed X']);
});

test('nobody is printed twice by pairing', () => {
  const groups = buildEntourage([
    paired('a', 'Ana', 'candle_sponsor', 'b'),
    paired('b', 'Ben', 'candle_sponsor', 'a'),
    paired('c', 'Cy', 'veil_sponsor', null),
  ]);
  const names = peopleOf(groups[0]!).map((p) => p.name);
  assert.equal(new Set(names).size, names.length, 'a name appears more than once');
  assert.equal(names.length, 3);
});
