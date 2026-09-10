/**
 * A RENDER CREDIT IS SPENT ONCE, AND A NOTE NEVER REACHES ANOTHER COUPLE.
 *
 * The two invariants MB7/MB8/MB9 will lean on, proven against the replayed
 * schema rather than against the migration's own prose. DDL that PARSES is not
 * DDL that BEHAVES: `ugat-schema-claims` already proves these objects exist,
 * which is exactly why it cannot notice that a balance check reads the wrong
 * side of the ledger.
 *
 * ── 1. THE LEDGER ──────────────────────────────────────────────────────────
 * Spend is a counter (`event_render_credit_usage`), not a negative grant row,
 * so `moodboard_reserve_render_credits` has a row to lock. A reserve that would
 * overdraw must return FALSE and spend NOTHING — a partial debit on a refused
 * render is a couple charged for an image they never saw.
 *
 * 🔑 AND A REFUSED READ MUST NOT LOOK LIKE A ZERO BALANCE.
 * `moodboard_render_balance` returns ZERO ROWS to a caller with no business
 * asking. If it returned `0/0/0` instead, a couple who bought the pack would be
 * shown "buy a pack" — the same shape as the guest list that told a couple with
 * 180 names their wedding was empty.
 *
 * ── 2. THE POOL ────────────────────────────────────────────────────────────
 * `event_renders.reusable` is GENERATED. The owner's rule is that a render made
 * with the couple's free-text note is stored but never offered to anyone else,
 * and the note is deliberately excluded from the cache key — so a note-bearing
 * render is the ONE place anything personally-shaped could leak into another
 * couple's results. A settable flag would eventually drift from the note with
 * no visible symptom on either side. These assert that it CANNOT be set at all.
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

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newEvent(name: string, coupleId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`,
    [name],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`,
    [eventId, coupleId],
  );
  return eventId;
}

async function grant(eventId: string, credits: number): Promise<void> {
  await db.query(
    `INSERT INTO public.event_render_credit_grants (event_id, credits, source)
     VALUES ($1,$2,'admin')`,
    [eventId, credits],
  );
}

async function reserve(eventId: string, credits: number): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.moodboard_reserve_render_credits($1,$2) AS ok`,
    [eventId, credits],
  );
  return r.rows[0]!.ok;
}

async function used(eventId: string): Promise<number> {
  const r = await db.query<{ credits_used: number }>(
    `SELECT credits_used FROM public.event_render_credit_usage WHERE event_id = $1`,
    [eventId],
  );
  return Number(r.rows[0]?.credits_used ?? 0);
}

/* ── the price lives in exactly one place ───────────────────────────────── */

