/**
 * BOOKINGS PER DATE PER SERVICE IS A PLAN ALLOWANCE — owner 2026-11-06 (DECISION_LOG), verbatim: *"Solo has 1 per
 * date/service, pro has 3 per date/service, ultra has 5 per date/service"*. And "ULTRA ADD-ON PRICES": Ultra buys
 * "+1 booking per date" (and +1 wait list, +1 category, +1 service card). Migration 20271316466285.
 *
 * Proven as a REAL `authenticated` supplier session against the replayed migrations — the same way
 * the-day-check-agrees-with-the-yes.db.test.ts proves the yes:
 *   · a SOLO card already booked once on a date REFUSES the second booking (`daily_limit_reached`), and the day check
 *     says so before the tap;
 *   · a BLANK Solo card takes the plan's one, not "no limit";
 *   · a Solo card whose own number is higher (3) is held to 1 — and the bookings it already holds are kept
 *     (grandfathered: nothing is cancelled, only the NEW one is refused);
 *   · Pro takes 3, Ultra 5, and Ultra's bought "+1 booking per date" raises it;
 *   · FREE / VERIFIED take 1 each, like Solo (owner click 2026-11-06, "BOOKINGS PER DATE PER SERVICE — FREE AND
 *     VERIFIED") — a Free card booked once refuses the second, and the bookings it already holds are kept;
 *   · a shop cannot write its own add-on counts (the entitlement guard), the activation path (service_role) can;
 *   · the waitlist ceiling counts the bought "+1 wait list".
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

test('the SQL twin says exactly what TIER_CAPS says — Free 1 · Verified 1 · Solo 1 · Pro 3 · Ultra 5', async () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    const r = await db.query<{ n: number | null }>(`SELECT public.vendor_tier_limit($1,'bookings_per_date_per_service') AS n`, [tier]);
    assert.equal(r.rows[0]!.n, TIER_CAPS[tier].bookingsPerDatePerService, `${tier}`);
  }
  assert.equal(TIER_CAPS.free.bookingsPerDatePerService, 1, 'owner click: Free "1 each, like Solo"');
  assert.equal(TIER_CAPS.verified.bookingsPerDatePerService, 1, 'owner click: Verified "1 each, like Solo"');
  assert.equal(TIER_CAPS.solo.bookingsPerDatePerService, 1, 'owner: "Solo has 1 per date/service"');
  assert.equal(TIER_CAPS.pro.bookingsPerDatePerService, 3, 'owner: "pro has 3 per date/service"');
  assert.equal(TIER_CAPS.enterprise.bookingsPerDatePerService, 5, 'owner: "ultra has 5 per date/service"');
});

test('a SOLO card booked once on a date refuses the second booking — and the day check says so first', async () => {
  const shop = await mkShop('Solo Studio', 'solo');
  const card = await mkCard(shop.vpid, null); // blank → the plan's one
  assert.equal(await limitOf(card), 1, 'a blank Solo card does not take the plan’s one');
  await booked(shop.vpid, card);
  const second = await ask(couple, shop.vpid, card);
  assert.equal(await verdict(shop.uid, second), 'daily_limit_reached', 'the day check called a full Solo date open');
  const r = await agree(shop.uid, second);
  assert.equal(r.status, 'daily_limit_reached', 'the second booking on a Solo card went through');
  assert.equal(r.daily_limit, 1);
  assert.equal(await bookingsOn(card), 1, 'the refused yes still booked');
});

test('a SOLO card set higher than its plan is held to 1 — and keeps the bookings it already holds', async () => {
  const shop = await mkShop('Solo Over', 'solo');
  const card = await mkCard(shop.vpid, 3); // set before the ruling
  await booked(shop.vpid, card);
  await booked(shop.vpid, card); // two bookings held from before
  assert.equal(await limitOf(card), 1);
  const third = await ask(couple, shop.vpid, card);
  assert.equal((await agree(shop.uid, third)).status, 'daily_limit_reached');
  assert.equal(await bookingsOn(card), 2, 'a booking the card already held was touched');
});

test('the first booking on an empty Solo date goes through', async () => {
  const shop = await mkShop('Solo Open', 'solo');
  const card = await mkCard(shop.vpid, null);
  const first = await ask(couple, shop.vpid, card);
  assert.equal(await verdict(shop.uid, first), 'open');
  assert.equal((await agree(shop.uid, first)).status, 'ok');
});

test('Pro takes 3, Ultra 5, and Ultra’s bought "+1 booking per date" raises it', async () => {
  const pro = await mkShop('Pro Studio', 'pro');
  assert.equal(await limitOf(await mkCard(pro.vpid, null)), 3);
  assert.equal(await limitOf(await mkCard(pro.vpid, 2)), 2, 'a card’s own lower number stopped counting');
  assert.equal(await limitOf(await mkCard(pro.vpid, 9)), 3);

  const ultra = await mkShop('Ultra Studio', 'enterprise');
  const card = await mkCard(ultra.vpid, null);
  assert.equal(await limitOf(card), 5);
  await asService(() => db.query(`UPDATE public.vendor_profiles SET extra_bookings_per_date = 2 WHERE vendor_profile_id = $1`, [ultra.vpid]));
  assert.equal(await limitOf(card), 7, 'a bought +1 booking per date did not raise the cap');

  // Only Ultra (and Custom) buy it — a count on any other plan's row never counts.
  const proWithCount = await mkShop('Pro With Count', 'pro');
  await asService(() => db.query(`UPDATE public.vendor_profiles SET extra_bookings_per_date = 2 WHERE vendor_profile_id = $1`, [proWithCount.vpid]));
  assert.equal(await limitOf(await mkCard(proWithCount.vpid, null)), 3);
});

test('FREE and VERIFIED take 1 each, like Solo — the second booking is refused, held bookings are kept', async () => {
  // Owner click 2026-11-06, DECISION_LOG "BOOKINGS PER DATE PER SERVICE — FREE AND VERIFIED": "1 each, like Solo".
  for (const tier of ['free', 'verified'] as const) {
    const shop = await mkShop(`${tier} Studio`, tier);
    assert.equal(await limitOf(await mkCard(shop.vpid, null)), 1, `a blank ${tier} card does not take the plan’s one`);
    assert.equal(await limitOf(await mkCard(shop.vpid, 4)), 1, `a ${tier} card’s own 4 was not held to 1`);

    // The first booking on an empty date goes through. (One shop per scenario, like the Solo tests above: an open ask
    // left on a shop's date makes the next yes there answer 'resolve_others_first'.)
    const openShop = await mkShop(`${tier} Open`, tier);
    const open = await mkCard(openShop.vpid, null);
    const first = await ask(couple, openShop.vpid, open);
    assert.equal(await verdict(openShop.uid, first), 'open', `${tier}: an empty date was not open`);
    assert.equal((await agree(openShop.uid, first)).status, 'ok', `${tier}: the first booking was refused`);

    // Booked once → the second is refused, and the day check says so first.
    const card = await mkCard(shop.vpid, null);
    await booked(shop.vpid, card);
    const second = await ask(couple, shop.vpid, card);
    assert.equal(await verdict(shop.uid, second), 'daily_limit_reached', `${tier}: the day check called a full date open`);
    const r = await agree(shop.uid, second);
    assert.equal(r.status, 'daily_limit_reached', `${tier}: the second booking on one card went through`);
    assert.equal(r.daily_limit, 1);
    assert.equal(await bookingsOn(card), 1, `${tier}: the refused yes still booked`);

    // Grandfathered: a card set to 3 before the ruling keeps the 2 it holds; only the NEW one is refused.
    const overShop = await mkShop(`${tier} Over`, tier);
    const over = await mkCard(overShop.vpid, 3);
    await booked(overShop.vpid, over);
    await booked(overShop.vpid, over);
    assert.equal((await agree(overShop.uid, await ask(couple, overShop.vpid, over))).status, 'daily_limit_reached');
    assert.equal(await bookingsOn(over), 2, `${tier}: a booking the card already held was touched`);

    // A bought count on a Free/Verified row never counts (Ultra/Custom only).
    await asService(() => db.query(`UPDATE public.vendor_profiles SET extra_bookings_per_date = 2 WHERE vendor_profile_id = $1`, [shop.vpid]));
    assert.equal(await limitOf(await mkCard(shop.vpid, null)), 1, `${tier}: a bought count raised a non-Ultra cap`);
  }
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

test('the waitlist ceiling counts the bought "+1 wait list" (Ultra), held under the column’s 10', async () => {
  const ultra = await mkShop('Wait Ultra', 'enterprise');
  await db.query(`UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = TRUE WHERE id = 1`);
  try {
    const set = async (n: number) => {
      await db.query(`UPDATE public.vendor_profiles SET waitlist_enabled = TRUE, max_waitlist_acceptances = $2 WHERE vendor_profile_id = $1`, [ultra.vpid, n]);
      return (await db.query<{ n: number }>(`SELECT max_waitlist_acceptances AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [ultra.vpid])).rows[0]!.n;
    };
    assert.equal(await set(9), TIER_CAPS.enterprise.waitlistAcceptances, 'Ultra’s own number');
    await db.query(`UPDATE public.vendor_profiles SET extra_waitlist_acceptances = 2 WHERE vendor_profile_id = $1`, [ultra.vpid]);
    assert.equal(await set(9), TIER_CAPS.enterprise.waitlistAcceptances + 2, 'a bought +1 wait list did not raise the ceiling');
    await db.query(`UPDATE public.vendor_profiles SET extra_waitlist_acceptances = 50 WHERE vendor_profile_id = $1`, [ultra.vpid]);
    assert.equal(await set(10), 10, 'the ceiling went past the column’s own CHECK');
  } finally {
    await db.query(`UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = FALSE WHERE id = 1`);
  }
});

test('the catalogue holds every Ultra add-on at the owner’s price, each on sale', async () => {
  const r = await db.query<{ sku_code: string; php: string; offering_type: string; is_active: boolean }>(
    `SELECT sku_code, price_php::text AS php, offering_type, is_active FROM public.vendor_billing_catalog
      WHERE sku_code IN ('vendor_extra_seat','vendor_additional_branch','vendor_extra_category',
                         'vendor_extra_service_card','vendor_extra_waitlist','vendor_extra_booking_per_date')`,
  );
  const by = new Map(r.rows.map((x) => [x.sku_code, x]));
  // Owner, verbatim: "seat, branch + 990 / the rest is +199".
  const want: Array<[string, number, string]> = [
    ['vendor_extra_seat', 990, 'seat'],
    ['vendor_additional_branch', 990, 'branch'],
    ['vendor_extra_category', 199, 'category'],
    ['vendor_extra_service_card', 199, 'service_card'],
    ['vendor_extra_waitlist', 199, 'waitlist'],
    ['vendor_extra_booking_per_date', 199, 'booking_per_date'],
  ];
  for (const [sku, php, type] of want) {
    const row = by.get(sku);
    assert.ok(row, `${sku} is missing`);
    assert.equal(Number(row.php), php, `${sku} price`);
    assert.equal(row.offering_type, type, `${sku} offering_type`);
    assert.equal(row.is_active, true, `${sku} is not on sale`);
  }
  const old = await db.query<{ is_active: boolean; replaced_by_sku_code: string | null }>(
    `SELECT is_active, replaced_by_sku_code FROM public.vendor_billing_catalog WHERE sku_code = 'vendor_service_cards_2'`,
  );
  assert.equal(old.rows[0]?.is_active, false, 'the superseded +2 cards row went on sale');
  assert.equal(old.rows[0]?.replaced_by_sku_code, 'vendor_extra_service_card');
});
