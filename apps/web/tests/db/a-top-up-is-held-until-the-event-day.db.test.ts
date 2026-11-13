/**
 * 💸 BOOKING-FEE TOP-UP — SIX RULES (owner, DECISION_LOG 2026-11-12) — the SQL half, against the replayed
 * migrations. Covers 20271340632149_a_top_up_is_held_until_the_event_day.sql.
 *
 *   1 · the top-up `booking_fee_rederive_lock_fee` opens is DUE ON THE EVENT DAY (not seven days from the rise);
 *   4 · before (and on) the event day it is HELD — `vendor_event_fee_gate_stage` leaves the event open;
 *       from the day after it is owed and the event locks, exactly as an unpaid fee always has;
 *   3 · a FREE first booking stays free at any amended total — no top-up, no lock (the "frozen courtesy wins");
 *   6 · a booked quote that later drops changes no paid amount.
 *
 * Every case drives the real trigger through an UPDATE of `event_vendors.total_cost_php`.
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;
const uniq = () => `held-${Date.now()}-${++n}`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(`UPDATE public.platform_settings SET booking_fee_minting_live = TRUE WHERE id = 1`);
});

after(async () => {
  await db?.close();
});

/** Manila's calendar day, `days` from today, as `YYYY-MM-DD` — the SQL's own clock, never the test runner's. */
async function manilaDay(days: number): Promise<string> {
  const r = await db.query<{ d: string }>(
    `SELECT to_char((NOW() AT TIME ZONE 'Asia/Manila')::date + $1::int, 'YYYY-MM-DD') AS d`,
    [days],
  );
  return r.rows[0]!.d;
}

async function newVendor(): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@fee.test`],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Held Top-up Caterer', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

/** A contracted, Setnayan-sourced booking on an event dated `eventDate` (null = no date). */
async function newBooking(
  vendorProfileId: string,
  totalPhp: number,
  eventDate: string | null,
): Promise<{ eventId: string; evId: string }> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [uniq(), eventDate],
  );
  const eventId = e.rows[0]!.event_id;
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Held Top-up Caterer', 'contracted', $2, $3) RETURNING vendor_id`,
    [eventId, totalPhp, vendorProfileId],
  );
  // Billable = a client Setnayan brought (20271009140000).
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'explore')`,
    [eventId, vendorProfileId],
  );
  return { eventId, evId: r.rows[0]!.vendor_id };
}

async function openLockCharge(evId: string): Promise<{ charge_id?: string; status?: string }> {
  const r = await db.query<{ result: { charge_id?: string; status?: string } }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS result`,
    [evId],
  );
  return r.rows[0]!.result;
}

/** Five throwaway bookings so the next one is billable (past the free-5 courtesy). */
async function warmPastFree5(vendorProfileId: string): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const b = await newBooking(vendorProfileId, 10_000, null);
    await openLockCharge(b.evId);
  }
}

async function setTotal(evId: string, totalPhp: number): Promise<void> {
  await db.query(`UPDATE public.event_vendors SET total_cost_php = $1 WHERE vendor_id = $2`, [totalPhp, evId]);
}

type Row = { kind: string; status: string; amount: number; due: string | null };
async function charges(evId: string): Promise<Row[]> {
  const r = await db.query<{ kind: string; status: string; amount_charged_centavos: number; due: string | null }>(
    `SELECT kind, status, amount_charged_centavos,
            to_char((expires_at AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS due
       FROM public.booking_fee_charges WHERE event_vendor_id = $1 ORDER BY created_at`,
    [evId],
  );
  return r.rows.map((x) => ({ kind: x.kind, status: x.status, amount: Number(x.amount_charged_centavos), due: x.due }));
}

/** The gate as the supplier's own session reads it. */
async function gateStage(userId: string, eventId: string): Promise<string> {
  await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = TRUE WHERE id = 1`);
  await setAuthUid(db, userId);
  try {
    const r = await db.query<{ s: string }>(`SELECT public.vendor_event_fee_gate_stage($1, TRUE) AS s`, [eventId]);
    return r.rows[0]!.s;
  } finally {
    await setAuthUid(db, null);
    await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = NULL WHERE id = 1`);
  }
}

