/**
 * An offer reaches only its own shop's cards — migration 20271336923559 (the Offer Maker, Build 6 Lane D), held under the
 * real replay.
 *
 * What would go wrong without each check: a supplier pointing an offer at ANOTHER shop's card (that shop's couples would
 * see a stranger's "10% off" on its card) · an offer whose Who carries the wrong answer (an Early bird with no months, a
 * season with no days — "Event date in a season" IS the off-season offer, 11 Nov) · a first payment of 100% or more ·
 * another shop's member writing this shop's offers (RLS at CREATE TABLE).
 *
 * Run from apps/web: pnpm exec tsx --test tests/db/an-offer-reaches-only-its-own-shops-cards.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function asSetup(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer'::text)) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function refused(sql: string, params: unknown[]): Promise<string | null> {
  try {
    await db.query(sql, params as never[]);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const F = { owner1: '', owner2: '', vendor1: '', vendor2: '', card1: '', card2: '', offer1: 0 };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asSetup();
  F.owner1 = await createUser('owner-1@offers.test');
  F.owner2 = await createUser('owner-2@offers.test');
  const shop = async (uid: string, name: string) =>
    (await db.query<{ vendor_profile_id: string }>(`INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2) RETURNING vendor_profile_id`, [uid, name])).rows[0]!.vendor_profile_id;
  F.vendor1 = await shop(F.owner1, 'Shop One');
  F.vendor2 = await shop(F.owner2, 'Shop Two');
  const card = async (v: string, title: string) =>
    (
      await db.query<{ vendor_service_id: string }>(
        `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'catering', $2, FALSE) RETURNING vendor_service_id`,
        [v, title],
      )
    ).rows[0]!.vendor_service_id;
  F.card1 = await card(F.vendor1, 'Shop One catering');
  F.card2 = await card(F.vendor2, 'Shop Two catering');
  F.offer1 = (
    await db.query<{ id: number }>(
      `INSERT INTO public.vendor_offers (vendor_profile_id, name, reaches_all, pct_off) VALUES ($1, 'Shop-wide 10%', FALSE, 10) RETURNING id`,
      [F.vendor1],
    )
  ).rows[0]!.id;
});

after(async () => {
  await db?.close();
});

test('an offer reaches its own shop’s card — and never another shop’s', async () => {
  await asSetup();
  assert.equal(await refused(`INSERT INTO public.vendor_offer_cards (vendor_offer_id, vendor_service_id, vendor_profile_id) VALUES ($1, $2, $3)`, [F.offer1, F.card1, F.vendor1]), null);
  const crossCard = await refused(`INSERT INTO public.vendor_offer_cards (vendor_offer_id, vendor_service_id, vendor_profile_id) VALUES ($1, $2, $3)`, [F.offer1, F.card2, F.vendor1]);
  assert.match(crossCard ?? '', /its own shop/, 'an offer reached another shop’s card');
  const crossOwner = await refused(`INSERT INTO public.vendor_offer_cards (vendor_offer_id, vendor_service_id, vendor_profile_id) VALUES ($1, $2, $3)`, [F.offer1, F.card2, F.vendor2]);
  assert.match(crossOwner ?? '', /its own shop/, 'an offer reached another shop’s card under that shop’s id');
});

test('each Who carries its own answer, and a season has its EVENT days', async () => {
  await asSetup();
  const ins = (cols: string, vals: string) => refused(`INSERT INTO public.vendor_offers (vendor_profile_id, name, pct_off, ${cols}) VALUES ($1, 'x', 10, ${vals})`, [F.vendor1]);
  assert.match((await ins('who', `'early_bird'`)) ?? '', /vendor_offers_early_bird_months/, 'an Early bird with no months');
  assert.match((await ins('who', `'first_n'`)) ?? '', /vendor_offers_first_n_cap/, 'a first-N offer with no number');
  assert.match((await ins('who', `'season'`)) ?? '', /vendor_offers_season_window/, 'a season offer with no days');
  assert.match((await ins('who, season_from, season_to', `'season', '2027-08-31', '2027-06-01'`)) ?? '', /vendor_offers_season_window/, 'a season that ends before it starts');
  assert.match((await ins('min_lead_months', '12')) ?? '', /vendor_offers_early_bird_months/, 'months on an Everyone offer');
  assert.equal(await ins('who, season_from, season_to', `'season', '2027-06-01', '2027-08-31'`), null, 'a good season offer was refused');
  assert.equal(await ins('who, min_lead_months', `'early_bird', 12`), null, 'a good Early bird was refused');
});

test('a % first payment is a share of the price, under 100%; a % off is under 100% too', async () => {
  await asSetup();
  const r1 = await refused(`INSERT INTO public.vendor_offers (vendor_profile_id, name, first_payment, first_payment_unit) VALUES ($1, 'x', 100, 'pct')`, [F.vendor1]);
  assert.match(r1 ?? '', /vendor_offers_first_payment_pct/);
  assert.equal(await refused(`INSERT INTO public.vendor_offers (vendor_profile_id, name, first_payment, first_payment_unit) VALUES ($1, 'x', 5000, 'php')`, [F.vendor1]), null);
  assert.ok(await refused(`INSERT INTO public.vendor_offers (vendor_profile_id, name, pct_off) VALUES ($1, 'x', 100)`, [F.vendor1]), 'a 100% off was accepted');
});

test('RLS: another shop’s member can neither read nor write this shop’s offers', async () => {
  await asUser(F.owner2);
  const seen = await db.query(`SELECT id FROM public.vendor_offers WHERE vendor_profile_id = $1`, [F.vendor1]);
  assert.equal(seen.rows.length, 0, 'another shop reads an unpublished shop’s offers');
  const w = await refused(`INSERT INTO public.vendor_offers (vendor_profile_id, name, pct_off) VALUES ($1, 'hijack', 10)`, [F.vendor1]);
  assert.ok(w, 'another shop wrote this shop’s offer');
  await asUser(F.owner1);
  const own = await db.query(`SELECT id FROM public.vendor_offers WHERE vendor_profile_id = $1`, [F.vendor1]);
  assert.ok(own.rows.length > 0, 'the shop cannot read its own offers');
  await asSetup();
});
