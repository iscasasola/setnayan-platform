/**
 * A CARD CANNOT GO LIVE WITHOUT A NAME — proved against a real schema.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Measured in production 2026-09-10: `count(*) FILTER (WHERE title IS NULL)` on
 * `vendor_services` is **2 of 2**, both `is_active = true`. A couple browsing
 * reads the bare kind where the shop's name for that service should be.
 *
 * ── WHY THE FENCE IS IN THE DATABASE ───────────────────────────────────────
 * Read out of production by the object: `authenticated` holds UPDATE on BOTH
 * `title` and `is_active`, and the table carries a "this row is yours" policy —
 * so a shop can PATCH a live card's title to NULL through PostgREST and meet no
 * TypeScript. And `save_vendor_service` (SECURITY DEFINER) writes
 * `title = NULLIF(p_fields->>'title', '')`, so any payload omitting the key
 * BLANKS the column. Both of those routes end here.
 *
 * ── WHY THIS TEST IS MEANINGFUL IN THE REPLAY ──────────────────────────────
 * The PGlite replay runs as superuser and `relrowsecurity` is vacuous in it, so
 * a POLICY assertion here can pass for the wrong reason. A TRIGGER is not a
 * policy: it fires for every role, superuser included. What passes here passes
 * in production for the same reason.
 *
 * ⚠ EVERY CASE ASSERTS A VALUE. "The title was filled" and "the row was never
 * written" are indistinguishable from a row count.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;

/** Verified → the name is public ("open it up", owner 2026-07-22). */
const SHOP_OPEN = '22222222-2222-4222-8222-222222222221';
/** Unverified and never replied → hybrid anonymity hides the name. */
const SHOP_HIDDEN = '22222222-2222-4222-8222-222222222222';
const PERK = 'One extra set, free';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    // `vendor_profiles_verified_requires_stamp` — a shop carrying the public
    // Verified badge must record WHEN it was verified. Seeding without the
    // stamp is the exact shape that constraint exists to refuse.
    `INSERT INTO vendor_profiles (vendor_profile_id, business_name, verification_state, last_verified_at)
     VALUES ($1, 'Saysay Live Band', 'verified', NOW())
     ON CONFLICT (vendor_profile_id) DO NOTHING`,
    [SHOP_OPEN],
  );
  await db.query(
    `INSERT INTO vendor_profiles (vendor_profile_id, business_name, verification_state)
     VALUES ($1, 'A Shop Nobody Has Met', 'unverified')
     ON CONFLICT (vendor_profile_id) DO NOTHING`,
    [SHOP_HIDDEN],
  );
  await db.query(
    `INSERT INTO canonical_service_schemas (canonical_service, display_name_en)
     VALUES ('live_band', 'Wedding Bands (full ensemble)')
     ON CONFLICT (canonical_service) DO UPDATE SET display_name_en = EXCLUDED.display_name_en`,
  );
});
after(async () => {
  await db?.close();
});

async function titleOf(id: string): Promise<string | null> {
  const r = await db.query<{ title: string | null }>(
    'SELECT title FROM vendor_services WHERE vendor_service_id = $1',
    [id],
  );
  assert.equal(r.rows.length, 1, 'the row under test does not exist — the case proved nothing');
  return r.rows[0]?.title ?? null;
}

