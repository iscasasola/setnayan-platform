/**
 * A REVIEW OUTLIVES THE EVENT IT WAS WRITTEN ABOUT
 *
 * Owner, 2026-08-21: "only data from the user gets lost. But statistics and
 * data for the vendor stays, including the reviews… that the vendor needs for
 * their website." And: "vendors get to keep it."
 *
 * Measured in prod the same day: 153 FKs to `events` CASCADE, 11 survive, and
 * `vendor_reviews.event_id` was NOT NULL + CASCADE — so the product did the
 * OPPOSITE of the ruling on the record the owner named FIRST.
 *
 * 🔑 EVERY TEST HERE ASSERTS THE OUTCOME, NEVER A THROW. Under RLS a refused
 * write is filtered to ZERO ROWS and resolves happily — an RLS denial and a
 * no-op are the same value — so `assert.rejects` reports "missing expected
 * rejection" while the data is perfectly safe. Asserting the value held is what
 * survives whichever mechanism does the refusing.
 */
import { test, before, after } from 'node:test';
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

async function newVendor(email: string): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Outlives Test Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newCouple(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newEvent(name: string, coupleUserId: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleUserId],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1, 'photographer', 'Outlives Test Studio', 'delivered')`,
    [eventId],
  );
  return eventId;
}

async function newReview(vendorProfileId: string, eventId: string, coupleUserId: string): Promise<string> {
  const r = await db.query<{ review_id: string }>(
    `INSERT INTO public.vendor_reviews
       (vendor_profile_id, event_id, couple_user_id, rating_overall,
        rating_communication, rating_quality, rating_value, rating_on_time,
        body, booked_through_setnayan)
     VALUES ($1, $2, $3, 5, 5, 5, 5, 5, 'They were wonderful on the day.', TRUE)
     RETURNING review_id`,
    [vendorProfileId, eventId, coupleUserId],
  );
  return r.rows[0]!.review_id;
}

/** Act as a signed-in person. The role ALONE is not an identity: without
 *  `auth.uid()` every couple policy matches nothing and a test passes because
 *  RLS refused an ANONYMOUS caller, which proves nothing about the guard. */
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
}

async function readReview(reviewId: string) {
  const r = await db.query<{
    review_id: string;
    event_id: string | null;
    body: string | null;
    vendor_reply: string | null;
  }>(
    `SELECT review_id, event_id, body, vendor_reply
     FROM public.vendor_reviews WHERE review_id = $1`,
    [reviewId],
  );
  return r.rows[0] ?? null;
}

test('the review survives its event being deleted, and keeps its words', async () => {
  const { vendorProfileId } = await newVendor('outlives-vendor-1@test.local');
  const coupleId = await newCouple('outlives-couple-1@test.local');
  const eventId = await newEvent('Dina’s birthday', coupleId);
  const reviewId = await newReview(vendorProfileId, eventId, coupleId);

  /* The before-check is not ceremony. A fixture that never inserted would make
     every after-check pass for free — the exact shape that has produced false
     greens in this repo before. */
  const before = await readReview(reviewId);
  assert.ok(before, 'Fixture is wrong: the review was never created.');
  assert.equal(before.event_id, eventId, 'Fixture is wrong: not attached to the event.');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const after = await readReview(reviewId);
  assert.ok(after, 'THE HEADLINE BREAK: the review died with the event.');
  assert.equal(after.event_id, null, 'The review survived but still points at a deleted event.');
  assert.equal(
    after.body,
    'They were wonderful on the day.',
    'The review survived as an empty husk — the words are the thing the supplier keeps.',
  );
});

test('an orphaned review is still readable by a stranger', async () => {
  /* This is the whole point: the supplier keeps it ON THEIR PAGE, which the
     public reads. A review that survives in the table but is invisible to
     visitors would satisfy the FK and fail the owner. */
  const { vendorProfileId } = await newVendor('outlives-vendor-2@test.local');
  const coupleId = await newCouple('outlives-couple-2@test.local');
  const eventId = await newEvent('Ana’s birthday', coupleId);
  const reviewId = await newReview(vendorProfileId, eventId, coupleId);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
  try {
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.vendor_reviews WHERE review_id = $1`,
      [reviewId],
    );
    assert.equal(Number(r.rows[0]!.n), 1, 'A stranger can no longer see the surviving review.');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

