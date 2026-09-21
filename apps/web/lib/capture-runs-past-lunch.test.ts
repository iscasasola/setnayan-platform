/**
 * CAPTURE RUNS TWELVE HOURS PAST THE END OF THE EVENT DAY (owner 2026-09-22).
 *
 * Owner, two messages in one sitting: *"okay, we give them until lunch the next
 * day."* then *"just do 12 hours after the event ends."* `events` holds no clock
 * time for an event anywhere, so "when their event ends" is the end of the
 * event's calendar DAY, 23:59:59 Manila — and twelve hours past that is
 * 11:59:59 the next morning, which is lunch the next day. One rule.
 *
 * ⚠ THIS FILE RUNS UNDER Asia/Manila, AND THAT IS THE POINT. `node --test`
 * gives each test FILE its own process, so the TZ set below reaches nothing
 * else. The sibling suite's docblock has warned for a month that a UTC-only
 * run is blind to this whole class — midnight UTC genuinely is the start of the
 * UTC day, so a wrong Manila boundary still reads correct — and that is exactly
 * how the zero-width seat window shipped. The guard at the top fails loudly
 * rather than letting the suite pass in the one timezone that cannot see the
 * bug.
 *
 * 🔑 EVERY ASSERTION IS DERIVED FROM PAPIC_CAPTURE_GRACE_HOURS, never from the
 * literal "11:59". Deleting the `+ 12 hours` term has to turn this file red;
 * a test that hard-codes the answer stays green against a resolver that has
 * stopped applying the rule at all.
 */
process.env.TZ = 'Asia/Manila';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PAPIC_CAPTURE_GRACE_HOURS,
  captureCloseEndDate,
  captureWindowState,
  formatCaptureCloseLabel,
  manilaCaptureCloseIso,
  manilaEndOfDayIso,
  resolvePapicWindow,
  resolveStoredWindow,
} from './papic-window';
import { guestCaptureGate } from './papic-guest-window';

const HOUR = 3_600_000;
const ms = (iso: string) => Date.parse(iso);

/** The wedding day. The morning after is the 21st. */
const DAY = '2026-12-20';
const NEXT = '2026-12-21';

