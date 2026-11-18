/**
 * the-client-tabs-say-what-is-true.test.ts — 🗂 THE PICKED CLIENT'S TABS, ON A DEBUT (owner screenshots, 17 Nov 2026,
 * event "Debut 18": booked May 12 2027, first payment due Nov 13 — past — and nothing paid).
 *
 *   PAYMENT  1 · the Next line says "Was due" exactly when the plan row under it does (one rule: the row's badge);
 *            2 · the asks panel never says "Nothing outstanding" — it says no ask was SENT, and what the plan says is due;
 *            3 · the form is filled from the plan's next payment, never an invented example figure.
 *   FORMS    4 · the client is named by the event kind's own word (`organizerNoun` → "celebrant" on a debut);
 *            5 · the "no questions yet" line is drawn once, not three times;  6 · room under the floating buttons.
 *   SCHEDULE 7 · a `setnayan_booking` block is the booked day (green dot, full) — not a closure — and the box grid's
 *              seat-green is named "Free" in the legend;  8 · no "Live" badge / "Up next" before the event's day.
 *   FILES    9 · no bare "—" above a file's day.          REPORT 10 · the note box names the client by event kind.
 *   NOTICES  the returning-client line names the event kind; "Wanda & Indigo have asked you" agrees in number.
 *
 * SABOTAGE (each seen red once, then restored): `late` hard-coded false → the Was-due test red; "Nothing outstanding"
 * put back → the asks test red; the setnayan_booking branch removed → the calendar test red (May 12 struck, no dot);
 * `ahead ? null :` dropped from the card's Live badge → the run-of-show test red; `agree(` swapped for a literal "has"
 * in vendors/actions.ts → the notices test red; one `quietWhenEmpty` dropped from forms.tsx → the Forms test red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { clientPaymentView } from '@/lib/client-payment-view';
import { buildCustomerCalendarMonth } from '@/lib/vendor-customers';
import { dayStateOf } from '@/lib/vendor-dates';
import { agree, clientNounOf, CLIENT_NOUN_FALLBACK, RETURNING_CLIENT_LEAD, returningClientLine } from '@/lib/client-words';
import type { StepperInstallment } from '@/lib/vendor-service-payment-schedules';
import type { BookingMoney } from '@/lib/vendor-cashflow';

const src = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
const C = 'app/vendor-dashboard/clients/[eventId]';

const EMPTY_LEDGER = { rows: [], expectedPhp: 0, receivedPhp: 0 } as unknown as BookingMoney;
const step = (seq: number, label: string, amount: number, due: string, state: StepperInstallment['state']) =>
  ({ seq, label, amount_php: amount, due_date: due, state, amount_kind: 'fixed', percent_bps: null }) as unknown as StepperInstallment;

test('1 · the Next line and the plan row agree on "Was due"', () => {
  const view = clientPaymentView({
    steps: [step(1, 'First payment', 5350, '2026-11-13', 'due'), step(2, 'Balance', 21400, '2027-04-28', 'due')],
    clearedAt: null,
    ledgerMoney: EMPTY_LEDGER,
    ledgerUnreadable: false,
    today: '2026-11-17',
  });
  assert.ok(view.next && view.plan);
  assert.equal(view.next.late, true);
  assert.equal(view.next.dueText, view.plan.rows[0]!.badge.text, 'the Next line prints the row badge words');
  assert.match(view.next.dueText ?? '', /^Was due /);
  const ahead = clientPaymentView({ steps: [step(1, 'First payment', 5350, '2026-11-13', 'due')], clearedAt: null, ledgerMoney: EMPTY_LEDGER, ledgerUnreadable: false, today: '2026-11-01' });
  assert.equal(ahead.next?.late, false);
  assert.match(ahead.next?.dueText ?? '', /^Due /);
  // The page hands both to the shared figures, which draw them.
  assert.match(src(`${C}/_pages/payment.tsx`), /dueText: view\.next\.dueText,\s*late: view\.next\.late/);
  assert.match(src('app/dashboard/[eventId]/budget/_components/budget-figures.tsx'), /next\.dueText \?/);
});

test('2 + 3 · the asks panel: no "Nothing outstanding", no invented figure, filled from the plan', () => {
  const panel = src(`${C}/_components/payment-asks-panel.tsx`);
  assert.doesNotMatch(panel, /Nothing outstanding/);
  assert.match(panel, /No ask sent yet/);
  assert.doesNotMatch(panel, /placeholder="\d/, 'no example peso figure in the amount field');
  assert.match(panel, /defaultValue=\{suggest \? String\(suggest\.amountPhp\) : undefined\}/);
  assert.match(panel, /formatPhp\(suggest\.amountPhp\)/);
  const page = src(`${C}/page.tsx`);
  assert.match(page, /suggest=\{askSuggestion\}/);
  assert.match(page, /const askNext = isBooked\s*\?\s*clientPaymentView\(/, 'the suggestion is the Payment page fold, not a second sum');
});

test('4 · the client noun is the event kind\'s own word', () => {
  assert.equal(clientNounOf({ terminology: { organizerNoun: 'celebrant' } } as never), 'celebrant');
  assert.equal(clientNounOf({ terminology: { organizerNoun: 'couple' } } as never), 'couple');
  assert.equal(clientNounOf(null), CLIENT_NOUN_FALLBACK);
  assert.notEqual(CLIENT_NOUN_FALLBACK, 'couple');
  const forms = src(`${C}/_pages/forms.tsx`);
  assert.doesNotMatch(forms, /Questions for the couple/);
  assert.match(forms, /readClientNoun\(ctx\.eventId\)/);
  assert.match(forms, /clientNoun=\{clientNoun\}/);
  const qs = src('app/vendor-dashboard/activities/questions-section.tsx');
  assert.match(qs, /Questions for the \{one\}/);
  assert.doesNotMatch(src(`${C}/_components/couple-answers.tsx`), /every couple you work with/);
  assert.doesNotMatch(src('app/vendor-dashboard/forms/_components/forms-page-body.tsx'), /send it to any couple/);
});

test('5 + 6 · one empty line on Forms, and room under the floating buttons', () => {
  const forms = src(`${C}/_pages/forms.tsx`);
  assert.equal((forms.match(/quietWhenEmpty/g) ?? []).length, 2, 'both the send panel and the answers are quiet when empty');
  assert.match(forms, /className="space-y-8 pb-24" data-picked-page="forms"/);
  assert.match(src('app/vendor-dashboard/messages/[threadId]/_components/questions-send-panel.tsx'), /if \(quietWhenEmpty\) return null;/);
  assert.match(src(`${C}/_components/couple-answers.tsx`), /if \(quietWhenEmpty\) return null;/);
});

test('7 · a Setnayan-booking block is the booked day — one day, not the month; the legend names the seat green', () => {
  const pools = [{ poolId: 'p1', label: '', capacity: 1, categories: [], calendarName: null, isVendorCreated: false, serviceIds: [] }];
  // The real shape on prod (17 Nov): no pool booking, one shop-wide `setnayan_booking` block on May 12.
  const m = buildCustomerCalendarMonth(pools as never, [], [{ poolId: null, source: 'setnayan_booking', startDate: '2027-05-12', endDate: '2027-05-12' }] as never, [], [], '2027-05', '2026-11-17');
  const booked = m.days.filter((d) => (dayStateOf(d)?.dots ?? []).includes('booked')).map((d) => d.date);
  assert.deepEqual(booked, ['2027-05-12'], 'only the booked day wears the Booked-here dot');
  const may12 = m.days.find((d) => d.date === '2027-05-12')!;
  assert.equal(may12.state, 'full');
  assert.equal(dayStateOf(may12)?.blocked, undefined, 'a booked day is never struck "Not available"');
  assert.equal(m.days.filter((d) => d.state !== null).length, 1);
  // A manual block still closes.
  const closed = buildCustomerCalendarMonth(pools as never, [], [{ poolId: null, source: 'manual', startDate: '2027-05-13', endDate: '2027-05-13' }] as never, [], [], '2027-05', '2026-11-17');
  assert.equal(closed.days.find((d) => d.date === '2027-05-13')!.state, 'blocked');
  // A pool booking on the same day is not counted twice.
  const both = buildCustomerCalendarMonth(pools as never, [{ poolId: 'p1', bookedDate: '2027-05-12', eventName: 'Debut 18' }] as never, [{ poolId: null, source: 'setnayan_booking', startDate: '2027-05-12', endDate: '2027-05-12' }] as never, [], [], '2027-05', '2026-11-17');
  assert.equal(both.days.find((d) => d.date === '2027-05-12')!.setnayanConsumed, 1);
  // The legend says what the box grid's green square means.
  assert.match(src('app/_components/calendar.tsx'), /mark === 'box' \? \(\s*<span[^>]*data-calendar-legend-open=""/);
});

test('8 · no "Live" and no "Up next" before the event\'s day', () => {
  const h = src('app/_components/run-of-show-header.tsx');
  assert.match(h, /const ahead = startsOnWords != null;/);
  assert.equal((h.match(/\{ahead \? 'First moment' : 'Up next'\}/g) ?? []).length, 2, 'both drawings');
  assert.match(h, /\{ahead \? null : \(\s*<span[\s\S]{0,400}data-run-of-show-live=""/, 'the card badge');
  assert.match(h, /\) : ahead \? null : \(\s*<span[\s\S]{0,400}data-run-of-show-live=""/, 'the strip badge');
});

test('9 + 10 · no stray dash on a file row; the note box names the client by kind', () => {
  assert.doesNotMatch(src(`${C}/_pages/files-finder.tsx`), /sizeLabel \?\? '—'/);
  const notes = src(`${C}/_components/customer-card-notes.tsx`);
  assert.doesNotMatch(notes, /about this couple/);
  assert.match(notes, /Add a note about this \$\{clientNoun\}/);
  assert.match(src(`${C}/page.tsx`), /clientNoun=\{clientNoun\}/);
});

test('notices · the returning-client line names the kind; two names take a plural verb', () => {
  assert.equal(returningClientLine('celebrant', 'Debut 18'), 'This celebrant previously booked you for Debut 18.');
  assert.equal('This couple previously booked you for Old Event. Hi'.replace(RETURNING_CLIENT_LEAD, ''), 'Hi', 'old rows still strip');
  assert.equal('This celebrant previously booked you for Debut 18. Hi'.replace(RETURNING_CLIENT_LEAD, ''), 'Hi');
  assert.equal(agree('Wanda & Indigo', 'has', 'have'), 'have');
  assert.equal(agree('Ana and Leo', 'has', 'have'), 'have');
  assert.equal(agree('Debut 18', 'has', 'have'), 'has');
  assert.equal(agree('A couple', 'has', 'have'), 'has');
  assert.doesNotMatch(src('lib/chat-actions.ts'), /This couple previously booked you/);
  for (const p of ['app/dashboard/[eventId]/vendors/actions.ts', 'app/dashboard/[eventId]/vendors/packages/actions.ts', 'app/_components/negotiation-actions.ts']) {
    const s = src(p);
    assert.doesNotMatch(s, /\$\{who\} has asked you/, p);
    assert.match(s, /\$\{who\} \$\{agree\(who, 'has', 'have'\)\} asked you/, p);
  }
});
