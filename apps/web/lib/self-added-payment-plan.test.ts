/**
 * "UNTIL THE PAYMENT IS FULLY PAID" — the truth table. (2026-09-20)
 *
 * Owner: *"Payment Plan Must set date for until the payment is fully paid.
 * just like on our quote maker."*
 *
 * Two of these assertions are the whole feature: a plan must ADD UP to the
 * price, and every payment must have a DAY. A plan that fails either is worse
 * than no plan — it shows the couple a settled booking that isn't.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_ANCHOR_REQUIRED,
  PLAN_EMPTY,
  PLAN_NEEDS_TOTAL,
  buildCouplePaymentPlan,
  type CouplePlanRowInput,
} from './self-added-payment-plan';

const LOCK = '2026-09-20';
const EVENT = '2026-12-18';

const row = (p: Partial<CouplePlanRowInput> = {}): CouplePlanRowInput => ({
  label: 'Downpayment',
  amount_kind: 'percent',
  value: '50',
  due_anchor: 'on_lock',
  due_offset_days: '0',
  ...p,
});

const HALF_HALF: CouplePlanRowInput[] = [
  row({ label: 'Downpayment', value: '50', due_anchor: 'on_lock', due_offset_days: '0' }),
  row({ label: 'Balance', value: '50', due_anchor: 'before_event', due_offset_days: '7' }),
];

function build(rows: CouplePlanRowInput[], totalPhp: number | null = 80000, eventDateIso: string | null = EVENT) {
  return buildCouplePaymentPlan({ rows, totalPhp, lockDateIso: LOCK, eventDateIso });
}

describe('a plan resolves to real dates, the quote maker way', () => {
  it('anchors on the lock date and counts back from the event', () => {
    const r = build(HALF_HALF);
    assert.ok(r.ok);
    assert.deepEqual(
      r.instances.map((i) => [i.label, i.amount_php, i.due_date]),
      [
        ['Downpayment', 40000, '2026-09-20'],
        ['Balance', 40000, '2026-12-11'],
      ],
    );
  });

  it('honours a day offset after the lock', () => {
    const r = build([
      row({ value: '100', due_anchor: 'on_lock', due_offset_days: '14' }),
    ]);
    assert.ok(r.ok);
    assert.equal(r.instances[0]!.due_date, '2026-10-04');
  });

  it('takes fixed pesos as well as percentages', () => {
    const r = build([
      row({ label: 'Reservation', amount_kind: 'fixed', value: '20000' }),
      row({ label: 'Balance', amount_kind: 'fixed', value: '60000', due_anchor: 'before_event', due_offset_days: '3' }),
    ]);
    assert.ok(r.ok);
    assert.deepEqual(r.instances.map((i) => i.amount_php), [20000, 60000]);
  });
});

describe('a plan that does not add up is refused', () => {
  it('refuses a short plan and names both figures', () => {
    const r = build([row({ value: '50' }), row({ label: 'Balance', value: '25', due_anchor: 'before_event', due_offset_days: '7' })]);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.message : '', /₱60,000 of ₱80,000/);
    assert.match(r.ok === false ? r.message : '', /₱20,000 is unaccounted/);
  });

  it('refuses an over-scheduled plan too, saying so in the other direction', () => {
    const r = build([row({ value: '60' }), row({ label: 'Balance', value: '60', due_anchor: 'before_event', due_offset_days: '7' })]);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.message : '', /more than the ₱80,000 price/);
  });

  it('accepts thirds, which can never be exact', () => {
    // 3 × 33.33% of ₱80,000 lands a peso or two off. A zero tolerance would
    // make the most ordinary plan in the Philippines impossible to save.
    const thirds = ['Downpayment', 'Second', 'Balance'].map((label, i) =>
      row({
        label,
        value: i === 2 ? '33.34' : '33.33',
        due_anchor: i === 2 ? 'before_event' : 'on_lock',
        due_offset_days: String(i * 30),
      }),
    );
    const r = build(thirds);
    assert.ok(r.ok, r.ok === false ? r.message : '');
  });
});

describe('every payment needs a day', () => {
  it('refuses a row with no anchor', () => {
    const r = build([row({ value: '100', due_anchor: '' })]);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.message, PLAN_ANCHOR_REQUIRED);
  });

  it('refuses before_event when the event date is not set, and says what to do', () => {
    const r = build(HALF_HALF, 80000, null);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.message : '', /event date isn't fixed yet/);
    assert.match(r.ok === false ? r.message : '', /Anchor it after the booking instead/);
  });
});

describe('the guards around the edges', () => {
  it('refuses an empty plan', () => {
    assert.equal(build([]).ok, false);
    assert.equal(build([]).ok === false ? (build([]) as { message: string }).message : '', PLAN_EMPTY);
  });

  it('ignores blank rows the editor leaves behind', () => {
    const r = build([...HALF_HALF, row({ label: '', value: '' })]);
    assert.ok(r.ok);
    assert.equal(r.instances.length, 2);
  });

  it('refuses a plan with no price to add up to', () => {
    const r = build(HALF_HALF, null);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.message, PLAN_NEEDS_TOTAL);
  });

  it('refuses a percentage over 100', () => {
    const r = build([row({ value: '150' })]);
    assert.equal(r.ok, false);
  });

  it('refuses a zero or negative amount', () => {
    for (const v of ['0', '-10', 'abc']) {
      assert.equal(build([row({ value: v })]).ok, false, v);
    }
  });

  it('refuses more than twelve payments', () => {
    const many = Array.from({ length: 13 }, (_, i) =>
      row({ label: `Payment ${i + 1}`, value: '7.7', due_offset_days: String(i) }),
    );
    assert.equal(build(many).ok, false);
  });
});
