import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureWindowState } from './papic-window';

/**
 * A CAMERA'S CAPTURE WINDOW IS A WHOLE MANILA DAY, NOT AN INSTANT.
 *
 * 🚨 THE DEFECT THIS PINS — the reason Papic had never stored a single photo.
 * `paparazzi_seats.valid_from` / `valid_until` are DATE columns, so PostgREST
 * returns `"2026-09-19"`. Both gates did `Date.parse(vf)`, which is midnight
 * **UTC** = 08:00 Manila. A one-day window writes the SAME date into both
 * columns, so start and end landed on the SAME INSTANT — the window was open
 * for about one millisecond, once, at 8 AM on the event day.
 *
 * Measured in prod 2026-08-07: SIX of thirteen seats had
 * `valid_from = valid_until`, and **both seats anyone had ever claimed were in
 * that set**. Two real people claimed a camera and every shot they took was
 * refused.
 *
 * ⚠ IT GETS WORSE, AND THAT IS WHY THE COUNTER ASSERTION IS HERE TOO. The 403
 * carried no `code`, so the client turned it into a generic `Error('presign')`,
 * which is not in PAPIC_TERMINAL_ERRORS — so the shot was queued offline and
 * **the shot counter still went up**. The photographer was told nothing and
 * believed the photo was taken. A refusal nobody can see is indistinguishable
 * from success.
 *
 * ⚠ RUN THIS UNDER Asia/Manila. In UTC the start bound looks right — midnight
 * UTC genuinely is the start of the UTC day — so a UTC-only suite is blind to
 * this. That is exactly how it shipped. CI runs UTC by default.
 */

const DAY = '2026-09-19';
const ms = (iso: string) => Date.parse(iso);

test('a one-day window is open all day in Manila, not for an instant', () => {
  // The exact prod shape: same date in both columns.
  assert.equal(captureWindowState(DAY, DAY, ms(`${DAY}T00:00:00+08:00`)), 'open', 'midnight Manila');
  assert.equal(captureWindowState(DAY, DAY, ms(`${DAY}T08:00:00+08:00`)), 'open', 'morning');
  assert.equal(captureWindowState(DAY, DAY, ms(`${DAY}T14:00:00+08:00`)), 'open', 'the ceremony');
  assert.equal(captureWindowState(DAY, DAY, ms(`${DAY}T23:59:59+08:00`)), 'open', 'last second');
});

test('and shut outside it, on both sides', () => {
  assert.equal(
    captureWindowState(DAY, DAY, ms(`${DAY}T23:59:59.999+08:00`) + 1),
    'closed',
    'one millisecond after the day ends',
  );
  assert.equal(
    captureWindowState(DAY, DAY, ms(`${DAY}T00:00:00+08:00`) - 1),
    'not_started',
    'one millisecond before the day begins',
  );
  assert.equal(captureWindowState(DAY, DAY, ms('2026-08-07T12:00:00+08:00')), 'not_started');
});

test('THE REGRESSION: the old UTC parse made the window zero-width', () => {
  // This is what the shipped code did. Kept as an executable record of the bug
  // so nobody "simplifies" the helper back to it.
  const oldStart = Date.parse(DAY); // midnight UTC = 08:00 Manila
  const oldEnd = Date.parse(DAY); // identical — the whole defect in one line
  assert.equal(oldStart, oldEnd, 'start and end collapsed onto one instant');

  // At 2 PM Manila on the event day — a wedding in full swing — the old gate
  // refused, and the new one allows.
  const ceremony = ms(`${DAY}T14:00:00+08:00`);
  assert.ok(ceremony > oldEnd, 'the old gate called the ceremony "window closed"');
  assert.equal(captureWindowState(DAY, DAY, ceremony), 'open');
});

test('null bounds fail OPEN — a legacy seat is never bricked', () => {
  const now = Date.now();
  assert.equal(captureWindowState(null, null, now), 'open');
  assert.equal(captureWindowState(undefined, undefined, now), 'open');
  assert.equal(captureWindowState('', '', now), 'open');
  assert.equal(captureWindowState('not-a-date', 'not-a-date', now), 'open');
});

test('both server gates use the shared helper, not their own Date.parse', () => {
  const WEB = process.cwd();
  const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

  for (const file of ['app/api/upload/route.ts', 'app/papic/actions.ts']) {
    const src = read(file);
    assert.match(
      src,
      /captureWindowState\(/,
      `${file} must use captureWindowState — two copies of this comparison is how it broke`,
    );
    assert.ok(
      !/Date\.parse\(\s*(seat\.)?valid_(from|until)/.test(src) &&
        !/Date\.parse\(vf\)|Date\.parse\(vu\)/.test(src),
      `${file} parses a DATE column directly again. That reads it as midnight UTC ` +
        `(08:00 Manila) and collapses a one-day window to an instant.`,
    );
  }
});

test('the presign refusal carries a code, or the client queues it silently', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/upload/route.ts'), 'utf8');
  const idx = route.indexOf('capture window');
  assert.ok(idx > 0 || /capture_not_started/.test(route), 'window refusal not found in the route');
  assert.match(
    route,
    /code:\s*windowState === 'not_started' \? 'capture_not_started' : 'capture_window_closed'/,
    'the 403 must carry a code. Without it the client cannot distinguish a refusal ' +
      'from a network failure, queues the shot offline, and increments the counter — ' +
      'so the photographer believes the photo was taken.',
  );

  const client = readFileSync(
    join(process.cwd(), 'app/papic/seat/[token]/_components/papic-seat-capture.tsx'),
    'utf8',
  );
  assert.match(
    client,
    /code === 'capture_not_started' \|\| code === 'capture_window_closed'/,
    'the client must re-throw window codes by name so they reach PAPIC_TERMINAL_ERRORS ' +
      'instead of becoming a retryable Error("presign")',
  );
});
