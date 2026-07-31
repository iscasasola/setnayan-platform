/**
 * interconnection_probe_runs — the probe ledger ships CLOSED, and the verdict
 * vocabulary the app writes is the vocabulary the table accepts.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * Two independent reasons, and the second is the one that would actually bite.
 *
 * 1. EVERY NEW TABLE IN `public` SHIPS OPEN. Postgres' default ACL grants
 *    arwdDxtm to anon + authenticated, and enabling RLS does NOT remove a
 *    GRANT — a policy-less RLS table with the inherited grant is still
 *    reachable. So the migration revokes explicitly, and this asserts the
 *    revoke by behaviour rather than by reading the migration back.
 *
 * 2. THE LEDGER IS A HEALTH SIGNAL, AND A BROKEN WRITER IS INVISIBLE. If the
 *    CHECK constraint and the app's verdict union ever drift apart, the insert
 *    throws, `runInterconnectionProbes` logs and returns, and the admin page
 *    keeps showing the LAST GOOD verdict forever. A dead probe would render
 *    exactly like a healthy joint — which is the precise failure mode this
 *    whole subsystem was built to catch, committed by the subsystem itself.
 *    So every verdict string the TypeScript union can produce is inserted here
 *    for real.
 *
 * ── WHY IT IS NOT VACUOUS ──────────────────────────────────────────────────
 *   · a META check that the session role really is `anon` and cannot BYPASSRLS,
 *     run FIRST — an owner-session regression fails loudly instead of greening
 *     every denial for the wrong reason;
 *   · a DIFFERENTIAL control — every statement denied to anon is re-run as
 *     service_role and asserted to SUCCEED, so a denial is attributable to the
 *     grant and not to a typo'd column;
 *   · an ANTI-VACUITY canary that the table and function actually exist.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TABLE = 'public.interconnection_probe_runs';

/**
 * Mirrors the ProbeVerdict union in lib/interconnect/verdict.ts. Kept as a
 * literal here ON PURPOSE: importing the union would make this test agree with
 * the app by construction, and the whole point is to catch the day the app and
 * the CHECK constraint disagree.
 */
const VERDICTS = ['ok', 'empty', 'lying', 'denied', 'error'] as const;

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['anon']);
  await db.exec(`SET ROLE anon`);
}

async function asAuthenticated(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['authenticated']);
  await db.exec(`SET ROLE authenticated`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['service_role']);
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0 · Anti-vacuity ───────────────────────────────────────────────────────

test('META · the table and the vocabulary read exist at all', async () => {
  await reset();
  const t = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM pg_class WHERE relname = 'interconnection_probe_runs'`,
  );
  assert.equal(t.rows[0]?.n, 1, 'interconnection_probe_runs was never created');

  const f = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = 'interconnect_booked_vocabularies'`,
  );
  assert.equal(f.rows[0]?.n, 1, 'interconnect_booked_vocabularies was never created');
});

test('META · RLS is enabled on the ledger', async () => {
  await reset();
  const r = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'interconnection_probe_runs'`,
  );
  assert.equal(r.rows[0]?.relrowsecurity, true, 'RLS not enabled at CREATE TABLE time');
});

test('META · the anon session is really anon and cannot bypass RLS', async () => {
  await asAnon();
  const who = await db.query<{ me: string; bypass: boolean }>(
    `SELECT current_user AS me, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
  );
  assert.equal(who.rows[0]?.me, 'anon');
  assert.equal(who.rows[0]?.bypass, false, 'anon can BYPASSRLS — every denial below is vacuous');
  await reset();
});

// ── 1 · The ledger is closed to sessions ───────────────────────────────────

