/**
 * SEC-4b — public.orders / public.payments are SERVER-MINTED ONLY.
 * End-to-end (test:db, every migration replayed into PGlite).
 *
 * THE HOLE THIS LOCKS. The anon publishable key is public and PostgREST is
 * reachable directly, so an authenticated user could bypass apps/web entirely:
 *
 *     POST /rest/v1/orders
 *     { user_id: <self>, event_id: <own event>, service_key: 'PAPIC_GUEST',
 *       requested_total_php: 1, status: 'submitted', reference_code: 'SN…' }
 *
 * `orders_owner_write` is `FOR ALL … WITH CHECK (user_id = auth.uid())` — it
 * authenticates the BUYER and says nothing about the AMOUNT.
 * `orders_insert_status_guard` constrains STATUS only, and 'submitted' is on
 * its allow-list. `guard_orders_protected_columns` DOES protect
 * requested_total_php / service_key — but it is `BEFORE UPDATE`, so it never
 * fires on an INSERT. The attacker pays ₱1 for real, /admin/payments reconciles
 * ₱1 against the order's own ₱1 asking price, approval runs activateOrderSku,
 * and they own the SKU. public.payments carried the identical shape.
 *
 * Migration 20271008178212 revokes INSERT from `authenticated` + `anon` on both
 * tables and adds a BEFORE INSERT caller guard as defence in depth.
 *
 * ── ⚠ WHY THIS SUITE IS NOT VACUOUS — READ BEFORE EDITING ───────────────────
 * This repo has TWICE shipped DB tests that passed for the WRONG REASON,
 * because the connection OWNED the table and Postgres skips RLS (and, for a
 * superuser, privilege checks) for table owners. Every "denied" assertion is
 * then meaningless. Four independent defences, all mandatory:
 *
 *   1. META (runs FIRST) — asserts current_user is literally 'authenticated',
 *      that the role does NOT own orders/payments, and that it does NOT hold
 *      BYPASSRLS or SUPERUSER. `SET ROLE` alone is not enough: if the role it
 *      switched to happened to own the table, the whole suite would green out.
 *   2. POSITIVE CONTROL — the same session, as the same authenticated user,
 *      successfully SELECTs and UPDATEs its own order. If the role/JWT wiring
 *      were broken, everything would fail and the denials would prove nothing.
 *   3. DIFFERENTIAL CONTROL — every statement asserted to fail as
 *      `authenticated` is re-run as `service_role` and asserted to SUCCEED.
 *      That is what attributes a denial to the REVOKE rather than to a typo, a
 *      missing FK row, or a CHECK constraint.
 *   4. NEUTRALISATION PROOF — the last test re-grants INSERT and drops the
 *      guard inside a transaction, re-runs the exact attack, asserts it now
 *      SUCCEEDS, and rolls back. If the fix ever became a no-op, that test goes
 *      red, so the suite cannot silently degrade into "passes because nothing
 *      is being tested".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

const MIGRATION_FILE = '20271008178212_revoke_orders_payments_insert_from_session_roles.sql';

/** A real, currently-sold SKU — so the attack is the one described, not a fiction. */
const REAL_SKU = 'PAPIC_GUEST';

let replay: ReplayResult;
let db: PGlite;

let attackerUid: string;
let eventId: string;
/** An order minted the legitimate way (service_role), used as the payments target. */
let legitOrderId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

