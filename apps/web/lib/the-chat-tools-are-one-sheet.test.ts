/**
 * THE CHAT'S TOOLS ARE ONE SHEET, AND THE CONVERSATION OPENS WITH ITS ANSWER (simpler supplier dashboard step 4,
 * 2026-10-14 · prototype `supplier_easy_dashboard_2026-10-14_fable.html` `SCREENS.thread` + `SHEETS.tools`;
 * DECISION_LOG ✅ APPROVE and 🧰 "Report a problem joins the chat's ＋ tools").
 *
 * What would silently undo it, each asserted by EXECUTING the rule or counting the one mount:
 *
 *   1. a tool the conversation had drops out of the sheet — every row of the approved list must be there, in order,
 *      Report a problem included, and "Answer their booking ask" only while an ask is open;
 *   2. a tool that cannot open yet is HIDDEN instead of shut-with-a-reason (owner B2: hide nothing, say why);
 *   3. the answer line calls a day "Free" that the supplier's own Dates would not (calendar truth: never "Free" with no
 *      schedule, never on a closed or full day), or the quick reply "Yes po, that day is free" is offered over one;
 *   4. the answer-line read runs on a booked thread or a dateless one (free plan: no read the answer does not need).
 *
 * Run: cd apps/web && npx tsx --test lib/the-chat-tools-are-one-sheet.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { VENDOR_THREAD_TOOLS, vendorThreadToolRows, type VendorThreadToolsState } from './vendor-thread-tools';
import { threadDayAnswerOf, threadDayIsOpen, threadDayWords } from './thread-day-answer';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const SHEET = read('app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
const LINE = read('app/vendor-dashboard/messages/[threadId]/_components/thread-answer-line.tsx');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const OPEN: VendorThreadToolsState = { hasAgreement: true, askOpen: true, paymentsToConfirm: 1, guestCountChanges: 1 };
const NONE: VendorThreadToolsState = { hasAgreement: false, askOpen: false, paymentsToConfirm: 0, guestCountChanges: 0 };

test('the scan read its files', () => {
  assert.ok(PAGE.length > 20_000, 'the thread page read short');
  assert.ok(SHEET.length > 2_000, 'the tools sheet read short');
});

test('🔑 1 · every tool of the approved list is a row, in order — Report a problem included', () => {
  const labels = vendorThreadToolRows(OPEN).map((r) => r.tool.label);
  assert.deepEqual(labels, [
    'Send a quote',
    'Answer their booking ask',
    'Ask for a payment',
    'Confirm a payment they sent',
    'Propose a date or meeting',
    'Your call time',
    'Share a file or the contract',
    'Offer another service',
    'Call them',
    'Guest count changed',
    'Mark won or lost',
    'Report a problem',
  ]);
  assert.equal(VENDOR_THREAD_TOOLS.filter((t) => t.primary).length, 1, 'exactly one primary tool');
  assert.equal(VENDOR_THREAD_TOOLS.find((t) => t.primary)?.key, 'build-quote', 'Send a quote is the primary tool');
});

test('🔑 1b · the booking-ask row exists only while an ask is open — never a greyed "answer" over nothing', () => {
  const keys = (s: VendorThreadToolsState) => vendorThreadToolRows(s).map((r) => r.tool.key);
  assert.ok(keys(OPEN).includes('booking-ask'));
  assert.ok(!keys({ ...OPEN, askOpen: false }).includes('booking-ask'));
  // The page mounts the panel's body only then, too.
  assert.match(PAGE, /'booking-ask':\s*askOpen && lockHandshake\?\.eventVendorId \?/, 'the booking-ask panel is not gated on the open ask');
  assert.match(PAGE, /const askOpen = lockHandshake\?\.state === 'requested'/, 'the open ask is not read off the handshake state');
});

test('🔑 2 · a tool that cannot open yet is SHUT with its reason, never hidden', () => {
  const rows = vendorThreadToolRows(NONE);
  // Everything but the booking ask is still listed with nothing open.
  assert.equal(rows.length, VENDOR_THREAD_TOOLS.length - 1);
  const shut = Object.fromEntries(rows.filter((r) => r.shut).map((r) => [r.tool.key, r.shut!.reason]));
  assert.deepEqual(Object.keys(shut).sort(), ['ask-payment', 'guest-count', 'log-payment', 'propose-schedule']);
  for (const reason of Object.values(shut)) assert.ok(reason.length > 10, `a shut reason is not a sentence: ${reason}`);
  // …and opens once the fact behind it is true.
  assert.equal(vendorThreadToolRows(OPEN).filter((r) => r.shut).length, 0);
  // The sheet draws a shut row as a reachable, described, disabled control — never `disabled` (out of the tab order).
  assert.match(SHEET, /aria-disabled="true" aria-describedby=\{reasonId\} tabIndex=\{0\}/);
});

test('🔑 2b · every link a row names is written in the sheet (the route keeps its doors), and the page feeds the state', () => {
  for (const target of ['client-schedule', 'client-payments', 'disputes'] as const) {
    assert.ok(SHEET.includes(`case '${target}':`), `the sheet has no href for ${target}`);
  }
  assert.match(SHEET, /'\/vendor-dashboard\/disputes'/, 'Report a problem no longer opens the shipped disputes page');
  for (const fact of [
    /hasAgreement: THREAD_STAGE_HAS_AGREEMENT\[railStage\]/,
    /askOpen,/,
    /paymentsToConfirm: pendingPayments\.length/,
    /guestCountChanges: paxProposals\.length/,
  ]) {
    assert.match(PAGE, fact, `the sheet's state lost ${fact}`);
  }
});

test('🔑 3 · the answer line never says "Free" without a schedule, on a closed day or a full one', () => {
  const day = (state: string | null, consumed: number, capacity: number) =>
    ({ state, consumed, capacity }) as Parameters<typeof threadDayAnswerOf>[0]['day'];
  assert.deepEqual(threadDayAnswerOf({ day: day(null, 0, 2), hasSchedule: true }), { kind: 'free' });
  assert.deepEqual(threadDayAnswerOf({ day: day('booked', 1, 3), hasSchedule: true }), { kind: 'fits', more: 2 });
  assert.deepEqual(threadDayAnswerOf({ day: day('full', 3, 3), hasSchedule: true }), { kind: 'full' });
  assert.deepEqual(threadDayAnswerOf({ day: day('booked', 2, 2), hasSchedule: true }), { kind: 'full' });
  assert.deepEqual(threadDayAnswerOf({ day: day('blocked', 0, 2), hasSchedule: true }), { kind: 'not_available' });
  assert.deepEqual(threadDayAnswerOf({ day: day('locked', 0, 2), hasSchedule: true }), { kind: 'not_available' });
  assert.deepEqual(threadDayAnswerOf({ day: day(null, 0, 0), hasSchedule: false }), { kind: 'not_set' });
  assert.deepEqual(threadDayAnswerOf({ day: day('blocked', 0, 0), hasSchedule: false }), { kind: 'not_available' });
  // Approve-first and a waiting list leave the day bookable.
  assert.deepEqual(threadDayAnswerOf({ day: day('whitelist', 0, 2), hasSchedule: true }), { kind: 'free' });
  // A read that could not place the day says nothing.
  assert.equal(threadDayAnswerOf({ day: null, hasSchedule: true }), null);

  assert.equal(threadDayWords({ kind: 'free' }).word, 'Free');
  assert.equal(threadDayWords({ kind: 'fits', more: 2 }).word, '2 more fit');
  assert.equal(threadDayWords({ kind: 'full' }).word, 'Full');
  assert.notEqual(threadDayWords({ kind: 'not_set' }).word, 'Free');

  // The canned yes rides only on an open day.
  assert.equal(threadDayIsOpen({ kind: 'free' }), true);
  assert.equal(threadDayIsOpen({ kind: 'fits', more: 1 }), true);
  for (const kind of ['full', 'not_available', 'not_set', 'booked', 'no_date'] as const) {
    assert.equal(threadDayIsOpen({ kind } as never), false, `"Yes po, that day is free" offered on ${kind}`);
  }
  assert.equal(threadDayIsOpen(null), false);
  assert.match(LINE, /\.\.\.\(threadDayIsOpen\(answer\) \? \['Yes po, that day is free'\] : \[\]\)/);
  assert.match(PAGE, /const quickReplies = quickRepliesFor\(dayAnswer\);/, 'the quick replies are not read off the answer line\'s day');
  assert.match(PAGE, /\{lastFromCouple \? \(/, 'quick replies are offered over a conversation the supplier already answered');
});

test('🔑 4 · the day read runs only for an unbooked thread with a date — four narrow reads, not the month', () => {
  const block = PAGE.slice(PAGE.indexOf('const dayAnswerRead'), PAGE.indexOf('})();', PAGE.indexOf('const dayAnswerRead')));
  assert.ok(block.length > 100, 'the day read moved');
  const noDate = block.indexOf("return { kind: 'no_date' }");
  const booked = block.indexOf("return { kind: 'booked' }");
  const readAt = block.indexOf('readThreadDayAnswer(');
  assert.ok(noDate > 0 && booked > noDate && readAt > booked, 'the read is no longer behind the no-date and booked answers');
  const server = read('lib/thread-day-answer.server.ts');
  assert.equal(count(server, /\.from\('/g), 4, 'the day read is no longer four narrow reads');
  assert.match(server, /buildCustomerCalendarMonth\(/, 'the day is no longer derived by the Dates screen\'s own builder');
  assert.doesNotMatch(server, /fetchVendorPools|fetchVendorPoolBookings|fetchVendorBlocks/, 'a whole-history fetcher is back on the thread');
});

test('Talk to them is the shipped accept-to-reply, in plain words', () => {
  const at = PAGE.indexOf('<form action={acceptInquiry}>');
  assert.ok(at > 0, 'the accept form is gone');
  const form = PAGE.slice(at, PAGE.indexOf('</form>', at));
  assert.match(form, /Talk to them/);
  assert.match(PAGE, /Say yes to talk — nothing is booked yet\./);
});
