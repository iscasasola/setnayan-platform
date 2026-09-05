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
 *   2. the LEDGER must reach the ALLOWANCE — all three supplier surfaces (the
 *      capture route, the capture screen, the on-the-day badge) must read the
 *      credits and pass them on, or a supplier is shown one number and gets
 *      another with no error anywhere.
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

import { stripComments } from '@/lib/strip-comments';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const ROUTE_SRC = readFileSync(join(WEB, 'app/api/vendor/papic-capture/route.ts'), 'utf8');
const TIER_SRC = readFileSync(join(WEB, 'lib/vendor-papic-tier.ts'), 'utf8');
const GRANTS_SRC = readFileSync(join(WEB, 'lib/vendor-papic-grants.ts'), 'utf8');
const ACTIVATION_SRC = readFileSync(join(WEB, 'lib/sku-activation.ts'), 'utf8');

/** Source with comments removed — the explanation of a fix must not satisfy the check for it. */
const code = (src: string) => stripComments(src);

test('the capture route still exists and still meters — or every rule below is vacuous', () => {
  assert.ok(ROUTE_SRC.includes('canCapture('), 'the capture route no longer checks an allowance at all');
  assert.ok(TIER_SRC.includes('export function allowancePointsFor'), 'the resolver is gone');
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

test('🚨 the pack door is registered — ₱500 → 25 credits on approval of THAT order', () => {
  const src = code(ACTIVATION_SRC);
  assert.ok(
    /\[VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE\]: grantVendorPapicPortfolioPack/.test(src),
    'the pack SKU has no activation hook — a supplier pays ₱500, the admin approves, and nothing lands',
  );
  const fn = /async function grantVendorPapicPortfolioPack[\s\S]*?\n}/.exec(src)?.[0] ?? '';
  assert.ok(
    /credits: VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS/.test(fn),
    'the pack grants a number other than the declared pack size',
  );
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

// ── half 2 · the ledger reaches the allowance, on all three surfaces ───────────

test('🚨 the supplier capture path READS the credits they hold', () => {
  assert.ok(
    /fetchVendorPapicCreditsGranted\(/.test(code(ROUTE_SRC)),
    'the capture route no longer reads the credit ledger. Unread, every supplier silently drops ' +
      'back to the flat tier number and the owner’s 5% rule does nothing again.',
  );
});

test('🚨 …and PASSES them to the allowance check', () => {
  // Reading it and dropping it is the exact failure mode being guarded — the
  // value existed and reached nothing for a month.
  const call = /canCapture\(([^)]*)\)/.exec(code(ROUTE_SRC))?.[1] ?? '';
  assert.ok(
    /credits/i.test(call),
    `canCapture is called without the credits — they are read and then dropped on the floor. Call was: canCapture(${call})`,
  );
});

test('🚨 an unread ledger grants nothing — null must never become a number', () => {
  const body = /export function allowancePointsFor[\s\S]*?\n}/.exec(TIER_SRC)?.[0] ?? '';
  assert.ok(body, 'allowancePointsFor was restructured beyond recognition');
  assert.ok(
    /creditsGranted == null\) return base/.test(body),
    'an unread ledger no longer falls back to the tier number — a metering outage could now mint points',
  );
  const reader = /export async function fetchVendorPapicCreditsGranted[\s\S]*?\n}/.exec(GRANTS_SRC)?.[0] ?? '';
  assert.ok(reader, 'fetchVendorPapicCreditsGranted is gone');
  assert.ok(
    /if \(error\) return null/.test(reader),
    'the ledger reader returns something other than null on a read error — a failed read is not a zero balance',
  );
});

test('🚨 the credits can only RAISE the allowance, never lower it', () => {
  const body = /export function allowancePointsFor[\s\S]*?\n}/.exec(TIER_SRC)?.[0] ?? '';
  assert.ok(
    /Math\.max\(base,/.test(body),
    'the credits no longer take a MAX against the tier number. A founder-comped supplier on ltd (70) ' +
      'whose ledger holds 0 would be handed 0 — 70 points taken away by connecting a wire.',
  );
});

