/**
 * A TRADE WE DO NOT HAVE — the drafts table, against a real replayed schema.
 *
 * The unit guards beside this one read SOURCE. This one RUNS the migration and
 * asks the database the questions that decide whether a supplier can forge one
 * of our own suggestions, and whether a draft can ever get in the way of the
 * taxonomy work it is meant to serve.
 *
 * ⚠ THE REPLAY RUNS AS SUPERUSER, so it cannot prove an RLS policy REFUSES
 * anybody. What it can prove — and what is asserted here — is the SHAPE the
 * refusal rests on: row security is on, the only policy names `is_admin()`, no
 * policy admits `anon`, and `anon` holds no privilege on the table. Each of
 * those is checked against the catalog, not against a comment.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const TABLE = 'taxonomy_category_request_drafts';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

/** A pending request to hang a draft off. Vendor + profile seeded minimally. */
async function seedRequest(label = 'Pet grooming for weddings'): Promise<string> {
  const row = await one<{ vendor_profile_id: string }>(
    `INSERT INTO vendor_profiles (business_name) VALUES ('Barkada Pet Studio')
     RETURNING vendor_profile_id`,
  );
  const req = await one<{ request_id: string }>(
    `INSERT INTO taxonomy_category_requests (proposed_by_vendor_id, proposed_label)
     VALUES ($1, $2) RETURNING request_id`,
    [row?.vendor_profile_id, label],
  );
  assert.ok(req?.request_id, 'could not seed a request');
  return req.request_id;
}

async function insertDraft(requestId: string, overrides: Record<string, string> = {}) {
  const cols: Record<string, string> = {
    request_id: `'${requestId}'`,
    suggested_label: `'Pet Attendants'`,
    verdict: `'new'`,
    drafted_by: `'claude-haiku-4-5'`,
    ...overrides,
  };
  await db.query(
    `INSERT INTO ${TABLE} (${Object.keys(cols).join(',')})
     VALUES (${Object.values(cols).join(',')})`,
  );
}

test('the table exists with the columns the drafter writes', async () => {
  const r = await db.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY column_name`,
    [TABLE],
  );
  const names = r.rows.map((c) => c.column_name);
  assert.deepEqual(names, [
    'closest_existing',
    'drafted_at',
    'drafted_by',
    'near_matches',
    'request_id',
    'suggested_label',
    'suggested_tile_id',
    'tile_reason',
    'verdict',
  ]);
});

test('row security is ON and the ONLY policy is the admin one', async () => {
  const rls = await one<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.${TABLE}')`,
  );
  // ⚠ This flag is VACUOUS in the replay on its own (a brand-new table already
  // reports it on) — recorded in the corpus as a repo-wide blind spot. The
  // policy census below is what actually carries this test.
  assert.equal(rls?.relrowsecurity, true);

  const pol = await db.query<{ policyname: string; roles: string; qual: string | null; cmd: string }>(
    `SELECT policyname, roles::text AS roles, qual, cmd FROM pg_policies
     WHERE schemaname='public' AND tablename=$1`,
    [TABLE],
  );
  assert.equal(pol.rows.length, 1, 'a second policy appeared — read it before trusting this table');
  const p = pol.rows[0];
  assert.equal(p?.cmd, 'ALL');
  assert.match(String(p?.qual), /is_admin/);
  assert.equal(
    String(p?.roles).includes('anon'),
    false,
    'a policy now names anon — the drafts are working notes about a supplier, not a public page',
  );
  assert.equal(
    String(p?.qual).includes('vendor_profiles'),
    false,
    'a policy now reaches vendor_profiles — a supplier must not be able to write our own suggestion',
  );
});

test('anon holds NO privilege on the table — the second lock, not the only one', async () => {
  // Anti-vacuity, and it EARNED ITS KEEP on the first run: the control was
  // originally `taxonomy_category_requests`, which reads FALSE — that table is
  // in one of the shipped anon-revoke batches — and the whole test failed for
  // a reason that had nothing to do with this migration. `canonical_service_
  // aliases` is the right control: created one migration before this one, with
  // no grant statement of its own, so it carries the schema's DEFAULT ACL and
  // proves both that the replay reproduces that default for a brand-new table
  // and that the probe can answer TRUE at all. Without it, a replay that
  // simply never granted anon anything would make the loop below vacuous.
  const control = await one<{ ok: boolean }>(
    `SELECT has_table_privilege('anon', 'public.canonical_service_aliases', 'SELECT') AS ok`,
  );
  assert.equal(control?.ok, true, 'the probe itself is broken — it answers false for everything');

  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const r = await one<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', $1, $2) AS ok`,
      [`public.${TABLE}`, priv],
    );
    assert.equal(r?.ok, false, `anon still holds ${priv}`);
  }
});

test('a draft cannot outlive its request', async () => {
  const requestId = await seedRequest();
  await insertDraft(requestId);
  await db.query(`DELETE FROM taxonomy_category_requests WHERE request_id = $1`, [requestId]);
  const left = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${TABLE} WHERE request_id = $1`,
    [requestId],
  );
  assert.equal(left?.n, 0, 'a deleted request left an orphaned opinion behind');
});

test('one draft per request — a re-draft replaces, it never accumulates', async () => {
  const requestId = await seedRequest('Table linen rental');
  await insertDraft(requestId);
  await assert.rejects(() => insertDraft(requestId), /duplicate key|unique/i);
});

test('an invented verdict is refused by the database', async () => {
  const requestId = await seedRequest('Sound hire');
  await assert.rejects(
    () => insertDraft(requestId, { verdict: `'minted'` }),
    /tcrd_verdict_chk|check constraint/i,
  );
});

test('near_matches must be an ARRAY — a bare object would render as nothing', async () => {
  const requestId = await seedRequest('Generator hire');
  await assert.rejects(
    () => insertDraft(requestId, { near_matches: `'{"a":1}'::jsonb` }),
    /tcrd_near_matches_is_array_chk|check constraint/i,
  );
});

test('closest_existing carries NO foreign key, so a draft can never block a trade merge', async () => {
  const fks = await db.query<{ column_name: string }>(
    `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='FOREIGN KEY'`,
    [TABLE],
  );
  const cols = fks.rows.map((r) => r.column_name).sort();
  assert.deepEqual(
    cols,
    ['request_id', 'suggested_tile_id'],
    'closest_existing gained a foreign key — a merged-away trade would then be undeletable because an old draft mentions it',
  );
  // And a draft naming a trade that no longer exists must still INSERT: the
  // application resolves it through the merge-forward map at read time and
  // drops it silently.
  const requestId = await seedRequest('Sorbetes cart');
  await insertDraft(requestId, { closest_existing: `'a_trade_that_was_merged_away'` });
  const back = await one<{ closest_existing: string }>(
    `SELECT closest_existing FROM ${TABLE} WHERE request_id = $1`,
    [requestId],
  );
  assert.equal(back?.closest_existing, 'a_trade_that_was_merged_away');
});

test('the migration was applied, not skipped', () => {
  assert.equal(
    replay.skipped.filter((s) => s.file.includes('a_trade_we_do_not_have')).length,
    0,
    'the replay skipped this migration — every assertion above then proves nothing',
  );
});
