/**
 * 🧾 THE SUPPLIER'S BILLING LISTS ARE HONEST AND THE SHOP'S OWN (Build 2 #39, prototype v118).
 *
 *   1. ONE ROUND TRIP — `fetchSupplierBillingMeasured` asks all seven of its requests before awaiting any (counted on a
 *      stub that records the order of `from()` and `then()`).
 *   2. SCOPED TO THE SHOP — every session read of a shop table filters `vendor_profile_id = shop`; payments keep only the
 *      shop's own bookings (the admin `event_vendors` read, `marketplace_vendor_id = shop`). RLS admits more (admin, a
 *      helper's other shops, a couple's own quotes) — the db test proves the RLS half.
 *   3. A REFUSED READ IS NOT AN EMPTY LIST — each list reports `measured: false`; a refused booking read unmeasures the
 *      payments (they cannot be placed in a shop); a refused NAME read keeps the rows and names them nothing.
 *   4. THE STATES — held / given / refunded for a gift; confirmed / proof to check / not received for a payment; a reward
 *      says where it stands; refunds come from the shipped purchases (refunded supplier orders), never a new read.
 *   5. THE DOORS — a gift opens the client on Quotation, a payment on Payment, a refund its slip, a reward the badges.
 *   6. THE RENDER — the page draws the supplier sections only for a login in a shop, under ONE dropdown, and every list
 *      branches on `measured` before its empty words.
 *
 * SABOTAGE (seen red once, 8 Nov): dropping `.eq('vendor_profile_id', vendorProfileId)` from the gift-lines read → 2
 * red; `measured: true` on a refused rewards read → 3 red; awaiting the bookings read before the others → 1 red.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import type { Purchase } from '@/lib/billing';
import {
  giftHref,
  giftStateOf,
  paymentHref,
  paymentStateOf,
  refundsOf,
  rewardRowOf,
  REWARDS_HREF,
  sectionSummary,
} from '@/lib/supplier-billing';
import { billingShowOf, BILLING_SECTIONS } from '@/lib/billing-sections';

/* ── `server-only` shim (the shape of lib/a-crew-tag-reaches-the-suppliers-day.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_supplier_billing__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}
let server: typeof import('./supplier-billing.server');
before(async () => {
  server = await import('./supplier-billing.server');
});

type Result = { data: unknown; error: unknown };
type Log = string[];

/** Thenable builders that record filters and the moment each is awaited. `rpc` / catalogue reads answer empty. */
function stub(byTable: Record<string, Result>, log: Log, who: string): SupabaseClient {
  return {
    from(table: string) {
      log.push(`${who}:from:${table}`);
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'like', 'ilike', 'order', 'limit', 'gt', 'lte', 'gte']) {
        b[m] = (...args: unknown[]) => {
          log.push(`${who}:${table}.${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
          return b;
        };
      }
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        log.push(`${who}:await:${table}`);
        return Promise.resolve(byTable[table] ?? { data: [], error: null }).then(resolve, reject);
      };
      return b;
    },
    rpc() {
      return Promise.resolve({ data: [], error: null });
    },
  } as unknown as SupabaseClient;
}

const SHOP = 'shop-A';
const REFUSED = { data: null, error: { message: 'permission denied', code: '42501' } };

const SESSION: Record<string, Result> = {
  vendor_proposal_shop_gifts: {
    data: [
      { gift_line_id: 'g1', proposal_id: 'p1', title: 'Papic 150', gift_kind: 'papic', srp_php: '999.00', from_badge_reward: false, created_at: '2026-11-01T02:00:00Z', vendor_proposals: { status: 'accepted', event_id: 'e1' } },
      { gift_line_id: 'g2', proposal_id: 'p2', title: 'Event Plus', gift_kind: 'event_plus', srp_php: 2990, from_badge_reward: true, created_at: '2026-10-30T02:00:00Z', vendor_proposals: { status: 'sent', event_id: 'e2' } },
      { gift_line_id: 'g3', proposal_id: 'p3', title: 'Papic 150', gift_kind: 'papic', srp_php: 999, from_badge_reward: false, created_at: '2026-10-29T02:00:00Z', vendor_proposals: [{ status: 'declined', event_id: 'e3' }] },
    ],
    error: null,
  },
  shop_gift_stock_entries: { data: [{ event_id: 'e1', proposal_id: null, gift_kind: 'papic' }], error: null },
  shop_badge_rewards: {
    data: [
      { reward_id: 'w1', reward_key: 'verified', reward_kind: 'papic', units: 1, granted_at: '2026-10-12T02:00:00Z', revoked_at: null, used_at: null, returned_at: null },
      { reward_id: 'w2', reward_key: 'events:1000', reward_kind: 'fee_waiver', units: 1, granted_at: '2026-10-21T02:00:00Z', revoked_at: null, used_at: null, returned_at: null },
    ],
    error: null,
  },
  event_vendor_payments: {
    data: [
      { payment_id: 'pay1', vendor_id: 'ev-A1', event_id: 'e1', amount_php: '30000', paid_at: '2026-11-01', method: 'GCash', vendor_confirmed_at: null, payment_refused_at: null, is_deposit_record: false },
      { payment_id: 'pay2', vendor_id: 'ev-A1', event_id: 'e1', amount_php: 5000, paid_at: '2026-10-02', method: 'BDO', vendor_confirmed_at: '2026-10-03T00:00:00Z', payment_refused_at: null, is_deposit_record: true },
      // another shop of the same login (or a booking the login helps on) — never this shop's
      { payment_id: 'payX', vendor_id: 'ev-OTHER', event_id: 'e9', amount_php: 777, paid_at: '2026-10-02', method: null, vendor_confirmed_at: null, payment_refused_at: null, is_deposit_record: false },
    ],
    error: null,
  },
};
const ADMIN: Record<string, Result> = {
  event_vendors: { data: [{ vendor_id: 'ev-A1', event_id: 'e1', events: { display_name: 'Reyes & Santos wedding', event_date: '2026-11-08' } }], error: null },
  vendor_proposals: {
    data: [
      { proposal_id: 'p1', event_id: 'e1', events: { display_name: 'Reyes & Santos wedding', event_date: '2026-11-08' } },
      { proposal_id: 'p2', event_id: 'e2', events: [{ display_name: 'Uy anniversary', event_date: '2026-11-27' }] },
    ],
    error: null,
  },
};

test('1 · one round trip: every request is asked before any is awaited', async () => {
  const log: Log = [];
  await server.fetchSupplierBillingMeasured(stub(SESSION, log, 's'), SHOP, stub(ADMIN, log, 'a'));
  const firstAwait = log.findIndex((l) => l.includes(':await:'));
  const asked = log.filter((l) => /:from:/.test(l));
  const askedBefore = log.slice(0, firstAwait).filter((l) => /:from:/.test(l));
  for (const t of ['s:from:vendor_proposal_shop_gifts', 's:from:shop_gift_stock_entries', 's:from:shop_badge_rewards', 's:from:event_vendor_payments', 'a:from:event_vendors', 'a:from:vendor_proposals']) {
    assert.ok(askedBefore.includes(t), `${t} was asked after another read was awaited — a second round trip`);
  }
  assert.ok(asked.length >= 6, `only ${asked.length} reads`);
});

test('2 · every read is the shop’s own', async () => {
  const log: Log = [];
  const got = await server.fetchSupplierBillingMeasured(stub(SESSION, log, 's'), SHOP, stub(ADMIN, log, 'a'));
  for (const t of ['vendor_proposal_shop_gifts', 'shop_gift_stock_entries', 'shop_badge_rewards']) {
    assert.ok(log.includes(`s:${t}.eq("vendor_profile_id","${SHOP}")`), `${t} is not filtered to the shop`);
  }
  assert.ok(log.includes(`a:event_vendors.eq("marketplace_vendor_id","${SHOP}")`), 'the bookings are not this shop’s');
  assert.ok(log.includes(`a:vendor_proposals.eq("vendor_profile_id","${SHOP}")`), 'the quote names are not this shop’s');
  assert.ok(!log.some((l) => /^a:from:(vendor_proposal_shop_gifts|shop_gift_stock_entries|shop_badge_rewards|event_vendor_payments)$/.test(l)), 'a shop list was read on the admin client');
  assert.deepEqual(got.payments.rows.map((p) => p.paymentId), ['pay1', 'pay2'], 'a payment from another shop was listed');
});

test('3 · a refused read is not an empty list', async () => {
  for (const [table, list] of [
    ['vendor_proposal_shop_gifts', 'gifts'],
    ['shop_gift_stock_entries', 'gifts'],
    ['shop_badge_rewards', 'rewards'],
    ['event_vendor_payments', 'payments'],
  ] as const) {
    const got = await server.fetchSupplierBillingMeasured(stub({ ...SESSION, [table]: REFUSED }, [], 's'), SHOP, stub(ADMIN, [], 'a'));
    assert.equal(got[list].measured, false, `a refused ${table} read was measured`);
    assert.deepEqual(got[list].rows, []);
  }
  const noBookings = await server.fetchSupplierBillingMeasured(stub(SESSION, [], 's'), SHOP, stub({ ...ADMIN, event_vendors: REFUSED }, [], 'a'));
  assert.equal(noBookings.payments.measured, false, 'payments drawn without knowing which are this shop’s');
  const noNames = await server.fetchSupplierBillingMeasured(stub(SESSION, [], 's'), SHOP, stub({ ...ADMIN, vendor_proposals: REFUSED }, [], 'a'));
  assert.equal(noNames.gifts.measured, true, 'a refused NAME read emptied the gifts');
  assert.equal(noNames.gifts.rows.length, 3);
  assert.equal(noNames.gifts.rows.find((g) => g.lineId === 'g2')?.client, null, 'a name nobody read was drawn');
});

test('4 · the states, the names and the words', async () => {
  const got = await server.fetchSupplierBillingMeasured(stub(SESSION, [], 's'), SHOP, stub(ADMIN, [], 'a'));
  assert.deepEqual(got.gifts.rows.map((g) => [g.lineId, g.state, g.client, g.amountPhp]), [
    ['g1', 'given', 'Reyes & Santos wedding', 999],
    ['g2', 'held', 'Uy anniversary', 2990],
    ['g3', 'refunded', null, 999],
  ]);
  assert.equal(got.gifts.rows[1]!.fromBadgeReward, true);
  assert.deepEqual(got.payments.rows.map((p) => p.state), ['proof_to_check', 'confirmed']);
  assert.equal(paymentStateOf({ vendor_confirmed_at: null, payment_refused_at: '2026-11-01' }), 'not_received');
  assert.equal(giftStateOf({ proposalStatus: 'viewed', givenToEvent: false }), 'held');
  assert.equal(giftStateOf({ proposalStatus: 'expired', givenToEvent: true }), 'given');
  assert.deepEqual(got.rewards.rows.map((r) => [r.where, r.open]), [
    ['in your gift stock', false],
    ['not used yet', true],
  ]);
  assert.equal(got.rewards.rows[0]!.badge, 'SETNAYAN Verified');
  assert.match(got.rewards.rows[1]!.badge, /^1,000 events/);
  assert.equal(got.rewards.rows[1]!.reward, 'Free booking fee · your next customer');
  assert.match(rewardRowOf({ reward_id: 'x', reward_key: 'events:1000', reward_kind: 'fee_waiver', units: 1, granted_at: '2026-10-01T00:00:00Z', revoked_at: null, used_at: '2026-11-02T03:00:00Z', returned_at: null }).where, /^used Nov 2$/);
  assert.equal(rewardRowOf({ reward_id: 'x', reward_key: 'verified', reward_kind: 'papic', units: 1, granted_at: '2026-10-01T00:00:00Z', revoked_at: '2026-10-02T00:00:00Z', used_at: null, returned_at: null }).where, 'taken back by Setnayan');

  const p = (over: Partial<Purchase>): Purchase => ({ orderId: 'o', publicId: 'S89O', referenceCode: 'R', description: 'Booking fee', status: 'paid', createdAt: '2026-11-02T00:00:00Z', eventId: null, eventName: null, isSupplierBilling: true, grossPhp: 500, receiptId: 'r', receiptNumber: 'n', ...over });
  const refunds = refundsOf([p({ orderId: 'a', status: 'refunded' }), p({ orderId: 'b' }), p({ orderId: 'c', status: 'refunded', isSupplierBilling: false })]);
  assert.deepEqual(refunds.map((r) => r.orderId), ['a'], 'a refund is the shop’s own refunded order');
  assert.equal(sectionSummary('refunds', got, refunds), '1 refund · ₱500 back to you');
  assert.equal(sectionSummary('gifts', got, []), '2 gifts · ₱3,989 · 1 held');
  assert.equal(sectionSummary('payments', got, []), '₱5,000 confirmed · ₱30,000 proof to check');
  assert.equal(sectionSummary('gifts', { ...got, gifts: { measured: false, rows: [] } }, []), 'Couldn’t load');
});

test('5 · the doors', () => {
  assert.equal(giftHref({ eventId: 'e1' }), '/vendor-dashboard/clients/e1?tab=quote');
  assert.equal(giftHref({ eventId: null }), null);
  assert.equal(paymentHref({ eventId: 'e1' }), '/vendor-dashboard/clients/e1?tab=payments');
  assert.equal(REWARDS_HREF, '/vendor-dashboard/shop#badges');
  assert.deepEqual([...BILLING_SECTIONS], ['purchases', 'gifts', 'payments', 'refunds', 'rewards']);
  assert.equal(billingShowOf('gifts'), 'gifts');
  assert.equal(billingShowOf('nope'), 'all');
  assert.equal(billingShowOf(undefined), 'all');
});

const WEB = path.join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8'));

test('6 · the render: supplier sections only in a shop, one dropdown, measured before empty', () => {
  const page = read('app/dashboard/(account)/billing/page.tsx');
  assert.match(page, /resolveActiveShop\(supabase, user\.id\)/, 'the shop is not the session’s own');
  assert.match(page, /fetchSupplierBillingMeasured\(supabase, shop\.vendorProfileId\)/);
  assert.match(page, /supplier \? \(\s*<SupplierBillingSections/, 'a login with no shop must see the shipped list');
  const sections = read('app/dashboard/(account)/billing/_components/supplier-billing-sections.tsx');
  for (const list of ['gifts', 'payments', 'rewards'] as const) {
    const unread = sections.indexOf(`!supplier.${list}.measured ?`);
    const empty = sections.indexOf(`supplier.${list}.rows.length === 0`);
    assert.ok(unread > -1 && empty > unread, `${list}: the empty words are reachable for a refused read`);
  }
  assert.equal((sections.match(/<BillingFilter /g) ?? []).length, 1, 'one dropdown');
  const filter = read('app/dashboard/(account)/billing/_components/billing-filter.tsx');
  assert.equal((filter.match(/<PickMenu/g) ?? []).length, 1, 'the filter is ONE PickMenu');
  assert.doesNotMatch(filter, /router\.(push|replace)|fetch\(/, 'a filter pick refetches — it must only hide');
});
