/**
 * A PAYMENT CAN BE REFUSED TOO — the app half of H4 (owner 2026-09-11, "one
 * path for every payment"). The database half is proven by behaviour in
 * tests/db/a-payment-can-be-refused-too.db.test.ts.
 *
 *   1. ONE READ — the deposit's ledger row reports the BOOKING's refusal; an
 *      installment reports its own. A surface that read the deposit row's own
 *      (always-empty) columns would say "no answer" beside a refused deposit.
 *   2. THE COUPLE'S LINE READS THE SUPPLIER'S WORDS (H4 "done means"), then
 *      Setnayan's ruling — and a refused payment asks NEITHER side anything.
 *   3. A REFUSED INSTALLMENT IS NOT "PENDING" — no "awaiting your
 *      confirmation" for money the supplier said never came.
 *   4. THE PINS — the deposit writers' two notes are exactly the ones the
 *      database stamps; the admin queue and its badge use one definition of
 *      "open"; the referee's function is called through the admin's session.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { stripSqlComments } from '@/lib/security/events-column-privileges';
import { awaitsTheSupplier, isOpenDispute, readPaymentDispute } from '@/lib/payment-refusal';
import { buildThreadDecisions, type PaymentFact, type ThreadDecisionFacts } from '@/lib/thread-decisions';
import { computePlanRollup, computeStepper } from '@/lib/vendor-service-payment-schedules';

const WEB = join(import.meta.dirname, '..');
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const REFUSED = '2026-09-06T02:00:00.000Z';
const SETTLED = '2026-09-08T02:00:00.000Z';

/* ── 1 · ONE READ ───────────────────────────────────────────────────────── */

test('an installment reports its own refusal; the deposit row reports the booking\'s', () => {
  const installment = readPaymentDispute(
    { is_deposit_record: false, payment_refused_at: REFUSED, payment_refusal_reason: ' nothing in BPI ' },
    // The booking's deposit refusal is NOT this payment's — ignored.
    { deposit_declined_at: SETTLED, deposit_decline_reason: 'the deposit' },
  );
  assert.deepEqual(installment, { refusedAtMs: Date.parse(REFUSED), reason: 'nothing in BPI', settlement: null });

  const depositRow = readPaymentDispute(
    // A deposit record's own columns are always empty — the CHECK forbids them.
    { is_deposit_record: true, payment_refused_at: null },
    { deposit_declined_at: REFUSED, deposit_decline_reason: 'no GCash from them' },
  );
  assert.deepEqual(depositRow, { refusedAtMs: Date.parse(REFUSED), reason: 'no GCash from them', settlement: null });
});

test('a settlement is read from the same side as the refusal, and "the payment stands" outlives it', () => {
  const stood = readPaymentDispute(
    { is_deposit_record: true },
    {
      deposit_declined_at: null,
      deposit_dispute_settled_at: SETTLED,
      deposit_dispute_outcome: 'payment_stands',
      deposit_dispute_note: 'bank shows it',
    },
  );
  assert.deepEqual(stood, {
    refusedAtMs: null,
    reason: null,
    settlement: { outcome: 'payment_stands', note: 'bank shows it', atMs: Date.parse(SETTLED) },
  });
  assert.equal(isOpenDispute(stood), false);

  const notReceived = readPaymentDispute(
    {
      payment_refused_at: REFUSED,
      payment_dispute_settled_at: SETTLED,
      payment_dispute_outcome: 'not_received',
      payment_dispute_note: null,
    },
    null,
  );
  assert.equal(notReceived?.settlement?.outcome, 'not_received');
  assert.equal(isOpenDispute(notReceived), false);
  assert.equal(isOpenDispute(readPaymentDispute({ payment_refused_at: REFUSED }, null)), true);
});

test('no refusal and no settlement is null; an unknown outcome is not a settlement', () => {
  assert.equal(readPaymentDispute({}, null), null);
  assert.equal(
    readPaymentDispute({ payment_dispute_settled_at: SETTLED, payment_dispute_outcome: 'split' }, null),
    null,
  );
});

