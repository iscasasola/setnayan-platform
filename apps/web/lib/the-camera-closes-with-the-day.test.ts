/**
 * A supplier's camera closes when the celebration is over.
 *
 * Owner, 2026-08-28, ruling on whether the supplier capture lane stays open:
 * ***"they get to use it until event day."***
 *
 * ── WHAT WAS TRUE BEFORE ────────────────────────────────────────────────────
 * The lane had NO time bound at all. `app/api/vendor/papic-capture/route.ts`
 * gated on a session, the privacy control, a booked event (via its RLS insert
 * policy), consent and the tier's point budget — and nothing whatsoever about
 * when. A supplier booked on one celebration could keep shooting into it a year
 * later.
 *
 * ── THE RULE, AND WHY IT IS NOT A NEW ONE ───────────────────────────────────
 * "Over" already has ONE answer in this product: 06:00 in the VENUE's clock on
 * the day after `COALESCE(event_end_date, event_date)`, or the moment the host
 * presses "Close out the day". `getMenuLifecyclePhase` owns it, and the six
 * hours (a Filipino reception runs past midnight), the LAST day rather than the
 * first (a festival's middle days are not "after") and the calendar-day step
 * (never `+24h`, which lands an hour off across a DST boundary) were all argued
 * out there. This file asserts that the camera reuses that answer rather than
 * deriving a second one.
 *
 * 🔑 THE READING THIS ENCODES, stated so it can be corrected in one word:
 * *"until event day"* is taken as **through the day, closed after it** — a
 * supplier delivers ON the day, and a lane that shut before it would be useless
 * on the one day it exists for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { getMenuLifecyclePhase, morningAfterInstantMs } from '@/lib/day-of-mode';

const WEB_ROOT = join(process.cwd(), process.cwd().endsWith('/apps/web') ? '' : 'apps/web');
const ROUTE = 'app/api/vendor/papic-capture/route.ts';
const route = () => stripComments(readFileSync(join(WEB_ROOT, ROUTE), 'utf8'));

const MNL = 'Asia/Manila';
const DAY = '2026-12-12';
const at = (iso: string) => new Date(iso).getTime();
/** The phase the route computes, for a single-day Manila celebration. */
const phaseAt = (iso: string, end: string | null = null, cleared: string | null = null) =>
  getMenuLifecyclePhase(DAY, cleared, MNL, at(iso), end);

// ── The window itself ─────────────────────────────────────────────────────

test('the camera is open on the day of the celebration', () => {
  for (const t of ['00:30', '09:00', '14:00', '23:59']) {
    assert.notEqual(
      phaseAt(`${DAY}T${t}:00+08:00`),
      'after',
      `${t} on the day itself must not be "over" — this is the day the lane exists for`,
    );
  }
});

test('the camera is open past midnight, because a reception runs past midnight', () => {
  // The single most likely real capture that a midnight boundary would refuse.
  assert.notEqual(phaseAt('2026-12-13T01:30:00+08:00'), 'after');
  assert.notEqual(phaseAt('2026-12-13T05:59:00+08:00'), 'after');
});

test('the camera closes at 06:00 the morning after, and stays closed', () => {
  assert.equal(phaseAt('2026-12-13T06:00:00+08:00'), 'after', 'the boundary itself');
  assert.equal(phaseAt('2026-12-13T09:00:00+08:00'), 'after');
  assert.equal(phaseAt('2027-06-01T09:00:00+08:00'), 'after', 'and six months later');
});

test('the camera is open in the months BEFORE — a supplier documents its own work early', () => {
  // The lane is not day-of-only: a cake maker photographs the cake when the cake
  // is made. Only the far end moved.
  assert.notEqual(phaseAt('2026-06-01T10:00:00+08:00'), 'after');
  assert.notEqual(phaseAt('2026-12-11T10:00:00+08:00'), 'after');
});

test('a celebration spanning several days stays open through the LAST one', () => {
  const END = '2026-12-14';
  assert.notEqual(phaseAt('2026-12-13T12:00:00+08:00', END), 'after', 'a middle day');
  assert.notEqual(phaseAt('2026-12-14T22:00:00+08:00', END), 'after', 'the last day');
  assert.equal(phaseAt('2026-12-15T06:00:00+08:00', END), 'after', 'the morning after the last');
});

