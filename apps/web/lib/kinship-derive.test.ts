import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveKin,
  derivedTitoTita,
  kinLabel,
  buildAdjacency,
  type StoredEdge,
  type Sex,
} from './kinship-derive';

/** relation = what `to` IS to `from`. Getting this backwards is the easy bug. */
const edge = (
  from: string,
  to: string,
  relation: StoredEdge['relation'],
  status: StoredEdge['status'] = 'confirmed',
): StoredEdge => ({ fromPersonId: from, toPersonId: to, relation, status });

const sexes: Record<string, Sex> = { dad: 'M', mum: 'F', uncle: 'M', auntie: 'F' };
const sexOf = (id: string): Sex => sexes[id] ?? null;

/* ── the owner's rule, both halves ── */

test('BLOOD: a parent’s sibling is tito/tita', () => {
  const kin = derivedTitoTita('me', [edge('me', 'dad', 'parent'), edge('dad', 'uncle', 'sibling')], sexOf);
  assert.equal(kin.length, 1);
  assert.equal(kin[0]!.personId, 'uncle');
  assert.equal(kin[0]!.basis, 'blood');
  assert.equal(kin[0]!.label, 'Tito');
});

test('COURTESY: a friend’s parent is ALSO tito/tita — the rule generic trees miss', () => {
  const kin = derivedTitoTita(
    'me',
    [edge('me', 'ben', 'friend'), edge('ben', 'auntie', 'parent')],
    sexOf,
  );
  assert.equal(kin.length, 1);
  assert.equal(kin[0]!.personId, 'auntie');
  assert.equal(kin[0]!.basis, 'courtesy');
  assert.equal(kin[0]!.label, 'Tita');
});

test('tito AND tita — gendered by the person, not fixed to one', () => {
  const kin = derivedTitoTita(
    'me',
    [edge('me', 'dad', 'parent'), edge('dad', 'uncle', 'sibling'), edge('dad', 'auntie', 'sibling')],
    sexOf,
  );
  assert.deepEqual(kin.map((k) => k.label).sort(), ['Tita', 'Tito']);
});

test('the two bases are DISTINGUISHABLE even though the word is identical', () => {
  // "My mother's sister" and "my mother's best friend" are both Tita and are
  // not the same fact. If this collapses, the tree loses the distinction.
  const kin = derivedTitoTita(
    'me',
    [
      edge('me', 'mum', 'parent'),
      edge('mum', 'auntie', 'sibling'),
      edge('me', 'ben', 'friend'),
      edge('ben', 'ninang', 'parent'),
    ],
    sexOf,
  );
  const byId = Object.fromEntries(kin.map((k) => [k.personId, k.basis]));
  assert.equal(byId.auntie, 'blood');
  assert.equal(byId.ninang, 'courtesy');
  assert.equal(kin.every((k) => k.label.startsWith('Tit')), true);
});

test('blood WINS when someone is reachable both ways', () => {
  // Your friend's mother who is also genuinely your aunt is your aunt.
  const kin = derivedTitoTita(
    'me',
    [
      edge('me', 'mum', 'parent'),
      edge('mum', 'auntie', 'sibling'),
      edge('me', 'ben', 'friend'),
      edge('ben', 'auntie', 'parent'),
    ],
    sexOf,
  );
  assert.equal(kin.length, 1, 'one person, one tita entry');
  assert.equal(kin[0]!.basis, 'blood');
});

test('unbounded is CORRECT — "yes tita can be most"', () => {
  // Five friends, five sets of parents, ten titos/titas. Not a defect.
  const edges: StoredEdge[] = [];
  for (let i = 0; i < 5; i++) {
    edges.push(edge('me', `friend${i}`, 'friend'));
    edges.push(edge(`friend${i}`, `mother${i}`, 'parent'));
    edges.push(edge(`friend${i}`, `father${i}`, 'parent'));
  }
  assert.equal(derivedTitoTita('me', edges).length, 10);
});

/* ── only confirmed edges are facts ── */

test('a PENDING claim derives nothing — one person cannot populate another’s tree', () => {
  const kin = deriveKin('me', [
    edge('me', 'dad', 'parent', 'pending'),
    edge('dad', 'uncle', 'sibling'),
  ]);
  assert.deepEqual(kin, []);
});

test('a DRAFT derives nothing — it is private, not established', () => {
  const kin = deriveKin('me', [
    edge('me', 'dad', 'parent', 'draft'),
    edge('dad', 'uncle', 'sibling'),
  ]);
  assert.deepEqual(kin, []);
});

