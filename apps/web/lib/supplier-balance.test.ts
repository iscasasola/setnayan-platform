/**
 * supplier-balance.test.ts — an overpaid supplier is not a settled one, and an
 * unread one is neither.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * A supplier's third money cell showed `remaining`, which is
 * `Math.max(0, itemizedTotal - paidTotal)`. Pay ₱450,000 against a ₱400,000
 * supplier and the clamp renders **"Remaining ₱0.00" in success green** —
 * byte-identical to an account that balances exactly. The couple is given no
 * signal at all that ₱50,000 went out beyond the agreed figure, on the screen
 * whose whole job is to tell them where their money is.
 *
 * The summary strip at the top of that same page already handles its own
 * version of this ("Over target", warning tone). The row below it did not.
 *
 * ── And why the claim needs BOTH reads ─────────────────────────────────────
 * `paidTotal` is 0 when the payments read was refused, and `itemizedTotal`
 * silently falls back to the headline figure when the line-items read was
 * refused. Either one alone can INVENT an overpayment or HIDE one — so with
 * either unmeasured the answer is `unknown` and the cell renders an em dash.
 * A wrong number about money is the worst version of a failed read rendered as
 * a fact; this file asserts both directions of that.
 *
 * These are real calls with real inputs, not a source scan — the behaviour is
 * pure arithmetic, so there is no reason to settle for reading the file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSupplierBalance } from './budget';

const measured = { paymentsMeasured: true, lineItemsMeasured: true };

test('a supplier who has been paid exactly is settled', () => {
  assert.deepEqual(
    describeSupplierBalance({ itemizedTotal: 400_000, paidTotal: 400_000, ...measured }),
    { state: 'settled', amountPhp: 0 },
  );
});

test('a supplier still owed money is owing, by the difference', () => {
  assert.deepEqual(
    describeSupplierBalance({ itemizedTotal: 400_000, paidTotal: 150_000, ...measured }),
    { state: 'owing', amountPhp: 250_000 },
  );
});

test('a supplier paid MORE than agreed is overpaid, and by how much', () => {
  const b = describeSupplierBalance({ itemizedTotal: 400_000, paidTotal: 450_000, ...measured });
  assert.equal(
    b.state,
    'overpaid',
    'an overpaid supplier came back as something else. Clamped at zero it renders "Remaining ₱0.00" in success green — exactly what a settled account renders — and the couple is never told that money went out beyond the agreed figure.',
  );
  assert.equal(
    b.state === 'overpaid' ? b.amountPhp : null,
    50_000,
    'the overpayment must be reported as a positive amount the couple can read, not as a negative remainder.',
  );
});

test('a refused PAYMENTS read is unknown, never settled and never overpaid', () => {
  // paidTotal is 0 on a refused read. Trusting it invents a full debt; trusting
  // it the other way could invent a settlement.
  assert.deepEqual(
    describeSupplierBalance({
      itemizedTotal: 400_000,
      paidTotal: 0,
      paymentsMeasured: false,
      lineItemsMeasured: true,
    }),
    { state: 'unknown' },
  );
});

test('a refused LINE-ITEMS read is unknown too — it is the half that can invent an overpayment', () => {
  // itemizedTotal falls back to the headline figure when its read was refused.
  // If that fallback is smaller than what has genuinely been paid, an honest
  // account reads as OVERPAID. That accusation must never be made on a guess.
  assert.deepEqual(
    describeSupplierBalance({
      itemizedTotal: 100_000,
      paidTotal: 400_000,
      paymentsMeasured: true,
      lineItemsMeasured: false,
    }),
    { state: 'unknown' },
  );
});

test('zero and zero is settled, not unknown — an empty supplier is a measured fact', () => {
  assert.deepEqual(
    describeSupplierBalance({ itemizedTotal: 0, paidTotal: 0, ...measured }),
    { state: 'settled', amountPhp: 0 },
  );
});
