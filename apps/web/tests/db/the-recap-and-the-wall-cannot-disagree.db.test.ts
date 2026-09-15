/**
 * THE PUBLIC RECAP AND THE VENUE WALL CANNOT DISAGREE ABOUT WHO IS BLURRED
 *
 * ── THE DEFECT THIS EXISTS TO STOP COMING BACK ─────────────────────────────
 * For three weeks the tree carried the gap in its own words
 * (`lib/every-guest-read-asks-the-blur-gate.test.ts`, 2026-09-09): the public
 * recap's gate *"implements only the WITHDRAWN-CONSENT half of ruling 1 in
 * TypeScript and has NO FaceBlock arm at all"*, while `papic_capture_needs_blur`
 * treats FaceBlock as EVENT-WIDE. So on an event with a FaceBlock guest the
 * venue wall and the shared pool blurred every frame and **the couple's public
 * event page did not.**
 *
 * 🔑 THE PROPERTY IS "EVERY SURFACE AGREES", NOT "THIS FILE IS CORRECT." Both
 * halves are therefore RUN, over the SAME replayed schema and the SAME rows:
 * the SQL predicate is asked directly, and the TypeScript gate
 * (`loadConsentVetoedPapicIds` / `publicKeyForCapture`) is driven through a
 * PostgREST-shaped client compiled onto this very database. A test that mocked
 * the TypeScript side would prove only that the mock agrees with itself.
 *
 * ⚠ WHAT A GREEN HERE MEANS — AND WHAT IT DOES NOT. Production carries **ZERO
 * FaceBlock guests** (measured 2026-09-16: 118 live guests, 0
 * `faceblock_enabled`, 0 `face_recognition_excluded`, 0 withdrawn
 * `photo_consent`). Every FaceBlock assertion below therefore runs against rows
 * this file SEEDS. A green means **"the two gates give the same answer"**; it
 * does NOT mean any real guest is protected today, because there is not yet a
 * real guest to protect. The POSITIVE CONTROL at the top exists so a green also
 * cannot mean *"the fixture can never show anything anyway"* — it proves the
 * same capture, on the same event, IS served unblurred until FaceBlock goes on.
 *
 * 🔓 ONE DELIBERATE DIVERGENCE IS PINNED RATHER THAN HIDDEN — a soft-deleted
 * guest who withdrew consent. See its test for why it is an open owner
 * question and not a bug to fix here.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import type { createAdminClient } from '@/lib/supabase/admin';
import {
  loadConsentVetoedPapicIds,
  publicKeyForCapture,
} from '@/app/[slug]/_components/editorial/consent-veto';

let replay: ReplayResult;
let db: PGlite;

type AdminClient = ReturnType<typeof createAdminClient>;

const F = {
  eventId: '',
  userId: '',
  seatId: '',
  faceblocker: '', // a guest who will switch FaceBlock on
  withdrawn: '', // a guest who withdrew photo consent, still live
  gone: '', // a guest who withdrew AND was soft-deleted
  plain: '', // a guest who consented
};

/**
 * A PostgREST-shaped client compiled onto PGlite — enough of the builder for
 * `consent-veto.ts` to run unmodified. Anything the gate calls that is not
 * implemented here THROWS rather than silently returning nothing, because a
 * quietly-empty result is indistinguishable from "nothing needs blurring",
 * which is the exact failure this whole file is about.
 */
