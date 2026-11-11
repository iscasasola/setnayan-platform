/**
 * 🗳 THE POLL CARD'S RULES (owner 11 Nov 2026; lib/chat-polls.ts — the database holds the same, migration 20271338412990,
 * measured in tests/db/chat-decisions-file-messages-and-polls.db.test.ts).
 *
 * What would silently undo it:
 *   1. a draft the database refuses looks sendable (one choice, seven, a duplicate, an over-long one, no question);
 *   2. the tally miscounts, or a tie reads as a winner (Save as decision must then ask for the pick);
 *   3. tapping your own choice moves nothing instead of taking the vote back;
 *   4. the stream stops drawing the poll's own line as its card — or draws its close / reopen lines as a second card.
 * SABOTAGE (11 Nov): `pollLeaders` keeping only the first top choice → 2 RED.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-polls.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pollDraftProblem, pollLeaders, tallyPoll, voteForTap, type Poll } from './chat-polls';
import { pollFromLine, streamLineKind } from './chat-card-lines';

const choice = (id: string, position: number) => ({ choiceId: id, label: id[0]!.toUpperCase() + id.slice(1), position });
const poll = (votes: [string, string][]): Pick<Poll, 'choices' | 'votes'> => ({
  choices: [choice('garden', 1), choice('chapel', 2), choice('beach', 3)],
  votes: votes.map(([voterUserId, choiceId]) => ({ voterUserId, choiceId })),
});

test('1 · the draft: a question, 2–6 different choices of up to 60', () => {
  assert.equal(pollDraftProblem('Where?', ['Garden', 'Chapel']), null);
  assert.equal(pollDraftProblem('  ', ['Garden', 'Chapel']), 'question');
  assert.equal(pollDraftProblem('x'.repeat(121), ['a', 'b']), 'question');
  assert.equal(pollDraftProblem('Where?', ['Garden', '  ']), 'too_few');
  assert.equal(pollDraftProblem('Where?', ['a', 'b', 'c', 'd', 'e', 'f', 'g']), 'too_many');
  assert.equal(pollDraftProblem('Where?', ['Garden', 'x'.repeat(61)]), 'too_long');
  assert.equal(pollDraftProblem('Where?', ['Garden', ' garden ']), 'same');
});

test('2 · the tally, the winner, and a tie', () => {
  const p = poll([['maria', 'garden'], ['jose', 'garden'], ['sol', 'chapel']]);
  const t = tallyPoll(p, 'maria');
  assert.deepEqual(t.map((r) => [r.choice.choiceId, r.count, r.mine]), [['garden', 2, true], ['chapel', 1, false], ['beach', 0, false]]);
  assert.equal(Math.round(t[0]!.share * 100), 67);
  assert.deepEqual(pollLeaders(p).map((c) => c.choiceId), ['garden']);
  assert.deepEqual(pollLeaders(poll([['maria', 'garden'], ['sol', 'chapel']])).map((c) => c.choiceId), ['garden', 'chapel'], 'a tie read as a winner');
  assert.equal(pollLeaders(poll([])).length, 3, 'with no votes every choice is tied');
});

test('3 · a tap votes, moves, or takes back your own', () => {
  const p = poll([['maria', 'garden']]);
  assert.equal(voteForTap(p, 'maria', 'garden'), null, 'tapping your own choice takes the vote back');
  assert.equal(voteForTap(p, 'maria', 'chapel'), 'chapel');
  assert.equal(voteForTap(p, 'jose', 'garden'), 'garden');
});

test('4 · the stream draws the poll line as its card, and only that line', () => {
  assert.deepEqual(pollFromLine('Poll · Where is the ceremony?'), { question: 'Where is the ceremony?' });
  assert.equal(streamLineKind('Poll · Where is the ceremony?'), 'poll');
  assert.equal(streamLineKind('Poll closed · Where is the ceremony?'), null);
  assert.equal(streamLineKind('Poll reopened · Where is the ceremony?'), null);
  assert.equal(pollFromLine('Poll · '), null);
});

test('a new decision from a message takes its first words, never a cut word, and a refused filings read is null', async () => {
  const { topicFromMessage, filingsFrom } = await import('./chat-decisions');
  assert.equal(topicFromMessage('  Drone   shot at sunset? '), 'Drone shot at sunset?');
  const long = 'Can we move the drone shot to the garden at sunset instead of the chapel courtyard please';
  const t = topicFromMessage(long);
  assert.ok(t.endsWith('…') && t.length <= 61 && long.startsWith(t.slice(0, -1)), t);
  const f = filingsFrom([
    { topic_id: 'a', title: 'A', chat_decision_messages: [{ message_id: 'm1' }, { message_id: 'm2' }] },
    { topic_id: 'b', title: 'B', chat_decision_messages: null },
  ]);
  assert.deepEqual(f.topics, [{ topicId: 'a', title: 'A', filedCount: 2 }, { topicId: 'b', title: 'B', filedCount: 0 }]);
  assert.deepEqual(f.byMessage.get('m2'), { topicId: 'a', title: 'A' });
});
