/**
 * PRIVACY: a couple / co-host must NOT see the vendor's booking-fee order.
 * END-TO-END DB verification (migrations replayed) of the tightened co-host read
 * policy (20271102603681_orders_exclude_vendor_payer_from_event_reads): the vendor-payer
 * fee order — stamped with the couple's event_id so the vendor's own pay screen
 * can scope it — must be invisible to every event member while the vendor still
 * reads it and admins still see everything.
 *
 * This is the RLS layer of a defense-in-depth fix (the app-side belt in
 * lib/orders.COUPLE_ORDERS_HIDE_VENDOR_FILTER is the second layer). RLS is the
 * real guard, so it is asserted against real SQL under SET ROLE authenticated.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function createUser(email: string, accountType: 'customer' | 'vendor' = 'customer') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
/** Impersonate an authenticated user (uid + role claim + SET ROLE) — RLS ON. */
async function asAuthed(uid: string): Promise<void> {
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

/** Insert an order as the RLS-bypassing service role (mirrors the fee lane). */
async function insertOrder(args: {
  eventId: string | null;
  userId: string | null;
  serviceKey: string | null;
  reference: string;
  description: string;
}): Promise<string> {
  await asService();
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, $4, 1000, 'paid', $5)
     RETURNING order_id`,
    [args.eventId, args.userId, args.serviceKey, args.description, args.reference],
  );
  await reset();
  return r.rows[0]!.order_id;
}

type Fixtures = {
  couple: string;
  cohost: string;
  vendorUser: string;
  admin: string;
  stranger: string;
  guest: string;
  eventId: string;
  coupleOrderId: string;
  cohostOrderId: string;
  adhocOrderId: string;
  vendorFeeOrderId: string;
};
const F: Fixtures = {
  couple: '',
  cohost: '',
  vendorUser: '',
  admin: '',
  stranger: '',
  guest: '',
  eventId: '',
  coupleOrderId: '',
  cohostOrderId: '',
  adhocOrderId: '',
  vendorFeeOrderId: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('feepriv-couple@t.test', 'customer');
  F.cohost = await createUser('feepriv-cohost@t.test', 'customer');
  F.vendorUser = await createUser('feepriv-vendor@t.test', 'vendor');
  F.admin = await createUser('feepriv-admin@t.test', 'customer');
  F.stranger = await createUser('feepriv-stranger@t.test', 'customer');
  // A GUEST of the same event. Not a party to the couple's money at all — this
  // fixture exists to pin the NARROW helper (see the guest test below).
  F.guest = await createUser('feepriv-guest@t.test', 'customer');

  // Promote the admin (is_admin() reads public.users.account_type). The
  // guard_users_privilege_columns trigger blocks escalation to 'admin' unless
  // the caller is privileged (auth.role() = 'service_role' / NULL / is_admin),
  // so run the UPDATE under the service-role claim.
  await asService();
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [F.admin]);
  await reset();

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Fee Privacy Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;

  // Couple + co-host + a guest are event members; the VENDOR is NOT a member of
  // this event.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple'), ($1, $3, 'coordinator'), ($1, $4, 'guest')`,
    [F.eventId, F.couple, F.cohost, F.guest],
  );

  // Couple-side SKU order (payer = couple, an event member).
  F.coupleOrderId = await insertOrder({
    eventId: F.eventId,
    userId: F.couple,
    serviceKey: 'SETNAYAN_AI',
    reference: 'SN-COUPLE01',
    description: 'Couple SKU order',
  });
  // A co-host's own SKU order (payer = co-host, an event member) — the partner
  // legitimately sees this (shared planning).
  F.cohostOrderId = await insertOrder({
    eventId: F.eventId,
    userId: F.cohost,
    serviceKey: 'ANIMATED_MONOGRAM',
    reference: 'SN-COHOST01',
    description: 'Co-host SKU order',
  });
  // A legacy ad-hoc order with NULL service_key, owned by the couple.
  F.adhocOrderId = await insertOrder({
    eventId: F.eventId,
    userId: F.couple,
    serviceKey: null,
    reference: 'SN-ADHOC001',
    description: 'Legacy ad-hoc order',
  });
  // The VENDOR-payer booking-fee order — stamped with the couple's event_id.
  F.vendorFeeOrderId = await insertOrder({
    eventId: F.eventId,
    userId: F.vendorUser,
    serviceKey: 'vendor_booking_fee__charge_xyz',
    reference: 'SN-VENDORFEE',
    description: 'Setnayan booking fee (5%)',
  });
});

