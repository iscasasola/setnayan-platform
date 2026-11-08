/**
 * A HELD SHOP NAME HOLDS ITS CORE — "BULGOGI 1" IS REFUSED WHILE "BULGOGI CATERING" IS HELD.
 *
 * Owner, 2026-11-06, verbatim: *"there was a shop named Bulgogi Catering. and the shop was deactivated, banned, or
 * deleted. we have a rule that the name cannot be used for 1 year. then they created Bulgogi 1. that should also not
 * be allowed."* → *"Yes, build it"* (DECISION_LOG 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE").
 *
 * Executed against the FULL replayed schema (migration `20271320018288`):
 *
 *   1. THE CORE (`shop_name_core`) — the owner's examples all reduce to `bulgogi`; a held ADDRESS with no separators
 *      ("bulgogicatering", how every address since 2026-08-09 is minted) reduces to the same core; accents fold with
 *      the address's own pairs; a core under 3 letters, or only trade words, is NULL and holds nothing.
 *   2. THE TRADE WORDS are derived from the taxonomy tables — a category an admin adds today is a trade word today.
 *   3. THE HOLDS (`shop_name_core_hold`): closed (a live `vendor_closed` row), banned and suspended shops each hold
 *      their core; an EXPIRED closed hold does not; a live, normal shop does not; a shop's own rows never hold
 *      against it; an APPROVED "It's my business" claim releases the core for that shop only — an open one does not.
 *   4. THE COUPLE'S LINK (`claim_ready_the_shop`) leaves a held name blank instead of copying it onto a new shop.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

async function core(name: string | null): Promise<string | null> {
  const r = await db.query<{ c: string | null }>(`SELECT public.shop_name_core($1) AS c`, [name]);
  return r.rows[0]!.c;
}

type Hold = { core: string | null; held: boolean; holder_vendor_profile_id: string | null; hold_reason: string | null };
async function hold(name: string, asking: string | null = null): Promise<Hold> {
  const r = await db.query<Hold>(`SELECT * FROM public.shop_name_core_hold($1, $2)`, [name, asking]);
  assert.equal(r.rows.length, 1, 'shop_name_core_hold must always answer with exactly one row');
  return r.rows[0]!;
}

/** A shop the way production makes one: a vendor account (the trigger opens an empty shop), then the name. */
async function shop(name: string): Promise<string> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`core-hold-${seq}@example.test`],
  );
  const v = await db.query<{ id: string }>(
    `SELECT vendor_profile_id AS id FROM public.vendor_profiles WHERE user_id = $1`,
    [u.rows[0]!.id],
  );
  const id = v.rows[0]!.id;
  await db.query(`UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`, [id, name]);
  return id;
}

/** The 2026-08-10 closure hold, exactly as `lib/erasure/purge.ts` writes it. */
async function closeShop(id: string, oldSlug: string, until: string): Promise<void> {
  await db.query(
    `INSERT INTO public.slug_change_log (entity_type, entity_id, old_slug, new_slug, redirect_until)
     VALUES ('vendor_closed', $1, $2, $2, $3::timestamptz)`,
    [id, oldSlug, until],
  );
}

// ── 1 · the core ─────────────────────────────────────────────────────────────

test('the owner’s examples all reduce to the same core: bulgogi', async () => {
  for (const name of [
    'Bulgogi Catering',
    'Bulgogi 1',
    'BULGOGI-2',
    'Bulgogi Events PH',
    'Bulgogi II',
    'Bulgogi 2nd',
    'Bulgogi & Co.',
    'Bulgogi Catering Services Inc.',
    'bulgogi1',
  ]) {
    assert.equal(await core(name), 'bulgogi', `"${name}" must reduce to the core "bulgogi"`);
  }
});

test('a held ADDRESS with no separators meets the name that made it', async () => {
  // Every address since 2026-08-09 is the name with the spaces DROPPED. A closed shop's name may be erased; its held
  // address is what remains, so the core must come back out of it.
  assert.equal(await core('bulgogicatering'), 'bulgogi');
  assert.equal(await core('bulgogieventsph'), 'bulgogi');
  assert.equal(await core('bulgogicateringinc'), 'bulgogi');
  assert.equal(await core('bulgogiph'), 'bulgogi');
  assert.equal(await core('bulgogi-catering'), 'bulgogi', 'a pre-2026-08-09 hyphenated address too');
});

