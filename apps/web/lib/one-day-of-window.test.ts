/**
 * There is exactly ONE definition of "the wedding day is happening".
 *
 * ── WHAT WENT WRONG ────────────────────────────────────────────────────────
 * Two shipped side by side and were consumed **in the same component**:
 *
 *   isDayOfOpen        lib/guest-journey.ts   new Date(eventDate) ± 24h
 *   getDayOfPhase      lib/day-of-mode.ts     −12h .. +36h (live), .. +60h (post)
 *
 * `customer-section-subnav.tsx` computed `dayOfOpen` from the first, received
 * `phase` from the second, and passed BOTH into `buildCustomerMenuTree`. They
 * disagreed by **12 hours at the start and 36 at the end** — so for about a day
 * and a half after a wedding the bottom nav swapped to the day-of menu while the
 * Guests "Day-of" stage it points at stayed muted. **Late check-ins happen
 * exactly in that window.**
 *
 * The naive copy also did `new Date('2026-12-12')`, which is midnight **UTC** —
 * already 8 hours wrong in Manila. That is the date-is-not-an-instant defect
 * fixed in 41 other places on 2026-08-04. This copy was missed because it did
 * not look like a date bug; it looked like a menu.
 *
 * ── WHAT THIS ASSERTS ──────────────────────────────────────────────────────
 * Not that the numbers are right — that they are the SAME numbers. A window can
 * legitimately change; two windows cannot legitimately disagree.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDayOfOpen } from './guest-journey';
import { isEventDayActive, getDayOfPhase } from './day-of-mode';

const HOUR = 60 * 60 * 1000;
const EVENT = '2026-12-12';

/** The anchor day-of-mode resolves this date to, in the ambient zone. */
function anchorMs(): number {
  // Walk outward until the phase flips; the boundary IS the anchor + window.
  // Simpler: probe a wide range and trust the two functions agree everywhere.
  return new Date(`${EVENT}T00:00:00`).getTime();
}

test('the two day-of predicates agree at every hour across five days', () => {
  const base = anchorMs();
  const disagreements: string[] = [];
  // −48h .. +96h in one-hour steps: covers both windows and both boundaries.
  for (let h = -48; h <= 96; h++) {
    const nowMs = base + h * HOUR;
    const a = isDayOfOpen(EVENT, new Date(nowMs));
    const b = isEventDayActive(EVENT, undefined, nowMs);
    if (a !== b) disagreements.push(`T${h >= 0 ? '+' : ''}${h}h: guest-journey=${a} day-of-mode=${b}`);
  }
  assert.deepEqual(
    disagreements,
    [],
    'The couple\'s menu and the stage it points at would contradict each other ' +
      'at these hours:\n  ' +
      disagreements.slice(0, 12).join('\n  '),
  );
});

test('isDayOfOpen delegates — it does not restate the window', () => {
  // A restated copy passes the hour-sweep above the day it is written and drifts
  // the first time one side changes. So assert the SOURCE has no window maths.
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const src = fs.readFileSync(path.join(here, 'guest-journey.ts'), 'utf8');
  const body = src.slice(src.indexOf('export function isDayOfOpen'));
  const fn = body.slice(0, body.indexOf('\n}') + 2);

  assert.ok(
    fn.includes('isEventDayActive'),
    'isDayOfOpen must call the one definition in lib/day-of-mode.ts',
  );
  assert.ok(
    !/24 \* 60 \* 60 \* 1000|dayMs|\* HOUR_MS/.test(fn),
    'isDayOfOpen must not compute its own window — that is how the two drifted',
  );
  assert.ok(
    !/new Date\(eventDate\)/.test(fn),
    "and it must not parse the date itself: new Date('2026-12-12') is midnight " +
      'UTC, which is the wrong day west of Greenwich and 8h off in Manila',
  );
});

test('a null or unparseable date is closed, never open', () => {
  const now = new Date();
  assert.equal(isDayOfOpen(null, now), false);
  assert.equal(isDayOfOpen(undefined, now), false);
  assert.equal(isDayOfOpen('', now), false);
  assert.equal(isDayOfOpen('not-a-date', now), false);
  assert.equal(getDayOfPhase('not-a-date'), 'inactive');
});

test('the window still opens and closes — the sweep is not vacuously equal', () => {
  const base = anchorMs();
  // If both functions returned a constant, the agreement test above would pass
  // for the wrong reason. Prove the window actually has edges.
  assert.equal(isDayOfOpen(EVENT, new Date(base - 48 * HOUR)), false, 'closed two days before');
  assert.equal(isDayOfOpen(EVENT, new Date(base + 6 * HOUR)), true, 'open on the day');
  assert.equal(isDayOfOpen(EVENT, new Date(base + 96 * HOUR)), false, 'closed four days after');
});
