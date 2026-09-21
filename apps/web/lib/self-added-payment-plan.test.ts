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
  lockMayOverwritePlan,
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

  it('names a shortfall to the centavo, never a rounded peso', () => {
    // ₱40,000 + ₱39,998.50 = ₱79,998.50 against ₱80,000 → ₱1.50 short, which is
    // past the ±₱1 tolerance. The old local formatter rounded this to "₱2" —
    // a figure the couple could not find in anything they typed. PR #5744 is
    // the same bug on a booking fee (₱837.50 printed as ₱838).
    const r = build([
      row({ label: 'Downpayment', amount_kind: 'fixed', value: '40000' }),
      row({ label: 'Balance', amount_kind: 'fixed', value: '39998.50', due_anchor: 'before_event', due_offset_days: '7' }),
    ]);
    assert.equal(r.ok, false);
    const msg = r.ok === false ? r.message : '';
    assert.match(msg, /₱79,998\.50 of ₱80,000/);
    assert.match(msg, /₱1\.50 is unaccounted/);
    assert.doesNotMatch(msg, /₱2 is unaccounted/);
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

describe('locking a supplier must not erase the plan the couple typed', () => {
  const COUPLE_PLAN = [{ seq: 0, label: 'Downpayment', amount_php: 24000, due_date: '2026-09-21' }];

  it('PRESERVES a couple-authored plan on a self-added supplier — the bug', () => {
    // Couple typed "30% now, 70% two weeks before", then tapped Lock. Before
    // the fix the lock snapshot replaced it with a generic 50/50 estimate.
    assert.equal(
      lockMayOverwritePlan({ onPlatform: false, existingInstances: COUPLE_PLAN, existingIsDefaultSeeded: false }),
      false,
    );
  });

  it('still refreshes a marketplace supplier’s plan from their own schedule', () => {
    assert.equal(
      lockMayOverwritePlan({ onPlatform: true, existingInstances: COUPLE_PLAN, existingIsDefaultSeeded: false }),
      true,
    );
  });

  it('writes a plan when a self-added supplier has none yet', () => {
    assert.equal(lockMayOverwritePlan({ onPlatform: false, existingInstances: null, existingIsDefaultSeeded: false }), true);
    assert.equal(lockMayOverwritePlan({ onPlatform: false, existingInstances: [], existingIsDefaultSeeded: false }), true);
  });

  it('refreshes our own default-seeded estimate — it was only a placeholder', () => {
    assert.equal(
      lockMayOverwritePlan({ onPlatform: false, existingInstances: COUPLE_PLAN, existingIsDefaultSeeded: true }),
      true,
    );
  });
});
