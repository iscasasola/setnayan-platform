/**
 * THE INSPIRATION POOL SHOWS ONLY WHAT WAS SHARED — proven against Postgres.
 *
 * MB9 turns kept renders into reference photos other couples can browse. Four
 * ways that could quietly become a leak, and every one of them renders
 * identically to a working pool:
 *
 *   1. a render whose event NEVER CONSENTED shows up. Consent is MB8's, is
 *      per-event, and gates publication — a pool that ignored it would publish
 *      creations nobody offered, and the couple would have no way to see that
 *      it had happened.
 *   2. a render an admin QUARANTINED (`reuse_blocked`) shows up. `reusable` is
 *      GENERATED over that flag, so `WHERE r.reusable` is the whole withdrawal
 *      mechanism; drop it and the quarantine handle stops meaning anything
 *      while still appearing to work.
 *   3. a NOTE-BEARING render shows up. `reusable` requires `note IS NULL` and
 *      that is the privacy boundary — "my lola's veil on the chair" shaped the
 *      image and must never be offered to a stranger.
 *   4. an UNWATERMARKED render shows up. The pool selects `gallery_image_key`,
 *      which only the watermarker's writer fills, so a render with no marked
 *      copy is not in the partial index at all.
 *
 * 🔑 EACH IS A SEPARATE, INDEPENDENTLY DROPPABLE PREDICATE, and this file
 * constructs the row that ONLY that predicate rejects. Deleting any one of them
 * leaves the others green — which is exactly why "one query, many predicates"
 * needs a row per predicate rather than one happy path.
 *
 * ⛔ AND THE CACHE IS NOT HERE. No test below reads `config_digest`, because
 * nothing matches on it any more (owner 2026-09-03: "always charge for
 * renders"). The pool is a reference library, not a substitute output.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `mb9-${(seq += 1)}`;

async function newCouple(): Promise<{ userId: string; eventId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@example.test`],
  );
  const userId = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`,
    [uniq()],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`,
    [eventId, userId],
  );
  return { userId, eventId };
}

/** A delivered render, with the design snapshot the pool samples colours from. */
async function newRender(
  eventId: string,
  opts: { note?: string | null; palette?: string[] } = {},
): Promise<string> {
  const palette = opts.palette ?? ['#a83f2b', '#f2e6d8', '#3d4a3a'];
  const r = await db.query<{ render_id: string }>(
    `INSERT INTO public.event_renders
       (event_id, part_id, image_key, design_snapshot, prompt, config_digest, note)
     VALUES ($1,'room:ceiling',$2,
             jsonb_build_object('role_palette', jsonb_build_object('reception', $3::jsonb)),
             'a stylist brief','v1:abc',$4)
     RETURNING render_id`,
    [
      eventId,
      `renders/${eventId}/${uniq()}.png`,
      JSON.stringify(palette),
      opts.note ?? null,
    ],
  );
  return r.rows[0]!.render_id;
}

async function consent(eventId: string, consented = true): Promise<void> {
  await db.query(
    `INSERT INTO public.event_render_share_consent (event_id, consented, consented_at)
     VALUES ($1,$2, CASE WHEN $2 THEN NOW() ELSE NULL END)
     ON CONFLICT (event_id) DO UPDATE
       SET consented = EXCLUDED.consented,
           consented_at = CASE WHEN EXCLUDED.consented THEN NOW()
                               ELSE event_render_share_consent.consented_at END`,
    [eventId, consented],
  );
}

/** Attach a watermarked gallery copy through the ONE writer that may. */
async function attachGalleryCopy(renderId: string, uid: string): Promise<boolean> {
  await setAuthUid(db, uid);
  const res = await db.query<{ ok: boolean }>(
    `SELECT public.moodboard_attach_gallery_copy($1,$2) AS ok`,
    [renderId, `render-gallery/${renderId}.jpg`],
  );
  return res.rows[0]!.ok;
}

async function poolFor(eventId: string, uid: string) {
  await setAuthUid(db, uid);
  const res = await db.query<{
    render_id: string;
    gallery_image_key: string;
    swatches: string[];
    total_count: string;
  }>(`SELECT * FROM public.moodboard_inspiration_pool($1, NULL, 24, 0, NULL)`, [eventId]);
  return res.rows;
}

/* ── the shape of a working pool, so every refusal below is measured against
      something that really does appear ──────────────────────────────────── */

test('a consented, watermarked, note-free render reaches another couple', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await consent(sharer.eventId);
  assert.equal(await attachGalleryCopy(renderId, sharer.userId), true);

  const rows = await poolFor(browser.eventId, browser.userId);
  const hit = rows.find((r) => r.render_id === renderId);
  assert.ok(hit, 'a shared render must be browsable by another couple');
  // The WATERMARKED key, and the couple's own unmarked `image_key` is not even
  // a column of this function's result.
  assert.match(hit.gallery_image_key, /^render-gallery\//);
  assert.deepEqual(hit.swatches, ['#a83f2b', '#f2e6d8', '#3d4a3a']);
});

