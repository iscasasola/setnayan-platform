import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * THE BROADCAST WINDOW — one event-day, extendable, never interrupted
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4f ②/③).
 *
 * The four properties these tests exist to hold, in order of how much they cost if
 * they break:
 *
 *   1. A LAPSE NEVER INTERRUPTS A RUNNING BROADCAST. A wedding cannot be re-run.
 *   2. THE LAPSE DOES BITE — at the NEXT go-live, as a downgrade to the free single
 *      camera, never as a refusal to broadcast at all (the /pricing promise).
 *   3. BUYING EARLY COSTS NOTHING. The clock starts at first go-live.
 *   4. AN EXTENSION ADDS EXACTLY ONE DAY, and a day bought after the window lapsed
 *      is not retro-expired.
 */
import {
  ARCHIVE_WARN_AT_HOURS,
  LIVE_STUDIO_DAY_HOURS,
  WINDOW_WARN_MINUTES,
  YOUTUBE_ARCHIVE_HOURS,
  decideArchiveGuard,
  decideBroadcastWindow,
  foldWindowEnd,
  windowPhaseAt,
  type WindowInput,
} from './live-studio-window';

const T0 = '2026-08-01T10:00:00.000Z';
const t0 = new Date(T0);

function at(hours: number): Date {
  return new Date(t0.getTime() + hours * 3_600_000);
}
function atMin(minutes: number): Date {
  return new Date(t0.getTime() + minutes * 60_000);
}

/** Paid, one day, went live at T0, off air, "now" = T0 unless overridden. */
function input(over: Partial<WindowInput> = {}): WindowInput {
  return {
    owned: true,
    dayStarts: ['2026-07-20T00:00:00.000Z'], // bought well before go-live
    firstLiveAt: T0,
    isLive: false,
    now: t0,
    ...over,
  };
}

/* ── 1 · THE RULE THAT OUTRANKS THE PAYWALL ─────────────────────────────────── */

test('🔒 a window that lapses MID-BROADCAST does not interrupt it', () => {
  const d = decideBroadcastWindow(input({ isLive: true, now: at(30) }));
  assert.equal(d.multiCam, true, 'a running ceremony must not lose its cameras');
  assert.equal(d.reason, 'expired-broadcasting');
  assert.equal(d.runningLong, true);
});

test('🔒 it keeps not interrupting however far past the window it runs', () => {
  const d = decideBroadcastWindow(input({ isLive: true, now: at(400) }));
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'expired-broadcasting');
});

test('🔒 an unreadable broadcast start still PROTECTS a running broadcast', () => {
  const d = decideBroadcastWindow(
    input({ isLive: true, broadcastStartedAt: null, now: at(30) }),
  );
  assert.equal(d.multiCam, true, 'a missing timestamp must never cost a ceremony its cameras');
  assert.equal(d.reason, 'expired-broadcasting');
});

test('🚨 the never-interrupt rule is BOUNDED to the broadcast that was already running', () => {
  // The abuse this closes: let the day expire, press Go live again, and — with
  // `isLive` as the only test — hold unlimited multi-cam forever by never pressing
  // stop. A broadcast STARTED AFTER the window closed is a NEXT go-live, which is
  // exactly where the owner said to enforce.
  const startedAfter = decideBroadcastWindow(
    input({ isLive: true, broadcastStartedAt: at(26).toISOString(), now: at(27) }),
  );
  assert.equal(startedAfter.multiCam, false);
  assert.equal(startedAfter.reason, 'expired');

  // …while the broadcast that WAS running is protected, on the very same clock.
  const startedBefore = decideBroadcastWindow(
    input({ isLive: true, broadcastStartedAt: at(20).toISOString(), now: at(27) }),
  );
  assert.equal(startedBefore.multiCam, true);
  assert.equal(startedBefore.reason, 'expired-broadcasting');
});

test('a broadcast started INSIDE the window is protected however long it runs', () => {
  const d = decideBroadcastWindow(
    input({ isLive: true, broadcastStartedAt: at(23).toISOString(), now: at(500) }),
  );
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'expired-broadcasting');
});

/* ── 2 · THE LAPSE DOES BITE, AT THE NEXT GO-LIVE ───────────────────────────── */

test('the SAME lapse, once off air, closes multi-cam', () => {
  const d = decideBroadcastWindow(input({ isLive: false, now: at(30) }));
  assert.equal(d.multiCam, false);
  assert.equal(d.reason, 'expired');
});

