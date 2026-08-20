/**
 * GUARD — deleting a celebration severs its connections.
 *
 * Owner 2026-08-20, after deleting his own event and finding what stayed:
 * *"it should remove all connections to that event. Inquiries, payments, etc."*
 *
 * His delete left order S89O-GCR6BDC4Z6 — PHP 499, unpaid — sitting in the
 * admin payment queue with a null event and nothing to tie it to. Ten foreign
 * keys are ON DELETE SET NULL (verified in prod by the object), so their rows
 * survive the cascade. This suite pins which of them are severed and, just as
 * importantly, which are deliberately LEFT ALONE.
 *
 * 🔑 EVERY TEST DELETES THROUGH RAW SQL, NEVER THROUGH THE SERVER ACTION.
 * Production still grants `authenticated` DELETE on `public.events`
 * (`has_table_privilege` = TRUE, measured), so a couple can delete straight
 * through PostgREST with no app code running. A guard that went through the
 * action would prove nothing about the path that actually exists.
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

async function seedEvent(slug: string, name = 'Probe'): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name)
     VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [slug, name],
  );
  return r.rows[0]!.event_id;
}
/**
 * `public.users` FKs to `auth.users`, and neither has a default id — a person
 * has to exist before anything can belong to them. Seeding one without the
 * other invents a state the product cannot produce, which proves something
 * about a database we do not have. Same helper shape as erase-vendor-seats.
 */
let seq = 0;
async function seedUser(email: string): Promise<string> {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    id,
    email,
  ]);
  await db.query(
    `INSERT INTO public.users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, email],
  );
  return id;
}

test('AN UNPAID BILL IS CANCELLED, NOT LEFT FLOATING — the owner’s exact defect', async () => {
  const eventId = await seedEvent('sever-order', 'Ice turns 40');
  const userId = await seedUser('sever-order@probe.test');
  await db.query(
    `INSERT INTO public.orders (event_id, user_id, service_key, description,
                                requested_total_php, status, reference_code)
     VALUES ($1, $2, 'ONBOARDING_SERVICES', 'Setnayan AI', 499, 'submitted', 'PROBE00001')`,
    [eventId, userId],
  );

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const { rows } = await db.query<{ status: string; admin_notes: string | null }>(
    `SELECT status, admin_notes FROM public.orders WHERE reference_code = 'PROBE00001'`,
  );
  assert.equal(rows.length, 1, 'the order row must SURVIVE — cancel is the verb, never delete');
  assert.equal(
    rows[0]!.status,
    'cancelled',
    'the bill is still live after its celebration was deleted — this is exactly what the ' +
      'owner found: an unpayable, uncancellable order in the admin queue with no event',
  );
  assert.match(
    rows[0]!.admin_notes ?? '',
    /Ice turns 40/,
    'a cancelled bill must say WHICH celebration it belonged to, or an operator meeting it ' +
      'has no way to find out',
  );
});

test('A PAID BILL IS NEVER REWRITTEN by the trigger', async () => {
  // deleteOwnEvent refuses an event carrying money, so this state should never
  // arrive here. If it ever does — through the RLS lane — the trigger must not
  // quietly rewrite a settled order's status.
  const eventId = await seedEvent('sever-paid');
  const userId = await seedUser('sever-paid@probe.test');
  await db.query(
    `INSERT INTO public.orders (event_id, user_id, service_key, description,
                                requested_total_php, status, reference_code)
     VALUES ($1, $2, 'ONBOARDING_SERVICES', 'Setnayan AI', 499, 'paid', 'PROBE00002')`,
    [eventId, userId],
  );
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);
  assert.equal(
    (await db.query<{ status: string }>(
      `SELECT status FROM public.orders WHERE reference_code = 'PROBE00002'`,
    )).rows[0]!.status,
    'paid',
    'the trigger rewrote a PAID order — a settled bill is not its to touch',
  );
});

test('THE WAITLIST STOPS WAITING — the one leftover that emails a person', async () => {
  // When the date frees, the supplier's waitlist emails whoever is queued
  // ("a slot opened") — for a celebration that no longer exists. It also spends
  // one of that supplier's tier-capped acceptances on a ghost.
  const eventId = await seedEvent('sever-waitlist');
  const userId = await seedUser('sever-waitlist@probe.test');
  const vend = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, business_slug)
     VALUES ('Probe Studio', 'probe-studio-sever') RETURNING vendor_profile_id`,
  );
  await db.query(
    `INSERT INTO public.vendor_date_waitlist
       (vendor_profile_id, event_id, user_id, requested_date, status, accepted_at)
     VALUES ($1, $2, $3, CURRENT_DATE + 30, 'notified', now())`,
    [vend.rows[0]!.vendor_profile_id, eventId, userId],
  );

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const { rows } = await db.query<{ status: string; accepted_at: string | null }>(
    `SELECT status, accepted_at FROM public.vendor_date_waitlist WHERE user_id = $1`,
    [userId],
  );
  assert.equal(rows[0]!.status, 'cancelled', 'a deleted celebration is still queued for a date');
  assert.equal(
    rows[0]!.accepted_at,
    null,
    'accepted_at survived — that supplier’s freed date stays consumed by a ghost forever',
  );
});

