/**
 * CARD MAKER PART 7 — Per unit · Custom word · Max (migration 20271352223098), proved against the replayed migrations.
 * Owner rulings (HYBRID map, 17 Nov): Base price · Initial units · Each extra · Max; "max … cannot be equal or less than"
 * the starting number; blank Max = no limit; Flat price has no per-x and so no Max; Custom carries its own word.
 * Every case asserts a VALUE or the refusal, never only a row count.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;
let vendor = '';
let branch = '';

async function errorOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null).catch(() => {});
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('units@part7.test', jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    )
  ).rows[0]!.id;
  vendor = (
    await db.query<{ v: string }>(`INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Mesa Rentals') ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`, [uid])
  ).rows[0]!.v;
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`, [vendor, uid]);
  branch = (
    await db.query<{ b: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km) VALUES ($1, 'Cebu', 'Cebu City', 30) RETURNING branch_id AS b`,
      [vendor],
    )
  ).rows[0]!.b;
});

after(async () => {
  await db?.close();
});

const unitCard = (extra: Record<string, unknown> = {}) =>
  insertLiveCard(db, {
    vendor_profile_id: vendor,
    category: 'photographer',
    title: `Tables ${Math.random().toString(36).slice(2, 7)}`,
    pricing_basis: 'per_unit',
    starting_price_php: 5000,
    unit_base_php: 5000,
    initial_units: 10,
    extra_unit_php: 500,
    ...extra,
  });

test('a Custom card keeps its word, its base, its starting number, each extra and its Max', async () => {
  const id = await unitCard({ unit_word: 'table', price_max: 40 });
  const r = (await db.query(`SELECT pricing_basis, unit_word, unit_base_php, initial_units, extra_unit_php, price_max FROM public.vendor_services WHERE vendor_service_id = $1`, [id])).rows[0];
  assert.deepEqual(r, { pricing_basis: 'per_unit', unit_word: 'table', unit_base_php: 5000, initial_units: 10, extra_unit_php: 500, price_max: 40 });
});

test('a blank Max is no limit', async () => {
  const id = await unitCard();
  const r = (await db.query<{ m: number | null }>(`SELECT price_max AS m FROM public.vendor_services WHERE vendor_service_id = $1`, [id])).rows[0]!;
  assert.equal(r.m, null);
});

test('Max must be MORE than the starting number — equal is refused, on every basis', async () => {
  assert.match(await errorOf(() => unitCard({ price_max: 10 })), /price_max_above_the_start/);
  assert.match(
    await errorOf(() => insertLiveCard(db, { vendor_profile_id: vendor, category: 'photographer', title: 'Lights 5h', pricing_basis: 'per_hour', hour_base_php: 15000, min_hours: 5, starting_price_php: 15000, price_max: 5 })),
    /price_max_above_the_start/,
  );
  const ok = await insertLiveCard(db, { vendor_profile_id: vendor, category: 'photographer', title: 'Lights 5h ok', pricing_basis: 'per_hour', hour_base_php: 15000, min_hours: 5, starting_price_php: 15000, price_max: 8 });
  assert.equal((await db.query<{ m: number }>(`SELECT price_max AS m FROM public.vendor_services WHERE vendor_service_id = $1`, [ok])).rows[0]!.m, 8);
});

test('a Flat price has no Max, and a word belongs only to a per-unit card', async () => {
  assert.match(
    await errorOf(() => insertLiveCard(db, { vendor_profile_id: vendor, category: 'photographer', title: 'Flat with max', pricing_basis: 'fixed', starting_price_php: 9000, price_max: 20 })),
    /price_max_above_the_start/,
  );
  assert.match(
    await errorOf(() => insertLiveCard(db, { vendor_profile_id: vendor, category: 'photographer', title: 'Flat with word', pricing_basis: 'fixed', starting_price_php: 9000, unit_word: 'chair' })),
    /unit_word_is_per_unit/,
  );
});

test('a per-unit card needs its base price and starting number; no negatives; a word has no digits', async () => {
  assert.match(await errorOf(() => unitCard({ unit_base_php: null })), /per_unit_has_its_base/);
  assert.match(await errorOf(() => unitCard({ initial_units: null })), /per_unit_has_its_base/);
  assert.match(await errorOf(() => unitCard({ extra_unit_php: -1 })), /check/i);
  assert.match(await errorOf(() => unitCard({ unit_word: 'chair2' })), /check/i);
});

test('"Copy to another branch" carries the word, the Max and the price there as the new base', async () => {
  const src = await unitCard({ unit_word: 'chair', price_max: 60 });
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  const id = (await db.query<{ id: string }>(`SELECT public.copy_vendor_service_to_branch($1, $2, $3, 6000) AS id`, [vendor, src, branch])).rows[0]!.id;
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  const r = (await db.query(`SELECT unit_word, unit_base_php, initial_units, extra_unit_php, price_max, starting_price_php FROM public.vendor_services WHERE vendor_service_id = $1`, [id])).rows[0];
  assert.deepEqual(r, { unit_word: 'chair', unit_base_php: 6000, initial_units: 10, extra_unit_php: 500, price_max: 60, starting_price_php: 6000 });
});

test('the one save writes a per-unit card in the same statement, and a switch back to Flat clears the word and the Max', async () => {
  const save = async (id: string | null, fields: Record<string, unknown>) =>
    (
      await db.query<{ s: string }>(
        `SELECT public.save_vendor_service($1::uuid, $2::uuid, $3::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false) AS s`,
        [vendor, id, JSON.stringify(fields)],
      )
    ).rows[0]!.s;
  const read = async (id: string) =>
    (await db.query(`SELECT pricing_basis, unit_word, unit_base_php, initial_units, extra_unit_php, price_max, starting_price_php FROM public.vendor_services WHERE vendor_service_id = $1`, [id])).rows[0];
  const id = await save(null, {
    category: 'photographer',
    title: 'Chairs by the ten',
    pricing_basis: 'per_unit',
    starting_price_php: 3500,
    unit_word: 'chair',
    unit_base_php: 3500,
    initial_units: 10,
    extra_unit_php: 350,
    price_max: 200,
  });
  assert.deepEqual(await read(id), { pricing_basis: 'per_unit', unit_word: 'chair', unit_base_php: 3500, initial_units: 10, extra_unit_php: 350, price_max: 200, starting_price_php: 3500 });
  await save(id, { category: 'photographer', title: 'Chairs by the ten', pricing_basis: 'fixed', starting_price_php: 9000 });
  assert.deepEqual(await read(id), { pricing_basis: 'fixed', unit_word: null, unit_base_php: null, initial_units: null, extra_unit_php: null, price_max: null, starting_price_php: 9000 });
});
