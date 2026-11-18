/**
 * ⚖ OWNER 2026-11-18, verbatim: "we only offer 1 QR Code. The rule is use GCash
 * for the first 100,000 transactions under 1,000 every month. and the rest goes
 * to BDO." · "just use 100,000 total payments" (pesos, per Manila month).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GCASH_ALLOWANCE_PHP_RULED,
  GCASH_MAX_PHP_RULED,
  gcashNumberOrNull,
  gcashUsedFromRows,
  pickPayerRail,
  type GcashGate,
} from './gcash-allowance';
import { payerAccountsFor, type ChannelSettings } from './payment-channels';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const gate = (usedThisMonthPhp: number | null, over: Partial<GcashGate> = {}): GcashGate => ({
  maxPhp: GCASH_MAX_PHP_RULED,
  allowancePhp: GCASH_ALLOWANCE_PHP_RULED,
  usedThisMonthPhp,
  ...over,
});

test('₱999 with room in the month → GCash', () => {
  assert.equal(pickPayerRail(999, gate(0)), 'gcash');
  assert.equal(pickPayerRail(999.99, gate(50_000)), 'gcash');
  // Landing EXACTLY on the allowance is still within it.
  assert.equal(pickPayerRail(999, gate(100_000 - 999)), 'gcash');
});

test('₱999 when the month would pass ₱100,000 → BDO', () => {
  assert.equal(pickPayerRail(999, gate(100_000 - 998)), 'bdo');
  assert.equal(pickPayerRail(999, gate(100_000)), 'bdo');
});

test('₱1,000 and above → BDO, always', () => {
  assert.equal(pickPayerRail(1000, gate(0)), 'bdo');
  assert.equal(pickPayerRail(1000.01, gate(0)), 'bdo');
  assert.equal(pickPayerRail(50_000, gate(0)), 'bdo');
});

test('any unreadable input → BDO', () => {
  assert.equal(pickPayerRail(500, null), 'bdo');
  assert.equal(pickPayerRail(500, gate(null)), 'bdo');
  assert.equal(pickPayerRail(500, gate(0, { maxPhp: null })), 'bdo');
  assert.equal(pickPayerRail(500, gate(0, { allowancePhp: null })), 'bdo');
  assert.equal(pickPayerRail(500, gate(0, { maxPhp: NaN })), 'bdo');
  assert.equal(pickPayerRail(500, gate(-1)), 'bdo');
  assert.equal(pickPayerRail(NaN, gate(0)), 'bdo');
  assert.equal(pickPayerRail(null, gate(0)), 'bdo');
  assert.equal(pickPayerRail(0, gate(0)), 'bdo');
  assert.equal(gcashNumberOrNull('abc'), null);
  assert.equal(gcashNumberOrNull(null), null);
  assert.equal(gcashNumberOrNull('1000.00'), 1000);
});

test('the month total counts pending + matched GCash only, never this order', () => {
  const used = gcashUsedFromRows(
    [
      { channel: 'gcash', amount_php: 500, status: 'matched', order_id: 'a' },
      { channel: 'gcash', amount_php: '250.50', status: 'pending', order_id: 'b' },
      { channel: 'gcash', amount_php: 900, status: 'rejected', order_id: 'c' },
      { channel: 'bdo', amount_php: 900, status: 'matched', order_id: 'd' },
      { channel: 'gcash', amount_php: 700, status: 'pending', order_id: 'self' },
    ],
    'self',
  );
  assert.equal(used, 750.5);
});

const SETTINGS: ChannelSettings = {
  gcash_enabled: true,
  bdo_enabled: true,
  gcash_number: '09170000000',
  bdo_account_number: '001234567890',
};

test('ONE account, never a choice: GCash when picked, BDO otherwise, BDO when GCash is off', () => {
  assert.deepEqual(payerAccountsFor(SETTINGS, 'gcash').map((a) => a.id), ['gcash']);
  assert.deepEqual(payerAccountsFor(SETTINGS, 'bdo').map((a) => a.id), ['bdo']);
  assert.deepEqual(
    payerAccountsFor({ ...SETTINGS, gcash_enabled: false }, 'gcash').map((a) => a.id),
    ['bdo'],
  );
});

test('the server refuses a GCash proof the rule would not have chosen — /pay and checkout', () => {
  const pay = read('app/pay/[reference]/actions.ts');
  assert.match(
    pay,
    /if \(isGcashRail\(\{ id: channel, label: channel \}\)\) \{\s*const pick = pickPayerRail\(payable\.amountPhp, await getGcashGate\(\{ excludeOrderId: payable\.orderId \}\)\);\s*if \(pick !== 'gcash'\) back\(reference, 'error', GCASH_PROOF_REFUSED_MESSAGE\);/,
  );
  // …and the refusal comes BEFORE the payment row is written.
  assert.ok(pay.indexOf('GCASH_PROOF_REFUSED_MESSAGE);') < pay.indexOf(".from('payments')\n    .insert("));

  const checkout = read('app/dashboard/[eventId]/checkout/actions.ts');
  assert.match(
    checkout,
    /if \(postedGcash && pickPayerRail\(finalAmountForPayment, await getGcashGate\(\)\) !== 'gcash'\) \{\s*return \{ ok: false, reason: GCASH_PROOF_REFUSED_MESSAGE \};/,
  );

  // The /pay page draws its one code from the same rule.
  const page = read('app/pay/[reference]/page.tsx');
  assert.match(page, /payerAccountsFor\(settings, railPick\)/);
  assert.doesNotMatch(page, /openAccounts\(settings\)/);
});
