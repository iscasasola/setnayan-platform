/**
 * 🪑 A7-17 (final check, 25 Nov 2026 · migration 20271363213887_supplier_seat_plan_sends_removed_seats).
 *
 * The supplier's seat plan read "6 of 10 seated" where the hosts removed two chairs and read "6 of 8". Against the
 * replayed migrations: `get_vendor_seat_plan` now sends each table's `removed_seats`, so the supplier page counts seats
 * with the hosts' `effectiveCapacity` — and a table with no removed chairs sends [] (never null).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { effectiveCapacity } from '@/lib/seat-plan-engine/geometry';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let catererUid = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Bea & Paolo', 'birthday', ((now() AT TIME ZONE 'Asia/Manila')::date + 30), 'day') RETURNING event_id`,
  );
  eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_floor_plan (event_id, published_at) VALUES ($1, NOW())`, [eventId]);
  await db.query(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order, removed_seats)
     VALUES ($1, 'Table 1', 'round_10', 10, 1, '{1,2}'), ($1, 'Table 2', 'round_8', 8, 2, '{}')`,
    [eventId],
  );
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('caterer@removed-chairs.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  catererUid = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Kusina', 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [catererUid],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'catering'::public.vendor_category, 'Kusina', 'contracted'::public.vendor_status, $2)`,
    [eventId, v.rows[0]!.vendor_profile_id],
  );
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

test('the supplier seat plan sends removed_seats, and the hosts\' count follows from it', async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, catererUid);
  let plan: { tables: { label: string; capacity: number; removed_seats: number[] }[] };
  try {
    const r = await db.query<{ p: typeof plan }>(`SELECT public.get_vendor_seat_plan($1) AS p`, [eventId]);
    plan = r.rows[0]!.p;
  } finally {
    await setAuthUid(db, null);
  }
  const t1 = plan.tables.find((t) => t.label === 'Table 1')!;
  const t2 = plan.tables.find((t) => t.label === 'Table 2')!;
  assert.deepEqual(t1.removed_seats, [1, 2], 'the removed chairs reach the supplier');
  assert.equal(effectiveCapacity(t1.capacity, t1.removed_seats), 8, 'the supplier counts 8 seats, as the hosts do');
  assert.deepEqual(t2.removed_seats, [], 'no removed chairs is [] — never null');
});
