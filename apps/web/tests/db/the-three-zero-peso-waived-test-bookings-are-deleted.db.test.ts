/**
 * THE THREE ₱0 WAIVED TEST BOOKINGS ARE DELETED (owner ruling 16 Nov 2026 (21); same shape as #7877).
 *
 * #7877 (20271349476485) deleted the four test bookings that re-billed fee bills and KEPT the test shop
 * testnayanw1lights' three ₱0 waived bookings (debut-18 · test-w1-fee-walk · test-own-link-14-nov). The owner has now
 * ruled they go too. Seeds that exact shape — the shop's agreed, contracted bookings on those three events, each with a
 * ₱0 waived lock charge on its own ledger, and a notice pointing at one — plus rows that must NOT move:
 *   · the same shop's waived booking on a fourth event (not one of the three named);
 *   · a real shop's booking + pending bill on debut-18 (not the test shop → out of reach);
 *   · cale-ice and maria-and-jose bookings with bills.
 * Then runs the migration and proves the three bookings, charges and ledgers are gone, the controls are identical,
 * the mint's own condition finds nothing to re-bill, a second run changes nothing, and a non-₱0 charge refuses.
 * Run (from apps/web): npx tsx --test tests/db/the-three-zero-peso-waived-test-bookings-are-deleted.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const FILE = '20271349501852_delete_the_three_zero_peso_waived_test_bookings.sql';
const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'migrations', FILE), 'utf8');
const THREE = ['debut-18', 'test-w1-fee-walk', 'test-own-link-14-nov'];

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

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const tester = await user('testnayan4@example.test');
  const test = await shop('testnayanw1lights');
  const evs: string[] = [];
  for (const slug of THREE) evs.push(await event(slug, tester));
  for (const e of evs) targets.push(await booking(e, test.vp, test.user, 'waived_free5', null));
  await db.query(
    `INSERT INTO public.notifications (user_id, type, title, body, related_url)
     VALUES ($1, 'order_quoted', 'Booking waived', 'Free booking', '/vendor-dashboard/customers/' || $2::text)`,
    [test.user, targets[0]!.vendorId],
  );

  // Controls.
  const keep = await booking(await event('test-w1-keep-me', tester), test.vp, test.user, 'waived_free5', null);
  const real = await shop('a-real-shop');
  const realBill = await booking(evs[0]!, real.vp, real.user, 'pending', 'S89O-REALSHOP01');
  const owner = await user('owner-cale@example.test', true);
  const cale = await booking(await event('cale-ice', owner), real.vp, real.user, 'pending', 'S89O-CALEICE001');
  const mj = await booking(await event('maria-and-jose', await user('mj@example.test')), real.vp, real.user, 'pending', 'S89O-MARIAJOSE1');
  controlIds = [keep.vendorId, realBill.vendorId, cale.vendorId, mj.vendorId];
  controlsBefore = await controls(controlIds);
});

after(async () => {
  await db?.close();
});

test('the seed is real: the three waived bookings exist, each with a ₱0 charge', async () => {
  const v = targets.map((t) => t.vendorId);
  assert.equal(await count(`SELECT count(*) n FROM public.event_vendors WHERE vendor_id = ANY($1::uuid[])`, [v]), 3);
  assert.equal(
    await count(
      `SELECT count(*) n FROM public.booking_fee_charges WHERE event_vendor_id = ANY($1::uuid[]) AND amount_charged_centavos = 0`,
      [v],
    ),
    3,
  );
  assert.equal(await count(`SELECT count(*) n FROM public.booking_fee_ledger`), 7);
});

test('running it: the three bookings, their charges, ledgers and notice are gone', async () => {
  await db.exec(SQL);
  const v = targets.map((t) => t.vendorId);
  const c = targets.map((t) => t.chargeId);
  assert.equal(await count(`SELECT count(*) n FROM public.event_vendors WHERE vendor_id = ANY($1::uuid[])`, [v]), 0);
  assert.equal(await count(`SELECT count(*) n FROM public.booking_fee_charges WHERE charge_id = ANY($1::uuid[])`, [c]), 0);
  assert.equal(await count(`SELECT count(*) n FROM public.booking_fee_ledger`), 4);
  assert.equal(await count(`SELECT count(*) n FROM public.orders`), 3, 'an order outside the three moved');
  assert.equal(await count(`SELECT count(*) n FROM public.notifications WHERE title = 'Booking waived'`), 0);
});

test('nothing outside them moved: the fourth waived booking, the real shop, cale-ice and maria-and-jose', async () => {
  assert.equal(await controls(controlIds), controlsBefore);
});

test('the shop stays clean: the mint finds nothing to re-bill for the test shop', async () => {
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

test('it refuses rather than lands when a charge on one of the three is a real bill, not a ₱0 waiver', async () => {
  const vp = await one<{ vendor_profile_id: string; user_id: string }>(
    `SELECT vendor_profile_id, user_id FROM public.vendor_profiles WHERE business_slug = 'testnayanw1lights'`,
  );
  const e = await one<{ event_id: string }>(`SELECT event_id FROM public.events WHERE slug = 'test-w1-fee-walk'`);
  await booking(e.event_id, vp.vendor_profile_id, vp.user_id, 'pending', 'S89O-NOTAWAIVER');
  await assert.rejects(db.exec(SQL), /not a ₱0 waiver/);
  await db.exec('ROLLBACK').catch(() => {});
  assert.equal(await count(`SELECT count(*) n FROM public.orders WHERE public_id = 'S89O-NOTAWAIVER'`), 1);
});
