/**
 * SEC-3 — `orders.pax_snapshot` is genuinely frozen (test:db, every migration
 * replayed into PGlite).
 *
 * THE HOLE THIS LOCKS. 20271008000839 added `pax_snapshot` as the durability
 * half of the SEC-3 pax money bug, and its COMMENT promises the value is
 * "frozen at insert" and "Never recomputed". It was not. `public.orders`
 * already carries a BEFORE UPDATE trigger whose entire job is to stop an
 * un-elevated caller mutating money columns on their own order
 * (`guard_orders_protected_columns`, 20270226279630) — and the new column was
 * never added to its list. `orders_owner_write` is `FOR ALL USING (user_id =
 * auth.uid())`, so the payer could rewrite their own snapshot straight through
 * PostgREST:
 *
 *     PATCH /rest/v1/orders?order_id=eq.<their own order> { "pax_snapshot": 1 }
 *
 * Migration 20271008300000 adds the column to the guard. Found by the exposure
 * freeze (supabase/security/) failing on the new column and the delta being
 * investigated instead of baselined away.
 *
 * NOTE ON BLAST RADIUS, so this test is not mistaken for a bigger claim than it
 * makes: nothing re-derives money from `pax_snapshot` today — the only
 * reference in apps/web is the INSERT in submitOrderAction. This closes a
 * latent trap (an audit record the audited party can edit), not a live theft.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A DB test that talks to Postgres as the table OWNER bypasses RLS and column
 * grants, so every "denied" assertion passes for the wrong reason. Worse for a
 * TRIGGER guard: the test can pass because the trigger never fired at all.
 * Four defences, each an assertion rather than a comment:
 *
 *   1. META runs FIRST and asserts `current_user` is literally 'authenticated',
 *      is not a superuser, cannot BYPASSRLS, and does not OWN public.orders.
 *   2. POSITIVE CONTROL — the same host, same session, same row, updates a
 *      NON-protected column and must SUCCEED. A guard that blanket-denies
 *      every UPDATE, or a row that was never reachable, fails here.
 *   3. DIFFERENTIAL CONTROL — the blocked statement is re-run as `service_role`
 *      and must SUCCEED, so the denial is attributable to the guard and not to
 *      a typo'd column, a missing row, or an unrelated CHECK constraint.
 *   4. NO-OP CONTROL — an UPDATE that re-writes the SAME pax value must pass
 *      (`is distinct from`), proving the guard discriminates rather than
 *      tripping on the column being mentioned at all.
 *
 * Plus the thing that must keep working: checkout INSERTs this column as
 * `authenticated`, so INSERT is asserted to remain allowed.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const PAYER = '3a3e0000-0000-4000-8000-00000000aaaa';
const STRANGER = '3a3e0000-0000-4000-8000-00000000bbbb';
/** The payer's own order, seeded with a known snapshot. */
let orderId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function errOf(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function paxOf(id: string): Promise<number | null> {
  const r = await db.query<{ p: number | null }>(
    `SELECT pax_snapshot AS p FROM public.orders WHERE order_id = $1`,
    [id],
  );
  return r.rows[0]?.p ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // Seeded as the migration role (owner) on purpose: the setup is not what is
  // under test, the UPDATE path is.
  for (const u of [PAYER, STRANGER]) {
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      u,
      `${u}@pax-freeze.test`,
    ]);
    await db.query(
      `INSERT INTO public.users (user_id, email, public_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [u, `${u}@pax-freeze.test`, `S89U${u.slice(0, 10).replace(/-/g, '')}`],
    );
  }

  const ins = await db.query<{ id: string }>(
    `INSERT INTO public.orders
       (user_id, status, description, requested_total_php, reference_code, public_id, pax_snapshot)
     VALUES ($1, 'awaiting_payment', 'pax freeze probe', 280000, 'PAXFRZ01', 'S89O00PAXFRZ1', 100)
     RETURNING order_id AS id`,
    [PAYER],
  );
  orderId = ins.rows[0]!.id;
  await reset();
});

after(async () => {
  await reset();
  await db?.close();
});

/* ── 1. META — prove the session is really unprivileged ─────────────────────*/

test('META: the probe session is `authenticated`, unprivileged, and not the table owner', async () => {
  await asUser(PAYER);
  const who = await db.query<{ cu: string; su: boolean; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user) AS su,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c WHERE c.oid = 'public.orders'::regclass`,
  );
  const row = who.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.su, false, 'probe role is superuser — it would bypass the guard');
  assert.equal(row.bypass, false, 'probe role has BYPASSRLS — the probe would be vacuous');
  assert.notEqual(row.owner, 'authenticated', 'probe role OWNS public.orders — owners skip RLS');
  await reset();
});