test('a non-ASCII name folds with the address’s own accent pairs', async () => {
  const a = await core('Niño’s Lechonería');
  assert.equal(a, 'ninolechoneria');
  assert.equal(await core('NINO LECHONERIA 3'), a, 'the accented and the plain spelling are one name');
  assert.equal(await core('ブルゴギ'), null, 'a script with nothing to fold holds nothing — never a crash');
});

test('a short core, or one made only of trade words, holds nothing', async () => {
  for (const name of ['Al’s Catering', 'JM Events', 'Catering Services', 'Photo & Video', 'Events PH Inc', 'Lights and Sound Co', '2024', 'II', '', '   ']) {
    assert.equal(await core(name), null, `"${name}" must hold nothing (under 3 letters, or only trade words)`);
  }
  assert.equal(await core(null), null);
});

test('a glued legal form is only peeled while five letters remain — "Joseph" is not "Jose"', async () => {
  assert.equal(await core('Joseph'), 'joseph');
  assert.equal(await core('Marco'), 'marco');
});

test('numbers are only taken from a name, never a whole word that merely looks roman', async () => {
  assert.equal(await core('Mix Grill'), 'mixgrill', '"mix" is a word here, not 1009');
  assert.equal(await core('Bulgogi XIV'), 'bulgogi');
});

// ── 2 · the trade words are derived ──────────────────────────────────────────

test('trade words come from the taxonomy tables, read live', async () => {
  const words = (await db.query<{ w: string[] }>(`SELECT public.shop_name_trade_words() AS w`)).rows[0]!.w;
  for (const w of ['catering', 'co', 'inc', 'ph', 'corp']) assert.ok(words.includes(w), `"${w}" must be a trade word`);
  assert.ok(words.length > 100, `the trade words must come from the taxonomy, not a short typed list (got ${words.length})`);
  assert.equal(await core('Bulgogi Zorbing'), 'bulgogizorbing', 'precondition: "zorbing" is not a category yet');
  await db.query(
    `INSERT INTO public.service_categories (id, tier, label_en, slug) VALUES ('core_test_zorbing', 1, 'Zorbing', 'core-test-zorbing')`,
  );
  assert.equal(await core('Bulgogi Zorbing'), 'bulgogi', 'a category added by an admin is a trade word at once');
  await db.query(`DELETE FROM public.service_categories WHERE id = 'core_test_zorbing'`);
});

// ── 3 · the holds ────────────────────────────────────────────────────────────

test('a CLOSED shop holds its core for as long as its address is held', async () => {
  const closed = await shop('Bulgogi Catering');
  // Erasure blanks the name — only the held address is left to read the core from.
  await db.query(`UPDATE public.vendor_profiles SET business_name = '', business_slug = NULL WHERE vendor_profile_id = $1`, [closed]);
  await closeShop(closed, 'bulgogicatering', `${new Date(Date.now() + 365 * 864e5).toISOString()}`);

  const h = await hold('Bulgogi 1');
  assert.equal(h.held, true, '"Bulgogi 1" must be refused while "Bulgogi Catering" is held');
  assert.equal(h.hold_reason, 'closed');
  assert.equal(h.holder_vendor_profile_id, closed);
  assert.equal((await hold('BULGOGI-2')).held, true);
  assert.equal((await hold('Bulgogi Events PH')).held, true);
  assert.equal((await hold('Bulgogi Grill')).held, false, 'a different core is not held');
});

test('an EXPIRED closed hold holds nothing — the core frees itself with the address', async () => {
  const gone = await shop('Kimchi Catering');
  await db.query(`UPDATE public.vendor_profiles SET business_name = '', business_slug = NULL WHERE vendor_profile_id = $1`, [gone]);
  await closeShop(gone, 'kimchicatering', new Date(Date.now() - 864e5).toISOString());
  const h = await hold('Kimchi 1');
  assert.equal(h.core, 'kimchi');
  assert.equal(h.held, false, 'a hold whose redirect_until has passed must not block');
});

test('a BANNED shop holds its core', async () => {
  const banned = await shop('Sinigang Catering');
  await db.query(`UPDATE public.vendor_profiles SET fraud_banned_at = now() WHERE vendor_profile_id = $1`, [banned]);
  const h = await hold('Sinigang III');
  assert.equal(h.held, true);
  assert.equal(h.hold_reason, 'banned');
  assert.equal(h.holder_vendor_profile_id, banned);
});

