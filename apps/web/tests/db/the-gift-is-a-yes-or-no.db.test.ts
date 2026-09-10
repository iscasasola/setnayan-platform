/**
 * THE SETNAYAN GIFT IS A YES OR A NO — end-to-end, against replayed migrations.
 *
 * Covers 20271216515644_the_gift_is_a_yes_or_no. The sibling unit test
 * (`lib/the-gift-is-a-yes-or-no.test.ts`) reads this migration's SQL as TEXT,
 * which is a PROXY: it proves the statement is written, never that Postgres
 * behaves. These four tests RUN `save_vendor_service` and assert on rows.
 *
 * ⚖ WHY EACH ONE EXISTS — all three are silent failures:
 *
 *   ① A CARD PUBLISHES WITH NO GIFT. The owner ruled the gift optional on
 *      2026-09-09, and migration 20271215941485 moved the publish TRIGGER and
 *      the TypeScript together — but left the RPC's own
 *      `RAISE EXCEPTION 'A Setnayan Exclusive perk is required…'` in place.
 *      `commitVendorService` publishes THROUGH this RPC, so the ruling was
 *      unreachable on the main save path: the trigger said yes and the function
 *      threw first. That is the exact "app says yes, database says no" failure
 *      20271215941485's own docblock warns about.
 *
 *   ② AN ABSENT PERK KEY LEAVES THE STORED TEXT ALONE. The UPDATE branch used
 *      to assign `exclusive_perk_text = v_perk` unconditionally, and v_perk
 *      derives from `p_fields->>'exclusive_perk_text'` — so a payload without
 *      the key wrote NULL. The field is retired as a CONTROL and no surface
 *      submits it any more, so without this rule the FIRST save of either card
 *      live in production on 2026-09-09 would have erased its promise, with no
 *      error and nothing in a log.
 *
 *   ③ A PRESENT KEY STILL SETS OR CLEARS, so retiring the editor did not weld
 *      the field shut for an admin or a later surface.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let vendorProfileId: string;

/** Call the atomic writer the way `commitVendorService` does. */
async function save(
  serviceId: string | null,
  fields: Record<string, unknown>,
  publish: boolean,
): Promise<string> {
  const r = await db.query<{ save_vendor_service: string }>(
    `SELECT public.save_vendor_service(
       $1::uuid, $2::uuid, $3::jsonb,
       '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4::boolean)`,
    [vendorProfileId, serviceId, JSON.stringify(fields), publish],
  );
  return r.rows[0]!.save_vendor_service;
}

async function readCard(id: string) {
  const r = await db.query<{
    exclusive_perk_text: string | null;
    includes_setnayan_gift: boolean;
    is_active: boolean;
  }>(
    `SELECT exclusive_perk_text, includes_setnayan_gift, is_active
       FROM public.vendor_services WHERE vendor_service_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('owner@giftyesno.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Gift Yes No Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;
});

after(async () => {
  await db?.close();
});

// ── ① the ruling is reachable through the RPC ──────────────────────────────

test('a card PUBLISHES with no gift and no perk text at all', async () => {
  const id = await save(
    null,
    { category: 'photography', starting_price_php: 50000 },
    true,
  );
  const card = await readCard(id);
  assert.equal(card.is_active, true, 'the RPC refused to publish a card with no gift');
  assert.equal(card.includes_setnayan_gift, false, 'no gift was asked for');
  assert.equal(card.exclusive_perk_text, null);
});

test('a new card records the yes when the supplier gives one', async () => {
  const id = await save(
    null,
    { category: 'photography', starting_price_php: 50000, includes_setnayan_gift: true },
    true,
  );
  assert.equal((await readCard(id)).includes_setnayan_gift, true);
});

// ── ② the retirement cannot erase a live promise ───────────────────────────

test('an absent perk key leaves a stored promise EXACTLY as it was', async () => {
  // The shape of S89S-GZ6GJB1K5N, live in production on 2026-09-09.
  const id = await save(
    null,
    {
      category: 'live_band',
      starting_price_php: 35000,
      exclusive_perk_text: 'Free 1-hour extension for Setnayan couples',
    },
    true,
  );
  assert.equal(
    (await readCard(id)).exclusive_perk_text,
    'Free 1-hour extension for Setnayan couples',
  );

  // Now save again the way every surface saves TODAY: no perk key at all.
  await save(id, { starting_price_php: 36000, includes_setnayan_gift: false }, true);

  const after = await readCard(id);
  assert.equal(
    after.exclusive_perk_text,
    'Free 1-hour extension for Setnayan couples',
    'the retired free text was erased by a save that never mentioned it',
  );
  assert.equal(after.includes_setnayan_gift, false, 'and it did not become a costed gift');
});

// ── ③ a present key is still authoritative ─────────────────────────────────

test('a present perk key still sets, and still clears', async () => {
  const id = await save(
    null,
    { category: 'host_mc', starting_price_php: 40000, exclusive_perk_text: 'FREE' },
    true,
  );
  assert.equal((await readCard(id)).exclusive_perk_text, 'FREE');

  await save(id, { starting_price_php: 40000, exclusive_perk_text: 'Something else' }, true);
  assert.equal((await readCard(id)).exclusive_perk_text, 'Something else');

  // Blank clears — `NULLIF(btrim(...), '')`, unchanged from the original.
  await save(id, { starting_price_php: 40000, exclusive_perk_text: '   ' }, true);
  assert.equal((await readCard(id)).exclusive_perk_text, null);
});

// ── Only the gift rule was meant to change ────────────────────────────────
// Every definition of save_vendor_service since 20270208451790 refused an
// UPDATE that matched no row. The first cut of the yes/no migration dropped
// that refusal while copying the body, and nothing noticed: the save would
// have written child rows against a NULL id and handed back NULL as if it had
// saved. Restored 2026-09-10; this pins it.
test('a save naming a card this shop does not own is still refused', async () => {
  const other = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('other@giftyesno.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const otherVp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Somebody Else Studio', 'Cebu', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [other.rows[0]!.id],
  );
  const theirs = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, is_active)
     VALUES ($1, 'photography', 25000, FALSE)
     RETURNING vendor_service_id`,
    [otherVp.rows[0]!.vendor_profile_id],
  );
  const theirId = theirs.rows[0]!.vendor_service_id;

  await assert.rejects(
    () => save(theirId, { starting_price_php: 1, includes_setnayan_gift: true }, false),
    /Service not found/,
    'a save against another shop\'s card went through without an error',
  );
  const untouched = await db.query<{ starting_price_php: number; includes_setnayan_gift: boolean }>(
    `SELECT starting_price_php, includes_setnayan_gift FROM public.vendor_services
      WHERE vendor_service_id = $1`,
    [theirId],
  );
  assert.equal(untouched.rows[0]!.starting_price_php, 25000);
  assert.equal(untouched.rows[0]!.includes_setnayan_gift, false);
});
