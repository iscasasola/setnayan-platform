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
  holdersOfRoleInPrintOrder,
  ENTOURAGE_COLUMNS,
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

test('the groups print in invitation order — family, then the honour attendants', () => {
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
      // ⚖ Owner 2026-09-20: family leads, then the honour attendants ABOVE
      // both sponsor groups, and flower girls get their own heading.
      'parents',
      'honour',
      'principal_sponsors',
      'secondary_sponsors',
      'bridesmaids_groomsmen',
      'flower_girls',
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
  // Both share a surname, so the given name decides — a stable answer where
  // the old insertion order was whatever Postgres returned that second.
  assert.deepEqual(g!.rows[0]!.map((p) => p?.name ?? null), ['Christopher X', 'Katrina X']);
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
  // Owner 2026-09-20 split bearers and flower girls into two headings.
  const flowerGirls = groups.find((g) => g.key === 'flower_girls')!;
  assert.deepEqual(sponsors.rows[0]!.map((p) => p?.name ?? null), ['Ana X', null]);
  assert.deepEqual(peopleOf(flowerGirls).map((p) => p.name), ['Zed X']);
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

/**
 * ⚖ OWNER 2026-09-20: *"parents of the groom should go first"* — said of the
 * live invitation, which was printing the bride's parents above his.
 *
 * 🔑 THE ASSERTION IS ON THE PRINTED ROWS, NOT ON THE SPEC. Reading
 * `GROUPS[0].roles` back would only prove the constant equals itself; it is
 * `buildEntourage` that turns that order into the order a guest reads, and a
 * change to how it walks the spec is exactly the regression worth catching.
 * The fixture deliberately feeds the BRIDE's parents first, so a build that
 * merely preserves input order fails instead of passing by luck.
 */
test("the groom's parents print before the bride's", () => {
  const groups = buildEntourage([
    row({ first_name: 'Milagros', last_name: 'Buanhog', role: 'bride_parents' }),
    row({ first_name: 'Eufrocina', last_name: 'Casasola', role: 'groom_parents' }),
  ]);
  const parents = groups.find((g) => g.key === 'parents');
  assert.ok(parents, 'the parents group must render');
  assert.deepEqual(
    peopleOf(parents).map((p) => p.role),
    ['groom_parents', 'bride_parents'],
  );
});

// ── ⚖ Owner 2026-09-20 — family publishes, and the order stops being random ──

test('immediate family publishes, directly under Parents', () => {
  const groups = buildEntourage([
    row({ first_name: 'Bea', role: 'bridesmaid' }),
    row({ first_name: 'Juanita', role: 'groom_immediate_family' }),
    row({ first_name: 'Ent', role: 'bride_parents' }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.key),
    ['parents', 'immediate_family', 'bridesmaids_groomsmen'],
  );
  const family = groups.find((g) => g.key === 'immediate_family')!;
  assert.deepEqual(peopleOf(family).map((p) => p.name), ['Juanita B']);
});

test('an immediate-family role prints a LABEL, never a raw enum value', () => {
  // This file's own docblock used `bride_immediate_family` as the example of a
  // role that must never reach a guest's screen unlabelled. Now that it
  // publishes, the label is what keeps that true.
  assert.equal(roleLabel('bride_immediate_family'), "Bride's Family");
  assert.equal(roleLabel('groom_immediate_family'), "Groom's Family");
});

test('the printed order does not depend on the order the rows arrive in', () => {
  // 🔑 THE WHOLE POINT. Neither entourage query carries an ORDER BY, so the
  // input order is whatever Postgres returned that second. Same people, two
  // arrival orders, one printed result — or the invitation reshuffles itself
  // between page loads.
  const people = [
    row({ guest_id: '1', first_name: 'Rosa', last_name: 'Zamora', role: 'principal_sponsor_ninang' }),
    row({ guest_id: '2', first_name: 'Ana', last_name: 'Abad', role: 'principal_sponsor_ninang' }),
    row({ guest_id: '3', first_name: 'Mia', last_name: 'Molina', role: 'principal_sponsor_ninang' }),
  ];
  const forward = buildEntourage(people);
  const reversed = buildEntourage([...people].reverse());
  assert.deepEqual(forward, reversed);

  const names = peopleOf(forward.find((g) => g.key === 'principal_sponsors')!).map((p) => p.name);
  assert.deepEqual(names, ['Ana Abad', 'Mia Molina', 'Rosa Zamora']);
});

test('sorting is per ROLE — it never flattens the order inside a group', () => {
  // `spec.roles` order is meaningful (ninong before ninang). Sorting the whole
  // group by surname would put Abad the ninang above Zamora the ninong and
  // silently discard the convention.
  const groups = buildEntourage([
    row({ guest_id: '1', first_name: 'Ana', last_name: 'Abad', role: 'principal_sponsor_ninang' }),
    row({ guest_id: '2', first_name: 'Zeny', last_name: 'Zamora', role: 'principal_sponsor_ninong' }),
  ]);
  const sponsors = groups.find((g) => g.key === 'principal_sponsors')!;
  assert.deepEqual(
    peopleOf(sponsors).map((p) => p.role),
    ['principal_sponsor_ninong', 'principal_sponsor_ninang'],
  );
});

// ── ⚖ Owner 2026-09-20 — the couple's own walking order ─────────────────────

test("a hand-placed name outranks the alphabetical default", () => {
  const groups = buildEntourage([
    row({ guest_id: '1', first_name: 'Ana', last_name: 'Abad', role: 'principal_sponsor_ninang' }),
    row({ guest_id: '2', first_name: 'Zeny', last_name: 'Zamora', role: 'principal_sponsor_ninang', entourage_order: 0 }),
  ]);
  const names = peopleOf(groups.find((g) => g.key === 'principal_sponsors')!).map((p) => p.name);
  assert.deepEqual(names, ['Zeny Zamora', 'Ana Abad']);
});

test('placing SOME names does not scramble the rest', () => {
  // A couple who arranges three of their twelve should get those three on top
  // in their order, and an alphabetical tail — not an all-or-nothing rule that
  // makes the first drag meaningless until the twelfth.
  const groups = buildEntourage([
    row({ guest_id: '1', first_name: 'Ana', last_name: 'Abad', role: 'groomsman' }),
    row({ guest_id: '2', first_name: 'Boy', last_name: 'Bautista', role: 'groomsman', entourage_order: 1 }),
    row({ guest_id: '3', first_name: 'Cris', last_name: 'Cruz', role: 'groomsman' }),
    row({ guest_id: '4', first_name: 'Dino', last_name: 'Dizon', role: 'groomsman', entourage_order: 0 }),
  ]);
  const names = peopleOf(groups.find((g) => g.key === 'bridesmaids_groomsmen')!).map((p) => p.name);
  assert.deepEqual(names, ['Dino Dizon', 'Boy Bautista', 'Ana Abad', 'Cris Cruz']);
});

test('🔑 an UNPLACED name is not treated as position zero', () => {
  // The whole trap: `entourage_order ?? 0` would rank everyone the couple
  // never touched ABOVE the person they deliberately put first.
  const groups = buildEntourage([
    row({ guest_id: '1', first_name: 'Ana', last_name: 'Abad', role: 'bridesmaid' }),
    row({ guest_id: '2', first_name: 'Zeny', last_name: 'Zamora', role: 'bridesmaid', entourage_order: 0 }),
  ]);
  const names = peopleOf(groups.find((g) => g.key === 'bridesmaids_groomsmen')!).map((p) => p.name);
  assert.equal(names[0], 'Zeny Zamora');
});

test('holdersOfRoleInPrintOrder is the SAME order the invitation prints', () => {
  // The dashboard's Move ↑ acts on this; the public page prints buildEntourage.
  // If they ever disagree, "move her up" swaps her with somebody the couple
  // cannot see. Asserting they agree is the only thing that keeps them honest.
  const rows = [
    row({ guest_id: '1', first_name: 'Cris', last_name: 'Cruz', role: 'groomsman' }),
    row({ guest_id: '2', first_name: 'Ana', last_name: 'Abad', role: 'groomsman', entourage_order: 5 }),
    row({ guest_id: '3', first_name: 'Boy', last_name: 'Bautista', role: 'groomsman' }),
  ];
  const viaHelper = holdersOfRoleInPrintOrder(rows, 'groomsman').map((r) => r.guest_id);
  const printed = peopleOf(buildEntourage(rows).find((g) => g.key === 'bridesmaids_groomsmen')!)
    .filter((p) => p.role === 'groomsman')
    .map((p) => p.id);
  assert.deepEqual(viaHelper, printed);
});

test('the order column is actually asked for by the query', () => {
  // 🪤 The sort reads `entourage_order`; the two routes read ENTOURAGE_COLUMNS.
  // A column missing from that string arrives undefined on EVERY row, so the
  // override silently does nothing and the page falls back to surnames with
  // nothing red anywhere.
  assert.match(ENTOURAGE_COLUMNS, /\bentourage_order\b/);
});
