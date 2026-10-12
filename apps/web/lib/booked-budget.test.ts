/**
 * booked-budget.test.ts — the six figures, the meter and the per-supplier lines
 * under the Booked rows, EXECUTED over the real resolver core and the real
 * `teamMoney` (owner 2026-10-07; the prototype's Booked mode).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEventMoney, type MoneyInputs, type MoneyReadStatus } from './budget-truth';
import { buildBudgetList } from './budget-page-view';
import { teamRows, type TeamRowFacts } from './your-team-rows';
import { teamMoney } from './your-team';
import { bookedView, type BookedFacts } from './booked-rows';
import { bookedBudget, teamMoneyOfModel } from './booked-budget';

const E = '00000000-0000-4000-8000-000000000000';
const NOW = new Date('2026-10-01T04:00:00Z');

const team = (f: Partial<TeamRowFacts> & Pick<TeamRowFacts, 'vendorId' | 'name'>): TeamRowFacts => ({
  service: 'Reception',
  logoUrl: null,
  status: 'contracted',
  lockRequestState: null,
  lockRequestExpiresAt: null,
  inBuild: false,
  lockGroupId: null,
  lockBlocked: null,
  inquiryStatus: null,
  threadId: null,
  pricePhp: null,
  depositStep: null,
  reviewStatus: null,
  quoteWaitingOnCouple: false,
  ...f,
});
const fact = (f: Partial<BookedFacts> & Pick<BookedFacts, 'vendorId'>): BookedFacts => ({
  groupId: null,
  own: false,
  shopId: null,
  pricePhp: null,
  threadId: null,
  moneyMoved: false,
  lockRequestExpiresAt: null,
  ...f,
});
const INPUTS: MoneyInputs = {
  targetCentavos: 225_000_000,
  vendors: [
    { vendor_id: 'sv', event_id: E, category: 'venue', vendor_name: 'Seda Vertis North', status: 'contracted', total_cost_php: 1_056_000 },
    { vendor_id: 'sd', event_id: E, category: 'religious_venue', vendor_name: 'Santuario', status: 'contracted', total_cost_php: null },
    // Asked, not booked: an estimate — never part of "Booked" or "Paid".
    { vendor_id: 'h', event_id: E, category: 'catering', vendor_name: 'Hiraya', status: 'shortlisted', total_cost_php: 216_000 },
  ],
  lineItems: [
    { line_item_id: 'a', vendor_id: 'sv', label: 'First payment', amount_php: 528_000, due_date: '2026-10-05' },
    { line_item_id: 'b', vendor_id: 'sv', label: 'Balance', amount_php: 528_000, due_date: '2026-12-11' },
  ],
  payments: [],
  orders: [{ order_id: 'o1', description: 'Event Hub Pro', service_key: 'EVENT_HUB_PRO', requested_total_php: 2_500, confirmed_total_php: 2_500, status: 'paid', created_at: '2026-09-14T03:00:00Z' }],
  costs: [],
  pricing: new Map(),
  packageLockedCentavos: new Map(),
  benchmarks: [],
  now: NOW,
};
const TEAM = [
  team({ vendorId: 'sv', name: 'Seda Vertis North', pricePhp: 1_056_000, depositStep: 'due' }),
  team({ vendorId: 'sd', name: 'Santuario', service: 'Ceremony', depositStep: 'due' }),
  team({ vendorId: 'h', name: 'Hiraya', status: 'shortlisted', lockRequestState: 'pending', pricePhp: 216_000 }),
];
const FACTS = [fact({ vendorId: 'sv', own: true, pricePhp: 1_056_000 }), fact({ vendorId: 'sd' }), fact({ vendorId: 'h', pricePhp: 216_000 })];

function scene(over: Partial<MoneyInputs> = {}, reads?: MoneyReadStatus, plansKnown = true) {
  const list = buildBudgetList(computeEventMoney({ ...INPUTS, ...over, reads }));
  const view = bookedView({
    rows: teamRows(TEAM, { eventId: E, lockHandshakeEnabled: true, now: NOW }),
    facts: FACTS,
    money: list.suppliers,
    now: NOW,
  });
  // The prototype's seed: ₱1,056,000 booked, one booked supplier unpriced, nothing in the build.
  const tm = { money: teamMoney({ lockedCentavos: 105_600_000, lockedUnpricedCount: 1, candidateCostsPhp: [], budgetPhp: 2_250_000 }), inBuildCount: 0 };
  return bookedBudget({ team: tm, list, booked: view.booked, plansKnown });
}

test('the prototype’s seed: every figure, the meter and the two lines', () => {
  const b = scene();
  assert.equal(b.dueNextPhp, 528_000);
  assert.equal(b.budgetPhp, 2_250_000);
  assert.equal(b.bookedPhp, 1_056_000);
  assert.equal(b.bookedUnpriced, 1);
  assert.equal(b.paidPhp, 0);
  assert.deepEqual(b.orders, { totalPhp: 2_500, count: 1, owedPhp: 0, onlyName: 'Event Hub Pro' });
  assert.equal(b.inBuildPhp, 0);
  assert.equal(b.inBuildCount, 0);
  // One booked supplier has no price → the buffer refuses, as `teamMoney` rules.
  assert.deepEqual(b.buffer, { text: 'Not knowable', tone: 'none', unpriced: 1 });
  assert.equal(Math.round(b.meter!.spokenPct), 47);
  assert.equal(b.meter!.paidPct, 0);
  assert.deepEqual(b.lines, [
    { vendorId: 'sv', name: 'Seda Vertis North', own: true, kind: 'due', label: 'First payment', dueDate: '2026-10-05', amountPhp: 528_000 },
    { vendorId: 'sd', name: 'Santuario', own: false, kind: 'no_amount' },
  ]);
});

test('a payment moves Paid and the next line — from the ledger, never from a typed field', () => {
  const b = scene({
    payments: [{ payment_id: 'p1', vendor_id: 'sv', line_item_id: 'a', amount_php: 528_000, paid_at: '2026-10-01T03:00:00Z' }],
  });
  assert.equal(b.paidPhp, 528_000);
  assert.equal(b.dueNextPhp, 528_000, 'the balance is the next dated payment');
  assert.equal(b.lines[0]?.kind, 'due');
  assert.equal((b.lines[0] as { label: string }).label, 'Balance');
  assert.equal(Math.round(b.meter!.paidPct!), 23);
});

test('paid up → "on track" with what is paid of what is agreed; owed with no date → "owed", never "on track"', () => {
  const paid = scene({
    lineItems: [],
    payments: [{ payment_id: 'p1', vendor_id: 'sv', line_item_id: null, amount_php: 1_056_000, paid_at: '2026-10-01T03:00:00Z' }],
  });
  assert.deepEqual(paid.lines[0], { vendorId: 'sv', name: 'Seda Vertis North', own: true, kind: 'on_track', paidPhp: 1_056_000, agreedPhp: 1_056_000 });
  assert.equal(paid.dueNextPhp, 0);
  const undated = scene({ lineItems: [] });
  assert.deepEqual(undated.lines[0], { vendorId: 'sv', name: 'Seda Vertis North', own: true, kind: 'owed', paidPhp: 0, agreedPhp: 1_056_000 });
});

test('A REFUSED SUPPLIER READ: Paid and Due next are unknown (null), the meter draws no paid bar, a priced line says unread', () => {
  const b = scene({ vendors: [], lineItems: [], payments: [] }, { suppliers: 'failed', orders: 'ok', costs: 'ok' });
  assert.equal(b.paidPhp, null, 'a refused read printed as ₱0 paid');
  assert.equal(b.dueNextPhp, 0, 'the plans answered: nothing in them is due');
  assert.equal(b.meter!.paidPct, null);
  // …and with the plans refused too, what is due is unknown — never "nothing due".
  const blind = scene({ vendors: [], lineItems: [], payments: [] }, { suppliers: 'failed', orders: 'ok', costs: 'ok' }, false);
  assert.equal(blind.dueNextPhp, null, 'two refused reads printed as "nothing due"');
  assert.equal(b.lines[0]?.kind, 'unread');
  assert.equal(b.lines[1]?.kind, 'no_amount', 'an unpriced supplier is still asked for its price');
  // What `teamMoney` measured is still stated.
  assert.equal(b.bookedPhp, 1_056_000);
  assert.deepEqual(b.orders?.totalPhp, 2_500);
});

test('A REFUSED ORDERS READ: Setnayan orders is unknown — not "₱0"', () => {
  const b = scene({ orders: [] }, { suppliers: 'ok', orders: 'failed', costs: 'ok' });
  assert.equal(b.orders, null);
  assert.equal(b.paidPhp, 0, 'the supplier read answered');
});

test('no budget set: no meter, and the buffer says so', () => {
  const list = buildBudgetList(computeEventMoney(INPUTS));
  const b = bookedBudget({
    team: { money: teamMoney({ lockedCentavos: 100_000, candidateCostsPhp: [], budgetPhp: null }), inBuildCount: 0 },
    list,
    booked: [],
    plansKnown: true,
  });
  assert.equal(b.meter, null);
  assert.equal(b.buffer.text, 'No budget set');
});

test('teamMoneyOfModel makes the Build body’s own call: booked from chosenCentavos, the build counted, a missing price never ₱0', () => {
  const pick = (vendor_id: string, raw_status: string, rolled_cost_php: number | null) => ({ vendor_id, raw_status, rolled_cost_php });
  const model = {
    chosenCentavos: 105_600_000,
    folders: [
      {
        children: [
          { picks: [pick('sv', 'contracted', 1_056_000), pick('sd', 'contracted', null)], buildPickVendorIds: ['sv'] },
          { picks: [pick('a', 'shortlisted', 50_000), pick('b', 'shortlisted', null), pick('c', 'considering', 9)], buildPickVendorIds: ['a', 'b', 'gone'] },
        ],
      },
    ],
  } as unknown as Parameters<typeof teamMoneyOfModel>[0];
  const { money, inBuildCount } = teamMoneyOfModel(model, 2_250_000);
  assert.equal(money.lockedPhp, 1_056_000);
  assert.equal(money.lockedUnpriced, 1);
  assert.equal(inBuildCount, 2, 'a booked pick, or one no longer on the list, was counted as in the build');
  assert.equal(money.inBuildPhp, 50_000);
  assert.equal(money.inBuildUnpriced, 1);
  assert.equal(money.bufferPhp, null, 'a buffer was stated over a sum with prices missing');
});
