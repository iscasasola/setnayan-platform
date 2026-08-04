/**
 * Live Studio Wave 10 · guest-pick admission arithmetic (Node built-in test runner,
 * run via tsx).
 *
 * Guards the deterministic, Supabase-free half of lib/live-studio-guest-pick.ts.
 * Two properties carry the feature:
 *
 *   1. THE CAP ACTUALLY CAPS — an operator's phone can never be talked into serving
 *      more guests than its uplink can carry. Over-serving does not merely annoy
 *      guests: WebRTC congestion control would degrade EVERY sender on that phone,
 *      including the host feed that becomes the director's cut.
 *   2. A LEAKED SLOT HEALS — a guest whose phone slept or lost signal must not hold a
 *      seat forever. A permanently-shrinking cap is indistinguishable from a broken
 *      feature, and nobody would know which it was.
 *
 * Everything here is pure: no RTCPeerConnection, no Supabase, no DOM. `now` is
 * injected so staleness is tested without timers.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GUEST_PICK_MAX_BITRATE_BPS,
  GUEST_PICK_MAX_VIEWERS_PER_CAMERA,
  GUEST_PICK_PRESENCE_HEARTBEAT_MS,
  GUEST_PICK_PRESENCE_STALE_MS,
  admitViewer,
  flattenGuestPresence,
  guestPickChannelName,
  resolveSlotAdmission,
  shouldOfferGuestPick,
  viewersOnSlot,
  type GuestPickPresence,
} from './live-studio-guest-pick';

const NOW = 1_800_000_000_000;
const e = (slot: string, viewerId: string, at: number = NOW): GuestPickPresence => ({
  slot,
  viewerId,
  at,
});
const ids = (xs: GuestPickPresence[]) => xs.map((x) => x.viewerId);

// ── 1. The constants are the cost model ───────────────────────────────────

test('the cap is 3 — the documented starting point, not an accident', () => {
  assert.equal(GUEST_PICK_MAX_VIEWERS_PER_CAMERA, 3);
});

test('the per-guest bitrate stays well under the host encode', () => {
  // The whole cost argument is that a guest copy is a PEEK VIEW. If this ever
  // approached the ~1.5 Mbps host encode, three guests would triple the phone's
  // uplink and the director's cut is what would suffer.
  assert.equal(GUEST_PICK_MAX_BITRATE_BPS, 600_000);
  assert.ok(GUEST_PICK_MAX_BITRATE_BPS < 1_000_000);
});

test('presence is re-beaten faster than it expires, with room for a missed beat', () => {
  // If the heartbeat were slower than the staleness window, every live viewer would
  // flicker out of the count and the cap would leak upward.
  assert.ok(GUEST_PICK_PRESENCE_HEARTBEAT_MS * 2 < GUEST_PICK_PRESENCE_STALE_MS);
});

// ── 1b. shouldOfferGuestPick — the paywall + flag + host-switch gate ──────

test('an UN-ENTITLED event gets no guest-visible side cameras', () => {
  // THE PAYWALL ASSERTION. Guest-pick is a paid capability (§ 4d). If this ever
  // returned true without `multiCamOwned`, it would be the one paid Live Studio
  // capability obtainable for free.
  assert.equal(
    shouldOfferGuestPick({ flagEnabled: true, guestPickEnabled: true, multiCamOwned: false }),
    false,
  );
});

test('the flag alone withholds side cameras — flag off is a no-op', () => {
  assert.equal(
    shouldOfferGuestPick({ flagEnabled: false, guestPickEnabled: true, multiCamOwned: true }),
    false,
  );
});

test("the host's own guest-pick switch withholds side cameras", () => {
  assert.equal(
    shouldOfferGuestPick({ flagEnabled: true, guestPickEnabled: false, multiCamOwned: true }),
    false,
  );
});

test('all three together are what open the door', () => {
  assert.equal(
    shouldOfferGuestPick({ flagEnabled: true, guestPickEnabled: true, multiCamOwned: true }),
    true,
  );
});

test('shouldOfferGuestPick fails closed for every partial combination', () => {
  for (const flagEnabled of [true, false]) {
    for (const guestPickEnabled of [true, false]) {
      for (const multiCamOwned of [true, false]) {
        const expected = flagEnabled && guestPickEnabled && multiCamOwned;
        assert.equal(
          shouldOfferGuestPick({ flagEnabled, guestPickEnabled, multiCamOwned }),
          expected,
          `flag=${flagEnabled} pick=${guestPickEnabled} owned=${multiCamOwned}`,
        );
      }
    }
  }
});

// ── 2. admitViewer — the phone-side authoritative gate ────────────────────

test('admitViewer admits up to the cap and refuses past it', () => {
  assert.equal(admitViewer([], 'a'), true);
  assert.equal(admitViewer(['a'], 'b'), true);
  assert.equal(admitViewer(['a', 'b'], 'c'), true);
  assert.equal(admitViewer(['a', 'b', 'c'], 'd'), false);
});

test('admitViewer is idempotent — a retried hello does not take a second slot', () => {
  // The guest hellos every 2s until connected; if each retry consumed a slot, a
  // single guest would fill the camera by itself in six seconds.
  assert.equal(admitViewer(['a', 'b', 'c'], 'b'), true);
});

test('admitViewer honours a tuned cap', () => {
  assert.equal(admitViewer(['a'], 'b', 1), false);
  assert.equal(admitViewer(['a', 'b', 'c', 'd'], 'e', 5), true);
});

// ── 3. viewersOnSlot — occupancy, and how a leaked slot heals ─────────────

test('viewersOnSlot counts only the requested slot', () => {
  const entries = [e('cam1', 'a'), e('cam2', 'b'), e('cam1', 'c')];
  assert.deepEqual(ids(viewersOnSlot(entries, 'cam1', NOW)), ['a', 'c']);
});

test('viewersOnSlot drops stale entries — a dead phone stops holding a seat', () => {
  const entries = [
    e('cam1', 'ghost', NOW - GUEST_PICK_PRESENCE_STALE_MS - 1),
    e('cam1', 'alive', NOW - 1_000),
  ];
  assert.deepEqual(ids(viewersOnSlot(entries, 'cam1', NOW)), ['alive']);
});

test('viewersOnSlot keeps an entry that is stale-but-not-expired', () => {
  const entries = [e('cam1', 'slow', NOW - GUEST_PICK_PRESENCE_STALE_MS + 1_000)];
  assert.equal(viewersOnSlot(entries, 'cam1', NOW).length, 1);
});

test('viewersOnSlot de-duplicates a viewer seen twice mid-retrack', () => {
  const entries = [e('cam1', 'a', NOW - 500), e('cam1', 'a', NOW)];
  assert.equal(viewersOnSlot(entries, 'cam1', NOW).length, 1);
});

test('viewersOnSlot orders oldest-first so every browser agrees who is in', () => {
  const entries = [e('cam1', 'c', NOW - 10), e('cam1', 'a', NOW - 30), e('cam1', 'b', NOW - 20)];
  assert.deepEqual(ids(viewersOnSlot(entries, 'cam1', NOW)), ['a', 'b', 'c']);
});

test('viewersOnSlot breaks exact ties deterministically', () => {
  const entries = [e('cam1', 'z', NOW), e('cam1', 'a', NOW)];
  assert.deepEqual(ids(viewersOnSlot(entries, 'cam1', NOW)), ['a', 'z']);
});

// ── 4. resolveSlotAdmission — the guest-side advisory check ───────────────

test('resolveSlotAdmission admits into an empty camera', () => {
  assert.equal(resolveSlotAdmission([], 'cam1', 'me', NOW), 'admitted');
});

test('resolveSlotAdmission admits a viewer already inside the cap', () => {
  const entries = [e('cam1', 'a', NOW - 30), e('cam1', 'me', NOW - 20)];
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'me', NOW), 'admitted');
});

test('resolveSlotAdmission refuses the newest arrival once full, keeping the incumbents', () => {
  const entries = [
    e('cam1', 'a', NOW - 40),
    e('cam1', 'b', NOW - 30),
    e('cam1', 'c', NOW - 20),
    e('cam1', 'me', NOW - 10),
  ];
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'me', NOW), 'full');
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'a', NOW), 'admitted');
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'c', NOW), 'admitted');
});

test('resolveSlotAdmission refuses an untracked viewer looking at a full camera', () => {
  const entries = [e('cam1', 'a'), e('cam1', 'b'), e('cam1', 'c')];
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'newcomer', NOW), 'full');
});

test('resolveSlotAdmission lets a newcomer in once a stale holder times out', () => {
  // THE HEALING PROPERTY. Three seats look taken, but one holder died — the camera
  // must open back up rather than stay full for the rest of the wedding.
  const entries = [
    e('cam1', 'a', NOW - 1_000),
    e('cam1', 'b', NOW - 1_000),
    e('cam1', 'ghost', NOW - GUEST_PICK_PRESENCE_STALE_MS - 1),
  ];
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'newcomer', NOW), 'admitted');
});

test('resolveSlotAdmission does not let another camera crowd this one out', () => {
  const entries = [e('cam2', 'a'), e('cam2', 'b'), e('cam2', 'c'), e('cam2', 'd')];
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'me', NOW), 'admitted');
});

test('two guests racing for one free seat resolve identically on both screens', () => {
  const race = [
    e('cam1', 'a', NOW - 40),
    e('cam1', 'b', NOW - 30),
    e('cam1', 'early', NOW - 10),
    e('cam1', 'late', NOW - 5),
  ];
  assert.equal(resolveSlotAdmission(race, 'cam1', 'early', NOW), 'admitted');
  assert.equal(resolveSlotAdmission(race, 'cam1', 'late', NOW), 'full');
});

test('resolveSlotAdmission honours a tuned cap', () => {
  const entries = [e('cam1', 'a', NOW - 20), e('cam1', 'me', NOW - 10)];
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'me', NOW, 1), 'full');
  assert.equal(resolveSlotAdmission(entries, 'cam1', 'me', NOW, 2), 'admitted');
});

// ── 5. flattenGuestPresence — payloads arrive from other browsers ─────────

test('flattenGuestPresence flattens a well-formed presence map', () => {
  const state = {
    k1: [{ slot: 'cam1', viewerId: 'a', at: NOW }],
    k2: [{ slot: 'cam2', viewerId: 'b', at: NOW }],
  };
  assert.equal(flattenGuestPresence(state).length, 2);
});

test('flattenGuestPresence drops malformed entries instead of trusting them', () => {
  const state = {
    k1: [{ slot: 'cam1', viewerId: 'ok', at: NOW }],
    k2: [{ slot: '', viewerId: 'x', at: NOW }],
    k3: [{ slot: 'cam1', at: NOW }],
    k4: [{ slot: 'cam1', viewerId: '', at: NOW }],
    k5: [null],
    k6: ['nope'],
  } as unknown as Record<string, unknown[]>;
  assert.deepEqual(ids(flattenGuestPresence(state)), ['ok']);
});

test('flattenGuestPresence treats a missing timestamp as ancient, not fresh', () => {
  // Fail-safe direction: an entry claiming no time must not be able to hold a seat.
  const state = { k: [{ slot: 'cam1', viewerId: 'a' }] } as unknown as Record<string, unknown[]>;
  const entry = flattenGuestPresence(state)[0]!;
  assert.equal(entry.at, 0);
  assert.equal(viewersOnSlot([entry], 'cam1', NOW).length, 0);
});

test('flattenGuestPresence survives an empty or absent state', () => {
  assert.deepEqual(flattenGuestPresence({}), []);
  assert.deepEqual(
    flattenGuestPresence(undefined as unknown as Record<string, unknown[]>),
    [],
  );
});

// ── 6. The guest topic is NOT the host topic ──────────────────────────────

test('guestPickChannelName namespaces guests onto panood-guest:', () => {
  assert.equal(guestPickChannelName('abc-123'), 'panood-guest:abc-123');
});

test('the guest topic never collides with panood-rtc:', () => {
  // If these ever converged, a guest answering an offer would TAKE the camera from
  // the couple's control room — the exact hole migration 20270829134804 closed, and
  // a black tile mid-ceremony on a day that cannot be re-run.
  const topic = guestPickChannelName('abc-123');
  assert.equal(topic.startsWith('panood-rtc:'), false);
  assert.equal(topic.includes('panood-rtc'), false);
});

test('the guest topic prefix is the length the SQL predicate substrings on', () => {
  // The migration does `substring(p_topic FROM 14)::uuid`. If the prefix ever changed
  // without that number, every guest join would silently fail authorization and the
  // feature would look "flaky" rather than misconfigured.
  assert.equal('panood-guest:'.length, 13);
  const id = '11111111-2222-3333-4444-555555555555';
  assert.equal(guestPickChannelName(id).substring(13), id);
});
