/**
 * `platform_retail_catalog_v2.saas_overhead_cost_php` — our per-SKU cost — must
 * never be readable by a browser. End-to-end (test:db, every migration replayed
 * into PGlite), against migration 20271201188010.
 *
 * THE HOLE THIS LOCKS. The publishable key is inlined into the production
 * bundle by design and PostgREST is reachable directly, so before this fix a
 * stranger could run, with no account and without loading a page:
 *
 *     GET /rest/v1/platform_retail_catalog_v2?select=service_code,retail_price_php,saas_overhead_cost_php
 *
 * and get our cost — and therefore our margin — on every SKU we sell. Measured
 * against production 2026-09-03: `has_column_privilege('anon', …)` was true and
 * all 35 rows carried a cost. The table's one RLS policy is `USING (true)`, and
 * RLS is ROW-level: it can never hide a column.
 *
 * ── ⚠ WHY THIS SUITE IS NOT VACUOUS — READ BEFORE EDITING ───────────────────
 * This repo has TWICE shipped DB tests that passed for the WRONG REASON,
 * because the connection OWNED the table and Postgres skips privilege checks
 * for table owners. Every "denied" assertion is then meaningless. The same four
 * defences as SEC-4b (tests/db/orders-payments-insert-revoke.db.test.ts), all
 * mandatory:
 *
 *   1. META (runs FIRST) — asserts current_user is literally 'anon' /
 *      'authenticated', that the role does NOT own the table, and that it holds
 *      neither BYPASSRLS nor SUPERUSER. `SET ROLE` alone is not enough.
 *   2. POSITIVE CONTROL — the same anon session successfully reads
 *      service_code/title/retail_price_php from the same table in the same
 *      statement shape. That is what attributes the refusal to the COLUMN
 *      rather than to the role, the table, RLS, or a typo.
 *   3. DIFFERENTIAL CONTROL — every statement asserted to fail as anon is
 *      re-run as service_role and asserted to SUCCEED.
 *   4. NEUTRALISATION PROOF — the last test re-GRANTs the column inside a
 *      transaction, re-runs the exact read, asserts it now SUCCEEDS, and rolls
 *      back. If the fix ever became a no-op this test goes red, so the suite
 *      cannot silently degrade into "passes because nothing is being tested".
 *
 * The replay harness deliberately carries NO trailing `GRANT ALL ON ALL TABLES`
 * (replay-migrations.ts:765), so the migration's REVOKE survives the replay and
 * these assertions run against the post-fix schema.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const TABLE = 'public.platform_retail_catalog_v2';

/**
 * Columns withheld from anon + authenticated by 20271201188010.
 *
 * 🔑 ADDING A COLUMN TO THIS TABLE? You must do ONE of two things, and the
 * "every column is decided" test below fails with this same instruction until
 * you do:
 *   • customer-facing → `GRANT SELECT (col) ON public.platform_retail_catalog_v2
 *     TO anon, authenticated;` in your migration;
 *   • internal (a cost, a margin, an admin identity, a private note) → add it
 *     here.
 * Never widen the grant to silence the test.
 */
const DENIED_COLUMNS = [
  'saas_overhead_cost_php',
  'retirement_reason',
  'retired_by_admin_id',
  'updated_by_admin_id',
] as const;

/** The column this whole file exists for. */
const COST = 'saas_overhead_cost_php';

/** Columns a shipped session-client reader names — the price must stay public. */
const PUBLIC_COLUMNS = [
  'service_code',
  'title',
  'retail_price_php',
  'billing_period',
  'is_active',
  'is_pax_priced',
  'pax_floor',
  'pax_floor_price_php',
  'pax_increment_size',
  'pax_increment_price_php',
  'is_token_able',
  'description',
] as const;

let replay: ReplayResult;
let db: PGlite;

async function asRole(role: 'anon' | 'authenticated' | 'service_role'): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`SET ROLE ${role}`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
}

/** Run a statement; return the error message, or null when it succeeded. */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

