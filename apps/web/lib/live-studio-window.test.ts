import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * THE BROADCAST UNLOCK — one unlock, for the life of the event (LS6 · owner-ruled
 * 2026-09-02, retiring the per-event-DAY model these tests used to pin).
 *
 * The property these tests exist to hold, now that there is only one:
 *
 *   1. OWNERSHIP IS THE WHOLE TEST. An event that owns LIVE_STUDIO gets multi-cam,
 *      unconditionally, forever — no anchor, no fold, no expiry, no grant-kind
 *      metering split. `owned: false` is the only path to `multiCam: false`.
 *
 * A second block below (unchanged by LS6) pins the 12-hour YouTube archive-cap
 * warning, which is a per-stream technical limit unrelated to how Live Studio is
 * billed.
 */
import {
  ARCHIVE_WARN_AT_HOURS,
  YOUTUBE_ARCHIVE_HOURS,
  decideArchiveGuard,
  decideBroadcastWindow,
} from './live-studio-window';

const T0 = '2026-08-01T10:00:00.000Z';
const t0 = new Date(T0);

function at(hours: number): Date {
  return new Date(t0.getTime() + hours * 3_600_000);
}

/* ── 1 · OWNERSHIP IS THE WHOLE TEST ──────────────────────────────────────────── */

test('owned ⇒ multiCam, unconditionally', () => {
  const d = decideBroadcastWindow({ owned: true });
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'owned');
});

test('not owned ⇒ no multiCam, the free tier', () => {
  const d = decideBroadcastWindow({ owned: false });
  assert.equal(d.multiCam, false);
  assert.equal(d.reason, 'not-owned');
});

test('🔒 an event bought long ago and never touched since still owns multi-cam today', () => {
  // The whole point of LS6: there is no anchor and no clock to have lapsed. An
  // event "bought" (in spirit) a year before this render still reads owned=true →
  // multiCam=true, because `decideBroadcastWindow` never even looks at time.
  const d = decideBroadcastWindow({ owned: true });
  assert.equal(d.multiCam, true, 'ownership must not expire — LS6 retired every clock');
});

test('decideBroadcastWindow is TOTAL over its only input', () => {
  // Every boolean maps to exactly one WindowDecision — no branch left to reason
  // about beyond the boolean itself.
  assert.deepEqual(decideBroadcastWindow({ owned: true }), { multiCam: true, reason: 'owned' });
  assert.deepEqual(decideBroadcastWindow({ owned: false }), {
    multiCam: false,
    reason: 'not-owned',
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · THE 12-HOUR ARCHIVE GUARDRAIL (§ 4f ③) — UNTOUCHED BY LS6, a per-stream
   YouTube limit unrelated to how Live Studio is billed.
   ══════════════════════════════════════════════════════════════════════════════ */

test('no broadcast on air → no archive guard', () => {
  const g = decideArchiveGuard({ startedAt: null, isLive: false, now: t0 });
  assert.equal(g.warn, false);
  assert.equal(g.exceeded, false);
  assert.equal(g.hoursElapsed, null);
});

test('isLive but startedAt unreadable → no guard rather than a guess', () => {
  const g = decideArchiveGuard({ startedAt: null, isLive: true, now: t0 });
  assert.equal(g.warn, false);
  assert.equal(g.hoursElapsed, null);
});

test(`under ${ARCHIVE_WARN_AT_HOURS}h elapsed → no warning yet`, () => {
  const g = decideArchiveGuard({
    startedAt: T0,
    isLive: true,
    now: at(ARCHIVE_WARN_AT_HOURS - 1),
  });
  assert.equal(g.warn, false);
  assert.equal(g.exceeded, false);
  assert.equal(g.hoursElapsed, ARCHIVE_WARN_AT_HOURS - 1);
});

test(`at ${ARCHIVE_WARN_AT_HOURS}h elapsed → warns, not exceeded`, () => {
  const g = decideArchiveGuard({ startedAt: T0, isLive: true, now: at(ARCHIVE_WARN_AT_HOURS) });
  assert.equal(g.warn, true);
  assert.equal(g.exceeded, false);
  assert.equal(g.hoursToCap, YOUTUBE_ARCHIVE_HOURS - ARCHIVE_WARN_AT_HOURS);
});

test(`at ${YOUTUBE_ARCHIVE_HOURS}h elapsed → exceeded`, () => {
  const g = decideArchiveGuard({ startedAt: T0, isLive: true, now: at(YOUTUBE_ARCHIVE_HOURS) });
  assert.equal(g.warn, true);
  assert.equal(g.exceeded, true);
  assert.equal(g.hoursToCap, 0);
});

test('well past the cap → hoursToCap clamps at 0, never negative', () => {
  const g = decideArchiveGuard({
    startedAt: T0,
    isLive: true,
    now: at(YOUTUBE_ARCHIVE_HOURS + 20),
  });
  assert.equal(g.hoursToCap, 0);
  assert.equal(g.exceeded, true);
});

test('a start stamped in the future (clock skew) reads as just-started, not negative hours', () => {
  const g = decideArchiveGuard({ startedAt: at(1), isLive: true, now: t0 });
  assert.equal(g.hoursElapsed, 0);
  assert.equal(g.warn, false);
});

test('a fresh broadcast after a prior one gets a fresh 12 hours — measured from ITS OWN start', () => {
  // The cap is per-stream, not per-event — ending one broadcast and starting
  // another resets the clock, unaffected by how long the event has owned Live
  // Studio or when it first went live.
  const g = decideArchiveGuard({ startedAt: at(20), isLive: true, now: at(21) });
  assert.equal(g.hoursElapsed, 1);
  assert.equal(g.warn, false);
  assert.equal(g.exceeded, false);
});
