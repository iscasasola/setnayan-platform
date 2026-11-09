/**
 * The lane-C card rules, held (Supplier Build 3 · plans/supplier_build_3_2026-11-08/03-FINAL-RULINGS-2026-11-09.md).
 * Run from apps/web: tsx --test lib/chat-cards.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQuoteEdits,
  askForAChange,
  askRefusalWords,
  bookRequestFromLine,
  changeAskFromLine,
  decisionLine,
  deltaWords,
  editPlanPayment,
  floorRefusal,
  formProgress,
  guestRecount,
  formLineTitle,
  guestCountFromLine,
  ledgerLine,
  linesTotal,
  logPaymentRefusal,
  logPaymentStepOk,
  needsCoordinatorAgree,
  paidFloor,
  planLedger,
  recountedLines,
  toProposalLineItems,
  type CardLine,
} from './chat-cards';
import type { InstallmentDraft } from './proposal-payment-schedule';

const P = (php: number) => php * 100;
const LINES: CardLine[] = [
  { key: 'l1', label: 'Full-day coverage', detail: null, amountCentavos: P(45_000) },
  { key: 'l2', label: 'Guest portrait prints', detail: '150 × ₱40', amountCentavos: P(6_000) },
  { key: 'l3', label: 'Same-day edit', detail: null, amountCentavos: P(9_000) },
];

test('🧾 Change quote: add · change · remove are marked and totalled; a removed line counts nothing', () => {
  const out = applyQuoteEdits(LINES, [
    { op: 'add', key: 'n1', label: 'Drone', amountCentavos: P(5_000) },
    { op: 'edit', key: 'l3', amountCentavos: P(9_800) },
    { op: 'remove', key: 'l2' },
  ]);
  assert.deepEqual(out.map((l) => l.mark), [null, 'rm', 'chg', 'add']);
  assert.equal(linesTotal(out), P(45_000 + 9_800 + 5_000));
  assert.equal(toProposalLineItems(out).length, 3, 'a removed line is not sent');
  // Removing a line added in the same card simply drops it.
  assert.equal(applyQuoteEdits(LINES, [{ op: 'add', key: 'n1', label: 'X', amountCentavos: 1 }, { op: 'remove', key: 'n1' }]).length, 3);
});

test('🧾 the paid quotation is the floor; before any payment there is none', () => {
  assert.equal(paidFloor({ paidQuoteCentavos: P(60_000), confirmedPaymentCount: 0 }), null);
  const floor = paidFloor({ paidQuoteCentavos: P(60_000), confirmedPaymentCount: 1 });
  assert.equal(floor, P(60_000));
  assert.equal(floorRefusal(P(59_999), floor), "Can't go below ₱60,000 — what they paid for. Add something to swap.");
  assert.equal(floorRefusal(P(60_000), floor), null);
  assert.equal(floorRefusal(P(1), null), null);
  assert.equal(deltaWords(P(60_800), P(60_000)), '+₱800');
  assert.equal(deltaWords(P(59_000), P(60_000)), '−₱1,000');
});

const D = (label: string, php: number): InstallmentDraft => ({ label, kind: 'fixed', amountPhp: php, percent: null, due: 'on_lock', offsetDays: 0 });
const AUTO = { label: 'Final balance', due: 'before_event' as const, offsetDays: 14 };

test('💳 the plan always pays the whole Agreed amount — the Final balance absorbs a revision', () => {
  const l = planLedger({ manual: [D('First payment', 30_000)], autoBalance: AUTO, agreedCentavos: P(60_800), paidSeqs: new Set([0]) });
  assert.equal(l.paysInFull, true);
  assert.deepEqual(l.rows.map((r) => [r.state, r.amountCentavos]), [['paid', P(30_000)], ['final', P(30_800)]]);
  assert.equal(ledgerLine(l), 'Plan pays all: ₱30,000 + ₱30,800 = ₱60,800 ✓');
});

test('💳 over-cover is refused, never saved', () => {
  const l = planLedger({ manual: [D('First', 40_000), D('Second', 30_000)], autoBalance: AUTO, agreedCentavos: P(60_000) });
  assert.equal(l.paysInFull, false);
  assert.match(l.problem ?? '', /^Over by ₱10,000 — trim a payment$/);
});

test('💳 a paid payment never changes; the Final balance is never typed', () => {
  const manual = [D('First', 30_000), D('Second', 10_000)];
  const paid = new Set([0]);
  assert.deepEqual(editPlanPayment(manual, 0, 1, paid), { ok: false, reason: 'A paid payment never changes' });
  assert.equal(editPlanPayment(manual, 2, 1, paid).ok, false);
  const ok = editPlanPayment(manual, 1, 12_000, paid);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(planLedger({ manual: ok.manual, autoBalance: AUTO, agreedCentavos: P(60_000), paidSeqs: paid }).paysInFull, true);
});

test('💳 only the hosts side asks for a change; a lock hides it with the supplier\'s words', () => {
  assert.deepEqual(askForAChange({ readerIsSupplier: true, locked: false, supplierName: 'Lumina' }), { show: false, line: null });
  assert.deepEqual(askForAChange({ readerIsSupplier: false, locked: true, supplierName: 'Lumina' }), { show: false, line: "Lumina's price is final" });
  assert.deepEqual(askForAChange({ readerIsSupplier: false, locked: false, supplierName: 'Lumina' }), { show: true });
  assert.match(askRefusalWords('ask_for_a_change: ITEM_LOCKED — x'), /made this final/);
});

test('🤝 a payment proof to a coordinator/planner needs Agree — REQUIRED', () => {
  assert.equal(needsCoordinatorAgree('planner_coordinator'), true);
  assert.equal(needsCoordinatorAgree('photography'), false);
  const d = { amountPhp: 10_000, method: 'GCash', reference: '4471', paidOn: '2026-11-09', receiptRef: 'r2://x', agree: false };
  assert.equal(logPaymentStepOk(d, 4, true), false, 'no Agree, no Send');
  assert.equal(logPaymentStepOk({ ...d, agree: true }, 4, true), true);
  assert.equal(logPaymentStepOk(d, 4, false), true, 'another supplier needs no Agree');
  assert.equal(logPaymentRefusal({ toCoordinator: true, agree: false }), 'Tick the box to agree before you send.');
  assert.equal(logPaymentRefusal({ toCoordinator: true, agree: true }), null);
});

test('👥 recount: only per-guest lines move, never below min_pax nor the floor; a locked quote is not recounted', () => {
  const perPax = [{ key: 'l2', label: 'Guest portrait prints', rateCentavos: P(40), minPax: 100 }];
  const r = guestRecount({ lines: LINES, perPax, from: 150, to: 170, floorCentavos: null, locked: false, supplierName: 'Lumina' });
  assert.equal(r.kind, 'recount');
  if (r.kind === 'recount') {
    assert.deepEqual(r.rows.map((x) => [x.fromQty, x.toQty]), [[150, 170]]);
    assert.equal(r.newTotalCentavos - r.oldTotalCentavos, P(800));
    assert.equal(linesTotal(recountedLines(LINES, r)), r.newTotalCentavos);
  }
  const low = guestRecount({ lines: LINES, perPax, from: 150, to: 60, floorCentavos: P(60_000), locked: false, supplierName: 'Lumina' });
  assert.equal(low.kind === 'recount' && low.rows[0]!.toQty, 100, 'min_pax holds');
  assert.equal(low.kind === 'recount' && low.floored && low.newTotalCentavos, P(60_000), 'the floor holds');
  assert.deepEqual(guestRecount({ lines: LINES, perPax, from: 150, to: 170, floorCentavos: null, locked: true, supplierName: 'Lumina' }), {
    kind: 'locked',
    line: "Lumina's price is final",
  });
  assert.equal(guestRecount({ lines: LINES, perPax: [], from: 150, to: 170, floorCentavos: null, locked: false, supplierName: 'L' }).kind, 'inform');
});

test('📮 book-request cards read the database\'s exact lines, nothing else', () => {
  assert.deepEqual(bookRequestFromLine("Booking ask sent by the hosts · waiting for the supplier's answer"), { state: 'asked', reason: null });
  assert.deepEqual(bookRequestFromLine('Booked ✓'), { state: 'booked', reason: null });
  assert.deepEqual(bookRequestFromLine('Not available · Booked that day'), { state: 'not_available', reason: 'Booked that day' });
  assert.equal(bookRequestFromLine('Booking ask withdrawn by the hosts')?.state, 'withdrawn');
  assert.equal(bookRequestFromLine('Booking ask expired without an answer')?.state, 'expired');
  assert.equal(bookRequestFromLine('Booked'), null);
  assert.deepEqual(changeAskFromLine('Asked for a change · Quotation · Maria — “x”'), { subject: 'quote', answered: null });
  assert.deepEqual(changeAskFromLine('Change asked · Payment plan · declined by the supplier'), { subject: 'plan', answered: 'declined' });
});

test('📝 form · one at a time; the form and guest-count lines are read exactly; 📌 decisions', () => {
  assert.deepEqual(formProgress(['a', null, null]), { at: 1, answered: 1, done: false });
  assert.deepEqual(formProgress(['a', 'b']), { at: 1, answered: 2, done: true });
  assert.equal(formLineTitle('I sent you a form — “Shot list”. Answer it in your event.'), 'Shot list');
  assert.equal(formLineTitle('I sent you a form'), null);
  assert.deepEqual(guestCountFromLine('Guest count changed · 150 → 170 guests'), { from: 150, to: 170 });
  assert.equal(guestCountFromLine('Guest count set · 150 guests'), null);
  assert.equal(decisionLine('Drone at sunset', 'open', 'Maria'), 'Talking about: Drone at sunset · pinned by Maria');
  assert.equal(decisionLine('Drone at sunset', 'close', 'Lumina'), 'Drone at sunset · closed by Lumina');
});