test('a refused payment no longer awaits the supplier', () => {
  assert.equal(awaitsTheSupplier({ dispute: null }), true);
  assert.equal(awaitsTheSupplier({}), true);
  assert.equal(awaitsTheSupplier({ dispute: readPaymentDispute({ payment_refused_at: REFUSED }, null) }), false);
});

/* ── 2 · THE DECISIONS LINE ─────────────────────────────────────────────── */

const NOW = Date.parse('2026-09-09T04:00:00.000Z');
const pay = (over: Partial<PaymentFact> = {}): PaymentFact => ({
  paymentId: 'p1',
  loggedAtMs: Date.parse('2026-09-05T08:30:00.000Z'),
  amountPhp: 25_000,
  method: 'BPI transfer',
  label: 'Second installment',
  confirmedAtMs: null,
  ofTotalPhp: null,
  ...over,
});
const facts = (viewer: 'couple' | 'vendor', p: PaymentFact): ThreadDecisionFacts => ({
  viewer,
  nowMs: NOW,
  quotes: [],
  meetings: [],
  adjustments: [],
  payments: [p],
  guestCounts: [],
});
const only = (viewer: 'couple' | 'vendor', p: PaymentFact) => {
  const e = buildThreadDecisions(facts(viewer, p));
  assert.equal(e.length, 1);
  return e[0]!;
};

test('unanswered: the supplier is asked, and the reply carries both answers\' payment id', () => {
  const v = only('vendor', pay());
  assert.equal(v.now.needsYou, true);
  assert.deepEqual(v.reply, { kind: 'payment', paymentId: 'p1' });
  assert.equal(only('couple', pay()).now.needsYou, false);
});

test('refused: the COUPLE\'s line quotes the supplier, and NEITHER side is asked anything', () => {
  const dispute = readPaymentDispute({ payment_refused_at: REFUSED, payment_refusal_reason: 'Nothing in BPI yet' }, null);
  const c = only('couple', pay({ dispute }));
  assert.equal(c.now.text, 'They said it never reached them · “Nothing in BPI yet” · Setnayan is checking');
  assert.equal(c.now.needsYou, false);
  assert.equal(c.reply, null);
  const v = only('vendor', pay({ dispute }));
  assert.equal(v.now.text, 'You said it never reached you · “Nothing in BPI yet” · Setnayan is checking');
  assert.equal(v.now.needsYou, false, 'answered — the buttons go away by themselves');
  assert.equal(v.reply, null);
});

test('ruled "did not arrive": both read Setnayan\'s note; the couple is told they can send it again', () => {
  const dispute = readPaymentDispute(
    {
      payment_refused_at: REFUSED,
      payment_refusal_reason: 'x',
      payment_dispute_settled_at: SETTLED,
      payment_dispute_outcome: 'not_received',
      payment_dispute_note: 'No transfer on 5 Sep',
    },
    null,
  );
  assert.equal(
    only('couple', pay({ dispute })).now.text,
    'Setnayan found it didn’t reach them · “No transfer on 5 Sep” · you can send it again',
  );
  assert.equal(only('vendor', pay({ dispute })).now.text, 'Setnayan found it didn’t reach you · “No transfer on 5 Sep”');
  assert.equal(only('couple', pay({ dispute })).now.needsYou, false);
});

test('ruled "stands": the line says Setnayan confirmed it, not the supplier', () => {
  const at = Date.parse(SETTLED);
  const dispute = readPaymentDispute(
    { payment_dispute_settled_at: SETTLED, payment_dispute_outcome: 'payment_stands', payment_dispute_note: 'ok' },
    null,
  );
  assert.match(only('couple', pay({ confirmedAtMs: at, dispute })).now.text, /^Setnayan confirmed it reached them · /);
  assert.match(only('vendor', pay({ confirmedAtMs: at, dispute })).now.text, /^Setnayan confirmed it reached you · /);
  assert.match(only('couple', pay({ confirmedAtMs: at })).now.text, /^Confirmed received · /);
});

/* ── 3 · THE STEPPER ────────────────────────────────────────────────────── */

