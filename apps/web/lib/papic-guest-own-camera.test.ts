/**
 * THE EVENT-SITE GUEST CAN BUY THEIR OWN SHOTS — the half PR #4054 left open.
 *
 * #4054 let a guest buy shots for the camera they HOLD. But only a seat can hold
 * a dedicated balance, and the event site's camera identifies its shooter by a
 * signed cookie with no seat and often no auth user — so the free-pool guest the
 * owner actually asked about was still refused, and could only top up the HOST's
 * pool.
 *
 * The fix mints them a camera of their own at purchase, reusing
 * `paparazzi_seats.guest_id` (which already exists for host-bought Limited
 * cameras, already runs with a NULL claimer). Everything downstream then works
 * untouched — which is the point, and is what most of these tests pin.
 *
 * ── THE THREE WAYS THIS GOES WRONG SILENTLY ───────────────────────────────
 * 1. Minting at the wrong TIER caps a paying guest at 20/day the moment their
 *    bought shots run out — worse off than never having bought.
 * 2. Routing an un-bought guest through the seat reserve imposes that same cap
 *    on people who never paid anything.
 * 3. Booking her camera and then failing the record (or dying before it)
 *    burns a shot the guest PAID for, on a photo that does not exist.
 * Each has a test below. None throws; all three would ship green without one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments — a note explaining a rule must not satisfy its own test.
 *
 *  🪤 THIS USED TO BE TWO `.replace()` CALLS AND IT WAS BLIND. Block comments
 *  first, so a `//` line holding `video/*` — which the route this file scans
 *  contains — opened a comment that closed at the next real docblock. On
 *  2026-08-30 adding ONE JSDoc to that route cut what these tests could see from
 *  16,218 characters to 6,430 and turned four of them red at once, on a change
 *  that touched nothing they assert. */
const noComments = stripComments;

// ── the purchase now reaches the cookie-only guest ─────────────────────────

test('a cookie-only guest is no longer refused outright', () => {
  const src = noComments(read('app/papic/buy/actions.ts'));
  assert.ok(
    !/buyer!\.kind !== 'seat'\)\s*backTo\(returnTo, 'no_camera'\)/.test(src),
    'the blanket refusal of every seatless buyer must be gone — that was the ' +
      'whole gap: the free-pool guest could only top up the HOST.',
  );
  assert.match(
    src,
    /ensureGuestOwnCameraAdmin\(/,
    'a seatless buyer must get a camera of their own minted at purchase',
  );
});

test('🔒 the camera is minted from the CREDENTIAL, never from the form', () => {
  // A form-supplied guest id would let anyone mint a camera against any guest —
  // and then buy points onto it.
  const src = read('app/papic/buy/actions.ts');
  const call = src.slice(src.indexOf('ensureGuestOwnCameraAdmin('));
  const args = call.slice(0, call.indexOf(');'));
  assert.match(args, /buyer!\.eventId/);
  assert.match(args, /buyer!\.guestId/);
  assert.ok(
    !/formData/.test(args),
    'no form value may reach the mint — the buyer is resolved from their own ' +
      'signed session by resolveGuestBuyer',
  );
});

test('no camera ⇒ no order (fail closed)', () => {
  // Taking money for points with nowhere to land is the worst outcome here:
  // the guest pays and the grant can never be applied.
  const src = noComments(read('app/papic/buy/actions.ts'));
  assert.match(src, /if \(!seatId\) backTo\(returnTo, 'no_camera'\)/);
});

test('the order records the minted camera, so activation needs no change', () => {
  // papic_one_orders.seat_id is what grantPapicCameraPoints reads. If the mint
  // did not flow into it, approval would grant points to nothing.
  const src = read('app/papic/buy/actions.ts');
  const insert = src.slice(src.indexOf('papic_one_orders'));
  assert.match(insert.slice(0, 400), /seatId: seatId!/);
});

// ── 1 · the tier, and the cap it avoids ───────────────────────────────────

test("🪤 the minted camera is 'unlimited' — the only tier with no daily cap", () => {
  // papic_tier_config: free 20 · mini 20 · roll 20 · ltd 70 · unlimited NULL.
  // The retired per-camera gate (papic_reserve_camera_points, dropped
  // 2026-09-18) spent a dedicated balance FIRST and then fell through to the
  // tier's DAILY budget; the tier still decides what any future daily cap reads. The event-site camera
  // has never had a daily cap, so any other tier here would mean a guest who
  // PAID ends up more limited than one who did not.
  const src = noComments(read('lib/papic-guest-own-camera.ts'));
  const mint = src.slice(src.indexOf('export async function ensureGuestOwnCameraAdmin'));
  assert.match(mint, /tier: 'unlimited'/);
  for (const capped of ['free', 'mini', 'roll', 'ltd']) {
    assert.ok(
      !new RegExp(`tier: '${capped}'`).test(mint),
      `${capped} carries a daily budget — it would cap a paying guest`,
    );
  }
});

test('minting reuses an existing camera rather than adding a second', () => {
  // paparazzi_seats_one_active_camera_per_guest allows exactly one, and
  // "more shots for MY camera" is what the buyer means anyway.
  const src = read('lib/papic-guest-own-camera.ts');
  const mint = src.slice(src.indexOf('export async function ensureGuestOwnCameraAdmin'));
  assert.ok(
    mint.indexOf('resolveGuestOwnCamera') < mint.indexOf('.insert('),
    'it must look for an existing camera BEFORE inserting one',
  );
  assert.match(mint, /if \(existing\) return existing\.seatId;/);
});

// ── 2 · the capture path stays invisible to everyone who did not buy ───────

