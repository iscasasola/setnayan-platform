/**
 * A PRIVATE NOTE MUST NOT LOCK A COUPLE OUT OF DELETING THEIR CELEBRATION
 *
 * Reproduced against PRODUCTION 2026-08-24 in a rolled-back transaction: book a
 * real marketplace supplier, write ONE private working note on that booking,
 * press delete →
 *
 *   DELETE REFUSED :: 23503 :: violates foreign key constraint
 *   "event_vendor_working_notes_vendor_event_fk"
 *
 * Not a wrong answer — a HARD FAILURE. The couple can never delete their event.
 *
 * 🔑 The slice-4 trap, still open on the table slice 2 itself touches: a
 * COMPOSITE FK spanning `event_id` with ON UPDATE NO ACTION, met by a preserve
 * that UPDATEs `event_id` to NULL.
 *
 * ⛔ The obvious fix (ON UPDATE CASCADE, as slice 4 used on payments) is the one
 * fix that must not be made — it would let the couple's most private table
 * SURVIVE, attached to a preserved supplier record. Both directions are tested.
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

async function seed(tag: string) {
  const vu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`note-vendor-${tag}@example.com`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Note Test Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [vu.rows[0]!.id],
  );
  const vendorProfileId = v.rows[0]!.vendor_profile_id;

  const cu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`note-couple-${tag}@example.com`],
  );
  const coupleUserId = cu.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Note Test Day','birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );
  // A really-booked, marketplace-linked, arm's-length row — i.e. one slice 2
  // WILL preserve. The refusal only happens on a row the preserve actually
  // touches, which is why an ordinary unbooked event never showed it.
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id)
     VALUES ($1,'photographer','Note Test Studio','complete',$2,$2)
     RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  return { eventId, coupleUserId, vendorProfileId, eventVendorId: ev.rows[0]!.vendor_id };
}

async function addNote(s: { eventId: string; eventVendorId: string; coupleUserId: string }) {
  await db.query(
    `INSERT INTO public.event_vendor_working_notes
       (event_id, event_vendor_id, author_user_id, author_role, visibility, body)
     VALUES ($1,$2,$3,'couple','shared','Ran late twice. Would not book again.')`,
    [s.eventId, s.eventVendorId, s.coupleUserId],
  );
}

test('a couple with one private note on a booked supplier can still delete their celebration', async () => {
  const s = await seed('blocks');
  await addNote(s);

  // THE REGRESSION: this threw 23503 and the couple was locked out for good.
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const gone = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.events WHERE event_id = $1`, [s.eventId]);
  assert.equal(gone.rows[0]!.n, 0, 'the celebration must actually be deleted');
});

test('the supplier still keeps the booking — the fix must not cost the preserve', async () => {
  const s = await seed('preserve');
  await addNote(s);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const kept = await db.query<{ n: number; ev: string | null }>(
    `SELECT count(*)::int AS n, max(event_id::text) AS ev
       FROM public.event_vendors WHERE vendor_id = $1`, [s.eventVendorId]);
  assert.equal(kept.rows[0]!.n, 1, 'slice 2 must still preserve the booked row');
  assert.equal(kept.rows[0]!.ev, null, 'and it must be detached from the deleted event');
});

test('the couple\'s private assessment of that supplier is DESTROYED, never carried across', async () => {
  const s = await seed('destroy');
  await addNote(s);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const notes = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_working_notes
      WHERE event_vendor_id = $1`, [s.eventVendorId]);
  assert.equal(notes.rows[0]!.n, 0,
    'THE OPPOSITE FAILURE: ON UPDATE CASCADE would orphan the note alongside the ' +
    'booking, stop it matching the deleted event, and preserve the couple\'s ' +
    'candid assessment of the very supplier it is attached to');
});

test('the composite FK still says ON UPDATE NO ACTION — the fix is ordering, not a rule change', async () => {
  const r = await db.query<{ upd: string }>(
    `SELECT con.confupdtype::text AS upd FROM pg_constraint con
      WHERE con.conname = 'event_vendor_working_notes_vendor_event_fk'`,
  );
  assert.equal(r.rows[0]?.upd, 'a',
    'the FK must remain ON UPDATE NO ACTION (a). Relaxing it is the fix that ' +
    'silently preserves the couple\'s private notes.');
});
