import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FAST_REPLY_THRESHOLD_MIN,
  REPLY_TIME_MIN_SAMPLE,
  replyTimeBadgeLabel,
} from './vendor-reply-time';

const NOW = Date.parse('2026-08-24T00:00:00Z');
const RECENT = '2026-08-23T00:00:00Z';
const STALE = '2026-06-01T00:00:00Z';

const base = {
  avgResponseMinutes: 30,
  repliedThreadCount: 5,
  lastActiveAt: RECENT,
  now: NOW,
};

test('a real record earns the badge', () => {
  assert.equal(replyTimeBadgeLabel(base), 'Usually responds in 30m');
  assert.equal(
    replyTimeBadgeLabel({ ...base, avgResponseMinutes: 125 }),
    'Usually responds in 2h',
  );
});

test('ONE reply is not a habit — no badge below the sample floor', () => {
  for (let n = 0; n < REPLY_TIME_MIN_SAMPLE; n++) {
    assert.equal(
      replyTimeBadgeLabel({ ...base, repliedThreadCount: n }),
      null,
      `${n} replies must not earn "usually"`,
    );
  }
  assert.ok(replyTimeBadgeLabel({ ...base, repliedThreadCount: REPLY_TIME_MIN_SAMPLE }));
});

test('below the floor the badge is ABSENT — never hedged', () => {
  // A hedge is still a claim, and it teaches a reader to trust unhedged ones
  // for reasons they cannot check.
  const out = replyTimeBadgeLabel({ ...base, repliedThreadCount: 1 });
  assert.equal(out, null);
  assert.notEqual(out, 'Usually responds in 30m (1 reply)');
});

test('0 is NO DATA, not instant — the defect that shipped', () => {
  // A shop that has never replied to anybody was advertised as
  // "Usually responds in 0m" because one consumer checked only `!== null`.
  assert.equal(
    replyTimeBadgeLabel({ ...base, avgResponseMinutes: 0, repliedThreadCount: 9 }),
    null,
  );
});

test('an impossible or unreadable median says nothing', () => {
  for (const avg of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
    assert.equal(replyTimeBadgeLabel({ ...base, avgResponseMinutes: avg }), null);
  }
});

test('a missing sample count is treated as none, never as enough', () => {
  assert.equal(replyTimeBadgeLabel({ ...base, repliedThreadCount: null }), null);
  assert.equal(replyTimeBadgeLabel({ ...base, repliedThreadCount: undefined }), null);
  assert.equal(replyTimeBadgeLabel({ ...base, repliedThreadCount: Number.NaN }), null);
});

test('slow is not fast, and the boundary is exclusive', () => {
  assert.equal(
    replyTimeBadgeLabel({ ...base, avgResponseMinutes: FAST_REPLY_THRESHOLD_MIN }),
    null,
    'exactly four hours is not "fast"',
  );
  assert.ok(
    replyTimeBadgeLabel({ ...base, avgResponseMinutes: FAST_REPLY_THRESHOLD_MIN - 1 }),
  );
});

test('a fast replier who has gone away is not a fast replier', () => {
  assert.equal(replyTimeBadgeLabel({ ...base, lastActiveAt: STALE }), null);
  assert.equal(replyTimeBadgeLabel({ ...base, lastActiveAt: null }), null);
  assert.equal(replyTimeBadgeLabel({ ...base, lastActiveAt: 'not a date' }), null);
});

test('the clock is injected, so the answer does not move with the machine', () => {
  // Same inputs, a week later: the login is now stale and the badge goes.
  const weekLater = NOW + 8 * 24 * 60 * 60 * 1000;
  assert.ok(replyTimeBadgeLabel(base));
  assert.equal(replyTimeBadgeLabel({ ...base, now: weekLater }), null);
});
