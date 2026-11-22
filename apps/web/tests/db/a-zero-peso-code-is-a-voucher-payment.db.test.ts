/**
 * ₱0 CODES ON /pay — migration 20271357859993_pay_zero_code_confirm.sql (controller 2026-11-22, follow-up to #8130).
 *
 * Asserted BY BEHAVIOUR against the replayed schema — the real constraint, the real function, the real roles:
 *
 *   1. A ₱0 payment row exists ONLY on channel 'voucher' — the admin's confirmation request. Any other channel still
 *      needs more than ₱0, and a negative amount is refused everywhere.
 *   2. `pay_reprice_order_with_code` re-prices an unpaid order — and refuses, in the same statement, when a Maya
 *      checkout is open for it, when a code is already on it, when it is admin-quoted, or when it is no longer unpaid.
 *   3. The function is the server's only: `authenticated` and `anon` cannot call it.
 *   4. ONCE — the ₱0 row's fixed per-order key means a second "Send for confirmation" is refused by the database
 *      itself (23505), so the admin queue holds exactly one row however many times it is pressed.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let uid: string;
let eventId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
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
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

let refSeq = 0;
const nextRef = () => 'SN' + (0x20000000 + refSeq++).toString(16).toUpperCase().slice(0, 8);

/** An unpaid ₱2,500 order, minted the sanctioned way (service_role). */
async function newOrder(status = 'awaiting_payment'): Promise<string> {
  await asService();
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'PAPIC_GUEST', 'Zero-code test', 2500, $3::public.order_status, $4)
     RETURNING order_id`,
    [eventId, uid, status, nextRef()],
  );
  return o.rows[0]!.order_id;
}

const reprice = async (orderId: string, code = 'FREE100', centavos = 250000): Promise<boolean> => {
  const r = await db.query<{ ok: boolean }>(`SELECT public.pay_reprice_order_with_code($1, $2, $3) AS ok`, [orderId, code, centavos]);
  return r.rows[0]!.ok;
};
const codeOn = async (orderId: string) =>
  (await db.query<{ c: string | null; d: string }>(`SELECT voucher_code_applied AS c, voucher_discount_centavos::text AS d FROM public.orders WHERE order_id = $1`, [orderId])).rows[0]!;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  uid = (await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ('zero-code@example.com') RETURNING id`)).rows[0]!.id;
  eventId = (await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Zero Code Event', 'birthday') RETURNING event_id`)).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`, [eventId, uid]);
});
after(async () => {
  await db?.close();
});

