/**
 * 📅 A PAY PLAN READS IN THE ORDER IT IS PAID, SAYS "DUE" ONCE, AND SAYS SO WHEN ITS DATES ARE WRONG
 * (CHAT-10, W1 walk 16 Nov 2026).
 *
 * Measured live, on a booked (`contracted`) event dated 2026-11-16: the plan's First payment (seq 0) was due Nov 15
 * and its Final balance (seq 1) Nov 2. The chat read:
 *   • "Due · due Nov 15, 2026" — the state word and the date's word, both "due";
 *   • "Next: Final balance" — the rollup sorted by date, so a balance entered with the earlier date became "next"
 *     while the first payment was still unpaid;
 *   • "DUE NOW · books the date" — after booking, when the date was already held (DECISION_LOG 2026-11-04: book on
 *     accept).
 * The dates are the defect (a balance due before the first payment and before the booking), so the plan keeps its
 * pay order and a visible line says the dates are out of order — the data is never re-sorted into looking right.
 *
 * SABOTAGE (seen red, then restored): `computePlanRollup` back on a pure date sort (test 2 red); the stepper's due line
 * back to `${meta.label} · due ${due}` (test 3 red); `firstPaymentLabel` with "· books the date" again (test 4 red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  computePlanRollup,
  orderPlanSteps,
  planDatesOutOfOrder,
  type StepperInstallment,
} from './vendor-service-payment-schedules';
import { PaymentPlanStepper } from '../app/_components/payment-plan-stepper';
import { moneyStep, type MoneyStepInput } from './accepted-quote-terms';

// The component is compiled for the app's automatic JSX runtime; the test runner's transform reads a global React.
(globalThis as { React?: typeof React }).React = React;

const step = (seq: number, label: string, due: string | null, amount: number, state: StepperInstallment['state'] = 'due'): StepperInstallment => ({
  seq,
  label,
  amount_php: amount,
  due_date: due,
  amount_kind: 'fixed',
  percent_bps: null,
  state,
});

// The live plan, as stored (instances_json): the balance dated before the first payment.
const inverted = [step(0, 'First payment', '2026-11-15', 1750), step(1, 'Final balance', '2026-11-02', 7000)];
const inOrder = [step(0, 'First payment', '2026-09-01', 1750), step(1, 'Second payment', '2026-09-17', 3500), step(2, 'Final balance', '2026-10-17', 3500)];

test('1 · out-of-order dates are found, and only then', () => {
  assert.deepEqual(planDatesOutOfOrder(inverted), {
    earlier: 'First payment',
    earlierDue: '2026-11-15',
    later: 'Final balance',
    laterDue: '2026-11-02',
  });
  assert.equal(planDatesOutOfOrder(inOrder), null);
  // Undated rows (an on-lock payment, no event date yet) are never "out of order".
  assert.equal(planDatesOutOfOrder([step(0, 'First payment', null, 1), step(1, 'Final balance', '2026-10-01', 1)]), null);
  // Shuffled input, in-order dates: date order, which is pay order.
  assert.deepEqual(orderPlanSteps([inOrder[2]!, inOrder[0]!, inOrder[1]!]).map((s) => s.seq), [0, 1, 2]);
  // Wrong dates: pay order, never the dates' order.
  assert.deepEqual(orderPlanSteps([inverted[1]!, inverted[0]!]).map((s) => s.seq), [0, 1]);
});

test('2 · "Next" is the first unpaid payment in pay order — never a later row with an earlier date', () => {
  assert.equal(computePlanRollup(inverted).next?.label, 'First payment');
  assert.equal(computePlanRollup([{ ...inverted[0]!, state: 'paid' }, inverted[1]!]).next?.label, 'Final balance');
  assert.equal(computePlanRollup(inOrder).next?.label, 'First payment');
});

test('3 · the stepper says "Due <date>" once, keeps pay order, and says the dates are out of order', () => {
  const html = renderToStaticMarkup(React.createElement(PaymentPlanStepper, { steps: [inverted[1]!, inverted[0]!], clearedAt: null }));
  assert.doesNotMatch(html, /Due · due/, 'the state and the date both say "due" again');
  assert.match(html, /Due Nov 15, 2026/);
  assert.ok(html.indexOf('First payment') < html.indexOf('>Final balance<'), 'the plan is no longer drawn in pay order');
  assert.match(html, /data-plan-dates-out-of-order/, 'wrong dates are drawn as if they were right');
  assert.match(html, /These dates are out of order: Final balance is due Nov 2, 2026, before First payment \(Nov 15, 2026\)/);
  const clean = renderToStaticMarkup(React.createElement(PaymentPlanStepper, { steps: inOrder, clearedAt: null }));
  assert.doesNotMatch(clean, /data-plan-dates-out-of-order/, 'a correct plan is warned about');
  // Paid and pending rows still name their date after their own word.
  const paid = renderToStaticMarkup(React.createElement(PaymentPlanStepper, { steps: [{ ...inOrder[0]!, state: 'paid' }], clearedAt: null }));
  assert.match(paid, /Paid · due Sep 1, 2026/);
});

test('4 · a booked couple’s first payment never says it "books the date"', () => {
  const input: MoneyStepInput = {
    terms: null,
    booked: true,
    today: '2026-11-16',
    deposit: { recordedAt: null, acknowledgedAt: null, declinedAt: null },
    ledger: { count: 0, paidCentavos: 0, recordedFirstCentavos: null },
  };
  const s = moneyStep(input);
  assert.equal(s.kind, 'first_payment_due');
  if (s.kind !== 'first_payment_due') return;
  assert.doesNotMatch(s.label, /books the date/);
  assert.equal(moneyStep({ ...input, booked: false }).kind, 'not_booked', 'an unbooked couple now gets a money step');
});
