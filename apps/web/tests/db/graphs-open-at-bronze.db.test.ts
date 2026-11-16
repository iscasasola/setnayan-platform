/**
 * GRAPHS OPEN AT BRONZE (test:db) — J5, migration 20271348267938 (owner 15 Nov; badge-unlock_v6: "each badge's Bronze
 * opens the graphs about its own area" · "Shops that already see graphs today keep them").
 *
 * The facts that decide which graphs a shop sees, and the "Gifts given → bookings" graph. Each case is a way they
 * could be wrong:
 *   · the keep marker: written for every shop Verified when the migration applies, never for a shop verified later,
 *     re-applying adds nothing, and no client role can write it (a shop could otherwise mark itself kept);
 *   · `earned` lists every unrevoked badge step and never a revoked one (a revoked step must not open graphs);
 *   · it carries NO count — the badge counts are main's own counters (a second count here is what the audit removed);
 *   · the gifts graph splits the couples who asked by offered-a-gift × booked, counts each couple once, never counts
 *     another shop's couples, honours the window and the caller's booked statuses;
 *   · both functions are service_role only.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

const BOOKED = ['contracted', 'deposit_paid', 'delivered', 'complete'];

async function newUser(type = 'customer'): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [`j5-${n}@graphs.test`, type],
  );
  return u.rows[0]!.id;
}
async function newShop(visibility: 'verified' | 'hidden' = 'verified'): Promise<string> {
  const owner = await newUser('vendor');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Graph Co', 'Manila', ARRAY['photography']::text[], $2, NOW(), $3)
     ON CONFLICT (user_id) DO UPDATE
       SET verification_state = EXCLUDED.verification_state, last_verified_at = EXCLUDED.last_verified_at, public_visibility = EXCLUDED.public_visibility
     RETURNING vendor_profile_id`,
    [owner, visibility === 'verified' ? 'verified' : 'unverified', visibility],
  );
  return v.rows[0]!.vendor_profile_id;
}
async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Graph event', 'birthday', '2027-03-01'::date, 'day') RETURNING event_id`,
  );
  return e.rows[0]!.event_id;
}
async function asked(eventId: string, vpid: string, at = 'now()'): Promise<void> {
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_at) VALUES ($1, $2, ${at})`, [eventId, vpid]);
}
async function giftInQuote(eventId: string, vpid: string): Promise<void> {
  const p = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, valid_until) VALUES ($1, $2, 'Quote', 'sent', current_date + 30) RETURNING proposal_id`,
    [vpid, eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
     VALUES ($1, $2, 'PAPIC_GUEST_150', 'papic', 150, 150, 'Papic 150')`,
    [p.rows[0]!.proposal_id, vpid],
  );
}
async function book(eventId: string, vpid: string, status = 'contracted'): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Graph Co', $2::public.vendor_status, $3)`,
    [eventId, status, vpid],
  );
}
async function facts(vpid: string): Promise<{ kept: boolean; earned: string[] } | null> {
  const r = await db.query<{ f: { kept: boolean; earned: string[] } | null }>(
    `SELECT public.shop_graph_unlock_facts($1) AS f`,
    [vpid],
  );
  return r.rows[0]!.f;
}
async function gifts(vpid: string, since = "now() - interval '30 days'", statuses = BOOKED): Promise<Record<string, number>> {
  const r = await db.query<{ g: Record<string, number> }>(`SELECT public.shop_gifts_to_bookings($1, ${since}, $2::text[]) AS g`, [vpid, statuses]);
  return r.rows[0]!.g;
}
const BACKFILL = (() => {
  const sql = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '20271348267938_graphs_open_at_bronze.sql'),
    'utf8',
  );
  const m = sql.match(/INSERT INTO public\.vendor_graph_unlocks_kept[\s\S]*?DO NOTHING;/);
  if (!m) throw new Error('the backfill statement is gone from the migration');
  return m[0];
})();

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the keep marker: every Verified shop at apply time, never a hidden one, never one verified later; re-applying adds nothing', async () => {
  const verified = await newShop('verified');
  const hidden = await newShop('hidden');
  await db.query(BACKFILL);
  assert.equal((await facts(verified))!.kept, true, 'a shop that sees graphs today keeps them');
  assert.equal((await facts(hidden))!.kept, false, 'a shop that does not see graphs today is not kept');

  await db.query(BACKFILL);
  const rows = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.vendor_graph_unlocks_kept WHERE vendor_profile_id = $1`, [verified]);
  assert.equal(rows.rows[0]!.c, 1, 're-applying the backfill must add nothing');

  const later = await newShop('verified');
  assert.equal((await facts(later))!.kept, false, 'a shop verified after the move opens graphs by badge, not by the marker');
});

test('no client role can write the marker (a shop must not be able to keep itself)', async () => {
  for (const role of ['authenticated', 'anon']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.vendor_graph_unlocks_kept', 'INSERT')
           OR has_table_privilege($1, 'public.vendor_graph_unlocks_kept', 'UPDATE')
           OR has_table_privilege($1, 'public.vendor_graph_unlocks_kept', 'DELETE') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]!.ok, false, `${role} can write the keep marker`);
  }
  const rls = await db.query<{ on: boolean }>(`SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.vendor_graph_unlocks_kept'::regclass`);
  assert.equal(rls.rows[0]!.on, true);
});

test('earned lists every unrevoked badge step and never a revoked one; it carries no count of its own', async () => {
  const vpid = await newShop();
  await db.query(
    `INSERT INTO public.shop_badge_rewards (vendor_profile_id, reward_key, badge, reward_kind, units, stock_delta)
     VALUES ($1, 'five_star_reviews:tier1', 'five_star_reviews', 'papic', 1, 150),
            ($1, 'gifts_given:tier1', 'gifts_given', 'papic', 1, 150)`,
    [vpid],
  );
  await db.query(`UPDATE public.shop_badge_rewards SET revoked_at = now() WHERE vendor_profile_id = $1 AND reward_key = 'gifts_given:tier1'`, [vpid]);
  const f = (await facts(vpid))!;
  assert.deepEqual(f.earned, ['five_star_reviews:tier1'], 'a revoked step must not open graphs');
  assert.deepEqual(Object.keys(f).sort(), ['earned', 'kept'], 'the unlock facts carry no badge count — main counts them');
  assert.equal(await facts('00000000-0000-0000-0000-000000000000'), null, 'an unknown shop reads null, never zeros');
});

test('gifts → bookings: offered-a-gift × booked, each couple once, only this shop, inside the window, the caller’s statuses', async () => {
  const vpid = await newShop();
  const other = await newShop();

  const giftedBooked = await newEvent();
  await asked(giftedBooked, vpid);
  await giftInQuote(giftedBooked, vpid);
  await giftInQuote(giftedBooked, vpid); // two gift quotes, still one couple
  await book(giftedBooked, vpid);

  const giftedDeciding = await newEvent();
  await asked(giftedDeciding, vpid);
  await giftInQuote(giftedDeciding, vpid);

  const plainBooked = await newEvent();
  await asked(plainBooked, vpid);
  await book(plainBooked, vpid, 'deposit_paid');

  const plainDeciding = await newEvent();
  await asked(plainDeciding, vpid);
  await book(plainDeciding, vpid, 'considering');

  // A couple who asked THIS shop but got a gift from ANOTHER shop is not "gifted" here.
  const giftedElsewhere = await newEvent();
  await asked(giftedElsewhere, vpid);
  await giftInQuote(giftedElsewhere, other);

  const tooOld = await newEvent();
  await asked(tooOld, vpid, "now() - interval '90 days'");
  await book(tooOld, vpid);

  const theirs = await newEvent();
  await asked(theirs, other);
  await giftInQuote(theirs, other);
  await book(theirs, other);

  const g = await gifts(vpid);
  assert.equal(Number(g.gifted_booked), 1);
  assert.equal(Number(g.gifted_deciding), 1);
  assert.equal(Number(g.plain_booked), 1);
  assert.equal(Number(g.plain_deciding), 2, "'considering' is not booked; another shop's gift is not this shop's");
  assert.equal(Number(g.free_stock), 0, 'no stock bought, none free');

  const narrow = await gifts(vpid, "now() - interval '30 days'", ['contracted']);
  assert.equal(Number(narrow.plain_booked), 0, 'the booked statuses come from the caller, not from a copy in SQL');
});

test('both read functions are service_role only', async () => {
  for (const fn of ['public.shop_graph_unlock_facts(uuid)', 'public.shop_gifts_to_bookings(uuid, timestamptz, text[])']) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn]);
      assert.equal(r.rows[0]!.ok, false, `${role} can run ${fn}`);
    }
    const s = await db.query<{ ok: boolean }>(`SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS ok`, [fn]);
    assert.equal(s.rows[0]!.ok, true);
  }
});
