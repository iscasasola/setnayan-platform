/**
 * THE SHARED POOL BLURS AND KEEPS TOO — the last surface that still vetoed.
 *
 * Owner ruling 2 of 2026-08-17: *"Withdrawal BLURS and KEEPS the photo, not
 * hides it. Deliberately SOFTER than today, so one guest opting out cannot
 * delete a table of ten people's group shot."*
 *
 * `guest_pool_gallery` carried the SAME split the venue wall did: FaceBlock
 * blurred and kept, withdrawn consent vetoed outright. The wall was corrected on
 * 2026-08-24 and the public event page on 2026-08-18; this is the third.
 *
 * ⚖ THE DIRECTION IS A SOFTENING AND IS NOT A SECURITY FIX. It makes ONE
 * person's photo more visible — blurred, where it used to be absent — to stop
 * them deleting nine other people's. So the tests that matter most here are the
 * ones proving the floor SURVIVED it: an unblurred photo of someone who opted
 * out must never reach the pool, and a CLIP of them must never reach it at all
 * (there is no video blur).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const SAFE_WEB = 'r2://setnayan-media/derivatives/x.safe-display.avif';
const SAFE_PROJECTOR = 'r2://setnayan-media/safe/full.jpg';
const PLAIN = 'r2://setnayan-media/derivatives/x.display.avif';

const F = {
  eventId: '', userId: '', seatId: '',
  viewer: '', withdrawn: '', consenting: '',
};

type PhotoOpts = {
  clip?: boolean;
  baked?: boolean;
  safeWeb?: boolean;
  safeProjector?: boolean;
};

async function newPhoto(o: PhotoOpts = {}): Promise<string> {
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, moderation_state, photo_type,
        display_r2_key, thumb_r2_key, clip_web_r2_key,
        faceblock_baked_at, wall_safe_r2_key, safe_display_r2_key, safe_thumb_r2_key)
     VALUES ($1,$2,$3,'clean',$4,$5,$6,$7,$8,$9,$10,$11) RETURNING photo_id`,
    [
      F.eventId, F.seatId, `orig/${Math.abs(Number(process.hrtime.bigint() % 1000000n))}.jpg`,
      o.clip ? 'clip' : 'photo',
      PLAIN, 'r2://setnayan-media/derivatives/x.thumb.avif',
      o.clip ? 'r2://setnayan-media/clip/web.mp4' : null,
      o.baked ? new Date().toISOString() : null,
      o.safeProjector ? SAFE_PROJECTOR : null,
      o.safeWeb ? SAFE_WEB : null,
      o.safeWeb ? 'r2://setnayan-media/derivatives/x.safe-thumb.avif' : null,
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

/** What the pool hands this viewer for one capture, or null if withheld. */
async function poolRow(photoId: string): Promise<{ display: string | null } | null> {
  const r = await db.query<{ source_id: string; display_r2_key: string | null }>(
    `SELECT source_id, display_r2_key FROM public.guest_pool_gallery($1)`,
    [F.viewer],
  );
  const hit = r.rows.find((x) => x.source_id === photoId);
  return hit ? { display: hit.display_r2_key } : null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('pool-blur@test.local', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  F.userId = u.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, pool_gallery_open)
     VALUES ('Pool Blurs','birthday',CURRENT_DATE,TRUE) RETURNING event_id`,
  );
  F.eventId = e.rows[0]!.event_id;

  const s = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1,$2,1,'PAPIC_CAMERA_MINI_DAY','tok-pool-blur') RETURNING seat_id`,
    [F.eventId, F.userId],
  );
  F.seatId = s.rows[0]!.seat_id;

  const mk = async (name: string, consent: boolean) => {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests
         (event_id, first_name, last_name, side, group_category, role, rsvp_status,
          meal_preference, invited_to_blocks, entry_source, photo_consent)
       VALUES ($1,$2,'G','both','other','guest','attending','no_preference',
               ARRAY['ceremony','reception'],'host_seeded',$3) RETURNING guest_id`,
      [F.eventId, name, consent],
    );
    return g.rows[0]!.guest_id;
  };
  F.viewer = await mk('Viewer', true);
  F.withdrawn = await mk('Withdrew', false);
  F.consenting = await mk('Consented', true);
});

after(async () => { await db?.close(); });

test('ANCHOR — an ordinary photo reaches the pool, so nothing below passes vacuously', async () => {
  const p = await newPhoto();
  await tag(p, F.consenting);
  const row = await poolRow(p);
  assert.ok(row, 'a plain photo never reached the pool — the fixture is broken');
  assert.equal(row.display, PLAIN, 'a photo needing no blur should serve the ordinary copy');
});

test('🔒 STILL WITHHELD: someone opted out, nothing baked', async () => {
  // THE FLOOR. Must never be relaxed.
  const p = await newPhoto();
  await tag(p, F.withdrawn);
  assert.equal(await poolRow(p), null, 'an UNBLURRED photo of someone who opted out reached the pool');
});

test('✅ NOW SHOWN, BLURRED: someone opted out, a blurred copy exists — the ruling', async () => {
  const p = await newPhoto({ baked: true, safeWeb: true });
  await tag(p, F.withdrawn);
  const row = await poolRow(p);
  assert.ok(row, 'a blurred photo of someone who opted out is still being vetoed');
  assert.equal(row.display, SAFE_WEB, 'the pool served something other than the blurred web copy');
});

test('the group shot survives — one person opting out no longer deletes it', async () => {
  const p = await newPhoto({ baked: true, safeWeb: true });
  await tag(p, F.withdrawn);
  await tag(p, F.consenting);
  const row = await poolRow(p);
  assert.ok(row, 'one guest opting out still removes the whole group shot from the pool');
  assert.equal(row.display, SAFE_WEB);
});

test('the WEB copy is preferred, and the projector file is the fallback — both blurred', async () => {
  // A row baked before the web copies existed still has the full-size JPEG.
  // Heavier, never barer.
  const legacy = await newPhoto({ baked: true, safeProjector: true });
  await tag(legacy, F.withdrawn);
  assert.equal((await poolRow(legacy))?.display, SAFE_PROJECTOR);

  const modern = await newPhoto({ baked: true, safeWeb: true, safeProjector: true });
  await tag(modern, F.withdrawn);
  assert.equal(
    (await poolRow(modern))?.display,
    SAFE_WEB,
    'the projector-sized JPEG won over the web copy — that is the cost bug this fixes',
  );
});

test('🔒 a CLIP of someone who opted out is DROPPED, never served', async () => {
  // There is no video blur — face-blur bakes stills only — so a clip has no safe
  // form. Serving it "because a still was baked" would be the leak.
  const c = await newPhoto({ clip: true, baked: true, safeWeb: true });
  await tag(c, F.withdrawn);
  assert.equal(await poolRow(c), null, 'a CLIP of someone who opted out reached the shared pool');
});

test('FaceBlock still covers the whole event, and still serves only a blurred copy', async () => {
  const untagged = await newPhoto({ baked: true, safeWeb: true });
  assert.equal((await poolRow(untagged))?.display, PLAIN, 'baseline: no blur needed yet');

  await db.query(`UPDATE public.guests SET faceblock_enabled = TRUE WHERE guest_id = $1`, [F.consenting]);
  assert.equal(
    (await poolRow(untagged))?.display,
    SAFE_WEB,
    'FaceBlock stopped covering a capture nobody is tagged in — it must stay event-wide',
  );

  const unbaked = await newPhoto();
  assert.equal(await poolRow(unbaked), null, 'FaceBlock stopped withholding un-baked captures');
  await db.query(`UPDATE public.guests SET faceblock_enabled = FALSE WHERE guest_id = $1`, [F.consenting]);
});

test('the couple toggle still closes the pool entirely', async () => {
  // Unrelated to blurring, and the one gate that must not have been disturbed by
  // rewriting the function around it.
  const p = await newPhoto();
  await tag(p, F.consenting);
  assert.ok(await poolRow(p));
  await db.query(`UPDATE public.events SET pool_gallery_open = FALSE WHERE event_id = $1`, [F.eventId]);
  assert.equal(await poolRow(p), null, 'the couple closed the pool and it still served photos');
  await db.query(`UPDATE public.events SET pool_gallery_open = TRUE WHERE event_id = $1`, [F.eventId]);
});

test('the pool never hands out the geo-bearing original', async () => {
  // The module presigns whatever comes back, so an original here would be a
  // location leak as well as an unblurred face.
  const r = await db.query<{ display_r2_key: string | null }>(
    `SELECT display_r2_key FROM public.guest_pool_gallery($1)`, [F.viewer],
  );
  for (const row of r.rows) {
    assert.ok(
      !String(row.display_r2_key ?? '').includes('/orig/'),
      'the pool returned an original object key',
    );
  }
});
