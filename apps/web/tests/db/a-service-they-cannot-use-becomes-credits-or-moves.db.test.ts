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

// The packs on sale in this replay, set to the 2026-11-04 price sheet's two ends
// so the expected figure is exact: ₱99 = 150 credits and ₱999 = 3,000 credits.
// The best-value pack is ₱999 = 3,000.
const PACKS = [
  { points: 150, php: 99 },
  { points: 3000, php: 999 },
];
let packCodes: string[] = [];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const codes = await db.query<{ service_code: string }>(
    `SELECT t.service_code FROM public.papic_pass_tiers t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.service_code LIKE 'PAPIC_GUEST%' ORDER BY t.service_code LIMIT 2`,
  );
  packCodes = codes.rows.map((r) => r.service_code);
  assert.equal(packCodes.length, 2, 'the replay needs two Papic pack rows to price against');
  await db.query(`UPDATE public.papic_pass_tiers SET is_active = FALSE WHERE service_code LIKE 'PAPIC_GUEST%'`);
  await db.query(`UPDATE public.platform_retail_catalog_v2 SET is_active = FALSE WHERE service_code LIKE 'PAPIC_GUEST%'`);
  for (const [i, code] of packCodes.entries()) {
    await db.query(
      `UPDATE public.papic_pass_tiers SET is_active = TRUE, is_topup = FALSE, points = $2 WHERE service_code = $1`,
      [code, PACKS[i]!.points],
    );
    await db.query(
      `UPDATE public.platform_retail_catalog_v2 SET is_active = TRUE, retired_at = NULL, retail_price_php = $2 WHERE service_code = $1`,
      [code, PACKS[i]!.php],
    );
  }
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

/** What the admin page shows for this order — the same SQL the conversion grants from. */
async function value(orderId: string) {
  const r = await db.query<{ paid_php: string; credits: number | null; pack_credits: number | null; pack_price_php: string | null }>(
    `SELECT paid_php, credits, pack_credits, pack_price_php FROM public.orders_papic_credit_value($1)`,
    [[orderId]],
  );
  return r.rows[0]!;
}

async function convert(orderId: string, adminId: string | null, expected?: number | null): Promise<Result> {
  const shown = expected === undefined ? (await value(orderId)).credits : expected;
  const r = await db.query<{ r: Result }>(
    `SELECT public.admin_convert_order_to_papic_credits($1, $2, $3, $4) AS r`,
    [orderId, shown, REASON, adminId],
  );
  return r.rows[0]!.r;
}

async function statusOf(orderId: string): Promise<string> {
  const r = await db.query<{ s: string }>(`SELECT status::text AS s FROM public.orders WHERE order_id = $1`, [orderId]);
  return r.rows[0]!.s;
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

test('convert: what they paid, at the best-value pack — credits in the pot, service switched off, one ledger row', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'the wedding', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev); // ₱3,360 matched

  // ₱3,360 at ₱999 = 3,000 → floor(336000 × 3000 / 99900) = 10,090. NOT at ₱99 = 150 (5,090).
  const v = await value(order);
  assert.equal(v.credits, Math.floor((336_000 * 3000) / 99_900));
  assert.equal(v.credits, 10_090);
  assert.equal(v.pack_credits, 3000, 'priced at the best-value pack');
  assert.equal(Number(v.pack_price_php), 999);

  const r = await convert(order, admin);
  assert.equal(r.ok, true);
  assert.equal(r.applied, true);
  assert.equal(r.credits, 10_090);

  const g = await db.query<{ points: number; source: string; seat_id: string | null; event_id: string; order_id: string | null }>(
    `SELECT points, source, seat_id, event_id, order_id FROM public.papic_event_point_grants WHERE grant_id = $1`,
    [r.grant_id],
  );
  assert.equal(g.rows[0]!.points, 10_090);
  assert.equal(g.rows[0]!.source, 'admin');
  assert.equal(g.rows[0]!.seat_id, null, 'into the SHARED pot, not a camera');
  assert.equal(g.rows[0]!.event_id, ev);
  assert.equal(g.rows[0]!.order_id, null, 'no order_id: the reversal path deletes by order_id, and these credits are not part of the order');

  assert.equal(await statusOf(order), 'lapsed', 'owner 2026-11-05 "switch it off" — ended, not refunded');

  const led = await db.query<{ admin_user_id: string; reason: string; paid_php: string; papic_credits: number }>(
    `SELECT admin_user_id, reason, paid_php, papic_credits FROM public.order_service_remedies WHERE order_id = $1`,
    [order],
  );
  assert.equal(led.rows.length, 1);
  assert.equal(led.rows[0]!.admin_user_id, admin);
  assert.equal(led.rows[0]!.reason, REASON);
  assert.equal(Number(led.rows[0]!.paid_php), 3360, 'the paid amount is the matched payments');
  assert.equal(led.rows[0]!.papic_credits, 10_090);
});

