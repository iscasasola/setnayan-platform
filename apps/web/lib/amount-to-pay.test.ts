/**
 * amount-to-pay.test.ts — one visible payment door, the next money step on
 * every surface, and a revised quote that keeps its schedule (2026-09-20,
 * follow-ups to #5717 + the owner's live points).
 *
 * Owner, live: "i think it is better to say amount to pay. since this is not
 * just for the downpayment but also for the next payments" · "i do not see the
 * confirmation here and the payment action?" (the booked chat quote card).
 *
 * The decisions are EXECUTED here against the pure rules in
 * lib/accepted-quote-terms.ts and lib/quote-revision-seed.ts. The wiring checks
 * at the end pin only that each action/surface consults those rules, and that
 * the chat card MOUNTS the existing controls rather than growing its own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import {
  acceptedQuoteTerms,
  decideDepositRecord,
  decideLogPayment,
  moneyStep,
  moneyStepLine,
  nextQuoteInstallment,
  paymentDoor,
  quoteNoteShown,
  DEFAULT_QUOTE_NOTE_TAIL,
  type AcceptedQuoteRow,
  type MoneyStepInput,
} from './accepted-quote-terms';
import {
  seedQuoteRevision,
  seedScheduleFromStored,
  QUOTE_REVISION_SELECT,
} from './quote-revision-seed';
import { resolveSchedule } from './proposal-payment-schedule';
import { quoteCardState } from './quote-card-state';

/** The live quote S89J-EK6NWM69T1 (₱3,350 on lock, ₱13,400 fourteen days before). */
const LIVE: AcceptedQuoteRow = {
  public_id: 'S89J-EK6NWM69T1',
  status: 'accepted',
  total_centavos: 1675000,
  line_items: [
    { label: 'Cover Songs', detail: null, amount_centavos: 1500000 },
    { label: 'Crew meal', detail: '5 crew × ₱350/head', amount_centavos: 175000 },
  ],
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
const TERMS = acceptedQuoteTerms([LIVE], '2027-03-13')!;

// ─────────────────────────────────────────────────────────────────────────────
// 1 · TWO DOORS CANNOT RECORD ONE PAYMENT AS TWO DEPOSITS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A booking's ledger, driven ONLY by the two actions' own decisions — the way
 * `logPayment` and `recordDeposit` act on them. A deposit row is what the
 * database stamps `is_deposit_record`: the deposit door's insert.
 */
function simulate(isMarketplaceVendor: boolean, doors: ('log' | 'deposit')[]) {
  let depositRecordedAt: string | null = null;
  const rows: { door: 'log' | 'deposit'; isDeposit: boolean }[] = [];
  const refused: string[] = [];
  for (const door of doors) {
    if (door === 'log') {
      const d = decideLogPayment({ isMarketplaceVendor, depositRecordedAt, paymentsOnLedger: rows.length });
      if (!d.ok) { refused.push('log'); continue; }
      rows.push({ door, isDeposit: false });
    } else {
      const d = decideDepositRecord({ depositRecordedAt, paymentsOnLedger: rows.length, paymentsLoggedPhp: rows.length * 3350 });
      if (!d.ok) { refused.push('deposit'); continue; }
      if (d.insertLedgerRow) rows.push({ door, isDeposit: true });
      depositRecordedAt = depositRecordedAt ?? '2026-09-20T00:00:00Z';
    }
  }
  return { rows, refused };
}

test('a first payment cannot be recorded through both doors as two deposits — every order', () => {
  // Setnayan supplier: the log refuses a FIRST payment, so the money lands once, as the deposit.
  const a = simulate(true, ['log', 'deposit']);
  assert.deepEqual(a.refused, ['log']);
  assert.equal(a.rows.length, 1);
  assert.equal(a.rows.filter((r) => r.isDeposit).length, 1);

  // Deposit first, then a later installment through the log: two DIFFERENT payments, one deposit.
  const b = simulate(true, ['deposit', 'log']);
  assert.deepEqual(b.refused, []);
  assert.equal(b.rows.filter((r) => r.isDeposit).length, 1);
  assert.equal(b.rows.length, 2);

  // The deposit door twice (a re-send, a double-submit): still one row.
  const c = simulate(true, ['deposit', 'deposit']);
  assert.equal(c.rows.length, 1);

  // Off-platform supplier: the log stays open, and a deposit on top of logged money is refused.
  const d = simulate(false, ['log', 'deposit']);
  assert.deepEqual(d.refused, ['deposit']);
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows.filter((r) => r.isDeposit).length, 0);

  // Exhaustive: no sequence of up to four presses ever yields two deposit rows,
  // or a deposit recorded on top of money already logged before it.
  const presses = ['log', 'deposit'] as const;
  const seqs: ('log' | 'deposit')[][] = [[]];
  for (let n = 0; n < 4; n++) {
    for (const s of [...seqs]) for (const p of presses) seqs.push([...s, p]);
  }
  for (const mkt of [true, false]) {
    for (const s of seqs) {
      const { rows } = simulate(mkt, s);
      assert.ok(rows.filter((r) => r.isDeposit).length <= 1, `${mkt} ${s.join(',')}`);
      const firstDeposit = rows.findIndex((r) => r.isDeposit);
      assert.ok(firstDeposit <= 0, `a deposit landed after logged money: ${mkt} ${s.join(',')}`);
    }
  }
});

