/**
 * THE MONEY OUTLIVES THE EVENT — slice 4 of "vendors get to keep it"
 *
 * Three things: the defect slice 2 introduced, the supplier's receipts, and
 * money Setnayan is owed.
 *
 * 🚨 The first test is a REGRESSION test for a bug I shipped in slice 2 and
 * proved in this same replay before writing the fix. A composite FK turns
 * "preserve the parent" into an UPDATE of a referenced column, and an FK's
 * ON DELETE rule says nothing about UPDATEs — so the preserve was refused and,
 * inside a BEFORE DELETE trigger, took the whole deletion down with it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `money-${++seq}-${Date.now()}`;

async function newVendor(): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}-v@test.local`],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Money Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-07-08') RETURNING event_id`,
  );
  return r.rows[0]!.event_id;
}

async function newBooking(
  eventId: string,
  vendorProfileId: string | null,
  status = 'delivered',
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Money Studio', $2::vendor_status, $3, $3)
     RETURNING vendor_id`,
    [eventId, status, vendorProfileId],
  );
  return r.rows[0]!.vendor_id;
}

async function newPayment(
  eventId: string,
  vendorId: string,
  opts: { confirmed?: boolean } = {},
): Promise<string> {
  const r = await db.query<{ payment_id: string }>(
    `INSERT INTO public.event_vendor_payments
       (event_id, vendor_id, amount_php, paid_at, method, reference, notes,
        proof_r2_key, vendor_confirmed_at)
     VALUES ($1, $2, 5000, DATE '2026-07-01', 'BDO transfer', 'REF-12345',
             'sent from mum''s account', 'r2://proofs/screenshot.png', $3)
     RETURNING payment_id`,
    [eventId, vendorId, opts.confirmed === false ? null : new Date().toISOString()],
  );
  return r.rows[0]!.payment_id;
}

async function readPayment(paymentId: string) {
  const r = await db.query<{
    payment_id: string;
    event_id: string | null;
    amount_php: string | null;
    method: string | null;
    reference: string | null;
    notes: string | null;
    proof_r2_key: string | null;
  }>(
    `SELECT payment_id, event_id, amount_php, method, reference, notes, proof_r2_key
       FROM public.event_vendor_payments WHERE payment_id = $1`,
    [paymentId],
  );
  return r.rows[0] ?? null;
}

const deleteEvent = (id: string) => db.query(`DELETE FROM public.events WHERE event_id = $1`, [id]);

test('REGRESSION: a couple can still delete their event when a payment was recorded', async () => {
  /* 🚨 THE BUG SLICE 2 SHIPPED. Before this migration the delete failed outright
     with "update or delete on table event_vendors violates foreign key
     constraint event_vendor_payments_event_vendor_fk". Not a silent wrong
     answer — the couple could NEVER delete their celebration again.

     Asserted as "the delete does not throw", because that is exactly what broke. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const vendorId = await newBooking(eventId, vendorProfileId);
  await newPayment(eventId, vendorId);

  let failure: string | null = null;
  try {
    await deleteEvent(eventId);
  } catch (err) {
    failure = (err as Error).message;
  }
  assert.equal(failure, null, `The couple cannot delete their celebration at all: ${failure}`);

  const gone = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(gone.rows[0]!.n), 0, 'The delete reported success but the event is still there.');
});

test('the supplier keeps the receipt — what they were paid, and when', async () => {
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const vendorId = await newBooking(eventId, vendorProfileId);
  const paymentId = await newPayment(eventId, vendorId);

  assert.ok(await readPayment(paymentId), 'Fixture is wrong: no payment.');

  await deleteEvent(eventId);

  const after = await readPayment(paymentId);
  assert.ok(after, 'The supplier lost their record of money they actually received.');
  assert.equal(Number(after.amount_php), 5000, 'The receipt survived without the amount.');
  assert.equal(after.event_id, null, 'Survived but still points at a deleted celebration.');
});

test('…but NOT the couple’s bank rail, reference, note or screenshot', async () => {
  /* 🔒 The line the ruling draws. "Vendors get to keep it" covers the supplier's
     record of being paid — it does not hand them the couple's banking trail. A
     photograph of somebody's bank screen is the clearest case there is. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const vendorId = await newBooking(eventId, vendorProfileId);
  const paymentId = await newPayment(eventId, vendorId);

  const before = await readPayment(paymentId);
  assert.equal(before?.method, 'BDO transfer', 'Fixture is wrong: nothing to scrub.');
  assert.equal(before?.proof_r2_key, 'r2://proofs/screenshot.png', 'Fixture is wrong.');

  await deleteEvent(eventId);

  const after = await readPayment(paymentId);
  assert.equal(after?.method, null, 'The supplier kept the couple’s bank rail.');
  assert.equal(after?.reference, null, 'The supplier kept the couple’s transfer reference.');
  assert.equal(after?.notes, null, 'The supplier kept the couple’s private note.');
  assert.equal(after?.proof_r2_key, null, 'The supplier kept a photograph of the couple’s bank screen.');
});

test('a payment the supplier never confirmed leaves with the celebration', async () => {
  /* Unconfirmed is the COUPLE'S claim that they paid, not the supplier's record
     of being paid. There is no supplier-side fact to keep. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const vendorId = await newBooking(eventId, vendorProfileId);
  const unconfirmed = await newPayment(eventId, vendorId, { confirmed: false });

  assert.ok(await readPayment(unconfirmed), 'Fixture is wrong.');
  await deleteEvent(eventId);
  assert.equal(await readPayment(unconfirmed), null, 'An unconfirmed claim was kept as a supplier record.');
});

test('a payment against a name the couple typed leaves too', async () => {
  /* No supplier account behind it ⇒ nobody to keep it for, exactly as slice 2. */
  const eventId = await newEvent();
  const vendorId = await newBooking(eventId, null);
  const paymentId = await newPayment(eventId, vendorId);

  await deleteEvent(eventId);
  assert.equal(await readPayment(paymentId), null, 'A payment with no supplier behind it was kept.');
});

test('money the supplier owes Setnayan does not leave with the couple', async () => {
  /* The couple is not a party to this debt at all, yet it cascaded — a couple
     pressing delete quietly erased money owed to us. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const vendorId = await newBooking(eventId, vendorProfileId);

  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, vendorProfileId],
  );
  const ledgerId = led.rows[0]!.ledger_id;
  const chg = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, kind, source,
        status, proposal_amount_centavos, computed_fee_centavos,
        amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'lock', 'pending', 10000000, 500000,
             500000, '2026-07-25')
     RETURNING charge_id`,
    [ledgerId, eventId, vendorProfileId, vendorId],
  );
  const chargeId = chg.rows[0]!.charge_id;

  await deleteEvent(eventId);

  const l = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.booking_fee_ledger WHERE ledger_id = $1`,
    [ledgerId],
  );
  const c = await db.query<{ n: string; event_id: string | null }>(
    `SELECT COUNT(*)::text AS n, MAX(event_id::text) AS event_id
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.equal(Number(l.rows[0]!.n), 1, 'The record of what a supplier owes Setnayan was deleted by the couple.');
  assert.equal(Number(c.rows[0]!.n), 1, 'The fee charged to the supplier was deleted by the couple.');
  assert.equal(c.rows[0]!.event_id, null, 'The charge survived still pointing at a deleted celebration.');
});
