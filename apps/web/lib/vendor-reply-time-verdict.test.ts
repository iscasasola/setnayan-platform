import test from 'node:test';
import assert from 'node:assert/strict';

import {
  replyTimeVerdict,
  replyTimeBadgeLabel,
  formatReplyMinutes,
  REPLY_TIME_MIN_SAMPLE,
  FAST_REPLY_THRESHOLD_MIN,
  RECENTLY_ACTIVE_MS,
  type ReplyTimeInputs,
} from './vendor-reply-time';

const NOW = Date.parse('2026-08-28T00:00:00Z');
const FRESH = new Date(NOW - 60_000).toISOString();
const STALE = new Date(NOW - RECENTLY_ACTIVE_MS - 60_000).toISOString();

const base: ReplyTimeInputs = {
  avgResponseMinutes: 120,
  repliedThreadCount: 5,
  lastActiveAt: FRESH,
  now: NOW,
};

test('the shown case carries the exact words the public badge uses', () => {
  const v = replyTimeVerdict(base);
  assert.equal(v.shown, true);
  assert.equal(v.shown && v.label, 'Usually responds in 2h');
  assert.equal(v.shown && v.sample, 5);
});

test('EVERY refusal is named — the shop can tell them apart', () => {
  const cases: [Partial<ReplyTimeInputs>, string][] = [
    [{ repliedThreadCount: REPLY_TIME_MIN_SAMPLE - 1 }, 'not_enough_replies'],
    [{ repliedThreadCount: 0 }, 'not_enough_replies'],
    [{ avgResponseMinutes: 0 }, 'no_median'],
    [{ avgResponseMinutes: null }, 'no_median'],
    [{ avgResponseMinutes: Number.NaN }, 'no_median'],
    [{ avgResponseMinutes: FAST_REPLY_THRESHOLD_MIN }, 'too_slow'],
    [{ lastActiveAt: STALE }, 'away'],
    [{ lastActiveAt: null }, 'away'],
    [{ lastActiveAt: 'not-a-date' }, 'away'],
  ];
  const seen = new Set<string>();
  for (const [patch, reason] of cases) {
    const v = replyTimeVerdict({ ...base, ...patch });
    assert.equal(v.shown, false, JSON.stringify(patch));
    assert.equal(v.shown === false && v.reason, reason, JSON.stringify(patch));
    seen.add(reason);
  }
  assert.equal(seen.size, 4, 'all four refusals must be reachable');
});

test('THE SAMPLE FLOOR IS CHECKED FIRST — a fast median from one reply is still refused', () => {
  const v = replyTimeVerdict({ ...base, avgResponseMinutes: 1, repliedThreadCount: 1 });
  assert.equal(v.shown === false && v.reason, 'not_enough_replies');
});

test('0 is the NO-DATA sentinel, never "answered instantly"', () => {
  const v = replyTimeVerdict({ ...base, avgResponseMinutes: 0 });
  assert.equal(v.shown, false);
  assert.equal(replyTimeBadgeLabel({ ...base, avgResponseMinutes: 0 }), null);
});

test('ONE DECISION, TWO SHAPES: the badge label is byte-identical to the verdict, always', () => {
  const mins = [null, 0, 1, 12, 59, 60, 61, 119, 120, 239, 240, 241, 10_000];
  const samples = [0, 1, 2, 3, 4, 50];
  const actives = [FRESH, STALE, null, 'junk'];
  let shownCount = 0;
  let hiddenCount = 0;
  for (const m of mins) {
    for (const s of samples) {
      for (const a of actives) {
        const input: ReplyTimeInputs = {
          avgResponseMinutes: m,
          repliedThreadCount: s,
          lastActiveAt: a,
          now: NOW,
        };
        const verdict = replyTimeVerdict(input);
        const label = replyTimeBadgeLabel(input);
        assert.equal(label, verdict.shown ? verdict.label : null, JSON.stringify(input));
        if (verdict.shown) shownCount += 1;
        else hiddenCount += 1;
      }
    }
  }
  // ANTI-VACUITY: a matrix that only ever produced nulls would pass trivially.
  assert.ok(shownCount > 0 && hiddenCount > 0, `shown=${shownCount} hidden=${hiddenCount}`);
});

test('the explanation prints the SAME duration the badge does', () => {
  assert.equal(formatReplyMinutes(45), '45m');
  assert.equal(formatReplyMinutes(120), '2h');
  const v = replyTimeVerdict({ ...base, avgResponseMinutes: 45 });
  assert.ok(v.shown && v.label.endsWith(formatReplyMinutes(45)));
});
