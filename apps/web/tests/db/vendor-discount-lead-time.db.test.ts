/**
 * vendor_service_discounts.min_lead_months — DB-level regression (executed, not
 * prose).
 *
 * Guards migration 20271017996549_vendor_service_discount_lead_time_tiers.sql —
 * the early-booking LADDER (owner-locked 2026-07-27, DECISION_LOG "MAKER IS
 * ZERO STEPS" ruling ②). It ADDs one nullable INT to vendor_service_discounts
 * so several `early_booking` rows on one service can each carry their own
 * threshold, and teaches save_vendor_service (the WIZARD's write path) to
 * persist it.
 *
 * Verified against the FULL replayed prod schema (all migrations, in order, in
 * an in-memory PGlite — no docker, no network). The PGlite session owns the
 * tables, so it bypasses RLS; this test exercises the schema shape, the CHECK,
 * legacy-row compatibility, and the RPC round-trip — not the policies.
 *
 * ⚠ ON NOT BEING VACUOUS: `schema_migrations` can record a migration as APPLIED
 * while its columns never landed. Every assertion below reads the OBJECT.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let vendorId: string;
let serviceId: string;

async function newVendor(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, 'Lead-Time Ladder Vendor', 'Manila', ARRAY['photography']::text[])
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newService(vendor: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php)
     VALUES ($1, 'photography', 50000) RETURNING vendor_service_id`,
    [vendor],
  );
  return r.rows[0]!.vendor_service_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  vendorId = await newVendor('ladder@vsd.test');
  serviceId = await newService(vendorId);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the lead-time add (no unapplied files)', () => {
  // A syntax error or a failing POST-CONDITION block in the new migration would
  // have thrown inside createReplayedDb before this line ever ran.
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('min_lead_months exists, is integer, and is NULLABLE', async () => {
  const cols = await db.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'vendor_service_discounts'
        AND column_name  = 'min_lead_months'`,
  );
  assert.equal(cols.rows.length, 1, 'the column landed');
  assert.equal(cols.rows[0]!.data_type, 'integer');
  assert.equal(cols.rows[0]!.is_nullable, 'YES', 'NULL = no threshold = legacy behaviour');
  assert.equal(cols.rows[0]!.column_default, null, 'no default — absence must stay absence');
});

test('the CHECK rejects 0 (and negatives): a rung below 1 month is meaningless', async () => {
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.vendor_service_discounts
           (vendor_service_id, vendor_profile_id, discount_type, rate, unit, min_lead_months)
         VALUES ($1, $2, 'early_booking', 10, 'pct', 0)`,
        [serviceId, vendorId],
      ),
    /violates check constraint|check constraint/i,
    '0 must be refused by the DB, not just by the form',
  );

  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.vendor_service_discounts
           (vendor_service_id, vendor_profile_id, discount_type, rate, unit, min_lead_months)
         VALUES ($1, $2, 'early_booking', 10, 'pct', -6)`,
        [serviceId, vendorId],
      ),
    /violates check constraint|check constraint/i,
    'negatives must be refused too',
  );
});

test('1 is accepted — the CHECK is >= 1, not > 1', async () => {
  const r = await db.query<{ min_lead_months: number }>(
    `INSERT INTO public.vendor_service_discounts
       (vendor_service_id, vendor_profile_id, discount_type, rate, unit, min_lead_months)
     VALUES ($1, $2, 'early_booking', 5, 'pct', 1)
     RETURNING min_lead_months`,
    [serviceId, vendorId],
  );
  assert.equal(r.rows[0]!.min_lead_months, 1);
  await db.query(`DELETE FROM public.vendor_service_discounts WHERE vendor_service_id = $1`, [
    serviceId,
  ]);
});

test('LEGACY rows insert fine with the column omitted → NULL', async () => {
  // The exact INSERT shape that shipped before this migration. If the column
  // had landed NOT NULL, or with a default, this would break every existing
  // writer in the app.
  const r = await db.query<{ min_lead_months: number | null }>(
    `INSERT INTO public.vendor_service_discounts
       (vendor_service_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order)
     VALUES ($1, $2, 'early_booking', 10, 'pct', NULL, 'Book >= 6 months ahead', 0)
     RETURNING min_lead_months`,
    [serviceId, vendorId],
  );
  assert.equal(r.rows[0]!.min_lead_months, null, 'omitted → NULL, no threshold');
  await db.query(`DELETE FROM public.vendor_service_discounts WHERE vendor_service_id = $1`, [
    serviceId,
  ]);
});

test('an explicit NULL is accepted (the CHECK admits it)', async () => {
  const r = await db.query<{ min_lead_months: number | null }>(
    `INSERT INTO public.vendor_service_discounts
       (vendor_service_id, vendor_profile_id, discount_type, rate, unit, min_lead_months)
     VALUES ($1, $2, 'off_peak', 8, 'pct', NULL)
     RETURNING min_lead_months`,
    [serviceId, vendorId],
  );
  assert.equal(r.rows[0]!.min_lead_months, null);
  await db.query(`DELETE FROM public.vendor_service_discounts WHERE vendor_service_id = $1`, [
    serviceId,
  ]);
});

test('a two-rung LADDER persists both thresholds on one service', async () => {
  await db.query(
    `INSERT INTO public.vendor_service_discounts
       (vendor_service_id, vendor_profile_id, discount_type, rate, unit, min_lead_months, sort_order)
     VALUES ($1, $2, 'early_booking', 15, 'pct', 12, 0),
            ($1, $2, 'early_booking', 10, 'pct',  6, 1)`,
    [serviceId, vendorId],
  );
  const r = await db.query<{ rate: string; min_lead_months: number }>(
    `SELECT rate, min_lead_months FROM public.vendor_service_discounts
      WHERE vendor_service_id = $1 ORDER BY sort_order`,
    [serviceId],
  );
  assert.deepEqual(
    r.rows.map((x) => [Number(x.rate), x.min_lead_months]),
    [
      [15, 12],
      [10, 6],
    ],
  );
  await db.query(`DELETE FROM public.vendor_service_discounts WHERE vendor_service_id = $1`, [
    serviceId,
  ]);
});

test('save_vendor_service (the WIZARD path) persists the ladder, not just the rates', async () => {
  // The regression this test exists for: the inline My Shop form writes via
  // replaceServiceLists, but the wizard writes through this RPC. If the RPC's
  // discounts INSERT ignores min_lead_months, a vendor authors a ladder in the
  // wizard and silently gets thresholdless rows.
  const saved = await db.query<{ save_vendor_service: string }>(
    `SELECT public.save_vendor_service(
       $1::uuid, NULL::uuid,
       jsonb_build_object(
         'category','photography',
         'starting_price_php','60000',
         'exclusive_perk_text','Free engagement shoot'
       ),
       '[]'::jsonb,
       '[]'::jsonb,
       $2::jsonb,
       '[]'::jsonb,
       '[]'::jsonb,
       TRUE
     )`,
    [
      vendorId,
      JSON.stringify([
        { discount_type: 'early_booking', rate: 15, unit: 'pct', min_lead_months: 12, sort_order: 0 },
        { discount_type: 'early_booking', rate: 10, unit: 'pct', min_lead_months: 6, sort_order: 1 },
        { discount_type: 'off_peak', rate: 5, unit: 'pct', sort_order: 2 },
      ]),
    ],
  );
  const newServiceId = saved.rows[0]!.save_vendor_service;

  const r = await db.query<{
    discount_type: string;
    rate: string;
    min_lead_months: number | null;
  }>(
    `SELECT discount_type, rate, min_lead_months
       FROM public.vendor_service_discounts
      WHERE vendor_service_id = $1 ORDER BY sort_order`,
    [newServiceId],
  );
  assert.deepEqual(
    r.rows.map((x) => [x.discount_type, Number(x.rate), x.min_lead_months]),
    [
      ['early_booking', 15, 12],
      ['early_booking', 10, 6],
      // A key the caller omitted stays NULL — no accidental threshold.
      ['off_peak', 5, null],
    ],
  );
});
