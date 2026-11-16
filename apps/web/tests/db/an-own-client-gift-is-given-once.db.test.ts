/**
 * 🎁 AN OWN-CLIENT GIFT IS GIVEN ONCE — and records what the booking-fee rule reads (Own clients v4, owner 16 Nov 2026;
 * import-fee ruling specs d4899cd5, amended 9fe95ebe).
 *
 * Migration `own_clients_carry_a_gift`. What a unit test cannot see:
 *   1 · `own_client_gift_give` moves BOUGHT stock into the couple's shared Papic pool once per (shop, event), as a NEW
 *       stock kind ('own_client') that no quote door counts as a promise kept; a repeat answers 'already'.
 *   2 · a BADGE REWARD never pays for it (v4 answer 3) — short bought stock refuses and writes nothing.
 *   3 · the facts: an account / event made after the invite was made through it; the first importing shop on an event
 *       is `first_import`, a second shop is not (ruling (3): every other supplier pays the fee).
 *   4 · the couple meets it through the shipped gift moment, and Redeem claims it once.
 *   5 · no session may call the door or write the tables.
 *
 * Sabotage (2026-11-16): dropping `- v_reward` (badge reward counted) turns test 2 red; dropping the other-shop
 * `NOT EXISTS` turns test 3 red (the second shop reads first); dropping the own-client arm of `gift_moment_claim`
 * turns test 4 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id AS v`,
    [email, accountType],
  );
}

async function shopOf(userId: string, name: string): Promise<string> {
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [userId]);
  if (existing.rows[0]) {
    await db.query(`UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`, [existing.rows[0].vendor_profile_id, name]);
    return existing.rows[0].vendor_profile_id;
  }
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, name],
  );
}

async function stockIn(shop: string, credits: number): Promise<void> {
  await db.query(`INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'papic', $2, 'bought')`, [shop, credits]);
}

async function newEvent(hostUser: string, createdAt: string | null = null): Promise<string> {
  n += 1;
  const eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`, [`own client ${n}`]);
  if (createdAt) await db.query(`UPDATE public.events SET created_at = $2 WHERE event_id = $1`, [eventId, createdAt]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, hostUser]);
  return eventId;
}

async function invite(shop: string, createdAt: string): Promise<string> {
  n += 1;
  return one<string>(
    `INSERT INTO public.vendor_client_invites (token, vendor_profile_id, client_name, client_contact, gift_lines, created_at)
     VALUES ($1, $2, 'Ana Reyes', 'ana@example.com', $3::jsonb, $4) RETURNING invite_id AS v`,
    [`tok${n}${'x'.repeat(20)}`, shop, JSON.stringify(LINES), createdAt],
  );
}

const LINES = [{ service_code: 'PAPIC_GUEST', title: 'Papic 150', kind: 'papic', credits: 150 }];

type Give = { status: string; own_gift_id?: string; credits?: number; free?: number; account_new?: boolean | null; event_new?: boolean | null; first_import?: boolean };
async function give(shop: string, eventId: string, inviteId: string | null, userId: string | null): Promise<Give> {
  return one<Give>(`SELECT public.own_client_gift_give($1, $2, $3, $4, $5::jsonb, $6) AS v`, [
    shop,
    eventId,
    inviteId ? 'invite' : 'own_link',
    inviteId,
    JSON.stringify(LINES),
    userId,
  ]);
}

async function balance(shop: string): Promise<number> {
  return Number(await one<number>(`SELECT balance AS v FROM public.shop_gift_stock_status($1) WHERE gift_kind = 'papic'`, [shop]));
}

let shopA: string;
let shopB: string;
let shopC: string;
let oldCouple: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  shopA = await shopOf(await newUser('own-a@test.test', 'vendor'), 'Own Shop A');
  shopB = await shopOf(await newUser('own-b@test.test', 'vendor'), 'Own Shop B');
  shopC = await shopOf(await newUser('own-c@test.test', 'vendor'), 'Own Shop C');
  oldCouple = await newUser('old-couple@test.test', 'customer');
  await db.query(`UPDATE auth.users SET created_at = NOW() - INTERVAL '1 year' WHERE id = $1`, [oldCouple]);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. own clients', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · the gift is given once, from bought stock, into the shared pool, as an own-client row', async () => {
  await stockIn(shopA, 1000);
  const couple = await newUser('new-couple@test.test', 'customer');
  const inv = await invite(shopA, new Date(Date.now() - 60_000).toISOString());
  const eventId = await newEvent(couple);
  const first = await give(shopA, eventId, inv, couple);
  assert.equal(first.status, 'ok');
  assert.equal(first.credits, 150);
  assert.equal(await balance(shopA), 850);
  const pool = await one<number>(`SELECT COALESCE(SUM(points), 0)::int AS v FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'shop_gift'`, [eventId]);
  assert.equal(pool, 150);
  const kinds = await one<string>(`SELECT string_agg(kind, ',') AS v FROM public.shop_gift_stock_entries WHERE event_id = $1`, [eventId]);
  assert.equal(kinds, 'own_client', 'an own-client gift is its own kind — never a quote\'s "given"');
  const again = await give(shopA, eventId, inv, couple);
  assert.equal(again.status, 'already');
  assert.equal(await balance(shopA), 850, 'a repeat never gives twice');
  assert.equal(await one<string>(`SELECT status AS v FROM public.vendor_client_invites WHERE invite_id = $1`, [inv]), 'joined');
});

test('2 · a badge reward never pays for an own-client gift; short stock writes nothing', async () => {
  await db.query(`SELECT public.shop_badge_reward_grant($1, 'reviews:5', 'reviews', 'papic', 1, 150)`, [shopB]);
  assert.equal(await balance(shopB), 150, 'the reward sits in the stock');
  const eventId = await newEvent(oldCouple);
  const res = await give(shopB, eventId, null, null);
  assert.equal(res.status, 'short');
  assert.equal(res.free, 0);
  assert.equal(await balance(shopB), 150, 'nothing left the stock');
  assert.equal(await one<number>(`SELECT count(*)::int AS v FROM public.own_client_gifts WHERE event_id = $1`, [eventId]), 0);
});

test('3 · the facts: new account · old account · first import · a second shop on the same event', async () => {
  await stockIn(shopB, 1000);
  await stockIn(shopC, 1000);
  // An existing account, an event it already had, imported by shop B first: not new, not a new event, but FIRST.
  const invitedAt = new Date(Date.now() - 60_000).toISOString();
  const eventId = await newEvent(oldCouple, new Date(Date.now() - 86_400_000).toISOString());
  const b = await give(shopB, eventId, await invite(shopB, invitedAt), oldCouple);
  assert.equal(b.status, 'ok');
  assert.equal(b.account_new, false);
  assert.equal(b.event_new, false);
  assert.equal(b.first_import, true, 'the first importing shop on the event (free under 9fe95ebe)');
  // Shop C imports the same couple onto the same event: not first — ruling (3), the normal fee.
  const c = await give(shopC, eventId, await invite(shopC, invitedAt), oldCouple);
  assert.equal(c.status, 'ok');
  assert.equal(c.first_import, false, 'every other supplier on the event pays the fee');
  // An own-link arrival has no invite to measure against: unknown, never free by itself.
  const ownLink = await give(shopC, await newEvent(oldCouple), null, oldCouple);
  assert.equal(ownLink.account_new, null);
  assert.equal(ownLink.event_new, null);
  // Recorded on the row, for the fee logic.
  const row = await db.query<{ account_new_by_import: boolean | null; first_import_on_event: boolean }>(
    `SELECT account_new_by_import, first_import_on_event FROM public.own_client_gifts WHERE vendor_profile_id = $1 AND event_id = $2`,
    [shopC, eventId],
  );
  assert.equal(row.rows[0]!.first_import_on_event, false);
});

test('4 · the couple meets it through the shipped gift moment, and Redeem claims it once', async () => {
  const couple = await newUser('moment-couple@test.test', 'customer');
  await stockIn(shopA, 300);
  const eventId = await newEvent(couple);
  const res = await give(shopA, eventId, await invite(shopA, new Date(Date.now() - 60_000).toISOString()), couple);
  assert.equal(res.status, 'ok');
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, couple);
    const m = await db.query<{ source: string; ref_id: string; giver_name: string; lines: unknown }>(`SELECT source, ref_id, giver_name, lines FROM public.gift_moments_for_event($1)`, [eventId]);
    assert.equal(m.rows.length, 1);
    assert.equal(m.rows[0]!.source, 'shop_gift');
    assert.equal(m.rows[0]!.ref_id, res.own_gift_id);
    assert.equal(m.rows[0]!.giver_name, 'Own Shop A');
    const claim = await one<{ status: string }>(`SELECT public.gift_moment_claim('shop_gift', $1) AS v`, [res.own_gift_id]);
    assert.equal(claim.status, 'claimed');
    const again = await one<{ status: string }>(`SELECT public.gift_moment_claim('shop_gift', $1) AS v`, [res.own_gift_id]);
    assert.equal(again.status, 'already');
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});

test('5 · no session may call the door or write the tables', async () => {
  const user = await newUser('own-session@test.test', 'vendor');
  const eventId = await newEvent(oldCouple);
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, user);
    await assert.rejects(give(shopA, eventId, null, user), /permission denied/);
    await assert.rejects(
      db.query(`INSERT INTO public.vendor_own_link_gifts (vendor_profile_id, service_code, title, gift_kind, credits) VALUES ($1, 'PAPIC_GUEST', 'Papic 150', 'papic', 150)`, [shopA]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(`INSERT INTO public.vendor_client_invites (token, vendor_profile_id, client_name, client_contact, gift_lines) VALUES ('abcdefghijklmnopqrst', $1, 'X', 'x@x.co', '[{}]')`, [shopA]),
      /permission denied/,
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});
