/**
 * part-finalization-does-not-inherit-the-booking.test.ts
 *
 * 🛑 THE OWNER RULING THIS FILE EXISTS TO HOLD (2026-09-04):
 * FINALIZATION DOES NOT INHERIT "A BOOKING OUTRANKS ANY MARKER".
 *
 * `lockRequestStateOf` returns `locked` for ANY confirmed booking, deliberately
 * — a legacy row, a printed Locked-QR promotion, a booking made while the flag
 * was off all really ARE bookings, and rendering them as "waiting" would be a
 * phantom. That is right for bookings.
 *
 * It is wrong for a DESIGN. A confirmed booking means the supplier is hired; it
 * does not mean they reviewed and agreed to this ceiling, this gown, this cake.
 * Auto-finalizing from a booking alone would fabricate the exact agreement the
 * handshake exists to capture — and the fabrication would be invisible, because
 * a fabricated agreement renders identically to a real one.
 *
 * ── HOW THE RULING IS HELD ────────────────────────────────────────────────
 * 🔑 BY A SIGNATURE, NOT BY A COMMENT. `partFinalizationStateOf` takes only the
 * state column. There is no `status` to consult and no flag to pass, so there
 * is nothing for a booking to outrank. The change that would break the ruling
 * is the addition of a status parameter, and that is what this file watches:
 * the behavioural tests below could all keep passing while a second, wider
 * overload quietly appeared beside it, so the source is read too.
 *
 * A sentence is not a mechanism — this repo's own words, after a comment
 * asserting the opposite of what the function did survived for weeks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  LOCK_ANSWER_WINDOW_HOURS,
  isPartFinalized,
  lockRequestFuseLabel,
  lockRequestHoursLeft,
  lockRequestStateOf,
  partFinalizationStateOf,
  partReopenStateOf,
  type LockRequestState,
} from './lock-request-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'lock-request-state.ts'), 'utf8');

/* ── 1 · the ruling ──────────────────────────────────────────────────────── */

test('the booking reader promotes a confirmed row; the part reader has no idea what a booking is', () => {
  // The booking handshake, unchanged — this is the behaviour being NOT inherited.
  assert.equal(lockRequestStateOf({ status: 'contracted', lock_request_state: null }, true), 'locked');
  assert.equal(lockRequestStateOf({ status: 'deposit_paid', lock_request_state: 'pending' }, true), 'locked');

  // The part reader takes one field. A supplier who is hired but has never
  // looked at this design is `none`, and `none` is the truth.
  assert.equal(partFinalizationStateOf(null), 'none');
  assert.equal(partFinalizationStateOf(undefined), 'none');
  assert.equal(partFinalizationStateOf({ state: 'pending' }), 'requested');
});

test('partFinalizationStateOf accepts exactly one argument — a status has nowhere to go', () => {
  // 🔑 THE STRUCTURAL HALF. `Function.length` counts declared parameters before
  // the first default. A second one appearing here is the shape of the change
  // the owner ruled against, and it would arrive looking helpful ("pass the
  // booking so we can short-circuit").
  assert.equal(
    partFinalizationStateOf.length,
    1,
    'a second parameter is how "a booking outranks any marker" would creep back in',
  );
  assert.equal(isPartFinalized.length, 1);
});

test('the module never reads a booking status on the finalization path', () => {
  // The booking half of this file legitimately mentions CONFIRMED and status;
  // the part half must not. Slice from the MB12 banner to the end and read only
  // that, with the comments stripped — a comment DISCUSSING the ruling is not a
  // violation of it, and matching on one would make the guard cry wolf.
  const at = SRC.indexOf('MB12 · THE SAME MACHINE AT A SECOND SCOPE');
  assert.ok(at > 0, 'the MB12 section banner moved — re-anchor this guard');
  // 🔑 THE ONE STRIPPER, not a two-replace regex. A regex that deletes block
  // comments first turns any `/*` inside a STRING into a comment opener and
  // blanks everything to the next real close — and the guard then asserts
  // against a blank and passes. See lib/strip-comments.ts.
  const tail = stripComments(SRC.slice(at));
  for (const forbidden of ['CONFIRMED', 'row.status', 'contracted', 'deposit_paid']) {
    assert.ok(
      !tail.includes(forbidden),
      `the finalization scope reads "${forbidden}" — a part is finalized because a supplier ` +
        'AGREED, never because they are booked',
    );
  }
  // Vacuity: the slice really is the MB12 section and really does contain its
  // own function, so an empty match cannot pass as a clean sweep.
  assert.ok(tail.includes('partFinalizationStateOf'), 'the sliced tail is not the MB12 section');
});

/* ── 2 · every transition the machine can be in ──────────────────────────── */

const EVERY_STATE: Array<[string | null, LockRequestState]> = [
  [null, 'none'],
  ['pending', 'requested'],
  ['agreed', 'locked'],
  ['declined', 'declined'],
  ['cancelled', 'cancelled'],
  ['expired', 'expired'],
];

test('all five database values plus absence map to the shared vocabulary, and nothing else does', () => {
  for (const [db, expected] of EVERY_STATE) {
    assert.equal(partFinalizationStateOf({ state: db }), expected, `${db} → ${expected}`);
  }
  // An unknown value is `none`, not a crash and not a guess. The CHECK
  // constraint makes it unreachable from the database; a hand-repaired row or a
  // future value must degrade to "nobody has asked" rather than to "agreed".
  assert.equal(partFinalizationStateOf({ state: 'wat' }), 'none');
  assert.equal(partFinalizationStateOf({ state: '' }), 'none');
});

test('only `agreed` is finalized — not a pending ask, not a cancelled one, not a stale timestamp', () => {
  for (const [db, expected] of EVERY_STATE) {
    assert.equal(isPartFinalized({ state: db }), expected === 'locked', `${db}`);
  }
});

test('the counter-handshake reads through the SAME machine, on its own column', () => {
  assert.equal(partReopenStateOf(null), 'none');
  assert.equal(partReopenStateOf({ reopen_state: null }), 'none');
  assert.equal(partReopenStateOf({ reopen_state: 'pending' }), 'requested');
  assert.equal(partReopenStateOf({ reopen_state: 'agreed' }), 'locked');
  assert.equal(partReopenStateOf({ reopen_state: 'expired' }), 'expired');
});

/* ── 3 · the fuse is the same fuse ───────────────────────────────────────── */

test('the part handshake uses the booking handshake’s window and its exact phrasing', () => {
  assert.equal(LOCK_ANSWER_WINDOW_HOURS, 48, 'the two scopes must not drift to two windows');

  const now = new Date('2026-09-04T00:00:00Z');
  const in47 = new Date('2026-09-05T23:00:00Z').toISOString();
  assert.equal(lockRequestHoursLeft(in47, now), 47);
  assert.equal(lockRequestFuseLabel(in47, now), '2 days left to answer');
  assert.equal(
    lockRequestFuseLabel(new Date('2026-09-04T00:30:00Z').toISOString(), now),
    '1 hour left to answer',
  );
  // Past its deadline floors at 0 — "closing now", never a negative countdown.
  assert.equal(lockRequestFuseLabel(new Date('2026-09-03T00:00:00Z').toISOString(), now), 'closing now');
  // No stored deadline → NO countdown, rather than a number nobody measured.
  assert.equal(lockRequestFuseLabel(null, now), null);
});
