/**
 * day-of-tail.test.ts — the day-of tail: things measured by the wrong clock,
 * which only misbehave on the day itself.
 *
 * Same family as the wall-clock work of 2026-08-04, graded LOW because nothing
 * errors. Neither is low for a guest.
 *
 * ⚠ THE COUNTDOWN IS DELIBERATELY NOT CHANGED HERE, and this is the record of
 * why. It targets `events.event_date` via `new Date(iso)` — midnight UTC — so
 * it expires at 08:00 Manila on the wedding morning. The obvious fix is to
 * target the venue's midnight instead, and I built it before measuring it:
 *
 *      Manila    old 18 Dec 08:00 → new 18 Dec 00:00   EIGHT HOURS WORSE
 *      New York  old 17 Dec 19:00 → new 18 Dec 00:00   five hours better
 *
 * Better for the Americas, WORSE for the primary market, because a countdown to
 * the START of a day is not what "Until we say I do" means. The honest fix is
 * to count to the CEREMONY, which needs the schedule the widget is not given —
 * a real change, not a one-liner. Reverted rather than shipped.
 *
 * WHAT IS FIXED HERE: "HAPPENING NOW" NEVER ENDED. A block's virtual end is its
 * own `end_at`, else the next block's start. The FINAL block has no next, so
 * that was `null` — and the loop reads null as "still running". A couple who
 * left the last item's end time blank had a page saying "Happening now ·
 * Send-off" with a pulsing dot for the rest of the site's life, to every guest
 * who ever opened it again.
 *
 * 🔑 TESTED AGAINST TWO EXPLICIT ZONES. CI runs in UTC, the one clock
 * where these mistakes cancel out — which is exactly why they survived. Never
 * compare local-to-venue here; compare venue-to-venue.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eventDateToEpoch } from './day-of-mode';

const MANILA = 'Asia/Manila';
const NEW_YORK = 'America/New_York';

test('a wedding day starts at midnight in the VENUE, not in UTC', () => {
  const manila = eventDateToEpoch('2026-12-18', MANILA);
  // Manila is UTC+8, so its midnight is 16:00 UTC on the 17th.
  assert.equal(
    new Date(manila).toISOString(),
    '2026-12-17T16:00:00.000Z',
    'A Manila wedding day must begin at Manila midnight.',
  );

  const newYork = eventDateToEpoch('2026-12-18', NEW_YORK);
  assert.equal(
    new Date(newYork).toISOString(),
    '2026-12-18T05:00:00.000Z',
    'And a New York wedding day at New York midnight — the opposite side of UTC, ' +
      'which is where the old code failed by a whole day rather than by hours.',
  );

  assert.notEqual(manila, newYork, 'the two zones must not resolve to one instant');
});

/**
 * The schedule's virtual-end rule, extracted so it can be tested without
 * mounting a React tree. Mirrors `ends[]` in schedule-widget.tsx: own end, else
 * the next block's start, else the end of its own day IN THE VENUE'S CLOCK.
 */
function virtualEnd(
  startMs: number,
  ownEndMs: number | null,
  nextStartMs: number | null,
  tz: string,
): number {
  if (ownEndMs !== null) return ownEndMs;
  if (nextStartMs !== null) return nextStartMs;
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startMs));
  return eventDateToEpoch(day, tz) + 86_400_000;
}

test('an open-ended final block ends with its own day, not never', () => {
  const sendOff = Date.parse('2026-12-18T22:00:00+08:00');
  const end = virtualEnd(sendOff, null, null, MANILA);

  // Still "now" during the send-off itself.
  assert.ok(end > Date.parse('2026-12-18T23:30:00+08:00'), 'the send-off is still running at 11:30 PM');

  // But NOT a week later — the actual bug: null read as "still running" forever.
  assert.ok(
    end < Date.parse('2026-12-19T00:30:00+08:00'),
    'The last block still has no end. A couple who left it blank has "Happening ' +
      'now · Send-off" pulsing on their page months after the wedding.',
  );
});

test('a block that genuinely runs past midnight keeps its own end', () => {
  // The cap must never override real data — that field exists for exactly this.
  const start = Date.parse('2026-12-18T22:00:00+08:00');
  const realEnd = Date.parse('2026-12-19T02:00:00+08:00');
  assert.equal(
    virtualEnd(start, realEnd, null, MANILA),
    realEnd,
    'An explicit end_at must win over the end-of-day cap.',
  );
});

test('and a non-final block still ends when the next one starts', () => {
  const start = Date.parse('2026-12-18T14:00:00+08:00');
  const nextStart = Date.parse('2026-12-18T15:00:00+08:00');
  assert.equal(virtualEnd(start, null, nextStart, MANILA), nextStart);
});