test('a SUSPENDED shop holds its core', async () => {
  const suspended = await shop('Pancit Palace Events');
  await db.query(`UPDATE public.vendor_profiles SET fraud_suspended_at = now() WHERE vendor_profile_id = $1`, [suspended]);
  const h = await hold('PANCIT-PALACE ph');
  assert.equal(h.held, true);
  assert.equal(h.hold_reason, 'suspended');
  // …but never against ITSELF: a suspended shop fixing its own name is not a second shop.
  assert.equal((await hold('Pancit Palace Events Co', suspended)).held, false, 'a shop’s own core must not hold against it');
});

test('a live, normal shop does NOT hold its core — similar names of active shops are legitimate', async () => {
  await shop('Lumpia House Catering');
  const h = await hold('Lumpia House 2');
  assert.equal(h.core, 'lumpiahouse');
  assert.equal(h.held, false, 'exact-address uniqueness covers an active shop; its core must not block anybody');
});

test('a short or trade-words-only name is never held, even against a banned shop with the same words', async () => {
  const banned = await shop('Catering Services');
  await db.query(`UPDATE public.vendor_profiles SET fraud_banned_at = now() WHERE vendor_profile_id = $1`, [banned]);
  assert.equal((await hold('Catering Services 2')).held, false);
  assert.equal((await hold('Catering Services 2')).core, null);
});

test('an APPROVED "It’s my business" claim releases the core for that shop only — an open one does not', async () => {
  const banned = await shop('Adobo Republic Catering');
  await db.query(`UPDATE public.vendor_profiles SET fraud_banned_at = now() WHERE vendor_profile_id = $1`, [banned]);
  const claimant = await shop('Placeholder Kitchen');
  await db.query(
    `INSERT INTO public.vendor_correction_requests (vendor_profile_id, field_key, current_value, requested_value, note)
     VALUES ($1, 'business_name', NULL, 'Adobo Republic 2', 'It''s my business')`,
    [claimant],
  );
  assert.equal((await hold('Adobo Republic 2', claimant)).held, true, 'an OPEN claim must not release the core');
  await db.query(
    `UPDATE public.vendor_correction_requests SET status = 'applied', resolved_at = now() WHERE vendor_profile_id = $1`,
    [claimant],
  );
  assert.equal((await hold('Adobo Republic 2', claimant)).held, false, 'the approved shop must be able to use its core');
  assert.equal((await hold('ADOBO REPUBLIC', claimant)).held, false, 'any spelling of the approved core');
  assert.equal((await hold('Adobo Republic 2')).held, true, 'every OTHER shop is still refused');
});

// ── 4 · the couple's link ────────────────────────────────────────────────────

test('the couple’s link leaves a held name BLANK instead of copying it onto the joining supplier’s shop', async () => {
  const banned = await shop('Lechon Manok Royale');
  await db.query(`UPDATE public.vendor_profiles SET fraud_banned_at = now() WHERE vendor_profile_id = $1`, [banned]);

  const host = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('core-host@example.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  const ev = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
       VALUES ('Core test wedding', 'wedding', 'catholic', 'banquet_hall', DATE '2027-02-14') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [ev, host]);

  async function invite(business: string, token: string): Promise<void> {
    const card = (
      await db.query<{ id: string }>(
        `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number)
         VALUES ($1, $2, 'Tita Lorna', '09170000000') RETURNING manual_vendor_id AS id`,
        [ev, business],
      )
    ).rows[0]!.id;
    const row = (
      await db.query<{ id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, manual_vendor_id, status, source)
         VALUES ($1, 'catering', $2, $3, 'considering', 'host_manual') RETURNING vendor_id AS id`,
        [ev, business, card],
      )
    ).rows[0]!.id;
    await db.query(
      `INSERT INTO public.vendor_invites
         (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source, expires_at)
       VALUES ($1, $2, NULL, $3, 'catering', $4, 'pending', 'auto_share_link', now() + interval '90 days')`,
      [row, host, business, token],
    );
  }
  async function joinFrom(token: string): Promise<string> {
    const supplier = (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
        [`core-supplier-${token}@example.test`],
      )
    ).rows[0]!.id;
    const shopId = (
      await db.query<{ s: string }>(`SELECT public.claim_ready_the_shop($1, $2) AS s`, [supplier, token])
    ).rows[0]!.s;
    return (
      await db.query<{ n: string }>(`SELECT business_name AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shopId])
    ).rows[0]!.n;
  }

  await invite('Lechon Manok Royale 2', 'core-held-link');
  assert.equal(await joinFrom('core-held-link'), '', 'a held name must not be copied onto the new shop (blank is \'\')');

  await invite('Tita Lorna Kakanin', 'core-free-link');
  assert.equal(await joinFrom('core-free-link'), 'Tita Lorna Kakanin', 'a free name is still copied, as before');
});
