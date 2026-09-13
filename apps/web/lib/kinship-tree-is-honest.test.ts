/**
 * kinship-tree-is-honest.test.ts — the tree may not lie about who is who.
 *
 * `kinship-derive.ts` shipped 2026-07-31 with no consumer. These are the
 * assertions that guard the renderer now attached to it, and each one is a
 * thing the screen MUST NOT do:
 *
 *   1. show a blood tita and a courtesy tita as the same fact,
 *   2. let courtesy volume crowd blood out of view,
 *   3. derive anything at all from a draft or a pending claim,
 *   4. state "no relatives" when the read was refused,
 *   5. print a name the 2026-07-05 name rule does not permit.
 *
 * Behaviour is driven through the REAL functions against a stubbed Supabase
 * client — not by reading the source — so a refactor that keeps the words and
 * loses the guarantee still fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveKin, type StoredEdge } from '@/lib/kinship-derive';
import { buildKinTree, viaPhrase, COURTESY_PREVIEW, LAYER_ORDER } from '@/lib/kinship-tree';
import {
  getKinFor,
  toStoredEdges,
  isPersonId,
  chunk,
  ID_CHUNK,
  EMPTY_KIN,
} from '@/lib/kinship-read-core';

// ── a family, in ids that read ────────────────────────────────────────────
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ME = id(1);
const MOM = id(2);
const MOMS_SISTER = id(3); // BLOOD tita
const FRIEND = id(4);
const FRIENDS_MOM = id(5); // COURTESY tita — the same word, a different fact
const COUSIN = id(6);
const STRANGER = id(7);

const e = (
  from: string,
  to: string,
  relation: StoredEdge['relation'],
  status: StoredEdge['status'] = 'confirmed',
): StoredEdge => ({ fromPersonId: from, toPersonId: to, relation, status });

/** Both kinds of tita, and a pinsan three hops out. */
const FAMILY: StoredEdge[] = [
  e(ME, MOM, 'parent'),
  e(MOM, MOMS_SISTER, 'sibling'),
  e(MOMS_SISTER, COUSIN, 'child'),
  e(ME, FRIEND, 'friend'),
  e(FRIEND, FRIENDS_MOM, 'parent'),
];

// ── 1 · both titas appear, and they are labelled differently ──────────────
test('a blood tita and a courtesy tita both appear, in different layers', () => {
  const tree = buildKinTree(deriveKin(ME, FAMILY));

  const find = (person: string) =>
    tree.layers.flatMap((l) => l.people).find((p) => p.personId === person);

  const blood = find(MOMS_SISTER);
  const courtesy = find(FRIENDS_MOM);

  assert.ok(blood, 'the mother’s sister must appear');
  assert.ok(courtesy, 'the friend’s mother must appear — courtesy kin are kin');

  // The WORD is deliberately identical; that is the whole point of the model.
  assert.equal(blood.label, 'Tito/Tita');
  assert.equal(courtesy.label, 'Tito/Tita');

  // The FACT is not. Distinguished by basis, by layer, and in words.
  assert.equal(blood.basis, 'blood');
  assert.equal(courtesy.basis, 'courtesy');
  assert.notEqual(blood.basis, courtesy.basis);
  assert.equal(blood.via, 'your parent’s sibling');
  assert.equal(courtesy.via, 'your friend’s parent');
  assert.notEqual(blood.via, courtesy.via);

  // They are not in the same box either.
  const layerOf = (b: string) => tree.layers.find((l) => l.people.some((p) => p.basis === b));
  assert.notEqual(layerOf('blood')?.basis, layerOf('courtesy')?.basis);
});

// ── 2 · blood must not be crowded out (owner, 2026-07-31) ─────────────────
test('blood is never collapsed, however many courtesy titas there are', () => {
  // One blood tita against forty courtesy ones — the owner's "yes tita can be
  // most", made numeric.
  const many: StoredEdge[] = [...FAMILY];
  for (let i = 0; i < 40; i++) {
    const friend = id(100 + i);
    many.push(e(ME, friend, 'friend'), e(friend, id(200 + i), 'parent'));
  }
  const tree = buildKinTree(deriveKin(ME, many));

  const bloodLayer = tree.layers.find((l) => l.basis === 'blood');
  const courtesyLayer = tree.layers.find((l) => l.basis === 'courtesy');
  assert.ok(bloodLayer && courtesyLayer);

  // Courtesy outnumbers blood many times over — the condition of the rule.
  assert.ok(
    courtesyLayer.people.length > bloodLayer.people.length * 5,
    'the test is meaningless unless courtesy really does outnumber blood',
  );

  // ...and blood is STILL shown in full, while courtesy is the layer capped.
  assert.equal(bloodLayer.collapseAfter, null, 'blood must never be behind a disclosure');
  assert.equal(courtesyLayer.collapseAfter, COURTESY_PREVIEW);

  // Blood comes first, always — a constant order, not a data-dependent sort.
  const first = tree.layers[0];
  assert.ok(first);
  assert.equal(first.basis, 'blood');
  assert.deepEqual([...LAYER_ORDER], ['blood', 'ritual', 'courtesy']);
});

