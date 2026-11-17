/**
 * ⚖ OWNER 2026-11-17 (DECISION_LOG): the booking fee can never exceed ₱100,000,
 * and no single payment made TO SETNAYAN — booking fees, gifts, plans — may
 * exceed ₱100,000. EXACTLY ₱100,000 IS ALLOWED. Couples paying suppliers are not
 * covered. The number is `platform_settings.max_payment_php`, never typed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paymentOverCeilingMessage, paymentWithinCeiling } from './payment-ceiling';
import { stripComments } from './strip-comments';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('exactly the ceiling is allowed; a centavo over is refused', () => {
  assert.equal(paymentWithinCeiling(100_000, 100_000), true);
  assert.equal(paymentWithinCeiling(99_999.99, 100_000), true);
  assert.equal(paymentWithinCeiling(100_000.01, 100_000), false);
  assert.equal(paymentWithinCeiling(250_000, 100_000), false);
});

test('the admin setting moves it; an unreadable setting falls to the ruled ₱100,000, never higher', () => {
  assert.equal(paymentWithinCeiling(150_000, 200_000), true);
  assert.equal(paymentWithinCeiling(150_000, Number.NaN), false);
  assert.equal(paymentWithinCeiling(100_000, 0), true);
  assert.equal(paymentWithinCeiling(Number.NaN, 100_000), false, 'a nonsense amount is never "within"');
});

test('the payer is told the ceiling, and that nothing was charged', () => {
  const m = paymentOverCeilingMessage(100_000);
  assert.match(m, /₱100,000\.00/);
  assert.match(m, /Nothing has been charged/);
});

test('the /pay action refuses an over-ceiling payment on the server', () => {
  const action = read('app/pay/[reference]/actions.ts');
  assert.match(action, /const maxPaymentPhp = await getMaxPaymentPhp\(supabase\);/);
  assert.match(action, /if \(!paymentWithinCeiling\(payable\.amountPhp, maxPaymentPhp\)\)/);
  // …and BEFORE anything is written.
  assert.ok(
    action.indexOf('paymentWithinCeiling(payable.amountPhp') < action.indexOf(".from('payments')"),
    'the ceiling is checked after the payment row is written',
  );
});

test('the /pay page shows no code for an over-ceiling bill', () => {
  const page = read('app/pay/[reference]/page.tsx');
  assert.match(page, /const overCeiling = !paymentWithinCeiling\(payable\.amountPhp, maxPaymentPhp\);/);
  assert.match(page, /const open = overCeiling \? \[\] : openAccounts\(settings\);/, 'a code is still minted above the ceiling');
  assert.match(page, /\{!waiting && !overCeiling && \(\s*<PayPanel/);
});

test('the couple checkout refuses an over-ceiling basket before it mints an order', () => {
  const action = read('app/dashboard/[eventId]/checkout/actions.ts');
  const check = action.indexOf('paymentWithinCeiling(finalAmountForPayment, maxPaymentPhp)');
  assert.ok(check > 0, 'the checkout no longer checks the ceiling');
  assert.ok(check < action.indexOf('orderRowFor('), 'the ceiling is checked after the order is minted');
});

test('the booking fee is capped in BOTH mirrors (TS and SQL)', () => {
  assert.match(read('lib/booking-fee.ts'), /Math\.min\(floored, maxPaymentPhpOrDefault\(schedule\.maxPhp\)\)/);
  assert.match(read('lib/booking-fee-settings.server.ts'), /maxPhp: maxPaymentPhpOrDefault\(row\.max_payment_php\)/);
  const sql = read('../../supabase/migrations/20271350390157_bdo_only_pay_flow_and_the_payment_max.sql');
  assert.match(sql, /round\(s\.max_php \* 100\)::BIGINT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS max_payment_php NUMERIC\(12,2\) NOT NULL DEFAULT 100000/);
});

test('no surface types the ceiling', () => {
  for (const rel of [
    'app/pay/[reference]/actions.ts',
    'app/pay/[reference]/page.tsx',
    'app/dashboard/[eventId]/checkout/actions.ts',
    'lib/payment-ceiling.ts',
  ]) {
    assert.doesNotMatch(stripComments(read(rel)), /100[_,]?000/, `${rel} types the ceiling`);
  }
});