/** Impersonate the attacker: uid claim + role claim + SET ROLE authenticated. */
async function asAttacker(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, attackerUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

/** Impersonate the app server (the ONLY sanctioned minter after this fix). */
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

/** Run a statement; return the error message, or null when it succeeded. */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

/**
 * Same, but inside an already-open transaction. A failed statement ABORTS the
 * enclosing transaction ("current transaction is aborted, commands ignored"),
 * so without a savepoint the SECOND assertion in a neutralisation test reports
 * that generic message instead of the real refusal — which would look like a
 * pass-for-the-wrong-reason, the exact thing this file exists to prevent.
 */
let spSeq = 0;
async function tryQueryTx(sql: string, params: unknown[] = []): Promise<string | null> {
  const sp = `sp_${spSeq++}`;
  await db.exec(`SAVEPOINT ${sp}`);
  const err = await tryQuery(sql, params);
  // ROLLBACK TO SAVEPOINT is legal in an aborted transaction; RELEASE is not.
  await db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
  return err;
}

let refSeq = 0;
/** 'SN' + 8 uppercase hex — the real reference_code shape (UNIQUE on orders). */
const nextRef = () => 'SN' + (0x10000000 + refSeq++).toString(16).toUpperCase().slice(0, 8);

/** THE ATTACK: mint a ₱1 order for a real SKU, attributed to myself. */
const attackOrderSql = `
  INSERT INTO public.orders
    (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
  VALUES ($1, $2, $3, 'Papic Guest — bought for one peso', 1, 'submitted', $4)`;

/** THE ATTACK, payments half: an arbitrary-amount pending payment. */
const attackPaymentSql = `
  INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at)
  VALUES ($1, $2, 1, 'gcash', CURRENT_DATE)`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // ── HARNESS ARTIFACT, not a prod behaviour ────────────────────────────────
  // replay-migrations.ts runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO
  // anon, authenticated, service_role` AFTER the replay loop, to emulate the
  // Supabase platform default-privileges that normally fire at CREATE TABLE
  // time. That blanket grant re-adds the very INSERT this migration revokes, so
  // without re-applying we would be testing the PRE-FIX schema and every
  // denial below would be a false negative.
  //
  // Nothing does this in prod: Supabase default privileges attach when a table
  // is created (orders/payments were created in 20260513150000 and got their
  // grant then) and `supabase db push` issues no post-hoc GRANT.
  //
  // We re-execute the REAL migration file, never a reconstruction of it, so
  // what is proven below is the shipped SQL applied to the fully-replayed
  // production schema. The migration is idempotent (REVOKE + CREATE OR REPLACE
  // + DROP TRIGGER IF EXISTS), and its own post-conditions run again here — so
  // this line alone would fail if the revoke did not take.
  await db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8'));

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec4b-attacker@example.com') RETURNING id`,
  );
  attackerUid = u.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-4b Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  // The attacker is a legitimate member of their OWN event — the exploit never
  // needed a stranger's event, which is exactly why RLS did not stop it.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [eventId, attackerUid],
  );

  // One order minted the sanctioned way, so the payments tests have a real
  // target and the positive control has something to read.
  await asService();
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, 'Papic Guest', 2999, 'submitted', $4)
     RETURNING order_id`,
    [eventId, attackerUid, REAL_SKU, nextRef()],
  );
  legitOrderId = o.rows[0]!.order_id;
  await reset();
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

/* ── 0 · META — without this the whole file can pass vacuously ─────────────── */

test('META: the session is really `authenticated` — not an owner, not BYPASSRLS', async () => {
  await asAttacker();
  const r = await db.query<{
    cu: string;
    bypass: boolean;
    superuser: boolean;
    orders_owner: string;
    payments_owner: string;
  }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user) AS superuser,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.orders'::regclass)   AS orders_owner,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.payments'::regclass) AS payments_owner`,
  );
  const row = r.rows[0]!;

  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the authenticated role holds BYPASSRLS — the suite would be meaningless');
  assert.equal(row.superuser, false, 'the authenticated role is SUPERUSER — privilege checks are skipped for it');
  assert.notEqual(row.orders_owner, 'authenticated', 'authenticated OWNS public.orders — grants do not apply to an owner');
  assert.notEqual(row.payments_owner, 'authenticated', 'authenticated OWNS public.payments — grants do not apply to an owner');

  // …and auth.uid() really resolves to the attacker, so `user_id = auth.uid()`
  // is genuinely SATISFIED by the attack payload. The point of SEC-4b is that
  // satisfying it was never enough.
  const who = await db.query<{ uid: string }>(`SELECT auth.uid()::text AS uid`);
  assert.equal(who.rows[0]!.uid, attackerUid, 'auth.uid() is not the attacker — the attack would fail for the wrong reason');
  await reset();
});

