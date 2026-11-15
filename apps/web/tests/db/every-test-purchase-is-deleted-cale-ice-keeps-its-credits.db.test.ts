/**
 * DELETE EVERY TEST PURCHASE — CALE-ICE KEEPS ITS CREDITS (owner 16 Nov 2026, DECISION_LOG 8983dc52).
 *
 * Seeds a cale-ice-like event (found by SLUG, internal host, paid orders, bought + free Papic credits, AI on),
 * a test account's event whose AI and credits came only from purchases, a booking-fee bill + ledger, and a
 * maria-and-jose event that must not be touched. Then re-runs the migration and proves:
 *   · cale-ice's credit total and Setnayan AI switch are unchanged, and one comp grant records why;
 *   · zero orders, payments, fee bills, fee ledger rows and App Store purchases remain;
 *   · the test account's bought credits are gone and its AI switch is off;
 *   · maria-and-jose's rows are identical before and after;
 *   · a second run changes nothing.
 * Run: npx tsx --test tests/db/every-test-purchase-is-deleted-cale-ice-keeps-its-credits.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const FILE = '20271348457307_delete_every_test_purchase_cale_ice_keeps_its_credits.sql';
const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'migrations', FILE), 'utf8');
const REASON = 'Owner 16 Nov 2026: test purchases deleted; cale-ice keeps what they unlocked';

let replay: ReplayResult;
let db: PGlite;
let cale: string;
let testEv: string;
let mj: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] as T;
}
async function user(email: string, internal = false): Promise<string> {
  const u = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  if (internal) await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [u.id]);
  return u.id;
}
async function event(slug: string, host: string, ai: boolean): Promise<string> {
  const e = await one<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug, setnayan_ai_active) VALUES ($1, 'birthday', $1, $2) RETURNING event_id`,
    [slug, ai],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [e.event_id, host]);
  return e.event_id;
}
let refN = 0;
async function paidOrder(eventId: string, userId: string, sku: string, php: number): Promise<string> {
  refN += 1;
  const o = await one<{ order_id: string }>(
    `INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, confirmed_total_php, reference_code, status)
     VALUES ($1, $2, $3, $3, $4, $4, $5, 'paid') RETURNING order_id`,
    [eventId, userId, sku, php, `TESTREF${String(refN).padStart(3, '0')}`],
  );
  await db.query(`INSERT INTO public.payments (order_id, amount_php, channel) VALUES ($1, $2, 'gcash')`, [o.order_id, php]);
  return o.order_id;
}
async function points(eventId: string, pts: number, source: string, orderId: string | null): Promise<void> {
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id) VALUES ($1, $2, $3, $4)`,
    [eventId, pts, source, orderId],
  );
}
async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number((await one<{ n: string }>(sql, params)).n);
}
async function cale_state() {
  return one<{ sum: string; ai: boolean }>(
    `SELECT (SELECT COALESCE(sum(points),0) FROM public.papic_event_point_grants WHERE event_id = $1)::text AS sum,
            (SELECT setnayan_ai_active FROM public.events WHERE event_id = $1) AS ai`,
    [cale],
  );
}
/** Every row anywhere that names maria-and-jose, as one fingerprint. */
async function mjFingerprint(): Promise<string> {
  const r = await one<{ f: string }>(
    `SELECT concat_ws('|',
       (SELECT md5(string_agg(row_to_json(e)::text, ',')) FROM public.events e WHERE e.event_id = $1),
       (SELECT count(*) FROM public.event_members WHERE event_id = $1),
       (SELECT md5(COALESCE(string_agg(row_to_json(g)::text, ',' ORDER BY g.grant_id), '')) FROM public.papic_event_point_grants g WHERE g.event_id = $1),
       (SELECT count(*) FROM public.comp_grants WHERE event_id = $1),
       (SELECT count(*) FROM public.notifications WHERE event_id = $1)) AS f`,
    [mj],
  );
  return r.f;
}

