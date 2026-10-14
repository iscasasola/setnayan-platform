/**
 * booked-rows.test.ts — the Booked body's decisions, EXECUTED (owner
 * 2026-10-07; the prototype's Booked mode).
 *
 * Every case runs the real `teamRows` (the handshake and the first-payment
 * step) and the real resolver core (`computeEventMoney` → `buildBudgetList`),
 * so a row here is derived exactly as the page derives it — not from a row a
 * test typed by hand.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEventMoney, MONEY_READS_FAILED, type MoneyInputs } from './budget-truth';
import { buildBudgetList } from './budget-page-view';
import { teamRows, type TeamRowFacts } from './your-team-rows';
import { computeStepper, type PlanInstance, type PlanProgress } from './vendor-service-payment-schedules';
import {
  BOOKED_EMPTY,
  NEXT_MONEY_UNREAD,
  bookedView,
  dateAskFor,
  feedsFor,
  roomLineFor,
  type BookedFacts,
  type RoomSizeAnswer,
} from './booked-rows';
import { summarizeDateChange } from './date-change';

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
const ledger = (i: Partial<MoneyInputs>) =>
  buildBudgetList(
    computeEventMoney({
      targetCentavos: 225_000_000,
      vendors: [],
      lineItems: [],
      payments: [],
      orders: [],
      costs: [],
      pricing: new Map(),
      packageLockedCentavos: new Map(),
      benchmarks: [],
      now: NOW,
      ...i,
    }),
  ).suppliers;
const rowsOf = (facts: TeamRowFacts[]) => teamRows(facts, { eventId: E, lockHandshakeEnabled: true, now: NOW });
const keys = (verbs: readonly { key: string }[]) => verbs.map((v) => v.key).join(' ');

test('a booked supplier with a dated payment owed: the next step names it, and Pay is the main verb', () => {
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'sv', name: 'Seda Vertis North', pricePhp: 1_056_000, depositStep: 'due', threadId: 't1' })]),
    facts: [fact({ vendorId: 'sv', groupId: 'reception_venue', own: true, pricePhp: 1_056_000, threadId: 't1' })],
    money: ledger({
      vendors: [{ vendor_id: 'sv', event_id: E, category: 'venue', vendor_name: 'Seda Vertis North', status: 'contracted', total_cost_php: 1_056_000 }],
      lineItems: [
        { line_item_id: 'a', vendor_id: 'sv', label: 'First payment', amount_php: 528_000, due_date: '2026-10-05' },
        { line_item_id: 'b', vendor_id: 'sv', label: 'Balance', amount_php: 528_000, due_date: '2026-12-11' },
      ],
    }),
    now: NOW,
  });
  assert.equal(view.waiting.length, 0);
  const [r] = view.booked;
  assert.ok(r);
  assert.deepEqual(r.next, { kind: 'due', label: 'First payment', amountPhp: 528_000, dueDate: '2026-10-05', late: false });
  // The prototype's row for a supplier the couple added: Pay · Your record · Chat · Workspace · Cancel booking.
  assert.equal(keys(r.verbs), 'pay record chat workspace cancel');
  assert.equal(r.verbs[0]?.main, true);
  assert.equal(r.verbs.filter((v) => v.main).length, 1, 'more than one main verb');
  // Every MAIN button is terracotta (owner 2026-10-12, look call 1); the others keep their table colour.
  assert.equal(r.verbs[0]?.tone, 'brand', 'the main verb is not terracotta');
  assert.equal(r.verbs.find((v) => v.key === 'chat')?.tone, 'info');
  assert.deepEqual(r.feeds, ['Event Hub · venue & city', 'Seat plan · room size', 'Schedule']);
  assert.equal(view.unpriced, 0);
});

test('booked with no price: "set the price", Set price is the main verb, and it is counted as unpriced', () => {
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'sd', name: 'Santuario', service: 'Ceremony', depositStep: 'due' })]),
    facts: [fact({ vendorId: 'sd', groupId: 'ceremony_venue' })],
    money: ledger({
      vendors: [{ vendor_id: 'sd', event_id: E, category: 'religious_venue', vendor_name: 'Santuario', status: 'contracted', total_cost_php: null }],
    }),
    now: NOW,
  });
  const [r] = view.booked;
  assert.ok(r);
  assert.deepEqual(r.next, { kind: 'set_price' });
  assert.equal(keys(r.verbs), 'set_price workspace cancel');
  assert.equal(r.priced, false);
  assert.equal(view.unpriced, 1);
});

test('a line item stands in for the headline: an itemised supplier is priced', () => {
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'x', name: 'Itemised', depositStep: 'confirmed' })]),
    facts: [fact({ vendorId: 'x', own: true })],
    money: ledger({
      vendors: [{ vendor_id: 'x', event_id: E, category: 'venue', vendor_name: 'Itemised', status: 'contracted', total_cost_php: null }],
      lineItems: [{ line_item_id: 'a', vendor_id: 'x', label: 'Deposit', amount_php: 10_000, due_date: '2026-11-01' }],
    }),
    now: NOW,
  });
  const [r] = view.booked;
  assert.ok(r);
  assert.equal(r.priced, true);
  assert.equal(r.next.kind, 'due');
  assert.equal(view.unpriced, 0);
});

test('everything agreed is paid: "Paid in full" with the ledger’s own figure, Payments (quiet), and the way out is the dispute', () => {
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'p', name: 'Paid Up', pricePhp: 26_499, status: 'deposit_paid' })]),
    facts: [fact({ vendorId: 'p', pricePhp: 26_499, moneyMoved: true })],
    money: ledger({
      vendors: [{ vendor_id: 'p', event_id: E, category: 'catering', vendor_name: 'Paid Up', status: 'deposit_paid', total_cost_php: 26_499 }],
      payments: [{ payment_id: 'p1', vendor_id: 'p', line_item_id: null, amount_php: 26_499, paid_at: '2026-07-21T03:00:00Z' }],
    }),
    now: NOW,
  });
  const [r] = view.booked;
  assert.ok(r);
  assert.deepEqual(r.next, { kind: 'paid_in_full', paidPhp: 26_499 });
  assert.equal(keys(r.verbs), 'payments workspace dispute');
  assert.equal(r.verbs[0]?.quiet, true);
  // Setnayan pays no money back (owner 2026-10-08): the way out never promises a refund.
  const out = r.verbs.find((v) => v.key === 'dispute');
  // One name for the one disputes flow (owner 2026-10-14, DECISION_LOG 🧾): "Report a problem".
  assert.equal(out?.label, 'Report a problem');
  assert.doesNotMatch(out?.label ?? '', /refund/i);
});

test('the workspace door to the same flow says the same words — "Report a problem", never "Request refund / dispute"', () => {
  const src = stripComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/dashboard/[eventId]/vendors/_components/cancel-booking-button.tsx'), 'utf8'),
  );
  const at = src.indexOf('export function DisputeLinkButton');
  assert.ok(at > 0, 'DisputeLinkButton moved — re-anchor this guard, do not drop it');
  const door = src.slice(at, src.indexOf('\n}\n', at));
  assert.match(door, /href=\{`\/dashboard\/\$\{eventId\}\/disputes`\}/, 'the door still opens the disputes flow');
  assert.match(door, />\s*Report a problem\s*</, 'the door must read "Report a problem"');
  assert.doesNotMatch(src, /refund/i, 'a cancel/dispute door must never promise a refund (owner 2026-10-08)');
});

test('a payment on the ledger closes the hard delete even when the booking row has no deposit stamped', () => {
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'p', name: 'Logged', pricePhp: 50_000, depositStep: 'due' })]),
    facts: [fact({ vendorId: 'p', own: true, pricePhp: 50_000, moneyMoved: false })],
    money: ledger({
      vendors: [{ vendor_id: 'p', event_id: E, category: 'catering', vendor_name: 'Logged', status: 'contracted', total_cost_php: 50_000 }],
      payments: [{ payment_id: 'p1', vendor_id: 'p', line_item_id: null, amount_php: 10_000, paid_at: '2026-07-21T03:00:00Z' }],
    }),
    now: NOW,
  });
  assert.ok(!keys(view.booked[0]!.verbs).includes('cancel'), 'Cancel booking is offered where the server can only refuse it');
  assert.ok(keys(view.booked[0]!.verbs).includes('dispute'));
});

test('A REFUSED MONEY READ: a priced row says it could not be checked — never Pay, never "Paid in full", never an amount', () => {
  const refused = buildBudgetList(
    computeEventMoney({
      targetCentavos: null,
      vendors: [],
      lineItems: [],
      payments: [],
      orders: [],
      costs: [],
      pricing: new Map(),
      packageLockedCentavos: new Map(),
      benchmarks: [],
      reads: MONEY_READS_FAILED,
      now: NOW,
    }),
  ).suppliers;
  assert.equal(refused, null, 'the fixture is not a refused read');
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'sv', name: 'Seda', pricePhp: 1_056_000, depositStep: 'confirmed' })]),
    facts: [fact({ vendorId: 'sv', pricePhp: 1_056_000 })],
    money: refused,
    now: NOW,
  });
  const [r] = view.booked;
  assert.ok(r);
  assert.deepEqual(r.next, { kind: 'said', text: NEXT_MONEY_UNREAD, needsYou: false });
  assert.equal(r.verbs[0]?.key, 'payments');
  assert.ok(!keys(r.verbs).includes('pay '), 'Pay is offered on a ledger nobody read');
  // …and an unpriced row is still told to set its price: that fact was read.
  const unpriced = bookedView({
    rows: rowsOf([team({ vendorId: 'sd', name: 'Santuario' })]),
    facts: [fact({ vendorId: 'sd' })],
    money: refused,
    now: NOW,
  });
  assert.deepEqual(unpriced.booked[0]?.next, { kind: 'set_price' });
});

const inst = (seq: number, label: string, amount_php: number | null, due_date: string | null): PlanInstance => ({
  seq,
  label,
  amount_php,
  due_date,
  amount_kind: 'fixed',
  percent_bps: null,
});

test('A PAST DUE DATE IS LATE ON THE ROW EXACTLY WHEN THE PAY SHEET SAYS "Was due" (batch-5 walk: "by Oct 5" beside "Was due Oct 5")', async () => {
  const { priceSummaryOf } = await import('./price-summary');
  const steps = computeStepper([inst(1, 'First payment', 528_000, '2026-10-05')], []);
  const rowAt = (now: Date) =>
    bookedView({
      rows: teamRows([team({ vendorId: 'sv', name: 'Seda', pricePhp: 1_056_000, depositStep: 'sent' })], { eventId: E, lockHandshakeEnabled: true, now }),
      facts: [fact({ vendorId: 'sv', pricePhp: 1_056_000 })],
      money: ledger({ vendors: [{ vendor_id: 'sv', event_id: E, category: 'venue', vendor_name: 'Seda', status: 'contracted', total_cost_php: 1_056_000 }] }),
      plans: new Map([['sv', { steps, clearedAt: null, isDefaultSeeded: false }]]),
      now,
    }).booked[0]!.next;
  for (const [now, today] of [[new Date('2026-10-14T04:00:00Z'), '2026-10-14'], [new Date('2026-10-01T04:00:00Z'), '2026-10-01'], [new Date('2026-10-05T04:00:00Z'), '2026-10-05']] as const) {
    const next = rowAt(now);
    assert.equal(next.kind, 'due');
    const sheet = priceSummaryOf(steps, 'couple', { clearedAt: null, today }).rows[0]!.badge.text;
    assert.equal((next as { late: boolean }).late, /^Was due/.test(sheet), `row late=${(next as { late: boolean }).late} but the sheet says "${sheet}" on ${today}`);
  }
  // The row draws it the sheet's way: "was due Oct 5" in the danger colour, never "by" a past day.
  const ROW = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/dashboard/[eventId]/vendors/_components/booked-row.tsx'), 'utf8'));
  assert.match(ROW, /n\.late \? \([\s\S]{0,120}text-\[rgb\(var\(--color-danger\)\)\][^>]*>was due \{shortDate\(n\.dueDate\)\}/);
});


test('THE SUPPLIER’S OWN PLAN names the next step: the first instalment still due — one awaiting their confirmation is their turn', () => {
  const instances = [inst(1, 'Reservation', 105_600, '2026-08-02'), inst(2, 'Second payment', 528_000, '2026-10-05'), inst(3, 'Balance', 422_400, null)];
  const plan = (payments: Parameters<typeof computeStepper>[1], isDefaultSeeded = false): PlanProgress => ({
    steps: computeStepper(instances, payments),
    clearedAt: null,
    isDefaultSeeded,
  });
  const one = (p: PlanProgress, money = ledger({ vendors: [{ vendor_id: 'sv', event_id: E, category: 'venue', vendor_name: 'Seda', status: 'contracted', total_cost_php: 1_056_000 }] })) =>
    bookedView({
      rows: rowsOf([team({ vendorId: 'sv', name: 'Seda', pricePhp: 1_056_000, depositStep: 'sent' })]),
      facts: [fact({ vendorId: 'sv', pricePhp: 1_056_000 })],
      money,
      plans: new Map([['sv', p]]),
      now: NOW,
    }).booked[0]!;
  // Nothing logged: the first instalment.
  // Aug 2 is before NOW (Oct 1): the reservation is LATE.
  assert.deepEqual(one(plan([])).next, { kind: 'due', label: 'Reservation', amountPhp: 105_600, dueDate: '2026-08-02', late: true });
  // The reservation is logged and waiting on them → the couple's next step is the one after it.
  const second = one(plan([{ schedule_instance_seq: 1, vendor_confirmed: false }]));
  assert.deepEqual(second.next, { kind: 'due', label: 'Second payment', amountPhp: 528_000, dueDate: '2026-10-05', late: false });
  assert.equal(second.verbs[0]?.key, 'pay');
  // A date the plan has not resolved is not invented.
  const last = one(plan([{ schedule_instance_seq: 1, vendor_confirmed: true }, { schedule_instance_seq: 2, vendor_confirmed: true }]));
  assert.deepEqual(last.next, { kind: 'due', label: 'Balance', amountPhp: 422_400, dueDate: null, late: false });
  // The pencilled-in 50/50 is an ESTIMATE: it never names an amount on the row.
  assert.deepEqual(one(plan([], true)).next, { kind: 'said', text: 'they confirm your first payment', needsYou: false });
  // The plan answered even though the ledger did not: the next step is still said.
  const refused = buildBudgetList(computeEventMoney({ targetCentavos: null, vendors: [], lineItems: [], payments: [], orders: [], costs: [], pricing: new Map(), packageLockedCentavos: new Map(), benchmarks: [], reads: MONEY_READS_FAILED, now: NOW })).suppliers;
  assert.equal(one(plan([]), refused).next.kind, 'due');
  // Every instalment settled or waiting on them → the shipped sentence, not a made-up due.
  const waiting = one(plan([1, 2, 3].map((seq) => ({ schedule_instance_seq: seq, vendor_confirmed: false }))));
  assert.deepEqual(waiting.next, { kind: 'said', text: 'they confirm your first payment', needsYou: false });
});

test('the shipped first-payment sentences are kept: sent, refused, and a refused deposit read', () => {
  const money = ledger({
    vendors: [{ vendor_id: 'a', event_id: E, category: 'catering', vendor_name: 'A', status: 'contracted', total_cost_php: 10_000 }],
  });
  const one = (step: TeamRowFacts['depositStep']) =>
    bookedView({
      rows: rowsOf([team({ vendorId: 'a', name: 'A', pricePhp: 10_000, depositStep: step })]),
      facts: [fact({ vendorId: 'a', pricePhp: 10_000 })],
      money,
      now: NOW,
    }).booked[0]!;
  assert.deepEqual(one('due').next, { kind: 'said', text: 'make your first payment', needsYou: true });
  assert.equal(one('due').verbs[0]?.key, 'pay');
  assert.deepEqual(one('refused').next, { kind: 'said', text: 'send your payment again', needsYou: true });
  assert.equal(one('refused').pill.text, 'Payment not received');
  assert.equal(one('refused').verbs[0]?.key, 'pay');
  assert.deepEqual(one('sent').next, { kind: 'said', text: 'they confirm your first payment', needsYou: false });
  assert.equal(one('sent').verbs[0]?.key, 'payments');
  assert.deepEqual(one('unknown').next, { kind: 'said', text: 'we couldn’t check your payment', needsYou: false });
  assert.equal(one('unknown').verbs[0]?.key, 'payments', 'a refused deposit read offers Pay as if it were due');
});

test('after the day, the review door is the row’s next step — exactly as the shipped row decided it', () => {
  const view = bookedView({
    rows: rowsOf([team({ vendorId: 'a', name: 'A', status: 'complete', pricePhp: 10_000, reviewStatus: 'open' })]),
    facts: [fact({ vendorId: 'a', pricePhp: 10_000, moneyMoved: true })],
    money: ledger({}),
    now: NOW,
  });
  const [r] = view.booked;
  assert.ok(r);
  assert.deepEqual(r.next, { kind: 'said', text: 'leave a review', needsYou: true });
  assert.equal(r.verbs[0]?.key, 'review');
});

test('WAITING FOR THEIR YES is the handshake’s middle state: asked rows only, Nudge · Chat · Withdraw, and no Pay', () => {
  const view = bookedView({
    rows: rowsOf([
      team({ vendorId: 'h', name: 'Hiraya Table', service: 'Catering', status: 'shortlisted', lockRequestState: 'pending', lockRequestExpiresAt: '2026-10-04T04:00:00Z', threadId: 't-h', pricePhp: 216_000 }),
      team({ vendorId: 'n', name: 'No Thread', service: 'Cake', status: 'shortlisted', lockRequestState: 'pending' }),
      team({ vendorId: 'sv', name: 'Seda', pricePhp: 1_000, depositStep: 'confirmed' }),
      // Still deciding — lives in Find, never in Booked.
      team({ vendorId: 'q', name: 'Quote In', status: 'shortlisted', inquiryStatus: 'pending', threadId: 't-q' }),
    ]),
    facts: [
      fact({ vendorId: 'h', groupId: 'catering', pricePhp: 216_000, threadId: 't-h', lockRequestExpiresAt: '2026-10-04T04:00:00Z' }),
      fact({ vendorId: 'n' }),
      fact({ vendorId: 'sv', pricePhp: 1_000 }),
      fact({ vendorId: 'q', threadId: 't-q' }),
    ],
    money: ledger({}),
    now: NOW,
  });
  assert.deepEqual(view.waiting.map((w) => w.vendorId), ['h', 'n']);
  assert.deepEqual(view.booked.map((b) => b.vendorId), ['sv']);
  const [h, n] = view.waiting;
  assert.equal(keys(h!.verbs), 'nudge chat withdraw');
  assert.equal(h!.pricePhp, 216_000);
  assert.equal(h!.fuse, '3 days left to answer');
  // No conversation: nothing to nudge in and nobody to chat with — only the way back.
  assert.equal(keys(n!.verbs), 'withdraw');
  for (const w of view.waiting) {
    assert.ok(!w.verbs.some((v) => v.key === 'pay' || v.key === 'payments' || v.key === 'workspace'), 'something opened before their yes');
  }
});

test('with the handshake off there is no waiting state at all', () => {
  const rows = teamRows(
    [team({ vendorId: 'h', name: 'H', status: 'shortlisted', lockRequestState: 'pending' })],
    { eventId: E, lockHandshakeEnabled: false, now: NOW },
  );
  const view = bookedView({ rows, facts: [fact({ vendorId: 'h' })], money: ledger({}), now: NOW });
  assert.deepEqual(view, { waiting: [], booked: [], unpriced: 0 });
});

test('the words are the prototype’s, and a category with no map feeds the Schedule', () => {
  assert.equal(BOOKED_EMPTY, 'Nothing booked yet — book from Find or from your build.');
  assert.deepEqual(feedsFor('ceremony_venue'), ['Event Hub · ceremony', 'Schedule']);
  assert.deepEqual(feedsFor('rings'), ['Schedule']);
  assert.deepEqual(feedsFor(null), ['Schedule']);
});

test('ROOM SIZE: only reception · ceremony · accommodation have a line — and "not sent" is said only when their shop answered', () => {
  const rooms = new Map<string, RoomSizeAnswer>([['rec', { widthM: 18, lengthM: 24 }], ['cer', 'not_sent']]);
  const f = (vendorId: string, groupId: string | null, shopId: string | null = 'shop', threadId: string | null = 't') => ({ vendorId, groupId, shopId, threadId });
  assert.deepEqual(roomLineFor(f('rec', 'reception_venue'), rooms), { kind: 'sent', widthM: 18, lengthM: 24, seatPlan: true });
  assert.deepEqual(roomLineFor(f('cer', 'ceremony_venue'), rooms), { kind: 'not_sent', canAsk: true });
  // No conversation → nothing to ask in.
  assert.deepEqual(roomLineFor(f('cer', 'ceremony_venue', 'shop', null), rooms), { kind: 'not_sent', canAsk: false });
  // The seat plan starts from the RECEPTION's size only — a ceremony's is not claimed as used.
  assert.deepEqual(roomLineFor(f('rec', 'ceremony_venue'), rooms), { kind: 'sent', widthM: 18, lengthM: 24, seatPlan: false });
  // No other category gets a size line at all.
  for (const g of ['catering', 'photography', 'cake', 'stylist', null]) assert.equal(roomLineFor(f('rec', g), rooms), null);
  // A venue the couple added themselves has no shop to state it on.
  assert.deepEqual(roomLineFor(f('own', 'reception_venue', null), rooms), { kind: 'not_sent', canAsk: false });
  // A refused read, or a shop that did not answer, is NOT "not sent".
  assert.deepEqual(roomLineFor(f('rec', 'reception_venue'), null), { kind: 'unread' });
  assert.deepEqual(roomLineFor(f('hidden', 'accommodation'), rooms), { kind: 'unread' });
  // Nobody asked for sizes → no line (the lab's older states, a caller that does not read them).
  assert.equal(roomLineFor(f('rec', 'reception_venue'), undefined), null);
});

test('A PENDING DATE CHANGE is said on the row of the supplier it is waiting on — in the Home doorway’s own words', () => {
  const now = new Date('2026-10-01T04:00:00Z');
  const view = summarizeDateChange({
    requestId: 'r1',
    proposedDate: '2026-12-12',
    proposedPrecision: 'day',
    fromDate: '2026-12-18',
    askedAt: '2026-09-30T04:00:00Z',
    rows: [
      { vendor_profile_id: 'p-seda', event_vendor_id: 'sv', answer: 'asked', due_at: '2026-10-03T04:00:00Z', answered_at: null, money_flag_id: null },
      { vendor_profile_id: 'p-lumina', event_vendor_id: 'lu', answer: 'moved', due_at: '2026-10-03T04:00:00Z', answered_at: '2026-09-30T08:00:00Z', money_flag_id: null },
    ],
    names: new Map([['p-seda', 'Seda'], ['p-lumina', 'Lumina']]),
    now: now.getTime(),
  });
  const seda = dateAskFor(view, 'sv', now);
  assert.ok(seda, 'the supplier still deciding has no line');
  assert.equal(seda.waiting, true);
  assert.match(seda.line, /^Deciding · /);
  assert.match(seda.when, /December 12, 2026/);
  assert.deepEqual(dateAskFor(view, 'lu', now), { when: seda.when, line: 'Can move to the new date', waiting: false });
  // A supplier the request does not name, or no open request: nothing is drawn.
  assert.equal(dateAskFor(view, 'someone-else', now), null);
  assert.equal(dateAskFor(null, 'sv', now), null);
});
