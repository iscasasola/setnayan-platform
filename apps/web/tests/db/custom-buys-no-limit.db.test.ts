/**
 * "2500 FOR NO LIMIT" — DB verification (migrations replayed).
 * Covers 20271182153977_custom_buys_no_limit.
 *
 * Owner 2026-08-29, asked what going past the 10-customers-per-date ceiling
 * should cost: **"2500 for no limit."**
 *
 * The claim under test is NOT "the axis exists" — a catalogue row, a quote line
 * and a stored flag can all exist while the database goes on refusing the
 * eleventh customer, which is exactly the shape of every "gate with no handle"
 * in this schema, sold instead of switched off. So every assertion here drives a
 * REAL accept through the trigger.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(`SET TIME ZONE 'UTC'`);
  // The ceilings are ON in production since 2026-08-29 (owner), so that is the
  // state worth testing. Every test here sets it explicitly anyway.
  await db.query(
    `UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = TRUE WHERE id = 1`,
  );
});

after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = (label: string) => `${label}-${++seq}`;

async function newVendor(
  label: string,
  tier: string,
): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@nolimit.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id
    ?? (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'No Limit Test Shop', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  // free → custom in one step: vendor_tier_rank orders custom highest, so this
  // is an upgrade and guard_vendor_tier_no_silent_downgrade permits it.
  await db.query(
    `UPDATE public.vendor_profiles
        SET services = ARRAY['photography']::text[],
            verification_state = 'verified', last_verified_at = NOW(),
            tier_state = $2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId, tier],
  );
  return { vendorProfileId, userId };
}

/** Compose an ACTIVE Custom plan, with or without the axis. */
async function activePlan(vendorProfileId: string, pipelineUnlimited: boolean): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_custom_plans
       (vendor_profile_id, composition, quoted_28d_php, status)
     VALUES ($1, $2::jsonb, 13500, 'active')`,
    [
      vendorProfileId,
      JSON.stringify({
        branches: 1,
        reachKm: 100,
        nationwide: false,
        seats: 10,
        slotsPerCategory: 8,
        photos: 300,
        domain: false,
        ...(pipelineUnlimited ? { pipelineUnlimited: true } : {}),
      }),
    ],
  );
}

async function newEvent(label: string, date: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [uniq(label), date],
  );
  return r.rows[0]!.event_id;
}

/** Accept N fresh couples on one date; returns the first refusal, or null. */
async function acceptN(
  vendorProfileId: string,
  date: string,
  n: number,
  label: string,
): Promise<string | null> {
  for (let i = 0; i < n; i++) {
    const eventId = await newEvent(`${label}-${i}`, date);
    const t = await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id)
       VALUES ($1, $2) RETURNING thread_id`,
      [eventId, vendorProfileId],
    );
    try {
      await db.query(
        `UPDATE public.chat_threads
            SET inquiry_status = 'accepted'::public.chat_inquiry_status
          WHERE thread_id = $1`,
        [t.rows[0]!.thread_id],
      );
    } catch (e) {
      return String((e as Error).message);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The ceiling, and buying it away
// ─────────────────────────────────────────────────────────────────────────────

test('CONTROL: a Custom shop without the axis is still stopped at 10', async () => {
  // Without this the next test proves nothing — an accept that was never going
  // to be refused passes whether or not the axis works.
  const shop = await newVendor('capped', 'custom');
  await activePlan(shop.vendorProfileId, false);
  const err = await acceptN(shop.vendorProfileId, '2027-07-07', 11, 'capped');
  assert.match(String(err), /WHITELIST_DATE_LIMIT/, 'the eleventh must be refused');
  assert.match(String(err), /10 client/, 'and the refusal must quote the ceiling it enforced');
});

test('a Custom shop that bought "no limit" is not stopped at 10', async () => {
  const shop = await newVendor('unlimited', 'custom');
  await activePlan(shop.vendorProfileId, true);
  assert.equal(
    await acceptN(shop.vendorProfileId, '2027-07-08', 14, 'unlimited'),
    null,
    'fourteen on one date, and none of them refused',
  );
});

test('a plan composed BEFORE the axis existed reads as NOT granted', async () => {
  // The composition JSON simply has no such key. It must fail CLOSED — a missing
  // key is not a purchase.
  const shop = await newVendor('legacyplan', 'custom');
  await db.query(
    `INSERT INTO public.vendor_custom_plans
       (vendor_profile_id, composition, quoted_28d_php, status)
     VALUES ($1, '{"branches":1,"seats":10,"slotsPerCategory":8,"photos":300}'::jsonb, 11000, 'active')`,
    [shop.vendorProfileId],
  );
  const r = await db.query<{ b: boolean }>(
    `SELECT public.vendor_pipeline_is_unlimited($1) AS b`,
    [shop.vendorProfileId],
  );
  assert.equal(r.rows[0]!.b, false);
});

test('a plan that is NOT active does not grant it', async () => {
  const shop = await newVendor('draft', 'custom');
  await db.query(
    `INSERT INTO public.vendor_custom_plans
       (vendor_profile_id, composition, quoted_28d_php, status)
     VALUES ($1, '{"pipelineUnlimited":true}'::jsonb, 13500, 'draft')`,
    [shop.vendorProfileId],
  );
  const r = await db.query<{ b: boolean }>(
    `SELECT public.vendor_pipeline_is_unlimited($1) AS b`,
    [shop.vendorProfileId],
  );
  assert.equal(r.rows[0]!.b, false, 'a quote nobody has paid for is not an entitlement');
  const err = await acceptN(shop.vendorProfileId, '2027-07-09', 11, 'draft');
  assert.match(String(err), /WHITELIST_DATE_LIMIT/);
});

test('THE WAITLIST IS LIFTED TOO — one axis, both ceilings', async () => {
  // ⚠ THIS ASSERTION WAS INVERTED HOURS AFTER IT WAS WRITTEN, BY THE OWNER. It
  // read "THE WAITLIST IS NOT LIFTED — it is a different list and a different
  // decision", which was the correct and deliberate scope of 20271182153977: he
  // had been asked about the 10 customers CHASED per date and had answered about
  // the 10, so the BOOKED-OUT WAITLIST was named to him as a separate list
  // needing its own ruling rather than assumed into the same purchase.
  //
  // He made the ruling: **"yes wait list add them"**. One axis now removes both
  // per-date ceilings. The test is inverted rather than deleted, because it is
  // still the thing that proves the scope is what the owner said it is — in the
  // other direction.
  const shop = await newVendor('waitlist', 'custom');
  await activePlan(shop.vendorProfileId, true);
  await db.query(
    `UPDATE public.vendor_profiles
        SET waitlist_enabled = TRUE, max_waitlist_acceptances = 9
      WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  const r = await db.query<{ n: number; on: boolean }>(
    `SELECT max_waitlist_acceptances AS n, waitlist_enabled AS on
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 9, 'not clamped to Custom’s 5 — the shop paid for no ceiling');
  assert.equal(r.rows[0]!.on, true);
});

test('CONTROL: a Custom shop WITHOUT the axis is still clamped to 5', async () => {
  // Without this control the test above passes whether or not the axis is read.
  const shop = await newVendor('waitlist-capped', 'custom');
  await activePlan(shop.vendorProfileId, false);
  await db.query(
    `UPDATE public.vendor_profiles
        SET waitlist_enabled = TRUE, max_waitlist_acceptances = 9
      WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  const r = await db.query<{ n: number }>(
    `SELECT max_waitlist_acceptances AS n FROM public.vendor_profiles
      WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 5, 'Custom holds 5 without the axis');
});

test('the axis raises a ceiling — it never conjures a waiting list from nothing', async () => {
  // A plan whose allowance is ZERO has no waiting list as a FEATURE, not as a
  // number. The zero arm is checked BEFORE the no-limit arm for exactly this
  // reason. Custom's base is 5, so this is belt and braces today — which is
  // precisely when an ordering gets written down wrong.
  const shop = await newVendor('freeplan', 'free'); // free: waitlist allowance 0
  await db.query(
    `INSERT INTO public.vendor_custom_plans
       (vendor_profile_id, composition, quoted_28d_php, status)
     VALUES ($1, '{"pipelineUnlimited":true}'::jsonb, 13500, 'active')`,
    [shop.vendorProfileId],
  );
  await db.query(
    `UPDATE public.vendor_profiles
        SET waitlist_enabled = TRUE, max_waitlist_acceptances = 3
      WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  const r = await db.query<{ n: number; on: boolean }>(
    `SELECT max_waitlist_acceptances AS n, waitlist_enabled AS on
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 0, 'a plan with no waiting list still has none');
  assert.equal(r.rows[0]!.on, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// The screen stops counting down to a ceiling that is gone
// ─────────────────────────────────────────────────────────────────────────────

test('the pressure line goes SILENT for an unlimited shop', async () => {
  // A gate lifted in the database and not on the screen is a refusal a person is
  // told about and never receives — it invites them to decline a real customer
  // to free a slot they do not need.
  const shop = await newVendor('quiet', 'custom');
  await activePlan(shop.vendorProfileId, true);
  const eventId = await newEvent('quiet-ev', '2027-07-10');
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING thread_id`,
    [eventId, shop.vendorProfileId],
  );
  await setAuthUid(db, shop.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query(`SELECT * FROM public.vendor_whitelist_pressure($1)`, [
      t.rows[0]!.thread_id,
    ]);
    assert.equal(r.rows.length, 0, 'no ceiling ⇒ nothing to draw');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

test('CONTROL: the same read DOES answer for a capped Custom shop', async () => {
  const shop = await newVendor('loud', 'custom');
  await activePlan(shop.vendorProfileId, false);
  const eventId = await newEvent('loud-ev', '2027-07-11');
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING thread_id`,
    [eventId, shop.vendorProfileId],
  );
  await setAuthUid(db, shop.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<{ cap: number }>(
      `SELECT cap FROM public.vendor_whitelist_pressure($1)`,
      [t.rows[0]!.thread_id],
    );
    assert.equal(r.rows.length, 1, 'the silence above must be the AXIS, not a broken read');
    assert.equal(Number(r.rows[0]!.cap), 10);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Price + reach
// ─────────────────────────────────────────────────────────────────────────────

test('the axis is a ₱2,500 active catalogue row', async () => {
  const r = await db.query<{ p: string; t: string; a: boolean }>(
    `SELECT price_php::text AS p, offering_type AS t, is_active AS a
       FROM public.vendor_billing_catalog
      WHERE sku_code = 'vendor_custom_pipeline_unlimited'`,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(Number(r.rows[0]!.p), 2500, 'owner 2026-08-29: "2500 for no limit"');
  assert.equal(r.rows[0]!.t, 'custom_addon');
  assert.equal(r.rows[0]!.a, true);
});

test('the entitlement question is not answerable by a signed-in user', async () => {
  // It takes a vendor_profile_id, so a grant would answer about any shop.
  const r = await db.query<{ a: boolean; b: boolean }>(
    `SELECT has_function_privilege('authenticated','public.vendor_pipeline_is_unlimited(uuid)','EXECUTE') AS a,
            has_function_privilege('anon','public.vendor_pipeline_is_unlimited(uuid)','EXECUTE') AS b`,
  );
  assert.equal(r.rows[0]!.a, false);
  assert.equal(r.rows[0]!.b, false);
});