test('the suite really is running in Manila, or it cannot see this class', () => {
  assert.equal(
    new Date(`${DAY}T00:00:00Z`).getTimezoneOffset(),
    -480,
    'TZ is not Asia/Manila — every boundary below would be measured in the one ' +
      'timezone where a wrong Manila boundary still reads correct',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE INSTANT
// ───────────────────────────────────────────────────────────────────────────

test('the cameras close exactly twelve hours after the event day ends', () => {
  const close = manilaCaptureCloseIso(DAY);
  assert.equal(
    ms(close) - ms(manilaEndOfDayIso(DAY)),
    PAPIC_CAPTURE_GRACE_HOURS * HOUR,
    'the close instant is not the end of the event day plus the owner’s hours',
  );
  // …which is lunch the next day, the owner's other sentence for the same rule.
  assert.equal(close, `${NEXT}T11:59:59+08:00`);
});

test('a wedding window ends on its event DAY and closes the next morning', () => {
  const r = resolvePapicWindow({
    eventType: 'wedding',
    eventDate: DAY,
    startDate: DAY,
    startTime: '14:00',
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.window.endDate, DAY, 'the last DAY is still the event day');
  assert.equal(r.window.days, 1, 'the tail must not turn a one-day wedding into two');
  assert.equal(r.window.endIso, manilaCaptureCloseIso(DAY));
});

test('a trip’s last day gets the same twelve hours — one rule, no exception', () => {
  const r = resolvePapicWindow({
    eventType: 'travel',
    eventDate: null,
    startDate: '2026-07-10',
    endDate: '2026-07-15',
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.window.days, 6, 'the trip is still six days');
  assert.equal(r.window.endDate, '2026-07-15');
  assert.equal(r.window.endIso, manilaCaptureCloseIso('2026-07-15'));
});

test('a celebration that never opened the picker gets the tail too', () => {
  const w = resolveStoredWindow({ windowStart: null, windowEnd: null, eventDate: DAY });
  assert.equal(w.endIso, manilaCaptureCloseIso(DAY));
  assert.equal(w.endDate, DAY, 'the fallback’s last day is still the event day');
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE GATE — the thing that refuses a real shutter tap
// ───────────────────────────────────────────────────────────────────────────

const seatUntil = manilaCaptureCloseIso(DAY);

test('🔑 the camera still shoots at 11 AM the next morning', () => {
  assert.equal(
    captureWindowState(DAY, seatUntil, ms(`${NEXT}T11:00:00+08:00`)),
    'open',
    'the brunch shot the owner asked for was refused',
  );
});

test('and stops at the instant, not a minute either side of it', () => {
  assert.equal(captureWindowState(DAY, seatUntil, ms(seatUntil)), 'open', 'the last second');
  assert.equal(
    captureWindowState(DAY, seatUntil, ms(seatUntil) + 1),
    'closed',
    'one millisecond past the close',
  );
  assert.equal(
    captureWindowState(DAY, seatUntil, ms(`${NEXT}T12:00:00+08:00`)),
    'closed',
    'noon the next day is past lunch',
  );
});

test('the whole tail is open, end to end — midnight through the morning', () => {
  for (const at of ['23:30:00', '00:00:00', '03:00:00', '09:00:00', '11:59:00']) {
    const day = at.startsWith('23') ? DAY : NEXT;
    assert.equal(
      captureWindowState(DAY, seatUntil, ms(`${day}T${at}+08:00`)),
      'open',
      `refused at ${day} ${at} Manila`,
    );
  }
});

test('the start bound is untouched — this ruling was about the END', () => {
  assert.equal(
    captureWindowState(DAY, seatUntil, ms(`${DAY}T00:00:00+08:00`) - 1),
    'not_started',
  );
  assert.equal(captureWindowState(DAY, seatUntil, ms(`${DAY}T00:00:00+08:00`)), 'open');
});

test('a bare DATE keeps its old whole-day meaning, and is not given the tail', () => {
  // The migration rewrites every real row; this branch only has to not lie.
  // Silently re-reading old values under a new rule is how a window changes
  // meaning without anyone deciding it.
  assert.equal(captureWindowState(DAY, DAY, ms(`${DAY}T23:59:59+08:00`)), 'open');
  assert.equal(captureWindowState(DAY, DAY, ms(`${NEXT}T11:00:00+08:00`)), 'closed');
});

test('null bounds still fail OPEN — a legacy seat is never bricked', () => {
  assert.equal(captureWindowState(null, null, Date.now()), 'open');
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · THE GUEST'S PHONE — the same gate, the other door
// ───────────────────────────────────────────────────────────────────────────

test('🔑 a guest at a reception past midnight is not refused her photograph', () => {
  const at = (iso: string) =>
    guestCaptureGate({ earlyAllowed: false, eventDate: DAY, nowMs: ms(iso) }).state;
  assert.equal(at(`${DAY}T23:59:00+08:00`), 'open', 'the last dance');
  assert.equal(at(`${NEXT}T01:30:00+08:00`), 'open', 'the after-party');
  assert.equal(at(`${NEXT}T11:00:00+08:00`), 'open', 'breakfast');
  assert.equal(at(`${NEXT}T12:00:00+08:00`), 'closed', 'past lunch');
});

test('the host’s early switch closes on the stored window end, as it always did', () => {
  const windowEnd = manilaCaptureCloseIso(DAY);
  const at = (iso: string) =>
    guestCaptureGate({
      earlyAllowed: true,
      eventDate: DAY,
      windowStart: `2026-06-20T00:00:00+08:00`,
      windowEnd,
      nowMs: ms(iso),
    }).state;
  assert.equal(at(`${NEXT}T11:00:00+08:00`), 'open');
  assert.equal(at(`${NEXT}T12:00:00+08:00`), 'closed');
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · THE SCREEN AND THE GATE ANSWER TO ONE RESOLVER
// ───────────────────────────────────────────────────────────────────────────

test('🔑 the couple is told the instant the gate actually closes on', () => {
  const r = resolvePapicWindow({ eventType: 'wedding', eventDate: DAY, startDate: DAY });
  assert.ok(r.ok);
  if (!r.ok) return;
  const label = formatCaptureCloseLabel(r.window.endIso);
  assert.ok(label, 'the picker had nothing to print');

  // The label is only honest if the gate agrees at that instant and refuses
  // after it. Asserted against ONE window, never two computations of the rule.
  assert.equal(captureWindowState(r.window.startDate, r.window.endIso, ms(r.window.endIso)), 'open');
  assert.equal(
    captureWindowState(r.window.startDate, r.window.endIso, ms(r.window.endIso) + 1),
    'closed',
  );
  assert.match(label!, /Dec 21/, `the label names the wrong day: ${label}`);
  assert.match(label!, /11:59/, `the label names the wrong time: ${label}`);
});

test('the chosen end DAY survives the round trip, in both stored shapes', () => {
  // A window written after this ships…
  assert.equal(captureCloseEndDate(manilaCaptureCloseIso(DAY)), DAY);
  // …and one written before it, which the migration has not reached yet.
  assert.equal(captureCloseEndDate(manilaEndOfDayIso(DAY)), DAY);
  assert.equal(captureCloseEndDate(null), null);
});

test('a stored window does not grow a phantom day on any label', () => {
  const w = resolveStoredWindow({
    windowStart: `${DAY}T14:00:00+08:00`,
    windowEnd: manilaCaptureCloseIso(DAY),
    eventDate: DAY,
  });
  assert.equal(w.days, 1, 'the close instant added a day to the price label');
  assert.equal(w.endDate, DAY);
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · NOBODY COMPUTES THE TAIL A SECOND TIME
// ───────────────────────────────────────────────────────────────────────────

test('the rule lives in one function — no second "+ 12 hours" anywhere', () => {
  const WEB = process.cwd();
  const files = [
    'lib/papic-guest-window.ts',
    'app/dashboard/[eventId]/studio/papic/papic-window-picker.tsx',
    'app/dashboard/[eventId]/studio/papic/_components/guest-cameras-choice.tsx',
  ];
  for (const f of files) {
    const src = readFileSync(join(WEB, f), 'utf8');
    assert.match(
      src,
      /manilaCaptureCloseIso|formatCaptureCloseLabel|papic_window_end/,
      `${f} must reach the close instant through the shared resolver`,
    );
    assert.ok(
      !/\+\s*12\s*\*\s*3_?600_?000|hours?['"]?\s*:\s*12|\+\s*12\s*\*\s*60\s*\*\s*60/.test(src),
      `${f} re-derives the twelve hours. Two computations of one rule is how a ` +
        `page ends up promising a shutter that is already shut.`,
    );
  }
});

test('the migration widens valid_until rather than stamping the next date', () => {
  const sql = readFileSync(
    join(process.cwd(), '..', '..', 'supabase', 'migrations',
      '20271238778987_papic_capture_runs_past_lunch.sql'),
    'utf8',
  );
  assert.match(
    sql,
    /ALTER COLUMN valid_until TYPE TIMESTAMPTZ/,
    'a DATE column cannot express 11:59am — stamping "last day + 1" grants the WHOLE next day',
  );
  assert.match(sql, /INTERVAL '12 hours'/, 'the owner’s twelve hours are not in the migration');
  assert.ok(
    !/ALTER COLUMN valid_from TYPE/.test(sql),
    'valid_from must stay a DATE — widening it would suddenly honour a start TIME ' +
      'that has always been truncated to midnight, and REFUSE shots that work today',
  );
});
