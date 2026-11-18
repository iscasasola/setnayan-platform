/**
 * R12 / R13 (walk W4, live f8f278f, 390 px, 18 Nov 2026) · AN UNBOOKED QUOTE OWES NOTHING — ON THE PAGE, NOT ONLY IN A ⓘ.
 *
 * TEST W1 · Eleven Florals, an accepted quote at `shortlisted` (not booked). After #7965 the Schedule section said
 * "not booked yet", but the card above it still headlined "AMOUNT TO PAY ₱1,350 · First payment · Record payment",
 * and the Final balance row said "that day has already passed". Both told the couple money was owed while the Budget
 * correctly said ₱0 owed — and "Nothing is owed yet" lived only inside a closed ⓘ.
 *
 * Now: an unbooked row with nothing logged shows "Nothing owed yet" (no amount, no Pay, no Record payment); the
 * Schedule section prints a ≤ 12-word line saying so; no unbooked row says the day has passed. Booked rows are
 * unchanged — every helper answers exactly as before when booked.
 *
 * R13: the ⓘ beside the Schedule label is the shared `InfoTip` (via `TemplateSection`). Its circle is DRAWN 16 px and
 * PRESSES at 46 through `.sn-dot-btn::after` — measured live at 390 px with `elementFromPoint` 20 px off-centre on all
 * four sides. A bounding-box read sees only the drawing. This file pins that the section's ⓘ stays that InfoTip.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  NOTHING_OWED_YET_LINE,
  acceptedQuoteTerms,
  nothingOwedYet,
  quoteScheduleFrame,
  scheduleDueText,
  type AcceptedQuoteRow,
  type MoneyStep,
} from '@/lib/accepted-quote-terms';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..');
const src = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8'));
const WS = 'app/dashboard/[eventId]/vendors/[vendorId]/workspace';
const CARD = src(`${WS}/_components/deposit-reservation.tsx`);
const PAGE = src(`${WS}/page.tsx`);

/** The walk's shape: ₱1,350 first payment on booking, a final balance whose day is already behind "today". */
const QUOTE: AcceptedQuoteRow = {
  public_id: 'S89J-TESTW1ELEV',
  status: 'accepted',
  total_centavos: 810000,
  line_items: [{ label: 'Florals', detail: null, amount_centavos: 810000 }],
  payment_schedule: {
    version: 1,
    balances: true,
    installments: [
      { due: 'on_lock', seq: 0, kind: 'fixed', label: 'First payment', offset_days: 0, amount_centavos: 135000, is_downpayment: true },
      { due: 'before_event', seq: 1, kind: 'auto', label: 'Final balance', offset_days: 7, amount_centavos: 675000, is_downpayment: false },
    ],
  },
} as unknown as AcceptedQuoteRow;
const TERMS = acceptedQuoteTerms([QUOTE], '2026-11-09')!;
const FINAL = TERMS.schedule.find((r) => !r.isFirstPayment)!;
const TODAY = '2026-11-18';

describe('R12 · an unbooked quote owes nothing', () => {
  it('the card’s rule: not booked + nothing logged = nothing owed; anything booked or logged keeps its old state', () => {
    assert.equal(nothingOwedYet({ kind: 'not_booked' }, false), true);
    assert.equal(nothingOwedYet({ kind: 'not_booked' }, true), false, 'a logged payment keeps its own record');
    const booked: MoneyStep[] = [
      { kind: 'unknown' },
      { kind: 'first_payment_due', action: 'record_deposit', label: 'First payment', amountCentavos: 135000, minimumCentavos: 135000, resend: false },
      { kind: 'first_payment_sent', recordedCentavos: 135000 },
      { kind: 'paid_in_full', paidCentavos: 810000 },
    ] as MoneyStep[];
    for (const s of booked) assert.equal(nothingOwedYet(s, false), false, `${s.kind} must stay as it was`);
    assert.equal(nothingOwedYet(null, false), false, 'no step = the first-payment card it always was');
  });

  it('the card gates its amount, Pay and Record payment on that rule — and says why, visibly', () => {
    assert.match(CARD, /const notBookedYet = nothingOwedYet\(step, recorded\)/);
    assert.match(CARD, /const owed = \(!recorded \|\| declined\) && !acked && !notBookedYet;/);
    assert.match(CARD, /const firstPaymentOffered = \(!recorded \|\| declined\) && !\(later && !recorded\) && !notBookedYet;/);
    assert.match(CARD, /label=\{notBookedYet \? 'Not booked yet' :/);
    assert.match(CARD, /data-nothing-owed-yet=""[\s\S]{0,200}Nothing owed yet[\s\S]{0,120}confirms the booking/);
    // The Record payment button is offered only when `firstPaymentOffered` — which an unbooked row now fails.
    assert.match(CARD, /\(!recorded \|\| declined\) && !open && firstPaymentOffered \?/);
  });

  it('no unbooked schedule row says “that day has already passed”; a booked one still does', () => {
    assert.ok(FINAL.dueOnISO && FINAL.dueOnISO < TODAY, 'fixture: the final balance day is in the past');
    assert.doesNotMatch(scheduleDueText(FINAL, TODAY, false), /already passed/);
    assert.equal(scheduleDueText(FINAL, TODAY, false), FINAL.dueText);
    assert.match(scheduleDueText(FINAL, TODAY, true), /that day has already passed/);
    assert.equal(scheduleDueText(FINAL, TODAY), scheduleDueText(FINAL, TODAY, true), 'booked is the default: callers unchanged');
    assert.match(PAGE, /scheduleDueText\(row, manilaToday\(\), quoteBooked\)/);
    assert.match(PAGE, /const quoteBooked = stage !== null;/);
  });

  it('the Schedule section says “nothing is owed yet” on the page, in ≤ 12 words, with “book” not “lock”', () => {
    const f = quoteScheduleFrame(false, 'TEST W1 Eleven Florals');
    assert.equal(f.line, NOTHING_OWED_YET_LINE);
    assert.match(NOTHING_OWED_YET_LINE, /^Nothing is owed yet/);
    assert.ok(NOTHING_OWED_YET_LINE.split(/\s+/).length <= 12, `${NOTHING_OWED_YET_LINE.split(/\s+/).length} words`);
    assert.doesNotMatch(NOTHING_OWED_YET_LINE, /lock/i);
    assert.equal(quoteScheduleFrame(true, 'TEST W1 Eleven Florals').line, null, 'a booked schedule has no such line');
    assert.match(PAGE, /quoteSchedule\.line \?[\s\S]{0,160}\{quoteSchedule\.line\}/);
  });
});

describe('R13 · the Schedule ⓘ presses at 44+', () => {
  it('the section ⓘ is the shared InfoTip, whose 16-px circle carries the 46-px halo', () => {
    const rows = src('app/_components/template-rows.tsx');
    assert.match(rows, /<InfoTip label=\{label\}/);
    assert.match(src('app/_components/info-tip.tsx'), /sn-dot-btn inline-flex h-4 w-4/);
    const css = stripComments(readFileSync(path.join(WEB, 'app/globals.css'), 'utf8'));
    assert.match(css, /\.sn-dot-btn::after\s*\{[^}]*inset:\s*min\(-8px,\s*calc\(\(100% - 46px\) \/ 2\)\)/);
  });
});