/** A refusal must be the PRIVILEGE one — not a typo, not an aborted transaction. */
function assertPermissionDenied(err: string | null, what: string): void {
  assert.ok(err, `${what}: expected a refusal, the statement SUCCEEDED`);
  assert.match(
    err,
    /permission denied/i,
    `${what}: refused, but not for privilege reasons — got: ${err}`,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // The catalogue must actually have rows, or every "denied" below could be
  // an empty-table read that never touched a column.
  await asRole('service_role');
  const n = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${TABLE}`);
  assert.ok(
    (n.rows[0]?.c ?? 0) > 0,
    'precondition: the replayed catalogue is empty, so no read below proves anything',
  );
  await reset();
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

/* ── 0 · META — without this the whole file can pass vacuously ─────────────── */

for (const role of ['anon', 'authenticated'] as const) {
  test(`META: the session is really \`${role}\` — not an owner, not BYPASSRLS`, async () => {
    await asRole(role);
    const r = await db.query<{
      cu: string;
      bypass: boolean;
      superuser: boolean;
      owns: boolean;
    }>(
      `SELECT current_user AS cu,
              rolbypassrls AS bypass,
              rolsuper     AS superuser,
              pg_catalog.pg_get_userbyid(c.relowner) = current_user AS owns
         FROM pg_roles r
         JOIN pg_class c ON c.oid = $1::regclass
        WHERE r.rolname = current_user`,
      [TABLE],
    );
    const row = r.rows[0];
    assert.ok(row, 'META: could not resolve the current role');
    assert.equal(row.cu, role, `META: SET ROLE did not take — current_user is ${row.cu}`);
    assert.equal(row.bypass, false, 'META: role has BYPASSRLS, denials would prove nothing');
    assert.equal(row.superuser, false, 'META: role is SUPERUSER, denials would prove nothing');
    assert.equal(row.owns, false, 'META: role OWNS the table, privilege checks are skipped');
    await reset();
  });
}

/* ── 1 · THE GRANT IS GONE — what the owner asked to be asserted ───────────── */

test('anon and authenticated hold NO privilege on the cost column', async () => {
  await reset();
  for (const role of ['anon', 'authenticated'] as const) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE'] as const) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, $2, $3, $4) AS ok`,
        [role, TABLE, COST, priv],
      );
      assert.equal(
        r.rows[0]?.ok,
        false,
        `${role} still holds ${priv} on ${COST} — our margin is on the internet`,
      );
    }
  }
});

test('the three internal bookkeeping columns are shut too', async () => {
  await reset();
  for (const col of DENIED_COLUMNS.filter((c) => c !== COST)) {
    const exists = await db.query<{ ok: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='platform_retail_catalog_v2'
           AND column_name=$1) AS ok`,
      [col],
    );
    if (!exists.rows[0]?.ok) continue; // denied-if-present, per the migration
    for (const role of ['anon', 'authenticated'] as const) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, $2, $3, 'SELECT') AS ok`,
        [role, TABLE, col],
      );
      assert.equal(r.rows[0]?.ok, false, `${role} can still read ${col}`);
    }
  }
});