function pgliteAdmin(): AdminClient {
  type Filter = { sql: string; params: unknown[] };

  const build = (table: string) => {
    let columns = '*';
    const wheres: Filter[] = [];
    let limit: number | null = null;

    const builder: Record<string, unknown> = {
      select(cols: string) {
        columns = cols;
        return builder;
      },
      eq(col: string, v: unknown) {
        wheres.push({ sql: `${col} = ?`, params: [v] });
        return builder;
      },
      is(col: string, v: unknown) {
        if (v !== null) throw new Error(`.is(${col}, ${String(v)}) unsupported in this stub`);
        wheres.push({ sql: `${col} IS NULL`, params: [] });
        return builder;
      },
      not(col: string, op: string, v: unknown) {
        if (op !== 'is' || v !== null) throw new Error(`.not(${col}, ${op}) unsupported`);
        wheres.push({ sql: `${col} IS NOT NULL`, params: [] });
        return builder;
      },
      in(col: string, vals: readonly unknown[]) {
        if (vals.length === 0) wheres.push({ sql: 'FALSE', params: [] });
        else wheres.push({ sql: `${col} IN (${vals.map(() => '?').join(',')})`, params: [...vals] });
        return builder;
      },
      limit(n: number) {
        limit = n;
        return builder;
      },
      order() {
        return builder;
      },
      async then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
        try {
          const params: unknown[] = [];
          const clauses = wheres.map((w) => {
            let sql = w.sql;
            for (const p of w.params) {
              params.push(p);
              sql = sql.replace('?', `$${params.length}`);
            }
            return sql;
          });
          const q =
            `SELECT ${columns} FROM public.${table}` +
            (clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '') +
            (limit === null ? '' : ` LIMIT ${limit}`);
          const r = await db.query<Record<string, unknown>>(q, params);
          return resolve({ data: r.rows, error: null });
        } catch (e) {
          return resolve({ data: null, error: e });
        }
      },
    };
    return builder;
  };

  return {
    from: (t: string) => build(t),
    async rpc(fn: string, args: Record<string, unknown>) {
      if (fn !== 'papic_event_blurs_every_capture') {
        throw new Error(`unexpected rpc ${fn} — this stub answers only the blur arm`);
      }
      try {
        const r = await db.query<{ v: boolean }>(
          `SELECT public.papic_event_blurs_every_capture($1) AS v`,
          [args.p_event_id],
        );
        return { data: r.rows[0]!.v, error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    },
  } as unknown as AdminClient;
}

/** What the WALL's shared predicate says about one capture. */
async function sqlNeedsBlur(sourceTable: string, id: string): Promise<boolean> {
  const r = await db.query<{ v: boolean }>(
    `SELECT public.papic_capture_needs_blur($1,$2,$3) AS v`,
    [F.eventId, sourceTable, id],
  );
  return r.rows[0]!.v === true;
}

/** What the RECAP's gate serves for one capture, given its original key. */
async function recapKeyFor(id: string, originalKey: string): Promise<string | null> {
  const veto = await loadConsentVetoedPapicIds(pgliteAdmin(), F.eventId);
  assert.equal(veto.failed, false, 'the recap veto failed to resolve — the stub or the schema is wrong');
  return publicKeyForCapture(veto, id, originalKey);
}

async function newPhoto(opts: { baked: boolean; clip?: boolean }): Promise<string> {
  const n = Math.abs(Number(process.hrtime.bigint() % 1000000n));
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, moderation_state, photo_type,
        faceblock_baked_at, safe_display_r2_key)
     VALUES ($1,$2,$3,'clean',$4,$5,$6) RETURNING photo_id`,
    [
      F.eventId,
      F.seatId,
      `event/papic/${n}.jpg`,
      opts.clip ? 'clip' : 'photo',
      opts.baked ? new Date().toISOString() : null,
      opts.baked ? `r2://safe/${n}.avif` : null,
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

async function setFaceBlock(on: boolean): Promise<void> {
  await db.query(`UPDATE public.guests SET faceblock_enabled = $2 WHERE guest_id = $1`, [
    F.faceblocker,
    on,
  ]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('recap-blur@test.local', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  F.userId = u.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Recap Blur Agreement', 'birthday', CURRENT_DATE) RETURNING event_id`,
  );
  F.eventId = e.rows[0]!.event_id;

  const s = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats
       (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1,$2,1,'PAPIC_CAMERA_MINI_DAY','tok-recap-blur') RETURNING seat_id`,
    [F.eventId, F.userId],
  );
  F.seatId = s.rows[0]!.seat_id;

  const mk = async (name: string, consent: boolean, deleted = false) => {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests
         (event_id, first_name, last_name, side, group_category, role, rsvp_status,
          meal_preference, invited_to_blocks, entry_source, photo_consent, deleted_at)
       VALUES ($1,$2,'Guest','both','other','guest','attending','no_preference',
               ARRAY['ceremony','reception'],'host_seeded',$3,$4)
       RETURNING guest_id`,
      [F.eventId, name, consent, deleted ? new Date().toISOString() : null],
    );
    return g.rows[0]!.guest_id;
  };
  F.faceblocker = await mk('Blocks', true);
  F.withdrawn = await mk('Withdrew', false);
  F.gone = await mk('WithdrewThenRemoved', false, true);
  F.plain = await mk('Consented', true);
});

