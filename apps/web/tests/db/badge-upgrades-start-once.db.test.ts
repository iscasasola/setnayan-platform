/**
 * BADGE UPGRADES — given once, ready until Start, and Start adds four weeks to the add-on itself (owner approved the
 * table 2026-11-06).
 *
 * Migration `badge_upgrades_ready_to_start`. What a unit test cannot see:
 *
 *   1 · EXACTLY ONCE — `shop_badge_upgrade_grant` writes one row per (shop, reward_key); a second call writes nothing.
 *       The row is READY (no start) and touches no add-on until Start.
 *   2 · START EXTENDS THE ADD-ON'S OWN COLUMN — Papic Challenges → papic_challenge_expires_at, 3D Booth →
 *       booth_addon_expires_at, AI Chatbot → ai_addon_expires_at, by the period handed in, STACKING on time already
 *       paid for; a second Start changes nothing ('already').
 *   3 · THE PLAN RULE — below Solo a 3D Booth upgrade cannot start as the booth; it starts as Papic Challenges. On Solo
 *       it starts as the booth. A pick outside the row's choices is refused and leaves it ready.
 *   4 · RLS — a shop reads only its own upgrades; no session writes one or calls either door.
 *
 * Sabotage, both run 2026-11-06 in one pass: removing `ON CONFLICT … DO NOTHING` turned test 1 red (unique violation,
 * not 'already'); replacing `array_replace(...)` with `v_row.choices` turned test 3 red (a Free shop started the booth).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;
const uniq = () => `upgrade-${++seq}-${Date.now()}`;
const DAY = 86_400_000;
const PERIOD = 28; // the test's own period — the app passes the add-on's constant

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newShop(tier: 'free' | 'verified' | 'solo' | 'pro' = 'verified'): Promise<{ userId: string; shop: string }> {
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id AS v`,
    [`${uniq()}@t.local`],
  );
  const shop = await one<string>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Upgrade Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id AS v`,
    [userId],
  );
  if (tier !== 'free') {
    // Set the plan the way an admin comp does — under the service role, past the downgrade guard.
    await db.query(`UPDATE public.vendor_profiles SET tier_state = $2::public.vendor_tier_state WHERE vendor_profile_id = $1`, [shop, tier]);
  }
  return { userId, shop };
}

type Res = { status: string; upgrade_id?: string; choice?: string; ends_at?: string };
const grant = (shop: string, key: string, badge: string, choices: string[]) =>
  one<Res>(`SELECT public.shop_badge_upgrade_grant($1, $2, $3, $4::text[], 'Badge upgrade · test') AS v`, [shop, key, badge, choices]);
const start = (id: string, shop: string, choice: string, days = PERIOD) =>
  one<Res>(`SELECT public.shop_badge_upgrade_start($1, $2, $3, $4) AS v`, [id, shop, choice, days]);
const expiries = (shop: string) =>
  db
    .query<{ c: string | null; b: string | null; a: string | null }>(
      `SELECT papic_challenge_expires_at::text AS c, booth_addon_expires_at::text AS b, ai_addon_expires_at::text AS a
         FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [shop],
    )
    .then((r) => r.rows[0]!);

test('1 · an upgrade is given exactly once, and waits ready — no add-on moves', async () => {
  const { shop } = await newShop();
  const first = await grant(shop, 'upgrade:verified', 'verified', ['photo_challenge']);
  assert.equal(first.status, 'granted');
  assert.ok(first.upgrade_id);
  assert.equal((await grant(shop, 'upgrade:verified', 'verified', ['photo_challenge'])).status, 'already', 'a re-run gave it twice');
  assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_upgrades WHERE vendor_profile_id = $1`, [shop])), 1);
  const row = await db.query<{ started_at: string | null }>(`SELECT started_at FROM public.shop_badge_upgrades WHERE upgrade_id = $1`, [first.upgrade_id]);
  assert.equal(row.rows[0]!.started_at, null, 'a granted upgrade started by itself');
  const e = await expiries(shop);
  assert.deepEqual([e.c, e.b, e.a], [null, null, null], 'granting moved an add-on');
  assert.equal((await grant(shop, 'not-an-upgrade', 'verified', ['photo_challenge'])).status, 'bad_input');
  assert.equal((await grant(shop, 'upgrade:x', 'verified', ['free_money'])).status, 'bad_input');
});

test('2 · Start adds the period to the add-on’s own column, stacks on paid time, and starts once', async () => {
  const { shop } = await newShop('pro');
  const c = await grant(shop, 'upgrade:verified', 'verified', ['photo_challenge']);
  const t0 = Date.now();
  const s1 = await start(c.upgrade_id!, shop, 'photo_challenge');
  assert.equal(s1.status, 'started');
  const ends = Date.parse((await expiries(shop)).c!);
  assert.ok(Math.abs(ends - (t0 + PERIOD * DAY)) < 60_000, 'the challenge window is not now + the period');
  assert.equal(Date.parse(s1.ends_at!), ends, 'the row and the add-on disagree');

  const again = await start(c.upgrade_id!, shop, 'photo_challenge');
  assert.equal(again.status, 'already');
  assert.equal(Date.parse((await expiries(shop)).c!), ends, 'a second Start added more time');

  // Stacks: 10 days already paid on the AI Chatbot → Start ends at paid end + the period.
  await db.query(`UPDATE public.vendor_profiles SET ai_addon_expires_at = NOW() + interval '10 days' WHERE vendor_profile_id = $1`, [shop]);
  const paidEnd = Date.parse((await expiries(shop)).a!);
  const ai = await grant(shop, 'upgrade:reviews:5', 'reviews', ['ai_chatbot']);
  assert.equal((await start(ai.upgrade_id!, shop, 'ai_chatbot')).status, 'started');
  assert.ok(Math.abs(Date.parse((await expiries(shop)).a!) - (paidEnd + PERIOD * DAY)) < 1000, 'the upgrade ate the paid days');

  // Another shop's id is not found, and a bad period is refused.
  const other = await newShop();
  const b = await grant(shop, 'upgrade:first_booking', 'first_booking', ['3d_booth']);
  assert.equal((await start(b.upgrade_id!, other.shop, '3d_booth')).status, 'not_found');
  assert.equal((await start(b.upgrade_id!, shop, '3d_booth', 0)).status, 'bad_input');
  assert.equal((await start(b.upgrade_id!, shop, '3d_booth', 400)).status, 'bad_input');
});

test('3 · below Solo the 3D Booth starts as Papic Challenges; on Solo it starts as the booth; a stray pick is refused', async () => {
  const free = await newShop('free');
  const fb = await grant(free.shop, 'upgrade:first_booking', 'first_booking', ['3d_booth']);
  assert.equal((await start(fb.upgrade_id!, free.shop, '3d_booth')).status, 'bad_choice', 'a Free shop started the booth');
  assert.equal((await expiries(free.shop)).b, null);
  assert.equal((await start(fb.upgrade_id!, free.shop, 'photo_challenge')).status, 'started');
  assert.ok((await expiries(free.shop)).c, 'the Papic Challenges window did not open');

  const solo = await newShop('solo');
  const sb = await grant(solo.shop, 'upgrade:first_booking', 'first_booking', ['3d_booth']);
  assert.equal((await start(sb.upgrade_id!, solo.shop, 'ai_chatbot')).status, 'bad_choice', 'a pick outside the row started');
  const still = await db.query<{ started_at: string | null }>(`SELECT started_at FROM public.shop_badge_upgrades WHERE upgrade_id = $1`, [sb.upgrade_id]);
  assert.equal(still.rows[0]!.started_at, null, 'a refused Start spent the upgrade');
  assert.equal((await start(sb.upgrade_id!, solo.shop, '3d_booth')).status, 'started');
  assert.ok((await expiries(solo.shop)).b, 'the booth window did not open');

  // An award upgrade: any of the three on Solo+.
  const aw = await grant(solo.shop, 'upgrade:award:top_pick:2026-11-01', 'award', ['photo_challenge', '3d_booth', 'ai_chatbot']);
  assert.equal((await start(aw.upgrade_id!, solo.shop, 'ai_chatbot')).status, 'started');
});

test('4 · 🚨 RLS: own upgrades only; no session writes one or calls either door', async () => {
  const a = await newShop();
  const b = await newShop();
  const g = await grant(a.shop, 'upgrade:verified', 'verified', ['photo_challenge']);

  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, a.userId);
    assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_upgrades WHERE vendor_profile_id = $1`, [a.shop])), 1);
    await setAuthUid(db, b.userId);
    assert.equal(
      Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_upgrades WHERE vendor_profile_id = $1`, [a.shop])),
      0,
      'shop B reads shop A’s upgrades',
    );
    await setAuthUid(db, a.userId);
    await assert.rejects(
      db.query(`INSERT INTO public.shop_badge_upgrades (vendor_profile_id, reward_key, badge, choices) VALUES ($1, 'upgrade:mine', 'verified', ARRAY['ai_chatbot'])`, [a.shop]),
      /permission denied/,
      'a shop wrote its own upgrade',
    );
    await assert.rejects(
      db.query(`UPDATE public.shop_badge_upgrades SET started_at = NOW() WHERE upgrade_id = $1`, [g.upgrade_id]),
      /permission denied/,
      'a shop stamped its own upgrade',
    );
    await assert.rejects(
      db.query(`SELECT public.shop_badge_upgrade_grant($1, 'upgrade:x', 'verified', ARRAY['ai_chatbot'])`, [a.shop]),
      /permission denied/,
      'a session called the grant door',
    );
    await assert.rejects(
      db.query(`SELECT public.shop_badge_upgrade_start($1, $2, 'photo_challenge', 366)`, [g.upgrade_id, a.shop]),
      /permission denied/,
      'a session called the Start door',
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});
