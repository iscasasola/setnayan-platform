/**
 * an-ai-reads-the-receipt.db.test.ts — the advisory read is reachable by the
 * service role and by nobody else, and it cannot store a verdict that lies.
 *
 * 🔑 THE GRANT AND THE POLICY ARE CHECKED TOGETHER. A policy without a matching
 * grant is never reached — Postgres checks the grant first — which is how a
 * DELETE policy shipped on `community_members` that nobody could ever exercise
 * (2026-08-24). And a PERMISSIVE `FOR ALL` policy would admit INSERT alongside
 * the read, the exact shape behind eight forgeries on 2026-08-12.
 *
 * ⚠ WHAT IS IN THIS TABLE MATTERS MORE THAN USUAL: reference numbers and peso
 * figures lifted off other people's bank receipts. "Silently empty to a browser"
 * is the whole security model, so it is asserted rather than trusted.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATIONS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../supabase/migrations');
const FILE = '20271176980266_an_ai_reads_the_payment_receipt.sql';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the read is reachable by the service role and by nobody else', async () => {
  const policies = await db.query<{ cmd: string }>(
    `SELECT cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'payment_receipt_reads'`,
  );
  assert.deepEqual(
    policies.rows.map((r) => r.cmd),
    [],
    'the advisory table grew a policy — read the migration header before adding one',
  );

  // 🔑 COLUMN GRANTS TOO, NOT ONLY TABLE GRANTS. `has_table_privilege` answers
  // FALSE while a column grant stands — the trap that made a table-level audit
  // read `papic_photos` as closed while `authenticated` held INSERT on all 39
  // columns (2026-08-26).
  const tableGrants = await db.query<{ privilege_type: string; grantee: string }>(
    `SELECT privilege_type, grantee FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='payment_receipt_reads'
        AND grantee IN ('anon','authenticated','PUBLIC')`,
  );
  const colGrants = await db.query<{ privilege_type: string; grantee: string; column_name: string }>(
    `SELECT privilege_type, grantee, column_name FROM information_schema.column_privileges
      WHERE table_schema='public' AND table_name='payment_receipt_reads'
        AND grantee IN ('anon','authenticated','PUBLIC')`,
  );
  const held = [
    ...tableGrants.rows.map((r) => `${r.grantee}:${r.privilege_type}`),
    ...colGrants.rows.map((r) => `${r.grantee}:${r.privilege_type}(${r.column_name})`),
  ].sort();
  assert.deepEqual(held, [], `bank-receipt facts became reachable from a browser: ${held.join(', ')}`);
});

test('the migration enables row security', async () => {
  // 🪤 `relrowsecurity` IS VACUOUS IN THIS REPLAY (measured 2026-08-26): a new
  // table with no policy and no ALTER already reports it true, so querying the
  // flag proves nothing. The honest check is that the migration SAYS it, because
  // that is what runs in production.
  const migration = readFileSync(join(MIGRATIONS, FILE), 'utf8');
  assert.match(
    migration,
    /ALTER TABLE public\.payment_receipt_reads ENABLE ROW LEVEL SECURITY;/,
    'the migration stopped enabling row security',
  );
});

test('a verdict may be NULL — "we could not answer" must be storable', async () => {
  // The whole no-accusation rule depends on this. If the columns were NOT NULL,
  // an unreadable picture would have to be recorded as FALSE, which renders on
  // screen as "that number is not on their receipt".
  await db.query(
    `INSERT INTO public.payment_receipt_reads (payment_id, status, summary)
     SELECT gen_random_uuid(), 'unreadable', 'could not read it'
     WHERE false`,
  );
  const cols = await db.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='payment_receipt_reads'
        AND column_name IN ('reference_matches','amount_matches')`,
  );
  assert.equal(cols.rows.length, 2, 'a verdict column went missing');
  for (const c of cols.rows) {
    assert.equal(c.is_nullable, 'YES', `${c.column_name} can no longer say "we do not know"`);
  }
});

test('the CHECKs that keep a verdict honest actually exist', async () => {
  /*
    🪤 REV 1 ASSERTED THESE BY FAILING AN INSERT, AND THAT WAS NOT A MEASUREMENT.
    Every insert in this file names a `gen_random_uuid()` payment that does not
    exist, so the FOREIGN KEY refuses the row first — and `assert.rejects` on
    /violates|constraint/ is satisfied by the WRONG constraint. Deleting both
    CHECKs would have left those tests green. Read the constraint instead.
  */
  const rows = await db.query<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.payment_receipt_reads'::regclass AND contype = 'c'`,
  );
  const by = new Map(rows.rows.map((r) => [r.conname, r.def]));

  const status = by.get('payment_receipt_reads_status_chk');
  assert.ok(status, 'the status CHECK is gone — any word could be stored');
  for (const allowed of ['ok', 'unreadable', 'failed']) {
    assert.match(status, new RegExp(`'${allowed}'`), `status no longer admits '${allowed}'`);
  }
  // 'verified' is exactly the word this column must never hold: it would render
  // as a claim that the payment itself was checked, which nothing here does.
  assert.equal(/'verified'/.test(status), false, "status now admits 'verified'");

  assert.match(
    by.get('payment_receipt_reads_ok_has_summary_chk') ?? '',
    /summary IS NOT NULL/,
    'an "ok" read may now be stored with nothing to show the admin',
  );
  assert.match(
    by.get('payment_receipt_reads_failed_has_error_chk') ?? '',
    /error IS NOT NULL/,
    'a "failed" read may now be stored with no reason — the admin sees a blank card',
  );
});
