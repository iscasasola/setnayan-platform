/**
 * THE PUBLIC NUMBERS KEEP THE RECORD THE SLICES PRESERVED
 *
 * Slices 1–6 made a supplier's review and booking OUTLIVE a couple's deletion.
 * Measured in production 2026-08-24, every PUBLISHED number still went to zero,
 * because all three matviews carry `EXISTS (… FROM events …)` and `NULL = NULL`
 * is never true — so the preserved row was filtered out of the very number it
 * was preserved for.
 *
 * The product was internally contradictory: the dated Track Record list showed
 * the job while the count above it said the supplier had never worked.
 *
 * ⚖ THE LAUNDERING DIRECTION IS TESTED TOO. Relaxing the events predicate alone
 * would let the self-dealing NOT EXISTS guards — which read the CASCADING
 * `event_members` — pass vacuously for an orphan, turning a vendor's own
 * self-booked job into a permanent public number. Both directions are asserted.
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

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newVendor(tag: string): Promise<{ vendorProfileId: string; userId: string }> {
  const userId = await newUser(`counts-vendor-${tag}@example.com`);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Counts Test Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

/** A finished, arm's-length marketplace job with a review on it. */
async function newFinishedJob(
  vendorProfileId: string,
  coupleUserId: string,
  opts: { withReview?: boolean } = {},
): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Counts Test Day', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id)
     VALUES ($1,'photographer','Counts Test Studio','complete',$2,$2)`,
    [eventId, vendorProfileId],
  );
  if (opts.withReview !== false) {
    await db.query(
      `INSERT INTO public.vendor_reviews
         (vendor_profile_id, event_id, couple_user_id, rating_overall,
          rating_communication, rating_quality, rating_value, rating_on_time, body)
       VALUES ($1,$2,$3,5,5,5,5,5,'Wonderful.')`,
      [vendorProfileId, eventId, coupleUserId],
    );
  }
  return eventId;
}

async function counts(vendorProfileId: string) {
  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats`);
  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats`);
  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_full_completed_events_stats`);
  const r = await db.query<{
    trusted: number; pub: number; full: number; track: number; rows: number;
  }>(
    `SELECT
       COALESCE((SELECT trusted_review_count FROM public.vendor_trusted_review_stats WHERE vendor_profile_id=$1),0)::int AS trusted,
       COALESCE((SELECT public_completed_count FROM public.vendor_public_completed_events_stats WHERE vendor_profile_id=$1),0)::int AS pub,
       COALESCE((SELECT full_completed_count FROM public.vendor_full_completed_events_stats WHERE vendor_profile_id=$1),0)::int AS full,
       (SELECT count(*) FROM public.vendor_completed_events WHERE vendor_profile_id=$1)::int AS track,
       (SELECT count(*) FROM public.vendor_reviews WHERE vendor_profile_id=$1)::int AS rows`,
    [vendorProfileId],
  );
  return r.rows[0]!;
}

test('a supplier keeps their published star rating and finished-jobs count when the couple deletes the celebration', async () => {
  const v = await newVendor('honest');
  const couple = await newUser('counts-couple-honest@example.com');
  const eventId = await newFinishedJob(v.vendorProfileId, couple);

  const before = await counts(v.vendorProfileId);
  assert.equal(before.trusted, 1, 'precondition: the review counts while the event exists');
  assert.equal(before.pub, 1, 'precondition: the finished job counts');
  assert.equal(before.full, 1, 'precondition');
  assert.equal(before.track, 1, 'precondition: the dated list shows it');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const after = await counts(v.vendorProfileId);
  assert.equal(after.rows, 1, 'slice 1: the review row still exists');
  assert.equal(after.trusted, 1,
    'THE REGRESSION: the public star rating dropped to 0 because the matview ' +
    'filtered on EXISTS(events) and the preserved review has a NULL event_id');
  assert.equal(after.pub, 1,
    'THE REGRESSION: the public finished-jobs count behind the experience tier dropped to 0');
  assert.equal(after.full, 1, 'the supplier\'s own finished-jobs count dropped to 0');
  assert.equal(after.track, 1,
    'the dated Track Record list already survived — which is what made the ' +
    'contradiction visible on one screen');
});

test('a SELF-DEALT review is destroyed by the delete, never laundered into the public rating', async () => {
  // The `vendor_self_comp` vector, chosen deliberately: `block_related_account_
  // review` does NOT check it at INSERT (it tests owner-self, team, payment,
  // device and household), so this is a self-dealing path that genuinely
  // reaches the database and is caught ONLY by the matview's NOT EXISTS guard —
  // which reads `comp_grants` and `event_members`, BOTH of which cascade.
  // That is exactly the guard that would pass vacuously for an orphan.
  const v = await newVendor('selfdealt');
  const couple = await newUser('counts-couple-selfdealt@example.com');
  const eventId = await newFinishedJob(v.vendorProfileId, couple);
  await db.query(
    `INSERT INTO public.comp_grants (source, vendor_profile_id, created_by_user_id)
     VALUES ('vendor_self_comp', $1, $2)`,
    [v.vendorProfileId, couple],
  );

  const before = await counts(v.vendorProfileId);
  assert.equal(before.rows, 1, 'precondition: the review row exists');
  assert.equal(before.trusted, 0,
    'precondition: it is already excluded from the public rating while the event lives');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const after = await counts(v.vendorProfileId);
  assert.equal(after.rows, 0,
    'a self-dealt review must be DESTROYED at deletion time — exactly what the ' +
    'cascade does to it today — so it can never be orphaned into the count');
  assert.equal(after.trusted, 0,
    'THE LAUNDERING DIRECTION: relaxing the events predicate alone would let the ' +
    'comp_grants guard pass vacuously and publish this forever');
});

test('a SELF-DEALT booking is still not preserved — slice 2\'s precondition is what makes the count safe', async () => {
  const v = await newVendor('selfbooking');
  const eventId = await newFinishedJob(v.vendorProfileId, v.userId, { withReview: false });

  assert.equal((await counts(v.vendorProfileId)).pub, 0,
    'precondition: a self-booked job is already excluded from the public count');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const after = await counts(v.vendorProfileId);
  const orphans = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors
      WHERE linked_vendor_profile_id = $1 AND event_id IS NULL`,
    [v.vendorProfileId],
  );
  assert.equal(orphans.rows[0]!.n, 0,
    'slice 2 must not orphan a self-dealt booking — "orphan implies arm\'s-length" ' +
    'is the guarantee the relaxed predicate leans on');
  assert.equal(after.pub, 0, 'and the public count must not move');
});

test('the supplier-only full count is NOT readable by the marketplace', async () => {
  // A DROP takes every grant with it, and re-granting from memory is how a
  // relation silently widens. Prod has no anon/authenticated grant here.
  const r = await db.query<{ acl: string | null }>(
    `SELECT relacl::text AS acl FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='vendor_full_completed_events_stats'`,
  );
  const acl = r.rows[0]!.acl ?? '';
  assert.ok(!acl.includes('anon='), `anon must not read the supplier-only count: ${acl}`);
  assert.ok(!acl.includes('authenticated='), `authenticated must not read it either: ${acl}`);

  for (const rel of ['vendor_trusted_review_stats', 'vendor_public_completed_events_stats']) {
    const p = await db.query<{ acl: string | null }>(
      `SELECT relacl::text AS acl FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname=$1`,
      [rel],
    );
    const a = p.rows[0]!.acl ?? '';
    assert.ok(a.includes('anon='), `${rel} lost its public read grant in the rebuild: ${a}`);
  }
});
