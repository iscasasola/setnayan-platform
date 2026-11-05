/**
 * THE COUPLE'S SIDE READS THE CHARGE WHERE IT MUST — and shows no fee.
 *
 * ⚖ Owner 2026-10-07: "no handshake, no record · no handshake, no access to
 * certain features · no handshake, no confirmation of the event being booked to
 * them · meaning. no booking fee paid to us." 2026-10-12 #1 (the fee is made at
 * the yes) and #14 (couples are not told about the supplier fee). Audit
 * `BOOKING_FEE_RULES_AUDIT_2026-10-12.md` C6, F2, F3, F6 / build item 13.
 *
 * Grep-shaped where the code is `server-only`; the rule itself is executed in
 * `couple-booked-and-settled.test.ts`. Every check names the door it holds.
 *
 * SABOTAGE (2026-10-12): delete the `coupleMoneyNotYet` line in recordDeposit
 * → RED; send the "said yes" notice before the mint → RED; drop the settle
 * hook's call → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { COUPLE_MONEY_NOT_YET } from './couple-booked-and-settled';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The body of `export async function <name>(` up to the next top-level export. */
function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} not found — re-point this guard`);
  const next = src.indexOf('\nexport ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}

test('no handshake, no record — every couple money door asks first, server-side', () => {
  const DOORS: Array<[string, string]> = [
    ['app/dashboard/[eventId]/vendors/actions.ts', 'recordDeposit'],
    ['app/dashboard/[eventId]/vendors/actions.ts', 'raiseChangeOrder'],
    ['app/dashboard/[eventId]/budget/actions.ts', 'logPayment'],
    ['lib/vendor-payment-methods.server.ts', 'readPublishedMethodsForCouple'],
  ];
  for (const [file, fn] of DOORS) {
    const body = bodyOf(read(file), fn);
    assert.match(body, /coupleMoneyNotYet\(/, `${fn} records money (or shows account numbers) before the booking is confirmed`);
  }
});

test('no handshake, no access — the event is shared only with booked-and-settled suppliers', () => {
  const SHARES: Array<[string, string]> = [
    ['app/dashboard/[eventId]/studio/mood-board/actions.ts', 'shareMoodBoardWithVendors'],
    ['app/dashboard/[eventId]/_actions/day-of-broadcast.ts', 'emailVendorCallTimes'],
    ['lib/booked-host.ts', 'findBookedHost'],
  ];
  for (const [file, fn] of SHARES) {
    const body = bodyOf(read(file), fn);
    assert.match(body, /readCoupleBookingStandings\(/, `${fn} shares the event with a supplier who is not booked`);
    assert.match(body, /standing === 'booked'/, `${fn} reads the standing but does not act on it`);
  }
});

test('no handshake, no confirmation — a billed yes is told when the fee settles, not before', () => {
  const agree = bodyOf(read('app/vendor-dashboard/clients/[eventId]/actions.ts'), 'vendorAgreeToLock');
  const mintAt = agree.indexOf('mintBookingFeeForBooking(');
  const saidYesAt = agree.indexOf('said yes');
  assert.ok(mintAt > 0 && saidYesAt > 0, 'the mint or the notice moved — re-point this guard');
  assert.ok(mintAt < saidYesAt, 'the couple is told "said yes" before the fee is made — a billed booking would be confirmed to them');
  assert.match(agree, /feeBilledUnpaid = mintLeftAnUnpaidBill\(/);
  assert.match(agree, /if \(feeBilledUnpaid\) \{/, 'the "said yes" notice is not held back for a billed fee');
  assert.match(agree, /feeBilledUnpaid \? \{ emit: async \(\) => \{\} \} : undefined/, 'the "your booking is confirmed" plan notice is not held back');

  const sku = read('lib/sku-activation.ts');
  assert.match(sku, /if \(settled\) await tellCoupleTheBookingIsConfirmed\(ctx\.admin, chargeId\)/, 'nothing tells the couple when the fee settles');
});

test('the couple is never told about a fee', () => {
  const confirmed = read('lib/couple-booking-confirmed.server.ts');
  const told = [...confirmed.matchAll(/(?:title|body):\s*`([^`]*)`/g)].map((m) => m[1]!);
  assert.ok(told.length >= 2, `parse floor: found ${told.length} couple-facing strings`);
  for (const words of [...Object.values(COUPLE_MONEY_NOT_YET), ...told]) {
    assert.doesNotMatch(words, /\bfee\b/i, `a couple-facing sentence names the supplier's fee: ${words}`);
  }
});
