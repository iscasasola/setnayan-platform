/**
 * The viewer's own avatar in `public_venue_scene` — END-TO-END (migrations
 * replayed into PGlite, so this exercises the REAL SECURITY DEFINER function,
 * not a transcription of it).
 *
 * `guests.avatar_config` shipped in 20270918210897 and, until 20271186016459,
 * NOTHING read it. These are the claims that make it safe to start:
 *
 *   1. IT ACTUALLY ARRIVES. A token holder who made an avatar gets it back.
 *      (The whole point: an unread column is what this change is fixing.)
 *   2. IT REACHES NOBODY ELSE THROUGH `you`. A tokenless visitor gets no `you`
 *      block at all, and a DIFFERENT guest's token never returns the first
 *      guest's config on `you`.
 *      ⚠ AMENDED 2026-09-06 (C6, owner "build what is not done"): other guests
 *      DO now receive seated avatars — through the separate `avatars` block,
 *      under the couple's `venue_photo_visibility`, exactly as photos travel
 *      (claims 5–7 below). The earlier sentence "the check that would catch an
 *      avatars-for-everyone regression" is retired: everyone-under-'all' is the
 *      product, and the gate is what is guarded now.
 *   3. A GUEST WHO NEVER MADE ONE GETS NULL, not a hash-rolled default. The
 *      server must not invent an avatar; that is the client's fallback to
 *      decline, and it can only decline what arrives as null.
 *   4. IT IS NOT GATED ON `venue_photo_visibility`. That setting governs
 *      showing guests to EACH OTHER; a guest must see themselves under all
 *      three values, including 'none'.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

/** 32 lowercase hex — `guests.qr_token`'s shape. BUILT, not written as a
 *  literal: a 32-char hex string in source reads as a leaked credential to the
 *  secret scanner, and a fixture must not look like one. */
function fakeToken(fill: string): string {
  return fill.repeat(32).slice(0, 32);
}

const SLUG = 'avatar-rpc-test';
const MINE = fakeToken('a1b2');
const THEIRS = fakeToken('c3d4');
const NOBODY = fakeToken('e5f6');

/** A complete, catalog-valid v1 config (lib/chibi-config.ts). */
const CONFIG = {
  v: 1,
  bodyType: 'female',
  skinTone: '#d8a982',
  hairStyle: 'buns',
  hairColor: '#241a12',
  eyes: 'happy',
  mouth: 'smile',
  mark: 'left',
  outfit: 'filipiniana',
  outfitColor: '#c3cdb9',
  accessory: 'flower',
  colorMode: 'custom',
};

type Scene = {
  published: boolean;
  you: { seatNumber: number; avatarConfig: unknown } | null;
  avatars: { table: string; seatNumber: number; config: unknown }[];
};

async function scene(token: string | null): Promise<Scene> {
  const r = await db.query<{ out: Scene }>(
    `SELECT public.public_venue_scene($1, $2) AS out`,
    [SLUG, token],
  );
  return r.rows[0]!.out;
}

async function setPhotoVisibility(v: string): Promise<void> {
  await db.query(
    `UPDATE public.event_floor_plan SET venue_photo_visibility = $2 WHERE event_id = $1`,
    [eventId, v],
  );
}

