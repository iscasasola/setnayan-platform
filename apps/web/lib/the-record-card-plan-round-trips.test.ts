/**
 * THE RECORD CARD'S PAYMENT ROWS — name · due date · amount — ROUND-TRIP THE STORED RULE EXACTLY. (2026-10-29)
 *
 * Booked prototype v4 (owner-approved) draws each payment as a day and an amount; the plan is still STORED as
 * `amount_kind` + `value` + `due_anchor` + `due_offset_days`. `lib/record-card-plan.ts` maps between them, and the
 * property held here is that the map is never lossy:
 *   · a stored rule, opened and saved untouched, posts the SAME rule (its anchor, its days, its percent);
 *   · a typed day posts a rule that resolves back to exactly that day (through the server's own builder);
 *   · a typed amount posts as fixed pesos, unless it is exactly the row's own percent of the price.
 * And #7053's builder keeps a row's own `seq`, so a payment logged against an instalment stays on it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addsUpLine, dateToAnchor, postedRule, rowsFromRules, ruleDueIso, type PlanDates } from './record-card-plan';
import { assignPlanSeqs, buildCouplePaymentPlan, planInstanceSeqs, planInstancesToRows, type EditablePlanRow } from './self-added-payment-plan';

const dates: PlanDates = { lockIso: '2026-10-29', eventIso: '2027-02-14' };
const RULES: EditablePlanRow[] = [
  { label: 'First payment', kind: 'percent', value: '30', anchor: 'on_lock', days: '0' },
  { label: 'Second', kind: 'fixed', value: '100000', anchor: 'on_lock', days: '45' },
  { label: 'Balance', kind: 'percent', value: '45', anchor: 'before_event', days: '14' },
];
const total = 400_000;

describe('a stored rule opened and saved untouched posts the very same rule', () => {
  it('every anchor, every day, every percent comes back as itself', () => {
    const rows = rowsFromRules(RULES, { dates, totalPhp: total });
    assert.deepEqual(rows.map((r) => [r.dueIso, r.amount]), [
      ['2026-10-29', '120,000'],
      ['2026-12-13', '100,000'],
      ['2027-01-31', '180,000'],
    ]);
    const posted = rows.map((r) => postedRule(r, dates, total));
    assert.deepEqual(
      posted,
      RULES.map((r) => ({ kind: r.kind, value: r.value, anchor: r.anchor, days: r.days })),
    );
  });
  it('a percent row with no price yet still posts its percent', () => {
    const [row] = rowsFromRules([RULES[0]!], { dates, totalPhp: null });
    assert.equal(row!.amount, '');
    assert.deepEqual(postedRule(row!, dates, null), { kind: 'percent', value: '30', anchor: 'on_lock', days: '0' });
  });
  it('a percent row re-plotted to its own percent of a NEW price stays percent', () => {
    const [row] = rowsFromRules([RULES[0]!], { dates, totalPhp: total });
    assert.deepEqual(postedRule({ ...row!, amount: '150,000' }, dates, 500_000), { kind: 'percent', value: '30', anchor: 'on_lock', days: '0' });
  });
});

describe('a typed day posts a rule that lands on exactly that day', () => {
  const days = ['2026-10-29', '2026-11-03', '2027-01-01', '2027-02-14', '2026-10-01'];
  for (const d of days) {
    it(`${d} → rule → ${d}`, () => {
      const a = dateToAnchor(d, dates);
      assert.ok(a, `no rule can say ${d}`);
      assert.equal(ruleDueIso(a.anchor, a.days, dates), d);
    });
  }
  it('before the event is preferred — the event date is the fixed point, "after you book" slides at booking', () => {
    assert.deepEqual(dateToAnchor('2027-01-01', dates), { anchor: 'before_event', days: '44' });
  });
  it('after the event, or with no event date, it counts from booking', () => {
    assert.deepEqual(dateToAnchor('2027-03-01', dates), { anchor: 'on_lock', days: '123' });
    assert.deepEqual(dateToAnchor('2026-11-05', { ...dates, eventIso: null }), { anchor: 'on_lock', days: '7' });
  });
  it('no rule can say a day before booking with no event date — it posts no anchor, and the save names it', () => {
    assert.equal(dateToAnchor('2026-10-01', { ...dates, eventIso: null }), null);
  });
  it('through the server builder: what is typed is what is stored', () => {
    const rows = rowsFromRules(RULES, { dates, totalPhp: total }).map((r, i) => (i === 1 ? { ...r, dueIso: '2027-01-10', amount: '90,000' } : r));
    rows[2] = { ...rows[2]!, amount: '190,000' };
    const posted = rows.map((r) => postedRule(r, dates, total));
    const built = buildCouplePaymentPlan({
      rows: rows.map((r, i) => ({ label: r.label, amount_kind: posted[i]!.kind, value: posted[i]!.value, due_anchor: posted[i]!.anchor, due_offset_days: posted[i]!.days })),
      totalPhp: total,
      lockDateIso: dates.lockIso,
      eventDateIso: dates.eventIso,
    });
    assert.ok(built.ok, built.ok ? '' : built.message);
    assert.deepEqual(built.instances.map((i) => [i.due_date, i.amount_php]), [
      ['2026-10-29', 120_000],
      ['2027-01-10', 90_000],
      ['2027-01-31', 190_000],
    ]);
    // …and it re-opens as exactly that.
    const again = rowsFromRules(planInstancesToRows(built.instances), { dates, totalPhp: total });
    assert.deepEqual(again.map((r) => [r.dueIso, r.amount]), [
      ['2026-10-29', '120,000'],
      ['2027-01-10', '90,000'],
      ['2027-01-31', '190,000'],
    ]);
  });
});

describe('a payment stays on its own instalment', () => {
  it('a row keeps its posted seq; new rows are numbered after the highest kept one', () => {
    assert.deepEqual(assignPlanSeqs([{ seq: 4 }, { seq: null }, { seq: 1 }, { seq: 4 }]).map((r) => r.seq), [4, 5, 1, 6]);
    assert.deepEqual(assignPlanSeqs([{}, {}, {}]).map((r) => r.seq), [0, 1, 2], 'a fresh plan is numbered as it always was');
  });
  it('removing an earlier payment does not hand a later, paid one a new seq', () => {
    const built = buildCouplePaymentPlan({
      rows: [
        { label: 'Second', amount_kind: 'fixed', value: '50000', due_anchor: 'on_lock', due_offset_days: '10', seq: 1 },
        { label: 'Third', amount_kind: 'fixed', value: '50000', due_anchor: 'on_lock', due_offset_days: '20', seq: 2 },
      ],
      totalPhp: 100_000,
      lockDateIso: dates.lockIso,
      eventDateIso: dates.eventIso,
    });
    assert.ok(built.ok);
    assert.deepEqual(built.instances.map((i) => [i.seq, i.label]), [
      [1, 'Second'],
      [2, 'Third'],
    ]);
    assert.deepEqual(planInstanceSeqs(built.instances), [1, 2]);
  });
});

describe('the honest line', () => {
  const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
  const r = (amount: string) => ({ key: 0, label: 'x', dueIso: '', amount, seq: null, settled: false, rule: null });
  it('matches · not in a payment yet · more than the price', () => {
    assert.equal(addsUpLine([r('60,000'), r('40,000')], 100_000, peso).text, 'Adds up to ₱100,000 · matches the price');
    assert.deepEqual(addsUpLine([r('60,000')], 100_000, peso), { text: 'Adds up to ₱60,000 · ₱40,000 not in a payment yet', off: true });
    assert.deepEqual(addsUpLine([r('60,000'), r('50,000')], 100_000, peso), { text: 'Adds up to ₱110,000 · ₱10,000 more than the price', off: true });
  });
});
