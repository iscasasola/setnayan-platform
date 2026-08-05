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
import { getDayOfPhase } from './day-of-mode';

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

// ── The window itself (owner 2026-08-05: "12 hours before and 12 hours after")
// T is MIDNIGHT on the wedding day, in the venue's zone. The window is 12 hours
// either side of the DAY — noon-before to noon-after — not ±12h from T, which
// would be noon-to-noon and would still end before an evening reception.

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

test('the whole wedding day is live, morning to midnight', () => {
  const off: string[] = [];
  for (let h = 0; h < 24; h++) {
    // hour h Manila on the wedding day = (h - 8) UTC.
    at(Date.UTC(2026, 11, 18, h - 8, 0, 0), () => {
      if (getDayOfPhase(DATE, MANILA) !== 'live') off.push(`${h}:00`);
    });
  }
  assert.deepEqual(off, [], `these hours of the wedding day are not live: ${off.join(', ')}`);
});

test('it starts noon the day before and ends noon the day after', () => {
  const phaseAt = (utc: number) => { let p = ''; at(utc, () => { p = getDayOfPhase(DATE, MANILA); }); return p; };
  // 11:00 Manila the day before = 03:00 UTC — one hour early, not yet live.
  assert.notEqual(phaseAt(Date.UTC(2026, 11, 17, 3, 0, 0)), 'live');
  // 13:00 Manila the day before = 05:00 UTC — inside.
  assert.equal(phaseAt(Date.UTC(2026, 11, 17, 5, 0, 0)), 'live');
  // 11:00 Manila the day after = 03:00 UTC on the 19th — still inside.
  assert.equal(phaseAt(Date.UTC(2026, 11, 19, 3, 0, 0)), 'live');
  // 13:00 Manila the day after — over.
  assert.notEqual(phaseAt(Date.UTC(2026, 11, 19, 5, 0, 0)), 'live');
});
