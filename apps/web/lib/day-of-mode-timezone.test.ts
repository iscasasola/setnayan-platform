/**
 * day-of-mode-timezone.test.ts — the wedding day belongs to the VENUE's clock.
 *
 * ⚠ THE DEFECT THIS PINS. `eventDateToEpoch` built midnight with
 * `new Date(y, m, d)`, and its comment said that gave "the dashboard user's
 * local midnight" — which is true in a BROWSER. This module also runs in server
 * components, and Vercel runs UTC. So for a Manila wedding the anchor landed at
 * 08:00 local and the `live` window (T-1h .. T+8h) ran roughly **07:00–16:00 on
 * the wedding day**: off before the reception even started, and never on for the
 * evening — which is when a Filipino wedding actually happens.
 *
 * Five clock PRs merged 2026-08-04 fixed the schedule, the broadcast and the
 * vendor countdown, and stopped one file short of this one — the file that
 * decides whether the guest page is in `live` at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDayOfPhase, getMenuLifecyclePhase } from './day-of-mode';

const MANILA = 'Asia/Manila';
const DATE = '2026-12-18';
/** 18 Dec 2026, 19:00 in Manila — peak reception. */
const RECEPTION_UTC = Date.UTC(2026, 11, 18, 11, 0, 0);

function at(ms: number, fn: () => void) {
  const real = Date.now;
  Date.now = () => ms;
  try { fn(); } finally { Date.now = real; }
}

test('the anchor follows the VENUE zone, not the runtime — 8 hours for Manila', () => {
  // ⚠ WHY THIS COMPARES AGAINST UTC AND NOT AGAINST THE LOCAL DEFAULT.
  // A developer machine in Manila makes `new Date(y,m,d)` and Manila-midnight
  // IDENTICAL, so a local-vs-tz comparison passes while the server is 8 hours
  // out. That is precisely why this bug survived. Compare two EXPLICIT zones.
  const manila: string[] = [];
  const utc: string[] = [];
  for (let h = 0; h < 48; h++) {
    at(Date.UTC(2026, 11, 17, h, 0, 0), () => {
      manila.push(getDayOfPhase(DATE, MANILA));
      utc.push(getDayOfPhase(DATE, 'UTC'));
    });
  }
  assert.notDeepEqual(
    manila,
    utc,
    'Asia/Manila and UTC produce the same phases — the anchor is ignoring the ' +
      'timezone, which is the defect returning',
  );
  // And Manila must lead UTC by exactly 8 hours: its phase at hour h should
  // equal UTC's at hour h+8.
  assert.deepEqual(
    manila.slice(0, 40),
    utc.slice(8, 48),
    'the Manila anchor is not exactly 8 hours ahead of the UTC one',
  );
});

test('an unknown timezone falls back rather than throwing', () => {
  // A bad IANA string must not take the guest page down mid-wedding.
  at(RECEPTION_UTC, () => {
    assert.doesNotThrow(() => getDayOfPhase(DATE, 'Not/AZone'));
  });
});

test('omitting the timezone keeps the old behaviour, so no caller changed by accident', () => {
  at(RECEPTION_UTC, () => {
    assert.equal(typeof getDayOfPhase(DATE), 'string');
  });
});

// ── The window itself — THE ONE CLOCK (owner ruling, 10 Nov 2026), superseding 2026-08-05's noon-to-noon window:
// The Day opens at 06:00 on the event day and closes at 06:00 the morning after the last day, in the venue's zone.

test('a 7pm Filipino reception IS live — the case the old window never covered', () => {
  // 18 Dec 2026, 19:00 Manila = 11:00 UTC.
  at(Date.UTC(2026, 11, 18, 11, 0, 0), () => {
    assert.equal(
      getDayOfPhase(DATE, MANILA),
      'live',
      'day-of mode is off during the reception — the photo wall, the banner and ' +
        'the announcements all stay dark while the wedding is actually happening',
    );
  });
});

test('the whole wedding day is live, from 06:00 to 06:00 the morning after (the one clock)', () => {
  // ⏱ Owner ruling, 10 Nov 2026: The Day opens at 06:00 on the event day, venue time, and closes at 06:00 the morning
  // after the last day. Every hour from 06:00 on the day to 05:00 the next morning is live; 00:00–05:00 on the day is not.
  const off: string[] = [];
  const early: string[] = [];
  for (let h = 0; h < 30; h++) {
    // hour h Manila counted from midnight on the wedding day = (h - 8) UTC.
    at(Date.UTC(2026, 11, 18, h - 8, 0, 0), () => {
      const live = getDayOfPhase(DATE, MANILA) === 'live';
      if (h >= 6 && !live) off.push(`${h}:00`);
      if (h < 6 && live) early.push(`${h}:00`);
    });
  }
  assert.deepEqual(off, [], `these hours of The Day are not live: ${off.join(', ')}`);
  assert.deepEqual(early, [], `these hours before 06:00 on the day are live: ${early.join(', ')}`);
});