test('1 · a ₱0 payment row exists only on the voucher channel', async () => {
  const orderId = await newOrder();
  const insert = (amount: number, channel: string) =>
    tryQuery(`INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at) VALUES ($1, $2, $3, $4, CURRENT_DATE)`, [orderId, uid, amount, channel]);
  assert.equal(await insert(0, 'voucher'), null, 'the ₱0 voucher confirmation row was refused');
  for (const channel of ['bdo', 'gcash', 'maya', 'bank_transfer', 'manual', '']) {
    assert.match((await insert(0, channel)) ?? 'ACCEPTED', /payments_amount_php_positive_or_voucher/, `a ₱0 row was accepted on channel "${channel}"`);
  }
  assert.match((await insert(-1, 'voucher')) ?? 'ACCEPTED', /payments_amount_php_positive_or_voucher/, 'a negative voucher row was accepted');
  assert.match((await insert(-1, 'bdo')) ?? 'ACCEPTED', /payments_amount_php_positive_or_voucher/);
  // Real money is unchanged, on every channel — voucher included.
  assert.equal(await insert(2500, 'bdo'), null);
  assert.equal(await insert(1, 'voucher'), null);
  await reset();
  // Exactly ONE amount check is left on the table (the old "> 0" one is gone, not shadowing this one).
  const checks = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.payments'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%amount_php%'`,
  );
  assert.equal(checks.rows.length, 1, `amount checks on payments: ${checks.rows.map((r) => r.def).join(' | ')}`);
});

test('2 · the re-price lands on an unpaid order — and never under an open Maya checkout', async () => {
  // The plain case.
  const a = await newOrder();
  assert.equal(await reprice(a), true);
  assert.deepEqual(await codeOn(a), { c: 'FREE100', d: '250000' });
  // One code per order: a second call changes nothing.
  assert.equal(await reprice(a, 'OTHER', 100), false);
  assert.deepEqual(await codeOn(a), { c: 'FREE100', d: '250000' });

  // An open Maya checkout: refused, the order untouched.
  const b = await newOrder();
  await db.query(
    `INSERT INTO public.maya_checkouts (checkout_id, order_id, user_id, request_reference_number, amount_php, environment, status)
     VALUES ($1, $2, $3, 'SNTEST', 2500, 'sandbox', 'created')`,
    [`chk-${b}`.slice(0, 60), b, uid],
  );
  assert.equal(await reprice(b), false, 'an order with an OPEN Maya checkout was re-priced');
  assert.deepEqual(await codeOn(b), { c: null, d: '0' });
  // Once that checkout is closed (not paid), the code may apply.
  await db.query(`UPDATE public.maya_checkouts SET status = 'expired' WHERE order_id = $1`, [b]);
  assert.equal(await reprice(b), true);

  // Admin-quoted, already sent, already paid: refused.
  const quoted = await newOrder();
  await db.query(`UPDATE public.orders SET confirmed_total_php = 2000 WHERE order_id = $1`, [quoted]);
  assert.equal(await reprice(quoted), false, 'an admin-quoted order was re-priced');
  for (const status of ['submitted', 'paid', 'cancelled']) {
    const o = await newOrder('awaiting_payment');
    await db.query(`UPDATE public.orders SET status = $2::public.order_status WHERE order_id = $1`, [o, status]);
    assert.equal(await reprice(o), false, `an order at status=${status} was re-priced`);
  }
  // A draft is still unpaid.
  assert.equal(await reprice(await newOrder('draft')), true);
  // Never a ₱0 or negative discount, never a blank code (orders_voucher_coherence would refuse the row anyway).
  const z = await newOrder();
  assert.equal(await reprice(z, 'FREE100', 0), false);
  assert.deepEqual(await codeOn(z), { c: null, d: '0' });
  await reset();
});

test('3 · only the server may call it', async () => {
  const o = await newOrder();
  await reset();
  for (const role of ['authenticated', 'anon']) {
    await db.exec(`SET ROLE ${role}`);
    const err = await tryQuery(`SELECT public.pay_reprice_order_with_code($1, 'FREE100', 100)`, [o]);
    await db.exec(`RESET ROLE`);
    assert.match(err ?? 'ALLOWED', /permission denied/i, `${role} could call the re-price`);
  }
  assert.deepEqual(await codeOn(o), { c: null, d: '0' });
});

test('4 · the ₱0 confirmation lands in the queue ONCE', async () => {
  const o = await newOrder();
  const send = () =>
    tryQuery(
      `INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at, reference_number, client_idempotency_key)
       VALUES ($1, $2, 0, 'voucher', CURRENT_DATE, 'FREE100SNTEST', $3)`,
      [o, uid, `voucher-zero-${o}`],
    );
  assert.equal(await send(), null, 'the first press was refused');
  assert.match((await send()) ?? 'ACCEPTED', /duplicate key|payments_order_idempotency_key_uq/i, 'a second press wrote a second row');
  await reset();
  const rows = await db.query<{ n: string; status: string }>(`SELECT count(*)::text AS n, min(status::text) AS status FROM public.payments WHERE order_id = $1`, [o]);
  assert.deepEqual(rows.rows[0], { n: '1', status: 'pending' }, 'the queue must hold exactly one pending row — nothing is approved by sending');
});
