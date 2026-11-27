/**
 * send-waits-for-yes-or-no.test.ts — ✋ THE REPLY'S SEND IS DISABLED UNTIL YES OR NO IS PICKED.
 *
 * Owner walk 2026-11-27 (MASTER-PLAN B8): "Send is enabled before Yes/No is picked." A card that asks (it draws the
 * `rsvp_status` radios) keeps Send disabled until one is picked; a card that asks nothing (a locked answer, the
 * "Not coming after all?" press with its answer hidden) never waits. The rule is `replyAnswerMissing`; the form reads
 * it off its own radios on every change (`ReplyForm`), and every Send of the card is a `ReplySubmit`, which obeys it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { replyAnswerMissing } from '@/lib/reply-send';

test('the rule: radios drawn and none picked → wait; one picked, or no radios → send', () => {
  assert.equal(replyAnswerMissing([{ checked: false }, { checked: false }]), true);
  assert.equal(replyAnswerMissing([{ checked: true }, { checked: false }]), false);
  assert.equal(replyAnswerMissing([{ checked: false }, { checked: true }]), false);
  assert.equal(replyAnswerMissing([]), false, 'a card that asks nothing must never lock its own button');
});

test('the form reads its own radios on load and on every change, and Send obeys', () => {
  const form = readFileSync(join(__dirname, 'reply-form.tsx'), 'utf8');
  assert.match(form, /querySelectorAll<HTMLInputElement>\('input\[type="radio"\]\[name="rsvp_status"\]'\)/, 'the form no longer reads the answer radios');
  assert.match(form, /<form ref=\{formEl\} action=\{action\} onSubmit=\{onSubmit\} onChange=\{readAnswer\}/, 'a pick no longer re-reads the answer');
  assert.match(form, /useEffect\(readAnswer, \[\]\)/, 'the form does not read the answer once it is on the page');
  assert.match(form, /disabled=\{Boolean\(props\.disabled\) \|\| answerMissing\}/, 'Send no longer waits for an answer');
});

test('every Send on the reply card is a ReplySubmit inside a ReplyForm — none escapes the rule', () => {
  const card = readFileSync(join(__dirname, 'rsvp-widget.tsx'), 'utf8');
  const sends = card.match(/<ReplySubmit\b/g) ?? [];
  assert.ok(sends.length >= 3, `anti-vacuity: ${sends.length} Send buttons`);
  assert.doesNotMatch(card, /<SubmitButton\b|<button[^>]*type="submit"/, 'a Send on the card is not a ReplySubmit');
});
