/**
 * Unit suite for the vendor specialization entitlement gate.
 *
 * The invariants under test are the owner's 2026-07-26 lock, stated as
 * assertions: the generic kit is unconditional; specializations require a
 * subscription at or above the floor; the floor is ONE constant that genuinely
 * drives the outcome; and no input — null subscription, lapsed subscription,
 * unknown category, garbage — can produce an empty, denied, or thrown result.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SPECIALIZATION_MIN_TIER,
  VENDOR_SPECIALIZATIONS,
  resolveVendorSpecializationAccess,
  specializationSetForServices,
  subscriptionClearsSpecializationFloor,
  specializationDef,
  holdsSpecialization,
  type VendorSpecializationSet,
  type VendorSubscriptionState,
} from './vendor-specialization-gate';
import { VENDOR_TIERS, type VendorTier } from './vendor-tier-caps';
import { MUSIC_CANONICALS } from './songs';

const NOW = Date.UTC(2026, 6, 26, 12, 0, 0); // 2026-07-26T12:00:00Z
const FUTURE = new Date(NOW + 30 * 864e5).toISOString();
const PAST = new Date(NOW - 30 * 864e5).toISOString();

/** A subscription row at `tier`, not expired. */
function sub(tier: string | null, expires: string | null = FUTURE): VendorSubscriptionState {
  return { tier_state: tier, tier_expires_at: expires };
}

/** The three categories the owner named, by canonical taxonomy tile. */
const BAND = ['live_band'];
const HOST = ['host_mc'];
const COORDINATOR = ['coordinator'];

// ─── The floor constant ─────────────────────────────────────────────────────

test('the floor is a single constant, currently defaulted to Solo-and-up', () => {
  assert.equal(SPECIALIZATION_MIN_TIER, 'solo');
});

test('THE FLOOR CONSTANT DRIVES THE OUTCOME — moving it flips a Solo vendor', () => {
  // At the shipped floor ('solo'), a Solo vendor is unlocked...
  const atSolo = resolveVendorSpecializationAccess({
    subscription: sub('solo'),
    services: BAND,
    now: NOW,
  });
  assert.equal(atSolo.unlockedSet, 'song_desk');
  assert.equal(atSolo.reason, 'unlocked');

  // ...and moving the floor to 'pro' — the other candidate the owner is still
  // deciding between — locks that same vendor, with the generic kit intact.
  const atPro = resolveVendorSpecializationAccess({
    subscription: sub('solo'),
    services: BAND,
    now: NOW,
    minTier: 'pro',
  });
  assert.equal(atPro.unlockedSet, null);
  assert.equal(atPro.reason, 'below_tier_floor');
  assert.equal(atPro.genericKit, true);
  assert.equal(atPro.eligibleSet, 'song_desk'); // still upsellable

  // The same flip at the predicate level.
  assert.equal(subscriptionClearsSpecializationFloor(sub('solo'), NOW), true);
  assert.equal(subscriptionClearsSpecializationFloor(sub('solo'), NOW, 'pro'), false);
});

test('moving the floor to pro keeps Pro and above unlocked', () => {
  for (const tier of ['pro', 'enterprise', 'custom'] as const) {
    assert.equal(
      subscriptionClearsSpecializationFloor(sub(tier), NOW, 'pro'),
      true,
      `${tier} should clear a 'pro' floor`,
    );
  }
});

// ─── No subscription → generic only ─────────────────────────────────────────

test('NO SUBSCRIPTION → generic kit only, for every named category', () => {
  for (const services of [BAND, HOST, COORDINATOR]) {
    const access = resolveVendorSpecializationAccess({
      subscription: null,
      services,
      now: NOW,
    });
    assert.equal(access.genericKit, true);
    assert.equal(access.unlockedSet, null);
    assert.equal(access.reason, 'below_tier_floor');
    assert.notEqual(access.eligibleSet, null); // knows what to sell them
  }
});

test('undefined / empty subscription row → generic kit only, no throw', () => {
  for (const subscription of [
    undefined,
    { tier_state: null, tier_expires_at: null },
    { tier_state: '', tier_expires_at: '' },
  ]) {
    const access = resolveVendorSpecializationAccess({
      subscription: subscription as VendorSubscriptionState | undefined,
      services: BAND,
      now: NOW,
    });
    assert.equal(access.genericKit, true);
    assert.equal(access.unlockedSet, null);
  }
});

