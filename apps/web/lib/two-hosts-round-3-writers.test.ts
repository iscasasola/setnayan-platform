/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER — ROUND 3's WRITERS (owner 2026-10-18, "build it"). Each writer #6626/#6629
 * left, brought onto the same pattern (`lib/merge-from-base.ts`): it says what it started from, and only what THIS
 * screen changed is written. The pure halves run for real; the wiring is pinned on source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { hostAnswersThisScreenChanged } from './host-answers-merge';
import { egiftFieldsThisScreenChanged } from './egift-method-merge';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('schedule · host answers: a stale box never puts back — or DELETES — the other host’s answer', () => {
  // The form was drawn with Q1 empty and Q2 "Our song". Claire has since answered Q1. Indalecio changes only Q2.
  const w = hostAnswersThisScreenChanged([
    ['answer:Q1', ''],
    ['base:Q1', ''],
    ['answer:Q2', 'The first dance'],
    ['base:Q2', 'Our song'],
  ]);
  assert.deepEqual(w.clears, [], 'the stale empty box deleted the other host’s answer (before: it did)');
  assert.deepEqual(w.upserts, [{ questionId: 'Q2', answer: 'The first dance' }]);
  // Emptying a box this screen showed filled IS a clear; an older page (no base) is taken whole.
  assert.deepEqual(hostAnswersThisScreenChanged([['answer:Q3', ' '], ['base:Q3', 'x']]).clears, ['Q3']);
  assert.deepEqual(hostAnswersThisScreenChanged([['answer:Q4', 'a']]).upserts, [{ questionId: 'Q4', answer: 'a' }]);
  assert.deepEqual(hostAnswersThisScreenChanged([['answer:Q5', ' same '], ['base:Q5', 'same']]).upserts, [], 'whitespace alone is a change');
  const action = src('app/dashboard/[eventId]/schedule/question-answers-actions.ts');
  assert.match(action, /hostAnswersThisScreenChanged\(formData\.entries\(\)\)/, 'the action writes every box again');
  const form = src('app/dashboard/[eventId]/schedule/_components/host-questions.tsx');
  assert.match(form, /name=\{`base:\$\{question\.question_id\}`\} value=\{answer \?\? ''\}/, 'the form does not say what each box showed');
});

test('e-gifts · editing a way writes only the fields this screen changed — never the old number back', () => {
  const opened = { method_kind: 'gcash', label: 'GCash', account_name: 'Maria', handle: '0917 000 0000', qr_r2_key: null, note: null };
  // Claire fixed the number to 0917 111 1111; Indalecio's form (opened before) changes only the label.
  const mine = { ...opened, label: 'Our GCash' };
  assert.deepEqual([...(egiftFieldsThisScreenChanged(JSON.stringify(opened), mine) ?? [])], ['label']);
  assert.equal(egiftFieldsThisScreenChanged(null, mine), null, 'an older page must be taken whole');
  assert.equal(egiftFieldsThisScreenChanged('{not json', mine), null);
  // A field the base does not carry counts as changed (Studio sends a base only for what it carries forward unseen).
  assert.deepEqual([...(egiftFieldsThisScreenChanged({ label: 'GCash' }, mine) ?? [])].sort(), ['account_name', 'handle', 'label', 'method_kind', 'note', 'qr_r2_key']);
  assert.deepEqual([...(egiftFieldsThisScreenChanged({ ...opened, note: '' }, opened) ?? [])], [], "'' and none are one value");
  const action = src('app/dashboard/[eventId]/pabuya/actions.ts');
  assert.match(action, /egiftFieldsThisScreenChanged\(formData\.get\(MERGE_BASE_FIELD\)/);
  assert.match(action, /onlyChanged\.has\(k as EgiftEditField\)/, 'the edit still writes every field');
  assert.match(action, /if \(qrR2Key && writesQr\) \{/, 'a stale QR is checked and redrawn as if it were new');
  const manager = src('app/dashboard/[eventId]/pabuya/_components/pabuya-manager.tsx');
  assert.match(manager, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(\{ method_kind, label, account_name, handle, qr_r2_key, note \}\)\)/, 'the E-Gifts page sends no base');
});
