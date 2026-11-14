/**
 * A SHOP COUNTS ITS BOOKED LOOPS (test:db) — THE ONE BUILD, lane C2 (spec plans/supplier_one_build_2026-11-08
 * §9 #11: `shop_booked_loop_count(vendor)` = distinct couples who booked this shop on a 2nd event; corpus
 * definition, §4: Booked Loop = the same family books the shop again).
 *
 * The Booked Loop badge pays an Event Plus at every step of its ladder (lib/badge-rewards.ts), so a wrong count
 * pays real rewards. Each case below is a way the count could be wrong:
 *   · one booking per family → 0 (a single booking is not a loop);
 *   · a family books a 2nd event → 1;
 *   · BOTH partners on both events → still 1 (two people, one family);
 *   · a 2nd event that is only 'considering', archived (cancelled) or voided_by_fraud → not a booking, 0;
 *   · the shop's own owner (a self-booking) → never a loop;
 *   · another shop's bookings → never counted here;
 *   · either attribution column (marketplace_vendor_id or linked_vendor_profile_id) counts the booking once;
 *   · service_role only.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

async function newUser(type = 'customer'): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [`loop-${n}@loops.test`, type],
  );
  return u.rows[0]!.id;
}
async function newShop(): Promise<{ vpid: string; owner: string }> {
  const owner = await newUser('vendor');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Loop Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified')
     ON CONFLICT (user_id) DO UPDATE
       SET verification_state = EXCLUDED.verification_state, last_verified_at = EXCLUDED.last_verified_at, public_visibility = EXCLUDED.public_visibility
     RETURNING vendor_profile_id`,
    [owner],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, owner };
}
async function newEvent(date: string, ...couple: string[]): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Loop event', 'birthday', $1::date, 'day') RETURNING event_id`,
    [date],
  );
  const eventId = e.rows[0]!.event_id;
  for (const uid of couple) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
      eventId,
      uid,
    ]);
  }
  return eventId;
}
async function book(
  eventId: string,
  vpid: string,
  opts: { status?: string; via?: 'marketplace' | 'linked'; archived?: boolean; fraud?: boolean } = {},
): Promise<void> {
  const via = opts.via ?? 'marketplace';
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Loop Co', $2::public.vendor_status, $3, $4) RETURNING vendor_id`,
    [eventId, opts.status ?? 'contracted', via === 'marketplace' ? vpid : null, via === 'linked' ? vpid : null],
  );
  if (opts.archived || opts.fraud) {
    await db.query(
      `UPDATE public.event_vendors
          SET archived_at = CASE WHEN $2 THEN now() ELSE archived_at END,
              voided_by_fraud = $3
        WHERE vendor_id = $1`,
      [r.rows[0]!.vendor_id, !!opts.archived, !!opts.fraud],
    );
  }
}
async function loops(vpid: string): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT public.shop_booked_loop_count($1) AS n`, [vpid]);
  return Number(r.rows[0]!.n);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('one booking per family is not a loop; a family booking a 2nd event is ONE loop', async () => {
  const { vpid } = await newShop();
  const a = await newUser();
  const b = await newUser();
  await book(await newEvent('2026-01-10', a), vpid);
  await book(await newEvent('2026-02-10', b), vpid);
  assert.equal(await loops(vpid), 0, 'two different families, once each');

  await book(await newEvent('2027-01-10', a), vpid);
  assert.equal(await loops(vpid), 1, 'family A booked again');
});

test('both partners on both events are ONE family, not two', async () => {
  const { vpid } = await newShop();
  const p1 = await newUser();
  const p2 = await newUser();
  await book(await newEvent('2026-03-01', p1, p2), vpid);
  await book(await newEvent('2027-03-01', p1, p2), vpid);
  assert.equal(await loops(vpid), 1);
});

test('a 2nd event that is not a booking does not make a loop: considering, archived, voided by fraud', async () => {
  const { vpid } = await newShop();
  const a = await newUser();
  await book(await newEvent('2026-04-01', a), vpid);
  await book(await newEvent('2027-04-01', a), vpid, { status: 'considering' });
  await book(await newEvent('2027-05-01', a), vpid, { archived: true });
  await book(await newEvent('2027-06-01', a), vpid, { fraud: true });
  assert.equal(await loops(vpid), 0);
});

test('a self-booking never loops, another shop’s bookings never count, either attribution column counts once', async () => {
  const { vpid, owner } = await newShop();
  const other = await newShop();
  await book(await newEvent('2026-05-01', owner), vpid);
  await book(await newEvent('2027-05-01', owner), vpid);
  assert.equal(await loops(vpid), 0, 'the shop owner booking their own shop is not a family coming back');

  const c = await newUser();
  await book(await newEvent('2026-06-01', c), other.vpid);
  await book(await newEvent('2027-06-01', c), other.vpid);
  assert.equal(await loops(vpid), 0, 'another shop’s loop must not count here');
  assert.equal(await loops(other.vpid), 1);

  const d = await newUser();
  await book(await newEvent('2026-07-01', d), vpid, { via: 'linked' });
  await book(await newEvent('2027-07-01', d), vpid, { via: 'marketplace' });
  assert.equal(await loops(vpid), 1, 'a booking attributed by either column is a booking');
});

test('shop_booked_loop_count is service_role only', async () => {
  const r = await db.query<{ role: string; ok: boolean }>(
    `SELECT r AS role, has_function_privilege(r, 'public.shop_booked_loop_count(uuid)', 'EXECUTE') AS ok
       FROM unnest(ARRAY['anon','authenticated','service_role']) AS r`,
  );
  const ok = Object.fromEntries(r.rows.map((x) => [x.role, x.ok]));
  assert.deepEqual(ok, { anon: false, authenticated: false, service_role: true });
});
