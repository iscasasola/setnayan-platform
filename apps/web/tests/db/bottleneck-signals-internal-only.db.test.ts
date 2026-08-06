/**
 * THE INTERNAL-NUMBERS LEAK — `public.bottleneck_signals_current`.
 *
 * ── WHAT WAS READABLE ──────────────────────────────────────────────────────
 * One row, refreshed hourly, holding the company's own operating position:
 * how many vendors are stuck in the verification queue, how slow support is
 * answering, vendor signups this week versus last, how many disputes are open,
 * and the total verified-active vendor count. It backs the Hiring Predictive
 * Guide on /admin/app-performance.
 *
 * Its defining migration (20260523000000) gave `authenticated` SELECT. Its
 * three sibling TABLES in the same migration each got an owner-only RLS policy.
 *
 * ── WHY THE GRANT WAS THE WHOLE CONTROL ────────────────────────────────────
 * **A materialized view does not honour row-level security.** There is no
 * policy to write and none to forget — Postgres will not even let you turn RLS
 * on (asserted below, because that is the fact the whole design rests on).
 * Supabase publishes matviews through PostgREST, so `authenticated` meant every
 * couple, vendor, guest and coordinator with an account was one GET away.
 *
 * ── WHY REVOKING COSTS NOTHING ─────────────────────────────────────────────
 * Both readers — getBottleneckSignals() and refreshBottleneckSignalsIfStale()
 * in apps/web/lib/hiring-guide/queries.ts — build their client with
 * createAdminClient(), the service_role key, which no grant here affects.
 *
 * ── THE SHAPE TO REMEMBER ──────────────────────────────────────────────────
 * "The tables are RLS-protected" is a sentence about tables. A view or matview
 * sitting beside them, derived from the same data, is a separate decision and
 * it is made entirely by the GRANT. Migration 20271116295515.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MATVIEW = 'public.bottleneck_signals_current';

/** Columns whose value is a fact about the business, not about the caller. */
const INTERNAL_COLUMNS = [
  'verification_backlog_count',
  'support_avg_response_hours',
  'signups_last_week',
  'signups_prior_week',
  'open_disputes',
  'verified_active',
];

async function hasSelect(role: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege($1, $2, 'SELECT') AS ok`,
    [role, MATVIEW],
  );
  return r.rows[0]!.ok;
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the matview exists, is a matview, and carries the internal columns', async () => {
  // Without this, "authenticated cannot read it" would also be true of an
  // object that had been deleted, renamed, or never replayed at all.
  const k = await db.query<{ relkind: string }>(
    `SELECT c.relkind FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname = 'bottleneck_signals_current'`,
  );
  assert.equal(k.rows.length, 1, 'bottleneck_signals_current is missing from the replay');
  assert.equal(k.rows[0]!.relkind, 'm', 'expected a MATERIALIZED view (relkind m)');

  const cols = await db.query<{ attname: string }>(
    `SELECT a.attname FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname = 'bottleneck_signals_current' AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  const present = new Set(cols.rows.map((r) => r.attname));
  const absent = INTERNAL_COLUMNS.filter((c) => !present.has(c));
  assert.deepEqual(
    absent,
    [],
    `the matview no longer holds ${absent.join(', ')} — if its shape changed, re-decide who may read it rather than inheriting this test`,
  );
});

test('META: service_role still holds SELECT — the fix is a narrowing, not a demolition', async () => {
  assert.equal(
    await hasSelect('service_role'),
    true,
    'service_role lost SELECT. The only readers use the service-role key; revoking it there ' +
      'breaks /admin/app-performance instead of protecting anything.',
  );
});

/* ── 1 · THE CLOSURE ──────────────────────────────────────────────────────── */

test('neither anon nor authenticated may SELECT the internal-numbers matview', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    if (await hasSelect(role)) open.push(role);
  }
  assert.deepEqual(
    open,
    [],
    `${open.join(' and ')} can read ${MATVIEW}. It is a MATERIALIZED VIEW, so it cannot carry ` +
      `RLS and the GRANT is the entire access control — the row holds the vendor-verification ` +
      `backlog, support response times, weekly signups and the open-dispute count.`,
  );
});

test('BEHAVIOURAL: an authenticated session is actually refused, not merely un-granted', async () => {
  // Catalog privileges and real behaviour have disagreed here before (a table's
  // owner bypasses RLS entirely, which is how two vacuous DB tests shipped).
  // Become the role and try the read.
  await db.exec(`SET ROLE authenticated`);
  let refused = false;
  let message = '';
  try {
    await db.query(`SELECT verification_backlog_count FROM ${MATVIEW}`);
  } catch (err) {
    refused = true;
    message = err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
  assert.ok(
    refused,
    'an authenticated session read the internal numbers even though the catalog says it holds no grant',
  );
  assert.match(
    message,
    /permission denied/i,
    `expected a permission failure, got: ${message}`,
  );
});

test('NEUTRALISATION: re-granting SELECT immediately re-opens it — the GRANT is the control', async () => {
  // The other direction. If the refusal above came from something other than
  // the ACL, this would not change the outcome. It does.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT SELECT ON ${MATVIEW} TO authenticated`);
    await db.exec(`SET ROLE authenticated`);
    const r = await db.query(`SELECT * FROM ${MATVIEW}`);
    assert.ok(
      Array.isArray(r.rows),
      'the re-grant did not restore the read — the closure is not attributable to the ACL',
    );
  } finally {
    await reset();
    await db.exec(`ROLLBACK`);
  }
});

test('a materialized view CANNOT be protected by RLS — which is why the grant had to go', async () => {
  // This is the load-bearing fact, so it is asserted rather than asserted-in-a-
  // comment. If a future Postgres allows it, this test fails and someone gets
  // to reconsider the design instead of inheriting it.
  let rejected = false;
  try {
    await db.exec(`ALTER MATERIALIZED VIEW ${MATVIEW} ENABLE ROW LEVEL SECURITY`);
  } catch {
    rejected = true;
  }
  assert.ok(
    rejected,
    'RLS can now be enabled on a materialized view. Re-decide: a policy may be a better ' +
      'control than a blanket revoke, and this test is no longer the reason for the revoke.',
  );
  const r = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS "on" FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname = 'bottleneck_signals_current'`,
  );
  assert.equal(r.rows[0]!.on, false, 'the matview reports RLS enabled, which should be impossible');
});
