/**
 * A PAID SERVICE THE BUYER CANNOT USE BECOMES PAPIC CREDITS, OR MOVES TO THEIR
 * NEXT EVENT — and neither can happen twice (migration 20271309226989).
 *
 * The public refund page promises both (`app/(shell)/refunds/page.tsx`); owner
 * 2026-11-05: "yes to refund". These run the two SQL functions for real, because
 * the idempotency and the ownership refusal live inside them — a stubbed client
 * would "pass" against a mock that never took the row lock or ran the check.
 *
 * Run: cd apps/web && npx tsx --test tests/db/a-service-they-cannot-use-becomes-credits-or-moves.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let seq = 0;
async function newUser(): Promise<string> {
  seq += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`remedy-${seq}@test.local`],
  );
  return r.rows[0]!.id;
}

/** A non-wedding event the user hosts, created at a fixed point in time. */
async function hostedEvent(userId: string, name: string, createdAt: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, created_at)
     VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [name, createdAt],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
  return eventId;
}

/** A paid order on `eventId` with one matched payment of `paidPhp`. */
async function paidOrder(
  userId: string,
  eventId: string,
  opts: { paidPhp?: number; sku?: string; status?: string } = {},
): Promise<string> {
  seq += 1;
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code, service_key, status)
     VALUES ($1, $2, 'Live Studio', 3000, $3, $4, $5) RETURNING order_id`,
    [userId, eventId, `RMDY${seq}`, opts.sku ?? 'LIVE_STUDIO', opts.status ?? 'paid'],
  );
  const orderId = o.rows[0]!.order_id;
  if ((opts.paidPhp ?? 3360) > 0) {
    await db.query(
      `INSERT INTO public.payments (order_id, user_id, amount_php, channel, status)
       VALUES ($1, $2, $3, 'gcash', 'matched')`,
      [orderId, userId, opts.paidPhp ?? 3360],
    );
  }
  return orderId;
}

const REASON = 'Live Studio could not start on the day — our encoder failed.';

type Result = Record<string, unknown> & { ok: boolean; applied?: boolean; refusal?: string };

async function convert(orderId: string, credits: number, adminId: string | null): Promise<Result> {
  const r = await db.query<{ r: Result }>(
    `SELECT public.admin_convert_order_to_papic_credits($1, $2, $3, $4) AS r`,
    [orderId, credits, REASON, adminId],
  );
  return r.rows[0]!.r;
}

async function move(orderId: string, toEventId: string, adminId: string | null): Promise<Result> {
  const r = await db.query<{ r: Result }>(
    `SELECT public.admin_move_order_to_next_event($1, $2, $3, $4) AS r`,
    [orderId, toEventId, REASON, adminId],
  );
  return r.rows[0]!.r;
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const r = await db.query<{ n: number }>(sql, params);
  return Number(r.rows[0]!.n);
}

// ── Convert ───────────────────────────────────────────────────────────────

test('convert: the credits land in the event pot, with one ledger row naming who and why', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'the wedding', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev);

  const r = await convert(order, 1500, admin);
  assert.equal(r.ok, true);
  assert.equal(r.applied, true);
  assert.equal(r.event_id, ev);

  const g = await db.query<{ points: number; source: string; seat_id: string | null; event_id: string }>(
    `SELECT points, source, seat_id, event_id FROM public.papic_event_point_grants WHERE order_id = $1`,
    [order],
  );
  assert.equal(g.rows.length, 1);
  assert.equal(g.rows[0]!.points, 1500);
  assert.equal(g.rows[0]!.source, 'admin');
  assert.equal(g.rows[0]!.seat_id, null, 'into the SHARED pot, not a camera');
  assert.equal(g.rows[0]!.event_id, ev);

  const led = await db.query<{ admin_user_id: string; reason: string; paid_php: string; papic_credits: number }>(
    `SELECT admin_user_id, reason, paid_php, papic_credits FROM public.order_service_remedies WHERE order_id = $1`,
    [order],
  );
  assert.equal(led.rows.length, 1);
  assert.equal(led.rows[0]!.admin_user_id, admin);
  assert.equal(led.rows[0]!.reason, REASON);
  assert.equal(Number(led.rows[0]!.paid_php), 3360, 'the paid amount is the matched payments');
  assert.equal(led.rows[0]!.papic_credits, 1500);
});

test('convert: a double submit applies ONCE — one grant, one ledger row', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'double click', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev);

  const [a, b] = await Promise.all([convert(order, 900, admin), convert(order, 900, admin)]);
  const applied = [a, b].filter((r) => r.applied === true).length;
  assert.equal(applied, 1, 'exactly one press applies');
  assert.ok([a, b].every((r) => r.ok === true), 'the second press is a quiet no-op, not an error');

  // And a later, different number is refused as already done.
  const c = await convert(order, 5000, admin);
  assert.equal(c.applied, false);
  assert.equal(c.credits, 900, 'the first conversion stands');

  assert.equal(await count(`SELECT count(*) AS n FROM public.papic_event_point_grants WHERE order_id = $1`, [order]), 1);
  assert.equal(await count(`SELECT count(*) AS n FROM public.order_service_remedies WHERE order_id = $1`, [order]), 1);
});

test('convert: refused for an unpaid order, a free order, a supplier bill, and a bad count', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'refusals', '2026-01-01T00:00:00Z');

  const unpaid = await paidOrder(buyer, ev, { status: 'awaiting_payment' });
  assert.equal((await convert(unpaid, 100, admin)).refusal, 'not_paid');

  const free = await paidOrder(buyer, ev, { paidPhp: 0 });
  assert.equal((await convert(free, 100, admin)).refusal, 'nothing_paid');

  const paid = await paidOrder(buyer, ev);
  assert.equal((await convert(paid, 0, admin)).refusal, 'bad_credits');
  assert.equal((await convert(paid, -5, admin)).refusal, 'bad_credits');

  const shortReason = await db.query<{ r: Result }>(
    `SELECT public.admin_convert_order_to_papic_credits($1, 100, 'too short', $2) AS r`,
    [paid, admin],
  );
  assert.equal(shortReason.rows[0]!.r.refusal, 'short_reason');

  assert.equal(
    await count(`SELECT count(*) AS n FROM public.papic_event_point_grants WHERE order_id = ANY($1)`, [[unpaid, free, paid]]),
    0,
    'a refusal grants nothing',
  );
});

test('convert: a later refund takes the converted credits back (deleted by order_id)', async () => {
  // The reversal `refundOrder` already runs (reversePapicPassPoints) deletes by
  // order_id — the same key this grant carries. Proven here at the data level.
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'refund after convert', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev);
  await convert(order, 300, admin);
  await db.query(`DELETE FROM public.papic_event_point_grants WHERE order_id = $1`, [order]);
  const led = await db.query<{ grant_id: string | null }>(
    `SELECT grant_id FROM public.order_service_remedies WHERE order_id = $1`,
    [order],
  );
  assert.equal(led.rows[0]!.grant_id, null, 'the ledger row survives with its grant link cleared');
});

// ── Move ──────────────────────────────────────────────────────────────────

test('move: the order goes to the buyer\'s next event, with one ledger row from → to', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const first = await hostedEvent(buyer, 'called off', '2026-01-01T00:00:00Z');
  const next = await hostedEvent(buyer, 'the next one', '2026-03-01T00:00:00Z');
  await hostedEvent(buyer, 'a later one', '2026-06-01T00:00:00Z');
  const order = await paidOrder(buyer, first);

  const shown = await db.query<{ next_event_id: string; next_event_name: string }>(
    `SELECT next_event_id, next_event_name FROM public.orders_next_event($1)`,
    [[order]],
  );
  assert.equal(shown.rows[0]!.next_event_id, next, 'the page and the move read one definition');
  assert.equal(shown.rows[0]!.next_event_name, 'the next one');

  const r = await move(order, next, admin);
  assert.equal(r.ok, true);
  assert.equal(r.applied, true);

  const o = await db.query<{ event_id: string }>(`SELECT event_id FROM public.orders WHERE order_id = $1`, [order]);
  assert.equal(o.rows[0]!.event_id, next);

  const led = await db.query<{ from_event_id: string; to_event_id: string; admin_user_id: string }>(
    `SELECT from_event_id, to_event_id, admin_user_id FROM public.order_service_remedies WHERE order_id = $1`,
    [order],
  );
  assert.equal(led.rows.length, 1);
  assert.equal(led.rows[0]!.from_event_id, first);
  assert.equal(led.rows[0]!.to_event_id, next);
  assert.equal(led.rows[0]!.admin_user_id, admin);
});

test('move: a double submit applies ONCE', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const first = await hostedEvent(buyer, 'first', '2026-01-01T00:00:00Z');
  const next = await hostedEvent(buyer, 'next', '2026-02-01T00:00:00Z');
  const order = await paidOrder(buyer, first);

  const [a, b] = await Promise.all([move(order, next, admin), move(order, next, admin)]);
  assert.equal([a, b].filter((r) => r.applied === true).length, 1, 'exactly one press applies');
  assert.ok([a, b].every((r) => r.ok === true), 'the second press is a quiet no-op');
  assert.equal(await count(`SELECT count(*) AS n FROM public.order_service_remedies WHERE order_id = $1`, [order]), 1);
});

test('move: to an event the buyer does not own is REFUSED, and nothing changes', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const stranger = await newUser();
  const first = await hostedEvent(buyer, 'mine', '2026-01-01T00:00:00Z');
  await hostedEvent(buyer, 'my next', '2026-02-01T00:00:00Z');
  const theirs = await hostedEvent(stranger, 'somebody else\'s', '2026-01-15T00:00:00Z');
  const order = await paidOrder(buyer, first);

  const r = await move(order, theirs, admin);
  assert.equal(r.ok, false);
  assert.equal(r.refusal, 'not_owner');

  const o = await db.query<{ event_id: string }>(`SELECT event_id FROM public.orders WHERE order_id = $1`, [order]);
  assert.equal(o.rows[0]!.event_id, first, 'the order did not move');
  assert.equal(await count(`SELECT count(*) AS n FROM public.order_service_remedies WHERE order_id = $1`, [order]), 0);
});

test('move: only the NEXT event — a later one, or none yet, is refused', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const first = await hostedEvent(buyer, 'first', '2026-01-01T00:00:00Z');
  const next = await hostedEvent(buyer, 'next', '2026-02-01T00:00:00Z');
  const later = await hostedEvent(buyer, 'later', '2026-04-01T00:00:00Z');
  const order = await paidOrder(buyer, first);
  assert.equal((await move(order, later, admin)).refusal, 'not_next_event');

  // On the newest event there is no next one yet: it waits.
  const onLatest = await paidOrder(buyer, later);
  assert.equal((await move(onLatest, next, admin)).refusal, 'no_next_event');
});

test('move: refused once its value became credits, and when the event pot has been used', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const first = await hostedEvent(buyer, 'first', '2026-01-01T00:00:00Z');
  const next = await hostedEvent(buyer, 'next', '2026-02-01T00:00:00Z');

  const converted = await paidOrder(buyer, first);
  await convert(converted, 200, admin);
  assert.equal((await move(converted, next, admin)).refusal, 'already_converted');

  // A Papic pack whose credits sit in the shared pot, and the pot has been used.
  const pack = await paidOrder(buyer, first, { sku: 'PAPIC_GUEST_1K' });
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id) VALUES ($1, 1000, 'topup_order', $2)`,
    [first, pack],
  );
  await db.query(
    `INSERT INTO public.papic_event_pool_usage (event_id, points_used) VALUES ($1, 5)
     ON CONFLICT (event_id) DO UPDATE SET points_used = 5`,
    [first],
  );
  assert.equal((await move(pack, next, admin)).refusal, 'credits_used');
});

