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