test('the write grants are gone at the table level, not just blocked by policy', async () => {
  await reset();
  for (const role of ['anon', 'authenticated'] as const) {
    for (const priv of ['INSERT', 'UPDATE', 'DELETE'] as const) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege($1, $2, $3) AS ok`,
        [role, TABLE, priv],
      );
      assert.equal(r.rows[0]?.ok, false, `${role} still holds ${priv} on the price list`);
    }
  }
});

/* ── 2 · THE READ ACTUALLY FAILS — a grant check is not a 42501 ────────────── */

for (const role of ['anon', 'authenticated'] as const) {
  test(`${role}: selecting the cost is refused`, async () => {
    await asRole(role);
    assertPermissionDenied(
      await tryQuery(`SELECT ${COST} FROM ${TABLE} LIMIT 1`),
      `${role} SELECT ${COST}`,
    );
    await reset();
  });

  test(`${role}: \`select=*\` is refused — the whole row, not a null column`, async () => {
    await asRole(role);
    assertPermissionDenied(
      await tryQuery(`SELECT * FROM ${TABLE} LIMIT 1`),
      `${role} SELECT *`,
    );
    await reset();
  });

  test(`${role}: the cost cannot be used as a blind-search oracle`, async () => {
    await asRole(role);
    // Postgres requires SELECT on any column named in a WHERE or ORDER BY, so
    // `?saas_overhead_cost_php=gt.100` and `?order=saas_overhead_cost_php` fail
    // too. A policy re-scope would NOT have closed these.
    assertPermissionDenied(
      await tryQuery(`SELECT service_code FROM ${TABLE} WHERE ${COST} > 100`),
      `${role} WHERE ${COST}`,
    );
    assertPermissionDenied(
      await tryQuery(`SELECT service_code FROM ${TABLE} ORDER BY ${COST} DESC LIMIT 1`),
      `${role} ORDER BY ${COST}`,
    );
    await reset();
  });
}

/* ── 3 · POSITIVE CONTROL — the price is still public ──────────────────────── */

for (const role of ['anon', 'authenticated'] as const) {
  test(`${role}: the customer-facing columns still read cleanly`, async () => {
    await asRole(role);
    const err = await tryQuery(`SELECT ${PUBLIC_COLUMNS.join(', ')} FROM ${TABLE} LIMIT 1`);
    assert.equal(
      err,
      null,
      `${role} lost a legitimate price read — /pricing and the supplier picker go blank: ${err}`,
    );
    const r = await db.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM (SELECT service_code, retail_price_php FROM ${TABLE}) t`,
    );
    assert.ok((r.rows[0]?.c ?? 0) > 0, `${role} reads zero priced SKUs`);
    await reset();
  });
}

test('the exact ten columns the supplier recommendations page selects all survive', async () => {
  // app/vendor-dashboard/recommendations/page.tsx — the ONLY reader in apps/web
  // that goes through the caller's own session rather than the service-role
  // client. If this breaks, a signed-in supplier's picker renders empty.
  await asRole('authenticated');
  const err = await tryQuery(
    `SELECT service_code, title, retail_price_php, billing_period, is_active,
            is_pax_priced, pax_floor, pax_floor_price_php, pax_increment_size,
            pax_increment_price_php
       FROM ${TABLE} WHERE is_active = true`,
  );
  assert.equal(err, null, `the supplier recommendations read broke: ${err}`);
  await reset();
});

/* ── 4 · DIFFERENTIAL CONTROL — the app server is untouched ────────────────── */

test('service_role still reads the cost — /admin/pricing must keep working', async () => {
  await asRole('service_role');
  const err = await tryQuery(`SELECT service_code, ${COST} FROM ${TABLE} LIMIT 1`);
  assert.equal(err, null, `service_role lost the cost read: ${err}`);
  const r = await db.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM ${TABLE} WHERE ${COST} IS NOT NULL`,
  );
  assert.ok(
    (r.rows[0]?.c ?? 0) > 0,
    'service_role sees no costs at all — the differential control proves nothing',
  );
  await reset();
});

test('service_role still writes — the admin catalogue editor must keep working', async () => {
  await asRole('service_role');
  await db.exec('BEGIN');
  const err = await tryQuery(
    `UPDATE ${TABLE} SET ${COST} = ${COST} WHERE service_code IS NOT NULL`,
  );
  await db.exec('ROLLBACK');
  assert.equal(err, null, `service_role lost write access to the catalogue: ${err}`);
  await reset();
});

/* ── 5 · THE FUTURE-COLUMN TRAP — this is what stops the fix rotting ───────── */

test('every column on the catalogue is DECIDED — granted or deliberately denied', async () => {
  await reset();
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'platform_retail_catalog_v2'
      ORDER BY ordinal_position`,
  );
  const undecided: string[] = [];
  for (const { column_name } of cols.rows) {
    if ((DENIED_COLUMNS as readonly string[]).includes(column_name)) continue;
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('anon', $1, $2, 'SELECT') AS ok`,
      [TABLE, column_name],
    );
    if (!r.rows[0]?.ok) undecided.push(column_name);
  }
  assert.deepEqual(
    undecided,
    [],
    `These columns on platform_retail_catalog_v2 are neither granted nor deliberately denied:\n` +
      undecided.map((c) => `  • ${c}`).join('\n') +
      `\n\nPostgREST refuses the WHOLE query that names an ungranted column (42501), not\n` +
      `just that column — on \`events\` this took three shipped screens dark for weeks.\n` +
      `Pick one, in the migration that added the column:\n` +
      `  • customer-facing → GRANT SELECT (<col>) ON public.platform_retail_catalog_v2\n` +
      `                       TO anon, authenticated;\n` +
      `  • internal        → add it to DENIED_COLUMNS in this file.\n` +
      `Never widen the grant just to make this green.`,
  );
});