test('🚨 what a supplier SEES and what a supplier GETS read the same inputs', () => {
  // `fetchVendorPapicAllowance` feeds the supplier's own capture screen; the
  // capture route decides what is actually accepted. If only one of them learns
  // about the ledger, a supplier is shown "50 shots" while the route accepts
  // their 125th — two screens disagreeing, with no error anywhere to notice it.
  const fn = /export async function fetchVendorPapicAllowance[\s\S]*?\n}/.exec(GRANTS_SRC)?.[0] ?? '';
  assert.ok(fn, 'fetchVendorPapicAllowance was restructured beyond recognition');
  assert.ok(
    /fetchVendorPapicCreditsGranted\(/.test(fn),
    'the supplier-facing allowance no longer reads the ledger, while the capture route does — ' +
      'the number they are shown and the number they get have come apart',
  );
  assert.ok(
    /captureAllowance\([^)]*credits/i.test(fn),
    'the credits are read for the supplier-facing allowance and then dropped before captureAllowance',
  );
});

test('🚨 all THREE supplier surfaces read the ledger — not two of three', () => {
  // The route decides what is ACCEPTED, fetchVendorPapicAllowance feeds the
  // capture screen, and tierReadout is the badge on the on-the-day page. Wiring
  // any two of the three leaves a supplier reading one number and getting
  // another, with nothing anywhere reporting a disagreement.
  const onTheDay = code(readFileSync(join(WEB, 'app/vendor-dashboard/on-the-day/page.tsx'), 'utf8'));
  assert.ok(
    /fetchVendorPapicCreditsGranted\(/.test(onTheDay),
    'the on-the-day badge stopped reading the ledger — it will show a supplier the 50-point floor while the route accepts their 1,000th',
  );
  assert.ok(
    /tierReadout\([^)]*credits/i.test(onTheDay),
    'the credits are read for the badge and then dropped before tierReadout',
  );
});

test('🚨 the retired rate has no application caller left — it was replaced, not duplicated', () => {
  // Owner 2026-09-05: "replace it." Two rates for one fee is the two-sources-
  // of-truth trap; a lingering reader of booking_fee_charges on the capture
  // path would quietly re-derive the old allowance beside the new one.
  for (const [name, src] of [
    ['route', ROUTE_SRC],
    ['grants', GRANTS_SRC],
    ['tier', TIER_SRC],
  ] as const) {
    const c = code(src);
    assert.ok(!/fetchVendorBookingFeePaidPhp/.test(c), `${name}: the retired fee reader is back`);
    assert.ok(!/vendorPapicPointsForBookingFee/.test(c), `${name}: the retired ₱5/point rule is back`);
  }
});

test('🚨 video is gated on the ALLOWANCE, not on an always-true tier flag', () => {
  // Owner 2026-08-26: "800 credits will allow them to take videos." Every tier
  // sets allowVideo: true, so keying the refusal on the tier alone means it can
  // never fire — which is exactly the state this replaced. The threshold is
  // UNCHANGED on 2026-09-05; whether it should be is an open owner question.
  assert.ok(
    /export const VENDOR_PAPIC_VIDEO_MIN_POINTS = 800/.test(TIER_SRC),
    'the 800-credit video threshold moved without an owner answer — it is an open question, not a default',
  );
  const check = /export function canCapture[\s\S]*?\n}/.exec(TIER_SRC)?.[0] ?? '';
  assert.ok(
    /allowVideoFor\(tier, creditsGranted\)/.test(check),
    'canCapture is back to asking the tier flag, which is true for every tier — the refusal can never fire again',
  );
});

test('🚨 the no-video refusal names the REAL reason', () => {
  // It read "Photos only on Papic Lite" while video was a tier flag. Now video
  // is the 800-credit threshold, so that copy named the wrong tier to a Ltd
  // supplier AND the wrong reason to everyone. A refusal that misdescribes
  // itself sends somebody to fix the thing that was never the problem.
  const ctl = readFileSync(
    join(WEB, 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller.tsx'),
    'utf8',
  );
  const rendered = ctl.replace(/\/\*[\s\S]*?\*\//g, ' '); // the fix explains itself in a comment
  assert.ok(
    !/Photos only on Papic/.test(rendered),
    'the shutter hint blames the tier again — the reason is the credit threshold',
  );
  assert.ok(
    /VENDOR_PAPIC_VIDEO_MIN_POINTS/.test(rendered),
    'the threshold is hard-typed into the copy instead of derived — it will drift the first time the number moves',
  );
});