test('the couple cannot delete or rewrite the review once they have deleted the event', async () => {
  const { vendorProfileId } = await newVendor('outlives-vendor-3@test.local');
  const coupleId = await newCouple('outlives-couple-3@test.local');
  const eventId = await newEvent('Ben’s birthday', coupleId);
  const reviewId = await newReview(vendorProfileId, eventId, coupleId);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  await asUser(coupleId, async () => {
    await db.query(`DELETE FROM public.vendor_reviews WHERE review_id = $1`, [reviewId]);
    await db.query(`UPDATE public.vendor_reviews SET body = 'actually they were awful' WHERE review_id = $1`, [
      reviewId,
    ]);
  });

  const after = await readReview(reviewId);
  assert.ok(after, 'The couple deleted the supplier’s record after deleting the event.');
  assert.equal(
    after.body,
    'They were wonderful on the day.',
    'The couple rewrote the supplier’s record after deleting the event — delete-then-gut.',
  );
});

test('…but the couple can still edit a review while their event exists', async () => {
  /* 🔑 ISOLATE THE VARIABLE THE OTHER TEST NAMES. Freezing orphans is only
     correct if the ordinary case still works; without this, a migration that
     froze EVERY review would pass the test above and silently remove a
     capability couples have today. */
  const { vendorProfileId } = await newVendor('outlives-vendor-4@test.local');
  const coupleId = await newCouple('outlives-couple-4@test.local');
  const eventId = await newEvent('Cara’s birthday', coupleId);
  const reviewId = await newReview(vendorProfileId, eventId, coupleId);

  await asUser(coupleId, async () => {
    await db.query(`UPDATE public.vendor_reviews SET body = 'on reflection, even better' WHERE review_id = $1`, [
      reviewId,
    ]);
  });

  const after = await readReview(reviewId);
  assert.equal(
    after?.body,
    'on reflection, even better',
    'A couple can no longer edit the review for an event that still exists.',
  );
});

test('the supplier can still reply to a review whose event is gone', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor('outlives-vendor-5@test.local');
  const coupleId = await newCouple('outlives-couple-5@test.local');
  const eventId = await newEvent('Elle’s birthday', coupleId);
  const reviewId = await newReview(vendorProfileId, eventId, coupleId);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  await asUser(vendorUserId, async () => {
    await db.query(`UPDATE public.vendor_reviews SET vendor_reply = 'Thank you!' WHERE review_id = $1`, [reviewId]);
  });

  const after = await readReview(reviewId);
  assert.equal(
    after?.vendor_reply,
    'Thank you!',
    'The supplier keeps the review but can no longer answer it.',
  );
});

test('two couples deleting their events both leave the supplier a review', async () => {
  /* UNIQUE (vendor_profile_id, event_id) still stands. Postgres treats NULLs as
     DISTINCT, so orphans coexist — which must be true, or the SECOND couple to
     delete their celebration would destroy the first couple's review with a
     constraint violation, or lose their own. */
  const { vendorProfileId } = await newVendor('outlives-vendor-6@test.local');
  const c1 = await newCouple('outlives-couple-6a@test.local');
  const c2 = await newCouple('outlives-couple-6b@test.local');
  const e1 = await newEvent('First birthday', c1);
  const e2 = await newEvent('Second birthday', c2);
  await newReview(vendorProfileId, e1, c1);
  await newReview(vendorProfileId, e2, c2);

  await db.query(`DELETE FROM public.events WHERE event_id = ANY($1::uuid[])`, [[e1, e2]]);

  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.vendor_reviews
     WHERE vendor_profile_id = $1 AND event_id IS NULL`,
    [vendorProfileId],
  );
  assert.equal(Number(r.rows[0]!.n), 2, 'A supplier cannot hold two reviews from two deleted celebrations.');
});

test('an orphaned review cannot be forged — only a real deletion makes one', async () => {
  /* If a couple could INSERT a review with no event, they could plant one on any
     supplier without ever booking them: the booking check lives in the INSERT
     policy and hangs off `event_id`. NULL must not be a way around it. */
  const { vendorProfileId } = await newVendor('outlives-vendor-7@test.local');
  const coupleId = await newCouple('outlives-couple-7@test.local');

  await asUser(coupleId, async () => {
    await db
      .query(
        `INSERT INTO public.vendor_reviews
           (vendor_profile_id, event_id, couple_user_id, rating_overall,
            rating_communication, rating_quality, rating_value, rating_on_time)
         VALUES ($1, NULL, $2, 1, 1, 1, 1, 1)`,
        [vendorProfileId, coupleId],
      )
      .catch(() => undefined);
  });

  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.vendor_reviews WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(Number(r.rows[0]!.n), 0, 'A couple planted a review on a supplier they never booked.');
});