after(async () => {
  await reset();
  await db?.close();
});

async function selectEventOrderIds(): Promise<Set<string>> {
  const r = await db.query<{ order_id: string; service_key: string | null }>(
    `SELECT order_id, service_key FROM public.orders WHERE event_id = $1`,
    [F.eventId],
  );
  return new Set(r.rows.map((row) => row.order_id));
}

test('couple: sees own + co-host + ad-hoc orders, NOT the vendor fee order', async () => {
  await asAuthed(F.couple);
  const ids = await selectEventOrderIds();
  await reset();
  assert.ok(ids.has(F.coupleOrderId), 'couple sees its own SKU order');
  assert.ok(ids.has(F.cohostOrderId), 'couple sees co-host member order (shared planning)');
  assert.ok(ids.has(F.adhocOrderId), 'couple sees its NULL-service_key ad-hoc order');
  assert.ok(!ids.has(F.vendorFeeOrderId), 'couple does NOT see the vendor booking-fee order');
});

test('co-host (coordinator): same — no vendor fee order', async () => {
  await asAuthed(F.cohost);
  const ids = await selectEventOrderIds();
  await reset();
  assert.ok(ids.has(F.coupleOrderId), 'co-host sees couple order');
  assert.ok(ids.has(F.cohostOrderId), 'co-host sees own order');
  assert.ok(!ids.has(F.vendorFeeOrderId), 'co-host does NOT see the vendor booking-fee order');
});

test('REGRESSION: a GUEST of the event reads NO orders at all — not even the couple\'s', async () => {
  // Why this test exists. The July draft of this fix was written against an
  // older policy that used current_event_ids() (EVERY event_members row) and
  // would have DROPped the later, narrower current_couple_or_coordinator_event_ids()
  // (member_type IN couple/coordinator) and recreated the broad one. It would
  // have passed every other test in this file — because they only seed a couple
  // and a coordinator — while quietly handing the couple's entire order history,
  // amounts and reference codes included, to every guest at the wedding.
  //
  // So: this is the case that tells the two helpers apart. If someone widens the
  // policy back to current_event_ids(), this is the test that goes red.
  await asAuthed(F.guest);
  const ids = await selectEventOrderIds();
  await reset();
  assert.ok(!ids.has(F.coupleOrderId), 'guest must NOT see the couple SKU order');
  assert.ok(!ids.has(F.cohostOrderId), 'guest must NOT see the co-host order');
  assert.ok(!ids.has(F.adhocOrderId), 'guest must NOT see the ad-hoc order');
  assert.ok(!ids.has(F.vendorFeeOrderId), 'guest must NOT see the vendor booking-fee order');
  assert.equal(ids.size, 0, 'a guest reads NOTHING from orders for their event');
});

test('the couple STILL sees an account-less guest purchase (user_id IS NULL)', async () => {
  // The first version of this narrowing keyed purely on is_event_member(), which
  // returns FALSE for a NULL payer — so it silently took away the host's view of
  // guest Papic purchases ("the host is NOTIFIED, not asked", owner-locked
  // 2026-07-29). papic-guest-orders.db.test.ts caught it in CI. Pinned here too,
  // so the exclusion is understood as "not the VENDOR", never "members only".
  const guestOrderId = await insertOrder({
    eventId: F.eventId,
    userId: null,
    serviceKey: 'PAPIC_GUEST',
    reference: 'SN-GUEST001',
    description: 'Papic Pool — guest top-up',
  });
  await asAuthed(F.couple);
  const ids = await selectEventOrderIds();
  await reset();
  assert.ok(ids.has(guestOrderId), 'the couple sees the account-less guest purchase on their event');
  assert.ok(!ids.has(F.vendorFeeOrderId), 'and still does NOT see the vendor booking-fee order');
});