test('the one pack is in the catalog, and the catalog is the only place a peso appears', async () => {
  const r = await db.query<{ retail_price_php: string }>(
    `SELECT retail_price_php FROM public.platform_retail_catalog_v2
      WHERE service_code = 'MOODBOARD_RENDER_PACK'`,
  );
  assert.equal(r.rows.length, 1, 'the render pack SKU must exist');

  // The config row points AT the catalog rather than copying the price. A
  // second peso figure is the defect this shape exists to make impossible —
  // asserted structurally, not by reading the number (the owner may reprice at
  // any time and this test must not need editing when he does).
  const cfg = await db.query<{
    credits_per_part: number;
    credits_whole_look: number;
    credits_per_pack: number;
    pack_service_code: string;
  }>(`SELECT credits_per_part, credits_whole_look, credits_per_pack, pack_service_code
        FROM public.moodboard_render_config WHERE config_key = 'default'`);
  assert.equal(cfg.rows.length, 1);
  assert.equal(cfg.rows[0]!.pack_service_code, 'MOODBOARD_RENDER_PACK');
  // The whole look must cost MORE than a part and LESS than rendering every
  // part singly, or the pricing stops being the value play the owner designed.
  assert.ok(cfg.rows[0]!.credits_whole_look > cfg.rows[0]!.credits_per_part);

  const priceCols = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moodboard_render_config'
        AND (column_name LIKE '%php%' OR column_name LIKE '%price%')`,
  );
  assert.equal(priceCols.rows[0]!.n, 0, 'the config must hold no peso figure of its own');
});

/* ── the ledger ─────────────────────────────────────────────────────────── */

test('a reserve that would overdraw spends NOTHING and says so', async () => {
  const uid = await newUser('overdraw@example.com');
  const eventId = await newEvent('Overdraw', uid);

  // Broke: no grant at all.
  assert.equal(await reserve(eventId, 1), false, 'an ungranted event cannot render');
  assert.equal(await used(eventId), 0);

  await grant(eventId, 5);
  assert.equal(await reserve(eventId, 5), true, 'the whole look fits exactly');
  assert.equal(await used(eventId), 5);

  // One more credit than remains. The refusal must be total: a partial debit
  // here is a couple charged for an image that was never generated.
  assert.equal(await reserve(eventId, 1), false);
  assert.equal(await used(eventId), 5, 'a refused reserve must not move the counter');
});

test('release unwinds a reservation and can never mint credits', async () => {
  const uid = await newUser('release@example.com');
  const eventId = await newEvent('Release', uid);
  await grant(eventId, 3);

  assert.equal(await reserve(eventId, 3), true);
  assert.equal(await used(eventId), 3);

  // The model returned nothing: give the credits back.
  await db.query(`SELECT public.moodboard_release_render_credits($1,$2)`, [eventId, 3]);
  assert.equal(await used(eventId), 0);

  // A double release must clamp at zero rather than hand out free renders.
  await db.query(`SELECT public.moodboard_release_render_credits($1,$2)`, [eventId, 3]);
  assert.equal(await used(eventId), 0, 'release must clamp, not go negative');
  assert.equal(await reserve(eventId, 4), false, 'a double release must not have minted a credit');
});

test('a cache hit costs zero credits and is still allowed when the balance is empty', async () => {
  const uid = await newUser('freehit@example.com');
  const eventId = await newEvent('Free hit', uid);
  // No grant. A library match is free — it must not be gated behind the pack.
  assert.equal(await reserve(eventId, 0), true);
  assert.equal(await used(eventId), 0);
});

test('a refused balance read returns ZERO ROWS, not a zero balance', async () => {
  const owner = await newUser('balance-owner@example.com');
  const stranger = await newUser('balance-stranger@example.com');
  const eventId = await newEvent('Balance', owner);
  await grant(eventId, 50);

  // The member sees the real figures.
  await setAuthUid(db, owner);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  const mine = await db.query<{ credits_granted: number; credits_left: number }>(
    `SELECT credits_granted, credits_left FROM public.moodboard_render_balance($1)`,
    [eventId],
  );
  assert.equal(mine.rows.length, 1);
  assert.equal(Number(mine.rows[0]!.credits_granted), 50);
  assert.equal(Number(mine.rows[0]!.credits_left), 50);

  // Somebody with no business asking gets NOTHING BACK — which a caller can
  // tell apart from "you hold zero". If this returned a row of zeroes, a couple
  // who bought the pack could be shown "buy a pack".
  await setAuthUid(db, stranger);
  const theirs = await db.query(
    `SELECT * FROM public.moodboard_render_balance($1)`,
    [eventId],
  );
  assert.equal(theirs.rows.length, 0, 'a refusal must not be shaped like an answer');

  // And a stranger cannot spend the couple's credits either.
  const spend = await db.query<{ ok: boolean }>(
    `SELECT public.moodboard_reserve_render_credits($1,$2) AS ok`,
    [eventId, 1],
  );
  assert.equal(spend.rows[0]!.ok, false);
  await setAuthUid(db, null);
  assert.equal(await used(eventId), 0);
});

/* ── the pool ───────────────────────────────────────────────────────────── */

async function insertRender(
  eventId: string,
  opts: { note?: string | null; imageKey?: string | null; failed?: boolean } = {},
): Promise<boolean> {
  const r = await db.query<{ reusable: boolean }>(
    `INSERT INTO public.event_renders
       (event_id, part_id, image_key, design_snapshot, prompt, config_digest, note, failed_at)
     VALUES ($1,'room:ceiling',$2,'{}'::jsonb,'a stylist brief','v1:abc123',$3,$4)
     RETURNING reusable`,
    [
      eventId,
      opts.imageKey === undefined ? 'renders/x.jpg' : opts.imageKey,
      opts.note ?? null,
      opts.failed ? new Date().toISOString() : null,
    ],
  );
  return r.rows[0]!.reusable;
}

test('a note-bearing render is stored but can NEVER enter the shared pool', async () => {
  const uid = await newUser('pool@example.com');
  const eventId = await newEvent('Pool', uid);

  assert.equal(await insertRender(eventId), true, 'a plain finished render is reusable');
  assert.equal(
    await insertRender(eventId, { note: "my lola's veil on the chair" }),
    false,
    'a note shaped the image and is excluded from the cache key — it must not be offered to anyone else',
  );
  assert.equal(
    await insertRender(eventId, { imageKey: null }),
    false,
    'there is nothing to serve',
  );
  assert.equal(await insertRender(eventId, { failed: true }), false, 'a failure is not a library entry');

  // reuse_blocked is the admin quarantine, and it flows through the same
  // computed expression rather than being a second, competing flag.
  await db.query(
    `UPDATE public.event_renders SET reuse_blocked = TRUE WHERE note IS NULL AND image_key IS NOT NULL`,
  );
  const blocked = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_renders WHERE event_id = $1 AND reusable`,
    [eventId],
  );
  assert.equal(blocked.rows[0]!.n, 0, 'quarantine must empty the pool for this event');
});