// ─── Tiers at / below the floor ─────────────────────────────────────────────

test('EVERY PAID TIER AT OR ABOVE THE FLOOR unlocks the category set', () => {
  const paid: VendorTier[] = ['solo', 'pro', 'enterprise', 'custom'];
  const expected: Array<[string[], VendorSpecializationSet]> = [
    [BAND, 'song_desk'],
    [HOST, 'stage_script'],
    [COORDINATOR, 'floor_command'],
  ];
  for (const tier of paid) {
    for (const [services, set] of expected) {
      const access = resolveVendorSpecializationAccess({
        subscription: sub(tier),
        services,
        now: NOW,
      });
      assert.equal(access.unlockedSet, set, `${tier} + ${services[0]}`);
      assert.equal(access.reason, 'unlocked');
      assert.equal(access.genericKit, true);
      assert.equal(holdsSpecialization(access, set), true);
    }
  }
});

test('TIERS BELOW THE FLOOR (free, verified) → generic kit only', () => {
  for (const tier of ['free', 'verified'] as const) {
    const access = resolveVendorSpecializationAccess({
      subscription: sub(tier),
      services: COORDINATOR,
      now: NOW,
    });
    assert.equal(access.genericKit, true);
    assert.equal(access.unlockedSet, null);
    assert.equal(access.reason, 'below_tier_floor');
    assert.equal(access.eligibleSet, 'floor_command');
  }
});

test('every tier in VENDOR_TIERS resolves without throwing, generic kit always granted', () => {
  for (const tier of VENDOR_TIERS) {
    const access = resolveVendorSpecializationAccess({
      subscription: sub(tier),
      services: BAND,
      now: NOW,
    });
    assert.equal(access.genericKit, true);
  }
});

test('an unrecognised tier string is treated as free → generic only', () => {
  const access = resolveVendorSpecializationAccess({
    subscription: sub('platinum_deluxe'),
    services: BAND,
    now: NOW,
  });
  assert.equal(access.unlockedSet, null);
  assert.equal(access.reason, 'below_tier_floor');
  assert.equal(access.genericKit, true);
});

// ─── Lapse: the mid-event requirement ───────────────────────────────────────

test('LAPSED SUBSCRIPTION MID-EVENT → generic kit, never blank or error', () => {
  const access = resolveVendorSpecializationAccess({
    subscription: sub('pro', PAST),
    services: COORDINATOR,
    now: NOW,
  });
  assert.equal(access.genericKit, true); // the whole point
  assert.equal(access.unlockedSet, null);
  assert.equal(access.reason, 'subscription_lapsed'); // "renew", not "subscribe"
  assert.equal(access.eligibleSet, 'floor_command');
});

test('a null expiry never expires (admin grant / comp tier / free window)', () => {
  const access = resolveVendorSpecializationAccess({
    subscription: sub('solo', null),
    services: HOST,
    now: NOW,
  });
  assert.equal(access.unlockedSet, 'stage_script');
});

test('expiry exactly at now counts as lapsed', () => {
  const atNow = new Date(NOW).toISOString();
  assert.equal(subscriptionClearsSpecializationFloor(sub('pro', atNow), NOW), false);
  assert.equal(
    subscriptionClearsSpecializationFloor(sub('pro', new Date(NOW + 1).toISOString()), NOW),
    true,
  );
});

test('a malformed expiry reads as no-expiry, not as lapsed (data bug ≠ non-payment)', () => {
  const access = resolveVendorSpecializationAccess({
    subscription: sub('pro', 'not-a-date'),
    services: BAND,
    now: NOW,
  });
  assert.equal(access.unlockedSet, 'song_desk');
});

test('a free-tier row with a stale future expiry still gets nothing', () => {
  // Expiry alone never grants — the tier floor is the gate.
  assert.equal(subscriptionClearsSpecializationFloor(sub('free', FUTURE), NOW), false);
});

// ─── Unknown / unmapped categories ──────────────────────────────────────────