test('ADVERSARIAL: couple cannot reach the vendor fee order by direct order_id', async () => {
  await asAuthed(F.couple);
  const r = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.orders WHERE order_id = $1`,
    [F.vendorFeeOrderId],
  );
  await reset();
  assert.equal(r.rows.length, 0, 'direct-by-id read of the vendor fee order returns nothing');
});

test('ADVERSARIAL: couple cannot reach it by reference_code either', async () => {
  await asAuthed(F.couple);
  const r = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.orders WHERE reference_code = 'SN-VENDORFEE'`,
  );
  await reset();
  assert.equal(r.rows.length, 0, 'reference-code lookup of the vendor fee order is empty');
});

test('vendor: still reads their OWN booking-fee order (via user_id = auth.uid())', async () => {
  await asAuthed(F.vendorUser);
  const r = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.orders WHERE order_id = $1`,
    [F.vendorFeeOrderId],
  );
  await reset();
  assert.equal(r.rows.length, 1, 'the vendor payer still sees their fee order');
  assert.equal(r.rows[0]!.order_id, F.vendorFeeOrderId);
});

test('admin: still sees everything on the event including the vendor fee order', async () => {
  await asAuthed(F.admin);
  const ids = await selectEventOrderIds();
  await reset();
  assert.ok(ids.has(F.coupleOrderId) && ids.has(F.cohostOrderId), 'admin sees couple-side orders');
  assert.ok(ids.has(F.vendorFeeOrderId), 'admin sees the vendor fee order');
});

test('stranger: sees none of the event orders', async () => {
  await asAuthed(F.stranger);
  const ids = await selectEventOrderIds();
  await reset();
  assert.equal(ids.size, 0, 'a non-member authenticated user sees no event orders');
});

test('app-side belt predicate: excludes vendor_% but keeps NULL + couple orders', async () => {
  // The SQL equivalent of lib/orders.COUPLE_ORDERS_HIDE_VENDOR_FILTER
  // ('service_key.is.null,service_key.not.like.vendor_*'). Proven RLS-off so the
  // belt is shown correct on its own: it must DROP the vendor fee order while
  // KEEPING the couple SKU order AND the legacy NULL-service_key ad-hoc order.
  await asService();
  const r = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.orders
       WHERE event_id = $1
         AND (service_key IS NULL OR service_key NOT LIKE 'vendor_%')`,
    [F.eventId],
  );
  await reset();
  const ids = new Set(r.rows.map((row) => row.order_id));
  assert.ok(ids.has(F.coupleOrderId), 'belt keeps the couple SKU order');
  assert.ok(ids.has(F.cohostOrderId), 'belt keeps the co-host SKU order');
  assert.ok(ids.has(F.adhocOrderId), 'belt keeps the NULL-service_key ad-hoc order');
  assert.ok(!ids.has(F.vendorFeeOrderId), 'belt drops the vendor booking-fee order');
});

test('helper: is_event_member is true for members, false for the vendor', async () => {
  await asService();
  const member = await db.query<{ b: boolean }>(
    `SELECT public.is_event_member($1, $2) AS b`,
    [F.eventId, F.couple],
  );
  const vendor = await db.query<{ b: boolean }>(
    `SELECT public.is_event_member($1, $2) AS b`,
    [F.eventId, F.vendorUser],
  );
  await reset();
  assert.equal(member.rows[0]!.b, true, 'couple is an event member');
  assert.equal(vendor.rows[0]!.b, false, 'vendor is NOT an event member');
});
