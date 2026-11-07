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
 * 🔁 RE-AIMED 2026-11-08 (THE ONE BUILD A7/A8): Today's rows JUMP now (owner v112 *"Jump"*), so the answers that
 * finished in Today's rows finish on the page they land on. The holder's own anchor moved with the two answers that
 * lived only on Today — the client's Details (`client-day-answers.tsx`): the same rules (the undo window, never lost)
 * hold there. Tests 2–4 (the holder itself) are unchanged.
 *
 * Sabotage (2026-10-28, each run and reverted): the listener's `true` (capture) dropped · `row.hidden = true` removed ·
 * `PEEK_TOAST_ACTION_MS` → 3000 · Undo's `h.row.hidden = false` removed · the `pagehide` flush removed · the waiting
 * list drawn outside `<UndoableAnswers>` — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

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

test('1 · every answer on the client’s Details sits inside the holder, in a row marked for it to hide', () => {
  const body = code('app/vendor-dashboard/_components/client-day-answers.tsx');
  const held = body.slice(body.indexOf('<UndoableAnswers>'), body.indexOf('</UndoableAnswers>'));
  assert.ok(held.length > 100, 'the answers are not inside the Undo holder');
  assert.match(held, /<div key=\{card\.id\}[^>]*data-today-row-item=""/, 'an answer sits in no row the holder can hide');
  assert.match(held, /<DateChangeBody\b/, 'anti-vacuity: the date-change answer is not in the holder');
  assert.match(held, /<DeleteRequestBody\b/, 'anti-vacuity: the delete-request answer is not in the holder');
  // Every form those bodies draw posts a shipped action — the holder sends it through its own button.
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  for (const fn of ['DateChangeBody', 'DeleteRequestBody']) {
    const at = sections.indexOf(`export function ${fn}(`);
    const src = sections.slice(at, sections.indexOf('\n}\n', at));
    assert.ok((src.match(/<form action=\{/g) ?? []).length >= 2, `${fn}: its answers are not forms the holder can hold`);
  }
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
  const details = code('app/vendor-dashboard/_components/client-day-answers.tsx');
  assert.match(details, /<UndoableAnswers>/, 'the client’s answers are not held for Undo');
});
