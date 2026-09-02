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
  UNMETERED_GRANT_KINDS,
  WINDOW_WARN_MINUTES,
  YOUTUBE_ARCHIVE_HOURS,
  classifyGrant,
  decideArchiveGuard,
  decideBroadcastWindow,
  foldWindowEnd,
  grantIsUnmetered,
  shouldWarnWindowNotStarted,
  windowPhaseAt,
  type GrantKind,
  type GrantSignals,
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
  // The trap a plain `anchor + days × 24h` walks into: ₱3,000 for a day that
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

/* ── ⭐ THE GRANT-KIND SPLIT (owner-locked 2026-07-26) ───────────────────────────

   Wave 7 gave EVERY zero-day-order unlock unlimited broadcast days. The owner
   reviewed and split it: founder + comp are unmetered; internal + promo get the
   ordinary one-event-day window a paying customer gets. These tests are the ruling.

   The expensive failure is not "a founder gets metered" — it is the reverse: an
   `is_internal` staff account, of which there can be many, silently holding an
   unlimited ₱3,000 multi-cam broadcast entitlement forever.                        */

const ALL_KINDS: GrantKind[] = ['founder', 'comp', 'internal', 'promo', 'unknown'];

/** A grant: owned, ZERO day-orders, went live at T0. */
function grant(kind: GrantKind | null | undefined, over: Partial<WindowInput> = {}) {
  return decideBroadcastWindow(input({ dayStarts: [], grantKind: kind, ...over }));
}

test('THE MAPPING — founder + comp unmetered; internal + promo + unknown METERED', () => {
  assert.deepEqual(
    ALL_KINDS.map((k) => [k, grantIsUnmetered(k)]),
    [
      ['founder', true],
      ['comp', true],
      ['internal', false],
      ['promo', false],
      ['unknown', false],
    ],
  );
  // The allowlist itself, pinned — a fifth unmetered kind must be a deliberate edit
  // here, reviewed against the owner ruling, not a side effect of a refactor.
  assert.deepEqual([...UNMETERED_GRANT_KINDS].sort(), ['comp', 'founder']);
});

test('FOUNDER — a founder seat broadcasts with NO clock, however long it runs', () => {
  const d = grant('founder', { now: at(9000) });
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'unmetered');
  assert.equal(d.expiresAt, null, 'a founder seat is all services, free, permanently');
  assert.equal(d.meteredDays, 0);
});

test('COMP — an admin gift broadcasts with NO clock (someone decided to give it away)', () => {
  const d = grant('comp', { now: at(9000) });
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'unmetered');
  assert.equal(d.expiresAt, null);
});

test('⭐ INTERNAL — a §10a staff event is METERED: one event-day, then the free tier', () => {
  // Inside the day: multi-cam, on the ordinary paid-customer clock.
  const open = grant('internal', { now: at(1) });
  assert.equal(open.multiCam, true);
  assert.equal(open.reason, 'open', 'not "unmetered" — a staff grant runs a real clock');
  assert.equal(open.expiresAt, at(LIVE_STUDIO_DAY_HOURS).toISOString());
  assert.equal(open.days, 0, 'nothing was PURCHASED…');
  assert.equal(open.meteredDays, 1, '…but exactly one event-day is being metered');

  // Past the day, off air: back to the free single camera.
  const done = grant('internal', { now: at(LIVE_STUDIO_DAY_HOURS + 0.5) });
  assert.equal(done.multiCam, false, 'THE CORRECTION — Wave 7 left this true forever');
  assert.equal(done.reason, 'expired');
});

test('PROMO — a marketing free-window is worth ONE event-day, not unlimited days', () => {
  const open = grant('promo', { now: at(1) });
  assert.equal(open.reason, 'open');
  assert.equal(open.meteredDays, 1);
  assert.equal(grant('promo', { now: at(25) }).multiCam, false);
});

test('FAIL-CLOSED — an unrecognised / missing / null grant kind is METERED', () => {
  for (const kind of ['unknown', undefined, null] as const) {
    const d = grant(kind, { now: at(25) });
    assert.equal(d.multiCam, false, `grantKind=${String(kind)} must not be unmetered`);
    assert.equal(d.reason, 'expired');
  }
  // …and the same input INSIDE the day still works: metered means metered, not denied.
  assert.equal(grant(undefined, { now: at(1) }).multiCam, true);
});

test('a metered grant that never went live is awaiting-go-live, exactly like a purchase', () => {
  const d = grant('internal', { firstLiveAt: null, now: at(9000) });
  assert.equal(d.multiCam, true, 'buying — or being granted — early costs nothing');
  assert.equal(d.reason, 'awaiting-go-live');
  assert.equal(d.expiresAt, null);
});

