/**
 * THE TEST BOOKINGS THAT RE-BILLED FOUR FEE BILLS ARE DELETED (owner 16 Nov 2026 "yes delete them", after 8983dc52).
 *
 * #7842 deleted every bill but not the bookings behind them, so `maybeCatchUpHandshakesWithoutFee`
 * (lib/booking-fee-mint.server.ts) minted four pending fee bills again for the test shop testnayanw1lights.
 * Seeds that exact shape — an agreed, contracted booking on a test-* event, its pending lock charge, ledger,
 * unpaid order (one of the four numbers), payment and notice — plus rows that must NOT move:
 *   · the same shop's ₱0 waived booking (bills nothing; the mint skips it);
 *   · a real shop's agreed booking + pending bill on a test-* event (not the test shop → out of reach);
 *   · cale-ice and maria-and-jose bookings with bills.
 * Then runs the migration and proves the four bills and their bookings are gone, the controls are identical,
 * the mint's own condition finds nothing to re-bill, and a second run changes nothing.
 * Run (from apps/web): npx tsx --test tests/db/the-test-bookings-that-rebilled-four-fee-bills-are-deleted.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const FILE = '20271349476485_delete_the_test_bookings_that_rebilled_four_fee_bills.sql';
const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'migrations', FILE), 'utf8');
const FOUR = ['S89O-GGDS99RD7F', 'S89O-K9F4CNCSVV', 'S89O-AF3XVQJ2YC', 'S89O-C4YDW7PWKX'];

let replay: ReplayResult;
let db: PGlite;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] as T;
}
async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number((await one<{ n: string }>(sql, params)).n);
}
async function user(email: string, internal = false): Promise<string> {
  const u = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  if (internal) await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [u.id]);
  return u.id;
}
async function event(slug: string, host: string): Promise<string> {
  const e = await one<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ($1, 'birthday', $1) RETURNING event_id`,
    [slug],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [e.event_id, host]);
  return e.event_id;
}
async function shop(slug: string): Promise<{ vp: string; user: string }> {
  const owner = await user(`${slug}@example.test`);
  const vp = await one<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, $2, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
    [owner, slug],
  );
  return { vp: vp.vendor_profile_id, user: owner };
}
let refN = 0;
/** An agreed, contracted booking with a lock charge on its own ledger; a pending charge also gets its unpaid bill. */
async function booking(
  eventId: string,
  vp: string,
  payer: string,
  status: 'pending' | 'waived_free5',
  orderPublicId: string | null,
): Promise<{ vendorId: string; chargeId: string; orderId: string | null }> {
  const ev = await one<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source, lock_request_state, lock_requested_at, lock_agreed_at)
     VALUES ($1, 'catering', 'Shop', 'contracted', $2, 'host_marketplace_search', 'agreed', NOW(), NOW()) RETURNING vendor_id`,
    [eventId, vp],
  );
  const led = await one<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (vendor_profile_id, event_id) VALUES ($1, $2) RETURNING ledger_id`,
    [vp, eventId],
  );
  const fee = status === 'pending' ? 133750 : 0;
  const ch = await one<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges (ledger_id, vendor_profile_id, proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version, event_id, event_vendor_id, status, source)
     VALUES ($1, $2, 2675000, $3, $3, 'test', $4, $5, $6, 'lock') RETURNING charge_id`,
    [led.ledger_id, vp, fee, eventId, ev.vendor_id, status],
  );
  if (!orderPublicId) return { vendorId: ev.vendor_id, chargeId: ch.charge_id, orderId: null };
  refN += 1;
  const o = await one<{ order_id: string }>(
    `INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, reference_code, status)
     VALUES ($1, $2, 'vendor_booking_fee__' || $3::text, 'Booking fee', 1337.5, $4, 'submitted') RETURNING order_id`,
    [eventId, payer, ch.charge_id, `FEEREF${String(refN).padStart(3, '0')}`],
  );
  await db.query(`UPDATE public.orders SET public_id = $2 WHERE order_id = $1`, [o.order_id, orderPublicId]);
  await db.query(`INSERT INTO public.payments (order_id, amount_php, channel) VALUES ($1, 1337.5, 'gcash')`, [o.order_id]);
  await db.query(
    `INSERT INTO public.notifications (user_id, type, title, body, related_url)
     VALUES ($1, 'order_quoted', 'Booking fee due', 'Bill ' || $3 || ' is ready', '/vendor-dashboard/booking-fees/' || $2::text)`,
    [payer, o.order_id, orderPublicId],
  );
  return { vendorId: ev.vendor_id, chargeId: ch.charge_id, orderId: o.order_id };
}

/** The mint's own condition (`maybeCatchUpHandshakesWithoutFee`): agreed, booked, unarchived, no live charge. */
async function rebillable(slug: string): Promise<number> {
  return count(
    `SELECT count(*) n FROM public.vendor_profiles vp
       JOIN public.event_vendors ev ON ev.marketplace_vendor_id = vp.vendor_profile_id
      WHERE vp.business_slug = $1 AND ev.lock_request_state::text = 'agreed'
        AND ev.status::text IN ('contracted','deposit_paid','delivered','complete') AND ev.archived_at IS NULL
        AND (ev.package_role IS NULL OR ev.package_role::text <> 'covered')
        AND NOT EXISTS (SELECT 1 FROM public.booking_fee_charges c WHERE c.event_vendor_id = ev.vendor_id
                         AND c.status IN ('pending','paid','waived_import','waived_free5','waived_promo','waived_launch'))`,
    [slug],
  );
}
/** Every control row, as one fingerprint. */
async function controls(ids: string[]): Promise<string> {
  const r = await one<{ f: string }>(
    `SELECT concat_ws('|',
       (SELECT md5(COALESCE(string_agg(row_to_json(x)::text, ',' ORDER BY x.vendor_id), '')) FROM public.event_vendors x WHERE x.vendor_id = ANY($1::uuid[])),
       (SELECT md5(COALESCE(string_agg(row_to_json(x)::text, ',' ORDER BY x.charge_id), '')) FROM public.booking_fee_charges x WHERE x.event_vendor_id = ANY($1::uuid[])),
       (SELECT md5(COALESCE(string_agg(row_to_json(x)::text, ',' ORDER BY x.ledger_id), '')) FROM public.booking_fee_ledger x
          WHERE x.ledger_id IN (SELECT ledger_id FROM public.booking_fee_charges WHERE event_vendor_id = ANY($1::uuid[]))),
       (SELECT md5(COALESCE(string_agg(row_to_json(x)::text, ',' ORDER BY x.order_id), '')) FROM public.orders x
          WHERE x.service_key IN (SELECT 'vendor_booking_fee__' || charge_id::text FROM public.booking_fee_charges WHERE event_vendor_id = ANY($1::uuid[]))),
       (SELECT count(*) FROM public.payments)) AS f`,
    [ids],
  );
  return r.f;
}

const targets: Array<{ vendorId: string; chargeId: string; orderId: string | null }> = [];
let controlIds: string[] = [];
let controlsBefore: string;
let testerId: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const tester = await user('testnayan4@example.test');
  testerId = tester;
  const test = await shop('testnayanw1lights');
  const evs = [
    await event('test-w1-fee-walk-2', tester),
    await event('test-w1-fee-walk-3', tester),
    await event('test-cycle-14-nov', tester),
    await event('test-w1-story-16-nov', tester),
  ];
  for (let i = 0; i < 4; i += 1) targets.push(await booking(evs[i]!, test.vp, test.user, 'pending', FOUR[i]!));

  // Controls.
  const waived = await booking(await event('test-w1-fee-walk', tester), test.vp, test.user, 'waived_free5', null);
  const real = await shop('a-real-shop');
  const realBill = await booking(evs[0]!, real.vp, real.user, 'pending', 'S89O-REALSHOP01');
  const owner = await user('owner-cale@example.test', true);
  const cale = await booking(await event('cale-ice', owner), real.vp, real.user, 'pending', 'S89O-CALEICE001');
  const mj = await booking(await event('maria-and-jose', await user('mj@example.test')), real.vp, real.user, 'pending', 'S89O-MARIAJOSE1');
  controlIds = [waived.vendorId, realBill.vendorId, cale.vendorId, mj.vendorId];
  controlsBefore = await controls(controlIds);
});

after(async () => {
  await db?.close();
});

test('the seed is real: the four bills and their bookings exist', async () => {
  assert.equal(await count(`SELECT count(*) n FROM public.orders WHERE public_id = ANY($1)`, [FOUR]), 4);
  assert.equal(await count(`SELECT count(*) n FROM public.orders`), 7);
  assert.equal(await count(`SELECT count(*) n FROM public.payments`), 7);
  assert.equal(await count(`SELECT count(*) n FROM public.notifications WHERE type = 'order_quoted'`), 7);
});

test('running it: the four bills, their bookings, charges, ledgers, payments and notices are gone', async () => {
  await db.exec(SQL);
  const v = targets.map((t) => t.vendorId);
  const c = targets.map((t) => t.chargeId);
  assert.equal(await count(`SELECT count(*) n FROM public.orders WHERE public_id = ANY($1)`, [FOUR]), 0);
  assert.equal(await count(`SELECT count(*) n FROM public.event_vendors WHERE vendor_id = ANY($1::uuid[])`, [v]), 0);
  assert.equal(await count(`SELECT count(*) n FROM public.booking_fee_charges WHERE charge_id = ANY($1::uuid[])`, [c]), 0);
  assert.equal(await count(`SELECT count(*) n FROM public.orders`), 3);
  assert.equal(await count(`SELECT count(*) n FROM public.payments`), 3);
  assert.equal(await count(`SELECT count(*) n FROM public.booking_fee_ledger`), 4);
  assert.equal(await count(`SELECT count(*) n FROM public.notifications WHERE type = 'order_quoted'`), 3);
});

test('nothing outside them moved: the waived booking, the real shop, cale-ice and maria-and-jose', async () => {
  // Payments count is part of the fingerprint and legitimately fell by 4; compare the row parts only.
  const strip = (f: string) => f.split('|').slice(0, 4).join('|');
  assert.equal(strip(await controls(controlIds)), strip(controlsBefore));
});

test('the bills stay gone: the mint finds nothing to re-bill for the test shop', async () => {
  assert.equal(await rebillable('testnayanw1lights'), 0);
});

test('a second run changes nothing', async () => {
  const snap = async () =>
    one<{ f: string }>(
      `SELECT concat_ws('|', (SELECT count(*) FROM public.event_vendors), (SELECT count(*) FROM public.orders),
         (SELECT count(*) FROM public.payments), (SELECT count(*) FROM public.booking_fee_charges),
         (SELECT count(*) FROM public.booking_fee_ledger), (SELECT count(*) FROM public.notifications)) f`,
    );
  const before2 = await snap();
  await db.exec(SQL);
  assert.equal((await snap()).f, before2.f);
});

test('it refuses rather than lands when a fifth test bill would be swept in', async () => {
  const vp = await one<{ vendor_profile_id: string; user_id: string }>(
    `SELECT vendor_profile_id, user_id FROM public.vendor_profiles WHERE business_slug = 'testnayanw1lights'`,
  );
  await booking(await event('test-a-fifth-bill', testerId), vp.vendor_profile_id, vp.user_id, 'pending', 'S89O-NOTONEOFUS');
  await assert.rejects(db.exec(SQL), /selected a bill outside the four/);
  await db.exec('ROLLBACK').catch(() => {});
  assert.equal(await count(`SELECT count(*) n FROM public.orders WHERE public_id = 'S89O-NOTONEOFUS'`), 1);
});
