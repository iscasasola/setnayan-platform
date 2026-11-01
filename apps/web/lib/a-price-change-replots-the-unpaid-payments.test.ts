/**
 * AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS (owner 2026-10-29: "replot the payments always").
 *
 * The rule (`lib/plan-replot.ts`), executed — its database twin `plan_replot_instances` is held equal to it by
 * `tests/db/a-price-change-replots-the-unpaid-payments.db.test.ts`:
 *   1 · a settled instalment never changes;
 *   2 · the unpaid ones re-split to EXACTLY the new total, in the proportions they had;
 *   3 · whole pesos each, the rounding on the LAST unpaid instalment;
 *   4 · all settled and the price rose → one new Balance; the price fell under what is settled → unpaid ones go.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replotAmounts, replotInstances, lastPlanReplot, type ReplotInstance } from './plan-replot';

const inst = (seq: number, amount: number, kind: 'percent' | 'fixed' = 'fixed', bps: number | null = null, due = `2027-0${seq + 1}-01`): ReplotInstance => ({
  seq,
  label: `Payment ${seq + 1}`,
  amount_php: amount,
  due_date: due,
  amount_kind: kind,
  percent_bps: bps,
});
const sum = (xs: ReadonlyArray<{ amount_php: number | null }>) => Math.round(xs.reduce((s, x) => s + (x.amount_php ?? 0), 0) * 100) / 100;

describe('1 · paid instalments are never touched', () => {
  it('a +₱20,000 change on a half-paid plan moves only the unpaid half', () => {
    const plan = [inst(0, 50_000), inst(1, 50_000)];
    const r = replotInstances(plan, [0], 120_000);
    assert.equal(r.changed, true);
    assert.deepEqual(r.instances[0], plan[0], 'the paid instalment changed');
    assert.equal(r.instances[1]!.amount_php, 70_000);
  });
  it('a settled seq in the middle stays exactly as it was, object for object', () => {
    const plan = [inst(0, 30_000), inst(1, 30_000), inst(2, 40_000)];
    const r = replotInstances(plan, new Set([1]), 90_000);
    assert.deepEqual(r.instances.find((i) => i.seq === 1), plan[1]);
  });
});

describe('2 · the unpaid ones re-split to exactly the new total, in their own proportions', () => {
  for (const [total, settled] of [
    [120_000, []],
    [87_350.5, [0]],
    [100_001, []],
    [99_999, [2]],
  ] as Array<[number, number[]]>) {
    it(`₱100,000 (30/30/40) → ₱${total} with seqs [${settled}] settled adds up exactly`, () => {
      const r = replotInstances([inst(0, 30_000), inst(1, 30_000), inst(2, 40_000)], settled, total);
      assert.equal(sum(r.instances), total);
    });
  }
  it('a 30/70 plan stays 30/70 of the new price when nothing is paid', () => {
    const r = replotInstances([inst(0, 30_000), inst(1, 70_000)], [], 200_000);
    assert.deepEqual(r.instances.map((i) => i.amount_php), [60_000, 140_000]);
  });
  it('a percent instalment stays percent when its percent IS its new amount', () => {
    const r = replotInstances([inst(0, 50_000, 'percent', 5000), inst(1, 50_000, 'percent', 5000)], [], 120_000);
    assert.deepEqual(r.instances.map((i) => [i.amount_kind, i.percent_bps, i.amount_php]), [
      ['percent', 5000, 60_000],
      ['percent', 5000, 60_000],
    ]);
  });
  it('…and becomes the fixed amount it now is when a payment made the percent untrue — its authored rule follows', () => {
    const plan = [
      { ...inst(0, 50_000, 'percent', 5000), authored: { amount_kind: 'percent' as const, value: '50', due_anchor: 'on_lock', due_offset_days: '0' } },
      { ...inst(1, 50_000, 'percent', 5000), authored: { amount_kind: 'percent' as const, value: '50', due_anchor: 'before_event', due_offset_days: '7' } },
    ];
    const r = replotInstances(plan, [0], 120_000);
    assert.equal(r.instances[1]!.amount_kind, 'fixed');
    assert.equal(r.instances[1]!.percent_bps, null);
    assert.deepEqual(r.instances[1]!.authored, { amount_kind: 'fixed', value: '70000', due_anchor: 'before_event', due_offset_days: '7' });
  });
  it('a plan that already adds up is left alone (and nothing is kept in history)', () => {
    const plan = [inst(0, 50_000), inst(1, 50_000)];
    const r = replotInstances(plan, [], 100_000);
    assert.equal(r.changed, false);
    assert.deepEqual(r.instances, plan);
  });
});

describe('3 · whole pesos, the rounding on the last unpaid instalment', () => {
  it('₱100,000 in thirds — the first two whole, the last takes the rest', () => {
    const r = replotAmounts([1, 1, 1], [false, false, false], 100_000);
    assert.deepEqual(r.next, [33_333, 33_333, 33_334]);
  });
  it('centavos in the price land on the last unpaid row only', () => {
    const r = replotAmounts([10, 10, 10], [false, false, true], 80_000.5);
    // settled row 3 holds 10; 79,990.50 is shared by rows 1–2
    assert.equal(r.next[0], 39_995);
    assert.equal(r.next[1], 39_995.5);
    assert.ok(Number.isInteger(r.next[0]!), 'a non-last row carries centavos');
  });
  it('the last unpaid row is the one with the highest seq, not the last listed', () => {
    const r = replotInstances([inst(2, 1), inst(0, 1), inst(1, 1)], [], 100);
    assert.deepEqual(r.instances.map((i) => [i.seq, i.amount_php]), [
      [0, 33],
      [1, 33],
      [2, 34],
    ]);
  });
});

describe('4 · the edges', () => {
  it('everything paid and the price rose → ONE new Balance instalment, after the last', () => {
    const r = replotInstances([inst(0, 50_000), inst(1, 50_000)], [0, 1], 115_000);
    assert.equal(r.instances.length, 3);
    assert.deepEqual(
      { seq: r.instances[2]!.seq, label: r.instances[2]!.label, amount: r.instances[2]!.amount_php, due: r.instances[2]!.due_date },
      { seq: 2, label: 'Balance', amount: 15_000, due: '2027-02-01' },
    );
  });
  it('the price fell under what is already paid → the unpaid ones go, and the overpayment is said', () => {
    const r = replotInstances([inst(0, 60_000), inst(1, 40_000)], [0], 55_000);
    assert.deepEqual(r.instances.map((i) => i.seq), [0]);
    assert.equal(r.overByPhp, 5_000);
  });
  it('never a zero or negative instalment', () => {
    const r = replotAmounts([5, 5, 5], [false, false, false], 1);
    assert.ok(r.next.every((a) => a == null || a > 0));
  });
  it('the newest kept plan reads back for the card line, and junk reads as none', () => {
    assert.deepEqual(lastPlanReplot([{ at: 'x', from_php: 1, to_php: 2 }, { at: '2026-10-29T00:00:00Z', from_php: 100000, to_php: 120000, source: 'change', instances: [] }]), {
      fromPhp: 100_000,
      toPhp: 120_000,
      at: '2026-10-29T00:00:00Z',
    });
    assert.equal(lastPlanReplot(null), null);
    assert.equal(lastPlanReplot([{ nope: 1 }]), null);
  });
});