// 🔁 THE BOOKING MOVED INTO ONE TRANSACTION WITH THE ROW (20271276810836).
// The route used to call `reserveGuestOwnCameraCapture` and unwind it by hand
// through `releaseCaptureCredits` when the record refused — which could only
// run if the process was still alive. Both helpers are gone; the rules they
// carried are asserted against the function that now holds them.
const SPEND = (() => {
  const raw = read('../../supabase/migrations/20271276810836_a_guest_shot_spends_with_its_row.sql');
  const body = raw.slice(raw.indexOf('CREATE OR REPLACE FUNCTION public.papic_record_guest_capture_and_spend'));
  return body.slice(0, body.indexOf('$function$;')).replace(/--[^\n]*/g, '');
})();

test('🪤 the split is used whenever the guest HAS a camera — not when she has a balance left', () => {
  // ⚠ THE SWITCH IS "do they have a camera at all". Keying it on a balance left
  // re-imposes the stop-at-zero the split was written to avoid (owner
  // 2026-08-11): with no dedicated credits the split simply spends the pot.
  assert.ok(SPEND.length > 1000, 'self-check: the function body read as near-empty');
  assert.match(
    SPEND,
    /SELECT s\.seat_id INTO v_seat[\s\S]{0,200}?s\.guest_id = p_guest_id[\s\S]{0,80}?s\.revoked_at IS NULL/,
    'her camera is found by the predicate resolveGuestOwnCamera uses',
  );
  assert.match(SPEND, /IF v_seat IS NOT NULL THEN[\s\S]{0,200}?papic_reserve_capture_split\(v_seat, v_event, v_cost\)/);
  assert.ok(
    !/papic_seat_dedicated_points/.test(SPEND),
    'a balance-gated switch would stop a guest who spent what she bought while the pot is full',
  );
});

test('a guest spending their OWN shots skips the shared-pool pre-check', () => {
  // An empty shared pool is precisely what they bought their way out of.
  // Refusing there would take their money and still not let them shoot.
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.match(src, /!spendOwn &&\s*\n?\s*\(await papicEventPoolPreCheckExhausted\(/);
});

test('the camera is resolved ONCE in the route', () => {
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.equal(
    (src.match(/resolveGuestOwnCamera\(/g) ?? []).length,
    1,
    'resolve it exactly once per request',
  );
});

// ── 3 · no shot the guest paid for is ever burned ──────────────────────────

test('🚨 her camera books BEFORE the row — the ceiling reads what she paid for herself', () => {
  // The couple's ceiling meters everything she spent MINUS her own purchase,
  // and her own purchase is read off the ledger the split moves. Recording
  // first would meter her own credits as the couple's and refuse her at her
  // own expense. Everyone else books AFTER the row, to keep the pot's lock short.
  const split = SPEND.indexOf('papic_reserve_capture_split(');
  const record = SPEND.indexOf('public.papic_record_guest_capture(\n');
  const pot = SPEND.indexOf('public.papic_reserve_event_points(v_event, v_cost)');
  assert.ok(split > -1 && record > -1 && pot > -1, 'a landmark moved — re-point this guard');
  assert.ok(split < record, 'her camera is booked after the row — the ceiling would charge her own credits to the couple');
  assert.ok(record < pot, 'the pot is booked before the row — its lock is held across the whole record');
});

test('🚨 either side refusing undoes the other — and nothing else is swallowed', () => {
  // An EXCEPTION handler is a subtransaction. Holding the booking AND the row,
  // and catching only the two codes this function raises on purpose, it rolls
  // back both together; a WHEN OTHERS would turn a real failure into a reply.
  const handlers = [...SPEND.matchAll(/WHEN\s+([^\n]+?)\s+THEN/g)].map((m) => m[1]);
  assert.deepEqual(handlers, ["SQLSTATE 'PX409'", "SQLSTATE 'PX422'"]);
  assert.match(SPEND, /IS DISTINCT FROM 'ok'[\s\S]{0,120}?duplicate[\s\S]{0,200}?ERRCODE = 'PX422'/);
});

test('🚨 no hand-written unwind is left in the route, and its helper is gone', () => {
  const route = noComments(read('app/api/papic/guest-capture/route.ts'));
  for (const gone of [/releaseCaptureCredits/, /papic_release_/, /papic_reserve_/, /reserveGuestOwnCameraCapture/]) {
    assert.doesNotMatch(route, gone, `${gone} is back in the route — a second booking or a refund of a spend that committed with its row`);
  }
  assert.equal(
    (route.match(/admin\.rpc\('papic_record_guest_capture_and_spend', \{/g) ?? []).length,
    1,
    'exactly one call books and records',
  );
  assert.ok(
    !existsSync(join(WEB, 'lib/papic-release-capture.ts')),
    'the release helper is back — nothing may put back a spend that committed with its row',
  );
  const lib = noComments(read('lib/papic-guest-own-camera.ts'));
  assert.doesNotMatch(lib, /papic_reserve_capture_split/, 'a second booking door for the guest camera');
});

// ── the offer reaches the surface that needed it ──────────────────────────

test('the event-site camera now offers the "my own shots" rungs', () => {
  const src = read('app/papic/guest/page.tsx');
  assert.match(src, /canReloadOwnCamera/, 'the free-pool guest is the whole point');
});

test('🔒 the host’s pool total still excludes what a guest bought', () => {
  // papic_event_pool_status sums only seat_id IS NULL. A guest's purchase is
  // seat-scoped, so it must never inflate the number the host is watching.
  // Pinned as a read of the reader, since the mint made new seat-scoped grants
  // possible on events that previously had none.
  const src = read('lib/papic-guest-own-camera.ts');
  assert.match(
    src,
    /seat_id IS NULL/,
    'the invariant this design leans on should be stated where it is relied on',
  );
});