test('SETNAYAN’S OWN LIVE STUDIO CHANNEL COMES BACK', async () => {
  const eventId = await seedEvent('sever-channel');
  await db.query(
    `INSERT INTO public.live_studio_roam_channel_pool
       (youtube_channel_id, label, status, checked_out_event_id, checked_out_at)
     VALUES ('UCprobe000', 'probe-channel', 'checked_out', $1, now())`,
    [eventId],
  );
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const { rows } = await db.query<{ status: string; checked_out_event_id: string | null }>(
    `SELECT status, checked_out_event_id FROM public.live_studio_roam_channel_pool
      WHERE youtube_channel_id = 'UCprobe000'`,
  );
  assert.equal(rows.length, 1, 'the pool row is Setnayan inventory — released, never deleted');
  assert.equal(
    rows[0]!.status,
    'available',
    'one of our own channels is stuck lent out to nobody, and the automatic return searches ' +
      'by event id so it can never find it again',
  );
  assert.equal(rows[0]!.checked_out_event_id, null);
});

test('THE SLUG HOLD SURVIVES — the trigger must not sever the one thing that must stay', async () => {
  // Owner-locked. A printed save-the-date QR must never later land a guest on
  // a stranger's wedding. Both triggers fire on the same DELETE; this pins that
  // the new one does not disturb the old one.
  const eventId = await seedEvent('sever-keeps-hold');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);
  assert.equal(
    (await db.query(
      `SELECT 1 FROM public.slug_change_log WHERE old_slug = 'sever-keeps-hold'
        AND entity_type = 'event_closed'`,
    )).rows.length,
    1,
    'the address hold is gone — a printed QR could now be handed to a stranger',
  );
});

test('A GUEST’S BOOKMARK AND A SUPPLIER’S METRICS ARE LEFT ALONE', async () => {
  // Not the couple's records to destroy. Both are SET NULL and STAY that way.
  const eventId = await seedEvent('sever-leaves-alone');
  const userId = await seedUser('sever-guest@probe.test');
  const vend = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, business_slug)
     VALUES ('Probe Two', 'probe-two-sever') RETURNING vendor_profile_id`,
  );
  await db.query(
    `INSERT INTO public.guest_saved_vendors (user_id, vendor_profile_id, source_event_id)
     VALUES ($1, $2, $3)`,
    [userId, vend.rows[0]!.vendor_profile_id, eventId],
  );

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  assert.equal(
    (await db.query(`SELECT 1 FROM public.guest_saved_vendors WHERE user_id = $1`, [userId]))
      .rows.length,
    1,
    'a GUEST’s saved-vendor bookmark was destroyed by the couple deleting their event — ' +
      'that shortlist is the guest’s own, and the supplier’s "N saved you" count with it',
  );
});
