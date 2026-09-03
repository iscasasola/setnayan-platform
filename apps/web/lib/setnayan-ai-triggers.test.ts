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
  paymentDueState,
  daysUntilDue,
  TRIGGER_THRESHOLDS,
  statutoryDeadlineTrigger,
  priceRiseTrigger,
  overBudgetTrigger,
  contractWindowTrigger,
  scheduleClashTrigger,
  availabilityChangeTrigger,
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
    availability: [],
    ...over,
  };
}

// ---- individual triggers ----------------------------------------------------

test('paymentDue: fires within 7 days and for anything already missed; never for paid/far', () => {
  const snap = emptySnap({
    payments: [
      { vendor: 'Bloom', amountPhp: 5000, dueDate: '2026-01-04', paid: false }, // 3d → fire
      { vendor: 'Paid Co', amountPhp: 1000, dueDate: '2026-01-03', paid: true }, // paid → no
      { vendor: 'Far Co', amountPhp: 1000, dueDate: '2026-03-01', paid: false }, // far → no
      { vendor: 'Late Co', amountPhp: 1000, dueDate: '2025-12-30', paid: false }, // 2d late → FIRE
    ],
  });
  const out = paymentDueTrigger(snap, NOW);
  assert.deepEqual(
    out.map((iv) => iv.slots.vendor).sort(),
    ['Bloom', 'Late Co'],
    'a payment the couple has already missed must not be silently dropped',
  );
  const bloom = out.find((iv) => iv.slots.vendor === 'Bloom')!;
  assert.equal(bloom.templateId, 'GRD-01');
  assert.equal(bloom.variant, 'default');
  assert.equal(bloom.slots.days_left, 3);
  assert.equal(bloom.slots.amount, '5,000');
});

// ---- the overdue half of GRD-01 (the defect: `d >= 0` dropped every miss) ----

test('paymentDue · overdue: its own variant, its own dedupe key, ranked above a heads-up', () => {
  const out = paymentDueTrigger(
    emptySnap({
      payments: [
        { vendor: 'Late Co', amountPhp: 12000, dueDate: '2025-12-30', paid: false },
        { vendor: 'Soon Co', amountPhp: 3000, dueDate: '2026-01-02', paid: false },
      ],
    }),
    NOW,
  );
  const late = out.find((iv) => iv.slots.vendor === 'Late Co')!;
  const soon = out.find((iv) => iv.slots.vendor === 'Soon Co')!;

  assert.equal(late.variant, 'overdue');
  assert.equal(late.slots.overdue_for, '2 days');
  assert.equal(late.slots.days_left, undefined, 'overdue copy must not claim days LEFT');
  assert.ok(late.priority > soon.priority, 'already missed outranks not yet missed');
  // A distinct key: the "due in 3 days" note fired days ago is still inside the
  // 7-day guard cooldown, and reusing its key would swallow the first alert
  // that the money is actually late.
  assert.equal(late.dedupeKey, 'GRD-01:overdue:Late Co:2025-12-30');
  assert.equal(soon.dedupeKey, 'GRD-01:Soon Co:2026-01-02');
});

test('paymentDue · overdue: one day late reads "1 day", not "1 days"', () => {
  const out = paymentDueTrigger(
    emptySnap({ payments: [{ vendor: 'A', amountPhp: 100, dueDate: '2025-12-31', paid: false }] }),
    NOW,
  );
  assert.equal(out[0]!.slots.overdue_for, '1 day');
});

test('paymentDue · overdue: a settled milestone is never late, however old', () => {
  const out = paymentDueTrigger(
    emptySnap({ payments: [{ vendor: 'A', amountPhp: 100, dueDate: '2020-01-01', paid: true }] }),
    NOW,
  );
  assert.equal(out.length, 0);
});

test('paymentDue · overdue priority is BOUNDED — one ancient miss cannot eat the cap', () => {
  const out = paymentDueTrigger(
    emptySnap({
      payments: [
        { vendor: 'Ancient', amountPhp: 100, dueDate: '2019-01-01', paid: false },
        { vendor: 'Yesterday', amountPhp: 100, dueDate: '2025-12-31', paid: false },
      ],
    }),
    NOW,
  );
  const ancient = out.find((iv) => iv.slots.vendor === 'Ancient')!;
  const yesterday = out.find((iv) => iv.slots.vendor === 'Yesterday')!;
  assert.ok(ancient.priority <= 110, `unbounded overdue priority: ${ancient.priority}`);
  assert.ok(ancient.priority > yesterday.priority);
});

test('paymentDue: THE BOUNDARY DAYS — a wrong one emails a couple about money they do not owe', () => {
  // -1 · 0 · +1 · +7 · +8 · +30 · +31, measured from 2026-01-01.
  const cases: Array<[string, number, 'overdue' | 'default' | null]> = [
    ['2025-12-31', -1, 'overdue'],
    ['2026-01-01', 0, 'default'], // DUE TODAY IS NOT LATE
    ['2026-01-02', 1, 'default'],
    ['2026-01-08', 7, 'default'], // the window is inclusive
    ['2026-01-09', 8, null], // one day past it → silent
    ['2026-01-31', 30, null],
    ['2026-02-01', 31, null],
  ];
  for (const [dueDate, days, expected] of cases) {
    assert.equal(daysUntilDue(dueDate, NOW), days, `${dueDate} is ${days} days out`);
    const out = paymentDueTrigger(
      emptySnap({ payments: [{ vendor: 'V', amountPhp: 1, dueDate, paid: false }] }),
      NOW,
    );
    if (expected === null) {
      assert.equal(out.length, 0, `${dueDate} (${days}d) must not fire`);
    } else {
      assert.equal(out.length, 1, `${dueDate} (${days}d) must fire`);
      assert.equal(out[0]!.variant, expected, `${dueDate} (${days}d) variant`);
    }
  }
});