test('a refused installment reads "due", not "pending" — and confirming it makes it "paid"', () => {
  const plan = [
    { seq: 1, label: 'Downpayment', amount_php: 50_000, due_date: null },
    { seq: 2, label: 'Second', amount_php: 25_000, due_date: null },
  ] as unknown as Parameters<typeof computeStepper>[0];
  const refused = computeStepper(plan, [{ schedule_instance_seq: 2, vendor_confirmed: false, refused: true }]);
  assert.equal(refused[1]!.state, 'due');
  assert.equal(computePlanRollup(refused).pending, 0, 'nothing "awaiting your confirmation"');
  assert.equal(
    computeStepper(plan, [{ schedule_instance_seq: 2, vendor_confirmed: false }])[1]!.state,
    'pending',
    'an unanswered payment is still pending',
  );
  assert.equal(
    computeStepper(plan, [
      { schedule_instance_seq: 2, vendor_confirmed: false, refused: true },
      { schedule_instance_seq: 2, vendor_confirmed: true },
    ])[1]!.state,
    'paid',
  );
});

/* ── 4 · THE PINS ───────────────────────────────────────────────────────── */

/** The notes the deposit writers put on the ledger row, read from the source. */
function depositWriterNotes(src: string): string[] {
  return [...src.matchAll(/from\('event_vendor_payments'\)\.insert\(\{[\s\S]*?notes:\s*'([^']+)'/g)]
    .map((m) => m[1]!)
    .filter((n) => n.includes('awaiting vendor confirmation'));
}

/** The notes the database stamps as the deposit record, from the latest definition. */
function stampedNotes(): string[] {
  const create = /CREATE (?:OR REPLACE )?FUNCTION public\.stamp_event_vendor_payment_deposit_record\s*\(/;
  const latest = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => stripSqlComments(readFileSync(join(MIGRATIONS, f), 'utf8')))
    .filter((sql) => create.test(sql))
    .at(-1);
  assert.ok(latest, 'no migration defines the deposit-record stamp');
  const body = latest.slice(latest.search(create));
  // The notes themselves contain ")", so the list is read as quoted strings.
  const list = /NEW\.notes IN \(((?:\s*'[^']*'\s*,?)+)\)/.exec(body);
  assert.ok(list, 'the stamp no longer matches notes with IN (…) — re-derive this pin');
  return [...list[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

function notesPinHolds(actionsSrc: string): string | null {
  const written = depositWriterNotes(actionsSrc).sort();
  const stamped = stampedNotes().sort();
  if (written.length !== 2) return `expected the two deposit writers, found ${written.length}`;
  return JSON.stringify(written) === JSON.stringify(stamped)
    ? null
    : `the deposit writers write ${JSON.stringify(written)} but the database stamps ${JSON.stringify(stamped)}`;
}

const ACTIONS = read('app/dashboard/[eventId]/vendors/actions.ts');

test('the deposit writers\' notes are exactly the ones the database recognises', () => {
  // If this fails, a changed note would silently stop marking the deposit's
  // row — its "Not received" would open an installment dispute beside the
  // deposit's, and confirming it would no longer acknowledge the deposit.
  assert.equal(notesPinHolds(ACTIONS), null);
});

test('MUTATION · the pin fires when a writer\'s note drifts', () => {
  const drifted = ACTIONS.replace("'Deposit (date held · awaiting vendor confirmation)'", "'Deposit (held · awaiting vendor confirmation)'");
  assert.notEqual(drifted, ACTIONS, 'mutation did not apply');
  assert.notEqual(notesPinHolds(drifted), null);
});

test('the disputes badge and the disputes page share one definition of "open" for installments', () => {
  const OPEN = [/\.not\('payment_refused_at', 'is', null\)/, /\.is\('payment_dispute_settled_at', null\)/];
  for (const src of [read('lib/admin/queue-counts.ts'), read('app/admin/disputes/_components/payment-disputes-section.tsx')]) {
    for (const re of OPEN) assert.match(src, re);
  }
});

test('the referee\'s function runs through the admin\'s own session, never the service client', () => {
  const src = read('app/admin/disputes/actions.ts');
  const body = src.slice(src.indexOf('export async function settlePaymentDispute('));
  assert.match(body, /const sessionDb = await createClient\(\);\s*const \{ data, error \} = await sessionDb\.rpc\('settle_vendor_payment_dispute'/);
  assert.doesNotMatch(body, /admin\.rpc\('settle_vendor_payment_dispute'/);
});
