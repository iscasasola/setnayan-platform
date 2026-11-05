/**
 * lib/host-answers-merge.ts — THE HOST'S QUESTIONS, ANSWERED ON TWO SCREENS (owner 2026-10-18, round 3 of "two hosts
 * never overwrite each other"; the pattern is `lib/merge-from-base.ts`).
 *
 * The Schedule's host-questions form posts EVERY box at once (`saveHostAnswers`). A form opened before the other
 * host answered re-sent its stale boxes and won — and an empty stale box DELETED the answer the other host had just
 * written. Now each box also posts what it showed when the page was drawn (`base:<question_id>`), and only the boxes
 * THIS screen changed are written or cleared. A box both screens changed: the later save wins (one answer, one row).
 * A box with no base (an older page) is taken as before.
 *
 * Pure: the action and its test use it.
 */
import { cleanAnswer } from './emcee-questions';

export const HOST_ANSWER_FIELD = 'answer:';
export const HOST_ANSWER_BASE_FIELD = 'base:';

export type HostAnswerWrites = { upserts: Array<{ questionId: string; answer: string }>; clears: string[] };

export function hostAnswersThisScreenChanged(entries: Iterable<[string, unknown]>): HostAnswerWrites {
  const answers = new Map<string, unknown>();
  const bases = new Map<string, unknown>();
  for (const [key, value] of entries) {
    if (key.startsWith(HOST_ANSWER_FIELD)) answers.set(key.slice(HOST_ANSWER_FIELD.length), value);
    else if (key.startsWith(HOST_ANSWER_BASE_FIELD)) bases.set(key.slice(HOST_ANSWER_BASE_FIELD.length), value);
  }
  const out: HostAnswerWrites = { upserts: [], clears: [] };
  for (const [questionId, value] of answers) {
    if (!questionId) continue;
    const answer = cleanAnswer(value);
    // 👥 This screen did not touch the box: whatever the other host wrote there stands.
    if (bases.has(questionId) && cleanAnswer(bases.get(questionId)) === answer) continue;
    if (answer === null) out.clears.push(questionId);
    else out.upserts.push({ questionId, answer });
  }
  return out;
}
