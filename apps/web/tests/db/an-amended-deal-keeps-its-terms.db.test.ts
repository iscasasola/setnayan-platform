/**
 * AN AMENDED DEAL KEEPS ITS TERMS — slice 6 of "vendors get to keep it"
 *
 * 🚨 NOT ABOUT A MISSING RECORD — ABOUT A MISLEADING ONE.
 *
 * Slice 5 made the quote survive and slice 3 the contract. The things that
 * CHANGE those terms still cascaded, so a supplier was left holding a quote
 * showing the ORIGINAL price with no record of the discount both sides agreed.
 * A surviving record that states terms nobody agreed to is worse than one that
 * is simply gone, because the supplier reads it as fact.
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
const uniq = () => `amend-${++seq}-${Date.now()}`;

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
     VALUES ($1, 'Amend Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-11-12') RETURNING event_id`,
  );
  return r.rows[0]!.event_id;
}

/** A booking slice 2 WILL preserve: booked status + marketplace link + not self-dealt. */
async function newBooking(eventId: string, vendorProfileId: string): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Amend Studio', 'delivered', $2, $2) RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  return r.rows[0]!.vendor_id;
}

async function newProposal(eventId: string, vendorProfileId: string): Promise<string> {
  const r = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (event_id, vendor_profile_id, title, status)
     VALUES ($1, $2, 'Photography — full day', 'sent') RETURNING proposal_id`,
    [eventId, vendorProfileId],
  );
  return r.rows[0]!.proposal_id;
}

async function newAmendment(
  eventId: string,
  vendorProfileId: string,
  bookingId: string,
  proposalId: string,
  status = 'accepted',
): Promise<string> {
  const r = await db.query<{ amendment_id: string }>(
    `INSERT INTO public.proposal_amendments
       (event_id, event_vendor_id, vendor_profile_id, base_proposal_id, raised_by, status)
     VALUES ($1, $2, $3, $4, 'couple', $5) RETURNING amendment_id`,
    [eventId, bookingId, vendorProfileId, proposalId, status],
  );
  return r.rows[0]!.amendment_id;
}

async function newAmendmentItem(
  amendmentId: string,
  eventId: string,
  vendorProfileId: string,
  label: string,
  amount: number,
): Promise<string> {
  const r = await db.query<{ item_id: string }>(
    `INSERT INTO public.proposal_amendment_items
       (amendment_id, event_id, vendor_profile_id, item_kind, label, amount_php)
     VALUES ($1, $2, $3, 'discount', $4, $5) RETURNING item_id`,
    [amendmentId, eventId, vendorProfileId, label, amount],
  );
  return r.rows[0]!.item_id;
}

const deleteEvent = (id: string) => db.query(`DELETE FROM public.events WHERE event_id = $1`, [id]);

const countOf = async (table: string, col: string, id: string): Promise<number> => {
  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.${table} WHERE ${col} = $1`,
    [id],
  );
  return Number(r.rows[0]!.n);
};

test('the agreed change survives, so the quote does not revert to its original terms', async () => {
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const bookingId = await newBooking(eventId, vendorProfileId);
  const proposalId = await newProposal(eventId, vendorProfileId);
  const amendmentId = await newAmendment(eventId, vendorProfileId, bookingId, proposalId);

  assert.equal(await countOf('proposal_amendments', 'amendment_id', amendmentId), 1, 'Fixture is wrong.');

  await deleteEvent(eventId);

  assert.equal(
    await countOf('proposal_amendments', 'amendment_id', amendmentId),
    1,
    'The record of what both sides agreed died, leaving a quote that states the original price as fact.',
  );
  const r = await db.query<{ event_id: string | null; status: string }>(
    `SELECT event_id, status FROM public.proposal_amendments WHERE amendment_id = $1`,
    [amendmentId],
  );
  assert.equal(r.rows[0]?.event_id, null, 'Survived but still points at a deleted celebration.');
  assert.equal(r.rows[0]?.status, 'accepted', 'Survived without the fact that it was accepted.');
});

