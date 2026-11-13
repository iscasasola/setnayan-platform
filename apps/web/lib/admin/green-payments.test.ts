/**
 * "APPROVE ALL N GREEN" approves only what the desk already calls a clean match.
 *
 * Owner-approved admin drawing (Setnayan-specs prototypes/admin_pub/work.html;
 * SOLO-OPERATOR-AUDIT.md Top-10 #4). The guarantees, each one a way this could
 * be broken by somebody who meant well:
 *   1. green ⇔ isDecisivePaymentMatch AND no counted duplicate — the desk's own
 *      rule, not a second one;
 *   2. every amber row says why, in one line;
 *   3. the receipt read is a LINE on the row, never an input to green;
 *   4. the batch re-sorts every id on the server and approves through the one
 *      money core, never with a duplicate acknowledged;
 *   5. the shipped confirm step stays — the press opens the house confirm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isDecisivePaymentMatch } from '@/lib/orders';
import { paymentLight, receiptVerdictLine, greenIds, type PaymentLightInput } from '@/lib/admin/green-payments';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const BASE: PaymentLightInput = {
  referenceNumber: 'GC-SN1A2B3C4D-884213',
  referenceCode: 'SN1A2B3C4D',
  amountPhp: 2499,
  requestedTotalPhp: 2499,
  confirmedTotalPhp: null,
  voucherDiscountPhp: 0,
  serviceKey: 'PAPIC_PASS',
  duplicate: false,
  hasScreenshot: true,
};

test('a desk clean match with no duplicate is green', () => {
  assert.deepEqual(paymentLight(BASE), { light: 'green' });
});

test('🔑 green ⇔ the desk’s decisive match AND no duplicate — over a grid of cases', () => {
  const refs = [null, '', 'GC-884213', 'GC-SN1A2B3C4D-884213', 'sn1a2b3c4d'];
  const amounts = [0, 1000, 2498, 2499, 2500, 9999];
  const totals = [null, 2499, 3000];
  const discounts = [0, 500];
  for (const referenceNumber of refs)
    for (const amountPhp of amounts)
      for (const requestedTotalPhp of totals)
        for (const voucherDiscountPhp of discounts)
          for (const duplicate of [false, true])
            for (const hasScreenshot of [false, true]) {
              const p = { ...BASE, referenceNumber, amountPhp, requestedTotalPhp, voucherDiscountPhp, duplicate, hasScreenshot };
              const desk = !duplicate && isDecisivePaymentMatch(p);
              const light = paymentLight(p);
              assert.equal(light.light === 'green', desk, JSON.stringify(p));
              if (light.light === 'amber') assert.ok(light.why.trim().length > 10, `amber with no why: ${JSON.stringify(p)}`);
            }
});

test('every amber row says why — the reasons a person can act on', () => {
  const why = (p: Partial<PaymentLightInput>) => {
    const l = paymentLight({ ...BASE, ...p });
    assert.equal(l.light, 'amber');
    return l.light === 'amber' ? l.why : '';
  };
  assert.match(why({ duplicate: true }), /already counted/);
  assert.match(why({ referenceNumber: null, hasScreenshot: false }), /No reference or screenshot/);
  assert.match(why({ referenceNumber: 'GC-884213' }), /order code is not in the reference/);
  assert.match(why({ referenceNumber: null }), /No reference typed/);
  assert.match(why({ requestedTotalPhp: null }), /no total/);
  assert.match(why({ amountPhp: 1000 }), /does not cover/);
});

test('the receipt read is a line on the row — never an input to green', () => {
  // The rule has no receipt argument at all, so a model's reading cannot reach it.
  const src = code('lib/admin/green-payments.ts');
  const fn = src.slice(src.indexOf('export function paymentLight'), src.indexOf('export type ReceiptReadLine'));
  assert.ok(fn.length > 200, 'could not find paymentLight');
  assert.doesNotMatch(fn, /summary|receipt|reference_matches|amount_matches/i);
  // …and the read that the batch re-checks with never loads the advisory table.
  assert.doesNotMatch(code('lib/admin/green-payments.server.ts'), /payment_receipt_reads/);
  assert.match(code('lib/admin/payment-verdicts.server.ts'), /payment_receipt_reads/);
});

test('the verdict line says what the reader said, or why there is nothing', () => {
  assert.match(
    receiptVerdictLine({ status: 'ok', summary: 'The number they typed is on the receipt (884213). Still check your bank app — a screenshot is not proof the money arrived.' }, false),
    /^Receipt read: The number they typed is on the receipt .* Still check your bank app/,
  );
  assert.match(receiptVerdictLine(undefined, false), /not read yet/);
  assert.match(receiptVerdictLine({ status: 'failed', summary: null }, false), /could not run/);
  // A failed load of the reads is never "not read yet".
  assert.match(receiptVerdictLine(undefined, true), /Couldn’t load/);
});

test('greenIds lists only the green rows', () => {
  const row = (id: string, green: boolean) => ({
    paymentId: id,
    amountPhp: 1,
    channel: null,
    referenceNumber: null,
    who: 'x',
    createdAt: '2026-11-13T00:00:00Z',
    hasProof: true,
    light: green ? ({ light: 'green' } as const) : ({ light: 'amber', why: 'held for a reason' } as const),
  });
  assert.deepEqual(greenIds([row('a', true), row('b', false), row('c', true)]), ['a', 'c']);
});

test('the batch re-sorts on the server and approves through the one money core', () => {
  const src = code('app/admin/work/actions.ts');
  const fn = src.slice(src.indexOf('async function approveGreenPayments'));
  assert.ok(fn.length > 300, 'approveGreenPayments is gone');
  assert.match(fn, /readPaymentLights\(admin, \{ paymentIds: ids \}\)/, 'ids are not re-checked before approval');
  assert.match(fn, /stillGreen\.has\(id\)/, 'a row no longer green is not skipped');
  assert.match(fn, /approvePaymentCore\(/, 'the batch does not use the single money path');
  assert.doesNotMatch(fn, /acknowledgeDuplicate/, 'a duplicate may never clear in a batch');
  // A failed re-check approves nothing.
  assert.match(fn, /if \(!read\.ok\)[\s\S]{0,80}redirect\(/);
});

test('the shipped confirm step stays — the press opens the house confirm, listing every payment', () => {
  const src = code('app/admin/queues/_components/green-batch.tsx');
  assert.match(src, /<ConfirmForm/, 'the batch button no longer asks first');
  assert.match(src, /name="intent" value="approve-green"/);
  assert.match(src, /green\.map\(\(r\) => \(\s*<li/, 'the confirm no longer lists what it approves');
  // A failed sort is said — never drawn as "0 green".
  assert.match(src, /Couldn’t sort the payments/);
});