test('anon cannot read the ledger — and service_role can (differential)', async () => {
  await asAnon();
  const denied = await tryQuery(`SELECT run_id FROM ${TABLE} LIMIT 1`);
  assert.ok(denied, 'anon could SELECT the probe ledger');

  // Differential: the SAME statement must succeed as service_role, which is
  // what makes the denial above attributable to the grant.
  await asService();
  const allowed = await tryQuery(`SELECT run_id FROM ${TABLE} LIMIT 1`);
  assert.equal(allowed, null, `service_role could not read the ledger: ${allowed}`);
  await reset();
});

test('authenticated cannot read the ledger either', async () => {
  // The console reads through service_role behind requireAdmin(). A signed-in
  // vendor has no lane here, and "admin is also authenticated" is not a reason
  // to leave one open.
  await asAuthenticated();
  const denied = await tryQuery(`SELECT run_id FROM ${TABLE} LIMIT 1`);
  assert.ok(denied, 'authenticated could SELECT the probe ledger');
  await reset();
});

test('no session role holds a write bit — including TRUNCATE, which RLS never guards', async () => {
  for (const role of ['anon', 'authenticated'] as const) {
    if (role === 'anon') await asAnon();
    else await asAuthenticated();

    const ins = await tryQuery(
      `INSERT INTO ${TABLE} (probe_key, verdict) VALUES ('forged', 'ok')`,
    );
    assert.ok(ins, `${role} could INSERT into the probe ledger`);

    const upd = await tryQuery(`UPDATE ${TABLE} SET verdict = 'ok'`);
    assert.ok(upd, `${role} could UPDATE the probe ledger`);

    const del = await tryQuery(`DELETE FROM ${TABLE}`);
    assert.ok(del, `${role} could DELETE from the probe ledger`);

    // TRUNCATE is a table privilege that RLS does not mediate at all — a
    // policy-only defence leaves it wide open.
    const trunc = await tryQuery(`TRUNCATE ${TABLE}`);
    assert.ok(trunc, `${role} could TRUNCATE the probe ledger`);
  }
  await reset();
});

test('the vocabulary read is off every session role', async () => {
  for (const role of ['anon', 'authenticated'] as const) {
    if (role === 'anon') await asAnon();
    else await asAuthenticated();
    const denied = await tryQuery(`SELECT * FROM public.interconnect_booked_vocabularies()`);
    assert.ok(denied, `${role} could call interconnect_booked_vocabularies()`);
  }

  // Differential — it must actually work for its one caller.
  await asService();
  const allowed = await tryQuery(`SELECT * FROM public.interconnect_booked_vocabularies()`);
  assert.equal(allowed, null, `service_role could not call the vocabulary read: ${allowed}`);
  await reset();
});

// ── 2 · The writer's vocabulary is the table's vocabulary ──────────────────

test('every verdict the app can emit is accepted by the CHECK constraint', async () => {
  await asService();
  for (const verdict of VERDICTS) {
    const err = await tryQuery(
      `INSERT INTO ${TABLE} (probe_key, verdict, subject_count, truth_count) VALUES ($1, $2, 0, 0)`,
      ['vocab-test', verdict],
    );
    assert.equal(
      err,
      null,
      `verdict '${verdict}' is in the TypeScript union but rejected by the CHECK — every probe run would fail to record, and the admin page would keep showing the last good verdict forever`,
    );
  }
  await reset();
});

test('a verdict outside the vocabulary is refused, not silently stored', async () => {
  await asService();
  const err = await tryQuery(
    `INSERT INTO ${TABLE} (probe_key, verdict) VALUES ('vocab-test', 'probably-fine')`,
  );
  assert.ok(err, 'the CHECK constraint accepts arbitrary verdict strings');
  await reset();
});

test('counts cannot go negative', async () => {
  // subject_count > truth_count is legal (a reader may see rows the truth query
  // scoped out), but a negative count is always a bug in the writer.
  await asService();
  const err = await tryQuery(
    `INSERT INTO ${TABLE} (probe_key, verdict, subject_count) VALUES ('vocab-test', 'ok', -1)`,
  );
  assert.ok(err, 'a negative subject_count was accepted');
  await reset();
});
