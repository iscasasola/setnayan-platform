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
import { DAILY_CAPACITY_MAX, STORAGE_GB, TIER_CAPS, ULTRA_ADDON_GIVES, VENDOR_TIERS, WAITLIST_SETTING_MAX, tierCaps } from './vendor-tier-caps';
import {
  COUNT_ADDONS,
  COUNT_ADDON_KINDS,
  NO_EXTRAS,
  ULTRA_ADDON_ORDER,
  applyAddOnExtras,
  canBuyUltraAddOn,
  countAddOnServiceKey,
  parseCountAddOnServiceKey,
  ULTRA_ADDON_PERIOD_DAYS,
  addOnWindowStamp,
  addOnPeriodCoversNow,
  addOnWindowEnd,
  ultraAddOnWindowEnd,
  ultraAddOnsFromRows,
} from './vendor-ultra-addons';
import { isVendorSurfaceServiceKey } from './vendor-surface-service-keys';
import { vendorPaysSetnayan } from './vendor-pays-setnayan';
import { bookingsPerDateRefusal, bookingsPerDateHelp } from './card-bookings-per-date';

const HERE = dirname(fileURLToPath(import.meta.url));

test('a purchase raises the effective cap — one per paid add-on, on the allowance it names', () => {
  const ultra = tierCaps('enterprise');
  const raised = applyAddOnExtras(ultra, { ultra: 0, category: 2, service_card: 1, waitlist: 1, booking_per_date: 3 });
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

test('the list is the catalogue’s, with ONLY what is sold — the Ultra Add-on (2026-11-19) — and no price typed', () => {
  assert.deepEqual([...ULTRA_ADDON_ORDER], ['ultra', 'category', 'service_card', 'seat', 'branch', 'waitlist', 'booking_per_date']);
  const rows = ultraAddOnsFromRows([
    // deliberately shuffled: the retired single seat and branch still priced (they renew), a "+1" still active
    { sku_code: 'vendor_extra_booking_per_date', title: 'Per date', price_php: '199.00', is_active: true },
    { sku_code: 'vendor_additional_branch', title: 'Branch', price_php: 990, is_active: true },
    { sku_code: 'vendor_extra_seat', title: 'Seat', price_php: 990, is_active: true },
    { sku_code: 'vendor_ultra_addon', title: 'Ultra Add-on (4 weeks · Ultra only)', price_php: '2490.00', is_active: true },
  ]);
  assert.deepEqual(rows.map((r) => [r.kind, r.pricePhp]), [['ultra', 2490]]);
  assert.equal(rows[0]?.buyHref, null, 'the Ultra Add-on is bought on the Plan page');
  // Off sale or unpriced → not listed, never a fallback figure.
  assert.deepEqual(ultraAddOnsFromRows([{ sku_code: 'vendor_ultra_addon', title: 'x', price_php: 2490, is_active: false }]), []);
  assert.deepEqual(ultraAddOnsFromRows([{ sku_code: 'vendor_ultra_addon', title: 'x', price_php: null, is_active: true }]), []);

  // No peso figure is typed in the module or the card — every price is the catalogue's.
  // (The Ultra add-ons card was deleted 2026-11-14 — the four "+1" add-ons folded into Ultra's limits.)
  for (const f of [join(HERE, 'vendor-ultra-addons.ts')]) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, /₱\s?\d|\b(199|990|2490|2,490)\b/, `${f} types an add-on price`);
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

test('THE ULTRA ADD-ON (owner 2026-11-19): each one adds +1 branch · +15 live cards · +3 people · +50 GB, and it stacks', () => {
  const ultra = tierCaps('enterprise');
  for (const n of [1, 2, 3]) {
    const r = applyAddOnExtras(ultra, { ...NO_EXTRAS, ultra: n });
    assert.equal(r.branchesIncluded, ultra.branchesIncluded + n * ULTRA_ADDON_GIVES.branches, `${n}: branches`);
    assert.equal(r.serviceCardsTotal, ultra.serviceCardsTotal + n * ULTRA_ADDON_GIVES.liveCards, `${n}: cards`);
    assert.equal(r.agentAccounts, ultra.agentAccounts + n * ULTRA_ADDON_GIVES.people, `${n}: people`);
    assert.equal(r.storageBytes, (ultra.storageBytes ?? 0) + n * ULTRA_ADDON_GIVES.storageGb * STORAGE_GB, `${n}: storage`);
    // Nothing else moves.
    assert.equal(r.parentCategories, ultra.parentCategories);
  }
  assert.deepEqual(ULTRA_ADDON_GIVES, { branches: 1, liveCards: 15, people: 3, storageGb: 50 });
});

test('only the Ultra Add-on is sold, and only on Ultra (owner 2026-11-19: "just 1 pack")', () => {
  for (const t of VENDOR_TIERS) {
    assert.equal(canBuyUltraAddOn('ultra', t), t === 'enterprise', `ultra · ${t}`);
    for (const k of ULTRA_ADDON_ORDER.filter((x) => x !== 'ultra')) assert.equal(canBuyUltraAddOn(k, t), false, `${k} · ${t}`);
  }
  // Its paid orders are the shop's own Setnayan purchase, like every count add-on.
  assert.equal(isVendorSurfaceServiceKey(countAddOnServiceKey('ultra', 'vp-1')), true);
  assert.equal(parseCountAddOnServiceKey(countAddOnServiceKey('ultra', 'vp-1'))?.kind, 'ultra');
  assert.equal(COUNT_ADDONS.ultra.sku, 'vendor_ultra_addon');
  // ⏳ No stored count: it is counted LIVE from paid orders whose 28-day window covers now (review 2026-11-19).
  assert.equal(COUNT_ADDONS.ultra.column, null);
});

test('ONE PAYMENT BUYS 28 DAYS, NOT FOREVER — the window the activation hook stamps', () => {
  assert.equal(ULTRA_ADDON_PERIOD_DAYS, 28);
  const approved = Date.parse('2026-11-19T08:00:00Z');
  assert.equal(ultraAddOnWindowEnd(approved), '2026-12-17T08:00:00.000Z');
  // The hook stamps that window on the order, and the live count reads only paid orders inside it.
  const hook = stripComments(readFileSync(join(HERE, 'sku-activation.ts'), 'utf8'));
  // Every count add-on — the Ultra Add-on AND the "+1"s — gets that window, before the Ultra early return.
  assert.match(hook, /const expiresAt = addOnWindowEnd\(Date\.now\(\)\);[\s\S]{0,200}?\.update\(\{ expires_at: expiresAt \}\)[\s\S]{0,300}?\.is\('expires_at', null\)[\s\S]*?if \(target\.kind === 'ultra'\) \{/);
  const sql = readFileSync(join(HERE, '../../../supabase/migrations/20271351415438_ultra_addon_and_the_19_nov_plan_numbers.sql'), 'utf8');
  assert.match(sql, /o\.status = 'paid'\s+AND o\.expires_at IS NOT NULL\s+AND o\.expires_at > now\(\)/, 'the live count is not "paid AND in window"');
});

test('🔒 A WINDOW FOUND ON A NEVER-ACTIVATED ORDER IS NOT TRUSTED — the first activation overwrites it (ship review 22 Nov)', () => {
  // The hole: the hook stamped "only where the window is empty" on EVERY run, and a buyer could write
  // `orders.expires_at` on their own submitted order — a planted far date survived the approval, so one payment kept
  // the add-on for as long as the buyer had typed. (The database refuses that write too: 20271358916247 and
  // tests/db/orders-expires-at-is-the-servers.db.test.ts.)
  // SABOTAGE THAT TURNS THIS RED (run once, 22 Nov): in lib/sku-activation.ts make the stamp unconditional
  // `.is('expires_at', null)` again (drop the `addOnWindowStamp(…) === 'only-if-empty' ?` choice) → the third and
  // fourth assertions fail; return 'only-if-empty' for both arms of addOnWindowStamp → the first one fails.
  assert.equal(addOnWindowStamp(false), 'overwrite', 'a first activation kept whatever window sat on the unpaid order');
  assert.equal(addOnWindowStamp(true), 'only-if-empty', 'a re-approval would reset a window a renewal had extended');

  const src = stripComments(readFileSync(join(HERE, 'sku-activation.ts'), 'utf8'));
  const from = src.indexOf('const target = parseCountAddOnServiceKey(ctx.serviceKey);');
  const hook = src.slice(from, src.indexOf("if (target.kind === 'ultra') {", from));
  assert.ok(from > 0 && hook.length > 0, 'the count add-on hook was not found — this test reads nothing');
  // It asks the ledger whether THIS order was activated before — the service-role-only marker — and an unread answer throws.
  assert.match(
    hook,
    /\.from\('order_ledger'\)[\s\S]{0,200}?\.eq\('order_id', ctx\.orderId\)[\s\S]{0,80}?\.eq\('event_type', 'service_activated'\)[\s\S]{0,200}?if \(priorErr\) throw/,
    'the hook does not read (or does not refuse on an unread) prior activation',
  );
  // The "only where empty" filter is applied ONLY on a re-approval; a first activation writes unconditionally.
  assert.match(
    hook,
    /addOnWindowStamp\(Boolean\(priorActivation\)\) === 'only-if-empty' \? await stamp\.is\('expires_at', null\) : await stamp;/,
    'the stamp trusts a window already on a never-activated order',
  );
  assert.equal((hook.match(/\.is\('expires_at', null\)/g) ?? []).length, 1, 'a second, unconditional "only where empty" stamp is back');
  // The renewal still moves the add-on's own window in the database — this hook never writes over a renewed one.
  const sql = readFileSync(join(HERE, '../../../supabase/migrations/20271351415438_ultra_addon_and_the_19_nov_plan_numbers.sql'), 'utf8');
  assert.match(sql, /v_end := GREATEST\(COALESCE\(t\.expires_at, now\(\)\), now\(\)\) \+ interval '28 days';/);
});

test('A "+1" ADD-ON COUNTS ONLY THE PAID PERIODS THAT STILL COVER TODAY — never every paid order ever (review 2026-11-19)', () => {
  const now = Date.parse('2026-11-19T08:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  // Three paid orders: approved 3 days ago (live), 27 days ago (live, one day left), 29 days ago (lapsed).
  const windows = [now - 3 * day, now - 27 * day, now - 29 * day].map((approved) => addOnWindowEnd(approved));
  assert.deepEqual(windows.map((w) => addOnPeriodCoversNow(w, now)), [true, true, false]);
  assert.equal(windows.filter((w) => addOnPeriodCoversNow(w, now)).length, 2, 'a lapsed payment still counted');
  // The window's last instant has ended; an order with no window or an unreadable one grants nothing.
  assert.equal(addOnPeriodCoversNow(new Date(now).toISOString(), now), false);
  assert.equal(addOnPeriodCoversNow(null, now), false);
  assert.equal(addOnPeriodCoversNow('not a date', now), false);

  // The recompute reads exactly that set: paid AND the window ends after now — and an unread count never writes.
  const src = stripComments(readFileSync(join(HERE, 'sku-activation.ts'), 'utf8'));
  const fn = src.slice(src.indexOf('async function recomputeVendorAddOnCount('), src.indexOf('async function assertOrderOwnsVendorTarget('));
  assert.match(fn, /\.eq\('status', 'paid'\)\s*\.gt\('expires_at', new Date\(\)\.toISOString\(\)\)/, 'the recompute counts every paid order again, with no 28-day window');
  assert.match(fn, /if \(readErr\) throw/, 'an unread count would write 0 or a stale number over a paid one');

  // When a window lapses with no order event, the database recount lowers the stored count — and a job runs it.
  const sql = readFileSync(join(HERE, '../../../supabase/migrations/20271351415438_ultra_addon_and_the_19_nov_plan_numbers.sql'), 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.recount_vendor_count_addons\(\)/);
  assert.match(sql, /o\.status = 'paid' AND o\.expires_at > now\(\)/);
  const job = stripComments(readFileSync(join(HERE, 'vendor-addon-recount.server.ts'), 'utf8'));
  assert.match(job, /runClaimedJob\('count-addon-recount'[\s\S]*?rpc\('recount_vendor_count_addons'\)/);
});
