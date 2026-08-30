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
 * 3. Booking the seat ledger and then failing the pool leg burns a shot the
 *    guest PAID for, on a photo that was refused.
 * Each has a test below. None throws; all three would ship green without one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  // papic_reserve_camera_points spends a dedicated balance FIRST and falls
  // through to the tier's DAILY budget once it is gone. The event-site camera
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

test('🪤 the split reserve is used whenever the guest HAS a camera', () => {
  // ⚠ THE SWITCH MOVED, AND THAT IS THE FIX. It used to key on `dedicated > 0`
  // because the old first leg would otherwise drop an un-bought guest onto the
  // tier's 20/day cap — a surface that has never had one. The split reserve has
  // no such fall-through: with no dedicated credits it simply spends the pot,
  // which is what that guest was doing anyway.
  //
  // So the condition is now "do they have a camera at all", and that is what
  // lets a guest who spent everything they bought CARRY ON from the host's pot
  // instead of stopping dead — the ceiling-not-floor defect (owner 2026-08-11).
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.match(
    src,
    /const \{ outcome, booked \} = ownCamera\s*\n?\s*\? await reserveGuestOwnCameraCapture\(/,
    'the split must be reached by having a camera, not by having a balance left',
  );
  assert.ok(
    !/spendOwn && ownCamera/.test(src),
    'the old balance-gated switch would re-impose the stop-at-zero it was written to avoid',
  );
});

test('a guest spending their OWN shots skips the shared-pool pre-check', () => {
  // An empty shared pool is precisely what they bought their way out of.
  // Refusing there would take their money and still not let them shoot.
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.match(src, /!spendOwn &&\s*\n?\s*\(await papicEventPoolPreCheckExhausted\(/);
});

test('the camera is resolved ONCE and reused by reserve and unwind', () => {
  // Three readers of "which ledger is in play" that each re-derive it is three
  // chances to disagree — and disagreement here means points leak.
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.equal(
    (src.match(/resolveGuestOwnCamera\(/g) ?? []).length,
    1,
    'resolve it exactly once per request',
  );
});

// ── 3 · no shot the guest paid for is ever burned ──────────────────────────

test('🚨 there is no hand-written partial unwind left to get wrong', () => {
  // ⚠ THIS ASSERTION IS INVERTED FROM WHAT IT WAS, deliberately. It used to
  // REQUIRE a hand-written "if the pool leg failed, release the seat leg"
  // block — necessary while two calls could half-succeed. The split reserve is
  // all-or-nothing inside one transaction, so that state cannot exist, and a
  // release still sitting here would now un-spend a capture that WAS paid for.
  const src = read('lib/papic-guest-own-camera.ts');
  const fn = src.slice(src.indexOf('export async function reserveGuestOwnCameraCapture'));
  assert.match(fn, /papic_reserve_capture_split/, 'one atomic call decides both halves');
  assert.ok(
    !/papic_release_camera_points/.test(fn),
    'a partial unwind here would release credits the database never left spent',
  );
  assert.ok(
    !/papic_reserve_event_points_for_seat/.test(fn),
    'the second leg is gone — it is what made the pool stand down for an empty camera',
  );
});

test('the route unwinds BOTH halves in one call, with the real figures', () => {
  // Releasing the whole cost to either side alone moves credits between the
  // guest's paid balance and the host's pot. The two figures the reserve
  // returned are the only honest thing to hand back.
  //
  // ⚠ THIS NOW FOLLOWS THE VALUE INTO THE CALLEE, and that is the point. The
  // RPC moved out of the route into the shared `releaseCaptureCredits` on
  // 2026-08-26 (the inline version discarded its own error, so a failed refund
  // was invisible). Asserting only the route would have gone green while the
  // helper did something else entirely — a function's NAME is not its
  // behaviour. Both hops are checked.
  const route = noComments(read('app/api/papic/guest-capture/route.ts'));
  const helper = noComments(read('lib/papic-release-capture.ts'));

  // Hop 1 — the route hands the shared release the two REAL figures.
  assert.match(route, /releaseCaptureCredits\(/, 'the route no longer releases through the shared helper');
  const call = /releaseCaptureCredits\([\s\S]{0,400}?\}\)/.exec(route)?.[0] ?? '';
  assert.match(call, /dedicatedSpent/, 'the dedicated figure is no longer passed back');
  assert.match(call, /poolSpent/, 'the pool figure is no longer passed back');

  // Hop 2 — the helper spends them on ONE atomic call, under the right names.
  assert.match(helper, /papic_release_capture_split/, 'the helper no longer makes the atomic release call');
  assert.match(helper, /p_dedicated_spent: dedicatedSpent/);
  assert.match(helper, /p_pool_spent: poolSpent/);

  for (const [where, src] of [['route', route], ['helper', helper]] as const) {
    assert.ok(
      !/papic_release_camera_points/.test(src),
      `the two separate releases are back in the ${where} — one call unwinds the pair it booked`,
    );
  }
});

test('🪤 what each side spent is a COUNT, never a boolean', () => {
  // A capture can be paid from both balances at once ("spend 2 and take 6"), so
  // "did the pool pay?" is not answerable yes/no. Booleans could only say
  // "release the whole cost to this side", which is exactly the leak.
  const src = read('lib/papic-guest-own-camera.ts');
  assert.match(src, /dedicatedSpent: number;/);
  assert.match(src, /poolSpent: number;/);
  assert.ok(
    !/seatBooked|poolBooked/.test(src),
    'a flag cannot express a capture that was split across two balances',
  );
});

test('the reserve fails CLOSED', () => {
  // Metering is money logic: an outage must block, never silently un-meter.
  // One leg now, so one catch — and an indeterminate row shape must block too,
  // which is the case a thrown error would not have covered.
  const src = read('lib/papic-guest-own-camera.ts');
  const fn = src.slice(src.indexOf('export async function reserveGuestOwnCameraCapture'));
  assert.match(fn, /catch \{[\s\S]*?outcome: 'blocked'/, 'a thrown RPC must block');
  assert.match(
    fn,
    /row == null \? null :/,
    'a missing or unrecognised result must be indeterminate (fail-CLOSED), not allowed',
  );
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
