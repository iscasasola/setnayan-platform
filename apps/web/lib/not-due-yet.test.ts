/**
 * not-due-yet.test.ts — "nothing is owed today" is its own state, paying early
 * is a choice, and what has already been paid is on the screen.
 *
 * Owner, live as testnayan4 on the booked Saysay card, 2026-09-20: "after
 * paying. their next due date is not yet today, so there is nothing to record.
 * Pay in advance? show the current payments done as well."
 *
 * THE DEFECT: ₱3,350 recorded Sep 20 and confirmed by the supplier; the next
 * installment is the ₱13,400 Final balance due Feb 27, 2027 — five months out.
 * The card still read "Final balance · due Feb 27, 2027 · ₱13,400" beside a
 * prominent **Record payment** button, and showed no trace of the ₱3,350. Two
 * different facts ("₱13,400 is owed today" and "nothing is owed today")
 * rendered identically, and a booking paid into looked like one that was not.
 *
 * The STATE RULE is EXECUTED here — five states, due now · not due yet ·
 * overdue · all paid · unreadable — plus the mounts on both ends, and the one
 * that matters most: a refused ledger read may never render as zero payments.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import {
  acceptedQuoteTerms,
  installmentDueISO,
  installmentDueState,
  moneyStep,
  moneyStepLine,
  type AcceptedQuoteRow,
  type MoneyStepInput,
} from './accepted-quote-terms';
import { paidOnLabel, paymentHistory, type PaymentLedgerRow } from './payment-history';

const WEB = path.resolve(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8'));

/** The live quote S89J-EK6NWM69T1: ₱3,350 on lock, ₱13,400 fourteen days before. */
const LIVE: AcceptedQuoteRow = {
  public_id: 'S89J-EK6NWM69T1',
  status: 'accepted',
  total_centavos: 1675000,
  line_items: [{ label: 'Cover Songs', detail: null, amount_centavos: 1675000 }],
  payment_schedule: {
    version: 1,
    balances: true,
    installments: [
      { due: 'on_lock', seq: 0, kind: 'percent', label: 'First payment', offset_days: 0, percent_bps: 2000, raw_centavos: 335000, is_downpayment: true, amount_centavos: 335000, is_auto_balance: false, credit_applied_centavos: 0 },
      { due: 'before_event', seq: 1, kind: 'auto', label: 'Final balance', offset_days: 14, percent_bps: null, raw_centavos: 1340000, is_downpayment: false, amount_centavos: 1340000, is_auto_balance: true, credit_applied_centavos: 0 },
    ],
    base_centavos: 1675000,
    total_centavos: 1675000,
    credit_centavos: 0,
    over_by_centavos: 0,
    credit_over_centavos: 0,
  },
};
/** The real event date: Mar 13, 2027 − 14 days = Feb 27, 2027. */
const TERMS = acceptedQuoteTerms([LIVE], '2027-03-13')!;

/** The owner's booking: first payment recorded AND confirmed. */
const settledFirst = (today: string | null): MoneyStepInput => ({
  terms: TERMS,
  booked: true,
  today,
  deposit: { recordedAt: '2026-09-20T02:00:00Z', acknowledgedAt: '2026-09-20T03:00:00Z', declinedAt: null },
  ledger: { count: 1, paidCentavos: 335000, recordedFirstCentavos: 335000 },
});

test('the schedule carries a comparable ISO due date, built lexically', () => {
  const final = TERMS.schedule.find((r) => !r.isFirstPayment)!;
  assert.equal(final.dueOn, 'Feb 27, 2027');
  assert.equal(final.dueOnISO, '2027-02-27');
  // On-lock has no calendar date to compare against: lock IS now.
  assert.equal(TERMS.schedule.find((r) => r.isFirstPayment)!.dueOnISO, null);
  assert.equal(installmentDueISO('before_event', 14, '2027-03-13'), '2027-02-27');
  assert.equal(installmentDueISO('on_event', 0, '2027-03-13'), '2027-03-13');
  assert.equal(installmentDueISO('before_event', 14, null), null);
  assert.equal(installmentDueISO('before_event', 14, 'not a date'), null);
});

