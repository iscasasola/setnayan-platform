import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { guestCaptureGate } from './papic-guest-window';
import { stripComments } from './strip-comments';

/**
 * GUESTS SHOOT ON THE EVENT DAY — UNLESS THE HOST OPENS THE CAMERAS EARLY.
 *
 * Owner-locked 2026-08-07: *"The guests can have the option to use the app on the
 * exact event or when the host allows it"* and *"there should be a button for the
 * host of the event to allow guests to use the papic."*
 *
 * 🚨 THE GAP THIS CLOSES. Guests had NO time gate anywhere. The only question
 * ever asked was `eventPapicGuestActive()` — does this event hold a guest-camera
 * pass — which asks WHETHER and never WHEN. A guest who redeemed their invite six
 * months out could open the camera and shoot into the couple's gallery on any
 * random Tuesday.
 *
 * It is the exact mirror of the seat-camera defect fixed the same day: seat
 * cameras were pinned to a SINGLE DAY and refused everything, guest cameras were
 * open permanently. Both wrong, in opposite directions, in the same feature.
 *
 * ⚠ RUN THIS UNDER Asia/Manila. Every boundary here is a Manila calendar day. In
 * UTC an off-by-eight-hours bug in the day boundary is invisible, which is how
 * the seat window shipped broken. CI runs UTC by default.
 */

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
/** Comment-stripped: assertions must hold on CODE, not on notes about it.
 *  ⚠ One shared lexer. The three-`replace` version here was blind to anything
 *  after a `video/*` in a line comment — including the upload route this file
 *  exists to check. */
const code = (p: string) => stripComments(read(p));

const DAY = '2026-12-20';
const ms = (iso: string) => Date.parse(iso);

test('switch OFF: open all of the event day in Manila, shut on either side', () => {
  const g = (nowMs: number) =>
    guestCaptureGate({ earlyAllowed: false, eventDate: DAY, nowMs }).state;

  assert.equal(g(ms(`${DAY}T00:00:00+08:00`)), 'open', 'midnight Manila');
  assert.equal(g(ms(`${DAY}T14:00:00+08:00`)), 'open', 'the ceremony');
  assert.equal(g(ms(`${DAY}T23:59:59+08:00`)), 'open', 'last second of the party');

  assert.equal(g(ms(`${DAY}T00:00:00+08:00`) - 1), 'not_open_yet', '1ms before the day');
  assert.equal(g(ms(`${DAY}T23:59:59.999+08:00`) + 1), 'closed', '1ms after the day');
  assert.equal(g(ms('2026-06-20T12:00:00+08:00')), 'not_open_yet', 'six months early');
});

test('🪤 the day boundary is MANILA, not UTC — the seat-window bug, again', () => {
  // 08:00 Manila on the event day is midnight UTC. A UTC-based boundary would
  // call the eight hours before that "not yet" — so a morning-preparations shot
  // would be refused while the couple were already at the salon.
  const eightAm = ms(`${DAY}T07:00:00+08:00`); // 23:00 UTC the PREVIOUS day
  assert.equal(
    guestCaptureGate({ earlyAllowed: false, eventDate: DAY, nowMs: eightAm }).state,
    'open',
    '7 AM on the event day is the event day, whatever UTC thinks',
  );
});

test('switch ON: the event window governs instead', () => {
  const start = '2026-06-20T09:00:00+08:00';
  const end = '2026-12-20T23:59:59+08:00';
  const g = (nowMs: number) =>
    guestCaptureGate({
      earlyAllowed: true,
      eventDate: DAY,
      windowStart: start,
      windowEnd: end,
      nowMs,
    }).state;

  // The whole point: a date that is REFUSED with the switch off is ALLOWED with
  // it on. If these two ever agree, the button does nothing.
  const julyAfternoon = ms('2026-07-04T15:00:00+08:00');
  assert.equal(
    guestCaptureGate({ earlyAllowed: false, eventDate: DAY, nowMs: julyAfternoon }).state,
    'not_open_yet',
  );
  assert.equal(g(julyAfternoon), 'open', 'the host opened the cameras — this must differ');

  assert.equal(g(ms('2026-06-19T09:00:00+08:00')), 'not_open_yet', 'before the window');
  assert.equal(g(ms('2026-12-21T00:00:01+08:00')), 'closed', 'after the window');
});