test('a refused read refuses both doors rather than guessing', () => {
  assert.equal(decideLogPayment({ isMarketplaceVendor: true, depositRecordedAt: undefined, paymentsOnLedger: 0 }).ok, false);
  assert.equal(decideLogPayment({ isMarketplaceVendor: true, depositRecordedAt: null, paymentsOnLedger: null }).ok, false);
  assert.equal(decideDepositRecord({ depositRecordedAt: null, paymentsOnLedger: null }).ok, false);
  // An already-recorded deposit needs no ledger read: a re-send adds no row.
  assert.deepEqual(decideDepositRecord({ depositRecordedAt: 'x', paymentsOnLedger: null }), { ok: true, insertLedgerRow: false });
});

test('the refusal tells the couple where the money goes', () => {
  const log = decideLogPayment({ isMarketplaceVendor: true, depositRecordedAt: null, paymentsOnLedger: 0, vendorName: 'Saysay' });
  assert.equal(log.ok, false);
  assert.match(!log.ok ? log.message : '', /Amount to pay/);
  const dep = decideDepositRecord({ depositRecordedAt: null, paymentsOnLedger: 1, paymentsLoggedPhp: 3350, vendorName: 'Saysay' });
  assert.equal(dep.ok, false);
  assert.match(!dep.ok ? dep.message : '', /₱3,350.*twice/);
});

