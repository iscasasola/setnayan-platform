/**
 * booking-ask-words.test.ts — PAIR P2: the couple's ask and the supplier's
 * answer are said in the same words on both pages (owner 2026-10-10:
 * "ask, agree, decline, lapse, withdraw all show on both pages in the same
 * words"; `SUPPLIER_CONNECTION_MAP_2026-10-10.md` rows 12–16).
 *
 * Three kinds of check: the table itself (executed), the supplier's card rule
 * (executed), and that every surface of both halves PRINTS these sentences and
 * keeps no hand-typed copy of them (source, comments stripped).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { askEndedOf, askLine, coupleAskEndedLine, supplierAskOutcomeOf } from './booking-ask-words';
import { lockAnswerReturnTo } from './lock-answer-notice';
import { LOCK_ANSWER_WINDOW_HOURS } from './lock-request-state';
import { sheetStateLine } from './supplier-sheet';
import { buildLinesOf, pickAnswerNote } from './suppliers-build';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PANEL = src('app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel.tsx');
const CARD = src('app/vendor-dashboard/clients/[eventId]/page.tsx');
const THREAD_FORMS = src('app/_components/lock-answer-forms.tsx');
const DECLINE_FIELDS = src('app/_components/decline-reason-fields.tsx');
const BUILD_LIB = src('lib/suppliers-build.ts');
const BUILD_BODY = src('app/dashboard/[eventId]/vendors/_components/build-body.tsx');
const BOOK = src('app/dashboard/[eventId]/vendors/_components/book-this-build.tsx');
const SHEET_LIB = src('lib/supplier-sheet.ts');
const SHORTLIST = src('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('THE TABLE: one sentence per state, the same opening on both sides, the pronoun turned', () => {
  const h = `${LOCK_ANSWER_WINDOW_HOURS} hours`;
  const rows: Array<[Parameters<typeof askLine>[0], string, string]> = [
    ['requested', 'Asked to book · waiting for their yes', 'Asked to book · waiting for your yes'],
    ['declined', 'Asked to book · they said no', 'Asked to book · you said no'],
    ['expired', `Asked to book · no answer in ${h}`, `Asked to book · you did not answer in ${h}`],
    ['cancelled', 'Asked to book · you took it back', 'Asked to book · they took it back'],
    ['locked', 'Booked', 'Booked'],
  ];
  for (const [state, couple, supplier] of rows) {
    assert.equal(askLine(state, 'couple'), couple, `couple · ${state}`);
    assert.equal(askLine(state, 'supplier'), supplier, `supplier · ${state}`);
  }
  // The couple may ask again after every ending; the supplier is never told to.
  assert.equal(coupleAskEndedLine('declined'), 'Asked to book · they said no — you can ask again');
  assert.equal(askEndedOf('requested'), null);
  assert.equal(askEndedOf('locked'), null);
  assert.equal(askEndedOf('none'), null);
});

test('THE SUPPLIER\'S CARD: a closed ask says how, with when and their own words; an open or booked one says nothing here', () => {
  const declined = supplierAskOutcomeOf(
    { status: 'considering', lock_request_state: 'declined', lock_declined_at: '2026-10-11T09:30:00Z', lock_decline_reason: '  Fully booked. ' },
    true,
  );
  assert.deepEqual(declined, { state: 'declined', line: 'Asked to book · you said no', at: '2026-10-11T09:30:00Z', words: 'Fully booked.' });
  const expired = supplierAskOutcomeOf({ status: 'considering', lock_request_state: 'expired', lock_request_expires_at: '2026-10-11T02:00:00Z' }, true);
  assert.equal(expired?.at, '2026-10-11T02:00:00Z');
  assert.equal(expired?.words, null, 'a lapse carries no reason');
  assert.equal(supplierAskOutcomeOf({ status: 'considering', lock_request_state: 'cancelled' }, true)?.line, 'Asked to book · they took it back');
  // Agreed but walked back by the couple reads as taken back (`lockRequestStateOf`).
  assert.equal(supplierAskOutcomeOf({ status: 'considering', lock_request_state: 'agreed' }, true)?.state, 'cancelled');
  for (const row of [
    { status: 'considering', lock_request_state: 'pending' },
    { status: 'contracted', lock_request_state: 'declined' },
    { status: 'considering', lock_request_state: null },
  ]) {
    assert.equal(supplierAskOutcomeOf(row, true), null, JSON.stringify(row));
  }
  // Handshake off: nobody ever asked, so nothing ended.
  assert.equal(supplierAskOutcomeOf({ status: 'considering', lock_request_state: 'declined' }, false), null);
  assert.equal(supplierAskOutcomeOf(null, true), null);
});

test('THE COUPLE\'S SIDE, executed: the Build line and the Find sheet read the same row as the supplier\'s card', () => {
  const line = (lockState: 'declined' | 'expired' | 'cancelled') =>
    buildLinesOf({
      tiles: [{ tile: 'catering', label: 'Catering', vendors: [{ vendorId: 'b', name: 'Bituin', status: 'considering', planGroupId: 'catering', lockState }] }],
      priceOf: () => 171_000,
      inBuild: new Set(['b']),
      blocked: new Map(),
    })[0]!;
  for (const s of ['declined', 'expired', 'cancelled'] as const) {
    const note = pickAnswerNote(line(s).pickAnswer!);
    assert.ok(note.startsWith(askLine(s, 'couple')), `Build · ${s}: ${note}`);
    const sheet = sheetStateLine({ booked: false, asked: false, lockState: s, quoteIn: true, inBuild: true, hasThread: true, selfAdded: false });
    assert.equal(sheet, coupleAskEndedLine(s), `Find sheet · ${s} (it outranks "Quote in")`);
    // The supplier's card says the same thing for the same row.
    assert.equal(supplierAskOutcomeOf({ status: 'considering', lock_request_state: s === 'declined' ? 'declined' : s === 'expired' ? 'expired' : 'cancelled' }, true)?.line, askLine(s, 'supplier'));
  }
  assert.equal(sheetStateLine({ booked: false, asked: true, lockState: 'requested', quoteIn: false, inBuild: true, hasThread: true, selfAdded: false }), askLine('requested', 'couple'));
  // Both Find call sites hand the sheet the row's state.
  assert.equal(count(SHORTLIST, /lockState: (v|there)\.lockRequestState,/g), 2, 'a Find sheet line is blind to how the ask ended');
});

test('NO HAND-TYPED COPY: "Asked to book" is spelled once, in lib/booking-ask-words.ts', () => {
  for (const [name, text] of [
    ['suppliers-build.ts', BUILD_LIB],
    ['build-body.tsx', BUILD_BODY],
    ['book-this-build.tsx', BOOK],
    ['supplier-sheet.ts', SHEET_LIB],
    ['booking-ask-panel.tsx', PANEL],
    ['clients/[eventId]/page.tsx', CARD],
  ] as const) {
    assert.equal(count(text, /Asked to book/g), 0, `${name} types the ask's words itself`);
    assert.equal(count(text, /They said no to this booking|did not answer in time|They want to book you/g), 0, `${name} kept an old sentence`);
  }
  assert.match(BUILD_LIB, /export const PICK_ASKED_NOTE = askLine\('requested', 'couple'\);/);
  assert.match(BOOK, /asked: askLine\('requested', 'couple'\),/);
  assert.match(PANEL, /\{askLine\('requested', 'supplier'\)\}/);
});

test('THE SUPPLIER ANSWERS ON THE CARD, AND THE ANSWER LANDS BACK ON THE CARD', () => {
  // The panel: two forms, each the booking id + the way home, never an event id.
  assert.equal(count(PANEL, /<form action=\{agreeLock\}>/g), 1);
  assert.equal(count(PANEL, /<form action=\{declineLock\}/g), 1);
  assert.equal(count(PANEL, /name="vendor_id" value=\{eventVendorId\}/g), 2);
  assert.equal(count(PANEL, /name="return_to" value=\{returnTo\}/g), 2);
  assert.equal(count(PANEL, /name="event_id"/g), 0, 'an answer form posts event_id — the confused-deputy rule');
  // The reason is ONE field still — now composed by `DeclineReasonFields` (Why ▾ + an optional line, step 4).
  assert.equal(count(PANEL, /<DeclineReasonFields \/>/g), 1, 'the decline lost its reason');
  assert.equal(count(DECLINE_FIELDS, /name="reason"/g), 1, 'the reason fields no longer post the one `reason` the action reads');
  // The card mounts it with its own path and the two shipped actions…
  assert.match(CARD, /returnTo=\{`\/vendor-dashboard\/clients\/\$\{eventId\}`\}/);
  assert.match(CARD, /agreeLock=\{vendorAgreeToLock\}/);
  assert.match(CARD, /declineLock=\{vendorDeclineLock\}/);
  // …reads what the answer did, and says it…
  assert.match(CARD, /lockAgreeNotice\(search\.lock_agree,/);
  assert.match(CARD, /lockDeclineNotice\(search\.lock_decline\)/);
  assert.match(CARD, /<LockAnswerLine notice=\{lockNotice\} \/>/);
  // …and, once the ask closed without a booking, says how — off its own row.
  assert.match(CARD, /supplierAskOutcomeOf\(completionRow, isLockHandshakeEnabled\(\)\)/);
  assert.match(CARD, /<BookingAskOutcomeLine outcome=\{askOutcome\} \/>/);
  assert.match(CARD, /'vendor_id, source, status, lock_request_state, lock_declined_at, lock_decline_reason, lock_request_expires_at, lock_request_cancelled_at,/);
  // The way home: the bare card path is honoured; anything else is not.
  const card = '/vendor-dashboard/clients/0b6f2a1e-6c1d-4c38-9a53-1a3f0c2b7d11';
  assert.equal(lockAnswerReturnTo(card), card);
  for (const bad of [`${card}?tab=money`, '/vendor-dashboard/clients/../messages/x', '/vendor-dashboard/clients/x/y', `https://evil.example${card}`, `//evil.example${card}`]) {
    assert.equal(lockAnswerReturnTo(bad), '/vendor-dashboard', `${bad} was honoured`);
  }
});

test('THE LOOK (2026-10-12 #1, #3): the yes is a terracotta main at 44 px — on the card and on the thread\'s quote card', () => {
  for (const [name, text] of [
    ['booking-ask-panel.tsx', PANEL],
    ['lock-answer-forms.tsx', THREAD_FORMS],
  ] as const) {
    assert.match(text, /<AskSubmit tone="brand" main icon=\{<Check [^}]*\} \/>\} label="Agree to this booking"/, `${name}: Agree is not the brand main`);
    assert.equal(count(text, /--sn-success|h-9\b/g), 0, `${name}: the green 36 px button came back`);
  }
  for (const [name, text] of [
    ['build-body.tsx', BUILD_BODY],
    ['book-this-build.tsx', BOOK],
  ] as const) {
    assert.equal(count(text, /tone="(ok|info|warn|neutral|danger)"\s+main\b/g), 0, `${name}: a main button is not terracotta`);
  }
});

test('THE FEE SEAM: the yes posts vendorAgreeToLock and carries no fee logic of its own', () => {
  // The fee is made AT the yes inside `vendorAgreeToLock` (rd/booking-fee-rules,
  // owner 2026-10-12 #1). The answer surfaces show the forecast and post the
  // yes; a second mint here would be a second fee.
  for (const text of [PANEL, THREAD_FORMS]) {
    assert.equal(count(text, /booking-fee-mint|booking_fee_open|mintBookingFee|collectBookingFee/g), 0);
    assert.match(text, /<BookingFeeNotice disclosure=\{feeForecast\} \/>/);
  }
});
