import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  askedQuestions,
  buildQuestionnaire,
  cleanAnswer,
  startersNotYetAdded,
  STARTER_QUESTIONS,
  ANSWER_MAX,
  type VendorQuestion,
  type QuestionAnswer,
} from './emcee-questions';

function q(id: string, order: number, is_asked = true, prompt = `Q ${id}`): VendorQuestion {
  return {
    question_id: id,
    vendor_profile_id: 'v1',
    prompt,
    hint: null,
    is_asked,
    display_order: order,
  };
}
function a(question_id: string, answer: string): QuestionAnswer {
  return { event_id: 'e1', question_id, answer, updated_at: '2026-09-18T00:00:00Z' };
}

test('asked questions are his, in his order, retired ones left out', () => {
  const out = askedQuestions([q('b', 20), q('a', 10), q('x', 5, false)]);
  assert.deepEqual(out.map((r) => r.question_id), ['a', 'b']);
});

test('the pronunciation question leads the starter set — it is the reason this exists', () => {
  assert.match(STARTER_QUESTIONS[0]!.prompt, /say your names/i);
  // "Ask only what the app cannot know" — never the venue or the date.
  for (const s of STARTER_QUESTIONS) {
    assert.doesNotMatch(s.prompt, /\bvenue\b|\bdate\b|how many guests/i, s.prompt);
  }
});

test('a starter he already has — even retired, even re-spaced — is not offered back', () => {
  const first = STARTER_QUESTIONS[0]!.prompt;
  const retiredCopy = q('r', 1, false, `  ${first.toUpperCase().replace(/ /g, '  ')} `);
  const left = startersNotYetAdded([retiredCopy]);
  assert.equal(left.length, STARTER_QUESTIONS.length - 1);
  assert.ok(!left.some((s) => s.prompt === first));
});

test('answered counts only the questions he is still asking', () => {
  const qs = [q('a', 1), q('b', 2), q('gone', 3, false)];
  const out = buildQuestionnaire(qs, [a('a', 'NYO-ee'), a('gone', 'kept for this wedding')]);
  assert.equal(out.total, 2);
  assert.equal(out.answered, 1);
  // The retired-but-answered one still SHOWS — the couple typed it for him.
  assert.deepEqual(out.rows.map((r) => r.question.question_id), ['a', 'b', 'gone']);
  assert.equal(out.rows[1]!.answer, null);
});

test('a whitespace answer is not an answer', () => {
  const out = buildQuestionnaire([q('a', 1)], [a('a', '   ')]);
  assert.equal(out.answered, 0);
  assert.equal(out.rows[0]!.answer, null);
});

test('a retired question with no answer does not appear at all', () => {
  const out = buildQuestionnaire([q('gone', 1, false)], []);
  assert.equal(out.rows.length, 0);
  assert.equal(out.total, 0);
});

test('cleanAnswer trims, clamps, and turns an empty box into "clear it"', () => {
  assert.equal(cleanAnswer('  hi  '), 'hi');
  assert.equal(cleanAnswer('   '), null);
  assert.equal(cleanAnswer(null), null);
  assert.equal(cleanAnswer('x'.repeat(ANSWER_MAX + 50))!.length, ANSWER_MAX);
});