test('META: the catalog agrees — INSERT is gone for both session roles, kept for the server', async () => {
  for (const table of ['public.orders', 'public.payments']) {
    for (const role of ['authenticated', 'anon']) {
      const r = await db.query<{ ins: boolean }>(
        `SELECT has_table_privilege($1, $2, 'INSERT') AS ins`,
        [role, table],
      );
      assert.equal(r.rows[0]!.ins, false, `${role} still holds INSERT on ${table}`);

      // Column-level too: a stray column grant would let a narrow INSERT past.
      const c = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = split_part($2, '.', 2)
            AND has_column_privilege($1, $2, c.column_name, 'INSERT')`,
        [role, table],
      );
      assert.equal(c.rows[0]!.n, '0', `${role} holds column-level INSERT on ${table}`);
    }
    const s = await db.query<{ ins: boolean }>(
      `SELECT has_table_privilege('service_role', $1, 'INSERT') AS ins`,
      [table],
    );
    assert.equal(s.rows[0]!.ins, true, `service_role lost INSERT on ${table} — the app is broken`);
  }
});

/* ── 1 · POSITIVE CONTROL — the session works, so denials mean something ───── */

test('positive control: the same session CAN read and cancel its own order', async () => {
  await asAttacker();

  const seen = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.orders WHERE order_id = $1`,
    [legitOrderId],
  );
  assert.equal(seen.rows[0]!.n, '1', 'the user cannot even SELECT their own order — the session wiring is broken');

  // SELECT/UPDATE/DELETE are deliberately NOT revoked. Self-cancel must survive
  // (app/dashboard/[eventId]/orders/actions.ts cancelOrder is a session-role
  // UPDATE); a revoke that overreached would break it silently.
  const err = await tryQuery(
    `UPDATE public.orders SET status = 'cancelled' WHERE order_id = $1`,
    [legitOrderId],
  );
  assert.equal(err, null, `self-cancel broke: ${err}`);

  await asService();
  await db.query(`UPDATE public.orders SET status = 'submitted' WHERE order_id = $1`, [legitOrderId]);
  await reset();
});

/* ── 2 · THE ATTACK — orders ───────────────────────────────────────────────── */

test('THE ATTACK: an authenticated user cannot mint a ₱1 order for a real SKU', async () => {
  await asAttacker();
  const err = await tryQuery(attackOrderSql, [eventId, attackerUid, REAL_SKU, nextRef()]);

  assert.ok(err, 'THE ₱1 ORDER WAS CREATED — SEC-4b is open');
  assert.match(
    err as string,
    /permission denied|server only/i,
    `rejected, but not by the privilege/guard: ${err}`,
  );

  // Nothing landed.
  await reset();
  const n = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.orders WHERE requested_total_php = 1`,
  );
  assert.equal(n.rows[0]!.n, '0', 'a ₱1 order exists in the table');
});

test('the ₱1 order is refused at EVERY status the status-guard allows', async () => {
  // orders_insert_status_guard permits draft / submitted / awaiting_payment /
  // cancelled. If the revoke somehow only bit one of them, the attack just
  // moves to another. 'draft' also proves this is not the status guard talking.
  for (const status of ['draft', 'submitted', 'awaiting_payment', 'cancelled']) {
    await asAttacker();
    const err = await tryQuery(
      `INSERT INTO public.orders
         (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
       VALUES ($1, $2, $3, 'one peso', 1, $4::public.order_status, $5)`,
      [eventId, attackerUid, REAL_SKU, status, nextRef()],
    );
    assert.ok(err, `a ₱1 order was created at status=${status}`);
    assert.match(err as string, /permission denied|server only/i, `${status}: ${err}`);
  }
  await reset();
});

test('₱0 is refused too — the CHECK only ever required >= 0', async () => {
  await asAttacker();
  const err = await tryQuery(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, 'free of charge', 0, 'submitted', $4)`,
    [eventId, attackerUid, REAL_SKU, nextRef()],
  );
  assert.ok(err, 'a ₱0 order was created');
  assert.match(err as string, /permission denied|server only/i, String(err));
  await reset();
});

test('DIFFERENTIAL: the identical INSERT succeeds as service_role', async () => {
  // Without this the denials above could just mean the statement was malformed,
  // the FK was missing, or a CHECK rejected it.
  await asService();
  const ref = nextRef();
  const err = await tryQuery(attackOrderSql, [eventId, attackerUid, REAL_SKU, ref]);
  assert.equal(err, null, `service_role could not run the same statement (${err}) — the denials prove nothing`);

  const n = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.orders WHERE reference_code = $1`,
    [ref],
  );
  assert.equal(n.rows[0]!.n, '1', 'the service-role insert did not land');

  await db.query(`DELETE FROM public.orders WHERE reference_code = $1`, [ref]);
  await reset();
});

/* ── 3 · THE ATTACK — payments ─────────────────────────────────────────────── */

test('THE ATTACK: an authenticated user cannot POST an arbitrary-amount payment', async () => {
  await asAttacker();
  const err = await tryQuery(attackPaymentSql, [legitOrderId, attackerUid]);

  assert.ok(err, 'A ₱1 PAYMENT WAS CREATED against a ₱2,999 order — the payments half is open');
  assert.match(err as string, /permission denied|server only/i, `rejected, but not by the privilege/guard: ${err}`);

  await reset();
  const n = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.payments`);
  assert.equal(n.rows[0]!.n, '0', 'a payment row exists');
});

