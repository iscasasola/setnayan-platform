/**
 * client-payment-view.test.ts — 💸 ONE CLIENT'S PAYMENT FIGURES ARE THE ROWS' OWN FOLD (THE ONE BUILD B2 §2.3, guard).
 *
 *   1 · with a plan: Agreed · Paid · To collect = `priceSummaryOf`'s total · paid · left — the same fold the rows read;
 *       the Next line is the first payment not received, "Check" when the couple logged it;
 *   2 · an amount not set yet: no total ("—") and To collect is a floor;
 *   3 · no plan: the payday ledger; refused → every figure null + partial — never ₱0, never a smaller total;
 *   4 · booked with no plan and nothing logged → no figures at all (the page says so) — never "₱0 · all paid".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientPaymentView } from './client-payment-view';
import { priceSummaryOf } from './price-summary';
import type { StepperInstallment } from './vendor-service-payment-schedules';

const step = (seq: number, label: string, amount: number | null, due: string | null, state: StepperInstallment['state']): StepperInstallment =>
  ({ seq, label, amount_php: amount, due_date: due, amount_kind: 'fixed', percent_bps: null, state }) as StepperInstallment;
const NO_LEDGER = { rows: [], receivedPhp: 0, expectedPhp: 0 };

test('1 · a plan: the figures are priceSummaryOf’s, and Next is the first payment not received', () => {
  const steps = [step(1, 'Downpayment', 8000, '2026-10-01', 'paid'), step(2, 'Balance', 30000, '2026-11-01', 'pending'), step(3, 'Final payment', 8000, '2026-11-08', 'due')];
  const v = clientPaymentView({ steps, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07' });
  const plan = priceSummaryOf(steps, 'supplier', { clearedAt: null, today: '2026-11-07' });
  assert.deepEqual([v.agreedPhp, v.paidPhp, v.collectPhp], [plan.totalPhp, plan.paidPhp, plan.leftPhp]);
  assert.deepEqual([v.agreedPhp, v.paidPhp, v.collectPhp], [46000, 8000, 38000]);
  assert.deepEqual(v.next, { amountPhp: 30000, name: 'Balance', dueDate: '2026-11-01', check: true }, 'a logged payment is not "Check"');
  assert.equal(Math.round(v.meter.paidPct), 17);
  const asked = clientPaymentView({ steps: [step(1, 'Balance', 30000, '2026-11-01', 'due')], clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07' });
  assert.equal(asked.next?.check, false, 'a payment nobody logged is "Ask", not "Check"');
});

test('2 · an amount not set yet: no total, and To collect is a floor', () => {
  const v = clientPaymentView({ steps: [step(1, 'Down', 8000, null, 'paid'), step(2, 'Balance', null, null, 'due')], clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07' });
  assert.equal(v.agreedPhp, null);
  assert.equal(v.collectAtLeast, true);
  assert.equal(v.next, null, 'a Next line names an amount that is not set');
});

test('3 · no plan: the ledger; a refused ledger is partial — never ₱0', () => {
  const ledger = { rows: [{ event_vendor_id: 'v', event_id: 'e', event_name: 'E', event_date: null, seq: 1, label: 'Deposit', amount_php: 2000, due_date: '2026-10-01', confirmed: true }, { event_vendor_id: 'v', event_id: 'e', event_name: 'E', event_date: null, seq: 2, label: 'Balance', amount_php: 8170, due_date: '2026-12-01', confirmed: false }], receivedPhp: 2000, expectedPhp: 10170 };
  const v = clientPaymentView({ steps: null, clearedAt: null, ledgerMoney: ledger, ledgerUnreadable: false });
  assert.deepEqual([v.agreedPhp, v.paidPhp, v.collectPhp], [10170, 2000, 8170]);
  assert.equal(v.next?.name, 'Balance');
  const refused = clientPaymentView({ steps: null, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: true });
  assert.deepEqual([refused.agreedPhp, refused.paidPhp, refused.collectPhp, refused.partial], [null, null, null, true]);
});

test('4 · booked, no plan, nothing logged: no figures — never "₱0 · all paid"', () => {
  const v = clientPaymentView({ steps: null, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false });
  assert.deepEqual([v.agreedPhp, v.paidPhp, v.collectPhp, v.next], [null, null, null, null]);
  assert.equal(v.partial, false);
});

test('5 · B2-E refunds the shop gave: Paid drops by them, To collect is Agreed less that; refused refunds are partial', () => {
  const steps = [step(1, 'Downpayment', 8000, '2026-10-01', 'paid'), step(2, 'Balance', 30000, '2026-11-01', 'due')];
  const none = clientPaymentView({ steps, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07' });
  const v = clientPaymentView({ steps, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07', refundedPhp: 3000 });
  assert.deepEqual([v.agreedPhp, v.paidPhp, v.collectPhp], [38000, 5000, 33000]);
  assert.equal(Math.round(v.meter.paidPct), 13);
  assert.equal(v.partial, false);
  assert.deepEqual(clientPaymentView({ steps, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07', refundedPhp: 0 }), none, 'no refund changed a figure');
  const unread = clientPaymentView({ steps, clearedAt: null, ledgerMoney: NO_LEDGER, ledgerUnreadable: false, today: '2026-11-07', refundedPhp: null });
  assert.equal(unread.partial, true, 'a refused refunds read drew a Paid figure that ignores them, silently');
});