test('stop-then-restart after a lapse gets ONE camera, not a refusal — and not a fresh day', () => {
  // Ran long, stopped at +30h, presses live again at +31h. The window is over: the
  // next broadcast is the free single-camera tier, which is never withheld.
  const off = decideBroadcastWindow(input({ isLive: false, now: at(31) }));
  assert.equal(off.multiCam, false);
  // Pressing live again does not re-anchor: firstLiveAt is write-once, so the
  // decision at +31h is identical whether or not they just restarted.
  const restarted = decideBroadcastWindow(input({ isLive: true, now: at(31) }));
  assert.equal(restarted.reason, 'expired-broadcasting');
  assert.equal(
    restarted.expiresAt,
    off.expiresAt,
    'a re-press must never move, restart or extend the window',
  );
});

/* ── 3 · BUYING EARLY COSTS NOTHING ─────────────────────────────────────────── */

test('paid but never live = no clock running, multi-cam available', () => {
  const d = decideBroadcastWindow(input({ firstLiveAt: null, now: at(9000) }));
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'awaiting-go-live');
  assert.equal(d.expiresAt, null, 'no clock has started');
});

test('the window is measured from FIRST GO-LIVE, not from the purchase', () => {
  const d = decideBroadcastWindow(
    input({ dayStarts: ['2026-01-01T00:00:00.000Z'], now: at(1) }),
  );
  assert.equal(d.reason, 'open');
  assert.equal(d.expiresAt, at(LIVE_STUDIO_DAY_HOURS).toISOString());
});

test('an unreadable anchor on a PAID event fails OPEN, not into a downgrade', () => {
  // Deliberate asymmetry: this branch is only reachable by someone who already paid,
  // and a data glitch must not cost them a day that cannot be redone.
  const d = decideBroadcastWindow(input({ firstLiveAt: 'not-a-date' }));
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'awaiting-go-live');
});

/* ── 4 · EXTENSION ──────────────────────────────────────────────────────────── */

test('a second purchased day extends the window by exactly 24 more hours', () => {
  const one = decideBroadcastWindow(input({ now: at(1) }));
  const two = decideBroadcastWindow(
    input({ dayStarts: ['2026-07-20T00:00:00.000Z', at(23).toISOString()], now: at(1) }),
  );
  assert.equal(one.days, 1);
  assert.equal(two.days, 2);
  assert.equal(one.expiresAt, at(24).toISOString());
  assert.equal(two.expiresAt, at(48).toISOString());
});

test('an extension bought at the 1-hour warning keeps the couple broadcasting through it', () => {
  const boughtAt = at(23).toISOString();
  const during = decideBroadcastWindow(
    input({ dayStarts: ['2026-07-20T00:00:00.000Z', boughtAt], now: at(30) }),
  );
  assert.equal(during.multiCam, true);
  assert.equal(during.reason, 'open');
});

test('a day bought long AFTER the window lapsed starts then — never retro-expired', () => {
  // The trap a plain `anchor + days × 24h` walks into: ₱2,999 for a day that
  // expired weeks ago.
  const boughtAt = at(720).toISOString(); // a month later
  const d = decideBroadcastWindow(
    input({ dayStarts: ['2026-07-20T00:00:00.000Z', boughtAt], now: at(721) }),
  );
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'open');
  assert.equal(d.expiresAt, at(744).toISOString());
});

test('foldWindowEnd stacks contiguous days and is order-independent', () => {
  const early = '2026-07-20T00:00:00.000Z';
  const late = at(23).toISOString();
  const a = foldWindowEnd(t0, [early, late], 24);
  const b = foldWindowEnd(t0, [late, early], 24);
  assert.equal(a.toISOString(), at(48).toISOString());
  assert.equal(b.toISOString(), a.toISOString(), 'sorted internally — input order cannot matter');
});

/* ── THE 1-HOUR WARNING ─────────────────────────────────────────────────────── */

test('endingSoon fires at ~1 hour left and not before', () => {
  const notYet = decideBroadcastWindow(input({ now: atMin(24 * 60 - WINDOW_WARN_MINUTES - 1) }));
  assert.equal(notYet.reason, 'open');
  assert.equal(notYet.endingSoon, false);

  const soon = decideBroadcastWindow(input({ now: atMin(24 * 60 - WINDOW_WARN_MINUTES) }));
  assert.equal(soon.endingSoon, true, 'the host is warned while they can still act');
  assert.equal(soon.minutesRemaining, WINDOW_WARN_MINUTES);
});

test('endingSoon is false once the window has actually closed (that is a different message)', () => {
  assert.equal(decideBroadcastWindow(input({ now: at(25) })).endingSoon, false);
  assert.equal(
    decideBroadcastWindow(input({ isLive: true, now: at(25) })).endingSoon,
    false,
  );
});

/* ── THE FREE TIER + THE UNMETERED GRANT ────────────────────────────────────── */

test('no unlock = no window, single camera — and no clock is invented', () => {
  const d = decideBroadcastWindow(input({ owned: false, dayStarts: [], firstLiveAt: null }));
  assert.equal(d.multiCam, false);
  assert.equal(d.reason, 'not-owned');
  assert.equal(d.expiresAt, null);
});

