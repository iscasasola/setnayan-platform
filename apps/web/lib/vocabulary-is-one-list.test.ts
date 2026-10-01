/**
 * vocabulary-is-one-list.test.ts — the relationship words are ONE list, in
 * every place that holds them.
 *
 * Owner, 2026-09-29: *"add partner (to become a couple)"* — the first new
 * stored word since OD7 froze the vocabulary at seven (2026-07-30).
 *
 * A word lives in four places: the database CHECK
 * (`person_connections_relation_check`, and its twin on `proposed_relation`),
 * `CONNECTION_RELATIONS` (what the actions and the roster accept), the kinship
 * reader's allow-list (`toStoredEdges`), and the derivation's inverse table.
 * Add it to three and forget the fourth and nothing crashes:
 *   · forgotten in the CHECK → every write of it is refused;
 *   · forgotten in the reader → every confirmed edge of it is dropped, and a
 *     partner's parents silently never become biyenan;
 *   · a CHECK re-listed WITHOUT an old value → every row still holding that
 *     value can no longer be written (memory: "a re-listed CHECK vocabulary
 *     drops a later value").
 * So this reads the CHECK out of the migrations — the LAST migration to define
 * it wins, exactly as replay applies them — and holds all four to one list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONNECTION_RELATIONS, INVERSE_RELATION, DECLARABLE_RELATIONS } from './people-connections';
import { RELATION_LABEL } from './people-add';
import { toStoredEdges } from './kinship-read-core';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

/** The value list of the LAST migration that (re)defines `constraint`. */
function lastCheckValues(constraint: string): { file: string; values: string[] } {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let found: { file: string; values: string[] } | null = null;
  const re = new RegExp(
    `ADD CONSTRAINT ${constraint} CHECK \\(([\\s\\S]*?)\\);`,
    'g',
  );
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    for (const m of sql.matchAll(re)) {
      const arr = m[1]!.match(/ARRAY\[([^\]]*)\]/);
      if (!arr) continue;
      found = { file: f, values: [...arr[1]!.matchAll(/'([a-z_]+)'/g)].map((v) => v[1]!) };
    }
  }
  assert.ok(found, `no migration defines ${constraint} — re-anchor this test`);
  return found!;
}

/** The seven words stored before 2026-09-29. Every one must survive. */
const HISTORICAL = ['spouse', 'parent', 'child', 'sibling', 'godparent', 'godchild', 'friend'];

test('🔴 the database CHECK holds partner AND every word it held before', () => {
  const { file, values } = lastCheckValues('person_connections_relation_check');
  for (const v of HISTORICAL) {
    assert.ok(values.includes(v), `${file} re-lists the vocabulary WITHOUT '${v}' — rows holding it become unwritable`);
  }
  assert.ok(values.includes('partner'), `${file} does not allow 'partner'`);
});

test('🔴 the CHECK, the app’s list and the asked-label CHECK are the SAME list', () => {
  const stored = lastCheckValues('person_connections_relation_check').values.sort();
  const asked = lastCheckValues('person_connections_proposed_relation_check').values.sort();
  const app = [...CONNECTION_RELATIONS].sort();
  assert.deepEqual(app, stored, 'the app accepts a word the database refuses, or the reverse');
  assert.deepEqual(asked, stored, 'a label can be asked that could never be agreed, or the reverse');
});

test('🔴 the kinship reader keeps EVERY stored word — a dropped word derives nothing, silently', () => {
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';
  for (const relation of CONNECTION_RELATIONS) {
    const kept = toStoredEdges([{ from_person_id: A, to_person_id: B, relation, status: 'confirmed' }]);
    assert.equal(kept.length, 1, `toStoredEdges drops a confirmed '${relation}' edge`);
  }
});

test('every word reads back across the edge, has a label, and partner can be picked', () => {
  for (const r of CONNECTION_RELATIONS) {
    assert.ok(CONNECTION_RELATIONS.includes(INVERSE_RELATION[r]), `${r} has no inverse`);
    assert.equal(INVERSE_RELATION[INVERSE_RELATION[r]], r, `${r} does not turn back into itself`);
    assert.ok(RELATION_LABEL[r], `${r} has no label`);
  }
  assert.equal(INVERSE_RELATION.partner, 'partner', 'a partnership is one fact — the same word both ways');
  assert.ok(DECLARABLE_RELATIONS.includes('partner'), 'partner is not declarable');
  assert.equal(RELATION_LABEL.partner, 'Partner');
});