test('the venue’s clock decides, not the server’s', () => {
  // 06:00 Manila on the 13th is 22:00 UTC on the 12th. A server reading its own
  // clock would close the lane eight hours early for a Manila wedding.
  const boundary = morningAfterInstantMs(DAY, MNL, null);
  assert.equal(new Date(boundary).toISOString(), '2026-12-12T22:00:00.000Z');
  assert.notEqual(phaseAt('2026-12-12T22:59:00+08:00'), 'after', 'still the evening in Manila');
});

test('the host closing out the day closes the camera immediately', () => {
  assert.equal(
    phaseAt(`${DAY}T14:00:00+08:00`, null, `${DAY}T13:00:00+08:00`),
    'after',
    'a host who says the day is done has said it for the suppliers too',
  );
});

// ── The route reuses the rule, and fails open ─────────────────────────────

test('the route asks the ONE resolver — it does not re-derive "over"', () => {
  const src = route();
  assert.match(src, /getMenuLifecyclePhase\(/, 'the route must call the shared resolver');
  assert.ok(
    !/06:?00|21600000|60 \* 60 \* 6/.test(src),
    'the route must not carry its own copy of the six-hour boundary',
  );
  assert.match(src, /'event_over'/, 'and refuse with a named reason');
});

test('the route reads the LAST day and the venue’s zone, not just the first date', () => {
  const src = route();
  assert.match(src, /event_end_date/, 'a festival must not close on its first day');
  assert.match(src, /timezone/, 'the venue’s clock decides');
  assert.match(src, /cleared_at/, 'and the host’s own "close out the day"');
});

test('the gate runs BEFORE anything is uploaded or spent', () => {
  // A capture refused after the R2 write has already cost storage and points.
  const src = route();
  // 🪤 MATCH THE CALL, NOT THE NAME. The first `r2Upload` in this file is its
  // IMPORT on line 4, so `indexOf('r2Upload')` puts the upload before every
  // gate and this test failed on a correct route. Same for `canCapture`.
  const gate = src.indexOf("'event_over'");
  const upload = src.indexOf('r2Upload({');
  const spend = src.indexOf('canCapture(tier');
  assert.ok(gate > 0 && upload > 0 && spend > 0, 'all three landmarks must exist');
  assert.ok(gate < upload, 'the window must be checked before the upload');
  assert.ok(gate < spend, 'and before the point budget is spent');
});

test('an unreadable event leaves the lane OPEN', () => {
  // Fail-open is deliberate: a transient read failure must never stop a
  // supplier capturing on the one day they are standing at the venue.
  const src = route();
  assert.match(
    src,
    /if \(ev\) \{/,
    'the phase check must be inside a guard on the event having been read',
  );
  assert.equal(getMenuLifecyclePhase(null, null, MNL, at('2027-01-01T09:00:00+08:00')), 'plan');
});

// ── The docblock that misled six weeks of planning ───────────────────────

test('the route no longer claims the lane is switched off', () => {
  // The old comment said "default OFF … this route 403s". The control has been
  // ACTIVE in production since 2026-07-16, and planning read the comment.
  // 🪤 The correction QUOTES the sentence it is correcting, so a bare
  // /default OFF/ match finds the fix and calls it the defect. Assert the
  // original ASSERTION is gone — the parenthetical that stated it as fact —
  // and that the correction is present.
  const raw = readFileSync(join(WEB_ROOT, ROUTE), 'utf8');
  assert.ok(
    !/`vendor_papic_capture`, default OFF\)/.test(raw),
    'the route must not state the control is off — it has been active since 2026-07-16',
  );
  assert.ok(!/this route 403s and no guest PI is collected/.test(raw));
  assert.match(raw, /ACTIVE IN PRODUCTION SINCE 2026-07-16/);
  assert.match(raw, /they get to use it until event day/, 'and carry the ruling it implements');
});