test('installmentDueState — a string comparison, and it never HIDES a door it cannot date', () => {
  assert.equal(installmentDueState('2027-02-27', '2026-09-20'), 'not_due_yet');
  assert.equal(installmentDueState('2027-02-27', '2027-02-27'), 'due_now');
  assert.equal(installmentDueState('2027-02-27', '2027-02-28'), 'overdue');
  // 🔑 The two unknowns both fall back to due_now. "Nothing due" is a claim;
  // it is never made from a missing date or a missing clock.
  assert.equal(installmentDueState(null, '2026-09-20'), 'due_now');
  assert.equal(installmentDueState('2027-02-27', null), 'due_now');
});

test('THE STATE RULE · five states, executed on the owner\'s live booking', () => {
  // 1 · NOT DUE YET — today is Sep 20, 2026; the balance is due Feb 27, 2027.
  const notYet = moneyStep(settledFirst('2026-09-20'));
  assert.equal(notYet.kind, 'installment_not_due_yet');
  assert.equal(
    moneyStepLine(notYet, 'couple', 'Saysay'),
    'Nothing due now · Final balance ₱13,400 due Feb 27, 2027',
  );
  assert.equal(
    moneyStepLine(notYet, 'vendor', 'the couple'),
    'Nothing due from the couple now · Final balance ₱13,400 due Feb 27, 2027',
  );

  // 2 · DUE NOW — the day itself.
  const dueNow = moneyStep(settledFirst('2027-02-27'));
  assert.equal(dueNow.kind, 'installment_due');
  assert.equal(dueNow.kind === 'installment_due' && dueNow.overdue, false);
  assert.equal(
    moneyStepLine(dueNow, 'couple', 'Saysay'),
    'First payment confirmed. Amount to pay: Final balance · due Feb 27, 2027 · ₱13,400',
  );

  // 3 · OVERDUE — the date passed and it is unpaid. Stated, with no invented
  // consequence: no fee, no cancellation, no expiry exists in the code.
  const over = moneyStep(settledFirst('2027-03-01'));
  assert.equal(over.kind, 'installment_due');
  assert.equal(over.kind === 'installment_due' && over.overdue, true);
  const overCouple = moneyStepLine(over, 'couple', 'Saysay')!;
  assert.equal(overCouple, 'Overdue · Final balance ₱13,400 was due Feb 27, 2027');
  assert.equal(
    moneyStepLine(over, 'vendor', 'the couple'),
    'Overdue · Final balance ₱13,400 was due Feb 27, 2027 — not recorded by the couple',
  );
  assert.doesNotMatch(overCouple, /cancel|fee|forfeit|penalt|expire/i, 'a consequence the code does not implement');

  // 4 · ALL PAID.
  const paid = moneyStep({
    ...settledFirst('2026-09-20'),
    ledger: { count: 2, paidCentavos: 1675000, recordedFirstCentavos: 335000 },
  });
  assert.equal(paid.kind, 'paid_in_full');
  assert.equal(moneyStepLine(paid, 'couple', 'Saysay'), 'Paid in full — ₱16,750');

  // 5 · UNREADABLE — the booking row could not be read. Never "nothing due".
  const unknown = moneyStep({ ...settledFirst('2026-09-20'), deposit: undefined });
  assert.equal(unknown.kind, 'unknown');
  assert.equal(
    moneyStepLine(unknown, 'couple', 'Saysay'),
    "We couldn't load your payments here. Open the Payments tab to see what is due.",
  );
  for (const line of [moneyStepLine(unknown, 'couple', 'Saysay')!, moneyStepLine(unknown, 'vendor', 'the couple')!]) {
    assert.doesNotMatch(line, /Nothing due|Paid in full/, 'an unreadable read spoke as if it knew');
  }
});

test('a first payment still due is untouched by the clock', () => {
  const owed = moneyStep({
    terms: TERMS,
    booked: true,
    today: '2026-09-20',
    deposit: { recordedAt: null, acknowledgedAt: null, declinedAt: null },
    ledger: { count: 0, paidCentavos: 0, recordedFirstCentavos: null },
  });
  assert.equal(owed.kind, 'first_payment_due');
  assert.equal(moneyStepLine(owed, 'couple', 'Saysay'), 'First payment ₱3,350 — due now');
});

