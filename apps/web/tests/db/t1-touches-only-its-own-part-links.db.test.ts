/**
 * T1 (migration 20271349668764) TOUCHES ONLY THE PART LINKS OF THE SERVICES IT FOLDS OR HIDES.
 *
 * Step 11c re-points or drops the inspiration-part links of the 41 services it folds and the 15 it hides (⛔). A
 * service hidden or merged by anyone else — Setnayan's own `pabati` and the starter parts it supplies, an older fold —
 * is not this migration's to touch (controller audit of iscasasola/setnayan-platform#7887, 16 Nov 2026: the first
 * version deleted the links of EVERY hidden service). Asked as a diff: the replay without T1 against the replay with
 * it, for every link whose service T1 neither folds nor hides.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, createReplayedDb, versionOf } from './replay-migrations';

const T1 = '20271349668764';
const sql = readFileSync(join(MIGRATIONS_DIR, readdirSync(MIGRATIONS_DIR).find((f) => f.startsWith(`${T1}_`))!), 'utf8');
const folded = [...sql.matchAll(/SELECT public\.merge_canonical_service\('([a-z0-9_]+)'/g)].map((m) => m[1]!);
const hiddenList = sql.match(/SET marketplace_hidden = TRUE, updated_at = now\(\) WHERE canonical_service IN \(([^)]*)\)/)![1]!;
const hidden = [...hiddenList.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
const T1_KEYS = new Set([...folded, ...hidden]);

let withT1: PGlite;
let withoutT1: PGlite;
before(async () => {
  withT1 = (await createReplayedDb()).db;
  const others = new Set(readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).map(versionOf).filter((v) => v < T1));
  withoutT1 = (await createReplayedDb({ only: others })).db;
});
after(async () => {
  await withT1?.close();
  await withoutT1?.close();
});

const links = async (db: PGlite) =>
  (await db.query<{ slot_key: string; canonical_service: string }>(`SELECT slot_key, canonical_service FROM public.inspiration_part_services`)).rows
    .filter((r) => !T1_KEYS.has(r.canonical_service))
    .map((r) => `${r.slot_key} → ${r.canonical_service}`);

test('the list parse found the migration’s folds and hides', () => {
  assert.equal(folded.length, 41, 'the fold parse is broken, not the guard');
  assert.equal(hidden.length, 15, 'the hide parse is broken, not the guard');
});

test('⭐ no link to a service T1 neither folds nor hides is removed — Setnayan’s hidden pabati keeps its parts', async () => {
  const before = new Set(await links(withoutT1));
  const afterT1 = new Set(await links(withT1));
  const lost = [...before].filter((l) => !afterT1.has(l)).sort();
  assert.deepEqual(lost, [], 'T1 removed part links it does not own');
  const pabati = [...before].filter((l) => l.endsWith('→ pabati'));
  assert.ok(pabati.every((l) => afterT1.has(l)), 'Setnayan’s own pabati lost its parts');
});