test('predicate 1 — a render whose event never consented is NOT in the pool', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);
  // No consent row at all — the JOIN alone excludes it.
  assert.equal(await attachGalleryCopy(renderId, sharer.userId), true);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    false,
  );

  // And an explicit NO is refused just as firmly as an unanswered one.
  await consent(sharer.eventId, false);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    false,
  );

  // Withdrawal is not a one-way street either: saying yes admits it.
  await consent(sharer.eventId, true);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    true,
  );
});

test('predicate 2 — an admin-quarantined render leaves the pool, and its own gallery survives', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await consent(sharer.eventId);
  await attachGalleryCopy(renderId, sharer.userId);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    true,
  );

  // `reuse_blocked` is the ONLY withdrawal handle — `reusable` is GENERATED and
  // refuses a direct write, so there is no second flag to disagree with it.
  await db.query(`UPDATE public.event_renders SET reuse_blocked = TRUE WHERE render_id = $1`, [
    renderId,
  ]);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    false,
  );

  // The couple's own copy is untouched — quarantine withdraws from the pool,
  // it does not delete a photograph they paid for.
  const own = await db.query<{ image_key: string | null }>(
    `SELECT image_key FROM public.event_renders WHERE render_id = $1`,
    [renderId],
  );
  assert.ok(own.rows[0]!.image_key);
});

test('predicate 3 — a note-bearing render is never offered to a stranger', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId, {
    note: "my lola's veil on the chair",
  });
  await consent(sharer.eventId);
  await attachGalleryCopy(renderId, sharer.userId);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    false,
  );
});

test('predicate 4 — a render with no WATERMARKED copy is not in the pool', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await consent(sharer.eventId);
  // Deliberately no attach: the bytes were never marked.
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    false,
  );

  // 🔑 AND THE COLUMN CANNOT BE FILLED WITHOUT GOING THROUGH THE WRITER.
  // `authenticated` holds no UPDATE on event_renders, so the only way a key
  // lands there is the function that runs immediately after the watermarker.
  assert.equal(await attachGalleryCopy(renderId, sharer.userId), true);
  assert.equal(
    (await poolFor(browser.eventId, browser.userId)).some((r) => r.render_id === renderId),
    true,
  );
});

test('a failed render is not a library entry, and cannot be given a gallery copy', async () => {
  const sharer = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await db.query(
    `UPDATE public.event_renders SET failed_at = NOW(), failure_reason = 'x' WHERE render_id = $1`,
    [renderId],
  );
  assert.equal(await attachGalleryCopy(renderId, sharer.userId), false);
});

test('the gallery copy is written once — a second attach would orphan the first object', async () => {
  const sharer = await newCouple();
  const renderId = await newRender(sharer.eventId);
  assert.equal(await attachGalleryCopy(renderId, sharer.userId), true);
  await setAuthUid(db, sharer.userId);
  const second = await db.query<{ ok: boolean }>(
    `SELECT public.moodboard_attach_gallery_copy($1,'render-gallery/other.jpg') AS ok`,
    [renderId],
  );
  assert.equal(second.rows[0]!.ok, false);
  const row = await db.query<{ gallery_image_key: string }>(
    `SELECT gallery_image_key FROM public.event_renders WHERE render_id = $1`,
    [renderId],
  );
  assert.equal(row.rows[0]!.gallery_image_key, `render-gallery/${renderId}.jpg`);
});

test("a couple's own renders are not listed back to them as other couples' work", async () => {
  const sharer = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await consent(sharer.eventId);
  await attachGalleryCopy(renderId, sharer.userId);
  assert.equal(
    (await poolFor(sharer.eventId, sharer.userId)).some((r) => r.render_id === renderId),
    false,
  );
});

test('a caller who does not belong to the event gets zero rows, not the pool', async () => {
  const sharer = await newCouple();
  const stranger = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await consent(sharer.eventId);
  await attachGalleryCopy(renderId, sharer.userId);

  // Asking on behalf of an event they are not a member of.
  await setAuthUid(db, stranger.userId);
  const res = await db.query(
    `SELECT * FROM public.moodboard_inspiration_pool($1, NULL, 24, 0, NULL)`,
    [sharer.eventId],
  );
  assert.equal(res.rows.length, 0);
});

test('total_count counts the whole pool, not the page — "Show more" must not stall short', async () => {
  // 🪤 `COUNT(*) OVER ()` is computed before LIMIT, and the picker's paging
  // denominator is that number. If it ever counted only the returned page,
  // `hasMore` would go false after the first six and the rest of the pool would
  // be unreachable with nothing on screen saying so.
  const sharer = await newCouple();
  const browser = await newCouple();
  await consent(sharer.eventId);
  const ids: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const id = await newRender(sharer.eventId);
    await attachGalleryCopy(id, sharer.userId);
    ids.push(id);
  }

  await setAuthUid(db, browser.userId);
  const page = await db.query<{ render_id: string; total_count: string }>(
    `SELECT * FROM public.moodboard_inspiration_pool($1, NULL, 2, 0, NULL)`,
    [browser.eventId],
  );
  assert.equal(page.rows.length, 2, 'the LIMIT must be honoured');
  assert.ok(
    Number(page.rows[0]!.total_count) >= 5,
    `total_count reported ${page.rows[0]!.total_count} for a pool of at least 5`,
  );

  // And the offset really walks: page 2 holds different renders.
  const second = await db.query<{ render_id: string }>(
    `SELECT * FROM public.moodboard_inspiration_pool($1, NULL, 2, 2, NULL)`,
    [browser.eventId],
  );
  const overlap = second.rows.filter((r) => page.rows.some((p) => p.render_id === r.render_id));
  assert.equal(overlap.length, 0, 'paging repeated rows it had already returned');
});

