/**
 * WITHDRAWING PHOTO CONSENT BLURS THE PHOTO AND KEEPS IT
 *
 * Owner ruling 2 of 2026-08-17: *"Withdrawal BLURS and KEEPS the photo, not
 * hides it. Deliberately SOFTER than today, so one guest opting out cannot
 * delete a table of ten people's group shot."*
 *
 * Before this change the wall ran an outright VETO — `wall_ingest` named it
 * itself, *"G2 — photo-consent veto via tagged guests"* — and dropped the photo
 * whether or not a blurred copy existed. One guest withdrawing took everyone
 * else in the frame with them.
 *
 * ⚖ THE DIRECTION OF THIS CHANGE IS DELIBERATE AND IS NOT A SECURITY FIX. It
 * makes ONE person's photo more visible (blurred, where it used to be absent) to
 * stop them deleting nine other people's. The tests below therefore pin BOTH
 * halves: the new visibility, and — more important — that fail-closed survived
 * it. An unblurred photo of a withdrawn guest must never reach the wall, and the
 * "still withheld" tests are the ones that must never be relaxed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F: {
  eventId: string;
  userId: string;
  seatId: string;
  withdrawn: string; // a guest who withdrew photo consent
  consenting: string; // a guest who did not
} = { eventId: '', userId: '', seatId: '', withdrawn: '', consenting: '' };

/** A capture, optionally already carrying a baked blur derivative. */
async function newPhoto(opts: { baked: boolean; clean?: boolean }): Promise<string> {
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, moderation_state,
        faceblock_baked_at, wall_safe_r2_key)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING photo_id`,
    [
      F.eventId,
      F.seatId,
      `event/papic/${Math.abs(Number(process.hrtime.bigint() % 100000n))}.jpg`,
      opts.clean === false ? 'unscreened' : 'clean',
      opts.baked ? new Date().toISOString() : null,
      opts.baked ? 'r2://setnayan-media/safe/blurred.jpg' : null,
    ],
  );
  return r.rows[0]!.photo_id;
}

async function tag(photoId: string, guestId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
     VALUES ($1,'papic_photos',$2,$3,'individual_qr')`,
    [F.eventId, photoId, guestId],
  );
}

/** Does this photo project on the wall right now? */
async function projects(photoId: string): Promise<boolean> {
  await db.query(`SELECT public.wall_ingest('papic_photos', $1)`, [photoId]);
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.wall_visible_photos($1)
      WHERE source_id = $2`,
    [F.eventId, photoId],
  );
  return r.rows[0]!.n !== '0';
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('wall-blur@test.local', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  F.userId = u.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Blur And Keep', 'birthday', CURRENT_DATE) RETURNING event_id`,
  );
  F.eventId = e.rows[0]!.event_id;

  const s = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats
       (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1,$2,1,'PAPIC_CAMERA_MINI_DAY','tok-wall-blur') RETURNING seat_id`,
    [F.eventId, F.userId],
  );
  F.seatId = s.rows[0]!.seat_id;

  const mk = async (name: string, consent: boolean) => {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests
         (event_id, first_name, last_name, side, group_category, role, rsvp_status,
          meal_preference, invited_to_blocks, entry_source, photo_consent)
       VALUES ($1,$2,'Guest','both','other','guest','attending','no_preference',
               ARRAY['ceremony','reception'],'host_seeded',$3)
       RETURNING guest_id`,
      [F.eventId, name, consent],
    );
    return g.rows[0]!.guest_id;
  };
  F.withdrawn = await mk('Withdrew', false);
  F.consenting = await mk('Consented', true);
});

after(async () => {
  await db?.close();
});

test('ANCHOR — the harness can put a photo on the wall at all', async () => {
  // Every assertion below passes vacuously if nothing ever projects.
  const clean = await newPhoto({ baked: false });
  await tag(clean, F.consenting);
  assert.equal(await projects(clean), true, 'a plain consented photo does not project — the fixture is broken');
});

test('🔒 STILL WITHHELD: a withdrawn guest, no blur baked', async () => {
  // THE ONE THAT MUST NEVER BE RELAXED. Fail-closed survived the change.
  const p = await newPhoto({ baked: false });
  await tag(p, F.withdrawn);
  assert.equal(await projects(p), false, 'an UNBLURRED photo of a withdrawn guest reached the wall');
});

test('✅ NOW PROJECTS: a withdrawn guest, blur baked — the ruling', async () => {
  const p = await newPhoto({ baked: true });
  await tag(p, F.withdrawn);
  assert.equal(await projects(p), true, 'a blurred photo of a withdrawn guest is still being vetoed');
});

test('the group shot survives — one withdrawal no longer deletes it for everyone', async () => {
  // The reason the owner chose softer. Nine other faces are in this frame.
  const p = await newPhoto({ baked: true });
  await tag(p, F.withdrawn);
  await tag(p, F.consenting);
  assert.equal(await projects(p), true, 'one guest withdrawing still removes the whole group shot');
});

test('a withdrawn guest still cannot ride in on somebody else`s consent', async () => {
  // Same group shot, NOT baked. The presence of a consenting guest must not
  // rescue it — the blur requirement is per-photo, not per-person.
  const p = await newPhoto({ baked: false });
  await tag(p, F.withdrawn);
  await tag(p, F.consenting);
  assert.equal(await projects(p), false, 'an unbaked group shot leaked because someone in it consented');
});

test('the NSFW allowlist is untouched — unscreened never projects, baked or not', async () => {
  const p = await newPhoto({ baked: true, clean: false });
  await tag(p, F.consenting);
  assert.equal(await projects(p), false, 'an unscreened photo reached the wall');
});

test('FaceBlock is untouched: it still withholds every un-baked tile event-wide', async () => {
  // Turn FaceBlock on for one guest and confirm the OTHER rule still bites.
  const p = await newPhoto({ baked: false });
  await tag(p, F.consenting);
  assert.equal(await projects(p), true, 'baseline: should project before FaceBlock is on');

  await db.query(`UPDATE public.guests SET faceblock_enabled = TRUE WHERE guest_id = $1`, [
    F.consenting,
  ]);
  assert.equal(
    await projects(p),
    false,
    'FaceBlock stopped withholding un-baked tiles — the clause was damaged',
  );
  await db.query(`UPDATE public.guests SET faceblock_enabled = FALSE WHERE guest_id = $1`, [
    F.consenting,
  ]);
});

test('an untagged photo is unaffected by anyone`s withdrawal', async () => {
  // Honest about the boundary: the rule keys on TAGS. A photo nobody is tagged
  // in was never covered, before or after. Pinned so the limit is visible
  // rather than discovered.
  const p = await newPhoto({ baked: false });
  assert.equal(await projects(p), true);
});

test('the wall never hands out the ORIGINAL key for a withdrawn guest`s photo', async () => {
  // The blurred derivative is the point. If wall_safe_r2_key ever came back as
  // the original for one of these, the wall would project an unblurred face
  // while every visibility test above still passed.
  const p = await newPhoto({ baked: true });
  await tag(p, F.withdrawn);
  await projects(p);
  const r = await db.query<{ k: string }>(
    `SELECT wall_safe_r2_key AS k FROM public.wall_feed WHERE source_id = $1`,
    [p],
  );
  assert.equal(
    r.rows[0]!.k,
    'r2://setnayan-media/safe/blurred.jpg',
    'the wall stored the ORIGINAL key for a withdrawn guest — it would project an unblurred face',
  );
});
