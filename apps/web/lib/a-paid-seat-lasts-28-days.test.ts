/**
 * ⏳ A PAID SINGLE EXTRA SEAT LASTS 28 DAYS, NOT FOREVER — controller ruling on PR #8019, 22 Nov, verbatim: *"ALSO fix
 * the single extra seat (recomputeVendorExtraSeats) the same way: a 28-day window per paid order. Add a guard test."*
 *
 * THE FAULT (the one the "+1" add-ons had, found in review on 19 Nov and left open for the seat). The stored count
 * `vendor_profiles.extra_agent_seats` was "every paid `vendor_extra_seat__<shop>` order, ever" — no window — so one
 * payment kept a seat for good.
 *
 * WHAT HOLDS NOW, the same four parts as the "+1" add-ons:
 *   1 · the activation hook stamps THIS seat order's own window (approval + 28 days) through the ONE shared stamp
 *       (`stampAddOnWindow` — which never trusts a window found on a never-activated order), BEFORE it counts;
 *   2 · the recompute counts paid orders whose window still covers now, and an unread count THROWS (it used to drop
 *       the read's error, so a refused read wrote 0 over a paid seat);
 *   3 · the migration gives every older paid seat order its window (§5a) and `recount_vendor_count_addons()` lowers the
 *       stored count when a window lapses with no order event (§5b) — the hourly `count-addon-recount` job runs it;
 *   4 · a seat order is never told to "renew": no seat is sold and the app has no way to renew one.
 * The database half is tests/db/vendor-plan-allowances.db.test.ts ("A PAID SINGLE SEAT…").
 *
 * SABOTAGE THAT TURNS THIS RED (each run once, 22 Nov):
 *   · lib/sku-activation.ts: delete `.gt('expires_at', new Date().toISOString())` from `recomputeVendorExtraSeats`
 *     → test 2 fails;
 *   · lib/sku-activation.ts: delete the seat hook's `await stampAddOnWindow(ctx, SEAT_SKU_CODE)` line → test 1 fails;
 *   · the migration: drop `extra_agent_seats = live.seat` from the recount → test 3 fails (and the DB test).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RENEWAL_NOT_REMINDED_PREFIXES } from './renewal-reminder-products';
import { stripComments } from './strip-comments';
import { SEAT_SERVICE_KEY_PREFIX, SEAT_SKU_CODE, seatServiceKey } from './vendor-seats';
import { canBuyExtraSeats, VENDOR_TIERS } from './vendor-tier-caps';
import { ULTRA_ADDON_PERIOD_DAYS, addOnPeriodCoversNow, addOnWindowEnd } from './vendor-ultra-addons';

const WEB = join(__dirname, '..');
const hooks = stripComments(readFileSync(join(WEB, 'lib/sku-activation.ts'), 'utf8'));
const sql = readFileSync(join(WEB, '../../supabase/migrations/20271351415438_ultra_addon_and_the_19_nov_plan_numbers.sql'), 'utf8');

test('1 · the seat hook stamps the order’s own 28-day window — through the one shared stamp — before it counts', () => {
  assert.equal(ULTRA_ADDON_PERIOD_DAYS, 28);
  assert.equal(SEAT_SKU_CODE, 'vendor_extra_seat');
  const from = hooks.indexOf('match: (serviceKey) => vendorProfileIdFromSeatServiceKey(serviceKey) !== null,');
  const hook = hooks.slice(from, hooks.indexOf('match: (serviceKey) => parseUltraAddOnRenewalServiceKey(serviceKey) !== null,', from));
  assert.ok(from > 0 && hook.length > 0, 'the seat hook was not found — this test reads nothing');
  const stamp = hook.indexOf('const expiresAt = await stampAddOnWindow(ctx, SEAT_SKU_CODE);');
  const count = hook.indexOf('await recomputeVendorExtraSeats(ctx.admin, vendorProfileId)');
  assert.ok(stamp > 0, 'a paid seat order gets no window — it would never be counted, or (before the fix) counted forever');
  assert.ok(count > stamp, 'the seats are counted before this order has its window — the just-paid seat is left out');
  assert.ok(hook.indexOf('await assertOrderOwnsVendorTarget(ctx, vendorProfileId);') < stamp, 'the window is stamped before the order is proven the shop’s own');
  // The shared stamp is the one that does not trust a window planted on an unpaid order (ship review 22 Nov).
  const shared = hooks.slice(hooks.indexOf('async function stampAddOnWindow('), hooks.indexOf('async function recomputeVendorAddOnCount('));
  assert.match(shared, /addOnWindowStamp\(Boolean\(priorActivation\)\) === 'only-if-empty' \? await stamp\.is\('expires_at', null\) : await stamp;/);
  assert.match(shared, /const expiresAt = addOnWindowEnd\(Date\.now\(\)\);/);
});

test('2 · the stored seat count is the paid orders whose window covers NOW — and an unread count throws, never writes 0', () => {
  const fn = hooks.slice(hooks.indexOf('async function recomputeVendorExtraSeats('), hooks.indexOf('async function stampAddOnWindow('));
  assert.ok(fn.length > 0, 'recomputeVendorExtraSeats was not found');
  assert.match(
    fn,
    /\.eq\('service_key', seatServiceKey\(vendorProfileId\)\)\s*\.eq\('status', 'paid'\)\s*\.gt\('expires_at', new Date\(\)\.toISOString\(\)\);/,
    'the seat recompute counts every paid order again, with no 28-day window',
  );
  assert.match(fn, /const \{ count, error: readErr \} = await admin/, 'the count read drops its error again');
  assert.match(fn, /if \(readErr\) throw new Error/, 'an unread seat count would write 0 over a paid seat');
  // The rule the count applies, in the one pure helper every add-on shares.
  const now = Date.parse('2026-11-22T08:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  assert.equal(addOnPeriodCoversNow(addOnWindowEnd(now - 27 * day), now), true, 'a seat with a day left was not counted');
  assert.equal(addOnPeriodCoversNow(addOnWindowEnd(now - 29 * day), now), false, 'a seat paid 29 days ago still counted');
  assert.equal(addOnPeriodCoversNow(null, now), false, 'a seat order with no window counted');
  // The refund path recomputes through the same function.
  assert.match(hooks, /const seatVendorId = vendorProfileIdFromSeatServiceKey\(ctx\.serviceKey\);\s*if \(seatVendorId\) \{\s*try \{\s*await recomputeVendorExtraSeats\(ctx\.admin, seatVendorId\);/);
});

test('3 · the migration gives older paid seat orders their window, and the recount lowers a lapsed seat', () => {
  assert.equal(seatServiceKey('x'), `${SEAT_SERVICE_KEY_PREFIX}x`);
  const like = SEAT_SERVICE_KEY_PREFIX.replace(/_/g, '\\_');
  // §5a — the backfill: first activation + 28 days, else created_at + 28 days; never moves a window already there.
  const backfill = sql.slice(sql.indexOf('UPDATE public.orders o\n   SET expires_at = COALESCE('), sql.indexOf('-- 5b ·'));
  assert.ok(backfill.length > 0, 'the §5a backfill was not found');
  assert.ok(backfill.includes(`OR o.service_key LIKE '${like}%'`), 'older paid seat orders get no window — the recount would drop them all at once, or (unfixed) never');
  assert.match(backfill, /AND o\.expires_at IS NULL/);
  assert.match(backfill, /\+ interval '28 days'/);
  // §5b — the recount.
  const recount = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.recount_vendor_count_addons()'), sql.indexOf('REVOKE ALL ON FUNCTION public.recount_vendor_count_addons()'));
  assert.match(recount, /WHERE o\.service_key = 'vendor_extra_seat__' \|\| vp\.vendor_profile_id::text\s+AND o\.status = 'paid' AND o\.expires_at > now\(\)\)::int AS seat/);
  assert.match(recount, /OR COALESCE\(vp\.extra_agent_seats, 0\) > 0/, 'a shop holding only seats is never recounted');
  assert.match(recount, /extra_agent_seats\s+= live\.seat/, 'the recount does not write the seat count');
  assert.match(recount, /COALESCE\(vp\.extra_agent_seats, 0\)\)\s+IS DISTINCT FROM \(live\.cat, live\.card, live\.wait, live\.bpd, live\.seat\)/);
  // …and a job runs it (hourly, request-driven).
  assert.match(stripComments(readFileSync(join(WEB, 'lib/vendor-addon-recount.server.ts'), 'utf8')), /runClaimedJob\('count-addon-recount'[\s\S]*?rpc\('recount_vendor_count_addons'\)/);
});

test('4 · a seat order is never told to renew — no seat is sold on any plan and the app cannot renew one', () => {
  for (const t of VENDOR_TIERS) assert.equal(canBuyExtraSeats(t), false, `${t} may buy a single seat again — then its renewal needs a real path`);
  assert.ok(RENEWAL_NOT_REMINDED_PREFIXES.includes(SEAT_SERVICE_KEY_PREFIX));
  const reminder = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.subscriptions_due_for_renewal_reminder'));
  assert.ok(reminder.slice(0, reminder.indexOf('$$;')).includes(`NOT LIKE '${SEAT_SERVICE_KEY_PREFIX.replace(/_/g, '\\_')}%'`), 'a seat order would be emailed "renew before then" with nothing to renew');
});
