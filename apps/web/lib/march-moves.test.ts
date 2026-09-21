import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entourageLines, type EntourageGuestRow } from '@/lib/entourage';
import { joinVerdict, joinersFor, swapVerdict, swapsFor } from '@/lib/march-moves';

/*
 * ⚖ Owner 2026-09-21: tap or drag a name onto an empty "—" to pair them; drag
 * a name onto another name to swap. These pin WHICH moves are allowed — the
 * picker and the server both ask this module, so a wrong answer here is a
 * wrong answer on both.
 */

const g = (id: string, last: string, role: string, pair: string | null = null): EntourageGuestRow => ({
  guest_id: id,
  first_name: id.toUpperCase(),
  last_name: last,
  role,
  pair_with_guest_id: pair,
  entourage_order: null,
});

// Principal sponsors: Ninong left, Ninang right.
const sponsors = [
  g('n1', 'Abad', 'principal_sponsor_ninong', 'a1'),
  g('a1', 'Abad', 'principal_sponsor_ninang', 'n1'),
  g('n2', 'Bautista', 'principal_sponsor_ninong'), // alone, right side empty
  g('a2', 'Cruz', 'principal_sponsor_ninang'), // alone, left side empty
  g('n3', 'Diaz', 'principal_sponsor_ninong', 'a3'),
  g('a3', 'Diaz', 'principal_sponsor_ninang', 'n3'),
];
const L = entourageLines(sponsors, 'principal_sponsors');
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

test('the empty place beside a Ninong takes a Ninang — never another Ninong', () => {
  assert.equal(joinVerdict(L, 'principal_sponsors', 'n2', 'a2').ok, true);
  assert.equal(joinVerdict(L, 'principal_sponsors', 'n2', 'a3').ok, true, 'a paired Ninang may leave her line');
  const wrong = joinVerdict(L, 'principal_sponsors', 'n2', 'n3');
  assert.equal(wrong.ok, false);
  assert.match(!wrong.ok ? wrong.reason : '', /walks on the left/);
});

test('the picker offers exactly the people the server would accept, and says what it costs', () => {
  const offer = joinersFor(L, 'principal_sponsors', 'n2');
  assert.deepEqual(ids(offer), ['a1', 'a2', 'a3']);
  assert.equal(offer.find((o) => o.id === 'a3')?.note, 'now with N3 Diaz', 'moving a paired person must say who she leaves');
  assert.equal(offer.find((o) => o.id === 'a2')?.note, null);
});

test('a line that is already full has no empty place to join', () => {
  const v = joinVerdict(L, 'principal_sponsors', 'n1', 'a2');
  assert.equal(v.ok, false);
  assert.match(!v.ok ? v.reason : '', /already walks with someone/);
});

test('someone from another part of the entourage cannot take the place', () => {
  const rows = [...sponsors, g('b1', 'Esteban', 'bridesmaid')];
  const v = joinVerdict(entourageLines(rows, 'principal_sponsors'), 'principal_sponsors', 'n2', 'b1');
  assert.equal(v.ok, false);
});

test('swaps stay in one column when the group has sides', () => {
  assert.equal(swapVerdict(L, 'principal_sponsors', 'n1', 'n3').ok, true);
  assert.equal(swapVerdict(L, 'principal_sponsors', 'a1', 'a2').ok, true, 'a Ninang swaps with a lone Ninang');
  const cross = swapVerdict(L, 'principal_sponsors', 'n1', 'a3');
  assert.equal(cross.ok, false, 'a Ninong swapped with a Ninang would put two Ninongs on one line');
  assert.match(!cross.ok ? cross.reason : '', /different sides/);
  assert.deepEqual(ids(swapsFor(L, 'principal_sponsors', 'n1')), ['n2', 'n3']);
});

test('two people on the same line do not swap — they already walk together', () => {
  const v = swapVerdict(L, 'principal_sponsors', 'n1', 'a1');
  assert.equal(v.ok, false);
  assert.match(!v.ok ? v.reason : '', /already walk together/);
});

test('a group with ONE side lets anyone swap with anyone on another line', () => {
  const rows = [
    g('c1', 'Abad', 'candle_sponsor', 'c2'),
    g('c2', 'Bravo', 'candle_sponsor', 'c1'),
    g('v1', 'Cruz', 'veil_sponsor'),
  ];
  const lines = entourageLines(rows, 'secondary_sponsors');
  assert.equal(swapVerdict(lines, 'secondary_sponsors', 'c2', 'v1').ok, true, 'right-column name swaps with a left-column name');
  assert.equal(joinVerdict(lines, 'secondary_sponsors', 'v1', 'c2').ok, true);
});

/* ── sections (owner 2026-09-21: "arrange the parents, immediate family and
      other roles and modify its sequence") ─────────────────────────────── */
import { ENTOURAGE_GROUP_KEYS, buildEntourage, orderedGroupKeys, sectionsAreArranged } from '@/lib/entourage';
import { nextSectionOrder } from '@/lib/march-moves';

test('a saved order is forgiving: unknown keys drop, missing sections append, nothing doubles', () => {
  const out = orderedGroupKeys(['honour', 'retired_group', 'parents', 'honour']);
  assert.deepEqual(out.slice(0, 2), ['honour', 'parents']);
  assert.deepEqual([...out].sort(), [...ENTOURAGE_GROUP_KEYS].sort(), 'a section went missing or doubled');
  assert.deepEqual(orderedGroupKeys(null), [...ENTOURAGE_GROUP_KEYS], 'NULL must print the built-in order');
  assert.equal(sectionsAreArranged(null), false);
  assert.equal(sectionsAreArranged(['honour', 'parents']), true);
});

test('the invitation prints sections in the couple’s order', () => {
  const rows = [g('p1', 'Abad', 'groom_parents'), g('h1', 'Cruz', 'best_man')];
  assert.deepEqual(buildEntourage(rows).map((x) => x.key), ['parents', 'honour']);
  assert.deepEqual(buildEntourage(rows, ['honour', 'parents']).map((x) => x.key), ['honour', 'parents']);
});

test('a section step skips sections nobody is in — they are not drawn', () => {
  const full = ['parents', 'immediate_family', 'honour', 'principal_sponsors'];
  const visible = new Set(['parents', 'honour', 'principal_sponsors']);
  assert.deepEqual(nextSectionOrder(full, visible, 'honour', 'up'), ['honour', 'immediate_family', 'parents', 'principal_sponsors']);
  assert.deepEqual(nextSectionOrder(full, visible, 'parents', 'down'), ['honour', 'immediate_family', 'parents', 'principal_sponsors']);
  assert.equal(nextSectionOrder(full, visible, 'parents', 'up'), null, 'the first section cannot go up');
  assert.equal(nextSectionOrder(full, visible, 'immediate_family', 'down'), null, 'an empty section is not moved');
});