/** A paid booking on `eventDate`, then its quote rises → returns the top-up row. */
async function paidThenRise(eventDate: string | null) {
  const { vendorProfileId, userId } = await newVendor();
  await warmPastFree5(vendorProfileId);
  const b = await newBooking(vendorProfileId, 100_000, eventDate);
  const primary = await openLockCharge(b.evId);
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-HELD')`, [primary.charge_id!]);
  await setTotal(b.evId, 200_000);
  const topUp = (await charges(b.evId)).find((c) => c.kind === 'amendment_delta');
  return { ...b, userId, vendorProfileId, topUp };
}

/* ── RULE 1 · due on the event day ──────────────────────────────────────────────────────────────────────────────── */

test('rule 1 · a rise BEFORE the event opens a top-up due ON THE EVENT DAY (not seven days out)', async () => {
  // SABOTAGE: restore `NOW() + INTERVAL '7 days'` in booking_fee_rederive_lock_fee → RED.
  const eventDay = await manilaDay(30);
  const { topUp } = await paidThenRise(eventDay);
  assert.ok(topUp, 'the rise opened no top-up');
  assert.equal(topUp.status, 'pending');
  assert.equal(topUp.due, eventDay, 'the top-up is not due on the event day');
});

test('rule 1 · the due day reads the same in UTC (every `expires_at.slice(0, 10)` reader sees the event day)', async () => {
  const eventDay = await manilaDay(40);
  const { evId } = await paidThenRise(eventDay);
  const r = await db.query<{ utc: string }>(
    `SELECT to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS utc
       FROM public.booking_fee_charges WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
    [evId],
  );
  assert.equal(r.rows[0]!.utc, eventDay);
});

test('rule 1 · a second rise keeps the top-up due on the event day', async () => {
  const eventDay = await manilaDay(25);
  const { evId } = await paidThenRise(eventDay);
  await setTotal(evId, 250_000);
  const deltas = (await charges(evId)).filter((c) => c.kind === 'amendment_delta' && c.status === 'pending');
  assert.equal(deltas.length, 1, 'one pending top-up, raised in place');
  assert.equal(deltas[0]!.due, eventDay);
});

test('rule 1 · a rise AFTER the event day is due the day it happens, never a day in the past', async () => {
  const { topUp } = await paidThenRise(await manilaDay(-5));
  assert.equal(topUp?.due, await manilaDay(0));
});

test('rule 1 · an event with no date keeps the shipped seven days', async () => {
  const { topUp } = await paidThenRise(null);
  assert.equal(topUp?.due, await manilaDay(7));
});

/* ── RULE 4 · held, not owed, until the day after ───────────────────────────────────────────────────────────────── */

test('rule 4 · before the event day the top-up is HELD — the event stays open', async () => {
  // SABOTAGE: drop the booking_fee_top_up_is_held line from vendor_event_fee_gate_stage → RED.
  const { userId, eventId, topUp } = await paidThenRise(await manilaDay(10));
  assert.equal(topUp?.status, 'pending');
  assert.equal(await gateStage(userId, eventId), 'unlocked', 'a held top-up locked the event before its day');
});

test('rule 1 · ON the event day it is due today — still not gated', async () => {
  const { userId, eventId, evId } = await paidThenRise(await manilaDay(10));
  // The event is today: the top-up's due day is today.
  await db.query(`UPDATE public.events SET event_date = (NOW() AT TIME ZONE 'Asia/Manila')::date WHERE event_id = $1`, [eventId]);
  await db.query(
    `UPDATE public.booking_fee_charges SET expires_at = public.booking_fee_top_up_due_at($1)
      WHERE event_vendor_id = $2 AND kind = 'amendment_delta'`,
    [eventId, evId],
  );
  assert.equal((await charges(evId)).find((c) => c.kind === 'amendment_delta')!.due, await manilaDay(0));
  assert.equal(await gateStage(userId, eventId), 'unlocked', 'the event day itself gated the event');
});

test('rule 1 · from the DAY AFTER the event day the unsettled top-up locks the event', async () => {
  const { userId, eventId, evId } = await paidThenRise(await manilaDay(10));
  await db.query(
    `UPDATE public.booking_fee_charges SET expires_at = NOW() - INTERVAL '1 day'
      WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
    [evId],
  );
  assert.equal(await gateStage(userId, eventId), 'booked_fee_due', 'an overdue top-up left the event open');
});

