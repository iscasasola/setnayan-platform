/** A smaller plan pauses the newest seats; the founder, the free Helper and a hand-locked seat are never moved. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatsToPauseAndResume, type PauseMember } from './seat-pause';

const m = (id: string, created: string, duty: string, extra: Partial<PauseMember> = {}): PauseMember => ({
  memberId: id, userId: `u-${id}`, role: duty === 'helper' ? 'viewer' : 'agent', duty, createdAt: created, deactivatedAt: null, pausedByPlanAt: null, ...extra,
});
const team = [
  m('ana', '2026-01-01', 'shop_manager', { userId: 'founder' }),
  m('bea', '2026-02-01', 'account_manager'),
  m('joy', '2026-03-01', 'account_manager'),
  m('carlo', '2026-04-01', 'helper'),
];

test('Plus holds 1 seat: the newest counted seat pauses; the founder and the free Helper stay', () => {
  assert.deepEqual(seatsToPauseAndResume(team, 'founder', 1), { pause: ['joy'], resume: [] });
});

test('a plan with room brings back only what the plan paused, never a seat locked by hand', () => {
  const after = team.map((x) =>
    x.memberId === 'joy' ? { ...x, deactivatedAt: 't', pausedByPlanAt: 't' } : x.memberId === 'bea' ? { ...x, deactivatedAt: 't' } : x,
  );
  assert.deepEqual(seatsToPauseAndResume(after, 'founder', 6), { pause: [], resume: ['joy'] });
});

test('no limit pauses nobody; a plan with no seats pauses every counted seat', () => {
  assert.deepEqual(seatsToPauseAndResume(team, 'founder', Infinity), { pause: [], resume: [] });
  assert.deepEqual(seatsToPauseAndResume(team, 'founder', 0), { pause: ['bea', 'joy'], resume: [] });
});