test('it starts at 06:00 on the day and ends at 06:00 the morning after', () => {
  const phaseAt = (utc: number) => { let p = ''; at(utc, () => { p = getDayOfPhase(DATE, MANILA); }); return p; };
  // 05:59 Manila on the day = 21:59 UTC the day before — not yet live.
  assert.notEqual(phaseAt(Date.UTC(2026, 11, 17, 21, 59, 0)), 'live');
  // 06:00 Manila on the day = 22:00 UTC the day before — live.
  assert.equal(phaseAt(Date.UTC(2026, 11, 17, 22, 0, 0)), 'live');
  // 05:59 Manila the morning after — still live (the after-party).
  assert.equal(phaseAt(Date.UTC(2026, 11, 18, 21, 59, 0)), 'live');
  // 06:00 Manila the morning after — over.
  assert.notEqual(phaseAt(Date.UTC(2026, 11, 18, 22, 0, 0)), 'live');
});

// ── The Event Lifecycle Menu phase (Phase 6 day-of takeover) ─────────────────
//
// `getMenuLifecyclePhase` gained `tz` on 2026-08-14 because the Overview now
// HIDES the whole planning stack when it returns 'dayof'. Before that the only
// consequence was which bottom-nav menu showed; now getting the boundary wrong
// removes the couple's vendor list and budget from their own home page on the
// wrong day. These pin the boundary in the venue's clock, not the server's.

test('the takeover follows the venue clock, so a Manila reception is dayof', () => {
  // A UTC server evaluating a Manila wedding: without a zone the anchor is 8
  // hours early. The reception instant must read `dayof` either way here, so
  // the sharper assertions are the boundary pair below.
  assert.equal(
    getMenuLifecyclePhase(DATE, null, MANILA, RECEPTION_UTC),
    'dayof',
    'the couple lost their live desk during their own reception',
  );
});

test('the takeover starts at 06:00 on the day — in Manila, not in UTC', () => {
  // Manila 06:00 on the 18th is 2026-12-17T22:00Z (the one clock, owner ruling 10 Nov 2026). One minute either side
  // of that instant must disagree, and it is the ZONE that decides where the instant falls.
  const startUtc = Date.UTC(2026, 11, 17, 22, 0, 0);
  assert.equal(getMenuLifecyclePhase(DATE, null, MANILA, startUtc + 60_000), 'dayof');
  assert.equal(getMenuLifecyclePhase(DATE, null, MANILA, startUtc - 60_000), 'plan');
});

test('a cleared event is After no matter where the clock is', () => {
  assert.equal(
    getMenuLifecyclePhase(DATE, '2026-12-19T00:00:00Z', MANILA, RECEPTION_UTC),
    'after',
  );
});

test('long past the window the event auto-clears to After', () => {
  const wayPast = Date.UTC(2027, 0, 20, 0, 0, 0);
  assert.equal(getMenuLifecyclePhase(DATE, null, MANILA, wayPast), 'after');
});

test('no date means Plan — the takeover can never fire on an undated event', () => {
  assert.equal(getMenuLifecyclePhase(null, null, MANILA, RECEPTION_UTC), 'plan');
  assert.equal(getMenuLifecyclePhase(undefined, null, MANILA, RECEPTION_UTC), 'plan');
  assert.equal(getMenuLifecyclePhase('not-a-date', null, MANILA, RECEPTION_UTC), 'plan');
});

test('omitting the zone reads the venue fallback (Manila), never the runtime — the one clock, ruling 5', () => {
  // ⏱ Owner ruling, 10 Nov 2026: "Manila when there is no venue". A missing zone used to mean the RUNTIME's (UTC on a
  // server, the phone's own in a browser), which is how a Manila wedding's day opened eight hours late on Vercel.
  for (const ms of [RECEPTION_UTC, Date.UTC(2026, 11, 17, 21, 59, 0), Date.UTC(2026, 11, 17, 22, 0, 0)]) {
    at(ms, () => {
      assert.equal(getMenuLifecyclePhase(DATE, null), getMenuLifecyclePhase(DATE, null, MANILA));
      assert.equal(getDayOfPhase(DATE), getDayOfPhase(DATE, MANILA));
    });
  }
});
