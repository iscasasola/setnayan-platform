/**
 * A SERVICE CARD'S OPENS COUNT ONCE A DAY, ONLY FOR COUPLES, AND ONLY ITS SHOP READS THEM — against a replayed schema
 * (…_service_card_opens.sql, Build 6 Lane I: Shop › Analytics "Which card sells" = opened → asked → booked per card).
 *
 *   1 · the writer is service-role only — a signed-in visitor cannot mint opens;
 *   2 · one open per viewer per card per Manila day; the shop's owner, its team and admins never count;
 *   3 · a card that is not this shop's is refused;
 *   4 · the reader returns COUNTS per card to the shop's own people, and REFUSES anyone else (an error, never an
 *       empty answer that would read as "nobody opened your cards");
 *   5 · the ledger itself is closed: nobody reads a row or a viewer hash directly.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { owner: '', couple: '', admin: '', stranger: '', shop: '33333333-3333-4333-8333-333333333331', other: '33333333-3333-4333-8333-333333333332', card: '', otherCard: '' };
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

async function reset() {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
const record = async (card: string, hash: string, viewer: string | null, shop = F.shop) =>
  (await db.query<{ ok: boolean }>(`SELECT public.record_service_card_view($1, $2, $3, $4) AS ok`, [shop, card, hash, viewer])).rows[0]!.ok;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mk = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.owner = await mk('opens-owner@opens.test', 'vendor');
  F.couple = await mk('opens-couple@opens.test', 'customer');
  F.admin = await mk('opens-admin@opens.test', 'customer');
  F.stranger = await mk('opens-stranger@opens.test', 'vendor');
  await db.query(`INSERT INTO public.users (user_id, email, account_type) VALUES ($1, 'opens-admin@opens.test', 'admin') ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`, [F.admin]);
  // A vendor account may already own a shop row (a signup trigger); use it, or make one.
  const shopOf = async (uid: string, id: string, name: string) =>
    (
      (await db.query<{ id: string }>(`SELECT vendor_profile_id AS id FROM public.vendor_profiles WHERE user_id = $1`, [uid])).rows[0] ??
      (await db.query<{ id: string }>(`INSERT INTO public.vendor_profiles (vendor_profile_id, user_id, business_name) VALUES ($1, $2, $3) RETURNING vendor_profile_id AS id`, [id, uid, name])).rows[0]!
    ).id;
  F.shop = await shopOf(F.owner, F.shop, 'Open Shop');
  F.other = await shopOf(F.stranger, F.other, 'Other Shop');
  F.card = (await db.query<{ id: string }>(`INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'catering', 'Full day', FALSE) RETURNING vendor_service_id AS id`, [F.shop])).rows[0]!.id;
  F.otherCard = (await db.query<{ id: string }>(`INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'catering', 'Not yours', FALSE) RETURNING vendor_service_id AS id`, [F.other])).rows[0]!.id;
});
after(async () => {
  await db?.close();
});

test('1 · a signed-in visitor cannot call the writer', async () => {
  const err = await refused(() => as(F.couple, () => db.query(`SELECT public.record_service_card_view($1, $2, $3, $4)`, [F.shop, F.card, H1, F.couple])));
  assert.match(err ?? '', /permission denied/);
});

test('2 · one open per viewer per card per day; the shop’s own people and admins never count', async () => {
  assert.equal(await record(F.card, H1, F.couple), true, 'a couple’s first open did not count');
  assert.equal(await record(F.card, H1, F.couple), false, 'the same couple counted twice in a day');
  assert.equal(await record(F.card, H2, null), true, 'a signed-out visitor’s open did not count');
  assert.equal(await record(F.card, 'c'.repeat(64), F.owner), false, 'the shop’s owner counted');
  assert.equal(await record(F.card, 'd'.repeat(64), F.admin), false, 'an admin counted');
  assert.equal(await record(F.card, 'not-a-hash', null), false, 'a malformed hash counted');
});

test('3 · a card that is not this shop’s is refused', async () => {
  assert.equal(await record(F.otherCard, 'e'.repeat(64), F.couple), false);
});

test('4 · the shop reads counts per card; anyone else is refused, never told zero', async () => {
  const since = '2000-01-01';
  const mine = await as(F.owner, async () => (await db.query<{ vendor_service_id: string; opens: string }>(`SELECT * FROM public.service_card_opens($1, $2::date)`, [F.shop, since])).rows);
  assert.deepEqual(mine.map((r) => [r.vendor_service_id, Number(r.opens)]), [[F.card, 2]]);
  const err = await refused(() => as(F.stranger, () => db.query(`SELECT * FROM public.service_card_opens($1, $2::date)`, [F.shop, since])));
  assert.match(err ?? '', /not your shop/, 'another shop read these opens');
  const adminRead = await as(F.admin, async () => (await db.query(`SELECT * FROM public.service_card_opens($1, $2::date)`, [F.shop, since])).rows.length);
  assert.equal(adminRead, 1);
});

test('5 · the ledger is closed — no row and no viewer hash reaches a session', async () => {
  const err = await refused(() => as(F.owner, () => db.query(`SELECT viewer_hash FROM public.vendor_service_card_view_days`)));
  assert.match(err ?? '', /permission denied/);
});