let calePrimary: string;
let caleSumBefore: string;
let testFree: number;
let mjBefore: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const owner = await user('owner-cale@example.test', true);
  cale = await event('cale-ice', owner, true);
  const aiOrder = await paidOrder(cale, owner, 'SETNAYAN_AI', 2499);
  const p100 = await paidOrder(cale, owner, 'PAPIC_GUEST_100', 100);
  const p100k = await paidOrder(cale, owner, 'PAPIC_GUEST_100K', 50000);
  calePrimary = aiOrder;
  await points(cale, 5, 'camera_grant', null);
  await points(cale, 100, 'topup_order', p100);
  await points(cale, 100000, 'topup_order', p100k);
  await db.query(
    `INSERT INTO public.app_store_purchases (user_id, product_id, service_key, event_id) VALUES ($1, 'papic.100', 'PAPIC_GUEST_100', $2)`,
    [owner, cale],
  );

  const tester = await user('tester@example.test');
  testEv = await event('rosa-ben', tester, true);
  const tAi = await paidOrder(testEv, tester, 'SETNAYAN_AI', 2499);
  const tP = await paidOrder(testEv, tester, 'PAPIC_GUEST_100', 100);
  await points(testEv, 100, 'topup_order', tP);
  await db.query(
    `INSERT INTO public.app_store_purchases (user_id, product_id, service_key, event_id) VALUES ($1, 'ai', 'SETNAYAN_AI', $2)`,
    [tester, testEv],
  );
  await db.query(
    `INSERT INTO public.notifications (user_id, type, title, body, related_url)
     VALUES ($1, 'order_paid', 'Paid', 'Your order is paid', '/dashboard/x/orders/' || $2::text)`,
    [tester, tAi],
  );

  // A booking-fee bill and its ledger.
  const shopUser = await user('shop@example.test');
  const vp = await one<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Test Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
    [shopUser],
  );
  const ev = await one<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'catering', 'Test Shop', 'considering', $2, 'host_marketplace_search') RETURNING vendor_id`,
    [testEv, vp.vendor_profile_id],
  );
  const led = await one<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (vendor_profile_id) VALUES ($1) RETURNING ledger_id`,
    [vp.vendor_profile_id],
  );
  await db.query(
    `INSERT INTO public.booking_fee_charges (ledger_id, vendor_profile_id, proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version, event_id, event_vendor_id)
     VALUES ($1, $2, 1000000, 50000, 50000, 'test', $3, $4)`,
    [led.ledger_id, vp.vendor_profile_id, testEv, ev.vendor_id],
  );

  // maria-and-jose: rows that must not move.
  const mjHost = await user('mj@example.test');
  mj = await event('maria-and-jose', mjHost, false);
  await points(mj, 30, 'admin', null);
  await db.query(
    `INSERT INTO public.notifications (user_id, event_id, type, title, body) VALUES ($1, $2, 'rsvp_received', 'RSVP', 'Lola said yes')`,
    [mjHost, mj],
  );
  mjBefore = await mjFingerprint();
  caleSumBefore = (await cale_state()).sum;
  testFree = await count(`SELECT COALESCE(sum(points),0) n FROM public.papic_event_point_grants WHERE event_id = $1 AND order_id IS NULL`, [testEv]);
});

after(async () => {
  await db?.close();
});

test('the seed is real: purchases exist before the delete', async () => {
  assert.equal(await count(`SELECT count(*) n FROM public.orders`), 5);
  assert.equal(await count(`SELECT count(*) n FROM public.payments`), 5);
  assert.equal(await count(`SELECT count(*) n FROM public.booking_fee_charges`), 1);
  assert.equal(await count(`SELECT count(*) n FROM public.app_store_purchases`), 2);
  const s = await cale_state();
  // 5 camera + 100 + 100000 bought, plus whatever free grant the event got on creation.
  assert.ok(Number(s.sum) >= 100105, `cale-ice sum ${s.sum}`);
  assert.ok(testFree < 100, 'the test account holds bought credits beyond its free ones');
  assert.equal(s.ai, true);
  assert.ok(calePrimary);
});

test('running it: cale-ice keeps its credits and AI; every purchase record is gone', async () => {
  await db.exec(SQL);
  const s = await cale_state();
  assert.equal(s.sum, caleSumBefore, 'cale-ice credit total must not move');
  assert.equal(s.ai, true, 'cale-ice Setnayan AI must stay on');
  // Its bought lines survive as comp lines, unlinked.
  assert.equal(await count(`SELECT count(*) n FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'comp' AND order_id IS NULL`, [cale]), 2);
  assert.equal(await count(`SELECT count(*) n FROM public.comp_grants WHERE event_id = $1 AND reason = $2`, [cale, REASON]), 1);
  for (const t of ['orders', 'payments', 'booking_fee_charges', 'booking_fee_ledger', 'app_store_purchases', 'receipts', 'order_ledger']) {
    assert.equal(await count(`SELECT count(*) n FROM public.${t}`), 0, `${t} must be empty`);
  }
  assert.equal(await count(`SELECT count(*) n FROM public.notifications WHERE type = 'order_paid'`), 0);
});

test('the test account: bought credits gone, free credits kept, AI switched off', async () => {
  assert.equal(await count(`SELECT COALESCE(sum(points),0) n FROM public.papic_event_point_grants WHERE event_id = $1`, [testEv]), testFree);
  assert.equal((await one<{ a: boolean }>(`SELECT setnayan_ai_active a FROM public.events WHERE event_id = $1`, [testEv])).a, false);
});

test('maria-and-jose is untouched', async () => {
  assert.equal(await mjFingerprint(), mjBefore);
});

test('a second run changes nothing', async () => {
  const before2 = await one<{ f: string }>(
    `SELECT concat_ws('|',
       (SELECT md5(string_agg(row_to_json(g)::text, ',' ORDER BY g.grant_id)) FROM public.papic_event_point_grants g),
       (SELECT md5(string_agg(row_to_json(c)::text, ',' ORDER BY c.grant_id)) FROM public.comp_grants c),
       (SELECT md5(string_agg(e.event_id::text || e.setnayan_ai_active::text, ',' ORDER BY e.event_id)) FROM public.events e),
       (SELECT count(*) FROM public.notifications)) f`,
  );
  await db.exec(SQL);
  const after2 = await one<{ f: string }>(
    `SELECT concat_ws('|',
       (SELECT md5(string_agg(row_to_json(g)::text, ',' ORDER BY g.grant_id)) FROM public.papic_event_point_grants g),
       (SELECT md5(string_agg(row_to_json(c)::text, ',' ORDER BY c.grant_id)) FROM public.comp_grants c),
       (SELECT md5(string_agg(e.event_id::text || e.setnayan_ai_active::text, ',' ORDER BY e.event_id)) FROM public.events e),
       (SELECT count(*) FROM public.notifications)) f`,
  );
  assert.equal(after2.f, before2.f);
  assert.equal(await mjFingerprint(), mjBefore);
});
