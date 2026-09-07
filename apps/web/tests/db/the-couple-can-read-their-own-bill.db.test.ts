/**
 * `event_basket_orders_granting` — the couple learns what their own bill covers,
 * and NOBODY else does.
 *
 * ── WHY AN RPC AND NOT A GRANT ──────────────────────────────────────────────
 * `onboarding_order_items` is a bill's contents. RLS on, zero policies, grants
 * revoked — `onboarding-basket-one-bill.db.test.ts` fails if any session role
 * can read it. So the ownership question in `lib/onboarding-order-items.ts`
 * (`eventBasketOrdersGranting`) 42501'd on every hit from 2026-08-11, and its
 * own `return []` turned the refusal into "does not own it": a couple who had
 * PAID for Setnayan AI inside an onboarding basket was invited to buy it again.
 *
 * The first fix opened the table. This one keeps it shut and answers the
 * question through a SECURITY DEFINER function instead.
 *
 * ⚠ THE SOURCE GUARD IN `lib/the-couple-can-read-their-own-bill.test.ts` CANNOT
 * PROVE ANY OF THIS. It reads the migration text; a SECURITY DEFINER function
 * that says `current_couple_event_ids()` and still hands a guest the rows would
 * satisfy it completely. These tests run the function against the replayed
 * schema as each role in turn, which is the only way to see who actually gets
 * what.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  guest: '',
  otherCouple: '',
  eventId: '',
  otherEventId: '',
  orderId: '',
};

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/** Call the RPC as `uid` in the `authenticated` role and return its rows. */
async function grantingAs(
  uid: string | null,
  eventId: string,
  serviceCode: string,
  role = 'authenticated',
): Promise<Array<{ order_id: string; status: string }>> {
  await setAuthUid(db, uid);
  await setAuthRole(role);
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ order_id: string; status: string }>(
    `SELECT * FROM public.event_basket_orders_granting($1::uuid, $2::text)`,
    [eventId, serviceCode],
  );
  await reset();
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('bill-couple@audit.test');
  F.guest = await createUser('bill-guest@audit.test');
  F.otherCouple = await createUser('bill-other-couple@audit.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Bill Test', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  const ev2 = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Someone Else', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  F.otherEventId = ev2.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [F.eventId, F.couple],
  );
  // A LEGITIMATELY invited guest. The point is that a real guest still must not
  // learn what the couple was billed.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`,
    [F.eventId, F.guest],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [F.otherEventId, F.otherCouple],
  );

  await db.query(
    `INSERT INTO public.users (user_id, email) VALUES ($1,'bill-couple@audit.test')
     ON CONFLICT (user_id) DO NOTHING`,
    [F.couple],
  );

  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'ONBOARDING_SERVICES', 'Onboarding basket', 4999, 'submitted', 'BILLTEST-1')
     RETURNING order_id`,
    [F.eventId, F.couple],
  );
  F.orderId = order.rows[0]!.order_id;

  await db.query(
    `INSERT INTO public.onboarding_order_items (order_id, service_code, quantity, unit_price_php)
     VALUES ($1, 'SETNAYAN_AI', 1, 2499)`,
    [F.orderId],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the couple gets their own basket line — the read that was 42501ing', async () => {
  const rows = await grantingAs(F.couple, F.eventId, 'SETNAYAN_AI');
  assert.equal(rows.length, 1, 'the couple cannot see what they paid for');
  assert.equal(rows[0]!.order_id, F.orderId);
  assert.equal(rows[0]!.status, 'submitted');
});

test('an invited GUEST on the same event gets nothing', async () => {
  // This is the half a policy through the member-wide current_event_ids() would
  // have got wrong — see couple-host-policy-scope.db.test.ts T1.
  const rows = await grantingAs(F.guest, F.eventId, 'SETNAYAN_AI');
  assert.equal(rows.length, 0, 'a guest can read the couple’s bill');
});

test('another couple asking about someone else’s event gets nothing', async () => {
  const rows = await grantingAs(F.otherCouple, F.eventId, 'SETNAYAN_AI');
  assert.equal(rows.length, 0, 'one couple can read another couple’s bill');
});

test('a signed-out caller gets nothing', async () => {
  const rows = await grantingAs(null, F.eventId, 'SETNAYAN_AI');
  assert.equal(rows.length, 0, 'an anonymous caller can read a bill');
});

test('the couple asking about a service they did NOT buy gets nothing', async () => {
  const rows = await grantingAs(F.couple, F.eventId, 'PAPIC_ONE');
  assert.equal(rows.length, 0);
});

test('the elevated server client still gets the rows — activation depends on it', async () => {
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  const r = await db.query(
    `SELECT * FROM public.event_basket_orders_granting($1::uuid, $2::text)`,
    [F.eventId, 'SETNAYAN_AI'],
  );
  await reset();
  assert.equal(r.rows.length, 1, 'service_role lost its read — activation would grant nothing');
});

test('🔑 the table itself is STILL unreadable by every session role', async () => {
  // The whole reason this is an RPC. If this ever flips, the RPC was pointless
  // and `onboarding-basket-one-bill.db.test.ts` is about to fail too.
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.onboarding_order_items', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]?.ok, false, `${role} can read onboarding_order_items`);
  }
});

test('anon cannot even EXECUTE the function', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege(
       'anon',
       'public.event_basket_orders_granting(uuid, text)',
       'EXECUTE') AS ok`,
  );
  assert.equal(r.rows[0]?.ok, false, 'anon holds EXECUTE on the bill RPC');
});