test('a DECLINED edge derives nothing', () => {
  const kin = deriveKin('me', [
    edge('me', 'dad', 'parent', 'declined'),
    edge('dad', 'uncle', 'sibling'),
  ]);
  assert.deepEqual(kin, []);
});

/* ── direction ── */

test('edges walk BOTH ways with the relation inverted', () => {
  // Recorded once as "X is my parent"; X must still see me as their child.
  const adj = buildAdjacency([edge('me', 'dad', 'parent')]);
  assert.deepEqual(adj.get('me')?.map((n) => n.relation), ['parent']);
  assert.deepEqual(adj.get('dad')?.map((n) => n.relation), ['child']);
});

test('the grandparent chain reads in the right direction', () => {
  const kin = deriveKin('me', [edge('me', 'dad', 'parent'), edge('dad', 'lolo', 'parent')], sexOf);
  const g = kin.find((k) => k.kind === 'grandparent');
  assert.equal(g?.personId, 'lolo');
  // and NOT the reverse — my child's child is an apo, not a lolo
  assert.equal(kin.find((k) => k.kind === 'grandchild'), undefined);
});

/* ── the rest of the vocabulary ── */

test('cousins, niblings, apo, in-laws all derive', () => {
  const kin = deriveKin('me', [
    edge('me', 'dad', 'parent'),
    edge('dad', 'uncle', 'sibling'),
    edge('uncle', 'cousin1', 'child'),
    edge('me', 'sis', 'sibling'),
    edge('sis', 'nephew', 'child'),
    edge('me', 'kid', 'child'),
    edge('kid', 'apo1', 'child'),
    edge('me', 'wife', 'spouse'),
    edge('wife', 'bayaw1', 'sibling'),
  ]);
  const kinds = new Set(kin.map((k) => k.kind));
  for (const expected of ['cousin', 'nibling', 'grandchild', 'sibling-in-law', 'parent-sibling']) {
    assert.ok(kinds.has(expected as never), `missing ${expected}`);
  }
});

test('balae — your child’s spouse’s parents', () => {
  const kin = deriveKin('me', [
    edge('me', 'kid', 'child'),
    edge('kid', 'inlaw-spouse', 'spouse'),
    edge('inlaw-spouse', 'balae1', 'parent'),
  ]);
  assert.ok(kin.some((k) => k.kind === 'co-parent-in-law' && k.personId === 'balae1'));
});

test('ninong/ninang are surfaced from the stored ritual layer, not invented', () => {
  const kin = deriveKin('me', [edge('me', 'ninong1', 'godparent')], () => 'M');
  const g = kin.find((k) => k.kind === 'godparent');
  assert.equal(g?.label, 'Ninong');
  assert.equal(g?.basis, 'ritual');
});

/* ── gender + OD6's boundary ── */

test('unknown sex falls back to a paired label, never a guess', () => {
  assert.equal(kinLabel('grandparent', null), 'Lolo/Lola');
  assert.equal(kinLabel('parent-sibling', undefined), 'Tito/Tita');
  assert.equal(kinLabel('grandparent', 'F'), 'Lola');
});

test('a tree legitimately MIXES gendered and paired labels', () => {
  // OD6: sex lives on users/dependents, not on `people`, and `people` can hold
  // someone with no account. The mix is expected — it should look deliberate.
  const kin = derivedTitoTita(
    'me',
    [edge('me', 'dad', 'parent'), edge('dad', 'uncle', 'sibling'), edge('dad', 'unknown1', 'sibling')],
    sexOf,
  );
  assert.deepEqual(kin.map((k) => k.label).sort(), ['Tito', 'Tito/Tita']);
});

/* ── inertness: what makes this safe to ship pre-counsel ── */

test('zero edges derive zero kin — provably inert while the flag is off', () => {
  assert.deepEqual(deriveKin('me', []), []);
  assert.deepEqual(derivedTitoTita('me', []), []);
});

test('ego never appears in their own derived kin', () => {
  const kin = deriveKin('me', [edge('me', 'sis', 'sibling'), edge('sis', 'me', 'sibling')]);
  assert.ok(kin.every((k) => k.personId !== 'me'));
});

test('every derived relation carries its chain, so "why is this person here?" is answerable', () => {
  const kin = derivedTitoTita('me', [edge('me', 'ben', 'friend'), edge('ben', 'auntie', 'parent')]);
  assert.deepEqual(kin[0]!.via, ['friend', 'parent']);
});
