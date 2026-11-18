/**
 * BOOKINGS PER DATE — owner 2026-11-06 made them a plan allowance (Solo 1 · Pro 3 · Ultra 5, migration 20271316466285);
 * owner 2026-11-18 REVERSED it (DECISION_LOG "SUPPLIER PLANS REBUILT", ruling 17, verbatim: *"a cake business can
 * handle 30 cakes in a day. So they need to purchase unlimited from us. I think that is wrong pricing."*). Migration
 * supplier_plans_rebuilt_2026_11_18.
 *
 * Proven as a REAL `authenticated` supplier session against the replayed migrations:
 *   · no tier serves a plan number for bookings per date, and no admin row holds one;
 *   · a card's OWN number governs on every plan (a Free card set to 30 takes 30; a blank card has no per-card limit);
 *   · a card set to 1 and booked once refuses the second booking, and the day check says so first;
 *   · a bought "+1 booking per date" raises nothing;
 *   · a shop cannot write its own add-on counts (the entitlement guard), the activation path (service_role) can;
 *   · the waitlist has no plan limit — the column's own 10 is the ceiling.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { TIER_CAPS } from '../../lib/vendor-tier-caps';

let replay: ReplayResult;
let db: PGlite;

const DAY = '2028-03-14';

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

let seq = 0;
async function mkUser(label: string, type: 'customer' | 'vendor'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [`${label}-${++seq}@per-date.test`, type],
    )
  ).rows[0]!.id;
}

type Shop = { uid: string; vpid: string };
async function mkShop(label: string, tier: string): Promise<Shop> {
  const uid = await mkUser(label, 'vendor');
  const vpid =
    (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]))
      .rows[0]?.v ??
    (
      await db.query<{ v: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2) RETURNING vendor_profile_id AS v`,
        [uid, label],
      )
    ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = $2, location_city = 'Manila', services = ARRAY['photography']::text[],
            verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility,
            tier_state = $3::public.vendor_tier_state
      WHERE vendor_profile_id = $1`,
    [vpid, label, tier],
  );
  return { uid, vpid };
}

async function mkCard(vpid: string, dailyCapacity: number | null): Promise<string> {
  const s = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, 'photo_booth', 40000, 'Free extra hour', FALSE, 'vendor-media/per-date/cover.jpg') RETURNING vendor_service_id AS s`,
    [vpid],
  );
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [s.rows[0]!.s, vpid],
  );
  await db.query(`UPDATE public.vendor_services SET daily_capacity = $2, is_active = TRUE WHERE vendor_service_id = $1`, [
    s.rows[0]!.s,
    dailyCapacity,
  ]);
  return s.rows[0]!.s;
}

async function mkEvent(name: string): Promise<string> {
  return (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ($1, 'birthday', $2::date, 'day') RETURNING event_id AS e`,
      [name, DAY],
    )
  ).rows[0]!.e;
}

/** Another couple already BOOKED on the card on DAY. */
async function booked(shop: string, card: string): Promise<string> {
  const ev = await mkEvent('Booked couple');
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, 'misc', 'Per Date Studio', 'contracted', $2, $3) RETURNING vendor_id AS v`,
      [ev, shop, card],
    )
  ).rows[0]!.v;
}

/** A couple's open ask for the card on DAY — the row the supplier says yes to. */
async function ask(couple: string, shop: string, card: string): Promise<string> {
  const ev = await mkEvent('Asking couple');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [ev, couple]);
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id,
          lock_request_state, lock_requested_at, lock_requested_by_user_id)
       VALUES ($1, 'misc', 'Per Date Studio', 'considering', $2, $3, 'pending', NOW(), $4)
       RETURNING vendor_id AS v`,
      [ev, shop, card, couple],
    )
  ).rows[0]!.v;
}

async function agree(uid: string, rowId: string): Promise<{ status: string; daily_limit?: number }> {
  return asUser(uid, async () => (await db.query<{ r: { status: string; daily_limit?: number } }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [rowId])).rows[0]!.r);
}
async function verdict(uid: string, rowId: string): Promise<string | undefined> {
  return asUser(uid, async () => (await db.query<{ r: { verdict?: string } }>(`SELECT public.vendor_day_check($1) AS r`, [rowId])).rows[0]!.r.verdict);
}
async function limitOf(card: string): Promise<number | null> {
  return asService(async () => (await db.query<{ n: number | null }>(`SELECT public.service_card_daily_limit($1) AS n`, [card])).rows[0]!.n);
}
async function bookingsOn(card: string): Promise<number> {
  return asService(async () => (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [card, DAY])).rows[0]!.n);
}

let couple = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  couple = await mkUser('couple', 'customer');
});

after(async () => {
  await db?.close();
});