test('UNKNOWN OR UNMAPPED CATEGORY → generic only, never a crash', () => {
  const cases: Array<readonly string[] | null | undefined> = [
    null,
    undefined,
    [],
    ['florist'], // real tile, no specialization set
    ['photo_video'], // real tile, no specialization set
    ['choreographer'], // program folder, but not a song act or host
    ['date_specialist'], // planning folder, but not the coordinator
    ['not_a_real_tile'], // misspelled / retired
    ['', '   '], // junk
  ];
  for (const services of cases) {
    const access = resolveVendorSpecializationAccess({
      subscription: sub('enterprise'), // even the top tier gets nothing extra
      services,
      now: NOW,
    });
    assert.equal(access.genericKit, true, `services=${JSON.stringify(services)}`);
    assert.equal(access.unlockedSet, null);
    assert.equal(access.eligibleSet, null); // nothing to upsell either
    assert.equal(access.reason, 'no_specialization_for_category');
  }
});

test('non-string junk inside services[] is skipped rather than thrown on', () => {
  const services = [null, 42, {}, 'live_band'] as unknown as string[];
  const access = resolveVendorSpecializationAccess({
    subscription: sub('solo'),
    services,
    now: NOW,
  });
  assert.equal(access.unlockedSet, 'song_desk');
});

test('an unsubscribed vendor in an unmapped category is still just a generic vendor', () => {
  const access = resolveVendorSpecializationAccess({
    subscription: null,
    services: ['florist'],
    now: NOW,
  });
  assert.equal(access.genericKit, true);
  assert.equal(access.unlockedSet, null);
});

// ─── Category mapping ───────────────────────────────────────────────────────

test('every music tile maps to the song desk (reused from MUSIC_CANONICALS)', () => {
  for (const tile of MUSIC_CANONICALS) {
    assert.equal(specializationSetForServices([tile]), 'song_desk', tile);
  }
  // The owner's three named acts are all in there.
  for (const tile of ['live_band', 'wedding_singer', 'orchestra']) {
    assert.equal(specializationSetForServices([tile]), 'song_desk', tile);
  }
});

test('multi-set vendors resolve deterministically: floor command wins', () => {
  // Registry order is the documented priority — a coordinator who also plays
  // gets the superset floor view, mirroring resolveDayOfFamily.
  assert.equal(specializationSetForServices(['live_band', 'coordinator']), 'floor_command');
  assert.equal(specializationSetForServices(['coordinator', 'live_band']), 'floor_command');
  assert.equal(specializationSetForServices(['host_mc', 'live_band']), 'song_desk');
});

test('eventTiles narrows a multi-category vendor to the booked role', () => {
  const services = ['live_band', 'coordinator'];
  // Booked only as the band on this event → the song desk, not floor command.
  assert.equal(specializationSetForServices(services, ['live_band']), 'song_desk');
  // Booked only as coordinator → floor command.
  assert.equal(specializationSetForServices(services, ['coordinator']), 'floor_command');
  // Booked for something else entirely → no set.
  assert.equal(specializationSetForServices(services, ['florist']), null);
});

test('eventTiles narrowing flows through the full gate', () => {
  const access = resolveVendorSpecializationAccess({
    subscription: sub('pro'),
    services: ['live_band', 'coordinator'],
    eventTiles: ['live_band'],
    now: NOW,
  });
  assert.equal(access.unlockedSet, 'song_desk');
});

// ─── Registry integrity ─────────────────────────────────────────────────────

test('the registry is exhaustive over the union and has unique ids', () => {
  const ids = VENDOR_SPECIALIZATIONS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate specialization id');
  const expected: VendorSpecializationSet[] = ['floor_command', 'song_desk', 'stage_script'];
  assert.deepEqual([...ids].sort(), expected.sort());
  for (const id of expected) {
    const def = specializationDef(id);
    assert.ok(def && def.label.length > 0 && def.blurb.length > 0, `${id} needs copy`);
    assert.ok(def.tiles.size > 0, `${id} needs at least one tile`);
  }
});

test('no tile belongs to two specialization sets', () => {
  const seen = new Map<string, VendorSpecializationSet>();
  for (const def of VENDOR_SPECIALIZATIONS) {
    for (const tile of def.tiles) {
      assert.equal(seen.has(tile), false, `${tile} is in both ${seen.get(tile)} and ${def.id}`);
      seen.set(tile, def.id);
    }
  }
});

test('holdsSpecialization reads the entitlement, never the upsell field', () => {
  const locked = resolveVendorSpecializationAccess({
    subscription: sub('free'),
    services: BAND,
    now: NOW,
  });
  assert.equal(locked.eligibleSet, 'song_desk'); // eligible…
  assert.equal(holdsSpecialization(locked, 'song_desk'), false); // …but not held
});