after(async () => {
  await db?.close();
});

// ── THE POSITIVE CONTROL ────────────────────────────────────────────────────

test('POSITIVE CONTROL — an untouched capture is served UNBLURRED by both sides', async () => {
  // Without this, every assertion below could be green because the fixture can
  // never show a photograph at all. Production has 0 FaceBlock guests, so the
  // FaceBlock arm is exercised ONLY by rows this file seeds — which makes the
  // "it can show something" half of the proof load-bearing, not decorative.
  await setFaceBlock(false);
  const p = await newPhoto({ baked: false });
  await tag(p, F.plain);

  assert.equal(await sqlNeedsBlur('papic_photos', p), false, 'the wall predicate already wants a blur');
  assert.equal(
    await recapKeyFor(p, 'r2://media/control.jpg'),
    'r2://media/control.jpg',
    'the recap already withholds — a later null would prove nothing',
  );
});

// ── THE ARM THIS PR ADDS ────────────────────────────────────────────────────

test('FaceBlock: the wall predicate and the recap gate agree on EVERY capture', async () => {
  await setFaceBlock(false);
  const tagged = await newPhoto({ baked: false });
  await tag(tagged, F.plain);
  const untagged = await newPhoto({ baked: false }); // nobody is tagged in this one
  const bakedStill = await newPhoto({ baked: true });

  // Before: all three are visible and none needs a blur. The state the recap
  // used to be stuck in even after FaceBlock went on.
  for (const id of [tagged, untagged, bakedStill]) {
    assert.equal(await sqlNeedsBlur('papic_photos', id), false);
    assert.notEqual(await recapKeyFor(id, `r2://media/${id}.jpg`), null);
  }

  await setFaceBlock(true);

  // After: event-wide. The predicate says blur for all three — including the
  // capture nobody is tagged in, which is the whole meaning of "event-wide" —
  // and the recap now says the same thing about all three.
  for (const id of [tagged, untagged, bakedStill]) {
    assert.equal(
      await sqlNeedsBlur('papic_photos', id),
      true,
      `the wall predicate stopped blurring ${id} under FaceBlock`,
    );
    assert.notEqual(
      await recapKeyFor(id, `r2://media/${id}.jpg`),
      `r2://media/${id}.jpg`,
      `THE DEFECT IS BACK: the public recap served the ORIGINAL of ${id} on a FaceBlock event`,
    );
  }

  // And blur-and-KEEP still holds where a real bake exists: the baked still is
  // shown blurred rather than withheld, while the un-baked two are withheld.
  assert.match(String(await recapKeyFor(bakedStill, 'r2://media/x.jpg')), /^r2:\/\/safe\//);
  assert.equal(await recapKeyFor(tagged, 'r2://media/x.jpg'), null);
  assert.equal(await recapKeyFor(untagged, 'r2://media/x.jpg'), null);

  await setFaceBlock(false);
});

test('FaceBlock: a CLIP is dropped — there is no video blur to fall back to', async () => {
  const clip = await newPhoto({ baked: true, clip: true });
  await setFaceBlock(true);
  assert.equal(await sqlNeedsBlur('papic_photos', clip), true);
  assert.equal(
    await recapKeyFor(clip, 'r2://media/clip.mp4'),
    null,
    'a clip was served under FaceBlock — nothing blurs video',
  );
  await setFaceBlock(false);
});

// ── THE ARM THAT ALREADY EXISTED, RE-MEASURED AGAINST THE SAME PREDICATE ────

test('withdrawn consent: both sides blur the tagged capture and only that one', async () => {
  await setFaceBlock(false);
  const hers = await newPhoto({ baked: true });
  await tag(hers, F.withdrawn);
  const someone_elses = await newPhoto({ baked: true });
  await tag(someone_elses, F.plain);

  assert.equal(await sqlNeedsBlur('papic_photos', hers), true);
  assert.match(String(await recapKeyFor(hers, 'r2://media/hers.jpg')), /^r2:\/\/safe\//);

  assert.equal(await sqlNeedsBlur('papic_photos', someone_elses), false);
  assert.equal(
    await recapKeyFor(someone_elses, 'r2://media/theirs.jpg'),
    'r2://media/theirs.jpg',
    'the withdrawal arm went event-wide — it is per-photo, via tags',
  );
});

test('🔓 THE ONE KNOWN DIVERGENCE, PINNED — a soft-deleted guest who withdrew', async () => {
  // The recap's withdrawal arm filters `deleted_at IS NULL`; the SQL predicate
  // does NOT (the 2026-08-24 changelog refused to add one because it would
  // WIDEN what projects while looking like a tidy-up). So removing an
  // opted-out guest lifts the recap's veto but not the wall's.
  //
  // `app/dashboard/[eventId]/guests/[guestId]/actions.ts` already says this in
  // the product's own words — *"REMOVING A GUEST CAN MAKE PHOTOGRAPHS PUBLIC
  // AGAIN… Whether that is the right rule is a question for the owner and is
  // NOT changed here"*. It is not decided here either. It is ASSERTED, so that
  // it cannot change in either direction without this test going red, and so
  // that the next reader finds a measurement rather than a surprise.
  await setFaceBlock(false);
  const p = await newPhoto({ baked: true });
  await tag(p, F.gone);

  assert.equal(await sqlNeedsBlur('papic_photos', p), true, 'the wall still blurs for a removed guest');
  assert.equal(
    await recapKeyFor(p, 'r2://media/gone.jpg'),
    'r2://media/gone.jpg',
    'the recap still serves the original for a removed guest',
  );
});

test('the divergence is EXACTLY ONE — every other capture in this fixture agrees', async () => {
  // 🔑 THE GUARD. Not "this file is correct" but "the two sides cannot hold
  // different answers". Every capture seeded above is asked of BOTH gates and
  // the disagreements are counted. A new way for the recap to fall behind the
  // wall — a FaceBlock arm made per-photo, an event-wide check flipped, an arm
  // returning false — lands here as a count that is no longer 1.
  await setFaceBlock(true);

  const all = await db.query<{ photo_id: string; photo_type: string }>(
    `SELECT photo_id, photo_type FROM public.papic_photos WHERE event_id = $1`,
    [F.eventId],
  );
  assert.ok(all.rows.length >= 8, `the fixture shrank to ${all.rows.length} captures — it can no longer fail`);

  const veto = await loadConsentVetoedPapicIds(pgliteAdmin(), F.eventId);
  assert.equal(veto.failed, false);

  const disagreed: string[] = [];
  for (const row of all.rows) {
    const wall = await sqlNeedsBlur('papic_photos', row.photo_id);
    const original = `r2://media/${row.photo_id}.jpg`;
    const recap = publicKeyForCapture(veto, row.photo_id, original) !== original;
    if (wall !== recap) disagreed.push(row.photo_id);
  }
  assert.equal(
    disagreed.length,
    0,
    `under FaceBlock the two gates disagreed about ${disagreed.length} capture(s): ${disagreed.join(', ')}`,
  );

  // Now with FaceBlock off, where the only remaining reason is withdrawal — and
  // where the soft-deleted guest is the single documented divergence.
  await setFaceBlock(false);
  const veto2 = await loadConsentVetoedPapicIds(pgliteAdmin(), F.eventId);
  const off: string[] = [];
  for (const row of all.rows) {
    const wall = await sqlNeedsBlur('papic_photos', row.photo_id);
    const original = `r2://media/${row.photo_id}.jpg`;
    const recap = publicKeyForCapture(veto2, row.photo_id, original) !== original;
    if (wall !== recap) off.push(row.photo_id);
  }
  assert.equal(
    off.length,
    1,
    `expected exactly the soft-deleted-guest divergence, got ${off.length}: ${off.join(', ')}`,
  );
});