test('🔒 the never-interrupt rule still outranks the paywall for a metered grant', () => {
  // A staff/promo ceremony that is ON AIR when the day lapses is NOT cut to one camera.
  const d = grant('internal', { isLive: true, broadcastStartedAt: T0, now: at(30) });
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'expired-broadcasting');
  assert.equal(d.runningLong, true);
});

test('a metered grant that BUYS a day gets two days, not one plus a grant', () => {
  // days ≥ 1 means the grant branch is not taken at all — the purchase is the clock.
  const d = decideBroadcastWindow(
    input({ grantKind: 'internal', dayStarts: ['2026-07-20T00:00:00.000Z'], now: at(1) }),
  );
  assert.equal(d.days, 1);
  assert.equal(d.meteredDays, 1);
  assert.equal(d.expiresAt, at(LIVE_STUDIO_DAY_HOURS).toISOString());
});

/* ── PRECEDENCE: the overlaps, exhaustively ─────────────────────────────────── */

function signals(over: Partial<GrantSignals> = {}): GrantSignals {
  return { founder: false, comp: false, internal: false, promo: false, ...over };
}

test('⭐ THE OVERLAP TRAP — internal AND founder resolves FOUNDER (unmetered)', () => {
  // The owner's own account is both. If `internal` were tested first, the one account
  // that must never be metered would be metered.
  assert.equal(classifyGrant(signals({ founder: true, internal: true })), 'founder');
  assert.equal(grantIsUnmetered(classifyGrant(signals({ founder: true, internal: true }))), true);
});

test('⭐ THE OVERLAP TRAP, other way — internal and NOT a founder resolves INTERNAL (metered)', () => {
  assert.equal(classifyGrant(signals({ internal: true })), 'internal');
  assert.equal(grantIsUnmetered(classifyGrant(signals({ internal: true }))), false);
  // And a live promo window (which is GLOBAL — it covers staff accounts too) must not
  // upgrade a staff account either: promo is metered as well.
  assert.equal(
    grantIsUnmetered(classifyGrant(signals({ internal: true, promo: true }))),
    false,
  );
});

test('PRECEDENCE is exhaustive over all 16 signal combinations', () => {
  const expected = (s: GrantSignals): GrantKind =>
    s.founder ? 'founder' : s.comp ? 'comp' : s.internal ? 'internal' : s.promo ? 'promo' : 'unknown';
  for (const founder of [false, true])
    for (const comp of [false, true])
      for (const internal of [false, true])
        for (const promo of [false, true]) {
          const s = { founder, comp, internal, promo };
          assert.equal(classifyGrant(s), expected(s), JSON.stringify(s));
          // The invariant that actually costs money: unmetered ⟺ founder OR comp.
          assert.equal(
            grantIsUnmetered(classifyGrant(s)),
            founder || comp,
            `unmetered must require a founder seat or a comp grant · ${JSON.stringify(s)}`,
          );
        }
});

test('no signals at all = unknown = metered (fail-closed)', () => {
  assert.equal(classifyGrant(signals()), 'unknown');
  assert.equal(grantIsUnmetered(classifyGrant(signals())), false);
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

/* ── THE UNANCHORED DAY (owner-ruled 2026-09-02) ─────────────────────────────── */

test('the unanchored-day warning fires only when the day has never started', () => {
  // Owned but never gone live, event date weeks out — the gap this closes.
  assert.equal(
    shouldWarnWindowNotStarted({ reason: 'awaiting-go-live', eventDate: '2026-12-18', now: t0 }),
    true,
  );
  // Every other reason has already anchored, or never will — no warning applies.
  for (const reason of ['not-owned', 'unmetered', 'open', 'expired-broadcasting', 'expired'] as const) {
    assert.equal(
      shouldWarnWindowNotStarted({ reason, eventDate: '2026-12-18', now: t0 }),
      false,
      `reason=${reason} must never warn`,
    );
  }
});

test('the unanchored-day warning is silent on the event day itself', () => {
  assert.equal(
    shouldWarnWindowNotStarted({ reason: 'awaiting-go-live', eventDate: '2026-08-01', now: t0 }),
    false,
  );
  // One day either side of the wedding is not the wedding — still warns.
  assert.equal(
    shouldWarnWindowNotStarted({ reason: 'awaiting-go-live', eventDate: '2026-07-31', now: t0 }),
    true,
  );
  assert.equal(
    shouldWarnWindowNotStarted({ reason: 'awaiting-go-live', eventDate: '2026-08-02', now: t0 }),
    true,
  );
});

test('a missing or unparseable event date cannot be "the day", so it still warns', () => {
  assert.equal(
    shouldWarnWindowNotStarted({ reason: 'awaiting-go-live', eventDate: null, now: t0 }),
    true,
  );
  assert.equal(
    shouldWarnWindowNotStarted({ reason: 'awaiting-go-live', eventDate: 'not-a-date', now: t0 }),
    true,
  );
});

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