test('rule 4 · a SETTLED top-up opens the event again', async () => {
  const { userId, eventId, evId } = await paidThenRise(await manilaDay(10));
  const id = await db.query<{ charge_id: string }>(
    `SELECT charge_id FROM public.booking_fee_charges WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
    [evId],
  );
  await db.query(`UPDATE public.booking_fee_charges SET expires_at = NOW() - INTERVAL '2 days' WHERE charge_id = $1`, [
    id.rows[0]!.charge_id,
  ]);
  assert.equal(await gateStage(userId, eventId), 'booked_fee_due');
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-TOPUP')`, [id.rows[0]!.charge_id]);
  assert.equal(await gateStage(userId, eventId), 'unlocked');
});

test('rule 4 · the held rule is the TOP-UP only — an unpaid PRIMARY fee still locks at once', async () => {
  const { vendorProfileId, userId } = await newVendor();
  await warmPastFree5(vendorProfileId);
  const b = await newBooking(vendorProfileId, 100_000, await manilaDay(30));
  const primary = await openLockCharge(b.evId);
  assert.equal(primary.status, 'pending');
  assert.equal(await gateStage(userId, b.eventId), 'booked_fee_due');
});

/* ── RULE 3 · a free first booking stays free ───────────────────────────────────────────────────────────────────── */

test('rule 3 · a FREE first booking stays free at ANY amended total — no top-up, no lock', async () => {
  // SABOTAGE: delete the `free_noop` arm from booking_fee_rederive_lock_fee → RED.
  const { vendorProfileId, userId } = await newVendor();
  const b = await newBooking(vendorProfileId, 100_000, await manilaDay(30)); // the shop's FIRST booking
  const first = await openLockCharge(b.evId);
  assert.equal(first.status, 'waived_free5', 'the first booking is free');
  for (const total of [250_000, 900_000, 5_000_000]) {
    await setTotal(b.evId, total);
    const rows = await charges(b.evId);
    assert.deepEqual(
      rows.map((r) => [r.kind, r.status, r.amount]),
      [['primary', 'waived_free5', 0]],
      `a free first booking grew a fee at ₱${total}`,
    );
  }
  const r = await db.query<{ a: { action: string } }>(`SELECT public.booking_fee_rederive_lock_fee($1) AS a`, [b.evId]);
  assert.equal(r.rows[0]!.a.action, 'free_noop');
  assert.equal(await gateStage(userId, b.eventId), 'unlocked');
});

/* ── RULE 6 · a drop changes no paid amount ─────────────────────────────────────────────────────────────────────── */

test('rule 6 · a booked quote that later DROPS changes no paid amount and opens no bill', async () => {
  const { vendorProfileId } = await newVendor();
  await warmPastFree5(vendorProfileId);
  const b = await newBooking(vendorProfileId, 200_000, await manilaDay(30));
  const primary = await openLockCharge(b.evId);
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-DROP')`, [primary.charge_id!]);
  const before = (await charges(b.evId)).find((c) => c.kind === 'primary')!;
  await setTotal(b.evId, 100_000);
  const after = await charges(b.evId);
  assert.equal(after.find((c) => c.kind === 'primary')!.amount, before.amount, 'the paid fee moved');
  assert.equal(after.find((c) => c.kind === 'primary')!.status, 'paid');
  assert.equal(after.filter((c) => c.status === 'pending').length, 0, 'a drop opened a bill');
  const refunds = await db.query(
    `SELECT 1 FROM public.orders o JOIN public.booking_fee_charges c ON o.service_key = 'vendor_booking_fee__' || c.charge_id::text
      WHERE c.event_vendor_id = $1 AND c.kind = 'amendment_credit'`,
    [b.evId],
  );
  assert.equal(refunds.rows.length, 0, 'a drop minted a money document');
});

/* ── A moved event moves its held top-up ────────────────────────────────────────────────────────────────────────── */

