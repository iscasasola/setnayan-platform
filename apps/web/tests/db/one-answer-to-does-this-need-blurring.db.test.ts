/**
 * ONE ANSWER TO "DOES THIS PHOTO NEED BLURRING?"
 *
 * Owner ruling 1 of 2026-08-17 puts blur on the public event page and the shared
 * pool as well as the venue wall. Before this, the rule lived inline in BOTH
 * wall functions — and public readers were about to become a third and fourth
 * copy. Checking a column in three places is three chances to forget, and the
 * next surface makes four; this codebase has already paid for exactly that with
 * the photo wall, where three guest surfaces each asked SKU-ownership and
 * nothing else.
 *
 * So `papic_capture_needs_blur` is now the single definition and the wall asks
 * it. These tests pin the predicate itself; `withdrawal-blurs-and-keeps.db.test.ts`
 * (9 assertions, already on main) pins that the wall's BEHAVIOUR is unchanged by
 * the move — both suites must be green for the refactor to be honest.
 *
 * ⚖ THE TWO REASONS HAVE DIFFERENT SHAPES, ON PURPOSE:
 *   FaceBlock  — EVENT-WIDE. One guest with it on ⇒ every capture on the event.
 *   Withdrawal — PER-PHOTO, via tags. Only the photos that person is in.
 * A test for each, because folding them into one shape is the likeliest wrong
 * simplification and would silently change who is protected.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F: {
  eventId: string; otherEventId: string; userId: string; seatId: string;
  withdrawn: string; consenting: string; blocker: string;
} = {
  eventId: '', otherEventId: '', userId: '', seatId: '',
  withdrawn: '', consenting: '', blocker: '',
};

async function newPhoto(eventId = F.eventId): Promise<string> {
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, moderation_state)
     VALUES ($1,$2,$3,'clean') RETURNING photo_id`,
    [eventId, F.seatId, `k/${Math.abs(Number(process.hrtime.bigint() % 1000000n))}.jpg`],
  );
  return r.rows[0]!.photo_id;
}

async function tag(photoId: string, guestId: string, eventId = F.eventId): Promise<void> {
  await db.query(
    `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
     VALUES ($1,'papic_photos',$2,$3,'individual_qr')`,
    [eventId, photoId, guestId],
  );
}

async function needsBlur(photoId: string, eventId = F.eventId): Promise<boolean> {
  const r = await db.query<{ b: boolean }>(
    `SELECT public.papic_capture_needs_blur($1,'papic_photos',$2) AS b`,
    [eventId, photoId],
  );
  return r.rows[0]!.b === true;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('needs-blur@test.local', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  F.userId = u.rows[0]!.id;

  const mkEvent = async (name: string) => {
    const e = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date)
       VALUES ($1,'birthday',CURRENT_DATE) RETURNING event_id`, [name],
    );
    return e.rows[0]!.event_id;
  };
  F.eventId = await mkEvent('Needs Blur');
  F.otherEventId = await mkEvent('Untouched Neighbour');

  const s = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1,$2,1,'PAPIC_CAMERA_MINI_DAY','tok-needs-blur') RETURNING seat_id`,
    [F.eventId, F.userId],
  );
  F.seatId = s.rows[0]!.seat_id;

  const mkGuest = async (name: string, eventId: string, consent: boolean, faceblock: boolean) => {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests
         (event_id, first_name, last_name, side, group_category, role, rsvp_status,
          meal_preference, invited_to_blocks, entry_source, photo_consent, faceblock_enabled)
       VALUES ($1,$2,'G','both','other','guest','attending','no_preference',
               ARRAY['ceremony','reception'],'host_seeded',$3,$4) RETURNING guest_id`,
      [eventId, name, consent, faceblock],
    );
    return g.rows[0]!.guest_id;
  };
  F.withdrawn = await mkGuest('Withdrew', F.eventId, false, false);
  F.consenting = await mkGuest('Consented', F.eventId, true, false);
  F.blocker = await mkGuest('Blocker', F.otherEventId, true, false); // faceblock set per-test
});

after(async () => { await db?.close(); });

test('ANCHOR — an ordinary photo needs no blur, so nothing below passes vacuously', async () => {
  const p = await newPhoto();
  await tag(p, F.consenting);
  assert.equal(await needsBlur(p), false, 'a plain consented photo already needs a blur — fixture broken');
});

test('WITHDRAWAL is PER-PHOTO: only the photos that person is tagged in', async () => {
  const theirs = await newPhoto();
  await tag(theirs, F.withdrawn);
  const others = await newPhoto();
  await tag(others, F.consenting);

  assert.equal(await needsBlur(theirs), true, 'a photo tagged with a withdrawn guest does not need a blur');
  assert.equal(
    await needsBlur(others),
    false,
    'one withdrawal made an UNRELATED photo need blurring — the rule went event-wide',
  );
});

test('FACEBLOCK is EVENT-WIDE: one guest with it on covers every capture', async () => {
  const untagged = await newPhoto(F.otherEventId);
  assert.equal(await needsBlur(untagged, F.otherEventId), false, 'baseline: nothing on that event yet');

  await db.query(`UPDATE public.guests SET faceblock_enabled = TRUE WHERE guest_id = $1`, [F.blocker]);
  assert.equal(
    await needsBlur(untagged, F.otherEventId),
    true,
    'FaceBlock did not reach a capture nobody is tagged in — it must be event-wide',
  );
  await db.query(`UPDATE public.guests SET faceblock_enabled = FALSE WHERE guest_id = $1`, [F.blocker]);
});

test('a SOFT-DELETED FaceBlock guest stops covering the event', async () => {
  // The FaceBlock half filters deleted_at; the withdrawal half deliberately does
  // NOT (see the migration header). Pinned so neither is "tidied" into the other.
  const p = await newPhoto(F.otherEventId);
  await db.query(`UPDATE public.guests SET faceblock_enabled = TRUE WHERE guest_id = $1`, [F.blocker]);
  assert.equal(await needsBlur(p, F.otherEventId), true);
  await db.query(`UPDATE public.guests SET deleted_at = NOW() WHERE guest_id = $1`, [F.blocker]);
  assert.equal(await needsBlur(p, F.otherEventId), false, 'a deleted guest still forces the whole event to blur');
  await db.query(
    `UPDATE public.guests SET deleted_at = NULL, faceblock_enabled = FALSE WHERE guest_id = $1`,
    [F.blocker],
  );
});

test('the rule does not leak ACROSS events', async () => {
  // FaceBlock on one event must never blur a different couple's photos.
  await db.query(`UPDATE public.guests SET faceblock_enabled = TRUE WHERE guest_id = $1`, [F.blocker]);
  const mine = await newPhoto();
  await tag(mine, F.consenting);
  assert.equal(await needsBlur(mine), false, 'a FaceBlock guest on ANOTHER event forced a blur here');
  await db.query(`UPDATE public.guests SET faceblock_enabled = FALSE WHERE guest_id = $1`, [F.blocker]);
});

test('the SET form returns exactly the subset needing a blur', async () => {
  const needs = await newPhoto();
  await tag(needs, F.withdrawn);
  const clean1 = await newPhoto();
  await tag(clean1, F.consenting);
  const clean2 = await newPhoto();

  const r = await db.query<{ source_id: string }>(
    `SELECT source_id FROM public.papic_captures_needing_blur($1,'papic_photos',$2::uuid[])`,
    [F.eventId, [needs, clean1, clean2]],
  );
  assert.deepEqual(r.rows.map((x) => x.source_id), [needs]);
});

test('the SET form on an empty or NULL list returns nothing, and does not throw', async () => {
  for (const arg of ['{}', null]) {
    const r = await db.query<{ source_id: string }>(
      `SELECT source_id FROM public.papic_captures_needing_blur($1,'papic_photos',$2::uuid[])`,
      [F.eventId, arg],
    );
    assert.equal(r.rows.length, 0);
  }
});

test('the scalar and the set form can never disagree', async () => {
  // The set form is DEFINED in terms of the scalar; this proves it stayed that
  // way. Two definitions of one rule is the thing this whole function exists to
  // prevent.
  const ids: string[] = [];
  const a = await newPhoto(); await tag(a, F.withdrawn); ids.push(a);
  const b = await newPhoto(); await tag(b, F.consenting); ids.push(b);
  const c = await newPhoto(); ids.push(c);

  const set = new Set(
    (
      await db.query<{ source_id: string }>(
        `SELECT source_id FROM public.papic_captures_needing_blur($1,'papic_photos',$2::uuid[])`,
        [F.eventId, ids],
      )
    ).rows.map((x) => x.source_id),
  );
  for (const id of ids) {
    assert.equal(set.has(id), await needsBlur(id), `scalar and set disagree for ${id}`);
  }
});

test('the blurred web-copy columns exist on BOTH capture tables', async () => {
  // They are written by lib/papic-derivatives.ts and read by the public paths in
  // part 2. A missing column reads as a phantom-column rejection — the whole
  // statement fails and the row comes back null, which would look exactly like
  // "no safe copy" forever.
  for (const t of ['papic_photos', 'papic_guest_captures']) {
    const r = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
          AND column_name IN ('safe_display_r2_key','safe_tile_r2_key','safe_thumb_r2_key')`,
      [t],
    );
    assert.equal(r.rows[0]!.n, '3', `${t} is missing one of the blurred web-copy columns`);
  }
});
