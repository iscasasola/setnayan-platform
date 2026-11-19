/**
 * ➡ The Next step row on top of Chat (owner 18 Nov 2026). Each stage, the outranking due, and — the rule that matters
 * most — an unread stage gives NOTHING, never the next stage down.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientNextStep, workColumnDefault, type NextStepInputs } from './client-next-step';

const base: NextStepInputs = {
  todayIso: '2026-11-18',
  eventDate: '2026-12-12',
  isBooked: true,
  quoteWaiting: false,
  nextDue: null,
  crewCallAt: null,
  handoverSent: false,
};

test('1 · not booked: a waiting quote → Book & Budget; anything else (or an unread proposals list) → nothing', () => {
  assert.deepEqual(clientNextStep({ ...base, isBooked: false, quoteWaiting: true }), { line: 'Quote sent · no answer yet', page: 'quote', anchor: null });
  assert.equal(clientNextStep({ ...base, isBooked: false, quoteWaiting: false }), null);
  assert.equal(clientNextStep({ ...base, isBooked: false, quoteWaiting: null }), null);
});

test('2 · booked: the next unpaid due opens Book & Budget at the payments', () => {
  const s = clientNextStep({ ...base, nextDue: { amountPhp: 242830, dueDate: '2026-12-09' } });
  assert.equal(s?.page, 'quote');
  assert.equal(s?.anchor, 'payments');
  assert.match(s!.line, /242,830 due Wed, Dec 9$/);
});

test('3 · event week: the crew call → Schedule, but an unpaid due outranks it', () => {
  const wk = { ...base, todayIso: '2026-12-08', crewCallAt: '2026-12-12T13:00:00' };
  assert.deepEqual(clientNextStep(wk), { line: 'Sat, Dec 12 · crew in 1:00 PM', page: 'schedule', anchor: null });
  assert.equal(clientNextStep({ ...wk, nextDue: { amountPhp: 1000, dueDate: '2026-12-09' } })?.page, 'quote');
});

test('4 · after the event: no handover yet → Files; one sent → nothing', () => {
  const after = { ...base, todayIso: '2026-12-13' };
  assert.deepEqual(clientNextStep(after), { line: 'Send the handover', page: 'files', anchor: null });
  assert.equal(clientNextStep({ ...after, handoverSent: true }), null);
});

test('5 · an unread stage says NOTHING — never a wrong next step', () => {
  assert.equal(clientNextStep({ ...base, nextDue: undefined }), null, 'plan unread is not "nothing due"');
  assert.equal(clientNextStep({ ...base, todayIso: '2026-12-08', crewCallAt: undefined }), null, 'crew unread');
  assert.equal(clientNextStep({ ...base, todayIso: '2026-12-13', handoverSent: undefined }), null, 'handovers unread');
});

test('6 · the work column default: Book & Budget before booking, Details once booked, Schedule in the event week', () => {
  assert.equal(workColumnDefault({ ...base, isBooked: false }), 'quote');
  assert.equal(workColumnDefault(base), 'details');
  assert.equal(workColumnDefault({ ...base, todayIso: '2026-12-06' }), 'schedule');
  assert.equal(workColumnDefault({ ...base, todayIso: '2026-12-13' }), 'details');
});