test('2026-11-18 · bookings per date are NOT a plan limit: no tier serves a number for it (ruling 17)', async () => {
  // Owner, verbatim: "a cake business can handle 30 cakes in a day. So they need to purchase unlimited from us. I think
  // that is wrong pricing." Migration supplier_plans_rebuilt_2026_11_18 removed the key and the admin rows.
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    const r = await db.query<{ n: number | null }>(`SELECT public.vendor_tier_limit($1,'bookings_per_date_per_service') AS n`, [tier]);
    assert.equal(r.rows[0]!.n, null, `${tier} still serves a plan cap on bookings per date`);
    assert.equal('bookingsPerDatePerService' in TIER_CAPS[tier], false, `${tier}: TIER_CAPS carries the cap again`);
  }
  const rows = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_plan_contents WHERE key = 'bookings_per_date_per_service'`);
  assert.equal(rows.rows[0]!.n, 0, 'an admin row for the retired allowance is still there');
});

test('a card’s OWN number governs on every plan — 30 cakes a day on Free, a blank card takes no plan number', async () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    const shop = await mkShop(`${tier} Cakes`, tier);
    assert.equal(await limitOf(await mkCard(shop.vpid, 30)), 30, `${tier}: a card's own 30 was held to a plan number`);
    assert.equal(await limitOf(await mkCard(shop.vpid, null)), null, `${tier}: a blank card took a plan number`);
  }
});

test('a card set to 1, booked once on a date, refuses the second booking — and the day check says so first', async () => {
  const shop = await mkShop('One A Day', 'pro');
  const card = await mkCard(shop.vpid, 1);
  await booked(shop.vpid, card);
  const second = await ask(couple, shop.vpid, card);
  assert.equal(await verdict(shop.uid, second), 'daily_limit_reached', 'the day check called a full date open');
  const r = await agree(shop.uid, second);
  assert.equal(r.status, 'daily_limit_reached', 'the second booking on a one-a-day card went through');
  assert.equal(r.daily_limit, 1);
  assert.equal(await bookingsOn(card), 1, 'the refused yes still booked');
});

test('a Free card set to 3 takes the third booking — the 2026-11-06 plan cap of 1 is gone', async () => {
  const shop = await mkShop('Free Three', 'free');
  const card = await mkCard(shop.vpid, 3);
  await booked(shop.vpid, card);
  await booked(shop.vpid, card);
  const third = await ask(couple, shop.vpid, card);
  assert.equal(await verdict(shop.uid, third), 'open', 'the day check held a Free card to a plan number');
  assert.equal((await agree(shop.uid, third)).status, 'ok', 'a Free card was held to a plan number');
  assert.equal(await bookingsOn(card), 3);
});

test('the first booking on an empty date goes through', async () => {
  const shop = await mkShop('Solo Open', 'solo');
  const card = await mkCard(shop.vpid, null);
  const first = await ask(couple, shop.vpid, card);
  assert.equal(await verdict(shop.uid, first), 'open');
  assert.equal((await agree(shop.uid, first)).status, 'ok');
});

test('an already-bought "+1 booking per date" raises nothing — there is no plan cap left to raise', async () => {
  const ultra = await mkShop('Bought Before', 'enterprise');
  const card = await mkCard(ultra.vpid, 4);
  await asService(() => db.query(`UPDATE public.vendor_profiles SET extra_bookings_per_date = 2 WHERE vendor_profile_id = $1`, [ultra.vpid]));
  assert.equal(await limitOf(card), 4, 'a bought count changed a card’s own number');
});

test('a shop cannot write its own add-on counts; the paid activation path can', async () => {
  const ultra = await mkShop('Self Grant', 'enterprise');
  for (const col of ['extra_parent_categories', 'extra_services_per_leaf', 'extra_waitlist_acceptances', 'extra_bookings_per_date']) {
    await assert.rejects(
      asUser(ultra.uid, () => db.query(`UPDATE public.vendor_profiles SET ${col} = 5 WHERE vendor_profile_id = $1`, [ultra.vpid])),
      /self-grant blocked/,
      `a shop gave itself ${col}`,
    );
  }
  // An ordinary edit still saves.
  await asUser(ultra.uid, () => db.query(`UPDATE public.vendor_profiles SET business_name = 'Renamed' WHERE vendor_profile_id = $1`, [ultra.vpid]));
  await asService(() => db.query(`UPDATE public.vendor_profiles SET extra_services_per_leaf = 2 WHERE vendor_profile_id = $1`, [ultra.vpid]));
  const r = await db.query<{ n: number }>(`SELECT extra_services_per_leaf AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [ultra.vpid]);
  assert.equal(r.rows[0]!.n, 2);
});

test('the waitlist has no plan limit — the shop sets up to the column’s 10; a bought count never passes it', async () => {
  const ultra = await mkShop('Wait Ultra', 'enterprise');
  await db.query(`UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = TRUE WHERE id = 1`);
  try {
    const set = async (n: number) => {
      await db.query(`UPDATE public.vendor_profiles SET waitlist_enabled = TRUE, max_waitlist_acceptances = $2 WHERE vendor_profile_id = $1`, [ultra.vpid, n]);
      return (await db.query<{ n: number }>(`SELECT max_waitlist_acceptances AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [ultra.vpid])).rows[0]!.n;
    };
    // No plan limit since 2026-11-18 (ruling 32): every plan's allowance is the column's own ceiling (10).
    assert.equal(TIER_CAPS.enterprise.waitlistAcceptances, 10);
    assert.equal(await set(9), 9, 'the shop’s own 9 was held to a plan number');
    await db.query(`UPDATE public.vendor_profiles SET extra_waitlist_acceptances = 2 WHERE vendor_profile_id = $1`, [ultra.vpid]);
    assert.equal(await set(10), 10, 'a bought count lowered the ceiling');
    await db.query(`UPDATE public.vendor_profiles SET extra_waitlist_acceptances = 50 WHERE vendor_profile_id = $1`, [ultra.vpid]);
    assert.equal(await set(10), 10, 'the ceiling went past the column’s own CHECK');
  } finally {
    await db.query(`UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = FALSE WHERE id = 1`);
  }
});