test('the ITEMS survive too — the parent alone cannot say WHAT was agreed', async () => {
  /* ⚠ The whole point of the slice, and the trap inside the fix. The parent
     carries only the note and status; every amount lives one table down. An
     amendment that says "accepted" and cannot name a single line is the same
     misleading record in a smaller costume. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const bookingId = await newBooking(eventId, vendorProfileId);
  const proposalId = await newProposal(eventId, vendorProfileId);
  const amendmentId = await newAmendment(eventId, vendorProfileId, bookingId, proposalId);
  await newAmendmentItem(amendmentId, eventId, vendorProfileId, 'Loyalty discount', -5000);
  await newAmendmentItem(amendmentId, eventId, vendorProfileId, 'Extra hour', 3000);

  assert.equal(await countOf('proposal_amendment_items', 'amendment_id', amendmentId), 2, 'Fixture is wrong.');

  await deleteEvent(eventId);

  assert.equal(
    await countOf('proposal_amendment_items', 'amendment_id', amendmentId),
    2,
    'The amendment survived but its lines did not — it can say "accepted" and not what.',
  );
  const sum = await db.query<{ total: string | null }>(
    `SELECT SUM(amount_php)::text AS total FROM public.proposal_amendment_items WHERE amendment_id = $1`,
    [amendmentId],
  );
  assert.equal(Number(sum.rows[0]!.total), -2000, 'The surviving lines no longer add up to what was agreed.');
});

test('a change order against a signed contract survives', async () => {
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const bookingId = await newBooking(eventId, vendorProfileId);

  const co = await db.query<{ change_order_id: string }>(
    `INSERT INTO public.vendor_change_orders
       (event_vendor_id, event_id, vendor_profile_id, raised_by, title, delta_amount_php, status)
     VALUES ($1, $2, $3, 'vendor', 'Additional coverage', 4500, 'accepted')
     RETURNING change_order_id`,
    [bookingId, eventId, vendorProfileId],
  );
  const coId = co.rows[0]!.change_order_id;
  assert.equal(await countOf('vendor_change_orders', 'change_order_id', coId), 1, 'Fixture is wrong.');

  await deleteEvent(eventId);

  assert.equal(
    await countOf('vendor_change_orders', 'change_order_id', coId),
    1,
    'The contract survived stating superseded terms — its change order was deleted.',
  );
  const r = await db.query<{ delta_amount_php: string }>(
    `SELECT delta_amount_php FROM public.vendor_change_orders WHERE change_order_id = $1`,
    [coId],
  );
  assert.equal(Number(r.rows[0]!.delta_amount_php), 4500, 'Survived without the amount that was agreed.');
});

test('a DECLINED amendment survives too — both sides took part in the negotiation', async () => {
  /* No status test, deliberately. The state machine starts at 'proposed', which
     means SENT, so there is no draft the supplier never saw. A refusal is part
     of the record of a negotiation both parties were in. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const bookingId = await newBooking(eventId, vendorProfileId);
  const proposalId = await newProposal(eventId, vendorProfileId);
  const declined = await newAmendment(eventId, vendorProfileId, bookingId, proposalId, 'declined');

  await deleteEvent(eventId);

  assert.equal(
    await countOf('proposal_amendments', 'amendment_id', declined),
    1,
    'A declined request was erased, so the record of the negotiation is one-sided.',
  );
});

test('an amendment on a booking nobody can claim leaves with the celebration', async () => {
  /* Consistency with every earlier slice: a booking with no marketplace supplier
     behind it is not preserved, so the things hanging off it must not linger
     either. Here the amendment's own event_id is nulled, but the BOOKING is
     deleted — and `event_vendor_id` is NOT NULL + CASCADE, so it goes. */
  const eventId = await newEvent();
  const typed = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1, 'photographer', 'Someone they typed', 'delivered') RETURNING vendor_id`,
    [eventId],
  );
  const co = await db.query<{ change_order_id: string }>(
    `INSERT INTO public.vendor_change_orders
       (event_vendor_id, event_id, vendor_profile_id, raised_by, title, delta_amount_php, status)
     VALUES ($1, $2, gen_random_uuid(), 'couple', 'Extra', 100, 'proposed')
     RETURNING change_order_id`,
    [typed.rows[0]!.vendor_id, eventId],
  ).catch(() => null);

  await deleteEvent(eventId);

  if (co) {
    assert.equal(
      await countOf('vendor_change_orders', 'change_order_id', co.rows[0]!.change_order_id),
      0,
      'A change order lingered for a booking with no supplier behind it.',
    );
  }
});
