/**
 * 🔒 `orders.expires_at` IS THE SERVER'S (test:db, every migration replayed into PGlite).
 *
 * THE HOLE THIS LOCKS (ship review of PR #8019, 22 Nov). `orders.expires_at` is the END of a paid window, and since
 * 20271351415438 every add-on is counted while `expires_at > now()` (`vendor_live_ultra_addons`). The column was not
 * in `guard_orders_protected_columns`' list and `orders_owner_write` lets a buyer UPDATE their own unpaid order, so:
 *
 *     PATCH /rest/v1/orders?order_id=eq.<my submitted Ultra Add-on order>  { "expires_at": "2099-01-01" }
 *
 * set the buyer's own window BEFORE paying; the activation hook stamped only an empty window, so one ₱ payment kept
 * the add-on for as long as the buyer had typed. Migration 20271358916247 adds the column to the guard.
 *
 * WHY THIS TEST IS NOT VACUOUS — the same four defences as orders-pax-snapshot-freeze.db.test.ts, each an assertion:
 *   1. META first: the probe is literally `authenticated`, not a superuser, no BYPASSRLS, not the table's owner.
 *   2. POSITIVE CONTROL: the same session and row update a NON-protected column and must succeed (the row is
 *      reachable; the guard is not a blanket denial) — "an owner update the guard allowed before still works".
 *   3. DIFFERENTIAL CONTROL: the refused statement succeeds as `service_role` (the denial is the guard's, not a typo).
 *   4. NO-OP CONTROL: re-writing the SAME value passes (`is distinct from`).
 *
 * SABOTAGE THAT TURNS IT RED (run once, 22 Nov): in 20271358916247 replace the disjunct
 * `or new.expires_at is distinct from old.expires_at` with `or false` (keeping the words in a comment so the
 * migration's own post-condition still passes) → tests 2 "the buyer CANNOT set their own window", 3 "…cannot move or
 * clear a window the server set" and 7 "END TO END" fail (the PATCH goes through); the five controls stay green.
 * Deleting the line outright fails earlier: the migration's post-condition raises during the replay.
 *
 * Run: pnpm --filter @setnayan/web test:db   (one file: `npx tsx --test tests/db/orders-expires-at-is-the-servers.db.test.ts`)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const BUYER = '3e3e0000-0000-4000-8000-00000000aaaa';
const STRANGER = '3e3e0000-0000-4000-8000-00000000bbbb';
/** Only ever used as text inside a service_key — `vendor_live_ultra_addons` counts by key, it reads no shop row. */
const SHOP = '3e3e0000-0000-4000-8000-00000000cccc';
const FAR = '2099-01-01T00:00:00Z';

/** The buyer's own unpaid Ultra Add-on order (no window yet — the server stamps it on approval). */
let orderId: string;
/** The buyer's own unpaid order that the SERVER already gave a window (a renewal's shape). */
let stampedId: string;

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

async function windowOf(id: string): Promise<string | null> {
  const r = await db.query<{ e: string | null }>(
    `SELECT to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS e FROM public.orders WHERE order_id = $1`,
    [id],
  );
  return r.rows[0]?.e ?? null;
}

async function liveAddOns(): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons($1::uuid) AS n`, [SHOP]);
  return Number(r.rows[0]?.n);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // Seeded as the migration role (owner) on purpose: the setup is not what is under test, the UPDATE path is.
  for (const u of [BUYER, STRANGER]) {
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [u, `${u}@expires-guard.test`]);
    await db.query(
      `INSERT INTO public.users (user_id, email, public_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [u, `${u}@expires-guard.test`, `S89U${u.slice(0, 10).replace(/-/g, '')}`],
    );
  }

  const a = await db.query<{ id: string }>(
    `INSERT INTO public.orders
       (user_id, status, description, requested_total_php, reference_code, public_id, service_key)
     VALUES ($1, 'submitted', 'expires guard probe · add-on', 2490, 'EXPGRD01', 'S89O00EXPGRD1', $2)
     RETURNING order_id AS id`,
    [BUYER, `vendor_ultra_addon__${SHOP}`],
  );
  orderId = a.rows[0]!.id;

  const b = await db.query<{ id: string }>(
    `INSERT INTO public.orders
       (user_id, status, description, requested_total_php, reference_code, public_id, expires_at)
     VALUES ($1, 'submitted', 'expires guard probe · stamped', 2490, 'EXPGRD02', 'S89O00EXPGRD2', '2026-12-17T08:00:00Z')
     RETURNING order_id AS id`,
    [BUYER],
  );
  stampedId = b.rows[0]!.id;
  await reset();
});

after(async () => {
  await reset();
  await db?.close();
});

/* ── 1. META — the session is really unprivileged ───────────────────────────*/