/* ── 2. THE LOCK ────────────────────────────────────────────────────────────*/

test('the payer CANNOT rewrite pax_snapshot on their own order', async () => {
  await asUser(PAYER);
  const err = await errOf(`UPDATE public.orders SET pax_snapshot = 1 WHERE order_id = $1`, [orderId]);
  await reset();

  assert.ok(err, 'the payer rewrote their own priced pax — SEC-3 snapshot is forgeable');
  assert.match(
    err,
    /protected money column change not allowed/i,
    `expected the guard_orders_protected_columns refusal, got: ${err}`,
  );
  assert.equal(await paxOf(orderId), 100, 'value changed despite the refusal');
});

test('POSITIVE CONTROL: the same host, same row, still updates a non-protected column', async () => {
  await asUser(PAYER);
  const err = await errOf(
    `UPDATE public.orders SET payment_method_key = 'gcash' WHERE order_id = $1`,
    [orderId],
  );
  await reset();
  assert.equal(
    err,
    null,
    `the row must stay reachable and writable — a blanket denial would make the ` +
      `lock above meaningless. Got: ${err}`,
  );
});

test('NO-OP CONTROL: re-writing the SAME pax value is allowed (`is distinct from`)', async () => {
  await asUser(PAYER);
  const err = await errOf(`UPDATE public.orders SET pax_snapshot = 100 WHERE order_id = $1`, [orderId]);
  await reset();
  assert.equal(
    err,
    null,
    `the guard must compare values, not merely notice the column was mentioned — ` +
      `otherwise every ordinary full-row UPDATE from the client breaks. Got: ${err}`,
  );
});

test('DIFFERENTIAL CONTROL: the same statement SUCCEEDS as service_role', async () => {
  await asService();
  const err = await errOf(`UPDATE public.orders SET pax_snapshot = 7 WHERE order_id = $1`, [orderId]);
  assert.equal(err, null, `denial must be attributable to the guard, not a broken statement: ${err}`);
  // Put it back so later assertions read a known value.
  await errOf(`UPDATE public.orders SET pax_snapshot = 100 WHERE order_id = $1`, [orderId]);
  await reset();
});

/* ── 3. WHAT MUST KEEP WORKING ──────────────────────────────────────────────*/

test('checkout is untouched: `authenticated` can still INSERT an order carrying pax_snapshot', async () => {
  // submitOrderAction inserts through the session-bound (authenticated) client,
  // so an INSERT refusal here would reject every pax-priced order at the till.
  await asUser(PAYER);
  const err = await errOf(
    `INSERT INTO public.orders
       (user_id, status, description, requested_total_php, reference_code, public_id, pax_snapshot)
     VALUES ($1, 'submitted', 'checkout still works', 280000, 'PAXFRZ02', 'S89O00PAXFRZ2', 250)`,
    [PAYER],
  );
  await reset();
  assert.equal(err, null, `the guard is BEFORE UPDATE only — INSERT must remain open. Got: ${err}`);
});

/* ── 4. RLS still carries its own weight ────────────────────────────────────*/

test('a DIFFERENT authenticated user reaches the row not at all (RLS, not the guard)', async () => {
  await asUser(STRANGER);
  const r = await db.query(
    `UPDATE public.orders SET payment_method_key = 'stolen' WHERE order_id = $1 RETURNING order_id`,
    [orderId],
  );
  await reset();
  assert.equal(r.rows.length, 0, 'orders_owner_write leaked another user’s order');
});
