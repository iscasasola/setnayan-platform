/**
 * A COUPLE'S PUBLIC RECOMMENDATION OUTLIVES THE CELEBRATION
 *
 * Owner, 2026-08-24: keep it, same as reviews. `vendor_recommendations` is the
 * SECOND public endorsement a couple's delete silently removed, and it is
 * structurally identical to `vendor_reviews` — the record he named FIRST when he
 * ruled "vendors get to keep it".
 *
 * 🔑 EVERY TEST ASSERTS THE OUTCOME, NEVER A THROW. Under RLS a refused write is
 * filtered to ZERO ROWS and resolves happily — a denial and a no-op are the same
 * value — so `assert.rejects` reports "missing expected rejection" while the data
 * is perfectly safe. Asserting the value HELD survives whichever mechanism does
 * the refusing.
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

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newVendor(tag: string): Promise<string> {
  const userId = await newUser(`reco-vendor-${tag}@example.com`);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Reco Test Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEventWithRecommendation(vendorProfileId: string, coupleUserId: string) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Reco Test Day','birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );
  const r = await db.query<{ recommendation_id: string }>(
    `INSERT INTO public.vendor_recommendations
       (vendor_profile_id, event_id, recommended_by_user_id, endorsement)
     VALUES ($1,$2,$3,'They were wonderful.') RETURNING recommendation_id`,
    [vendorProfileId, eventId, coupleUserId],
  );
  return { eventId, recommendationId: r.rows[0]!.recommendation_id };
}

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function readReco(id: string) {
  const r = await db.query<{ event_id: string | null; endorsement: string | null }>(
    `SELECT event_id, endorsement
       FROM public.vendor_recommendations WHERE recommendation_id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

test('the endorsement survives the celebration, words and all', async () => {
  const vendor = await newVendor('survives');
  const couple = await newUser('reco-couple-survives@example.com');
  const { eventId, recommendationId } = await newEventWithRecommendation(vendor, couple);

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const after = await readReco(recommendationId);
  assert.ok(after, 'THE HEADLINE: the public endorsement was destroyed with the event');
  assert.equal(after.event_id, null, 'it is orphaned, not destroyed');
  assert.equal(after.endorsement, 'They were wonderful.', 'and it keeps its words');
});

test('THREE couples who each delete their celebration still count as THREE', async () => {
  // The trap this migration exists to avoid: `event_id` alone as the dedupe key
  // collapses every orphan into one couple, printing a believable wrong number.
  const vendor = await newVendor('three');
  const ids: string[] = [];
  for (const n of [1, 2, 3]) {
    const couple = await newUser(`reco-couple-three-${n}@example.com`);
    const { eventId, recommendationId } = await newEventWithRecommendation(vendor, couple);
    ids.push(recommendationId);
    await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);
  }

  // An orphan IS one couple, so the surviving ROWS are the count.
  const orphanRows = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_recommendations
      WHERE vendor_profile_id = $1 AND event_id IS NULL`,
    [vendor],
  );
  assert.equal(orphanRows.rows[0]!.n, 3, 'three celebrations recommended this supplier');

  const naive = await db.query<{ n: number }>(
    `SELECT count(DISTINCT event_id)::int AS n
       FROM public.vendor_recommendations WHERE vendor_profile_id = $1`,
    [vendor],
  );
  assert.equal(
    naive.rows[0]!.n,
    0,
    'and the OLD key is proven useless on orphans — this is why the count changed',
  );
  assert.equal(ids.length, 3);
});

test('BOTH partners on one celebration leave ONE endorsement, and it keeps the words', async () => {
  // The reason the dedupe exists at all. After the delete the pair can no longer
  // be grouped, so the database collapses them WHILE it still can — keeping the
  // row that actually says something.
  const vendor = await newVendor('partners');
  const a = await newUser('reco-partner-a@example.com');
  const b = await newUser('reco-partner-b@example.com');
  const { eventId } = await newEventWithRecommendation(vendor, a);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, b],
  );
  await db.query(
    `INSERT INTO public.vendor_recommendations
       (vendor_profile_id, event_id, recommended_by_user_id, endorsement)
     VALUES ($1,$2,$3,NULL)`,
    [vendor, eventId, b],
  );

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const left = await db.query<{ n: number; endorsement: string | null }>(
    `SELECT count(*)::int AS n, min(endorsement) AS endorsement
       FROM public.vendor_recommendations WHERE vendor_profile_id = $1`,
    [vendor],
  );
  assert.equal(left.rows[0]!.n, 1, 'two rows, one celebration — one endorsement survives');
  assert.equal(
    left.rows[0]!.endorsement,
    'They were wonderful.',
    'and the survivor is the one that SAYS something, not the bare thumbs-up',
  );
});

test('once orphaned the endorsement FREEZES — it cannot be rewritten or withdrawn', async () => {
  const vendor = await newVendor('freeze');
  const couple = await newUser('reco-couple-freeze@example.com');
  const { eventId, recommendationId } = await newEventWithRecommendation(vendor, couple);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  await asUser(couple, async () => {
    await db.query(
      `UPDATE public.vendor_recommendations SET endorsement = 'Actually, no.'
        WHERE recommendation_id = $1`,
      [recommendationId],
    );
    await db.query(`DELETE FROM public.vendor_recommendations WHERE recommendation_id = $1`, [
      recommendationId,
    ]);
  });

  const after = await readReco(recommendationId);
  assert.ok(after, 'the couple deleted their celebration and then withdrew the endorsement');
  assert.equal(
    after.endorsement,
    'They were wonderful.',
    'and they rewrote a supplier’s public record after destroying its context',
  );
});

test('a LIVE endorsement is still fully theirs — the freeze is a narrowing, not a lock', async () => {
  const vendor = await newVendor('live');
  const couple = await newUser('reco-couple-live@example.com');
  const { recommendationId } = await newEventWithRecommendation(vendor, couple);

  await asUser(couple, async () => {
    await db.query(
      `UPDATE public.vendor_recommendations SET endorsement = 'Even better than I said.'
        WHERE recommendation_id = $1`,
      [recommendationId],
    );
  });
  assert.equal(
    (await readReco(recommendationId))?.endorsement,
    'Even better than I said.',
    'a couple must still be able to edit a recommendation on an event that exists',
  );

  await asUser(couple, async () => {
    await db.query(`DELETE FROM public.vendor_recommendations WHERE recommendation_id = $1`, [
      recommendationId,
    ]);
  });
  assert.equal(await readReco(recommendationId), null, 'and still withdraw it');
});
