/**
 * THE FEE IS MADE AT THE YES — the SQL half, against replayed migrations.
 *
 * ⚖ Owner 2026-10-12, "APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)" (corpus
 * DECISION_LOG, 81292dc): (1) the fee is created at the supplier's yes; (7) no
 * fee, no couple gift — the quote stops promising it while waived; (9) an
 * unpaid fee for a cancelled booking expires unbilled, a paid fee stays paid.
 * Audit `BOOKING_FEE_RULES_AUDIT_2026-10-12.md` items 2 and 12.
 *
 * Migration 20271268087628. Money code, so every rule is executed, not read:
 *   A · the status vocabulary keeps every old member and learns one;
 *   B · a promo waiver holds the date; a cancelled booking holds nothing;
 *   C · a day held by a settled fee is given back when its booking ends;
 *   D · a cancelled booking's unpaid fee expires unbilled and its bill is voided
 *       — and a paid fee, a booking past its day, and a status step forward
 *       are each left alone;
 *   E · the gift quote never promises a gift on a waived fee.
 * (The no-charge gate is executed in `the-brief-is-sealed-in-sql.db.test.ts`,
 * whose one table of cases both rules are driven from.)
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await setWindow(null, null);
});

let seq = 0;
const uniq = () => `yes-${++seq}-${Date.now()}`;
const FUTURE = '2030-05-15';
const PAST = '2020-05-15';

async function setWindow(from: string | null, until: string | null): Promise<void> {
  await db.query(
    `UPDATE public.platform_settings
        SET booking_fee_free_from = $1::timestamptz, booking_fee_free_until = $2::timestamptz
      WHERE id = 1`,
    [from, until],
  );
}

async function newVendor(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Yes Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newBooking(
  vpid: string,
  opts: { date?: string | null; status?: string; totalPhp?: number; serviceId?: string | null; sourced?: boolean } = {},
) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration','birthday',$1::date) RETURNING event_id`,
    [opts.date === undefined ? FUTURE : opts.date],
  );
  const eventId = e.rows[0]!.event_id;
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, service_id)
     VALUES ($1,'photographer','Yes Studio',$2::vendor_status,$3,$4,$5) RETURNING vendor_id`,
    [eventId, opts.status ?? 'contracted', vpid, opts.totalPhp ?? 50_000, opts.serviceId ?? null],
  );
  if (opts.sourced !== false) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eventId, vpid],
    );
  }
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

/** A charge in an exact status, inserted directly (the gate and the holds read only the status). */
async function newCharge(vpid: string, eventId: string, eventVendorId: string, status: string) {
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id) VALUES ($1,$2)
     ON CONFLICT (vendor_profile_id, event_id) DO UPDATE SET updated_at = NOW()
     RETURNING ledger_id`,
    [eventId, vpid],
  );
  const c = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version,
        expires_at)
     VALUES ($1,$2,$3,$4,'lock',$5,1675000,83750,$6,'2026-07-25',
             CASE WHEN $5 = 'pending' THEN NOW() + INTERVAL '7 days' END)
     RETURNING charge_id`,
    [led.rows[0]!.ledger_id, eventId, vpid, eventVendorId, status, status === 'pending' ? 83750 : 0],
  );
  return c.rows[0]!.charge_id;
}

async function openCharge(evId: string): Promise<{ charge_id?: string; status?: string; skipped?: string }> {
  const r = await db.query<{ r: { charge_id?: string; status?: string; skipped?: string } }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS r`,
    [evId],
  );
  return r.rows[0]!.r;
}

async function warmPastFree5(vpid: string): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const b = await newBooking(vpid, { totalPhp: 10_000 });
    await openCharge(b.eventVendorId);
  }
}

const statusOf = async (chargeId: string) =>
  (await db.query<{ status: string }>(`SELECT status FROM public.booking_fee_charges WHERE charge_id = $1`, [
    chargeId,
  ])).rows[0]!.status;

const blocks = async (vpid: string, date = FUTURE) =>
  Number(
    (
      await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.vendor_calendar_blocks
          WHERE vendor_profile_id = $1 AND block_source = 'setnayan_booking'
            AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = $2::date`,
        [vpid, date],
      )
    ).rows[0]!.n,
  );

/* ── A · THE STATUS VOCABULARY ─────────────────────────────────────────── */