let eventId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  eventId = (
    await db.query<{ event_id: string }>(
      // A wedding needs ceremony_type + venue_setting together
      // (events_wedding_fields_consistency); the walk reads venue_setting.
      `INSERT INTO public.events (display_name, event_type, slug, ceremony_type, venue_setting)
       VALUES ('Avatar RPC Test', 'wedding', $1, 'civil', 'banquet_hall') RETURNING event_id`,
      [SLUG],
    )
  ).rows[0]!.event_id;

  const table = (
    await db.query<{ table_id: string }>(
      `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity)
       VALUES ($1, 'Table 1', 'round_8', 8) RETURNING table_id`,
      [eventId],
    )
  ).rows[0]!.table_id;

  // Two seated guests at the SAME table — so 'table' visibility would return
  // both of them if the config ever rode the photos-style block by mistake.
  for (const [first, token, cfg] of [
    ['Ana', MINE, JSON.stringify(CONFIG)],
    ['Noa', THEIRS, null],
  ] as const) {
    const g = (
      await db.query<{ guest_id: string }>(
        `INSERT INTO public.guests
           (event_id, first_name, last_name, side, group_category, qr_token, avatar_config)
         VALUES ($1, $2, 'Cruz', 'both', 'friends', $3, $4::jsonb) RETURNING guest_id`,
        [eventId, first, token, cfg],
      )
    ).rows[0]!.guest_id;
    await db.query(
      `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number)
       VALUES ($1, $2, $3, $4)`,
      [eventId, table, g, first === 'Ana' ? 0 : 1],
    );
  }

  // A guest of ANOTHER event, to prove a stray token cannot cross over.
  const other = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, slug, ceremony_type, venue_setting)
       VALUES ('Other', 'wedding', 'avatar-rpc-other', 'civil', 'banquet_hall') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, qr_token, avatar_config)
     VALUES ($1, 'Stray', 'Guest', 'both', 'friends', $2, $3::jsonb)`,
    [other, NOBODY, JSON.stringify(CONFIG)],
  );

  await db.query(
    `INSERT INTO public.event_floor_plan (event_id, published_at, venue_photo_visibility)
     VALUES ($1, NOW(), 'table')
     ON CONFLICT (event_id) DO UPDATE SET published_at = NOW()`,
    [eventId],
  );
});

after(async () => {
  await db?.close?.();
});

// ─── 1. It actually arrives ────────────────────────────────────────────────

test('a token holder who made an avatar gets it back', async () => {
  const s = await scene(MINE);
  assert.equal(s.published, true);
  assert.ok(s.you, 'a valid token must produce a `you` block');
  assert.deepEqual(
    s.you.avatarConfig,
    CONFIG,
    'the stored config must arrive intact — this is the read the column never had',
  );
});

// ─── 2. It reaches nobody else ─────────────────────────────────────────────

test('a tokenless visitor gets no `you` block, so no avatar', async () => {
  const s = await scene(null);
  assert.equal(s.published, true, 'the room itself is still public');
  assert.equal(s.you, null);
});

test("another guest's token never returns the first guest's avatar", async () => {
  // Noa sits at the SAME table as Ana and made no avatar of her own. If the
  // config ever rode a per-seat block, Ana's would surface here.
  const s = await scene(THEIRS);
  assert.ok(s.you, 'Noa holds a valid token');
  assert.equal(s.you.seatNumber, 1, 'and it resolved to Noa, not Ana');
  assert.equal(s.you.avatarConfig, null);
  assert.notDeepEqual(s.you.avatarConfig, CONFIG);
});

test("a token from a DIFFERENT event resolves nothing here", async () => {
  const s = await scene(NOBODY);
  assert.equal(s.you, null);
});

// ─── 3. Never invented ─────────────────────────────────────────────────────

test('a guest who never made one gets NULL, not a hash-rolled default', async () => {
  const s = await scene(THEIRS);
  assert.equal(
    s.you?.avatarConfig,
    null,
    'the server must not invent an avatar — the client can only decline a null',
  );
});

// ─── 4. Not gated on the host's photo setting ──────────────────────────────

test('a guest sees their OWN avatar under every venue_photo_visibility', async () => {
  // 'none' is the one that matters: the couple sharing no guest photos must not
  // hide a guest from themselves.
  for (const vis of ['none', 'table', 'all']) {
    await setPhotoVisibility(vis);
    const s = await scene(MINE);
    assert.deepEqual(
      s.you?.avatarConfig,
      CONFIG,
      `venue_photo_visibility='${vis}' must not hide a guest's own avatar`,
    );
  }
  await setPhotoVisibility('table');
});

// ── C6 · seated avatars for the ROOM, under the photo-visibility gate ────────

test("5. 'table': a token holder sees their tablemates' avatars; a tokenless visitor sees none", async () => {
  await setPhotoVisibility('table');
  const mine = await scene(MINE);
  assert.deepEqual(
    mine.avatars.map((a) => [a.seatNumber, a.config]),
    [[0, CONFIG]],
    'Ana (seat 0) made one; Noa (seat 1) did not and is NOT listed — the server never invents',
  );
  const nobody = await scene(null);
  assert.deepEqual(nobody.avatars, [], 'no token → no table → nobody');
});

test("6. 'all': everyone who made one, to everyone — token or not", async () => {
  await setPhotoVisibility('all');
  const nobody = await scene(null);
  assert.deepEqual(nobody.avatars.map((a) => [a.seatNumber, a.config]), [[0, CONFIG]]);
  const theirs = await scene(THEIRS);
  assert.deepEqual(theirs.avatars.map((a) => [a.seatNumber, a.config]), [[0, CONFIG]], "Noa sees Ana's chibi");
  await setPhotoVisibility('table');
});

test("7. 'none': nobody's avatar travels — but your OWN still does (C5's rule survives)", async () => {
  await setPhotoVisibility('none');
  const mine = await scene(MINE);
  assert.deepEqual(mine.avatars, []);
  assert.deepEqual(mine.you?.avatarConfig, CONFIG, 'you still see yourself under none');
  await setPhotoVisibility('table');
});

test('an unpublished plan returns nothing at all, avatar included', async () => {
  await db.query(`UPDATE public.event_floor_plan SET published_at = NULL WHERE event_id = $1`, [
    eventId,
  ]);
  const s = await scene(MINE);
  assert.equal(s.published, false);
  assert.equal(s.you ?? null, null);
  await db.query(`UPDATE public.event_floor_plan SET published_at = NOW() WHERE event_id = $1`, [
    eventId,
  ]);
});