test('a moved event day moves its still-owing top-up with it — a settled one stays put', async () => {
  // SABOTAGE: drop the booking_fee_top_up_follows_the_event trigger → RED.
  const { eventId, evId, topUp } = await paidThenRise(await manilaDay(30));
  assert.equal(topUp?.due, await manilaDay(30));
  const moved = await manilaDay(45);
  await db.query(`UPDATE public.events SET event_date = $1::date WHERE event_id = $2`, [moved, eventId]);
  assert.equal((await charges(evId)).find((c) => c.kind === 'amendment_delta')!.due, moved, 'the top-up kept the old day');

  const id = await db.query<{ charge_id: string }>(
    `SELECT charge_id FROM public.booking_fee_charges WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
    [evId],
  );
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-MOVED')`, [id.rows[0]!.charge_id]);
  const settledDue = (await charges(evId)).find((c) => c.kind === 'amendment_delta')!.due;
  await db.query(`UPDATE public.events SET event_date = $1::date WHERE event_id = $2`, [await manilaDay(60), eventId]);
  assert.equal((await charges(evId)).find((c) => c.kind === 'amendment_delta')!.due, settledDue, 'a settled top-up moved');
});

/* ── Unlisted and uncounted: an overdue top-up takes that event's review out of the public stars ────────────────── */

async function stars(vendorProfileId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT COALESCE((SELECT trusted_review_count FROM public.vendor_trusted_review_stats WHERE vendor_profile_id = $1), 0)::int AS n`,
    [vendorProfileId],
  );
  return r.rows[0]!.n;
}

test('an OVERDUE top-up uncounts that event’s review from the public stars; settling counts it again', async () => {
  // SABOTAGE: drop the ⟵ TOP-UP line from vendor_trusted_review_stats → RED.
  const { vendorProfileId, eventId, evId } = await paidThenRise(await manilaDay(10));
  const couple = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@couple.test`],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple.rows[0]!.id]);
  await db.query(
    `INSERT INTO public.vendor_reviews (vendor_profile_id, event_id, couple_user_id, rating_overall,
       rating_communication, rating_quality, rating_value, rating_on_time, body)
     VALUES ($1,$2,$3,5,5,5,5,5,'Wonderful.')`,
    [vendorProfileId, eventId, couple.rows[0]!.id],
  );
  await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = TRUE WHERE id = 1`);
  try {
    await db.query(`SELECT public.booking_fee_top_up_refresh_stars()`);
    const counted = await stars(vendorProfileId);
    assert.ok(counted >= 1, 'the review is counted while the top-up is only held');

    const id = await db.query<{ charge_id: string }>(
      `SELECT charge_id FROM public.booking_fee_charges WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
      [evId],
    );
    await db.query(`UPDATE public.booking_fee_charges SET expires_at = NOW() - INTERVAL '2 days' WHERE charge_id = $1`, [id.rows[0]!.charge_id]);
    const overdue = await db.query<{ o: boolean }>(`SELECT public.booking_fee_top_up_overdue($1,$2) AS o`, [vendorProfileId, eventId]);
    assert.equal(overdue.rows[0]!.o, true);
    await db.query(`SELECT public.booking_fee_top_up_refresh_stars()`);
    assert.equal(await stars(vendorProfileId), counted - 1, 'an overdue top-up left its review in the stars');

    // Settling flips the status → the trigger re-reads the stars at once.
    await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-STARS')`, [id.rows[0]!.charge_id]);
    assert.equal(await stars(vendorProfileId), counted, 'settling did not count the review again');
  } finally {
    await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = NULL WHERE id = 1`);
  }
});

test('with the fee lock switched off, nothing is ever unlisted', async () => {
  const { vendorProfileId, eventId, evId } = await paidThenRise(await manilaDay(10));
  await db.query(
    `UPDATE public.booking_fee_charges SET expires_at = NOW() - INTERVAL '2 days' WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
    [evId],
  );
  const r = await db.query<{ o: boolean }>(`SELECT public.booking_fee_top_up_overdue($1,$2) AS o`, [vendorProfileId, eventId]);
  assert.equal(r.rows[0]!.o, false);
});