test('the part filter narrows to the slot, and always keeps the whole look', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  await consent(sharer.eventId);
  const ceiling = await newRender(sharer.eventId); // part_id = room:ceiling
  await attachGalleryCopy(ceiling, sharer.userId);

  await setAuthUid(db, browser.userId);
  const matching = await db.query<{ render_id: string }>(
    `SELECT * FROM public.moodboard_inspiration_pool($1, ARRAY['room:ceiling','whole_look'], 24, 0, NULL)`,
    [browser.eventId],
  );
  assert.ok(matching.rows.some((r) => r.render_id === ceiling));

  const elsewhere = await db.query<{ render_id: string }>(
    `SELECT * FROM public.moodboard_inspiration_pool($1, ARRAY['people:bride','whole_look'], 24, 0, NULL)`,
    [browser.eventId],
  );
  assert.equal(elsewhere.rows.some((r) => r.render_id === ceiling), false);
});

/* ── a PICK is a reference, and the database says so ───────────────────────── */

test("a picked render's provenance is unrepresentable-if-missing, in both directions", async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);

  // A render_pick with no source render — a reference that forgot what it
  // references. Refused.
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_inspiration_assets
         (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
          sampled_hex_1,sampled_hex_2,sampled_hex_3,sampled_hex_4,sampled_hex_5,sampled_hex_6)
       VALUES ($1,$2,'ceiling',1,'render_pick','https://x/y.jpg',
               '#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b')`,
      [browser.eventId, browser.userId],
    ),
    /render_pick_has_provenance/,
  );

  // And the reverse: a source render on a row claiming to be an upload.
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_inspiration_assets
         (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
          source_render_id,
          sampled_hex_1,sampled_hex_2,sampled_hex_3,sampled_hex_4,sampled_hex_5,sampled_hex_6)
       VALUES ($1,$2,'ceiling',1,'file_upload','https://x/y.jpg',$3,
               '#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b')`,
      [browser.eventId, browser.userId, renderId],
    ),
    /render_pick_has_provenance/,
  );

  // The honest row lands.
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        source_render_id,
        sampled_hex_1,sampled_hex_2,sampled_hex_3,sampled_hex_4,sampled_hex_5,sampled_hex_6)
     VALUES ($1,$2,'ceiling',1,'render_pick','https://x/y.jpg',$3,
             '#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b')`,
    [browser.eventId, browser.userId, renderId],
  );
});

test('deleting the source render takes its reference tiles with it, and is not BLOCKED by them', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        source_render_id,
        sampled_hex_1,sampled_hex_2,sampled_hex_3,sampled_hex_4,sampled_hex_5,sampled_hex_6)
     VALUES ($1,$2,'ceiling',2,'render_pick','https://x/y.jpg',$3,
             '#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b')`,
    [browser.eventId, browser.userId, renderId],
  );

  // 🔑 THE HALF THAT WAS GOT WRONG FIRST ELSEWHERE. SET NULL onto a column a
  // CHECK constrains makes the FK behave like RESTRICT: nulling would leave
  // source_kind='render_pick' with a NULL id, fail the biconditional, and BLOCK
  // this delete — and since events → event_renders cascades, block the source
  // couple's account deletion too. CASCADE is what keeps erasure possible.
  await db.query(`DELETE FROM public.event_renders WHERE render_id = $1`, [renderId]);
  const left = await db.query(
    `SELECT 1 FROM public.event_inspiration_assets WHERE source_render_id = $1`,
    [renderId],
  );
  assert.equal(left.rows.length, 0);
});

test('picking costs nothing — no credit row exists anywhere on that path', async () => {
  const sharer = await newCouple();
  const browser = await newCouple();
  const renderId = await newRender(sharer.eventId);
  await consent(sharer.eventId);
  await attachGalleryCopy(renderId, sharer.userId);

  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        source_render_id,
        sampled_hex_1,sampled_hex_2,sampled_hex_3,sampled_hex_4,sampled_hex_5,sampled_hex_6)
     VALUES ($1,$2,'ceiling',3,'render_pick','https://x/y.jpg',$3,
             '#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b','#a83f2b')`,
    [browser.eventId, browser.userId, renderId],
  );

  // The picking couple's ledger is untouched — no usage row, no new render row.
  const usage = await db.query(
    `SELECT 1 FROM public.event_render_credit_usage WHERE event_id = $1`,
    [browser.eventId],
  );
  assert.equal(usage.rows.length, 0);
  const renders = await db.query(
    `SELECT 1 FROM public.event_renders WHERE event_id = $1`,
    [browser.eventId],
  );
  assert.equal(renders.rows.length, 0);
});
