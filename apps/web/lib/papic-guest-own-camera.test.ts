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

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments — a note explaining a rule must not satisfy its own test. */
const noComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

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

test('🪤 the seat reserve is used ONLY when the guest holds bought points', () => {
  // This is the regression guard. Routing an un-bought guest through
  // papic_reserve_camera_points would newly impose the tier's 20/day cap on a
  // surface that has never had one — a silent downgrade for people who paid
  // nothing and asked for nothing.
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.match(
    src,
    /const spendOwn = \(ownCamera\?\.dedicated \?\? 0\) > 0;/,
    'the switch must key on a dedicated balance being present',
  );
  assert.match(
    src,
    /spendOwn && ownCamera\s*\n?\s*\? await reserveGuestOwnCameraCapture\(/,
    'and the seat reserve must sit behind that switch',
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

test('🚨 a booked seat ledger is released when the pool leg then fails', () => {
  // The leak: the seat books, the pool leg errors ('blocked') or refuses, the
  // route returns 503/409 and never reaches its unwind — so a PAID shot is
  // spent on a photo that was refused. The helper owns both bookings, so it
  // owns the partial unwind: both ledgers or neither.
  const src = read('lib/papic-guest-own-camera.ts');
  const fn = src.slice(src.indexOf('export async function reserveGuestOwnCameraCapture'));
  assert.match(fn, /if \(poolOutcome !== 'allow' && seatBooked\)/);
  assert.match(fn, /papic_release_camera_points/);
  assert.match(
    fn,
    /return \{ outcome: poolOutcome, seatBooked: false, poolBooked: false \};/,
    'and it must report nothing booked, or the caller double-releases',
  );
});

test('the route unwinds the guest’s own balance too, not just the pool', () => {
  const src = noComments(read('app/api/papic/guest-capture/route.ts'));
  assert.match(src, /if \(seatBooked && ownCamera\)/);
  assert.match(src, /papic_release_camera_points/);
});

test('🪤 the tri-state pool result is not collapsed into a boolean', () => {
  // 1 = booked · 0 = refused · -1 = dedicated, nothing booked. Treating -1 as
  // "booked" refunds the HOST's pool on every aborted upload from a camera that
  // never charged it.
  const src = read('lib/papic-guest-own-camera.ts');
  const fn = src.slice(src.indexOf('export async function reserveGuestOwnCameraCapture'));
  assert.match(fn, /n === 1 \|\| n === -1 \? true : n === 0 \? false : null/);
  assert.match(fn, /poolBooked = n === 1;/, 'only a 1 actually booked pool points');
});

test('both reserve legs fail CLOSED', () => {
  // Metering is money logic: an outage must block, never silently un-meter.
  const src = read('lib/papic-guest-own-camera.ts');
  const fn = src.slice(src.indexOf('export async function reserveGuestOwnCameraCapture'));
  assert.equal(
    (fn.match(/catch \{\s*\n\s*\w+Outcome = 'blocked';/g) ?? []).length,
    2,
    'a thrown RPC on either leg must block',
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
