/**
 * Setnayan AI trigger engine invariants (node:test via tsx).
 *
 * Locks: each trigger fires only in its real condition; the restraint engine
 * dedups/cools-down/caps/ranks; and the weekly digest picks the honest
 * busy-vs-quiet variant. All pure + deterministic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  paymentDueTrigger,
  statutoryDeadlineTrigger,
  priceRiseTrigger,
  overBudgetTrigger,
  contractWindowTrigger,
  scheduleClashTrigger,
  vendorQuietTrigger,
  stuckCategoryTrigger,
  dateConvergenceTrigger,
  runTriggers,
  applyRestraint,
  assembleWeeklyDigest,
  type PlanningSnapshot,
  type Intervention,
} from './setnayan-ai-triggers';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function emptySnap(over: Partial<PlanningSnapshot> = {}): PlanningSnapshot {
  return {
    eventType: 'wedding',
    payments: [],
    statutory: [],
    shortlist: [],
    priceChanges: [],
    contracts: [],
    inquiries: [],
    budget: null,
    dateClusters: [],
    scheduleClash: [],
    ...over,
  };
}

// ---- individual triggers ----------------------------------------------------

test('paymentDue: fires within 7 days, not paid/overdue/far', () => {
  const snap = emptySnap({
    payments: [
      { vendor: 'Bloom', amountPhp: 5000, dueDate: '2026-01-04', paid: false }, // 3d → fire
      { vendor: 'Paid Co', amountPhp: 1000, dueDate: '2026-01-03', paid: true }, // paid → no
      { vendor: 'Far Co', amountPhp: 1000, dueDate: '2026-03-01', paid: false }, // far → no
      { vendor: 'Late Co', amountPhp: 1000, dueDate: '2025-12-30', paid: false }, // overdue → no
    ],
  });
  const out = paymentDueTrigger(snap, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.templateId, 'GRD-01');
  assert.equal(out[0]!.slots.days_left, 3);
  assert.equal(out[0]!.slots.amount, '5,000');
});

test('statutory: wedding-only', () => {
  const s = { statutory: [{ document: 'marriage license', deadline: '2026-01-20' }] };
  assert.equal(statutoryDeadlineTrigger(emptySnap(s), NOW).length, 1);
  assert.equal(
    statutoryDeadlineTrigger(emptySnap({ ...s, eventType: 'birthday' }), NOW).length,
    0,
  );
});

test('priceRise: fires on increase only', () => {
  const up = priceRiseTrigger(
    emptySnap({ priceChanges: [{ vendor: 'A', category: 'photo', oldPricePhp: 100, newPricePhp: 130 }] }),
  );
  assert.equal(up.length, 1);
  assert.equal(up[0]!.slots.new_price, '130');
  const down = priceRiseTrigger(
    emptySnap({ priceChanges: [{ vendor: 'A', category: 'photo', oldPricePhp: 130, newPricePhp: 100 }] }),
  );
  assert.equal(down.length, 0);
});

test('overBudget: fires only when committed+pending exceeds total', () => {
  assert.equal(
    overBudgetTrigger(emptySnap({ budget: { totalPhp: 100, committedPhp: 80, pendingPhp: 40, topDriverCategory: 'catering' } })).length,
    1,
  );
  assert.equal(
    overBudgetTrigger(emptySnap({ budget: { totalPhp: 100, committedPhp: 50, pendingPhp: 20 } })).length,
    0,
  );
  assert.equal(overBudgetTrigger(emptySnap()).length, 0);
});

test('contractWindow: fires within the window', () => {
  const out = contractWindowTrigger(
    emptySnap({ contracts: [{ vendor: 'V', windowType: 'free-cancellation', deadline: '2026-01-05', daysLeft: 4 }] }),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.templateId, 'GRD-07');
});

test('scheduleClash: one GRD-06 per collision, carrying both labels + slot', () => {
  const out = scheduleClashTrigger(
    emptySnap({
      scheduleClash: [{ itemA: 'Ceremony', itemB: 'Cocktails', slot: 'Sat, May 9, 3:00 PM' }],
    }),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.templateId, 'GRD-06');
  assert.deepEqual(out[0]!.slots, {
    item_a: 'Ceremony',
    item_b: 'Cocktails',
    slot: 'Sat, May 9, 3:00 PM',
  });
  // No clashes → silent.
  assert.equal(scheduleClashTrigger(emptySnap()).length, 0);
});

test('vendorQuiet: fires when unreplied ≥ 4 days', () => {
  const out = vendorQuietTrigger(
    emptySnap({
      inquiries: [
        { vendor: 'Quiet', service: 'cake', sentDaysAgo: 5, replied: false }, // fire
        { vendor: 'Replied', service: 'cake', sentDaysAgo: 9, replied: true }, // no
        { vendor: 'Recent', service: 'cake', sentDaysAgo: 1, replied: false }, // no
      ],
    }),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.slots.vendor, 'Quiet');
});

test('stuckCategory: decision→SEC-02, discovery→SEC-03, booked/fresh→none', () => {
  const decision = stuckCategoryTrigger(
    emptySnap({ shortlist: [{ category: 'caterers', openWeeks: 6, viewedCount: 9, inquiredCount: 3, bookedCount: 0 }] }),
  );
  assert.equal(decision[0]!.templateId, 'SEC-02');
  const discovery = stuckCategoryTrigger(
    emptySnap({ shortlist: [{ category: 'florists', openWeeks: 6, viewedCount: 4, inquiredCount: 0, bookedCount: 0 }] }),
  );
  assert.equal(discovery[0]!.templateId, 'SEC-03');
  const booked = stuckCategoryTrigger(
    emptySnap({ shortlist: [{ category: 'venue', openWeeks: 9, viewedCount: 5, inquiredCount: 2, bookedCount: 1 }] }),
  );
  assert.equal(booked.length, 0);
});

test('dateConvergence: fires at ≥3 and picks the strongest cluster', () => {
  const out = dateConvergenceTrigger(
    emptySnap({ dateClusters: [{ date: '2026-05-09', count: 4 }, { date: '2026-06-01', count: 3 }, { date: '2026-07-01', count: 1 }] }),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.slots.date, '2026-05-09');
});

// ---- restraint engine -------------------------------------------------------

test('applyRestraint: dedups (highest priority wins), sorts, caps, cools down', () => {
  const ivs: Intervention[] = [
    { templateId: 'A', category: 'guard', slots: {}, priority: 10, dedupeKey: 'k1' },
    { templateId: 'A', category: 'guard', slots: {}, priority: 30, dedupeKey: 'k1' }, // dup, higher
    { templateId: 'B', category: 'guard', slots: {}, priority: 20, dedupeKey: 'k2' },
    { templateId: 'C', category: 'guard', slots: {}, priority: 99, dedupeKey: 'k3' },
  ];
  const all = applyRestraint(ivs);
  assert.deepEqual(all.map((i) => i.dedupeKey), ['k3', 'k1', 'k2']); // sorted desc, deduped
  assert.equal(all.find((i) => i.dedupeKey === 'k1')!.priority, 30); // higher won

  const capped = applyRestraint(ivs, { maxProactive: 1 });
  assert.deepEqual(capped.map((i) => i.dedupeKey), ['k3']);

  const cooled = applyRestraint(ivs, { cooldown: new Set(['k3']) });
  assert.ok(!cooled.some((i) => i.dedupeKey === 'k3'));
});

// ---- weekly digest ----------------------------------------------------------

test('digest: quiet week → quiet variant naming the soonest horizon item', () => {
  const snap = emptySnap({ payments: [{ vendor: 'Bloom', amountPhp: 5000, dueDate: '2026-02-10', paid: false }] });
  const out = assembleWeeklyDigest([], snap, NOW);
  assert.match(out, /Calm week/);
  assert.match(out, /Bloom payment on 2026-02-10/);
});

test('digest: busy week → busy variant with bullets + a next step', () => {
  const snap = emptySnap({
    payments: [{ vendor: 'Bloom', amountPhp: 5000, dueDate: '2026-01-04', paid: false }],
  });
  const fired = runTriggers(snap, NOW);
  assert.ok(fired.length >= 1);
  const out = assembleWeeklyDigest(applyRestraint(fired), snap, NOW);
  assert.match(out, /This week I checked/);
  assert.match(out, /Bloom/);
  assert.match(out, /Next up: settle the Bloom payment/);
});

test('runTriggers: integrates across a mixed snapshot', () => {
  const snap = emptySnap({
    payments: [{ vendor: 'Bloom', amountPhp: 5000, dueDate: '2026-01-04', paid: false }],
    budget: { totalPhp: 100, committedPhp: 90, pendingPhp: 30, topDriverCategory: 'catering' },
    inquiries: [{ vendor: 'Quiet', service: 'cake', sentDaysAgo: 6, replied: false }],
  });
  const out = runTriggers(snap, NOW);
  const ids = out.map((i) => i.templateId).sort();
  assert.deepEqual(ids, ['GRD-01', 'GRD-05', 'SEC-04']);
});
