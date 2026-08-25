/**
 * GUARD — a decided rule must have a CALLER.
 *
 * 🚨 THE DEFECT THIS EXISTS FOR. Owner, 2026-07-22: *"points in proportion to
 * what they paid"* — a supplier's free Papic shots scale with the booking fee
 * they paid, 50 at ₱0 up to 200 at ₱4,000. That ruling was written as
 * `vendorPapicPointsForBookingFee`, given **ten unit assertions**, and **called
 * by nothing in the application** for over a month. Only its own tests
 * referenced it. Every supplier kept getting the flat tier number regardless of
 * what they paid, and **not one test failed**, because a pure function tested in
 * isolation passes whether or not anybody uses it.
 *
 * 🔑 THE SAME SHAPE AS A GRANTED RPC NOBODY CALLS, AND A COLUMN WITH NO WRITER.
 * It typechecks, its tests are green, and the owner's decision does nothing.
 * The reason was honest at the time — this module's own header says the
 * booking-fee mechanism was *"still a working doc (unbuilt)"* — but the reason
 * expired when `booking_fee_charges` shipped, and nothing was watching for that.
 *
 * ⚠ SO THIS GUARD DOES NOT CHECK ARITHMETIC. `vendor-papic-tier.test.ts` does
 * that. This one asks the only question those tests cannot: **does the running
 * product actually consult it?**
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const ROUTE = join(WEB, 'app/api/vendor/papic-capture/route.ts');
const TIER = join(WEB, 'lib/vendor-papic-tier.ts');
const ROUTE_SRC = readFileSync(ROUTE, 'utf8');
const TIER_SRC = readFileSync(TIER, 'utf8');
const GRANTS_SRC = readFileSync(join(WEB, 'lib/vendor-papic-grants.ts'), 'utf8');

test('the capture route still exists and still meters — or every rule below is vacuous', () => {
  assert.ok(ROUTE_SRC.includes('canCapture('), 'the capture route no longer checks an allowance at all');
  assert.ok(TIER_SRC.includes('export function allowancePointsFor'), 'the resolver is gone');
});

test('🚨 the supplier capture path READS what they paid', () => {
  assert.ok(
    /fetchVendorBookingFeePaidPhp\(/.test(ROUTE_SRC),
    'the capture route no longer reads the booking fee. The owner ruled on 2026-07-22 that free ' +
      'shots scale with what a supplier paid; unread, every supplier silently drops back to the ' +
      'flat tier number and the ruling does nothing again.',
  );
});

test('🚨 …and PASSES it to the allowance check', () => {
  // Reading it and dropping it is the exact failure mode being guarded — the
  // value existed and reached nothing for a month.
  const call = /canCapture\(([^)]*)\)/.exec(ROUTE_SRC)?.[1] ?? '';
  assert.ok(
    /fee/i.test(call),
    `canCapture is called without the fee — it is read and then dropped on the floor. Call was: canCapture(${call})`,
  );
});

test('🚨 an unread fee grants nothing — null must never become a number', () => {
  const body = /export function allowancePointsFor[\s\S]*?\n}/.exec(TIER_SRC)?.[0] ?? '';
  assert.ok(body, 'allowancePointsFor was restructured beyond recognition');
  assert.ok(
    /bookingFeePaidPhp == null\) return base/.test(body),
    'an unread fee no longer falls back to the tier number — a metering outage could now mint points',
  );
});

test('🚨 the fee can only RAISE the allowance, never lower it', () => {
  const body = /export function allowancePointsFor[\s\S]*?\n}/.exec(TIER_SRC)?.[0] ?? '';
  assert.ok(
    /Math\.max\(base,/.test(body),
    'the fee no longer takes a MAX against the tier number. A founder-comped supplier on ltd (70) ' +
      'who paid nothing would be handed the 50 floor — 20 points taken away by connecting a wire.',
  );
});

test('🚨 what a supplier SEES and what a supplier GETS read the same inputs', () => {
  // `fetchVendorPapicAllowance` feeds the supplier's own on-the-day screen; the
  // capture route decides what is actually accepted. If only one of them learns
  // about the fee, a supplier is shown "50 shots" while the route accepts their
  // 125th — two screens disagreeing, with no error anywhere to notice it.
  const fn = /export async function fetchVendorPapicAllowance[\s\S]*?\n}/.exec(GRANTS_SRC)?.[0] ?? '';
  assert.ok(fn, 'fetchVendorPapicAllowance was restructured beyond recognition');
  assert.ok(
    /fetchVendorBookingFeePaidPhp\(/.test(fn),
    'the supplier-facing allowance no longer reads the booking fee, while the capture route does — ' +
      'the number they are shown and the number they get have come apart',
  );
  assert.ok(
    /captureAllowance\([^)]*fee/i.test(fn),
    'the fee is read for the supplier-facing allowance and then dropped before captureAllowance',
  );
});

test('🚨 all THREE supplier surfaces read the fee — not two of three', () => {
  // The route decides what is ACCEPTED, fetchVendorPapicAllowance feeds the
  // capture screen, and tierReadout is the badge on the on-the-day page. Wiring
  // any two of the three leaves a supplier reading one number and getting
  // another, with nothing anywhere reporting a disagreement.
  const onTheDay = readFileSync(join(WEB, 'app/vendor-dashboard/on-the-day/page.tsx'), 'utf8');
  assert.ok(
    /fetchVendorBookingFeePaidPhp\(/.test(onTheDay),
    "the on-the-day badge stopped reading the fee — it will show a supplier the 50-point floor while the route accepts their 800th",
  );
  assert.ok(
    /tierReadout\([^)]*fee/i.test(onTheDay),
    'the fee is read for the badge and then dropped before tierReadout',
  );
});

test('🚨 video is gated on the ALLOWANCE, not on an always-true tier flag', () => {
  // Owner 2026-08-26: "800 credits will allow them to take videos." Every tier
  // sets allowVideo: true, so keying the refusal on the tier alone means it can
  // never fire — which is exactly the state this replaced.
  assert.ok(
    /export const VENDOR_PAPIC_VIDEO_MIN_POINTS = 800/.test(TIER_SRC),
    'the 800-credit video threshold is gone',
  );
  const check = /export function canCapture[\s\S]*?\n}/.exec(TIER_SRC)?.[0] ?? '';
  assert.ok(
    /allowVideoFor\(tier, bookingFeePaidPhp\)/.test(check),
    'canCapture is back to asking the tier flag, which is true for every tier — the refusal can never fire again',
  );
});
