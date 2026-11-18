/**
 * ULTRA ADD-ONS — owner 2026-11-06, DECISION_LOG "ULTRA ADD-ON PRICES" (*"seat, branch + 990 / the rest is +199"*) and
 * "BOOKINGS PER DATE PER SERVICE IS A PLAN ALLOWANCE".
 *
 * Held here (pure — the database half is tests/db/bookings-per-date-are-the-shops-own-number.db.test.ts):
 *   · a purchase RAISES the effective cap, one per paid order, on exactly the allowance it names;
 *   · only Ultra may buy any of the six (the Custom plan was retired 2026-11-06);
 *   · the list is the catalogue's, in the owner's order — categories · service cards · team seat · branches · wait list
 *     · bookings per date — with no price typed and nothing listed that is off sale;
 *   · the service keys round-trip and join the vendor-surface + vendor-pays-Setnayan registries;
 *   · the card editor refuses a NEW number past the plan, keeps a grandfathered one, never refuses Free/Verified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { DAILY_CAPACITY_MAX, TIER_CAPS, VENDOR_TIERS, WAITLIST_SETTING_MAX, tierCaps } from './vendor-tier-caps';
import {
  COUNT_ADDONS,
  COUNT_ADDON_KINDS,
  NO_EXTRAS,
  ULTRA_ADDON_ORDER,
  applyAddOnExtras,
  canBuyUltraAddOn,
  countAddOnServiceKey,
  parseCountAddOnServiceKey,
  ultraAddOnsFromRows,
} from './vendor-ultra-addons';
import { isVendorSurfaceServiceKey } from './vendor-surface-service-keys';
import { vendorPaysSetnayan } from './vendor-pays-setnayan';
import { bookingsPerDateRefusal, bookingsPerDateHelp } from './card-bookings-per-date';

const HERE = dirname(fileURLToPath(import.meta.url));

test('a purchase raises the effective cap — one per paid add-on, on the allowance it names', () => {
  const ultra = tierCaps('enterprise');
  const raised = applyAddOnExtras(ultra, { category: 2, service_card: 1, waitlist: 1, booking_per_date: 3 });
  assert.equal(raised.parentCategories, ultra.parentCategories + 2);
  assert.equal(raised.serviceCardsTotal, ultra.serviceCardsTotal + 1);
  // The wait list is already at its column's ceiling on every plan (2026-11-18) — a past purchase cannot pass it.
  assert.equal(raised.waitlistAcceptances, WAITLIST_SETTING_MAX);
  // A "+1 booking per date" bought before 2026-11-18 raises nothing: there is no plan cap left (ruling 17).
  assert.equal('bookingsPerDatePerService' in raised, false);
  // Nothing else moves.
  assert.equal(raised.agentAccounts, ultra.agentAccounts);
  assert.equal(raised.branchesIncluded, ultra.branchesIncluded);
  // Nothing bought = the plan.
  assert.deepEqual(applyAddOnExtras(ultra, NO_EXTRAS), ultra);
  assert.deepEqual(applyAddOnExtras(ultra, null), ultra);
});

test('an add-on raises a number, never a feature — and never an unlimited one', () => {
  const zero = { ...tierCaps('enterprise'), waitlistAcceptances: 0, parentCategories: Infinity };
  const r = applyAddOnExtras(zero, { ...NO_EXTRAS, waitlist: 4, category: 4 });
  assert.equal(r.waitlistAcceptances, 0, 'a bought wait list conjured a wait list on a plan with none');
  assert.equal(r.parentCategories, Infinity);
  // Garbage counts floor at zero.
  const g = applyAddOnExtras(tierCaps('enterprise'), { ...NO_EXTRAS, service_card: -3 });
  assert.equal(g.serviceCardsTotal, TIER_CAPS.enterprise.serviceCardsTotal);
});

test('only Ultra may buy a seat or a branch; the four "+1" add-ons are not sold on any plan (2026-11-14)', () => {
  for (const kind of ULTRA_ADDON_ORDER) {
    const stillSold = kind === 'seat' || kind === 'branch';
    for (const t of VENDOR_TIERS) {
      assert.equal(canBuyUltraAddOn(kind, t), stillSold && t === 'enterprise', `${kind} on ${t}`);
    }
    assert.equal(canBuyUltraAddOn(kind, null), false);
  }
});

test('the list is the catalogue’s, in the owner’s order, with nothing off sale and no price typed', () => {
  assert.deepEqual([...ULTRA_ADDON_ORDER], ['category', 'service_card', 'seat', 'branch', 'waitlist', 'booking_per_date']);
  const rows = ultraAddOnsFromRows([
    // deliberately shuffled, one off sale, one unpriced
    { sku_code: 'vendor_extra_booking_per_date', title: 'Per date', price_php: '199.00', is_active: true },
    { sku_code: 'vendor_additional_branch', title: 'Branch', price_php: 990, is_active: true },
    { sku_code: 'vendor_extra_waitlist', title: 'Wait list', price_php: 199, is_active: false },
    { sku_code: 'vendor_extra_category', title: 'Category', price_php: 199, is_active: true },
    { sku_code: 'vendor_extra_seat', title: 'Seat', price_php: 990, is_active: true },
    { sku_code: 'vendor_extra_service_card', title: 'Card', price_php: null, is_active: true },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.pricePhp]),
    [
      ['category', 199],
      ['seat', 990],
      ['branch', 990],
      ['booking_per_date', 199],
    ],
  );
  assert.equal(rows.find((r) => r.kind === 'seat')?.buyHref, '/vendor-dashboard/team');
  assert.equal(rows.find((r) => r.kind === 'category')?.buyHref, null);

  // No peso figure is typed in the module or the card — every price is the catalogue's.
  // (The Ultra add-ons card was deleted 2026-11-14 — the four "+1" add-ons folded into Ultra's limits.)
  for (const f of [join(HERE, 'vendor-ultra-addons.ts')]) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, /₱\s?\d|\b(199|990)\b/, `${f} types an add-on price`);
  }
});

test('the service keys round-trip and join both registries', () => {
  const id = '6f1c2a54-0000-4000-8000-000000000001';
  for (const kind of COUNT_ADDON_KINDS) {
    const key = countAddOnServiceKey(kind, id);
    assert.deepEqual(parseCountAddOnServiceKey(key), { kind, vendorProfileId: id });
    assert.equal(isVendorSurfaceServiceKey(key), true, `${kind}: couple checkout could mint it`);
    assert.equal(vendorPaysSetnayan(key), true, `${kind}: a payout could be scheduled for a supplier's own purchase`);
  }
  assert.equal(parseCountAddOnServiceKey(COUNT_ADDONS.category.servicePrefix), null, 'an empty id parsed');
  assert.equal(parseCountAddOnServiceKey('vendor_extra_seat__x'), null);
  assert.equal(parseCountAddOnServiceKey(null), null);
});

test('the card editor: bookings a day are the shop\'s own number on every plan, up to 500 (owner 2026-11-18)', () => {
  assert.equal(bookingsPerDateRefusal({ requested: 1, stored: null }), null);
  assert.equal(bookingsPerDateRefusal({ requested: 30, stored: null }), null, 'a cake shop takes 30 a day on any plan');
  assert.equal(bookingsPerDateRefusal({ requested: DAILY_CAPACITY_MAX, stored: null }), null);
  assert.equal(bookingsPerDateRefusal({ requested: null, stored: 3 }), null, 'blank must save');
  assert.match(bookingsPerDateRefusal({ requested: DAILY_CAPACITY_MAX + 1, stored: null }) ?? '', /up to 500 bookings a day/);
  // A number held from before the ceiling re-saves as it is.
  assert.equal(bookingsPerDateRefusal({ requested: 600, stored: 600 }), null);
  assert.match(bookingsPerDateHelp(), /up to 500\. Every plan\.$/);
  assert.doesNotMatch(bookingsPerDateHelp(), /Ultra|Max|Pro|Plus|upgrade/i, 'the help names a plan again');
});