test('convert: a double submit applies ONCE — one grant, one ledger row', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'double click', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev);
  const shown = (await value(order)).credits;

  const [a, b] = await Promise.all([convert(order, admin, shown), convert(order, admin, shown)]);
  assert.equal([a, b].filter((r) => r.applied === true).length, 1, 'exactly one press applies');
  assert.ok([a, b].every((r) => r.ok === true), 'the second press is a quiet no-op, not an error');

  const c = await convert(order, admin, shown);
  assert.equal(c.applied, false);

  assert.equal(
    await count(`SELECT count(*) AS n FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'admin'`, [ev]),
    1,
  );
  assert.equal(await count(`SELECT count(*) AS n FROM public.order_service_remedies WHERE order_id = $1`, [order]), 1);
});

test('convert: a figure the page did not show is refused — prices moved, nothing granted, still on', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'stale page', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev);
  const real = (await value(order)).credits!;

  const r = await convert(order, admin, real + 1);
  assert.equal(r.ok, false);
  assert.equal(r.refusal, 'prices_changed');
  assert.equal(await statusOf(order), 'paid', 'a refusal switches nothing off');
  assert.equal(
    await count(`SELECT count(*) AS n FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'admin'`, [ev]),
    0,
  );
});

test('convert: refused for an unpaid order, a free order, a Papic pack, and a short reason', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'refusals', '2026-01-01T00:00:00Z');

  const unpaid = await paidOrder(buyer, ev, { status: 'awaiting_payment' });
  assert.equal((await convert(unpaid, admin)).refusal, 'not_paid');

  const free = await paidOrder(buyer, ev, { paidPhp: 0 });
  assert.equal((await convert(free, admin)).refusal, 'nothing_paid');

  // A Papic pack is already Papic credits on the event.
  const pack = await paidOrder(buyer, ev, { sku: 'PAPIC_GUEST_1K' });
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id) VALUES ($1, 1000, 'topup_order', $2)`,
    [ev, pack],
  );
  assert.equal((await convert(pack, admin)).refusal, 'already_papic');

  const paid = await paidOrder(buyer, ev);
  const shortReason = await db.query<{ r: Result }>(
    `SELECT public.admin_convert_order_to_papic_credits($1, $2, 'too short', $3) AS r`,
    [paid, (await value(paid)).credits, admin],
  );
  assert.equal(shortReason.rows[0]!.r.refusal, 'short_reason');

  for (const o of [unpaid, free, paid]) {
    assert.notEqual(await statusOf(o), 'lapsed', 'a refusal switches nothing off');
  }
});

test('convert: no Papic pack on sale → nothing to price at, refused', async () => {
  const admin = await newUser();
  const buyer = await newUser();
  const ev = await hostedEvent(buyer, 'no packs', '2026-01-01T00:00:00Z');
  const order = await paidOrder(buyer, ev);
  await db.query(`UPDATE public.platform_retail_catalog_v2 SET is_active = FALSE WHERE service_code = ANY($1)`, [packCodes]);
  try {
    assert.equal((await value(order)).credits, null);
    assert.equal((await convert(order, admin, null)).refusal, 'no_prices');
  } finally {
    await db.query(`UPDATE public.platform_retail_catalog_v2 SET is_active = TRUE WHERE service_code = ANY($1)`, [packCodes]);
  }
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
  assert.equal((await convert(converted, admin)).applied, true);
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
      'public.orders_papic_credit_value(uuid[])',
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
