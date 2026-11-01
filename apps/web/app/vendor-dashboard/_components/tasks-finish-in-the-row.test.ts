/**
 * tasks-finish-in-the-row.test.ts — ↩ EACH TASK ON TODAY FINISHES IN ITS ROW, WITH UNDO.
 *
 * Owner 2026-10-28 (corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "each task
 * finishes in its row (date change Agree / Can't, cancel request, review reply, Pay fee) with Undo"; prototype
 * `finish()` + the toast's Undo).
 *
 * The mechanism (`UndoableAnswers`) holds a pressed answer instead of sending it: the row leaves the list at once, the
 * top toast says it with Undo for the toast's own action window, Undo puts the row back with NOTHING written, and when
 * the window closes the form is submitted for real through its own shipped server action. Held as properties:
 *
 *   1 · every answer row on Today's waiting list is inside the holder, and each row carries the mark the holder hides
 *       (`data-today-ask`) — so a press can finish IN ITS ROW;
 *   2 · the holder takes the submit BEFORE React does (capture phase, `preventDefault` + `stopPropagation`), hides the
 *       row, and sends it after exactly the toast's action window — the shared `PEEK_TOAST_ACTION_MS`, never a number
 *       of its own;
 *   3 · Undo clears the timer and shows the row again — and writes nothing (it calls no action);
 *   4 · what is held is never lost: leaving the page (pagehide / hidden) and a second press send it; the held form is
 *       sent with its own button through `requestSubmit` — the shipped action and fields, unchanged;
 *   5 · the toast is the shared `PeekToast` with its one "Undo" action.
 *
 * Sabotage (2026-10-28, each run and reverted): the listener's `true` (capture) dropped · `row.hidden = true` removed ·
 * `PEEK_TOAST_ACTION_MS` → 3000 · Undo's `h.row.hidden = false` removed · the `pagehide` flush removed · the waiting
 * list drawn outside `<UndoableAnswers>` — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { WhatsNewCard } from '@/lib/vendor-overview';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const HOLD = code('app/vendor-dashboard/_components/undoable-answers.tsx');
const NOW = Date.parse('2026-10-02T02:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const DATE_CHANGE = {
  kind: 'date_change',
  id: 'dc1',
  eventId: 'e-cruz',
  eventVendorId: 'ev-cruz',
  coupleName: 'Cruz',
  currentDate: '2026-10-18',
  proposedDate: '2026-10-25',
  proposedPrecision: 'day',
  askedAt: ago(5),
} as unknown as WhatsNewCard;
const REVIEW = {
  kind: 'review',
  id: 'r1',
  reviewId: 'rv1',
  coupleName: 'Cruz',
  rating: 5,
  excerpt: 'Food was amazing!',
  createdAt: ago(30),
} as unknown as WhatsNewCard;
const REPLY = { kind: 'message', id: 'm1', threadId: 't1', eventId: 'e-ana', coupleName: 'Ana & Miguel', excerpt: 'Are you free?', lastMessageAt: ago(2) } as WhatsNewCard;

test('1 · every answer row on the waiting list sits inside the holder, marked for it to hide', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const { splitDesk } = await import('@/lib/vendor-desk-disposition');
  const cards = [REPLY, DATE_CHANGE, REVIEW];
  const { answer, news } = splitDesk(cards);
  const view = assembleSupplierToday({
    needsAnswer: answer, closed: news, deskIncomplete: false, upcoming: [], schedules: { pools: [], outside: [], complete: true },
    firstSteps: null, verified: true, findable: true, findability: null, feeBills: [], feeEnforced: true,
    earnings: { confirmedPhp: 0, expectedPhp: 0, paydayMeasured: true, owed: [] }, credit: null, payoutReadiness: 'unreadable',
    payoutHref: '/x', shop: { name: 'S', categoryWord: null, details: { done: 1, total: 1, complete: true }, awardWord: null, milestoneWord: null },
    views: null, inquiries28: null, dayFacts: null, todayIso: '2026-10-02', now: NOW, since: () => new Date(NOW),
  });
  const noop = async () => {};
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  const html = renderToStaticMarkup(React.createElement(SupplierTodayScreen, { view, outcome: null, feeForecasts: {}, cards, askStatus: '', deskIncomplete: false, actions }));
  const holder = html.indexOf('data-undoable-answers');
  const list = html.slice(html.indexOf('data-today-list="waiting"'), html.indexOf('data-today-list="week"'));
  assert.ok(holder > 0 && list.includes('data-undoable-answers'), 'the waiting list is not inside the Undo holder');
  const rows = [...list.matchAll(/data-today-ask="(\w+)"/g)].map((m) => m[1]);
  assert.ok(rows.length >= 2, `anti-vacuity: only ${rows.length} answer rows drawn`);
  // Every form in the list is inside a marked row — a press always has a row to finish in.
  const forms = [...list.matchAll(/<form\b/g)].map((m) => m.index!);
  assert.ok(forms.length > 0, 'anti-vacuity: no answer form on the list');
  for (const at of forms) assert.ok(list.lastIndexOf('data-today-ask=', at) > -1, 'an answer form sits outside any row the holder can hide');
});

test('2 · the holder takes the press before React, hides the row, and sends after the toast’s own window', () => {
  assert.match(HOLD, /el\.addEventListener\('submit', onSubmit, true\)/, 'the submit is not taken in the capture phase — React would send it at once');
  assert.match(HOLD, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);/);
  assert.match(HOLD, /form\.closest\('\[data-today-ask\],\[data-today-row-item\]'\)/);
  assert.match(HOLD, /if \(row\) row\.hidden = true;/, 'the row does not finish (leave the list) at the press');
  assert.match(HOLD, /window\.setTimeout\(send, PEEK_TOAST_ACTION_MS\)/, 'the hold is not the toast’s own Undo window');
  assert.match(HOLD, /import \{ PEEK_TOAST_ACTION_MS, PeekToast \} from '@\/app\/_components\/toast\/peek-toast';/);
});

test('3 · Undo puts the row back and writes nothing', () => {
  const undo = HOLD.slice(HOLD.indexOf('const undo = useCallback'), HOLD.indexOf('useEffect('));
  assert.match(undo, /window\.clearTimeout\(h\.timer\);/, 'Undo leaves the send armed');
  assert.match(undo, /if \(h\.row\) h\.row\.hidden = false;/, 'Undo does not put the row back');
  assert.doesNotMatch(undo, /requestSubmit|fetch\(|action/i, 'Undo writes something');
});

test('4 · a held answer is never lost — leaving and a second press send it, through its own form and button', () => {
  assert.match(HOLD, /window\.addEventListener\('pagehide', flush\)/);
  assert.match(HOLD, /document\.visibilityState === 'hidden' && send\(\)/);
  assert.match(HOLD, /if \(held\.current\) send\(\);/, 'a second press drops the first');
  assert.match(HOLD, /h\.form\.requestSubmit\(h\.submitter as HTMLButtonElement\)/, 'the held answer is not sent with its own button');
  assert.match(HOLD, /if \(passing\.current === form\) return;/, 'the real send is caught again by the holder');
});

test('5 · the toast is the shared PeekToast with its one Undo', () => {
  assert.match(HOLD, /<PeekToast[^>]*action=\{\{ label: 'Undo', onPress: undo \}\}/);
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.match(first, /const waitingBlock = \(\s*<UndoableAnswers>/, 'Today’s waiting list is not held for Undo');
});