test('the seat and the branch stay on sale at the owner’s price; the four "+1" add-ons are retired by flag, never deleted', async () => {
  const r = await db.query<{ sku_code: string; php: string; offering_type: string; is_active: boolean; retired_at: string | null }>(
    `SELECT sku_code, price_php::text AS php, offering_type, is_active, retired_at::text FROM public.vendor_billing_catalog
      WHERE sku_code IN ('vendor_extra_seat','vendor_additional_branch','vendor_extra_category',
                         'vendor_extra_service_card','vendor_extra_waitlist','vendor_extra_booking_per_date')`,
  );
  const by = new Map(r.rows.map((x) => [x.sku_code, x]));
  // Owner, verbatim (2026-11-06): "seat, branch + 990 / the rest is +199". 2026-11-14 ("SIMPLER SUPPLIER PLANS"): only
  // the seat and the branch are left to buy; the rest folded into Ultra's limits — kept, priced, off sale.
  const want: Array<[string, number, string, boolean]> = [
    ['vendor_extra_seat', 990, 'seat', true],
    ['vendor_additional_branch', 990, 'branch', true],
    ['vendor_extra_category', 199, 'category', false],
    ['vendor_extra_service_card', 199, 'service_card', false],
    ['vendor_extra_waitlist', 199, 'waitlist', false],
    ['vendor_extra_booking_per_date', 199, 'booking_per_date', false],
  ];
  for (const [sku, php, type, onSale] of want) {
    const row = by.get(sku);
    assert.ok(row, `${sku} is missing — a retired row is never deleted`);
    assert.equal(Number(row.php), php, `${sku} price`);
    assert.equal(row.offering_type, type, `${sku} offering_type`);
    assert.equal(row.is_active, onSale, `${sku} ${onSale ? 'is not on sale' : 'is still on sale'}`);
    if (!onSale) assert.ok(row.retired_at, `${sku} is off sale with no retired_at`);
  }
  const old = await db.query<{ is_active: boolean; replaced_by_sku_code: string | null }>(
    `SELECT is_active, replaced_by_sku_code FROM public.vendor_billing_catalog WHERE sku_code = 'vendor_service_cards_2'`,
  );
  assert.equal(old.rows[0]?.is_active, false, 'the superseded +2 cards row went on sale');
  assert.equal(old.rows[0]?.replaced_by_sku_code, 'vendor_extra_service_card');
});

test('2026-11-14 · the day is counted PER SERVICE: two cards of one service at one branch share it; another service does not', async () => {
  // Owner 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS" item 5: "Bookings are counted per service per branch, not
  // per card." service_card_bookings_on is the one count every reader uses.
  // Each card set to 1 a day (the shop's own number — no plan cap since 2026-11-18).
  const shop = await mkShop('Per Service', 'solo');
  const a = await mkCard(shop.vpid, 1); // photo_booth, no branch
  const b = await mkCard(shop.vpid, 1); // the same service, the same (main) branch
  const other = await mkCard(shop.vpid, 1);
  await asService(() => db.query(`UPDATE public.vendor_services SET category = 'photography' WHERE vendor_service_id = $1`, [other]));
  await booked(shop.vpid, a);
  assert.equal(await bookingsOn(b), 1, 'a booking on card A did not count for card B of the same service');
  assert.equal(await bookingsOn(other), 0, 'a booking of another service counted');
  const onB = await ask(couple, shop.vpid, b);
  assert.equal(await verdict(shop.uid, onB), 'daily_limit_reached', 'the day check called the service’s full date open');
  assert.equal((await agree(shop.uid, onB)).status, 'daily_limit_reached', 'a second card of the same service took the date past its number');
  // Another service's day is its own: its count stays 0, so its limit is never what refuses it.
  assert.ok((await bookingsOn(other)) < ((await limitOf(other)) ?? 0), 'another service reads as full');
});
