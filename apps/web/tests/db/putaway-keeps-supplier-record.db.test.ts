/**
 * Putting a celebration away must NOT shrink the supplier's record —
 * END-TO-END DB verification (migrations replayed).
 *
 * Owner, 2026-08-16, asked directly and answered "yes": when a couple puts an
 * event away, the supplier's finished-jobs number and the review left for them
 * STAY. A customer tidying their own list must never shrink somebody else's
 * public history — another business's livelihood, and the person pressing the
 * button is not the person it costs.
 *
 * ─── WHY THIS TEST HAD TO EXIST THE DAY AFTER THE BUTTON SHIPPED ───────────
 * "Put this away" shipped 2026-08-16 (PR #4473) after two years in which
 * `events.archived` had no writer anywhere. FOUR relations quietly filtered
 * `archived = FALSE`, none derived from the others — so **the first couple ever
 * to press the new button would have deducted their wedding from their
 * photographer's public count and taken the review with it.** Nothing would
 * have errored; a number would just have been smaller.
 *
 * ─── ASSERTED IN BOTH DIRECTIONS, DELIBERATELY ─────────────────────────────
 * 🔑 "The count did not change" is a claim a broken fixture satisfies for free.
 * A test that only checks the count AFTER archiving passes just as happily when
 * the booking was never counted in the first place. So each case proves the row
 * COUNTS FIRST, then archives, then proves it still counts — the before-value is
 * what makes the after-value mean anything.
 *
 * Run: pnpm --filter @setnayan/web test:db
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
  await replay?.close?.();
});

/**
 * A supplier who is NOT the couple — every one of these relations deliberately
 * excludes a vendor booking their own celebration, so the fixture must keep the
 * two identities apart or it proves nothing.
 */
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
     VALUES ($1, 'Putaway Test Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/** A DELIVERED booking — the state these relations count. */
async function newDeliveredBooking(eventId: string, vendorProfileId: string): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Putaway Test Studio', 'delivered', $2)
     RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  return r.rows[0]!.vendor_id;
}

async function putAway(eventId: string): Promise<void> {
  await db.query(`UPDATE public.events SET archived = TRUE WHERE event_id = $1`, [eventId]);
}

async function completedRows(vendorProfileId: string): Promise<number> {
  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.vendor_completed_events WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return Number(r.rows[0]!.n);
}

test('a delivered booking still counts after the couple puts the event away', async () => {
  const { vendorProfileId } = await newVendor('putaway-vendor-1@test.local');
  const eventId = await newEvent('Ana’s 30th');
  await newDeliveredBooking(eventId, vendorProfileId);

  // BEFORE — without this the "after" assertion is satisfied by a fixture that
  // never counted at all.
  assert.equal(
    await completedRows(vendorProfileId),
    1,
    'Fixture is wrong: the delivered booking is not counted even before archiving, ' +
      'so nothing below would prove anything.',
  );

  await putAway(eventId);

  assert.equal(
    await completedRows(vendorProfileId),
    1,
    'Putting the celebration away removed the booking from the supplier’s ' +
      'completed record. A couple tidying their own list must not shrink ' +
      'another business’s public history (owner 2026-08-16).',
  );
});

test('the public finished-jobs count survives a put-away', async () => {
  const { vendorProfileId } = await newVendor('putaway-vendor-2@test.local');
  const eventId = await newEvent('Bea’s debut');
  await newDeliveredBooking(eventId, vendorProfileId);

  const read = async (): Promise<number> => {
    // A MATERIALIZED view answers from its last refresh, so refresh explicitly.
    // ⚠ In production these have NO cron — they are refreshed by hand from the
    // admin fraud screen. That is pre-existing, is not what this test covers,
    // and is why the refresh is spelled out here rather than assumed.
    await db.query(`REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats`);
    const r = await db.query<{ n: string | null }>(
      `SELECT public_completed_count::text AS n
         FROM public.vendor_public_completed_events_stats
        WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
    return Number(r.rows[0]?.n ?? 0);
  };

  assert.equal(await read(), 1, 'Fixture is wrong: not counted before archiving.');
  await putAway(eventId);
  assert.equal(
    await read(),
    1,
    'The supplier’s PUBLIC finished-jobs number dropped when the couple put ' +
      'their celebration away.',
  );
});

test('the internal finished-jobs count survives a put-away', async () => {
  const { vendorProfileId } = await newVendor('putaway-vendor-3@test.local');
  const eventId = await newEvent('Carlo’s reunion');
  await newDeliveredBooking(eventId, vendorProfileId);

  const read = async (): Promise<number> => {
    await db.query(`REFRESH MATERIALIZED VIEW public.vendor_full_completed_events_stats`);
    const r = await db.query<{ n: string | null }>(
      `SELECT full_completed_count::text AS n
         FROM public.vendor_full_completed_events_stats
        WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
    return Number(r.rows[0]?.n ?? 0);
  };

  assert.equal(await read(), 1, 'Fixture is wrong: not counted before archiving.');
  await putAway(eventId);
  assert.equal(await read(), 1, 'The internal finished-jobs count dropped on put-away.');
});

test('a review left for a supplier survives the couple putting the event away', async () => {
  const { vendorProfileId } = await newVendor('putaway-vendor-4@test.local');
  const coupleUser = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('putaway-couple-4@test.local', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const eventId = await newEvent('Dina’s anniversary');
  // A real DELIVERED booking first. Reviews here are receipt-backed: without a
  // booking behind it the "booked through Setnayan" flag does not survive, and
  // the vetted stats deliberately ignore anything that isn't. The before-check
  // below is what surfaced this — a fixture that never counted would otherwise
  // have "passed" the after-check for free.
  await newDeliveredBooking(eventId, vendorProfileId);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUser.rows[0]!.id],
  );
  await db.query(
    // Every rating column is NOT NULL, and the reviewer column is
    // `couple_user_id` — checked against the live schema rather than guessed.
    `INSERT INTO public.vendor_reviews
       (vendor_profile_id, event_id, couple_user_id, rating_overall,
        rating_communication, rating_quality, rating_value, rating_on_time,
        booked_through_setnayan)
     VALUES ($1, $2, $3, 5, 5, 5, 5, 5, TRUE)`,
    [vendorProfileId, eventId, coupleUser.rows[0]!.id],
  );

  const read = async (): Promise<number> => {
    await db.query(`REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats`);
    const r = await db.query<{ n: string | null }>(
      `SELECT trusted_review_count::text AS n
         FROM public.vendor_trusted_review_stats
        WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
    return Number(r.rows[0]?.n ?? 0);
  };

  assert.equal(await read(), 1, 'Fixture is wrong: the review is not counted before archiving.');
  await putAway(eventId);
  assert.equal(
    await read(),
    1,
    'The review vanished from the supplier’s vetted stats when the couple put ' +
      'their celebration away — a customer must not be able to withdraw a ' +
      'review by tidying their own list.',
  );
});