test('paymentDue: the answer does not change with the time of day', () => {
  // The old day math floored the raw instant difference, so a milestone due
  // TODAY returned −1 from 00:00 UTC onward — it would have been emailed as
  // "1 day" late on the very afternoon it was due.
  for (const hour of ['00:00', '06:00', '13:00', '15:59', '23:59']) {
    const now = new Date(`2026-01-01T${hour}:00.000+08:00`);
    assert.equal(daysUntilDue('2026-01-01', now), 0, `due today at ${hour} PH`);
    assert.equal(daysUntilDue('2025-12-31', now), -1, `due yesterday at ${hour} PH`);
    const out = paymentDueTrigger(
      emptySnap({ payments: [{ vendor: 'V', amountPhp: 1, dueDate: '2026-01-01', paid: false }] }),
      now,
    );
    assert.equal(out[0]!.variant, 'default', `due today at ${hour} PH is not overdue`);
  }
});

test('paymentDueState bands read off ONE set of thresholds', () => {
  assert.equal(paymentDueState(-1), 'overdue');
  assert.equal(paymentDueState(0), 'due_soon');
  assert.equal(paymentDueState(TRIGGER_THRESHOLDS.paymentDueWindowDays), 'due_soon');
  assert.equal(paymentDueState(TRIGGER_THRESHOLDS.paymentDueWindowDays + 1), 'upcoming');
  assert.equal(paymentDueState(TRIGGER_THRESHOLDS.paymentHorizonDays), 'upcoming');
  assert.equal(paymentDueState(TRIGGER_THRESHOLDS.paymentHorizonDays + 1), 'later');
  // An unparseable date must never be called late.
  assert.equal(paymentDueState(daysUntilDue('not-a-date', NOW)), 'later');
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

test('overBudget: fires only when COMMITTED exceeds total', () => {
  // BA8 · committed alone, never committed+pending. A `submitted` Setnayan
  // order is money the couple applied for and an admin has not approved — the
  // resolver files it under `estimated`, and §18.5 rule 4 gives "over budget"
  // exactly one meaning: what they have AGREED exceeds their target.
  assert.equal(
    overBudgetTrigger(
      emptySnap({ budget: { totalPhp: 100, committedPhp: 120, topDriverCategory: 'Catering' } }),
    ).length,
    1,
  );
  assert.equal(
    overBudgetTrigger(emptySnap({ budget: { totalPhp: 100, committedPhp: 70 } })).length,
    0,
  );
  // Exactly at the target is not over it.
  assert.equal(
    overBudgetTrigger(emptySnap({ budget: { totalPhp: 100, committedPhp: 100 } })).length,
    0,
  );
  assert.equal(overBudgetTrigger(emptySnap()).length, 0);
});

test('overBudget: the amount printed is committed − target, and names the driver', () => {
  const [iv] = overBudgetTrigger(
    emptySnap({ budget: { totalPhp: 930_000, committedPhp: 1_010_000, topDriverCategory: 'Catering' } }),
  );
  assert.ok(iv);
  assert.equal(iv.slots.over_amount, '80,000');
  assert.equal(iv.slots.top_driver_category, 'Catering');
});

test('overBudget: with nothing committed anywhere, the driver slot stays generic', () => {
  // `budgetFromEventMoney` omits topDriverCategory when no bucket carries
  // committed money — the copy must not print "mostly undefined".
  const [iv] = overBudgetTrigger(emptySnap({ budget: { totalPhp: 0, committedPhp: 500 } }));
  assert.ok(iv);
  assert.equal(iv.slots.top_driver_category, 'a few categories');
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

test('availabilityChange: one GRD-09 per vendor whose date moved', () => {
  const out = availabilityChangeTrigger(
    emptySnap({
      availability: [{ vendor: 'Grand Venue', date: 'May 9, 2026', status: 'newly booked' }],
    }),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.templateId, 'GRD-09');
  assert.deepEqual(out[0]!.slots, {
    vendor: 'Grand Venue',
    date: 'May 9, 2026',
    status: 'newly booked',
  });
  assert.equal(out[0]!.priority, 80);
  // No availability change → silent.
  assert.equal(availabilityChangeTrigger(emptySnap()).length, 0);
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
    budget: { totalPhp: 100, committedPhp: 120, topDriverCategory: 'Catering' },
    inquiries: [{ vendor: 'Quiet', service: 'cake', sentDaysAgo: 6, replied: false }],
  });
  const out = runTriggers(snap, NOW);
  const ids = out.map((i) => i.templateId).sort();
  assert.deepEqual(ids, ['GRD-01', 'GRD-05', 'SEC-04']);
});
