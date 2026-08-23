/**
 * DELETING FACE DATA MUST DELETE THE FACE DATA AND NOTHING ELSE
 *
 * `lib/face-data-retention.ts` deletes a guest's biometric three months after
 * the event ends. It is IRREVERSIBLE — R2 is not versioned and a vector cannot
 * be recomputed from an image that is gone — so the blast radius is the thing
 * worth pinning, not the happy path.
 *
 * The sweep's whole justification rests on one schema claim: that an enrollment
 * row is a LEAF. If anything ever grows a foreign key to it, or if a tag were
 * ever re-keyed to the enrollment instead of the guest, this sweep would start
 * deleting a couple's photographs on a retention clock — the exact outcome the
 * withdrawn 5-year event purge was abandoned for. These tests fail the moment
 * that becomes possible, which is the only warning anyone would get.
 *
 * 🔑 EVERY TEST ASSERTS THE OUTCOME, NEVER A THROW. A refused write under RLS is
 * filtered to zero rows and resolves happily, so `assert.rejects` reports a
 * missing rejection while the data is perfectly safe. Counting what survived is
 * what holds whichever mechanism does the refusing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** One event, one guest whose avatar IS their enrollment selfie, one tagged photo. */
const F: {
  eventId: string;
  guestId: string;
  photoId: string;
  seatId: string;
  userId: string;
  selfieRef: string;
} = {
  eventId: '',
  guestId: '',
  photoId: '',
  seatId: '',
  userId: '',
  selfieRef: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('face-retention@guest.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  F.userId = u.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Face Retention Test', 'birthday', DATE '2026-01-01') RETURNING event_id`,
  );
  F.eventId = e.rows[0]!.event_id;

  // The selfie ref is written to BOTH columns by the RSVP action — one R2
  // object, two pointers. The sweep has to know that; so does this fixture.
  F.selfieRef = `r2://setnayan-media/event-${F.eventId}/selfie/guest.jpg`;

  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role, rsvp_status,
        meal_preference, invited_to_blocks, entry_source, photo_consent,
        photo_url, photo_source)
     VALUES ($1,'Face','Retention','both','other','guest','attending','no_preference',
             ARRAY['ceremony','reception'],'host_seeded',true,$2,'selfie')
     RETURNING guest_id`,
    [F.eventId, F.selfieRef],
  );
  F.guestId = g.rows[0]!.guest_id;

  const s = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats
       (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1,$2,1,'PAPIC_CAMERA_MINI_DAY','tok-face-retention') RETURNING seat_id`,
    [F.eventId, F.userId],
  );
  F.seatId = s.rows[0]!.seat_id;

  const p = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key)
     VALUES ($1,$2,'event/papic/seat-1/photo.jpg') RETURNING photo_id`,
    [F.eventId, F.seatId],
  );
  F.photoId = p.rows[0]!.photo_id;

  // A tag PRODUCED BY face matching — the row most plausibly thought to depend
  // on the enrollment. It carries the guest link itself and no face reference.
  await db.query(
    `INSERT INTO public.photo_tags
       (event_id, source_table, source_id, guest_id, source, confidence)
     VALUES ($1,'papic_photos',$2,$3,'auto_face',0.910)`,
    [F.eventId, F.photoId, F.guestId],
  );

  await db.query(
    `INSERT INTO public.guest_face_enrollments
       (event_id, guest_id, asset_url, source, consent_at, face_vector, vector_model)
     VALUES ($1,$2,$3,'rsvp_selfie',NOW(),'[0.1,0.2,0.3]'::jsonb,'faceapi-dlib@1')`,
    [F.eventId, F.guestId, F.selfieRef],
  );
});

after(async () => {
  await db?.close();
});

test('NOTHING in the schema references guest_face_enrollments', async () => {
  // The load-bearing claim. If this ever returns a row, the sweep below is no
  // longer a leaf delete and must be re-reasoned before it runs again.
  const r = await db.query<{ table_name: string; constraint_name: string }>(
    `SELECT c.conrelid::regclass::text AS table_name, c.conname AS constraint_name
       FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.guest_face_enrollments'::regclass`,
  );
  assert.deepEqual(
    r.rows,
    [],
    'something now points at guest_face_enrollments — a retention delete would cascade into it',
  );
});

