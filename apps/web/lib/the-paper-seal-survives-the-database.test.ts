import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

import { MAX_TRIES, fileTypedValues, mergeIntake, openSealedSlot, type PageRead } from './paper-intake';
import type { ModelPaperRead } from './verification-paper-read';

/**
 * W1-B37 (live, 18 Nov 2026) — "Type the details only after three tries." on a paper that HAD three tries.
 *
 * `doc_uploads` is a Postgres `jsonb` column, and jsonb does not keep key order: it stores an object's keys
 * shortest-first (measured on the live row: `rdo, tin, city, readAs, unsure, address, …`). The seal was an HMAC
 * over `JSON.stringify` of the slot, so the reader's model — written as `registry, accountName, ownerName, …` —
 * came back in a different order, the signature no longer matched, and `openSealedSlot` returned null for every
 * paper that carried a read. The typed form refused, and auto-verify saw every paper as unconfirmed.
 *
 * These tests save through a REAL Postgres (PGlite) between every step, exactly as the app does, because an
 * in-memory object never reorders its keys — which is how the old tests stayed green.
 */

const KEY = 'test-only-derived-key-not-a-secret';
const CTX = { nowIso: '2026-11-18T01:00:00.000Z', todayManila: '2026-11-18', key: KEY };

const birUnclear = (r2Key: string): PageRead => ({
  r2Key,
  page: null,
  fileProblem: null,
  qrTexts: [],
  model: {
    registry: 'bir', accountName: 'TEST W3 WALK PHOTOS', ownerName: 'JUAN DELA CRUZ', registrationNumber: null,
    rdo: null, address: null, city: null, barangay: null, expirationDate: null, readAs: null,
    couldNotRead: ['tin', 'address'], tin: null, unsure: [],
  } satisfies ModelPaperRead,
});

let db: PGlite;
test.before(async () => {
  db = new PGlite();
  await db.exec("create table apps (id int primary key, doc_uploads jsonb not null default '{}')");
  await db.exec('insert into apps (id) values (1)');
});
test.after(async () => {
  await db.close();
});

/** Save and load back through jsonb — what every server action does between two requests. */
async function roundTrip(next: Record<string, unknown>): Promise<unknown> {
  await db.query('update apps set doc_uploads = $1::jsonb where id = 1', [JSON.stringify(next)]);
  const r = await db.query<{ doc_uploads: unknown }>('select doc_uploads from apps where id = 1');
  return r.rows[0]!.doc_uploads;
}

test('B37: three refused BIR copies, saved each time, then "Send for checking" is ACCEPTED', async () => {
  let row: unknown = await roundTrip({});
  for (const k of ['try-1', 'try-2', 'try-3']) {
    row = await roundTrip(mergeIntake(row, [birUnclear(k)], CTX).next);
  }
  const stored = (row as Record<string, Record<string, unknown>>).bir_2303!;
  assert.equal(stored.attempts, MAX_TRIES);
  assert.equal(stored.manual, true);
  assert.equal(stored.r2_key, 'try-3');

  const sent = fileTypedValues(
    row,
    'bir_2303',
    { account_name: 'TEST W3 WALK PHOTOS', tin: '123-456-789-000', address: '1 Sample St', date: '2026-11-18' },
    KEY,
  );
  assert.equal(sent.ok ? 'accepted' : sent.error, 'accepted');

  // …and what was typed survives its OWN save: the paper still opens, typed values included.
  const after = await roundTrip(sent.ok ? sent.next : {});
  const s = openSealedSlot('bir_2303', (after as Record<string, unknown>).bir_2303, KEY);
  assert.ok(s, 'the typed paper opens after it is saved');
  assert.equal(s.typed?.tin, '123-456-789-000');
  assert.equal(s.typed_by_supplier, true);
});

test('a clean read still opens after a save — auto-verify and the name check depend on it', async () => {
  const clean = birUnclear('clean');
  clean.model = { ...clean.model!, registrationNumber: '210334871000', tin: '210-334-871-000', address: '1 Sample St, Pasig', city: 'Pasig', couldNotRead: [] };
  const row = await roundTrip(mergeIntake({}, [clean], CTX).next);
  assert.ok(openSealedSlot('bir_2303', (row as Record<string, unknown>).bir_2303, KEY));
});

test('the seal still refuses a change made in the database', async () => {
  let row: unknown = {};
  for (const k of ['a', 'b', 'c']) row = await roundTrip(mergeIntake(row, [birUnclear(k)], CTX).next);
  const forged = structuredClone(row) as Record<string, Record<string, unknown>>;
  (forged.bir_2303!.evidence as { model: Record<string, unknown> }).model.accountName = 'SOMEONE ELSE';
  assert.equal(openSealedSlot('bir_2303', forged.bir_2303, KEY), null);
  assert.equal(fileTypedValues(forged, 'bir_2303', { tin: '1' }, KEY).ok, false);
});
