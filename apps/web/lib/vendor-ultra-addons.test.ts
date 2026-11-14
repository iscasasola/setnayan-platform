/**
 * ULTRA ADD-ONS — owner 2026-11-06, DECISION_LOG "ULTRA ADD-ON PRICES" (*"seat, branch + 990 / the rest is +199"*) and
 * "BOOKINGS PER DATE PER SERVICE IS A PLAN ALLOWANCE".
 *
 * Held here (pure — the database half is tests/db/bookings-per-date-is-a-plan-allowance.db.test.ts):
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
import { TIER_CAPS, VENDOR_TIERS, tierCaps } from './vendor-tier-caps';
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
  assert.equal(raised.servicesPerLeaf, ultra.servicesPerLeaf + 1);
  assert.equal(raised.waitlistAcceptances, ultra.waitlistAcceptances + 1);
  assert.equal(raised.bookingsPerDatePerService, ultra.bookingsPerDatePerService + 3);
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
  const g = applyAddOnExtras(tierCaps('enterprise'), { ...NO_EXTRAS, booking_per_date: -3 });
  assert.equal(g.bookingsPerDatePerService, TIER_CAPS.enterprise.bookingsPerDatePerService);
});

test('only Ultra may buy any Ultra add-on', () => {
  for (const kind of ULTRA_ADDON_ORDER) {
    for (const t of VENDOR_TIERS) {
      assert.equal(canBuyUltraAddOn(kind, t), t === 'enterprise', `${kind} on ${t}`);
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
  for (const f of [join(HERE, 'vendor-ultra-addons.ts'), join(HERE, '..', 'app/vendor-dashboard/subscription/_components/ultra-addons-card.tsx')]) {
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

test('the card editor: a NEW number past the plan is refused on every plan; a grandfathered one is not', () => {
  // Supplier Plus takes 1 a date.
  assert.equal(bookingsPerDateRefusal({ tier: 'solo', effectiveCap: 1, requested: 1, stored: null }), null);
  assert.equal(bookingsPerDateRefusal({ tier: 'solo', effectiveCap: 1, requested: null, stored: 3 }), null, 'blank must save');
  assert.match(bookingsPerDateRefusal({ tier: 'solo', effectiveCap: 1, requested: 2, stored: null }) ?? '', /up to 1 booking per date/);
  // Grandfathered: re-saving the number it already holds.
  assert.equal(bookingsPerDateRefusal({ tier: 'solo', effectiveCap: 1, requested: 3, stored: 3 }), null);
  assert.notEqual(bookingsPerDateRefusal({ tier: 'solo', effectiveCap: 1, requested: 4, stored: 3 }), null);
  // Ultra with two bought: 7.
  assert.equal(bookingsPerDateRefusal({ tier: 'enterprise', effectiveCap: 7, requested: 7, stored: null }), null);
  assert.match(bookingsPerDateHelp('enterprise', 7) ?? '', /up to 7 bookings per date.*Add more on your Plan page/);
  // Free / Verified: 1 each, like Supplier Plus (owner click 2026-11-06) — a NEW 2 is refused, 1 and blank save, a grandfathered
  // number re-saves, and the editor names the cap and Ultra's number.
  for (const t of ['free', 'verified'] as const) {
    const cap = TIER_CAPS[t].bookingsPerDatePerService;
    assert.equal(cap, 1, `${t} takes 1 a date`);
    assert.equal(bookingsPerDateRefusal({ tier: t, effectiveCap: cap, requested: 1, stored: null }), null);
    assert.equal(bookingsPerDateRefusal({ tier: t, effectiveCap: cap, requested: null, stored: 3 }), null, `${t}: blank must save`);
    assert.match(bookingsPerDateRefusal({ tier: t, effectiveCap: cap, requested: 2, stored: null }) ?? '', /up to 1 booking per date/);
    assert.equal(bookingsPerDateRefusal({ tier: t, effectiveCap: cap, requested: 3, stored: 3 }), null, `${t}: grandfathered`);
    assert.match(bookingsPerDateHelp(t, cap), new RegExp(`up to 1 booking per date.*Ultra takes ${TIER_CAPS.enterprise.bookingsPerDatePerService}`));
  }
  // Below Ultra, the words name Ultra's number from the table, never typed.
  assert.match(bookingsPerDateHelp('pro', 3) ?? '', new RegExp(`Ultra takes ${TIER_CAPS.enterprise.bookingsPerDatePerService}`));
});