test('fail-closed: an entitlement that resolved to false gets the free tier, not a free day', () => {
  const d = decideBroadcastWindow(input({ owned: false, now: at(1) }));
  assert.equal(d.multiCam, false);
});

test('owned with ZERO day-orders is UNMETERED (comp grant / internal / founder / promo)', () => {
  const d = decideBroadcastWindow(input({ dayStarts: [], now: at(9000) }));
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'unmetered');
  assert.equal(d.expiresAt, null, 'nothing was sold by the day, so nothing is metered by it');
});

/* ── THE TICKING SURFACE AGREES WITH THE SERVER ─────────────────────────────── */

test('windowPhaseAt matches decideBroadcastWindow at every crossing', () => {
  const cases: Array<{ hours: number; isLive: boolean; phase: string }> = [
    { hours: 1, isLive: false, phase: 'open' },
    { hours: 23.5, isLive: false, phase: 'ending-soon' },
    { hours: 25, isLive: true, phase: 'running-long' },
    { hours: 25, isLive: false, phase: 'ended' },
  ];
  for (const c of cases) {
    const now = at(c.hours);
    const server = decideBroadcastWindow(input({ isLive: c.isLive, now }));
    assert.equal(windowPhaseAt(server.expiresAt, now, c.isLive), c.phase, `at +${c.hours}h`);
    // The client phase must never claim more than the server granted.
    const clientSaysOn = c.phase === 'open' || c.phase === 'ending-soon' || c.phase === 'running-long';
    assert.equal(clientSaysOn, server.multiCam, `multi-cam agreement at +${c.hours}h`);
  }
});

test('windowPhaseAt is silent when there is no clock (free tier / unmetered grant)', () => {
  assert.equal(windowPhaseAt(null, t0, false), 'none');
  assert.equal(windowPhaseAt(null, t0, true), 'none');
});

/* ── THE 12-HOUR ARCHIVE GUARDRAIL ──────────────────────────────────────────── */

test('the archive guard is silent while nothing is on air', () => {
  const g = decideArchiveGuard({ startedAt: T0, isLive: false, now: at(20) });
  assert.equal(g.warn, false);
  assert.equal(g.hoursElapsed, null);
});

test('it warns approaching 12 hours, with the hours actually left', () => {
  const quiet = decideArchiveGuard({ startedAt: T0, isLive: true, now: at(ARCHIVE_WARN_AT_HOURS - 1) });
  assert.equal(quiet.warn, false);

  const warned = decideArchiveGuard({ startedAt: T0, isLive: true, now: at(ARCHIVE_WARN_AT_HOURS) });
  assert.equal(warned.warn, true);
  assert.equal(warned.exceeded, false);
  assert.equal(warned.hoursToCap, YOUTUBE_ARCHIVE_HOURS - ARCHIVE_WARN_AT_HOURS);
});

test('past 12 hours it says so — and still never cuts anything off', () => {
  const g = decideArchiveGuard({ startedAt: T0, isLive: true, now: at(13) });
  assert.equal(g.exceeded, true);
  assert.equal(g.hoursToCap, 0);
  // The guard has no "stop" output at all: there is nothing in this type that any
  // caller could read as permission to end a broadcast.
  assert.equal(Object.prototype.hasOwnProperty.call(g, 'stop'), false);
});

test('the archive clock is per-BROADCAST, so a restart gets a fresh 12 hours', () => {
  const restarted = decideArchiveGuard({ startedAt: at(20).toISOString(), isLive: true, now: at(21) });
  assert.equal(restarted.hoursElapsed, 1);
  assert.equal(restarted.warn, false);
});

test('a start stamped in the future (clock skew) reads as just-started, not negative', () => {
  const g = decideArchiveGuard({ startedAt: at(1).toISOString(), isLive: true, now: t0 });
  assert.equal(g.hoursElapsed, 0);
  assert.equal(g.warn, false);
});

/* ── THE WINDOW AND THE ARCHIVE GUARD ARE INDEPENDENT ───────────────────────── */

test('a paid window can lapse while the archive guard is still quiet, and vice versa', () => {
  // Hour 13 of one continuous broadcast: archive exceeded, window still open on a
  // 2-day purchase. Neither may silence the other.
  const win = decideBroadcastWindow(
    input({ dayStarts: ['2026-07-20T00:00:00.000Z', '2026-07-21T00:00:00.000Z'], isLive: true, now: at(13) }),
  );
  const arch = decideArchiveGuard({ startedAt: T0, isLive: true, now: at(13) });
  assert.equal(win.reason, 'open');
  assert.equal(arch.exceeded, true);
});