test('DENIED_COLUMNS names no column that has since been dropped', async () => {
  // A stale entry would deny nothing and quietly weaken the test above, which
  // skips anything it finds in this list.
  await reset();
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'platform_retail_catalog_v2'`,
  );
  const live = new Set(r.rows.map((x) => x.column_name));
  assert.ok(live.has(COST), `${COST} is gone — this whole suite is now vacuous`);
  const stale = DENIED_COLUMNS.filter((c) => !live.has(c));
  assert.deepEqual(stale, [], `DENIED_COLUMNS names dropped column(s): ${stale.join(', ')}`);
});

/* ── 6 · NEUTRALISATION PROOF — the suite cannot degrade into a no-op ──────── */

test('NEUTRALISATION: re-granting the column makes the leak return, then rolls back', async () => {
  await reset();
  await db.exec('BEGIN');
  try {
    // Sabotage the fix exactly the way a careless future migration would.
    await db.exec(`GRANT SELECT (${COST}) ON ${TABLE} TO anon`);

    const priv = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('anon', $1, $2, 'SELECT') AS ok`,
      [TABLE, COST],
    );
    assert.equal(
      priv.rows[0]?.ok,
      true,
      'the sabotage did not take — this test is not exercising the fix',
    );

    await asRole('anon');
    const err = await tryQuery(`SELECT ${COST} FROM ${TABLE} LIMIT 1`);
    assert.equal(
      err,
      null,
      `re-granting SELECT did not restore the read (${err}) — so the denial asserted ` +
        `above may be caused by something OTHER than the missing column grant, and ` +
        `this suite would stay green if the REVOKE were deleted`,
    );
    await db.exec(`RESET ROLE`);
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }

  // ...and the rollback really put it back.
  const after = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('anon', $1, $2, 'SELECT') AS ok`,
    [TABLE, COST],
  );
  assert.equal(after.rows[0]?.ok, false, 'the neutralisation test leaked its own GRANT');
});

test('NEUTRALISATION: a blanket table GRANT re-opens everything — the real regression shape', async () => {
  // This is how the fix would most plausibly be undone: not by someone
  // re-granting the cost column by name, but by a migration issuing a
  // table-level GRANT, which Postgres cannot subtract a column from. The
  // migration's own post-conditions and the tests above are what catch it.
  await reset();
  await db.exec('BEGIN');
  try {
    await db.exec(`GRANT ALL ON ${TABLE} TO anon, authenticated`);
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('anon', $1, $2, 'SELECT') AS ok`,
      [TABLE, COST],
    );
    assert.equal(
      r.rows[0]?.ok,
      true,
      'a table-level GRANT ALL did NOT re-expose the cost — the threat model in the ' +
        'migration docblock is wrong and this guard is aimed at the wrong thing',
    );
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
  const after = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('anon', $1, $2, 'SELECT') AS ok`,
    [TABLE, COST],
  );
  assert.equal(after.rows[0]?.ok, false, 'the blanket-grant test leaked its own GRANT');
});
