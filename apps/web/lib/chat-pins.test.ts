/**
 * 📌 THE PINS' ONE RULE (Supplier Build 3 · lane B; DECISION_LOG 📌 2026-11-08 · 🚦 2026-11-09).
 *
 * What would silently undo it, each asserted by EXECUTING the rule:
 *   1. a blocker drawn as an amber pin (or a due one as a full screen) — the three levels drift;
 *   2. a change awaiting approval / an unset call time blocking a month out, or NOT blocking inside 7 days;
 *   3. pins reordering between renders, or newest-first instead of oldest due first;
 *   4. Waiting drawn above Due now;
 *   5. the payment reminder cadence drifting off "due day, +3 days, then every 5 days";
 *   6. the collapsed row losing its count or its countdown.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-pins.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOCKS_WITHIN_DAYS,
  collapsedLine,
  countdownLabel,
  daysToEvent,
  needsYouLevel,
  paymentReminder,
  pinsFromDecisions,
  stackPins,
  threadNeedsYouLevel,
  waitingLine,
  type PinFact,
  type PinKind,
} from './chat-pins';
import type { DecisionEntry } from './thread-decisions';

const DAY = 86_400_000;
// 2026-11-09 10:00 Manila.
const NOW = Date.parse('2026-11-09T10:00:00+08:00');
const inDays = (n: number) => new Date(NOW + n * DAY).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const fact = (kind: PinKind, over: Partial<PinFact> = {}): PinFact => ({
  key: `${kind}:1`,
  kind,
  title: kind,
  answerer: 'you',
  sinceMs: NOW - DAY,
  ...over,
});

test('1 · the four blockers are blockers whenever the reader must act', () => {
  for (const k of ['booking_ask', 'booking_fee', 'coordinator_agree', 'quote_expired'] as const) {
    assert.equal(needsYouLevel({ kind: k, answerer: 'you' }, { nowMs: NOW, eventDate: inDays(200) }), 'blocker', k);
  }
  for (const k of ['payment_due', 'confirm_payment', 'guest_count', 'access_ask'] as const) {
    assert.equal(needsYouLevel({ kind: k, answerer: 'you' }, { nowMs: NOW, eventDate: inDays(1) }), 'due', k);
  }
});

test('1b · anything the OTHER side must answer is only Waiting — even a blocker kind', () => {
  for (const k of ['booking_ask', 'quote_expired', 'payment_due', 'change_approval'] as const) {
    assert.equal(needsYouLevel({ kind: k, answerer: 'them' }, { nowMs: NOW, eventDate: inDays(1) }), 'waiting', k);
  }
});

test('2 · a change awaiting approval / an unset call time blocks only within 7 days of the event', () => {
  for (const k of ['change_approval', 'call_time'] as const) {
    assert.equal(needsYouLevel({ kind: k, answerer: 'you' }, { nowMs: NOW, eventDate: inDays(BLOCKS_WITHIN_DAYS) }), 'blocker');
    assert.equal(needsYouLevel({ kind: k, answerer: 'you' }, { nowMs: NOW, eventDate: inDays(0) }), 'blocker');
    assert.equal(needsYouLevel({ kind: k, answerer: 'you' }, { nowMs: NOW, eventDate: inDays(BLOCKS_WITHIN_DAYS + 1) }), 'due');
    assert.equal(needsYouLevel({ kind: k, answerer: 'you' }, { nowMs: NOW, eventDate: null }), 'due', 'no date → never a blocker');
  }
  assert.equal(daysToEvent(inDays(3), NOW), 3);
  assert.equal(daysToEvent('not-a-date', NOW), null);
});

test('3 · oldest due first, ties by key, stable across renders', () => {
  const a = fact('payment_due', { key: 'b', dueMs: NOW + 2 * DAY });
  const b = fact('payment_due', { key: 'a', dueMs: NOW + 2 * DAY });
  const c = fact('confirm_payment', { key: 'c', sinceMs: NOW - 5 * DAY });
  const s1 = stackPins([a, b, c], { nowMs: NOW });
  const s2 = stackPins([c, a, b], { nowMs: NOW });
  assert.deepEqual(s1.due.map((f) => f.key), ['c', 'a', 'b']);
  assert.deepEqual(s2.due.map((f) => f.key), ['c', 'a', 'b']);
});

test('4 · the stack splits into blockers · due · waiting, and the Chats row reads the loudest', () => {
  const s = stackPins(
    [fact('booking_ask'), fact('payment_due', { key: 'p' }), fact('confirm_payment', { key: 'w', answerer: 'them' })],
    { nowMs: NOW },
  );
  assert.equal(s.blockers.length, 1);
  assert.equal(s.due.length, 1);
  assert.equal(s.waiting.length, 1);
  assert.equal(threadNeedsYouLevel([fact('payment_due'), fact('booking_ask')], { nowMs: NOW }), 'blocker');
  assert.equal(threadNeedsYouLevel([fact('payment_due', { answerer: 'them' })], { nowMs: NOW }), 'waiting');
  assert.equal(threadNeedsYouLevel([], { nowMs: NOW }), null);
});

test('5 · payment reminders: nothing before the due day, then the due day, +3, +8, +13', () => {
  assert.equal(paymentReminder(inDays(1), NOW), null, 'not due yet → no pin');
  const dueDay = inDays(0);
  const at = (d: number) => paymentReminder(dueDay, NOW + d * DAY)!;
  assert.equal(at(0).nth, 0);
  assert.equal(at(2).nth, 0);
  assert.equal(at(3).nth, 1);
  assert.equal(at(7).nth, 1);
  assert.equal(at(8).nth, 2);
  assert.equal(at(13).nth, 3);
  // The next reminder is always the next step on the cadence.
  const dueMs = Date.parse(`${dueDay}T00:00:00+08:00`);
  assert.equal((at(0).nextMs - dueMs) / DAY, 3);
  assert.equal((at(3).nextMs - dueMs) / DAY, 8);
  assert.equal((at(8).nextMs - dueMs) / DAY, 13);
  assert.equal(paymentReminder('bad', NOW), null);
});

test('5b · the countdown speaks Manila days and never says "-2 days"', () => {
  assert.equal(countdownLabel(NOW, NOW), 'due today');
  assert.equal(countdownLabel(NOW + DAY, NOW), 'due tomorrow');
  assert.equal(countdownLabel(NOW + 4 * DAY, NOW), 'due in 4 days');
  assert.equal(countdownLabel(NOW - DAY, NOW), '1 day overdue');
  assert.equal(countdownLabel(NOW - 3 * DAY, NOW), '3 days overdue');
});

test('6 · the collapsed row keeps the count and the top item\'s countdown; the waiting line names them', () => {
  const due = stackPins(
    [fact('payment_due', { key: 'x', title: '₱10,000 · GCash', dueMs: NOW }), fact('guest_count', { key: 'y', title: '120 → 140' })],
    { nowMs: NOW },
  ).due;
  assert.equal(collapsedLine(due, NOW), '2 due now · 120 → 140');
  assert.equal(collapsedLine([due[1]!], NOW), '1 due now · ₱10,000 · GCash · due today');
  assert.equal(collapsedLine([], NOW), null);
  assert.equal(waitingLine([fact('confirm_payment', { themName: 'Lumina' })]), '1 waiting for Lumina');
  assert.equal(waitingLine([]), null);
});

test('7 · the conversation\'s own Decisions become pins: a payment, a head count, an adjustment', () => {
  const entry = (kind: string, needsYou: boolean, text: string): DecisionEntry =>
    ({ key: `${kind}:1`, kind, atMs: NOW, title: kind, now: { needsYou, text } }) as unknown as DecisionEntry;
  const pins = pinsFromDecisions(
    [
      entry('payment', true, 'Confirm it reached you'),
      entry('guest_count', false, 'Waiting for the hosts'),
      entry('adjustment', true, 'Approve or decline'),
      entry('payment', false, 'Confirmed'),
    ],
    'Ana & Ben',
  );
  assert.deepEqual(
    pins.map((p) => [p.kind, p.answerer]),
    [
      ['confirm_payment', 'you'],
      ['guest_count', 'them'],
      ['change_approval', 'you'],
    ],
  );
});