test('ritual kin are their own layer and are never collapsed', () => {
  const tree = buildKinTree(deriveKin(ME, [...FAMILY, e(ME, id(9), 'godparent')]));
  const ritual = tree.layers.find((l) => l.basis === 'ritual');
  assert.ok(ritual, 'a godparent must render');
  assert.equal(ritual.collapseAfter, null);
  const ninong = ritual.people[0];
  assert.ok(ninong);
  assert.equal(ninong.label, 'Ninong/Ninang');
});

// ── 3 · a draft and a pending claim appear NOWHERE ───────────────────────
test('a draft edge and a pending edge derive nothing', () => {
  for (const status of ['draft', 'pending'] as const) {
    const edges: StoredEdge[] = [
      e(ME, MOM, 'parent'),
      // Someone unilaterally asserts a sibling of my mother. Unanswered.
      e(MOM, STRANGER, 'sibling', status),
    ];
    const tree = buildKinTree(deriveKin(ME, edges));
    const everyone = tree.layers.flatMap((l) => l.people).map((p) => p.personId);
    assert.ok(
      !everyone.includes(STRANGER),
      `a ${status} edge must not put anybody on the tree`,
    );
    assert.equal(tree.total, 0, `a ${status} edge must derive nothing at all`);
  }
});

test('toStoredEdges refuses every status but confirmed', () => {
  const rows = [
    { from_person_id: ME, to_person_id: MOM, relation: 'parent', status: 'confirmed' },
    { from_person_id: ME, to_person_id: STRANGER, relation: 'parent', status: 'pending' },
    { from_person_id: ME, to_person_id: STRANGER, relation: 'parent', status: 'draft' },
    { from_person_id: ME, to_person_id: STRANGER, relation: 'parent', status: 'declined' },
  ];
  const kept = toStoredEdges(rows);
  assert.equal(kept.length, 1);
  const only = kept[0];
  assert.ok(only);
  assert.equal(only.toPersonId, MOM);
  assert.ok(!kept.some((k) => k.toPersonId === STRANGER));
});

test('toStoredEdges refuses a relation outside the frozen seven, and a non-uuid', () => {
  assert.equal(
    toStoredEdges([
      { from_person_id: ME, to_person_id: MOM, relation: 'tita', status: 'confirmed' },
    ]).length,
    0,
    'extended kin is DERIVED, never stored — a stored "tita" is drift, not data',
  );
  assert.equal(
    toStoredEdges([
      { from_person_id: ME, to_person_id: 'not-a-uuid', relation: 'parent', status: 'confirmed' },
    ]).length,
    0,
  );
  assert.equal(isPersonId('not-a-uuid'), false);
  assert.equal(isPersonId(ME), true);
});

