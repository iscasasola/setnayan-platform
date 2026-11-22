/**
 * ➡ The Next step row on top of Chat (owner 18 Nov 2026). Each stage, the outranking due, and — the rule that matters
 * most — an unread stage gives NOTHING, never the next stage down.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { clientNextStep, coupleNextStep, workColumnDefault, type CoupleNextStepInputs, type NextStepInputs } from './client-next-step';

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

// ── THE HOST'S MIRROR (owner 19 Nov 2026) ──────────────────────────────────────────────────────────────────────────
const host: CoupleNextStepInputs = {
  todayIso: '2026-11-18',
  eventDate: '2026-12-12',
  isBooked: true,
  quoteToDecide: false,
  nextDue: null,
  handoverWaiting: false,
};

test('7 · host · not booked: a quote to decide → Book & Budget; an unread proposals list says nothing', () => {
  assert.deepEqual(coupleNextStep({ ...host, isBooked: false, quoteToDecide: true }), { line: 'A quote is waiting for you', page: 'quote', anchor: null });
  assert.equal(coupleNextStep({ ...host, isBooked: false, quoteToDecide: false }), null);
  assert.equal(coupleNextStep({ ...host, isBooked: false, quoteToDecide: null }), null);
});

test('8 · host · booked: the next payment opens Book & Budget at the payments — with or without an amount or a date', () => {
  const s = coupleNextStep({ ...host, nextDue: { amountPhp: 242830, dueDate: '2026-12-09' } });
  assert.equal(s?.page, 'quote');
  assert.equal(s?.anchor, 'payments');
  assert.match(s!.line, /^Next payment ₱242,830 · due Wed, Dec 9$/);
  assert.match(coupleNextStep({ ...host, nextDue: { amountPhp: 5000, dueDate: null } })!.line, /^Next payment ₱5,000$/);
  assert.equal(coupleNextStep({ ...host, nextDue: { amountPhp: null, dueDate: '2026-12-09' } })!.line, 'Next payment · due Wed, Dec 9');
  assert.equal(coupleNextStep({ ...host, nextDue: { amountPhp: null, dueDate: null } })!.line, 'Next payment');
  assert.equal(coupleNextStep(host), null, 'nothing due: no row');
});

test('9 · host · THE FAILING PATH: an unread plan is not "nothing due" and never names an amount', () => {
  assert.equal(coupleNextStep({ ...host, nextDue: undefined }), null);
  assert.equal(coupleNextStep({ ...host, todayIso: '2026-12-13', handoverWaiting: undefined }), null, 'handovers unread');
});

test('10 · host · after the event: a delivered handover not yet confirmed → Files', () => {
  const after = { ...host, todayIso: '2026-12-13' };
  assert.deepEqual(coupleNextStep({ ...after, handoverWaiting: true }), { line: 'Your files are ready', page: 'files', anchor: null });
  assert.equal(coupleNextStep(after), null);
  // A due is not chased from this row once the day has passed (the supplier's mirror does the same).
  assert.equal(coupleNextStep({ ...after, nextDue: { amountPhp: 1000, dueDate: '2026-12-09' } }), null);
});

test('11 · the host page draws the ONE row and feeds it only what it read; the supplier’s strip says its step', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
  const supplier = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  const ws = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  for (const [name, src] of [['host', ws]] as const) {
    assert.match(src, /import \{ NextStepRow \} from '@\/app\/_components\/picked\/next-step-row';/, `${name}: not the shared row`);
    assert.match(src, /<NextStepRow step=\{/, `${name}: the row is not drawn`);
  }
  // 💬 The SUPPLIER's client page is one chat since 19 Nov 2026: the Next step has no row of its own on top of the
  // chat — the summary strip says it, in the box it opens (`chatStrip`'s `step`, held by lib/client-chat-strip.test.ts).
  assert.match(supplier, /const nextStep = clientNextStep\(\{/, 'supplier: the next step is no longer worked out');
  assert.match(supplier, /step: nextStep \? \{ line: nextStep\.line, page: nextStep\.page \} : null,/, 'supplier: the strip is not handed the next step — its fact left the screen');
  assert.doesNotMatch(supplier, /<NextStepRow\b/, 'supplier: the Next step row is back on top of the chat beside the strip that already says it');
  assert.match(ws, /nextStep=\{hostNextStep \? <NextStepRow step=\{hostNextStep\} \/> : null\}/, 'the host shell is not handed the row');
  // Unread is kept apart from empty, for each read the row uses.
  assert.match(ws, /if \(planProgress\.readComplete === false\) planProgressUnread = true;/);
  assert.match(ws, /nextDue: moneyHidden \? null : planProgressUnread \? undefined :/, 'an unread plan can name an amount as due — or a viewer without Budget sees a figure');
  assert.match(ws, /quoteToDecide: moneyHidden \? false : quoteToDecide,/);
  assert.match(ws, /handoverWaiting: handoverRowsError \? undefined :/, 'a refused handovers read reads as "nothing delivered"');
  const fetcher = read('lib/vendor-service-payment-schedules.server.ts');
  assert.match(fetcher, /readComplete: !planError/, 'the plan fetch drops its error again');
  assert.match(fetcher, /readComplete: !payError/, 'a refused payments read would make every installment "due"');
  assert.match(read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx'), /chatTop=\{nextStep\}/);
});
