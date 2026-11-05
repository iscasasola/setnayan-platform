/**
 * the-requests-sheet-saves-in-place.test.ts — 🔁 APPROVE AND DECLINE SAVE IN PLACE (audit 2026-11-02 #15). Each Approve
 * or Decline ended in `redirect(…?view=event-day)` from a `<form action>`, which closed the Requests sheet after every
 * press, and a refusal went to the error page (a thrown message is blanked in production). Held as properties:
 *   1. the door ANSWERS — `resolveScheduleSuggestion` and Approve all redirect nowhere and return `{ ok, error }`;
 *   2. the sheet decides through `RequestDecision`, which reads the answer and says a refusal under the buttons;
 *   3. an answer is read honestly — a refusal or an unreadable answer is never "done".
 * Sabotage (2026-11-02, each reverted, each red): the `redirect(` restored at the end of resolveScheduleSuggestion (1) ·
 * the sheet back on `<form action={resolveScheduleSuggestion}>` (2) · `requestAnswerOf` treating any object as ok (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { REQUEST_NOT_SENT, requestAnswerOf } from '@/lib/schedule-request-answer';

const S = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'schedule');
const code = (...p: string[]) => stripComments(readFileSync(join(S, ...p), 'utf8'));
const body = (src: string, name: string) => {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  return src.slice(at, src.indexOf('\n}\n', at));
};

test('1 · the door answers and redirects nowhere', () => {
  const actions = code('actions.ts');
  for (const fn of ['resolveScheduleSuggestion', 'approveAllScheduleSuggestions']) {
    const b = body(actions, fn);
    assert.doesNotMatch(b, /redirect\(`\/dashboard/, `${fn} still redirects — the sheet closes after every press`);
    assert.match(b, /Promise<ScheduleRequestAnswer>/, `${fn} does not answer in words`);
    assert.match(b, /return \{ ok: (?:true|false)/, `${fn} never returns its answer`);
  }
});

test('2 · the sheet decides through RequestDecision, which says a refusal in place', () => {
  const sheet = body(code('_components', 'day-sheets.tsx'), 'RequestsSheet');
  assert.doesNotMatch(sheet, /<form action=\{resolveScheduleSuggestion\}/, 'a request is decided by a form that navigates');
  assert.match(sheet, /<RequestDecision\b[^>]*decide=\{resolveScheduleSuggestion\}/, 'the sheet does not decide through RequestDecision');
  assert.match(sheet, /if \(!answer\.ok\) setAllProblem\(answer\.error\)/, 'Approve all does not say a refusal');
  const d = code('_components', 'request-decision.tsx');
  assert.match(d, /const answer = requestAnswerOf\(raw\);\s*if \(!answer\.ok\) setProblem\(answer\.error\);/, 'RequestDecision does not read the answer');
  assert.match(d, /role="alert"/, 'a refusal is not said');
  assert.doesNotMatch(d, /router\.push|redirect\(|window\.location/, 'a decision navigates away');
});

test('3 · an answer is read honestly', () => {
  assert.deepEqual(requestAnswerOf({ ok: true }), { ok: true });
  assert.deepEqual(requestAnswerOf(undefined), { ok: true }, 'a stand-in door that answers nothing is done');
  assert.deepEqual(requestAnswerOf({ ok: false, error: 'That change is gone.' }), { ok: false, error: 'That change is gone.' });
  assert.deepEqual(requestAnswerOf({ ok: false }), { ok: false, error: REQUEST_NOT_SENT }, 'a wordless refusal reads as done');
  assert.deepEqual(requestAnswerOf('weird'), { ok: false, error: REQUEST_NOT_SENT }, 'an unreadable answer reads as done');
  assert.deepEqual(requestAnswerOf({ nope: 1 }), { ok: false, error: REQUEST_NOT_SENT });
});
