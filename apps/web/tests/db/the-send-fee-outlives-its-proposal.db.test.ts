/**
 * THE SEND FEE OUTLIVES ITS PROPOSAL — CTRL-B1 build 8.
 *
 * `the_money_outlives_the_event` (20271153200818) made a charge survive its
 * celebration and named, in its own comment, the half it left:
 *
 *     "a charge anchored on `proposal_id` (source='send') still dies with
 *      `vendor_proposals`, which is its own slice."
 *
 * This is that slice, proved against a real replayed schema rather than a source
 * read — a CASCADE is a property of the database, and no grep can see it.
 *
 * 🔑 THE INTERESTING TEST IS THE THIRD. Flipping the FK to SET NULL on its own
 * would make the FK's own write violate `booking_fee_charges_anchor_ck`, because
 * a send-sourced charge has no `event_vendor_id` — and a constraint violation
 * inside a cascade takes the whole DELETE down, so the couple's delete button
 * would start ERRORING instead of quietly destroying money. That is the same
 * shape as the bug slice 4 shipped and regression-tested. It is asserted here.
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
const uniq = () => `sendfee-${++seq}-${Date.now()}`;

async function newVendor(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Send Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEvent(): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-07-08') RETURNING event_id`,
  );
  return r.rows[0]!.event_id;
}

/** A SEND-sourced charge: anchored on a proposal, with NO event_vendor_id. */
async function newSendCharge(): Promise<{ chargeId: string; proposalId: string }> {
  const vendorProfileId = await newVendor();
  const eventId = await newEvent();
  const prop = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (event_id, vendor_profile_id, title, status, total_centavos)
     VALUES ($1, $2, 'Photography — full day', 'sent', 9900000) RETURNING proposal_id`,
    [eventId, vendorProfileId],
  );
  const proposalId = prop.rows[0]!.proposal_id;
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, vendorProfileId],
  );
  const chg = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, proposal_id, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'send', 'paid', 9900000, 495000, 495000, '2026-07-25')
     RETURNING charge_id`,
    [led.rows[0]!.ledger_id, eventId, vendorProfileId, proposalId],
  );
  return { chargeId: chg.rows[0]!.charge_id, proposalId };
}

test('deleting a quote does not delete the fee the supplier owes for it', async () => {
  const { chargeId, proposalId } = await newSendCharge();

  await db.query(`DELETE FROM public.vendor_proposals WHERE proposal_id = $1`, [proposalId]);

  const r = await db.query<{ n: string; proposal_id: string | null; status: string | null }>(
    `SELECT COUNT(*)::text AS n, MAX(proposal_id::text) AS proposal_id, MAX(status) AS status
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.equal(
    Number(r.rows[0]!.n),
    1,
    'Money Setnayan is owed was deleted along with the quote that introduced it.',
  );
  assert.equal(r.rows[0]!.proposal_id, null, 'the anchor should be released, not left dangling');
  assert.equal(r.rows[0]!.status, 'paid', 'the charge must keep its own status — only its anchor was lost');
});

test('the detachment is recorded, so an anchorless charge can be told from a broken one', async () => {
  const { chargeId, proposalId } = await newSendCharge();
  const before = await db.query<{ d: string | null }>(
    `SELECT proposal_detached_at::text AS d FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.equal(before.rows[0]!.d, null, 'a live charge must not be marked detached');

  await db.query(`DELETE FROM public.vendor_proposals WHERE proposal_id = $1`, [proposalId]);

  const after = await db.query<{ d: string | null }>(
    `SELECT proposal_detached_at::text AS d FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.ok(
    after.rows[0]!.d,
    'the charge survived without recording WHY it has no anchor — indistinguishable from a bug',
  );
});

test('🔑 the cascade does not blow up the delete — the CHECK was widened first', async () => {
  const { proposalId } = await newSendCharge();
  // If `proposal_detached_at` were not in the anchor CHECK, the FK's own
  // SET NULL write would violate it and this DELETE would THROW — turning a
  // silent data loss into a couple's delete button that errors.
  await assert.doesNotReject(
    () => db.query(`DELETE FROM public.vendor_proposals WHERE proposal_id = $1`, [proposalId]),
    'the anchor CHECK refused the FK\'s own write — the delete now fails instead of destroying money',
  );
});

test('the third arm is not a loophole — an anchorless charge still cannot be INSERTED', async () => {
  const vendorProfileId = await newVendor();
  const eventId = await newEvent();
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, vendorProfileId],
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.booking_fee_charges
           (ledger_id, event_id, vendor_profile_id, source, status,
            proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
         VALUES ($1, $2, $3, 'send', 'pending', 100, 100, 100, '2026-07-25')`,
        [led.rows[0]!.ledger_id, eventId, vendorProfileId],
      ),
    /anchor_ck/,
    'a charge with no proposal and no booking must still be refused at INSERT — widening the CHECK must not have opened that door',
  );
});

test('the LOCK half is untouched — a booked charge still survives, by its own route', async () => {
  const vendorProfileId = await newVendor();
  const eventId = await newEvent();
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Send Studio', 'delivered'::vendor_status, $2, $2)
     RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, vendorProfileId],
  );
  const chg = await db.query<{ charge_id: string; d: string | null }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'lock', 'pending', 100, 100, 100, '2026-07-25')
     RETURNING charge_id, proposal_detached_at::text AS d`,
    [led.rows[0]!.ledger_id, eventId, vendorProfileId, ev.rows[0]!.vendor_id],
  );
  assert.equal(
    chg.rows[0]!.d,
    null,
    'a lock charge never had a proposal, so the detach trigger must leave it alone',
  );
});