test('PAY EARLY is the same door, prefilled with the same installment', () => {
  const notYet = moneyStep(settledFirst('2026-09-20'));
  assert.equal(notYet.kind, 'installment_not_due_yet');
  if (notYet.kind !== 'installment_not_due_yet') return;
  // Same action as the due-now step: one payment path, never two.
  assert.equal(notYet.action, 'log_payment');
  assert.equal(notYet.amountCentavos, 1340000);
  assert.equal(notYet.dueOnISO, '2027-02-27');

  const card = src('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx');
  // ONE writer for later installments, whether due now or paid early.
  assert.equal(card.split('logScheduledPayment(form)').length - 1, 1, 'a second later-payment writer appeared');
  assert.match(card, /notDueYet \? \(/, 'the not-due-yet branch is gone');
  assert.match(card, /Pay early/);
  // The quiet control must NOT be the due-now CTA.
  const early = card.slice(card.indexOf('notDueYet ? ('), card.indexOf('Pay early'));
  assert.doesNotMatch(early, /Record payment/, 'the not-due-yet state still offers a due-now CTA');
  // …and the not-due-yet step must reach the shared control, not a new one.
  assert.match(
    card,
    /\{notDueYet \? \([\s\S]{0,700}<LaterInstallment/,
    'the not-due-yet state does not mount the shared installment control',
  );
});

test('THE HISTORY · a refused ledger read never renders as zero payments', () => {
  const ROWS: PaymentLedgerRow[] = [
    { payment_id: 'p1', amount_php: '3350.00', paid_at: '2026-09-20', method: 'GCash', vendor_confirmed_at: '2026-09-20T03:00:00Z', is_deposit_record: true },
  ];
  const ok = paymentHistory({ rowsOrNull: ROWS, totalCentavos: 1675000, viewer: 'couple', otherName: 'Saysay' });
  assert.equal(ok.state, 'rows');
  if (ok.state !== 'rows') return;
  assert.equal(ok.summary, '₱3,350 paid of ₱16,750 · ₱13,400 remaining');
  assert.equal(ok.rows[0]!.paidOn, 'Sep 20, 2026');
  assert.equal(ok.rows[0]!.method, 'GCash');
  assert.equal(ok.rows[0]!.confirmed, true);
  assert.equal(ok.rows[0]!.statusLine, 'Confirmed by Saysay');
  assert.equal(ok.remainingCentavos, 1340000);

  const unconfirmed = paymentHistory({
    rowsOrNull: [{ ...ROWS[0]!, vendor_confirmed_at: null }],
    totalCentavos: 1675000,
    viewer: 'couple',
    otherName: 'Saysay',
  });
  assert.equal(unconfirmed.state === 'rows' && unconfirmed.rows[0]!.statusLine, "Awaiting Saysay's confirmation");

  const full = paymentHistory({ rowsOrNull: [{ ...ROWS[0]!, amount_php: 16750 }], totalCentavos: 1675000, viewer: 'couple', otherName: 'Saysay' });
  assert.equal(full.state === 'rows' && full.summary, '₱16,750 paid of ₱16,750 · paid in full');

  // 🔑 THE ONE THAT MATTERS. null = the read was REFUSED.
  const refused = paymentHistory({ rowsOrNull: null, totalCentavos: 1675000, viewer: 'couple', otherName: 'Saysay' });
  assert.equal(refused.state, 'unreadable');
  assert.doesNotMatch(refused.sentence, /no payments/i, 'a refused read claimed there were no payments');
  assert.match(refused.sentence, /couldn.t load/i);
  const refusedVendor = paymentHistory({ rowsOrNull: null, totalCentavos: null, viewer: 'vendor', otherName: 'the couple' });
  assert.equal(refusedVendor.state, 'unreadable');
  assert.doesNotMatch(refusedVendor.sentence, /no payments/i);

  // An EMPTY ledger is a different sentence, and it is allowed to say so.
  const none = paymentHistory({ rowsOrNull: [], totalCentavos: 1675000, viewer: 'couple', otherName: 'Saysay' });
  assert.equal(none.state, 'none');
  assert.notEqual(none.sentence, refused.sentence);

  // A total nobody stated is never invented, and ₱0 remaining is never printed.
  const noTotal = paymentHistory({ rowsOrNull: ROWS, totalCentavos: null, viewer: 'couple', otherName: 'Saysay' });
  assert.equal(noTotal.state === 'rows' && noTotal.summary, '₱3,350 paid');

  // A DATE is read off the string, never through `new Date(...)`.
  assert.equal(paidOnLabel('2026-09-20'), 'Sep 20, 2026');
  assert.equal(paidOnLabel(null), 'Date not recorded');
  assert.doesNotMatch(src('lib/payment-history.ts'), /new Date\(/, 'a date was built from a date string');
});

test('the reader keeps a refused ledger apart from an empty one, and stamps Manila', () => {
  const reader = src('lib/booked-money-step.server.ts');
  assert.match(reader, /today: manilaToday\(\)/, 'the step is decided against the server clock, not Manila');
  assert.match(reader, /import \{ manilaToday \} from '\.\/std-views'/);
  assert.match(reader, /let historyRows: PaymentLedgerRow\[\] \| null = null;/);
  // The ONLY assignment sits inside the else branch of `if (payErr)`.
  assert.equal(reader.split('historyRows = ').length - 1, 1, 'historyRows is written more than once');
  const err = reader.indexOf('if (payErr) {');
  const els = reader.indexOf('} else {', err);
  assert.ok(err > 0 && els > err && reader.indexOf('historyRows = ') > els, 'historyRows is written outside the success branch');
  // The columns the history needs are actually selected.
  for (const col of ['paid_at', 'method', 'payment_refused_at', 'vendor_confirmed_at']) {
    assert.ok(reader.includes(col), `the ledger select dropped ${col}`);
  }
  assert.match(reader, /rowsOrNull: historyRows/);
});

test('MOUNTS · the history renders on the couple\'s end and the supplier\'s', () => {
  // Couple: the "Amount to pay" card IS the Payments tab and the chat quote
  // card (which mounts it), so one mount covers both.
  const card = src('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx');
  assert.equal(card.split('<PaymentHistoryList').length - 1, 1, 'the couple history mount count changed');
  assert.match(card, /<PaymentHistoryList history=\{history\}/);
  const ws = src('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(ws, /history=\{bookedMoney\.history\}/, 'the Payments tab does not feed the history');
  const coupleThread = src('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(coupleThread, /history: bookedMoney\.history/, 'the chat quote card does not feed the history');

  // Supplier: the client page and the chat card.
  const clients = src('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.equal(clients.split('<PaymentHistoryList').length - 1, 1);
  assert.match(clients, /<PaymentHistoryList history=\{paymentHistory\}/);
  assert.match(clients, /paymentHistory=\{supplierPaymentHistory\}/);
  const stream = src('app/_components/chat-message-stream.tsx');
  assert.equal(stream.split('<PaymentHistoryList').length - 1, 1);
  assert.match(stream, /viewerRole === 'vendor' \? \(\s*<PaymentHistoryList history=\{bookedHistory\}/);
  const vendorThread = src('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(vendorThread, /bookedHistory=\{bookedMoney\.history\}/);

  // Both ends name the SAME state from the SAME helper.
  assert.match(clients, /supplierMoney\.step\.kind === 'installment_not_due_yet'/);
  assert.match(clients, /moneyStepLine\(supplierMoney\.step, 'vendor', 'the couple'\)/);
  assert.match(card, /moneyStepLine\(step, 'couple', vendorName\)/);
  // ONE shape, both ends: the component reads the shared history type, and
  // neither end re-derives money from raw ledger rows.
  const comp = src('app/_components/payment-history-list.tsx');
  assert.match(comp, /from '@\/lib\/payment-history'/);
  assert.doesNotMatch(comp, /from\('event_vendor_payments'\)/);
});

test('the history component cannot render "none" copy from an unreadable read', () => {
  const comp = src('app/_components/payment-history-list.tsx');
  const unreadable = comp.indexOf("history.state === 'unreadable'");
  const none = comp.indexOf("history.state === 'none'");
  assert.ok(unreadable > 0 && none > unreadable, 'the unreadable branch no longer returns before the empty one');
  // Every user-facing sentence comes from the shaped history, never from copy
  // typed into the component — so the two states cannot share a string.
  assert.doesNotMatch(comp, /No payments|no payments/, 'the component grew its own empty-state copy');
  assert.match(comp, /\{history\.sentence\}/);
});
