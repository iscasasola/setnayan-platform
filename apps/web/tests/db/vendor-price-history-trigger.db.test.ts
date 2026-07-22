/**
 * vendor_service_price_history capture trigger — end-to-end (test:db, migrations
 * replayed). Proves the AFTER UPDATE trigger on vendor_services actually logs a
 * price change (the Setnayan AI GRD-03 guard's data source), and that demo
 * services + no-op updates are skipped. The pure snapshot mapping is covered in
 * setnayan-ai-snapshot.test.ts; this locks the DB half.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function newVendor(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, 'Price Test Vendor', 'Manila', ARRAY['photography']::text[])
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newService(vendorId: string, price: number, isDemo = false): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, is_demo)
     VALUES ($1, 'photography', $2, $3) RETURNING vendor_service_id`,
    [vendorId, price, isDemo],
  );
  return r.rows[0]!.vendor_service_id;
}

async function historyCount(vendorId: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.vendor_service_price_history WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  return r.rows[0]!.c;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('a real price change logs a history row (old → new); a no-op update logs nothing', async () => {
  const vendor = await newVendor('price-a@vsph.test');
  const svc = await newService(vendor, 20000);
  assert.equal(await historyCount(vendor), 0, 'inserting a service logs nothing (trigger is UPDATE-only)');

  await db.query(
    `UPDATE public.vendor_services SET starting_price_php = 25000 WHERE vendor_service_id = $1`,
    [svc],
  );
  const rows = await db.query<{ old_price_php: number; new_price_php: number }>(
    `SELECT old_price_php, new_price_php
       FROM public.vendor_service_price_history WHERE vendor_profile_id = $1`,
    [vendor],
  );
  assert.equal(rows.rows.length, 1, 'a price change logs exactly one row');
  assert.equal(rows.rows[0]!.old_price_php, 20000);
  assert.equal(rows.rows[0]!.new_price_php, 25000);

  // Same price again → IS DISTINCT FROM is false → no new row.
  await db.query(
    `UPDATE public.vendor_services SET starting_price_php = 25000 WHERE vendor_service_id = $1`,
    [svc],
  );
  assert.equal(await historyCount(vendor), 1, 'unchanged price → no new row');
});

test('a DEMO service price change is NOT logged (20270911239524 skip-demo)', async () => {
  const vendor = await newVendor('demo@vsph.test');
  const svc = await newService(vendor, 10000, true);
  await db.query(
    `UPDATE public.vendor_services SET starting_price_php = 12000 WHERE vendor_service_id = $1`,
    [svc],
  );
  assert.equal(await historyCount(vendor), 0, 'demo service → no history row');
});