test('A · the status CHECK keeps every older status and accepts cancelled_unbilled', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.booking_fee_charges'::regclass
        AND conname = 'booking_fee_charges_status_check'`,
  );
  const def = r.rows[0]?.def ?? '';
  for (const s of [
    'pending', 'paid', 'failed', 'expired',
    'waived_import', 'waived_free5', 'waived_promo', 'cancelled_unbilled',
  ]) {
    assert.ok(def.includes(`'${s}'`), `the status CHECK lost '${s}': ${def}`);
  }
});

/* ── B · THE DATE HOLD ─────────────────────────────────────────────────── */

test('B · a promo-waived booking holds its date — waived_promo is settled (audit C15)', async () => {
  // SABOTAGE: drop 'waived_promo' from the hold's settled set → RED.
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'waived_promo');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeId]);
  assert.equal(await blocks(vpid), 1, 'a free-window booking left the supplier double-bookable');
});

test('B · a CANCELLED booking holds nothing, even with a paid fee', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid, { status: 'considering' });
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'paid');
  const r = await db.query<{ j: string }>(`SELECT public.vendor_hold_date_on_fee_settled($1)::text AS j`, [
    chargeId,
  ]);
  assert.equal(await blocks(vpid), 0, 'a booking that no longer exists closed a date');
  assert.match(r.rows[0]!.j, /not_booked/);
});

/* ── C · THE DAY IS GIVEN BACK ─────────────────────────────────────────── */

test('C · cancelling a contracted booking whose WAIVED fee held the day reopens the day', async () => {
  // The fee is made at the yes and a waiver settles then — so a `contracted`
  // booking holds its day by its fee. Before this migration the release
  // trigger only knew `deposit_paid`+, and the day stayed shut forever.
  // SABOTAGE: remove the `v_fee_held` arm from event_vendor_reopen_on_release → RED.
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'waived_free5');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeId]);
  assert.equal(await blocks(vpid), 1, 'fixture: the waiver must hold the day first');

  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [
    b.eventVendorId,
  ]);
  assert.equal(await blocks(vpid), 0, 'the couple backed out and the day stayed closed');
});

test('C · contracted → deposit_paid is NOT a release', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'waived_free5');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeId]);
  await db.query(`UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`, [
    b.eventVendorId,
  ]);
  assert.equal(await blocks(vpid), 1, 'a booking moving forward gave its day away');
});

test('C · a cancelled booking with a PAID fee no longer keeps ANOTHER release from reopening the day', async () => {
  // A paid fee stays paid after a cancel (owner #9) — so the release check must
  // ask whether that booking is still booked, or the day is shut forever.
  const vpid = await newVendor();
  const a = await newBooking(vpid);
  const bb = await newBooking(vpid);
  const chargeA = await newCharge(vpid, a.eventId, a.eventVendorId, 'paid');
  const chargeB = await newCharge(vpid, bb.eventId, bb.eventVendorId, 'paid');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeA]);
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeB]);
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [
    a.eventVendorId,
  ]);
  assert.equal(await blocks(vpid), 1, 'B still holds the day');
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [
    bb.eventVendorId,
  ]);
  assert.equal(
    await blocks(vpid),
    0,
    "A's paid fee kept a day shut for a booking that was cancelled — the supplier can never be booked that day again",
  );
});

/* ── D · A CANCELLED BOOKING'S UNPAID FEE EXPIRES UNBILLED (owner #9) ──── */

test('D · cancelling before the event voids the unpaid fee AND its bill', async () => {
  // SABOTAGE: drop the trigger → RED; skip the order upsert → RED on the order.
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'pending');
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [chargeId]);
  const before = await db.query<{ status: string }>(
    `SELECT status FROM public.orders WHERE service_key = 'vendor_booking_fee__' || $1::text`,
    [chargeId],
  );
  assert.equal(before.rows.length, 1, 'fixture: the bill must exist first');
  assert.notEqual(before.rows[0]!.status, 'cancelled');

  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [
    b.eventVendorId,
  ]);

  assert.equal(await statusOf(chargeId), 'cancelled_unbilled', 'the supplier still owes for a cancelled booking');
  const after = await db.query<{ status: string }>(
    `SELECT status FROM public.orders WHERE service_key = 'vendor_booking_fee__' || $1::text`,
    [chargeId],
  );
  assert.equal(after.rows[0]!.status, 'cancelled', 'the bill is still open on the supplier’s screens');
});

test('D · archiving a booked row is a cancellation too', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'pending');
  await db.query(`UPDATE public.event_vendors SET archived_at = NOW() WHERE vendor_id = $1`, [b.eventVendorId]);
  assert.equal(await statusOf(chargeId), 'cancelled_unbilled');
});

test('D · a PAID fee stays paid; a waived one stays waived', async () => {
  for (const status of ['paid', 'waived_free5', 'waived_promo']) {
    const vpid = await newVendor();
    const b = await newBooking(vpid);
    const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, status);
    await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [
      b.eventVendorId,
    ]);
    assert.equal(await statusOf(chargeId), status, `${status} was moved by a cancellation`);
  }
});

test('D · a booking that ends ON or AFTER its day keeps its bill', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid, { date: PAST });
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'pending');
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [
    b.eventVendorId,
  ]);
  assert.equal(await statusOf(chargeId), 'pending', 'the day happened; the fee is still owed');
});

test('D · a step FORWARD is not a cancellation', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'pending');
  await db.query(`UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`, [
    b.eventVendorId,
  ]);
  assert.equal(await statusOf(chargeId), 'pending');
});

test('D · a re-booking after a cancel gets a FRESH charge — the void row is not live', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const first = await openCharge(b.eventVendorId);
  assert.ok(first.charge_id, `fixture: a charge must open (${JSON.stringify(first)})`);
  await db.query(`UPDATE public.booking_fee_charges SET status = 'pending', amount_charged_centavos = 1 WHERE charge_id = $1`, [first.charge_id]);
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [b.eventVendorId]);
  assert.equal(await statusOf(first.charge_id!), 'cancelled_unbilled');
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [b.eventVendorId]);
  const second = await openCharge(b.eventVendorId);
  assert.ok(second.charge_id && second.charge_id !== first.charge_id, 'the voided charge was reused as live');
});

/* ── E · NO FEE, NO GIFT ON THE QUOTE (owner #7, audit C14) ────────────── */

async function newCard(vpid: string, gift: boolean): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services
       (vendor_profile_id, category, starting_price_php, includes_setnayan_gift, is_active)
     VALUES ($1, 'photographer', 40000, $2, false) RETURNING vendor_service_id`,
    [vpid, gift],
  );
  return r.rows[0]!.vendor_service_id;
}