test('missing data FAILS OPEN — never brick a camera at a live party', () => {
  // An event with no date has no "event day"; refusing there would silence a
  // guest standing at a real celebration over a field the couple never filled
  // in. Whether guest cameras exist at all is a different check.
  assert.equal(guestCaptureGate({ earlyAllowed: false, eventDate: null }).state, 'open');
  assert.equal(guestCaptureGate({ earlyAllowed: null, eventDate: undefined }).state, 'open');
  assert.equal(
    guestCaptureGate({ earlyAllowed: false, eventDate: 'not-a-date' }).state,
    'open',
  );
  assert.equal(
    guestCaptureGate({ earlyAllowed: true, eventDate: DAY, windowStart: null, windowEnd: null })
      .state,
    'open',
    'switch on with no stored window must not close the camera',
  );
});

test('🔑 the UPLOAD ROUTE enforces it — the page is only a courtesy', () => {
  const route = code('app/api/papic/guest-capture/route.ts');
  assert.ok(route.length > 1000, 'self-check: route read as near-empty');

  assert.match(
    route,
    /guestCaptureGate\(/,
    'the guest upload route must run the gate. A page-only check is not a gate: ' +
      'this route is reachable directly, and the RPC behind it checks ownership ' +
      'and quota, never time.',
  );
  assert.match(
    route,
    /guest_capture_not_open_yet/,
    'the refusal must carry a NAMED code — an unnamed 4xx becomes a generic ' +
      '"try again" the guest can never satisfy',
  );

  // The web-copy follow-up must stay exempt: it completes a clip we already
  // accepted, and refusing it once the day rolls over strands the raw with no
  // playable copy.
  const webCopyAt = route.indexOf("'web_copy'");
  const gateAt = route.indexOf('guestCaptureGate(');
  assert.ok(webCopyAt > 0 && gateAt > webCopyAt, 'the gate must sit AFTER the web_copy branch');
});

test('🔑 both server callers use the SHARED resolver, not their own date maths', () => {
  // Two copies of a time comparison is exactly how the seat window broke:
  // Date.parse('2026-09-19') is midnight UTC, so a one-day window collapsed to a
  // single instant and every shot was refused.
  for (const f of ['app/api/papic/guest-capture/route.ts', 'app/papic/guest/page.tsx']) {
    assert.match(code(f), /guestCaptureGate\(/, `${f} must use the shared resolver`);
  }
});

test('🚨 a refusal the guest cannot SEE is indistinguishable from a crash', () => {
  const client = code('app/papic/guest/_components/papic-guest-capture.tsx');

  assert.match(
    client,
    /guestWindowRejectMessage/,
    'the camera must translate the window codes into copy. Without this they ' +
      'fall through to "please try again" — advice the guest can never act on, ' +
      'because nothing they do will work until a date.',
  );
  // BOTH paths. The photo branch and the clip branch format their own message,
  // and fixing one and not the other is this project's recurring shape.
  assert.equal(
    (client.match(/guestWindowRejectMessage\(/g) ?? []).length,
    3,
    'expected the helper definition plus BOTH call sites (photo and clip)',
  );
});

test('🔒 the host button is membership-checked and its write is error-checked', () => {
  const action = code(
    'app/dashboard/[eventId]/studio/papic/guest-window-actions.ts',
  );
  assert.ok(action.length > 500, 'self-check: action read as near-empty');

  assert.match(
    action,
    /member_type', 'couple'/,
    'only a couple member may decide when other people may shoot into their gallery',
  );
  assert.match(
    action,
    /if \(!membership\) redirect\(/,
    'a non-member must be turned away before the write',
  );
  // Supabase resolves with { error } instead of throwing, so an unchecked write
  // would redirect to the success state after failing.
  assert.match(
    action,
    /if \(error\) redirect\(/,
    'the write must be error-checked, or a failed save reports success',
  );
});

test('🔒 the column is not writable by authenticated', () => {
  const sql = readFileSync(
    join(WEB, '../../supabase/migrations/20271121501756_papic_guest_capture_host_switch.sql'),
    'utf8',
  ).replace(/--[^\n]*/g, ' ');

  assert.match(sql, /ADD COLUMN IF NOT EXISTS papic_guest_capture_early/);
  assert.match(
    sql,
    /REVOKE UPDATE \(papic_guest_capture_early\) ON public\.events FROM anon, authenticated/,
    'events UPDATE RLS is ROW-level, so a column authenticated can write is ' +
      'writable by anyone who can update the row at all',
  );
});