test('the itemization log points a Setnayan supplier at "Amount to pay"', () => {
  assert.equal(paymentDoor({ isMarketplaceVendor: false, depositRecordedAt: null }), 'log');
  assert.equal(paymentDoor({ isMarketplaceVendor: true, depositRecordedAt: null }), 'amount_to_pay');
  assert.equal(paymentDoor({ isMarketplaceVendor: true, depositRecordedAt: 'x' }), 'amount_to_pay');
  assert.equal(paymentDoor({ isMarketplaceVendor: true, depositRecordedAt: undefined }), 'unknown');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · THE NEXT MONEY STEP — one answer for the Payments tab, chat, proposal page
// ─────────────────────────────────────────────────────────────────────────────

const base: MoneyStepInput = {
  terms: TERMS,
  booked: true,
  deposit: { recordedAt: null, acknowledgedAt: null, declinedAt: null },
  ledger: { count: 0, paidCentavos: 0, recordedFirstCentavos: null },
};

test('booked, nothing paid → the first payment, at the requested minimum', () => {
  assert.deepEqual(moneyStep({ ...base, booked: false }), { kind: 'not_booked' });
  const s = moneyStep(base);
  assert.equal(s.kind, 'first_payment_due');
  if (s.kind !== 'first_payment_due') return;
  assert.equal(s.action, 'record_deposit');
  assert.equal(s.amountCentavos, 335000);
  assert.equal(s.minimumCentavos, 335000);
  assert.equal(s.label, 'First payment · locks the date');
  assert.equal(moneyStepLine(s, 'couple', 'Saysay'), 'First payment ₱3,350 — due now');
  assert.equal(moneyStepLine(s, 'vendor', 'the couple'), 'Waiting for the ₱3,350 first payment');
});

test('recorded, unconfirmed → waiting on the supplier; nothing more to pay yet', () => {
  const s = moneyStep({
    ...base,
    deposit: { recordedAt: 't', acknowledgedAt: null, declinedAt: null },
    ledger: { count: 1, paidCentavos: 335000, recordedFirstCentavos: 335000 },
  });
  assert.deepEqual(s, { kind: 'first_payment_sent', recordedCentavos: 335000 });
  assert.equal(moneyStepLine(s, 'couple', 'Saysay'), '₱3,350 recorded — waiting for Saysay to confirm');
  assert.match(moneyStepLine(s, 'vendor', 'the couple')!, /^₱3,350 recorded by the couple/);
});

test('confirmed → the final balance, named and dated, prefilled but never a minimum', () => {
  const s = moneyStep({
    ...base,
    deposit: { recordedAt: 't', acknowledgedAt: 't', declinedAt: null },
    ledger: { count: 1, paidCentavos: 335000, recordedFirstCentavos: 335000 },
  });
  assert.equal(s.kind, 'installment_due');
  if (s.kind !== 'installment_due') return;
  assert.equal(s.action, 'log_payment');
  assert.equal(s.amountCentavos, 1340000);
  assert.equal(s.label, 'Final balance · due Feb 27, 2027');
  assert.ok(!('minimumCentavos' in s), 'a later installment carries no minimum');
  assert.equal(
    moneyStepLine(s, 'couple', 'Saysay'),
    'First payment confirmed. Amount to pay: Final balance · due Feb 27, 2027 · ₱13,400',
  );
});

test('a partial payment leaves the rest of that installment due; all paid is paid in full', () => {
  const part = moneyStep({
    ...base,
    deposit: { recordedAt: 't', acknowledgedAt: 't', declinedAt: null },
    ledger: { count: 2, paidCentavos: 335000 + 500000, recordedFirstCentavos: 335000 },
  });
  assert.equal(part.kind === 'installment_due' ? part.amountCentavos : -1, 840000);
  const done = moneyStep({
    ...base,
    deposit: { recordedAt: 't', acknowledgedAt: 't', declinedAt: null },
    ledger: { count: 2, paidCentavos: 1675000, recordedFirstCentavos: 335000 },
  });
  assert.deepEqual(done, { kind: 'paid_in_full', paidCentavos: 1675000 });
  assert.equal(nextQuoteInstallment(TERMS, null), null, 'never prefill from an unread ledger');
});

test('a refused first payment reopens it; unreadable state is unknown, never "due"', () => {
  const s = moneyStep({ ...base, deposit: { recordedAt: 't', acknowledgedAt: null, declinedAt: 't' } });
  assert.equal(s.kind === 'first_payment_due' && s.resend, true);
  assert.deepEqual(moneyStep({ ...base, deposit: undefined }), { kind: 'unknown' });
  assert.deepEqual(moneyStep({ ...base, ledger: null }), { kind: 'unknown' });
});

test('money logged before any deposit → the next installment, never a second first payment', () => {
  const s = moneyStep({ ...base, ledger: { count: 1, paidCentavos: 335000, recordedFirstCentavos: null } });
  assert.equal(s.kind, 'installment_due');
  assert.equal(s.kind === 'installment_due' ? s.amountCentavos : -1, 1340000);
});

test('the booked quote card no longer reads "Accepted · Accepted · booked"', () => {
  const st = quoteCardState({ status: 'accepted', isLatest: true, viewer: 'couple', handshake: 'locked' });
  assert.equal(st.note, 'Accepted · booked');
  // The price line drops the status when the note already opens with it.
  const stream = src('app/_components/chat-message-stream.tsx');
  assert.match(stream, /\{quoteState\.note\?\.startsWith\(statusLabelOf\(card\.status\)\)\s*\? null\s*: ` · \$\{statusLabelOf\(card\.status\)\}`\}/);
});

test('a booked quote drops the default note\'s "nothing is booked" sentence, and only that', () => {
  const def = `Quote from Saysay. Review the line items below. ${DEFAULT_QUOTE_NOTE_TAIL}`;
  assert.equal(quoteNoteShown(def, false), def);
  assert.equal(quoteNoteShown(def, true), 'Quote from Saysay. Review the line items below.');
  assert.equal(quoteNoteShown('Our own words.', true), 'Our own words.');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · A REVISED QUOTE KEEPS THE SUPPLIER'S SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────

test('"Update this quote" seeds the stored schedule, and it re-resolves to the same amounts', () => {
  // A supplier's OWN terms: ₱5,000 on lock, 50% thirty days out, balance on the day.
  const stored = resolveSchedule({
    manual: [
      { label: 'Reservation', kind: 'fixed', amountPhp: 5000, percent: null, due: 'on_lock', offsetDays: 0 },
      { label: 'Second payment', kind: 'percent', amountPhp: null, percent: 50, due: 'before_event', offsetDays: 30 },
    ],
    autoBalance: { label: 'On the day', due: 'on_event', offsetDays: 0 },
    baseCentavos: 4000000,
    creditCentavos: 0,
  });
  const seed = seedQuoteRevision({
    public_id: 'S89J-X', title: 'Q', total_centavos: 4000000, status: 'accepted', sent_at: null,
    rendered_body: '', valid_until: null, line_items: [], payment_method_ids: [],
    payment_schedule: stored,
  });
  assert.ok(seed.schedule, 'the revision dropped the schedule');
  const again = resolveSchedule({
    manual: seed.schedule!.manual,
    autoBalance: seed.schedule!.autoBalance!,
    baseCentavos: 4000000,
    creditCentavos: 0,
  });
  assert.deepEqual(
    again.installments.map((r) => [r.label, r.amount_centavos, r.due, r.offset_days]),
    stored.installments.map((r) => [r.label, r.amount_centavos, r.due, r.offset_days]),
  );
  // The live quote round-trips too (20% + auto balance).
  assert.equal(seedScheduleFromStored(LIVE.payment_schedule)?.manual[0]?.percent, 20);
  assert.equal(seedScheduleFromStored({}), null);
  assert.equal(seedScheduleFromStored(null), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · WIRING — each action consults its rule; each surface mounts, never re-implements
// ─────────────────────────────────────────────────────────────────────────────

const WEB = path.join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8'));
function fnBody(file: string, name: string): string {
  const s = src(file);
  const at = s.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} is gone from ${file}`);
  const next = s.indexOf('\nexport ', at + 10);
  return s.slice(at, next < 0 ? undefined : next);
}

test('logPayment decides the door before it inserts', () => {
  const body = fnBody('app/dashboard/[eventId]/budget/actions.ts', 'logPayment');
  const decide = body.indexOf('decideLogPayment(');
  const insert = body.indexOf(".from('event_vendor_payments').insert(");
  assert.ok(decide > 0 && insert > 0 && decide < insert, 'logPayment inserts without deciding');
  assert.match(body, /if \(!logDecision\.ok\) throw new Error\(logDecision\.message\)/);
  // The Amount-to-pay later-installment action is logPayment, not a second writer.
  const later = fnBody('app/dashboard/[eventId]/budget/actions.ts', 'logScheduledPayment');
  assert.match(later, /await logPayment\(formData\)/);
  assert.doesNotMatch(later, /\.insert\(/);
});

test('recordDeposit decides the record before any upload or write, and inserts only on its word', () => {
  const body = fnBody('app/dashboard/[eventId]/vendors/actions.ts', 'recordDeposit');
  const decide = body.indexOf('decideDepositRecord(');
  assert.ok(decide > 0, 'recordDeposit no longer asks decideDepositRecord');
  assert.ok(decide < body.indexOf('uploadDepositProof('), 'decided after the upload');
  assert.ok(decide < body.indexOf("from('event_vendors')\n    .update(") || decide < body.indexOf('.update(update)'), 'decided after the marker write');
  assert.match(body, /if \(depositRecord\.insertLedgerRow\) \{/);
});

test('the lock downpayment is held to the same minimum, before the lock commits', () => {
  const body = fnBody('app/dashboard/[eventId]/vendors/actions.ts', 'finalizeVendor');
  const parse = body.indexOf("dpAmountPhp = parseMoney(formData.get('deposit_php'))");
  const decide = body.indexOf('decideDepositAmount(', parse);
  const gate = body.indexOf('const downpaymentGate');
  assert.ok(parse > 0 && decide > parse && decide < gate, 'the lock downpayment skips decideDepositAmount');
  assert.match(body, /if \(!dpDecision\.ok\) \{\s*return \{ status: 'error', message: dpDecision\.message \}/);
  assert.match(body, /minimumAmountPhp: minimumPhp/);
});

test('exactly one writer stamps a deposit from the couple\'s workspace, and one from the lock', () => {
  // The two notes the database treats as THE deposit (stamp_event_vendor_payment_deposit_record).
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = path.join(dir, n);
      if (n === 'node_modules' || n === '.next') continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) files.push(p);
    }
  };
  walk(path.join(WEB, 'app'));
  walk(path.join(WEB, 'lib'));
  const count = (needle: string) =>
    files.filter((f) => stripComments(readFileSync(f, 'utf8')).includes(needle)).map((f) => path.relative(WEB, f));
  const dep = count("'Deposit (date held · awaiting vendor confirmation)'");
  const lock = count("'Downpayment (lock · awaiting vendor confirmation)'");
  assert.deepEqual(dep, ['app/dashboard/[eventId]/vendors/actions.ts'], `deposit writers: ${dep.join(', ')}`);
  assert.deepEqual(lock, ['app/dashboard/[eventId]/vendors/actions.ts'], `lock writers: ${lock.join(', ')}`);
  const s = src('app/dashboard/[eventId]/vendors/actions.ts');
  assert.equal(s.split("'Deposit (date held · awaiting vendor confirmation)'").length - 1, 1);
});

test('the Amount-to-pay card posts the two existing actions and nothing else', () => {
  const card = src('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx');
  assert.match(card, /recordDeposit\(form\)/);
  assert.match(card, /logScheduledPayment\(form\)/);
  assert.doesNotMatch(card, /from\('event_vendor_payments'\)/);
  assert.match(card, /Amount to pay/);
  assert.doesNotMatch(card, />\s*Deposit reservation\s*</, 'the user-facing label still says deposit');
});

test('both chat cards MOUNT the existing controls on a booked quote', () => {
  const stream = src('app/_components/chat-message-stream.tsx');
  const block = stream.slice(stream.indexOf("bookedStep.kind !== 'not_booked'"));
  assert.ok(block.length > 0, 'the money step block is gone');
  const end = block.indexOf('</>');
  const money = block.slice(0, end);
  assert.match(money, /moneyStepLine\(bookedStep, viewerRole, counterpartyLabel\)/);
  assert.match(money, /<DepositReservation \{\.\.\.couplePay\} step=\{bookedStep\} compact \/>/);
  assert.match(money, /<form action=\{supplierReplyActions\.confirmPayment\}>/);
  assert.match(money, /name="payment_id" value=\{supplierFirstPaymentRowId\}/);
  assert.doesNotMatch(money, /recordDeposit|logPayment|\.rpc\(/, 'the card grew its own writer');

  const couple = src('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(couple, /readBookedMoney\(supabase,/);
  assert.match(couple, /bookedStep=\{bookedMoney\.step\}\s*couplePay=\{couplePay\}/);
  const vendor = src('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(vendor, /confirmPayment: confirmVendorPayment/);
  assert.match(vendor, /bookedStep=\{bookedMoney\.step\}\s*supplierFirstPaymentRowId=\{bookedMoney\.firstPaymentRowId\}/);
});

test('the itemization log is replaced, not duplicated, for a Setnayan supplier', () => {
  const card = src('app/dashboard/[eventId]/_components/vendor-itemization-card.tsx');
  const door = card.indexOf("paymentDoor === 'amount_to_pay' ?");
  const log = card.indexOf('action={logPayment}');
  const unknown = card.indexOf("paymentDoor === 'unknown' ?");
  assert.ok(door > 0 && unknown > door && log > unknown, 'the log form is not behind the door');
  const budget = src('app/dashboard/[eventId]/budget/page.tsx');
  assert.match(budget, /acceptedQuoteLines=\{quoteByVendor\.get\(s\.vendor\.vendor_id\)\?\.lines \?\? null\}/);
  assert.match(budget, /paymentDoor=\{doorByVendor\.get\(s\.vendor\.vendor_id\) \?\? 'log'\}/);
  const ws = src('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(ws, /paymentDoor=\{itemizationDoor\}/);
  assert.match(ws, /step=\{bookedMoney\.step\}/);
});

test('the revision seed reads the schedule, and the builder starts from it', () => {
  const page = src('app/vendor-dashboard/messages/[threadId]/page.tsx');
  // The column list moved into a CONSTANT (2026-09-22) so a test can execute it
  // rather than grep a byte window out of a server component. Asserting the
  // value itself is strictly stronger: it cannot pass because some other part
  // of the query happened to fall inside the window.
  assert.match(QUOTE_REVISION_SELECT, /payment_schedule/, 'the revision read stopped asking for the schedule');
  assert.match(
    page,
    /\.select\(QUOTE_REVISION_SELECT\)/,
    'and the page must still read with the shared list, or a column can be dropped unnoticed',
  );
  const maker = src('app/_components/proposal-maker.tsx');
  assert.match(maker, /revision\?\.schedule && revision\.schedule\.manual\.length > 0/);
  assert.match(maker, /revision\?\.schedule\?\.autoBalance \?\?/);
});

test('the booked proposal page says so, before it would offer a lock', () => {
  const page = src('app/proposals/[publicId]/page.tsx');
  assert.match(page, /\{bookedMoney \? \(/);
  assert.ok(page.indexOf('{bookedMoney ? (') < page.indexOf('lockDoorHref ? ('));
  assert.match(page, /\{noteShown \|\| 'No proposal text\.'\}/);
  const send = src('lib/proposal-send.ts');
  assert.match(send, /\$\{DEFAULT_QUOTE_NOTE_TAIL\}/, 'the default note and its booked rule drifted apart');
});