// ── the stub: a Supabase client that answers only what it is told to ─────
function stubClient(opts: {
  meError?: unknown;
  myPerson?: string | null;
  edges?: Array<Record<string, unknown>>;
  edgeError?: unknown;
}): SupabaseClient {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is']) chain[m] = () => chain;
      if (table === 'people') {
        chain.maybeSingle = async () => ({
          data:
            opts.myPerson === undefined
              ? { person_id: ME }
              : opts.myPerson === null
                ? null
                : { person_id: opts.myPerson },
          error: opts.meError ?? null,
        });
        return chain;
      }
      if (table === 'person_connections') {
        // ⚠ The stub filters BY INCIDENCE, exactly as PostgREST would. Returning
        // every edge on the first hop would make "pinsan is distance 3" pass
        // without the walk ever expanding — a check that cannot fail.
        chain.or = async (expr: string) => {
          if (opts.edgeError) return { data: null, error: opts.edgeError };
          const asked = new Set(expr.match(/[0-9a-f-]{36}/gi) ?? []);
          const hit = (opts.edges ?? []).filter(
            (r) => asked.has(String(r.from_person_id)) || asked.has(String(r.to_person_id)),
          );
          return { data: hit, error: null };
        };
        return chain;
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

const rows = (edges: StoredEdge[]) =>
  edges.map((x) => ({
    from_person_id: x.fromPersonId,
    to_person_id: x.toPersonId,
    relation: x.relation,
    status: x.status,
  }));

// ── 4 · a refused read is UNKNOWN, never an empty family ─────────────────
test('a refused person read reports unmeasured, not an empty tree', async () => {
  const client = stubClient({ meError: { message: 'permission denied' } });
  const out = await getKinFor(client, () => client, 'user-1');
  assert.equal(out.measured, false, 'a denial must NOT read as "no relatives"');
  assert.equal(out.kin.length, 0);
});

test('a refused edge read reports unmeasured, not an empty tree', async () => {
  const client = stubClient({ edgeError: { message: 'permission denied' } });
  const out = await getKinFor(client, () => client, 'user-1');
  assert.equal(out.measured, false);
});

test('an admin client that cannot be built reports unmeasured', async () => {
  const client = stubClient({});
  const out = await getKinFor(
    client,
    () => {
      throw new Error('Missing SUPABASE env vars for admin client.');
    },
    'user-1',
  );
  assert.equal(out.measured, false, 'a missing service key must not empty the family');
});

test('having no person row IS a real answer — measured and empty', async () => {
  const client = stubClient({ myPerson: null });
  const out = await getKinFor(client, () => client, 'user-1');
  assert.deepEqual(out, EMPTY_KIN);
  assert.equal(out.measured, true, 'never connected is genuinely empty, not unknown');
});

test('the walk derives both titas end to end, through the real read', async () => {
  const client = stubClient({ edges: rows(FAMILY) });
  const out = await getKinFor(client, () => client, 'user-1');
  assert.equal(out.measured, true);
  const titas = out.kin.filter((k) => k.kind === 'parent-sibling');
  assert.equal(titas.length, 2, 'one blood, one courtesy');
  assert.deepEqual(titas.map((t) => t.basis).sort(), ['blood', 'courtesy']);
  // The three-hop walk must reach a pinsan, or the ring is too short.
  assert.ok(out.kin.some((k) => k.kind === 'cousin' && k.personId === COUSIN), 'pinsan is distance 3');
});

test('a draft edge cannot reach the tree through the read either', async () => {
  const client = stubClient({
    edges: rows([e(ME, MOM, 'parent'), e(MOM, STRANGER, 'sibling', 'draft')]),
  });
  const out = await getKinFor(client, () => client, 'user-1');
  assert.equal(out.measured, true);
  assert.ok(!out.kin.some((k) => k.personId === STRANGER));
});

// ── 5 · names only where permitted ───────────────────────────────────────
test('a person the name rule does not permit renders with NO name', () => {
  const permitted = new Map([[MOMS_SISTER, 'Tita Baby']]);
  const tree = buildKinTree(deriveKin(ME, FAMILY), (p) => permitted.get(p) ?? null);
  const all = tree.layers.flatMap((l) => l.people);

  const named = all.find((p) => p.personId === MOMS_SISTER);
  assert.equal(named?.name, 'Tita Baby', 'a confirmed connection may be named');

  const unnamed = all.find((p) => p.personId === FRIENDS_MOM);
  assert.ok(unnamed, 'she is still ON the tree');
  assert.equal(unnamed.name, null, 'but she is NOT named');

  // The placeholder must not leak the id in the name slot either.
  for (const p of all) {
    if (p.name !== null) assert.notEqual(p.name, p.personId);
  }
});

test('viaPhrase reads as a possessive walk outwards from you', () => {
  assert.equal(viaPhrase(['parent', 'sibling']), 'your parent’s sibling');
  assert.equal(viaPhrase(['friend', 'parent']), 'your friend’s parent');
  assert.equal(viaPhrase(['parent', 'sibling', 'child']), 'your parent’s sibling’s child');
  assert.equal(viaPhrase([]), 'you');
});

// ── 6 · a big family must not 414 its way to "unknown" ───────────────────
test('the ring is chunked, so a large family does not blow the URL length', () => {
  const ids = Array.from({ length: 250 }, (_, i) => id(1000 + i));
  const parts = chunk(ids);
  assert.equal(parts.length, 3, '250 ids over a 100 cap is three requests');
  assert.deepEqual(parts.flat(), ids, 'chunking must not drop or reorder anybody');
  assert.ok(parts.every((p) => p.length <= ID_CHUNK));
  assert.equal(chunk([]).length, 0);
});

test('a family larger than one chunk still derives every tita', async () => {
  // 150 friends — over the 100-id chunk — each contributing a courtesy tita.
  const edges: StoredEdge[] = [e(ME, MOM, 'parent'), e(MOM, MOMS_SISTER, 'sibling')];
  for (let i = 0; i < 150; i++) {
    const friend = id(2000 + i);
    edges.push(e(ME, friend, 'friend'), e(friend, id(5000 + i), 'parent'));
  }
  const client = stubClient({ edges: rows(edges) });
  const out = await getKinFor(client, () => client, 'user-1');

  assert.equal(out.measured, true, 'a big family must not degrade to "unknown"');
  const titas = out.kin.filter((k) => k.kind === 'parent-sibling');
  // 150 courtesy + 1 blood. If chunking dropped a request this comes up short.
  assert.equal(titas.length, 151);
  assert.equal(titas.filter((t) => t.basis === 'blood').length, 1);
  assert.equal(titas.filter((t) => t.basis === 'courtesy').length, 150);
});