const ask = async (eventId: string, vpid: string) =>
  (await db.query<{ a: string }>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS a`, [eventId, vpid]))
    .rows[0]!.a;

test('E · a running free-fee window stops the quote promising a gift', async () => {
  // SABOTAGE: remove the window arm from setnayan_gift_quote_applies → RED.
  const vpid = await newVendor();
  const yes = await newCard(vpid, true);
  await warmPastFree5(vpid);
  const q = await newBooking(vpid, { status: 'considering', serviceId: yes });
  assert.equal(await ask(q.eventId, vpid), 'applies', 'fixture: outside a window the gift is real');
  await setWindow('2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z');
  assert.equal(await ask(q.eventId, vpid), 'fee_waived', 'the quote promised photos on a waived fee');
});

test('E · a charge already waived by the window keeps the quote silent after the window closes', async () => {
  const vpid = await newVendor();
  const yes = await newCard(vpid, true);
  await warmPastFree5(vpid);
  const b = await newBooking(vpid, { serviceId: yes });
  await setWindow('2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z');
  const opened = await openCharge(b.eventVendorId);
  assert.equal(opened.status, 'waived_promo', `fixture: ${JSON.stringify(opened)}`);
  await setWindow(null, null);
  assert.equal(await ask(b.eventId, vpid), 'fee_waived', 'the charge is waived; the gift can never land');
});

test('E · a billed charge with the card on still applies', async () => {
  const vpid = await newVendor();
  const yes = await newCard(vpid, true);
  await warmPastFree5(vpid);
  const b = await newBooking(vpid, { serviceId: yes });
  const opened = await openCharge(b.eventVendorId);
  assert.equal(opened.status, 'pending');
  assert.equal(await ask(b.eventId, vpid), 'applies');
});

test('E · a FREE booking whose card says no is free_booking, not card_says_no', async () => {
  // 🔑 The order fix. `card_says_no` is the one arm the quote's own switch can
  // turn into a promise, so answering it for a free booking let a switched-on
  // quote promise the couple photos that would never be billed for.
  // SABOTAGE: ask the card before the free-5 arm → RED.
  const vpid = await newVendor();
  const no = await newCard(vpid, false);
  const q = await newBooking(vpid, { status: 'considering', serviceId: no });
  assert.equal(await ask(q.eventId, vpid), 'free_booking');
});

/* ── THE END TO END: made at the yes, waived at the yes, the day held ──── */

test('a sixth booking made inside a window is waived at the yes and holds its day', async () => {
  const vpid = await newVendor();
  await warmPastFree5(vpid);
  const b = await newBooking(vpid);
  await setWindow('2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z');
  const opened = await openCharge(b.eventVendorId);
  assert.equal(opened.status, 'waived_promo');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [opened.charge_id]);
  assert.equal(await blocks(vpid), 1);
});

/* ── G · A DELETED EVENT'S UNPAID FEE EXPIRES (owner 2026-10-13) ───────── */

test('G · deleting an event voids its UNPAID fee and bill; a paid fee stays paid', async () => {
  // SABOTAGE: drop the events_fee_expires_on_delete trigger → RED.
  const vpid = await newVendor();
  const unpaid = await newBooking(vpid);
  const paid = await newBooking(vpid);
  const owed = await newCharge(vpid, unpaid.eventId, unpaid.eventVendorId, 'pending');
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [owed]);
  const settled = await newCharge(vpid, paid.eventId, paid.eventVendorId, 'paid');

  for (const e of [unpaid.eventId, paid.eventId]) {
    await db.query(`DELETE FROM public.events WHERE event_id = $1`, [e]);
    const gone = await db.query(`SELECT 1 FROM public.events WHERE event_id = $1`, [e]);
    assert.equal(gone.rows.length, 0, 'the trigger cancelled the delete itself');
  }
  assert.equal(await statusOf(owed), 'cancelled_unbilled', 'a supplier still owes for a deleted event');
  const order = await db.query<{ status: string }>(
    `SELECT status FROM public.orders WHERE service_key = 'vendor_booking_fee__' || $1::text`,
    [owed],
  );
  assert.equal(order.rows[0]?.status, 'cancelled', 'the bill for a deleted event is still open');
  assert.equal(await statusOf(settled), 'paid', 'a paid fee was moved by the deletion');
});

/* ── H · A STALE AMENDMENT TOP-UP DOES NOT LOCK (owner 2026-10-13) ─────── */

test('H · an expired (voided) amendment delta never locks the booking', async () => {
  // SABOTAGE: drop the amendment-delta skip from vendor_event_fee_gate_stage → RED.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const uid = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Delta Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  const vpid = vp.rows[0]!.vendor_profile_id;
  const b = await newBooking(vpid);
  const primary = await newCharge(vpid, b.eventId, b.eventVendorId, 'paid');
  await db.query(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, source, kind, parent_charge_id, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     SELECT ledger_id, event_id, vendor_profile_id, event_vendor_id, 'lock', 'amendment_delta', charge_id,
            'expired', 1675000, 90000, 6250, '2026-07-25'
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [primary],
  );
  await db.query(`UPDATE public.platform_settings SET booking_fee_minting_live = TRUE WHERE id = 1`);
  await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = TRUE WHERE id = 1`);
  await setAuthUid(db, uid);
  const r = await db.query<{ s: string }>(`SELECT public.vendor_event_fee_gate_stage($1, TRUE) AS s`, [b.eventId]);
  await setAuthUid(db, null);
  await db.query(`UPDATE public.platform_settings SET fee_unlocks_event_enforced = NULL WHERE id = 1`);
  assert.equal(r.rows[0]!.s, 'unlocked', 'a voided top-up locked a paid booking out of its event');
});

