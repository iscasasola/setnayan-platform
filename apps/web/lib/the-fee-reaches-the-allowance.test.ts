/**
 * GUARD — a decided rule must have a CALLER.
 *
 * 🚨 THE DEFECT THIS EXISTS FOR. Owner, 2026-07-22: *"points in proportion to
 * what they paid"*. That ruling was written as `vendorPapicPointsForBookingFee`,
 * given **ten unit assertions**, and **called by nothing in the application**
 * for over a month. Only its own tests referenced it. Every supplier kept
 * getting the flat tier number regardless of what they paid, and **not one
 * test failed**, because a pure function tested in isolation passes whether or
 * not anybody uses it.
 *
 * 🔁 THE NUMBER CHANGED ON 2026-09-05; THE WIRE THIS PINS DID NOT. Owner:
 * *"vendors get 5% of the amount they paid for on booking fee … when we approve
 * the payment"* and, of the old ₱5/point rate, *"replace it."* The rule is now
 * `vendorPortfolioCreditsForFee` (lib/vendor-papic-credits.ts), and it produces
 * a LEDGER row at admin approval instead of a live derivation — so the wire has
 * two halves where it used to have one:
 *
 *   1. the FEE must reach the RULE — inside the booking-fee activation hook,
 *      the only place *"when we approve the payment"* is true;
 *   2. the LEDGER must be read honestly — an unread ledger is null, never a
 *      number. (🔁 2026-11-23: the on-the-day CAMERA no longer reads the
 *      ledger — its limit is the shop's PLAN, owner ruling, held by
 *      `supplier-event-photo-limits.test.ts`. The ledger now funds G3's
 *      portfolio-import album only.)
 *
 * ⚠ SO THIS GUARD DOES NOT CHECK ARITHMETIC. `vendor-papic-credits.test.ts`
 * and `vendor-papic-tier.test.ts` do that. This one asks the only question
 * those tests cannot: **does the running product actually consult it?**
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import { stripComments } from '@/lib/strip-comments';
import { fetchVendorPapicCreditsGranted } from '@/lib/vendor-papic-grants';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const ROUTE_SRC = readFileSync(join(WEB, 'app/api/vendor/papic-capture/route.ts'), 'utf8');
const ACTIVATION_SRC = readFileSync(join(WEB, 'lib/sku-activation.ts'), 'utf8');

/** Source with comments removed — the explanation of a fix must not satisfy the check for it. */
const code = (src: string) => stripComments(src);

/**
 * Just enough of the query builder for `fetchVendorPapicCreditsGranted`'s shape:
 * `.from(table).select(cols).eq(k, v).eq(k, v)`, awaited with no terminal call.
 * `.then` makes the chain itself thenable, same as the real Postgrest builder.
 */
function fakeCreditsClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) builder[m] = () => builder;
  builder.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { from: () => builder } as unknown as SupabaseClient;
}

test('the capture route still exists and still meters — or the plan’s limit is vacuous', () => {
  assert.ok(ROUTE_SRC.includes('canCapture('), 'the capture route no longer checks an allowance at all');
});

// ── half 1 · the fee reaches the rule, at approval ─────────────────────────────

test('🚨 the 5% rule is CALLED — by the booking-fee approval hook, not only by its own tests', () => {
  const src = code(ACTIVATION_SRC);
  assert.ok(
    /vendorPortfolioCreditsForFee\(/.test(src),
    'sku-activation.ts no longer calls vendorPortfolioCreditsForFee. The owner ruled on 2026-09-05 ' +
      'that a supplier earns 5% of the booking fee as credits "when we approve the payment"; ' +
      'uncalled, the ruling is a pure function with passing tests and no effect — the exact ' +
      'state its predecessor sat in for a month.',
  );
});

test('🚨 …from inside the booking-fee hook, after the charge is settled', () => {
  // The hook is the only moment "when we approve the payment" is true for a
  // booking fee. Calling the rule anywhere else (submission, a cron, the
  // vendor's own page) would land credits the owner said must wait.
  const src = code(ACTIVATION_SRC);
  const hook = /chargeIdFromBookingFeeLockServiceKey\(ctx\.serviceKey\)[\s\S]*?\n    \},\n  \},/.exec(src)?.[0] ?? '';
  assert.ok(hook, 'the vendor_booking_fee__ prefix hook was restructured beyond recognition');
  assert.ok(
    /settleBookingFeeCharge\(/.test(hook),
    'the booking-fee hook no longer settles the charge — the money record is never marked paid',
  );
  assert.ok(
    /grantVendorPapicCreditsForBookingFee\(/.test(hook),
    'the booking-fee hook no longer grants the supplier their credits — the fee is settled and the ' +
      'owner’s 5% never lands',
  );
});

test('🚨 only a PAID charge earns — waived_free5 / waived_import mean they paid ₱0', () => {
  const src = code(ACTIVATION_SRC);
  const fn = /async function grantVendorPapicCreditsForBookingFee[\s\S]*?\n}/.exec(src)?.[0] ?? '';
  assert.ok(fn, 'grantVendorPapicCreditsForBookingFee is gone');
  assert.ok(
    /status !== 'paid'\) return/.test(fn),
    'the booking-fee grant no longer refuses a non-paid charge. The owner’s own first-5-free ' +
      'rule (waived_free5) and imports (waived_import) would be read as paid and handed credits.',
  );
  assert.ok(
    /booking_fee_charges/.test(fn) && /amount_charged_centavos/.test(fn),
    'the fee is no longer read from the charge (the money record) — a number from anywhere else is a guess',
  );
});