test("payments: a user cannot pin a payment onto a STRANGER's order either", async () => {
  // payments_owner_insert checked the PAYER only; payments_order_id_fkey checks
  // existence only. So the pre-fix table allowed attaching a payment to any
  // order id in the system — polluting a stranger's reconciliation totals.
  await reset();
  const victim = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec4b-victim@example.com') RETURNING id`,
  );
  const victimUid = victim.rows[0]!.id;
  await asService();
  const vo = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders (user_id, description, requested_total_php, status, reference_code)
     VALUES ($1, 'Victim order', 9999, 'submitted', $2) RETURNING order_id`,
    [victimUid, nextRef()],
  );

  await asAttacker();
  const err = await tryQuery(attackPaymentSql, [vo.rows[0]!.order_id, attackerUid]);
  assert.ok(err, "a payment was attached to a stranger's order");
  assert.match(err as string, /permission denied|server only/i, String(err));
  await reset();
});

test('DIFFERENTIAL: the identical payment INSERT succeeds as service_role', async () => {
  await asService();
  const err = await tryQuery(attackPaymentSql, [legitOrderId, attackerUid]);
  assert.equal(err, null, `service_role could not log a payment (${err}) — checkout is broken`);
  await db.query(`DELETE FROM public.payments WHERE order_id = $1`, [legitOrderId]);
  await reset();
});

/* ── 4 · THE LEGITIMATE FLOW still works end to end ────────────────────────── */

test('the sanctioned server path still mints order + payment and the buyer can see them', async () => {
  await asService();
  const ref = nextRef();
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, 'Papic Guest', 2999, 'submitted', $4)
     RETURNING order_id`,
    [eventId, attackerUid, REAL_SKU, ref],
  );
  const orderId = o.rows[0]!.order_id;

  const payErr = await tryQuery(
    `INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at)
     VALUES ($1, $2, 2999, 'gcash', CURRENT_DATE)`,
    [orderId, attackerUid],
  );
  assert.equal(payErr, null, `the server payment insert broke: ${payErr}`);

  // The buyer must still SEE their own order + payment (SELECT is untouched).
  await asAttacker();
  const seen = await db.query<{ amount_php: string }>(
    `SELECT p.amount_php::text AS amount_php
       FROM public.payments p JOIN public.orders o USING (order_id)
      WHERE o.order_id = $1`,
    [orderId],
  );
  assert.equal(seen.rows.length, 1, 'the buyer cannot read the payment the server just logged for them');
  assert.equal(Number(seen.rows[0]!.amount_php), 2999);

  await asService();
  await db.query(`DELETE FROM public.payments WHERE order_id = $1`, [orderId]);
  await db.query(`DELETE FROM public.orders WHERE order_id = $1`, [orderId]);
  await reset();
});

/* ── 5 · THE GUARD, on its own ─────────────────────────────────────────────── */