test('a face-matched tag depends on the GUEST, not on the enrollment', async () => {
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='photo_tags'
        AND column_name IN ('enrollment_id','face_vector','face_enrollment_id')`,
  );
  assert.equal(r.rows[0]!.n, '0', 'photo_tags grew a face reference; auto_face tags would now die with the biometric');
});

test('deleting the enrollment leaves the photo, the tag and the guest standing', async () => {
  const before = await db.query<{ photos: string; tags: string; guests: string }>(
    `SELECT (SELECT count(*) FROM public.papic_photos WHERE event_id=$1)::text AS photos,
            (SELECT count(*) FROM public.photo_tags  WHERE event_id=$1)::text AS tags,
            (SELECT count(*) FROM public.guests      WHERE event_id=$1)::text AS guests`,
    [F.eventId],
  );
  assert.equal(before.rows[0]!.photos, '1');
  assert.equal(before.rows[0]!.tags, '1');
  assert.equal(before.rows[0]!.guests, '1');

  // Exactly what the sweep does to the biometric.
  const del = await db.query(
    `DELETE FROM public.guest_face_enrollments WHERE event_id=$1 AND guest_id=$2`,
    [F.eventId, F.guestId],
  );
  assert.equal(del.affectedRows, 1);

  const afterRows = await db.query<{
    photos: string; tags: string; guests: string; enrollments: string; autoface: string;
  }>(
    `SELECT (SELECT count(*) FROM public.papic_photos WHERE event_id=$1)::text AS photos,
            (SELECT count(*) FROM public.photo_tags  WHERE event_id=$1)::text AS tags,
            (SELECT count(*) FROM public.guests      WHERE event_id=$1)::text AS guests,
            (SELECT count(*) FROM public.guest_face_enrollments WHERE event_id=$1)::text AS enrollments,
            (SELECT count(*) FROM public.photo_tags WHERE event_id=$1 AND source='auto_face')::text AS autoface`,
    [F.eventId],
  );
  // The biometric is gone …
  assert.equal(afterRows.rows[0]!.enrollments, '0');
  // … and the celebration is untouched. The guest keeps every photo already
  // delivered, including the ones face matching found for them.
  assert.equal(afterRows.rows[0]!.photos, '1', 'a photo died with the face data');
  assert.equal(afterRows.rows[0]!.tags, '1', 'a tag died with the face data');
  assert.equal(afterRows.rows[0]!.autoface, '1', 'the auto_face tag died with the face data');
  assert.equal(afterRows.rows[0]!.guests, '1', 'the guest died with the face data');
});

test('the avatar and the enrollment selfie really are the same object', async () => {
  // Not a style point: it is why the sweep clears photo_url in the same pass.
  // If these ever diverge, clearing the avatar would be deleting something the
  // retention promise never covered.
  const r = await db.query<{ photo_url: string | null; photo_source: string | null }>(
    `SELECT photo_url, photo_source FROM public.guests WHERE guest_id=$1`,
    [F.guestId],
  );
  assert.equal(r.rows[0]!.photo_url, F.selfieRef);
  assert.equal(r.rows[0]!.photo_source, 'selfie');
});

test('an account face profile is NOT reachable from an event', async () => {
  // user_face_profiles is account-scoped and deliberately out of scope: it dies
  // with the account, not with a wedding. If it ever gained an event FK, the
  // event clock could start deleting a living account's face profile.
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_face_profiles'
        AND column_name = 'event_id'`,
  );
  assert.equal(r.rows[0]!.n, '0', 'user_face_profiles grew an event_id — it would fall into the event sweep');
});