test('move: an unused Papic pack takes its shared-pot credits with it', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const first = await hostedEvent(buyer, 'first', '2026-01-01T00:00:00Z');
  const next = await hostedEvent(buyer, 'next', '2026-02-01T00:00:00Z');
  const pack = await paidOrder(buyer, first, { sku: 'PAPIC_GUEST_1K' });
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id) VALUES ($1, 1000, 'topup_order', $2)`,
    [first, pack],
  );

  const r = await move(pack, next, admin);
  assert.equal(r.applied, true);
  assert.equal(r.grants_moved, 1);
  const g = await db.query<{ event_id: string }>(
    `SELECT event_id FROM public.papic_event_point_grants WHERE order_id = $1`,
    [pack],
  );
  assert.equal(g.rows[0]!.event_id, next);
});

// ── Access ────────────────────────────────────────────────────────────────

test('neither the ledger nor the two actions are reachable by a signed-in user or anon', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const fn of [
      'public.admin_convert_order_to_papic_credits(uuid, integer, text, uuid)',
      'public.admin_move_order_to_next_event(uuid, uuid, text, uuid)',
      'public.orders_next_event(uuid[])',
    ]) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn]);
      assert.equal(r.rows[0]!.ok, false, `${role} can execute ${fn}`);
    }
    const t = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.order_service_remedies', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(t.rows[0]!.ok, false, `${role} can read the ledger`);
  }
});