test('🚨 the pack door is registered — ₱500 lands the pack credits on approval of THAT order', () => {
  const src = code(ACTIVATION_SRC);
  assert.ok(
    /\[VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE\]: grantVendorPapicPortfolioPack/.test(src),
    'the pack SKU has no activation hook — a supplier pays ₱500, the admin approves, and nothing lands',
  );
  const fn = /async function grantVendorPapicPortfolioPack[\s\S]*?\n}/.exec(src)?.[0] ?? '';
  // Since the shop wallet (2026-10-23, option A) the pack lands as a SIGNED wallet row (`delta:`), not an event
  // grant (`credits:`) — either way it must be the declared pack size, never a literal. Since the final price sheet
  // (2026-11-04) the retired pack and the shop's Papic packs share ONE wallet writer, `grantShopWalletCredits`: the
  // retired pack hands it the declared size, and the writer lands exactly what it was handed.
  const inline = /(?:credits|delta): VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS\b/.test(fn);
  const viaWriter = /grantShopWalletCredits\(ctx, async \(\) => VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS\)/.test(fn);
  assert.ok(inline || viaWriter, 'the pack grants a number other than the declared pack size');
  if (viaWriter) {
    const writer = /async function grantShopWalletCredits\([\s\S]*?\n}/.exec(src)?.[0] ?? '';
    assert.ok(writer, 'grantShopWalletCredits is gone');
    assert.match(writer, /const credits = await creditsOf\(\);/, 'the wallet writer no longer lands the credits it was handed');
    assert.match(writer, /delta: credits,/, 'the wallet writer lands a number other than the credits it was handed');
  }
});

test('🚨 the ledger is idempotent per (order, source) — the hook treats a unique violation as "already granted"', () => {
  const src = code(ACTIVATION_SRC);
  const fn = /async function grantVendorPapicCredits\([\s\S]*?\n}/.exec(src)?.[0] ?? '';
  assert.ok(fn, 'grantVendorPapicCredits is gone');
  assert.ok(
    /23505/.test(fn),
    'a re-approval racing a first approval would now report an error instead of a no-op, or worse, ' +
      'the unique index was dropped and it double-grants',
  );
});

// ── half 2 · an unread ledger grants nothing ─────────────────────────────────

test('🚨 an unread ledger grants nothing — null must never become a number', async () => {
  // EXECUTE the reader against a refused read rather than pattern-match its
  // source. The property is "a refused read must never grant credits" — that
  // must hold however the early return is phrased (braces, a logged reason,
  // anything), not only when it is spelled exactly `if (error) return null`.
  const refused = fakeCreditsClient({ data: null, error: { message: 'refused' } });
  assert.equal(
    await fetchVendorPapicCreditsGranted(refused, 'v1', 'e1'),
    null,
    'a refused ledger read must return null, never a number — a metering outage could mint points',
  );

  // And prove the assertion above is load-bearing: the SAME query shape with
  // no error yields a real summed number, so the null is specifically the
  // error path, not "this function always returns null".
  const ok = fakeCreditsClient({ data: [{ credits: 40 }, { credits: 10 }], error: null });
  assert.equal(await fetchVendorPapicCreditsGranted(ok, 'v1', 'e1'), 50);
});

test('🚨 the retired rate has no application caller left — it was replaced, not duplicated', () => {
  // Owner 2026-09-05: "replace it." Two rates for one fee is the two-sources-
  // of-truth trap; a lingering reader of booking_fee_charges on the capture
  // path would quietly re-derive the old allowance beside the new one.
  for (const rel of ['app/api/vendor/papic-capture/route.ts', 'lib/vendor-papic-grants.ts', 'lib/vendor-papic-tier.ts']) {
    const c = code(readFileSync(join(WEB, rel), 'utf8'));
    assert.ok(!/fetchVendorBookingFeePaidPhp/.test(c), `${rel}: the retired fee reader is back`);
    assert.ok(!/vendorPapicPointsForBookingFee/.test(c), `${rel}: the retired ₱5/point rule is back`);
  }
});
