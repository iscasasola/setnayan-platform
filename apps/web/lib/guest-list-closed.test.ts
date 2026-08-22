/**
 * The invitation closes when the guest list is final (owner 2026-08-20).
 *
 * Every case pins an INSTANT explicitly — `nowMs` is injectable precisely so
 * these never depend on the wall clock. The suite also runs under a non-UTC
 * TZ in CI (see the repo's TZ matrix), and this module's whole reason for
 * parsing with a trailing 'Z' is that the door must shut at the same instant
 * everywhere; the timezone case below asserts that rather than trusting it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINALIZE_LEAD_DAYS,
  guestListDeadlineEndMs,
  guestListIsClosed,
} from './guest-list-closed';

const DAY = 24 * 60 * 60 * 1000;

test('an explicit deadline closes the list at the END of that day, UTC', () => {
  const end = guestListDeadlineEndMs('2026-09-01', '2026-12-12');
  assert.equal(end, Date.parse('2026-09-01T23:59:59Z'));
  // One second before the end of the deadline day the list is still open —
  // "your deadline is the 1st" must mean the whole of the 1st.
  assert.equal(
    guestListIsClosed({
      lockedAt: null,
      editDeadline: '2026-09-01',
      eventDate: '2026-12-12',
      nowMs: Date.parse('2026-09-01T23:59:58Z'),
    }),
    false,
  );
  assert.equal(
    guestListIsClosed({
      lockedAt: null,
      editDeadline: '2026-09-01',
      eventDate: '2026-12-12',
      nowMs: Date.parse('2026-09-02T00:00:01Z'),
    }),
    true,
  );
});

test('no explicit deadline falls back to FINALIZE_LEAD_DAYS before the event', () => {
  const end = guestListDeadlineEndMs(null, '2026-12-12');
  assert.equal(
    end,
    Date.parse('2026-12-12T23:59:59Z') - FINALIZE_LEAD_DAYS * DAY,
  );
  assert.equal(end, Date.parse('2026-11-28T23:59:59Z'));
});

test('the explicit deadline WINS over the event-date fallback', () => {
  // A couple who set a far-out deadline must not be closed early by the
  // 14-day default, and vice versa. Both directions.
  assert.equal(
    guestListIsClosed({
      lockedAt: null,
      editDeadline: '2026-12-10',
      eventDate: '2026-12-12',
      nowMs: Date.parse('2026-12-01T00:00:00Z'), // past the 14-day default
    }),
    false,
  );
  assert.equal(
    guestListIsClosed({
      lockedAt: null,
      editDeadline: '2026-06-01',
      eventDate: '2026-12-12',
      nowMs: Date.parse('2026-07-01T00:00:00Z'), // long before the default
    }),
    true,
  );
});

test('the finalize STAMP closes the list on its own, whatever the dates say', () => {
  // The stamp is written once and never un-written. A couple who later moves
  // their deadline out does not reopen a list the binding count was frozen on.
  assert.equal(
    guestListIsClosed({
      lockedAt: '2026-07-01T00:00:00Z',
      editDeadline: '2027-01-01',
      eventDate: '2027-06-06',
      nowMs: Date.parse('2026-08-20T00:00:00Z'),
    }),
    true,
  );
});

test('no deadline and no event date = a list that never closes on its own', () => {
  // Very early planning. Closing an invitation for an event with no date would
  // be a door shut on a schedule nobody set.
  assert.equal(guestListDeadlineEndMs(null, null), null);
  assert.equal(
    guestListIsClosed({ lockedAt: null, editDeadline: null, eventDate: null }),
    false,
  );
});

test('an unparseable date closes nothing — it must never fail SHUT', () => {
  // Garbage in a date column is not a reason to delete a wedding's RSVP form.
  assert.equal(guestListDeadlineEndMs('not-a-date', null), null);
  assert.equal(guestListDeadlineEndMs(null, 'not-a-date'), null);
  assert.equal(
    guestListIsClosed({
      lockedAt: null,
      editDeadline: 'not-a-date',
      eventDate: 'also-not-a-date',
    }),
    false,
  );
});

test('the door shuts at ONE instant regardless of the running timezone', () => {
  // The bug this guards: a bare "T23:59:59" parses as server-LOCAL time, so
  // the same event would close 8 hours apart in Manila and in UTC.
  const before = process.env.TZ;
  const ends: number[] = [];
  for (const tz of ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati']) {
    process.env.TZ = tz;
    ends.push(guestListDeadlineEndMs('2026-09-01', null)!);
    ends.push(guestListDeadlineEndMs(null, '2026-12-12')!);
  }
  process.env.TZ = before;
  const explicit = ends.filter((_, i) => i % 2 === 0);
  const fallback = ends.filter((_, i) => i % 2 === 1);
  assert.equal(new Set(explicit).size, 1, 'explicit deadline moved with TZ');
  assert.equal(new Set(fallback).size, 1, 'fallback deadline moved with TZ');
});