test('defence in depth: re-granting INSERT alone does NOT re-open the hole', async () => {
  // The single most likely regression is a stray `GRANT ALL ON public.orders TO
  // authenticated` — from a migration, a dashboard click, or a restored dump.
  // The BEFORE INSERT guard does not read the ACL, so it converts that silent
  // re-opening into a loud 42501. Proven here by re-granting and attacking.
  await reset();
  await db.exec('BEGIN');
  try {
    await db.exec(`GRANT INSERT ON public.orders, public.payments TO authenticated, anon;`);

    await asAttacker();
    const err = await tryQueryTx(attackOrderSql, [eventId, attackerUid, REAL_SKU, nextRef()]);
    assert.ok(err, 'the grant came back and the ₱1 order went through — the guard is not firing');
    assert.match(err as string, /server only/i, `expected the SEC-4b guard, got: ${err}`);

    const perr = await tryQueryTx(attackPaymentSql, [legitOrderId, attackerUid]);
    assert.ok(perr, 'the grant came back and the ₱1 payment went through');
    assert.match(perr as string, /server only/i, `expected the SEC-4b guard, got: ${perr}`);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.exec('ROLLBACK');
    await reset();
  }

  // The rollback really put the revoke back.
  const r = await db.query<{ ins: boolean }>(
    `SELECT has_table_privilege('authenticated', 'public.orders', 'INSERT') AS ins`,
  );
  assert.equal(r.rows[0]!.ins, false, 'the neutralisation transaction leaked — later tests would be vacuous');
});

/* ── 6 · NEUTRALISATION PROOF — the suite must be able to FAIL ─────────────── */

test('NEUTRALISATION: with the fix fully removed, the ₱1 attack SUCCEEDS', async () => {
  // The counter-test for the vacuous-DB-test failure mode. If someone reverts
  // the migration, weakens the guard, or the harness stops applying the file,
  // THIS test goes red — so the suite can never quietly degrade into "green
  // because nothing is being exercised".
  //
  // Both halves of the fix are removed inside a transaction and rolled back.
  await reset();
  await db.exec('BEGIN');
  let mintedRef: string | null = null;
  try {
    await db.exec(`
      GRANT INSERT ON public.orders, public.payments TO authenticated, anon;
      DROP TRIGGER IF EXISTS trg_guard_orders_insert_caller ON public.orders;
      DROP TRIGGER IF EXISTS trg_guard_payments_insert_caller ON public.payments;
    `);

    await asAttacker();
    mintedRef = nextRef();
    const err = await tryQuery(attackOrderSql, [eventId, attackerUid, REAL_SKU, mintedRef]);
    assert.equal(
      err,
      null,
      `the attack FAILED even with the fix neutralised (${err}) — this suite is not proving what it claims. ` +
        'Something else is blocking the insert and the real fix may be untested.',
    );

    const n = await db.query<{ n: string; amt: string }>(
      `SELECT count(*)::text AS n, coalesce(max(requested_total_php),0)::text AS amt
         FROM public.orders WHERE reference_code = $1`,
      [mintedRef],
    );
    assert.equal(n.rows[0]!.n, '1', 'neutralised insert reported success but no row landed');
    assert.equal(Number(n.rows[0]!.amt), 1, 'the neutralised insert did not carry the ₱1 amount');

    const perr = await tryQuery(attackPaymentSql, [legitOrderId, attackerUid]);
    assert.equal(perr, null, `the payments attack FAILED with the fix neutralised (${perr}) — same warning as above`);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.exec('ROLLBACK');
    await reset();
  }

  // The world is back the way it was: the row is gone and the revoke is live.
  const gone = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.orders WHERE reference_code = $1`,
    [mintedRef],
  );
  assert.equal(gone.rows[0]!.n, '0', 'the neutralisation transaction leaked a ₱1 order');

  const back = await db.query<{ ins: boolean; trg: string }>(
    `SELECT has_table_privilege('authenticated', 'public.orders', 'INSERT') AS ins,
            count(*)::text AS trg
       FROM pg_trigger WHERE tgname = 'trg_guard_orders_insert_caller'`,
  );
  assert.equal(back.rows[0]!.ins, false, 'the grant leaked out of the neutralisation transaction');
  assert.equal(back.rows[0]!.trg, '1', 'the guard trigger leaked out of the neutralisation transaction');
});
