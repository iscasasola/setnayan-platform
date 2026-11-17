/**
 * 🎬 The award queue and its ONE Today line (DECISION_LOG e5ec685d picks 7 + 8). Sabotage seen red: sort badges before
 * seals → red; let a finished flow come back → red; resume at step 0 instead of the saved step → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderAwardQueue, todayAwardLine, validFlowStep, type AwardItem, type FlowProgress } from './award-queue';

const badge = (key: string, at: string): AwardItem => ({ kind: 'badge', key, title: key, earnedAt: at });
const ITEMS: AwardItem[] = [
  badge('gifts_given:tier1', '2026-11-15T03:00:00Z'),
  { kind: 'seal', key: 'verified', title: 'SETNAYAN Verified', earnedAt: '2026-11-15T05:00:00Z' },
  badge('completed_bookings:tier1', '2026-11-15T01:00:00Z'),
  { kind: 'no1', key: 'seal:no1:2026', title: 'No. 1 Supplier of the Year', earnedAt: '2026-11-15T09:00:00Z' },
];

test('No. 1 → the other seals → badges in the order earned', () => {
  assert.deepEqual(orderAwardQueue(ITEMS).map((i) => i.key), ['seal:no1:2026', 'verified', 'completed_bookings:tier1', 'gifts_given:tier1']);
});

test('one line: News until opened, button "See it", the rest counted', () => {
  const line = todayAwardLine(ITEMS, {});
  assert.deepEqual(line, {
    tone: 'news',
    text: 'You earned No. 1 Supplier of the Year · +3 more',
    action: 'See it',
    flowKey: 'seal:no1:2026',
    resumeStep: 0,
    waiting: 4,
  });
  assert.doesNotMatch(line!.text, /claim/i);
});

test('Later mid-flow: To do, resumes at the EXACT step; a finished flow never comes back', () => {
  const progress: Record<string, FlowProgress> = {
    'seal:no1:2026': { flowKey: 'seal:no1:2026', step: 9, totalSteps: 9, openedAt: 'x', finishedAt: 'x' },
    verified: { flowKey: 'verified', step: 3, totalSteps: 7, openedAt: 'x', finishedAt: null },
  };
  const line = todayAwardLine(ITEMS, progress)!;
  assert.equal(line.tone, 'todo');
  assert.equal(line.flowKey, 'verified');
  assert.equal(line.resumeStep, 3);
  assert.equal(line.text, 'Continue SETNAYAN Verified · 3 of 7');
  assert.equal(line.waiting, 3);
});

test('progress unread (null) still shows the award as News — never a made-up step; nothing waiting = no line', () => {
  assert.equal(todayAwardLine(ITEMS, null)!.tone, 'news');
  assert.equal(todayAwardLine([], {}), null);
});

test('a step is checked: whole, 0…200, never past the flow', () => {
  assert.deepEqual(validFlowStep(3, 7), { step: 3, totalSteps: 7 });
  assert.deepEqual(validFlowStep(0, undefined), { step: 0, totalSteps: null });
  for (const [s, t] of [[-1, 7], [1.5, 7], [8, 7], ['3', 7], [3, 0], [201, null]] as const) assert.equal(validFlowStep(s, t), null);
});