/* ── I · THE EVENT LOCK NEEDS THE FEE TO BE MADE (owner 2026-10-13) ────── */

test('I · the enforcement switch is refused unless production stamped that fees are made', async () => {
  // SABOTAGE: drop the platform_settings_fee_lock_needs_minting trigger → RED.
  const set = (sql: string) => db.query(`UPDATE public.platform_settings SET ${sql} WHERE id = 1`);
  const sw = async () =>
    (await db.query<{ e: boolean | null }>(`SELECT fee_unlocks_event_enforced AS e FROM public.platform_settings WHERE id = 1`))
      .rows[0]!.e;
  await set('fee_unlocks_event_enforced = NULL, booking_fee_minting_live = NULL');

  await assert.rejects(set('fee_unlocks_event_enforced = TRUE'), /needs the booking fee on/, 'switched on with no stamp');
  await set('booking_fee_minting_live = FALSE');
  await assert.rejects(set('fee_unlocks_event_enforced = TRUE'), /needs the booking fee on/, 'switched on while minting is off');

  await set('booking_fee_minting_live = TRUE');
  await set('fee_unlocks_event_enforced = TRUE');
  assert.equal(await sw(), true, 'the switch could not be turned on with minting on');

  // An unrelated save never moves it (column-scoped trigger).
  await set('booking_fee_rate_pct = booking_fee_rate_pct');
  assert.equal(await sw(), true);

  // Minting switched off under a live lock → the lock stands down (the safe way).
  await set('booking_fee_minting_live = FALSE');
  assert.equal(await sw(), false, 'the lock stayed on with no fee being made');
  await set('fee_unlocks_event_enforced = NULL, booking_fee_minting_live = NULL');
});
