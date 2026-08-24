/**
 * A REVIEW KEEPS ITS RECEIPT WHEN THE CELEBRATION GOES
 *
 * Slice 1 (20271153093180) made a review OUTLIVE its event. Measured in
 * production 2026-08-24, it also stripped the review's RECEIPT in the same
 * statement: `booked_through_setnayan` went TRUE → FALSE at the delete.
 *
 * 🔑 THE FK'S OWN `ON DELETE SET NULL` IS AN UPDATE, AND AN UPDATE FIRES YOUR
 * TRIGGERS. `vendor_reviews_stamp_provenance` is BEFORE INSERT **OR UPDATE**,
 * so nulling `event_id` re-derived provenance from an event that no longer
 * exists — and `review_is_booked_through_setnayan(NULL, …)` answers FALSE for
 * every genuine booking.
 *
 * ⚠ WHY SLICE 1'S OWN TEST WENT GREEN THROUGH THIS. It asserted the review ROW
 * survived and never read the receipt back afterwards. The row surviving is
 * exactly half the guarantee; these tests are the other half.
 *
 * 🔑 EVERY TEST ASSERTS THE VALUE HELD, NEVER A THROW — an RLS denial and a
 * no-op are the same value here, so `assert.rejects` would prove nothing.
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

/** A supplier with a real marketplace profile — provenance needs one to be TRUE. */
async function seed(tag: string, linked = true) {
  const vu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`receipt-vendor-${tag}@example.com`],
  );
  const vendorUserId = vu.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Receipt Test Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorUserId],
  );
  const vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const cu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`receipt-couple-${tag}@example.com`],
  );
  const coupleUserId = cu.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Receipt Test Day', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );
  // The booking is what MAKES the review "booked through Setnayan". Without the
  // link the provenance function correctly answers FALSE and the test would be
  // measuring nothing.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id)
     VALUES ($1,'photographer','Receipt Test Studio','delivered',$2,$2)`,
    [eventId, linked ? vendorProfileId : null],
  );

  const r = await db.query<{ review_id: string }>(
    `INSERT INTO public.vendor_reviews
       (vendor_profile_id, event_id, couple_user_id, rating_overall,
        rating_communication, rating_quality, rating_value, rating_on_time, body)
     VALUES ($1,$2,$3,5,5,5,5,5,'They were wonderful on the day.')
     RETURNING review_id`,
    [vendorProfileId, eventId, coupleUserId],
  );
  return { vendorProfileId, coupleUserId, eventId, reviewId: r.rows[0]!.review_id };
}

async function receipt(reviewId: string) {
  const r = await db.query<{
    event_id: string | null;
    booked_through_setnayan: boolean;
    via_vendor_import: boolean;
  }>(
    `SELECT event_id, booked_through_setnayan, via_vendor_import
       FROM public.vendor_reviews WHERE review_id = $1`,
    [reviewId],
  );
  return r.rows[0]!;
}

test('the trigger stamps a LIVE review exactly as before — the guard is a narrowing', async () => {
  const s = await seed('live');
  const before = await receipt(s.reviewId);
  assert.equal(before.booked_through_setnayan, true,
    'a review on a real marketplace booking must be stamped as booked through Setnayan');

  // Any ordinary update of a live review re-stamps, unchanged.
  await db.query(`UPDATE public.vendor_reviews SET body = 'Edited.' WHERE review_id = $1`, [s.reviewId]);
  assert.equal((await receipt(s.reviewId)).booked_through_setnayan, true);
});

test('deleting the celebration does NOT strip the review of its receipt', async () => {
  const s = await seed('delete');
  assert.equal((await receipt(s.reviewId)).booked_through_setnayan, true, 'precondition');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const after = await receipt(s.reviewId);
  assert.equal(after.event_id, null, 'slice 1: the review is orphaned, not destroyed');
  assert.equal(after.booked_through_setnayan, true,
    'THE REGRESSION: the FK\'s SET NULL is an UPDATE, which re-derived provenance ' +
    'from a deleted event and answered FALSE for a genuine booking');
});

test('the supplier replying to their own orphaned review does not strip it either', async () => {
  const s = await seed('reply');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  // `vendor_reviews_vendor_reply` carries NO `event_id IS NOT NULL` clause (the
  // couple's policy does), so this is a reachable second door onto the column.
  await db.query(
    `UPDATE public.vendor_reviews SET vendor_reply = 'Thank you!', vendor_reply_at = NOW()
      WHERE review_id = $1`,
    [s.reviewId],
  );
  assert.equal((await receipt(s.reviewId)).booked_through_setnayan, true,
    'an orphan\'s receipt is frozen — replying must not re-derive it from an absence');
});

test('a review that was NOT booked through Setnayan stays false — the guard freezes, it does not promote', async () => {
  // Seeded with NO marketplace link, so the honest provenance answer is FALSE
  // from the start. Freezing must preserve that too: the guard exists to stop a
  // value CHANGING at the delete, in either direction.
  const s = await seed('unbooked', false);
  assert.equal((await receipt(s.reviewId)).booked_through_setnayan, false, 'precondition');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);
  assert.equal((await receipt(s.reviewId)).booked_through_setnayan, false,
    'freezing must preserve a FALSE receipt too — the guard is not a promotion');
});