/** Insert a live card and hand back its id. `title` of `null` means blank. */
async function liveCard(
  shop: string,
  category: string,
  title: string | null,
): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, title, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, $2, $3, 35000, $4, TRUE, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT vendor_service_id FROM s`,
    [shop, category, title, PERK],
  );
  const id = r.rows[0]?.vendor_service_id;
  assert.ok(id, 'the insert returned no row');
  return id as string;
}

test('a card published with no name is NAMED, not refused', async () => {
  const id = await liveCard(SHOP_OPEN, 'live_band', null);
  assert.equal(await titleOf(id), 'Wedding Bands (full ensemble) by Saysay Live Band');
});

test('a blank string is treated exactly like NULL', async () => {
  const id = await liveCard(SHOP_OPEN, 'live_band', '   ');
  assert.equal(await titleOf(id), 'Wedding Bands (full ensemble) by Saysay Live Band');
});

test("the supplier's own words are never overwritten", async () => {
  const id = await liveCard(SHOP_OPEN, 'live_band', 'Our Six-Piece Reception Set');
  assert.equal(await titleOf(id), 'Our Six-Piece Reception Set');
});

test('un-naming a live card through a raw UPDATE re-names it — the PostgREST route', async () => {
  // This is the exact shape `save_vendor_service` produces on every UPDATE whose
  // payload omits `title`, and the shape a signed-in shop can PATCH directly.
  const id = await liveCard(SHOP_OPEN, 'live_band', 'Our Six-Piece Reception Set');
  await db.query('UPDATE vendor_services SET title = NULL WHERE vendor_service_id = $1', [id]);
  assert.equal(
    await titleOf(id),
    'Wedding Bands (full ensemble) by Saysay Live Band',
    'a live card was left nameless by a direct write',
  );
});

test('a hidden shop is named by its kind — its real name is NOT published', async () => {
  const id = await liveCard(SHOP_HIDDEN, 'live_band', null);
  const title = await titleOf(id);
  assert.equal(title, 'Wedding Bands (full ensemble)');
  assert.ok(
    !(title ?? '').includes('A Shop Nobody Has Met'),
    'an unverified shop’s real business name was published into a card title AND frozen there',
  );
});

test('once that shop replies, its next nameless card carries the name', async () => {
  await db.query(
    'UPDATE vendor_profiles SET name_revealed_at = NOW() WHERE vendor_profile_id = $1',
    [SHOP_HIDDEN],
  );
  const id = await liveCard(SHOP_HIDDEN, 'live_band', null);
  assert.equal(
    await titleOf(id),
    'Wedding Bands (full ensemble) by A Shop Nobody Has Met',
    'the reveal signal is not read at all — the anonymity test is a constant',
  );
  await db.query(
    'UPDATE vendor_profiles SET name_revealed_at = NULL WHERE vendor_profile_id = $1',
    [SHOP_HIDDEN],
  );
});

test('host_mc is named from the taxonomy tree — "Host / MC", not "Host Mc" (H2)', async () => {
  // `host_mc` is one of the two live production kinds and it has NO row in
  // `canonical_service_schemas` (measured 2026-09-10) — so until H2 it fell to
  // the humanised key and a blank host card read "Host Mc by …". The taxonomy
  // tree already said "Host / MC" (`service_categories.label_en`, the label the
  // app's own tiles use), and the name now reads it (migration 20271222415682).
  const id = await liveCard(SHOP_OPEN, 'host_mc', null);
  const title = await titleOf(id);
  assert.equal(title, 'Host / MC by Saysay Live Band');
  assert.ok(!(title ?? '').includes('host_mc'), 'a raw database key reached a card title');
});

test('a kind with no taxonomy row at all is HUMANISED, never printed as a key', async () => {
  const id = await liveCard(SHOP_OPEN, 'a_kind_nobody_mapped', null);
  const title = await titleOf(id);
  assert.equal(title, 'A Kind Nobody Mapped by Saysay Live Band');
  assert.ok(!(title ?? '').includes('a_kind_nobody_mapped'), 'a raw database key reached a card title');
});

test('the name is clamped to the 80 every other writer uses', async () => {
  const long = 'x'.repeat(120);
  await db.query(
    `INSERT INTO canonical_service_schemas (canonical_service, display_name_en)
     VALUES ('a_very_long_kind', $1)
     ON CONFLICT (canonical_service) DO UPDATE SET display_name_en = EXCLUDED.display_name_en`,
    [long],
  );
  const id = await liveCard(SHOP_OPEN, 'a_very_long_kind', null);
  assert.equal((await titleOf(id))?.length, 80);
});

test('a draft is named too — the owner’s rule is about SAVING, not publishing', async () => {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (vendor_profile_id, category, title, is_active)
     VALUES ($1, 'live_band', NULL, FALSE)
     RETURNING vendor_service_id`,
    [SHOP_OPEN],
  );
  assert.equal(
    await titleOf(r.rows[0]?.vendor_service_id as string),
    'Wedding Bands (full ensemble) by Saysay Live Band',
  );
});

test('⛔ the publish gate still refuses an unpriced card — naming disarmed nothing', async () => {
  let refusal: string | null = null;
  try {
    await db.query(
      `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, title, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, 'live_band', NULL, NULL, $2, TRUE, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
      [SHOP_OPEN, PERK],
    );
  } catch (e) {
    refusal = (e as Error).message;
  }
  assert.match(
    refusal ?? '',
    /Set a starting price before you publish this card/,
    'the sibling publish gate stopped refusing an unpriced publish',
  );
});