test('META: the probe session is `authenticated`, unprivileged, and not the table owner', async () => {
  await asUser(BUYER);
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

test('the buyer CANNOT set their own window on their own submitted order', async () => {
  await asUser(BUYER);
  const err = await errOf(`UPDATE public.orders SET expires_at = $2 WHERE order_id = $1`, [orderId, FAR]);
  await reset();

  assert.ok(err, 'the buyer set their own paid window before paying — one payment would keep the add-on for years');
  assert.match(err, /protected money column change not allowed/i, `expected the guard_orders_protected_columns refusal, got: ${err}`);
  assert.equal(await windowOf(orderId), null, 'the window changed despite the refusal');
});

test('the buyer cannot move or clear a window the server set', async () => {
  await asUser(BUYER);
  const later = await errOf(`UPDATE public.orders SET expires_at = $2 WHERE order_id = $1`, [stampedId, FAR]);
  const cleared = await errOf(`UPDATE public.orders SET expires_at = NULL WHERE order_id = $1`, [stampedId]);
  await reset();

  assert.match(later ?? '', /protected money column change not allowed/i, `moving the window was not refused: ${later}`);
  assert.match(cleared ?? '', /protected money column change not allowed/i, `clearing the window was not refused: ${cleared}`);
  assert.equal(await windowOf(stampedId), '2026-12-17T08:00:00Z', 'the server’s window changed despite the refusal');
});

test('POSITIVE CONTROL: an owner update the guard allowed before still works (same session, same row)', async () => {
  await asUser(BUYER);
  const r = await db
    .query<{ k: string | null }>(`UPDATE public.orders SET payment_method_key = 'gcash' WHERE order_id = $1 RETURNING payment_method_key AS k`, [orderId])
    .then(
      (x) => ({ err: null as string | null, rows: x.rows }),
      (e: unknown) => ({ err: e instanceof Error ? e.message : String(e), rows: [] as { k: string | null }[] }),
    );
  await reset();
  assert.equal(r.err, null, `the row must stay writable — a blanket denial would make the lock above meaningless. Got: ${r.err}`);
  assert.equal(r.rows.length, 1, 'the owner’s own row was not reachable — the refusals above would prove nothing');
  assert.equal(r.rows[0]?.k, 'gcash');
});

test('NO-OP CONTROL: re-writing the SAME window is allowed (`is distinct from`)', async () => {
  await asUser(BUYER);
  const same = await errOf(`UPDATE public.orders SET expires_at = '2026-12-17T08:00:00Z' WHERE order_id = $1`, [stampedId]);
  const stillNull = await errOf(`UPDATE public.orders SET expires_at = NULL WHERE order_id = $1`, [orderId]);
  await reset();
  assert.equal(same, null, `the guard must compare values, not notice the column was mentioned. Got: ${same}`);
  assert.equal(stillNull, null, `NULL → NULL is no change and must pass. Got: ${stillNull}`);
});

test('DIFFERENTIAL CONTROL: the same statement SUCCEEDS as service_role (the activation hook’s client)', async () => {
  await asService();
  const err = await errOf(`UPDATE public.orders SET expires_at = $2 WHERE order_id = $1`, [stampedId, FAR]);
  const back = await errOf(`UPDATE public.orders SET expires_at = '2026-12-17T08:00:00Z' WHERE order_id = $1`, [stampedId]);
  await reset();
  assert.equal(err, null, `the denial must be attributable to the guard, not a broken statement: ${err}`);
  assert.equal(back, null);
  assert.equal(await windowOf(stampedId), '2026-12-17T08:00:00Z');
});

/* ── 3. END TO END — the exploit this closes ────────────────────────────────*/

test('END TO END: a planted window never becomes a live Ultra Add-on; the server’s stamp does', async () => {
  // The buyer tries; the order is then approved (status → paid) WITHOUT the hook's stamp having run.
  await asUser(BUYER);
  await errOf(`UPDATE public.orders SET expires_at = $2 WHERE order_id = $1`, [orderId, FAR]);
  await reset();
  await asService();
  assert.equal(await errOf(`UPDATE public.orders SET status = 'paid' WHERE order_id = $1`, [orderId]), null);
  await reset();
  assert.equal(await liveAddOns(), 0, 'a paid order with a buyer-typed window was counted as a live add-on');

  // The server's own 28 days DO count — the guard did not break the real path.
  await asService();
  assert.equal(await errOf(`UPDATE public.orders SET expires_at = now() + interval '28 days' WHERE order_id = $1`, [orderId]), null);
  await reset();
  assert.equal(await liveAddOns(), 1, 'the server-stamped window was not counted — the guard broke the activation path');

  // And once paid, the buyer still cannot stretch it.
  await asUser(BUYER);
  const stretch = await db
    .query(`UPDATE public.orders SET expires_at = $2 WHERE order_id = $1 RETURNING order_id`, [orderId, FAR])
    .then(
      (x) => ({ err: null as string | null, n: x.rows.length }),
      (e: unknown) => ({ err: e instanceof Error ? e.message : String(e), n: 0 }),
    );
  await reset();
  // Refused by the guard, or the paid row is no longer the buyer's to write (RLS) — either way it did not move.
  assert.ok(stretch.err !== null || stretch.n === 0, 'the buyer stretched a paid window');
  assert.notEqual(await windowOf(orderId), '2099-01-01T00:00:00Z');
});

/* ── 4. RLS still carries its own weight ────────────────────────────────────*/

test('a DIFFERENT authenticated user reaches the row not at all (RLS, not the guard)', async () => {
  await asUser(STRANGER);
  const r = await db.query(`UPDATE public.orders SET payment_method_key = 'stolen' WHERE order_id = $1 RETURNING order_id`, [stampedId]);
  await reset();
  assert.equal(r.rows.length, 0, 'orders_owner_write leaked another user’s order');
});
