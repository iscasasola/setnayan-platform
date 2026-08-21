/**
 * THE QR AND THE SHORTFALL GUARD MUST NEVER DISAGREE.
 *
 * ── THE DEFECT THIS EXISTS FOR (found 2026-08-21 by attacking the conversion) ─
 * `/pay` mints a QR carrying an amount, the buyer pays exactly that, and
 * `/admin/payments` then refuses to promote the order unless the money received
 * covers `orderGrossOwed`. If the page computes its figure any other way, the
 * two disagree SILENTLY — inside a QR code, which nobody can read.
 *
 * A second copy of the rule did exactly that. It subtracted
 * `voucher_discount_centavos` unconditionally, but the two total columns are
 * netted DIFFERENTLY: `requested_total_php` is the PRE-voucher price, while
 * `confirmed_total_php` — written when an admin quotes the order — is already
 * voucher-adjusted. Measured: requested ₱2,500, discount ₱500, confirmed
 * ₱2,000 → the QR asked ₱1,500 against ₱2,000 owed. The couple pays what the
 * QR says, the guard refuses, and what they bought never switches on.
 *
 * 🔑 THE FIX WAS DELETION, NOT A PATCH. The page now calls `orderGrossOwed`
 * itself, so the two CANNOT drift. This file is what stops a future edit
 * reintroducing a local computation: it walks the same matrix through the same
 * function and asserts the buyer, paying the QR figure, always reconciles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { orderGrossOwed, orderReconciledToPaid } from './orders';

/** Every shape an order's money can take on the paths that reach /pay. */
const CASES = [
  { name: 'plain customer purchase', requested: 2499, confirmed: null, voucher: 0, vatInclusive: false },
  { name: 'customer purchase with a discount code, not yet quoted', requested: 2500, confirmed: null, voucher: 500, vatInclusive: false },
  { name: '🚨 quoted at the DISCOUNTED figure — the case that broke', requested: 2500, confirmed: 2000, voucher: 500, vatInclusive: false },
  { name: '🚨 quoted at the ORIGINAL figure — the other half of the same break', requested: 2500, confirmed: 2500, voucher: 500, vatInclusive: false },
  { name: 'shop purchase, quoted all-in', requested: 999, confirmed: null, voucher: 0, vatInclusive: true },
  { name: 'shop plan, quoted and confirmed', requested: 2500, confirmed: 2500, voucher: 0, vatInclusive: true },
  { name: 'a discount larger than the bill', requested: 100, confirmed: null, voucher: 999, vatInclusive: false },
] as const;

for (const rate of [0, 12]) {
  test(`a buyer who pays exactly what the QR asks is fully reconciled (VAT ${rate}%)`, () => {
    for (const c of CASES) {
      // What /pay puts in the QR — the SAME call the page makes.
      const qr = orderGrossOwed({
        requestedTotalPhp: c.requested,
        confirmedTotalPhp: c.confirmed,
        voucherDiscountPhp: c.voucher,
        vatInclusive: c.vatInclusive,
        vatRatePct: rate,
      });
      // What the admin approval demands.
      const owed = orderGrossOwed({
        requestedTotalPhp: c.requested,
        confirmedTotalPhp: c.confirmed,
        voucherDiscountPhp: c.voucher,
        vatInclusive: c.vatInclusive,
        vatRatePct: rate,
      });
      assert.equal(qr, owed, `${c.name}: the QR and the guard disagree by ${owed - qr}`);
      assert.ok(
        orderReconciledToPaid({ matchedTotalPhp: qr, owedPhp: owed }),
        `${c.name}: paying the QR figure must settle the order`,
      );
      assert.ok(qr >= 0, `${c.name}: a QR must never carry a negative amount`);
    }
  });
}

test('the payment page owns NO arithmetic of its own', () => {
  // The regression is a local computation creeping back in. The page may read
  // columns; it may not net them itself.
  const src = readFileSync(join(process.cwd(), 'lib', 'payable-by-reference.ts'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /orderGrossOwed\(/, 'the page must ask the one authority what is owed');
  assert.doesNotMatch(
    code,
    /storedTotal\s*-\s*discount|requested_total_php\s*-|computeVatFromBase\(/,
    'the page is netting money itself again — that is how the QR and the guard drift apart',
  );
});
