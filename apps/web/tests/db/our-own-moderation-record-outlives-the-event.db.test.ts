/**
 * SETNAYAN'S OWN RECORD OF A MODERATION DECISION OUTLIVES THE EVENT
 *
 * Applying the owner's STANDING rule (2026-08-21) rather than re-asking it: "did
 * the supplier take part in it?" A self-review appeal is a supplier contesting a
 * block on their own reputation, and OUR answer. The couple is not a party to it
 * and no couple-facing surface reads it — yet today they can erase it as a side
 * effect of tidying their events.
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

async function seed(tag: string, decided: boolean) {
  const vu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`appeal-vendor-${tag}@example.com`],
  );
  const vendorUserId = vu.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Appeal Test Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [vendorUserId],
  );
  const vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const cu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`appeal-couple-${tag}@example.com`],
  );
  const coupleUserId = cu.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Appeal Test Day','birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );

  const a = await db.query<{ appeal_id: string }>(
    `INSERT INTO public.vendor_review_appeals
       (vendor_profile_id, reviewer_user_id, event_id, matched_signal, review_payload,
        appeal_reason, decided_at, decision, decision_reason)
     VALUES ($1,$2,$3,'device_match','{"rating_overall":5}'::jsonb,
             'This is a real client, not my own account.',
             $4, $5, $6)
     RETURNING appeal_id`,
    [
      vendorProfileId,
      coupleUserId,
      eventId,
      decided ? new Date().toISOString() : null,
      decided ? 'override_published' : null,
      decided ? 'Verified by phone; separate households.' : null,
    ],
  );
  return { vendorProfileId, eventId, appealId: a.rows[0]!.appeal_id };
}

async function readAppeal(id: string) {
  const r = await db.query<{
    event_id: string | null;
    decision: string | null;
    decision_reason: string | null;
    appeal_reason: string | null;
  }>(
    `SELECT event_id, decision, decision_reason, appeal_reason
       FROM public.vendor_review_appeals WHERE appeal_id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

test('a DECIDED appeal — our own ruling — survives the couple deleting their event', async () => {
  const s = await seed('decided', true);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const after = await readAppeal(s.appealId);
  assert.ok(after, 'THE REGRESSION: a couple erased our audit trail of our own decision');
  assert.equal(after.event_id, null, 'orphaned, not destroyed');
  assert.equal(after.decision, 'override_published', 'the ruling survives');
  assert.equal(
    after.decision_reason,
    'Verified by phone; separate households.',
    'and the reasoning behind it',
  );
});

test('a PENDING appeal survives too — a decision in flight is not the couple’s to withdraw', async () => {
  const s = await seed('pending', false);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const after = await readAppeal(s.appealId);
  assert.ok(after, 'a moderation decision in flight was destroyed by someone with no standing in it');
  assert.equal(after.decision, null, 'still undecided');
  assert.ok(after.appeal_reason, 'and the supplier’s own words are still there to judge');
});

test('the admin queue still finds it — the read applies no event filter', async () => {
  // A preserved row nobody can reach is this repo's recurring failure. The queue
  // selects appeals without filtering on the event, so an orphan stays visible.
  const s = await seed('queue', false);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const queue = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_review_appeals WHERE decided_at IS NULL`,
  );
  assert.ok(queue.rows[0]!.n >= 1, 'the pending queue must still contain the orphaned appeal');
});

test('erasing the PERSON still erases the appeal — this change is about the event only', async () => {
  // reviewer_user_id CASCADEs from users, deliberately untouched: an appeal is
  // evidence ABOUT an account, and widening this to the person would quietly
  // reverse an RA 10173 erasure guarantee.
  const r = await db.query<{ del: string }>(
    `SELECT con.confdeltype::text AS del FROM pg_constraint con
      WHERE con.conname = 'vendor_review_appeals_reviewer_user_id_fkey'`,
  );
  assert.equal(r.rows[0]?.del, 'c', 'the reviewer FK must remain ON DELETE CASCADE');
});