test('`reusable` cannot be written — it is computed, not asserted', async () => {
  const uid = await newUser('generated@example.com');
  const eventId = await newEvent('Generated', uid);
  await insertRender(eventId, { note: 'outdoors, and it might rain' });

  // The whole privacy story rests on this column, so the database must refuse
  // to let anybody set it — including the render pipeline MB8 will write.
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_renders SET reusable = TRUE WHERE event_id = $1`, [eventId]),
    /generated|cannot be used|column/i,
    'a generated column must refuse a direct write',
  );

  const still = await db.query<{ reusable: boolean }>(
    `SELECT reusable FROM public.event_renders WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(still.rows[0]!.reusable, false);
});

test('a blank note is refused, so `note IS NULL` unambiguously means no note', async () => {
  const uid = await newUser('blanknote@example.com');
  const eventId = await newEvent('Blank note', uid);
  // An empty string would sail past `note IS NULL` and quietly re-admit a
  // note-bearing render to the pool.
  await assert.rejects(
    () => insertRender(eventId, { note: '   ' }),
    /event_renders_note_shape/,
  );
});

test('part_id is shape-checked, so a typo cannot become a cache key of its own', async () => {
  const uid = await newUser('partid@example.com');
  const eventId = await newEvent('Part id', uid);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_renders
           (event_id, part_id, image_key, design_snapshot, prompt, config_digest)
         VALUES ($1,'ceiling','renders/x.jpg','{}'::jsonb,'p','v1:abc')`,
        [eventId],
      ),
    /event_renders_part_id_shape/,
    'an un-namespaced part id would collide bride-the-role with bride-the-slot',
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_renders
           (event_id, part_id, image_key, design_snapshot, prompt, config_digest)
         VALUES ($1,'room:ceiling','renders/x.jpg','{}'::jsonb,'p','abc')`,
        [eventId],
      ),
    /event_renders_config_digest_versioned/,
    'an unversioned digest cannot be invalidated by bumping a prefix',
  );
});
