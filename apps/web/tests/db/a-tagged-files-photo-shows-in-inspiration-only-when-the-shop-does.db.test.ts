/**
 * 🏷 A SUPPLIER TAGS ITS EVENT PHOTOS TO INSPIRATIONS — migration 20271345380761 walked in SQL, as each person.
 * (DECISION_LOG 2026-11-14, "A SUPPLIER TAGS ITS EVENT PHOTOS TO INSPIRATIONS"; prototype
 * `prototypes/inspiration_tags_2026-11-14_fable.html`.)
 *
 * The guards the build was asked to prove:
 *   T1 · tags limited to the card's parts — a part the photo's service card does not offer is refused;
 *   T2 · nothing reaches an inspiration before the shop shows it — an approved tag of a WAITING photo is unreadable
 *        to a visitor and a couple; the couple's yes makes it readable; a Hide takes it off again;
 *   T3 · no duplicate (photo, part) — UNIQUE (event_file_id, asset_subtype);
 *   T4 · no public read of source_event_id — nor of the new event_file_id; the event line is type · venue · month;
 * plus ruling (6): a Files photo removed from the event RETIRES its tags (still on saved boards), never deletes them,
 * and a retired tag never falls back into the pool as a plain upload; and (7) photos only.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await asOwner();
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}
async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
async function oneAs<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  await asUser(uid);
  const r = await db.query<T>(sql, params);
  await asOwner();
  return r.rows[0]!;
}
async function ownerTry(sql: string, params: unknown[] = []): Promise<string> {
  await asOwner();
  return db.query(sql, params).then(
    () => 'ok',
    (e: Error) => `refused: ${e.message}`,
  );
}
const sha = (c: string) => c.repeat(64).slice(0, 64);
const ref = (shop: string, n: string) => `r2://setnayan-thread-files/supplier-files/${shop}/ev/${n}.jpg`;

const F = { host: '', rosa: '', shop: '', ev: '', card: '', service: '', part: '', alsoPart: '', notOffered: '', photo: '', video: '' };

async function readableAs(who: 'anon' | string, assetId: string): Promise<boolean> {
  if (who === 'anon') await asAnon();
  else await asUser(who);
  const r = await db.query(`SELECT asset_id FROM public.moodboard_library_assets WHERE asset_id = $1`, [assetId]);
  await asOwner();
  return r.rows.length === 1;
}

/** A tag as storeScreenedAsset writes it (service role · approved_at NULL · warranted). */
async function tag(fileId: string, part: string): Promise<string> {
  await asOwner();
  const r = await db.query<{ a: string }>(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source, vendor_profile_id, event_file_id, rights_warranted_at, rights_warranty_version)
     VALUES ('supplier_gallery', $1, 'Bouquet', 'moodboard-library/x/' || gen_random_uuid() || '.jpg', 'stylist_upload', $2, $3, now(), 'v1')
     RETURNING asset_id AS a`,
    [part, F.shop, fileId],
  );
  return r.rows[0]!.a;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.host = await signUp('ana@tags.test', 'customer');
  F.rosa = await signUp('rosa@tags.test', 'vendor');
  await asOwner();
  F.shop = (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [F.rosa])).rows[0]!.v;

  // A service that offers at least two parts, and a part it does not offer — read off the seeded table, never typed.
  const svc = (
    await db.query<{ s: string }>(
      `SELECT ps.canonical_service AS s FROM public.inspiration_part_services ps
        JOIN public.inspiration_parts p ON p.slot_key = ps.slot_key AND p.kind = 'part'
       GROUP BY ps.canonical_service HAVING count(*) >= 2 ORDER BY ps.canonical_service LIMIT 1`,
    )
  ).rows[0]!.s;
  F.service = svc;
  const offered = (
    await db.query<{ k: string }>(
      `SELECT ps.slot_key AS k FROM public.inspiration_part_services ps
        JOIN public.inspiration_parts p ON p.slot_key = ps.slot_key AND p.kind = 'part'
       WHERE ps.canonical_service = $1 ORDER BY ps.slot_key LIMIT 2`,
      [svc],
    )
  ).rows.map((r) => r.k);
  F.part = offered[0]!;
  F.alsoPart = offered[1]!;
  F.notOffered = (
    await db.query<{ k: string }>(
      `SELECT p.slot_key AS k FROM public.inspiration_parts p WHERE p.kind = 'part'
          AND NOT EXISTS (SELECT 1 FROM public.inspiration_part_services ps WHERE ps.slot_key = p.slot_key AND ps.canonical_service = $1)
        ORDER BY p.slot_key LIMIT 1`,
      [svc],
    )
  ).rows[0]!.k;

  F.ev = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, venue_name)
       VALUES ('Ana & Miguel', 'wedding', 'catholic', 'banquet_hall', '2027-03-15', 'Makati Shangri-La') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.ev, F.host]);
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [F.ev, F.shop, F.rosa]);
  F.card = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, $2, 'Bridal bouquets', FALSE) RETURNING vendor_service_id AS s`,
      [F.shop, svc],
    )
  ).rows[0]!.s;
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until, service_card_ids)
     VALUES ($1, $2, 'Flowers', 1000000, 'sent', now() + interval '10 days', $3::jsonb)`,
    [F.shop, F.ev, JSON.stringify([F.card])],
  );
  const store = async (c: string, mime: string) =>
    (
      await oneAs<{ m: string }>(
        F.rosa,
        `INSERT INTO public.supplier_media (vendor_profile_id, content_sha256, r2_ref, mime, size_bytes, taken_at)
         VALUES ($1, $2, $3, $4, 1000, '2027-03-15T10:00:00+08:00') RETURNING media_id AS m`,
        [F.shop, sha(c), ref(F.shop, c), mime],
      )
    ).m;
  const file = async (media: string, kind: 'photo' | 'video', name: string) =>
    (
      await oneAs<{ f: string }>(
        F.rosa,
        `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, vendor_service_id, media_id, file_name)
         VALUES ($1, $2, 'service', $3, $4, $5, $6) RETURNING file_id AS f`,
        [F.ev, F.shop, kind, F.card, media, name],
      )
    ).f;
  F.photo = await file(await store('a', 'image/jpeg'), 'photo', 'bouquet-04.jpg');
  F.video = await file(await store('b', 'video/mp4'), 'video', 'walk.mp4');
});
after(async () => {
  await db?.close();
});

test('T1 · a tag is limited to the parts the photo’s service card offers', async () => {
  assert.match(
    await ownerTry(
      `INSERT INTO public.moodboard_library_assets (asset_type, asset_subtype, label, storage_path, source, vendor_profile_id, event_file_id)
       VALUES ('supplier_gallery', $1, 'x', 'moodboard-library/x/t1.jpg', 'stylist_upload', $2, $3)`,
      [F.notOffered, F.shop, F.photo],
    ),
    /does not offer this inspiration/,
    `a tag to ${F.notOffered} landed although the card (${F.service}) does not offer it`,
  );
});

test('(7) photos only — a video in Files gets no tag', async () => {
  assert.match(
    await ownerTry(
      `INSERT INTO public.moodboard_library_assets (asset_type, asset_subtype, label, storage_path, source, vendor_profile_id, event_file_id)
       VALUES ('supplier_gallery', $1, 'x', 'moodboard-library/x/v.jpg', 'stylist_upload', $2, $3)`,
      [F.part, F.shop, F.video],
    ),
    /only a photo filed under a service card/,
  );
});

test('the event and the card are COPIED from the Files photo, never typed', async () => {
  const id = await tag(F.photo, F.alsoPart);
  await asOwner();
  const r = (
    await db.query<{ e: string; s: string }>(
      `SELECT source_event_id AS e, vendor_service_id AS s FROM public.moodboard_library_assets WHERE asset_id = $1`,
      [id],
    )
  ).rows[0]!;
  assert.equal(r.e, F.ev);
  assert.equal(r.s, F.card);
});

test('T3 · one row per (photo, part)', async () => {
  await tag(F.photo, F.part);
  assert.match(
    await ownerTry(
      `INSERT INTO public.moodboard_library_assets (asset_type, asset_subtype, label, storage_path, source, vendor_profile_id, event_file_id)
       VALUES ('supplier_gallery', $1, 'x', 'moodboard-library/x/dup.jpg', 'stylist_upload', $2, $3)`,
      [F.part, F.shop, F.photo],
    ),
    /moodboard_library_assets_one_tag_per_part|duplicate key/,
  );
});

test('T2 · nothing reaches an inspiration before the shop shows it — and a Hide takes it off at once', async () => {
  await asOwner();
  const id = (
    await db.query<{ a: string }>(`SELECT asset_id AS a FROM public.moodboard_library_assets WHERE event_file_id = $1 AND asset_subtype = $2`, [F.photo, F.part])
  ).rows[0]!.a;
  // Checking: not approved → nobody.
  assert.equal(await readableAs('anon', id), false);
  // Approved, but the photo still WAITS on the shop → still nobody (a couple included).
  await db.query(`UPDATE public.moodboard_library_assets SET approved_at = now() WHERE event_file_id = $1`, [F.photo]);
  assert.equal(await readableAs('anon', id), false, 'an approved tag of a WAITING photo was readable by a visitor');
  assert.equal(await readableAs(F.host, id), false, 'an approved tag of a WAITING photo was readable by a couple');
  // The couple says yes → the photo lists on the shop → the tag shows.
  await asUser(F.host);
  await db.query(`SELECT public.couple_decide_supplier_file($1, 'shown')`, [F.photo]);
  await asOwner();
  assert.equal(await readableAs('anon', id), true, 'a tag of a SHOWN photo stayed hidden');
  // The event line: type · venue · month, and the other part it is also in.
  await asAnon();
  const line = (
    await db.query<{ event_type: string; venue_name: string; event_month: string; also_in: string[] }>(
      `SELECT event_type, venue_name, event_month::text AS event_month, also_in FROM public.inspiration_tag_event_lines($1::uuid[])`,
      [[id]],
    )
  ).rows[0]!;
  await asOwner();
  assert.equal(line.event_type, 'wedding');
  assert.equal(line.venue_name, 'Makati Shangri-La');
  assert.equal(line.event_month, '2027-03-01');
  assert.deepEqual(line.also_in, [F.alsoPart]);
  // Hide → gone from the pool at once.
  await asUser(F.host);
  await db.query(`SELECT public.couple_decide_supplier_file($1, 'hidden')`, [F.photo]);
  await asOwner();
  assert.equal(await readableAs('anon', id), false, 'a hidden photo stayed in inspiration');
  await asUser(F.host);
  await db.query(`SELECT public.couple_decide_supplier_file($1, 'shown')`, [F.photo]);
  await asOwner();
});

test('T4 · neither source_event_id nor event_file_id is readable by the public roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const col of ['source_event_id', 'event_file_id']) {
      await asOwner();
      const r = await db.query<{ ok: boolean }>(`SELECT has_column_privilege($1, 'public.moodboard_library_assets', $2, 'SELECT') AS ok`, [role, col]);
      assert.equal(r.rows[0]!.ok, false, `${role} can read ${col}`);
    }
  }
  await asAnon();
  const refused = await db.query(`SELECT event_file_id FROM public.moodboard_library_assets LIMIT 1`).then(
    () => 'ok',
    (e: Error) => e.message,
  );
  await asOwner();
  assert.match(refused, /permission denied/);
});

test('(6) the Files photo removed → its tags are RETIRED (kept for saved boards), never a plain upload', async () => {
  await asOwner();
  const before = await db.query<{ a: string }>(`SELECT asset_id AS a FROM public.moodboard_library_assets WHERE event_file_id = $1`, [F.photo]);
  assert.ok(before.rows.length >= 2);
  await asUser(F.rosa);
  await db.query(`DELETE FROM public.event_supplier_files WHERE file_id = $1`, [F.photo]);
  await asOwner();
  for (const { a } of before.rows) {
    const r = (await db.query<{ retired: boolean; f: string | null }>(`SELECT retired_at IS NOT NULL AS retired, event_file_id AS f FROM public.moodboard_library_assets WHERE asset_id = $1`, [a])).rows[0];
    assert.ok(r, 'a tag row was DELETED with its Files photo — it would cascade off every saved board');
    assert.equal(r.retired, true, 'a tag of a removed photo was not retired');
    assert.equal(r.f, null);
    assert.equal(await readableAs('anon', a), false, 'a removed photo’s tag fell back into the public pool');
  }
});
