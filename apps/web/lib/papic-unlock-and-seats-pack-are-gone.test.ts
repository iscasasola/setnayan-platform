/**
 * NO SEAT CAPTURE IS FREE: THE UNLOCK PASS AND THE PAPIC_SEATS PACK ARE GONE.
 *
 * Owner, 2026-11-05: "no one. remove both". Two things used to make a seat
 * capture cost 0 in the app:
 *   · an event holding the "Unlock all of Papic" pass — both seams skipped the
 *     meter, and its two umbrellas freed the paid camera rungs;
 *   · a seat from the PAPIC_SEATS pack (not a per-camera seat) — it shot
 *     UNMETERED while its event owned the pack.
 * Both seams are server-only, so this reads their SOURCE with comments stripped
 * (their own prose explains what was removed). The database half is pinned in
 * tests/db/papic-unlock-and-seats-pack-are-gone.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = process.cwd();
const RECORD = 'app/papic/actions.ts';
const PRESIGN = 'app/api/upload/route.ts';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const RETIRED = [
  'eventHasPapicUnlock',
  'eventUnliFreeViaUnlock',
  'eventLtdFreeViaUnlock',
  'eventOwnsPapicSeats',
  'eventPapicSeatsActive',
  'provisionPapicSeatsAdmin',
  'papic_provision_seats',
];

test('no app code calls a retired Unlock or seats-pack helper', () => {
  const hits: string[] = [];
  for (const rel of [RECORD, PRESIGN, 'lib/papic-guest.ts', 'lib/sku-activation.ts',
    'lib/entitlements.ts', 'lib/papic-cameras.ts', 'lib/papic-seats.ts',
    'app/dashboard/[eventId]/studio/papic/actions.ts', 'app/dashboard/[eventId]/memories/page.tsx']) {
    const code = src(rel);
    for (const name of RETIRED) if (new RegExp(`\\b${name}\\b`).test(code)) hits.push(`${rel}: ${name}`);
  }
  assert.deepEqual(hits, []);
});

test('the record step prices EVERY capture — no branch leaves it at 0', () => {
  const code = src(RECORD);
  assert.doesNotMatch(code, /\bunlocked\b/, 'an "unlocked" bypass is back in recordSeatCapture');
  // The price is assigned once, and not under any condition of its own.
  const at = code.indexOf('meterCost = papicCaptureCost(');
  assert.ok(at > 0, 'recordSeatCapture no longer prices the capture');
  const before = code.slice(Math.max(0, at - 200), at);
  assert.doesNotMatch(before, /if\s*\(\s*!/, 'the price sits behind a negated condition again');
  // And it is what reaches the database.
  assert.match(code, /p_cost:\s*meterCost/, 'the price is not what the record call charges');
});

test('a seat that is not a per-camera seat is refused at BOTH steps, never let through free', () => {
  const record = src(RECORD);
  assert.match(
    record,
    /if \(!cameraTier\) return \{ ok: false, error: 'not_owned' \};/,
    'recordSeatCapture no longer refuses a pack seat outright',
  );
  const presign = src(PRESIGN);
  assert.match(
    presign,
    /if \(!cameraTier\) \{\s*return NextResponse\.json\(\s*\{ error: 'This Papic pack is no longer active\.' \},\s*\{ status: 403 \},/,
    'the presign route no longer refuses a pack seat outright',
  );
});

test('the presign step always probes the camera’s credits', () => {
  const code = src(PRESIGN);
  assert.doesNotMatch(code, /\bunlocked\b/, 'an "unlocked" bypass is back in the presign route');
  assert.match(code, /'papic_capture_points_available'/);
  assert.match(code, /'papic_event_points_remaining_for_seat'/);
});
