import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_TRANSPORT_DETAIL,
  RING1_DEFAULT_KM,
  RING2_CAP_KM,
  enforceFreeTransport,
  parseRingSettings,
  resolveReachRing,
  resolveRingRadii,
  ring2CapKm,
  type ReachRingInput,
} from './vendor-reach-rings';
import { VENDOR_TIERS, type VendorTier } from './vendor-tier-caps';
import { isVendorReachRingsEnabled } from './vendor-reach-rings-flag';

/**
 * Two-ring reach — the money boundary. Ring 1 FORCES a vendor's transportation
 * line to ₱0, so these tests pin (a) the tier cap ladder, (b) the clamping
 * order, (c) the ring boundaries, and (d) every fail-open path, for EVERY tier.
 *
 * Owner-locked model `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6.
 */

/** Quezon City-ish HQ used as the vendor pin throughout. */
const HQ = { lat: 14.676, lng: 121.0437 };

/** A venue pin ~`km` due EAST of HQ (longitude-only offset, so the maths is exact-ish). */
function venueKmEast(km: number): { lat: number; lng: number } {
  const kmPerDegLng = 111.32 * Math.cos((HQ.lat * Math.PI) / 180);
  return { lat: HQ.lat, lng: HQ.lng + km / kmPerDegLng };
}

function input(over: Partial<ReachRingInput> = {}): ReachRingInput {
  return {
    tier: 'pro',
    ring1Km: 10,
    ring2Km: 50,
    vendorLat: HQ.lat,
    vendorLng: HQ.lng,
    venueLat: venueKmEast(5).lat,
    venueLng: venueKmEast(5).lng,
    ...over,
  };
}

/* ── FLAG-OFF BYTE-IDENTITY ──────────────────────────────────────────────── */

test('flag defaults OFF — nothing in this track is armed until the owner flips it', () => {
  delete process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1;
  assert.equal(isVendorReachRingsEnabled(), false);
  process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 = '';
  assert.equal(isVendorReachRingsEnabled(), false);
  process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 = '0';
  assert.equal(isVendorReachRingsEnabled(), false);
  process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 = 'false';
  assert.equal(isVendorReachRingsEnabled(), false);
  process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 = 'yes'; // only 1/true arm it
  assert.equal(isVendorReachRingsEnabled(), false);
  process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 = '1';
  assert.equal(isVendorReachRingsEnabled(), true);
  process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 = 'true';
  assert.equal(isVendorReachRingsEnabled(), true);
  delete process.env.NEXT_PUBLIC_VENDOR_REACH_RINGS_V1;
});

/* ── TIER CAP LADDER ─────────────────────────────────────────────────────── */

test('Ring-2 cap ladder matches the owner-locked matrix for EVERY tier', () => {
  const expected: Record<VendorTier, number> = {
    free: 30,
    verified: 30,
    solo: 30,
    pro: 60,
    enterprise: 100,
    custom: 100,
  };
  for (const tier of VENDOR_TIERS) {
    assert.equal(ring2CapKm(tier), expected[tier], `${tier} cap`);
    assert.equal(RING2_CAP_KM[tier], expected[tier], `${tier} table`);
  }
});

test('unknown / null / garbage tier falls back to the FREE cap (never a bigger one)', () => {
  assert.equal(ring2CapKm(null), 30);
  assert.equal(ring2CapKm(undefined), 30);
  assert.equal(ring2CapKm('platinum'), 30);
  assert.equal(ring2CapKm(''), 30);
});

test('the ladder is monotonic — a higher tier never reaches LESS far', () => {
  const ladder: VendorTier[] = ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'];
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(
      RING2_CAP_KM[ladder[i]!] >= RING2_CAP_KM[ladder[i - 1]!],
      `${ladder[i]} >= ${ladder[i - 1]}`,
    );
  }
});

/* ── CLAMPING ────────────────────────────────────────────────────────────── */

test('every tier: an over-set Ring 2 is CUT to the tier cap (self-PATCH is inert)', () => {
  for (const tier of VENDOR_TIERS) {
    const r = resolveRingRadii(tier, 0, 999);
    assert.equal(r.ring2Km, RING2_CAP_KM[tier], `${tier} clamped`);
    assert.equal(r.capKm, RING2_CAP_KM[tier]);
    assert.equal(r.ring2CappedByTier, true, `${tier} flags the cap`);
  }
});

test('every tier: unset Ring 2 defaults to the tier cap (discovery never narrows)', () => {
  for (const tier of VENDOR_TIERS) {
    const r = resolveRingRadii(tier, null, null);
    assert.equal(r.ring2Km, RING2_CAP_KM[tier], `${tier} default`);
    assert.equal(r.ring2CappedByTier, false, 'a default is not a cap event');
  }
});

test('every tier: unset Ring 1 defaults to ZERO — no free-travel ring by default', () => {
  assert.equal(RING1_DEFAULT_KM, 0);
  for (const tier of VENDOR_TIERS) {
    assert.equal(resolveRingRadii(tier, null, null).ring1Km, 0, `${tier}`);
    assert.equal(resolveRingRadii(tier, undefined, 25).ring1Km, 0, `${tier}`);
  }
});

test('Ring 1 can never poke outside Ring 2', () => {
  const r = resolveRingRadii('pro', 80, 40);
  assert.equal(r.ring2Km, 40);
  assert.equal(r.ring1Km, 40);
  assert.equal(r.ring1CappedByRing2, true);
});

test('a Pro vendor downgraded to Solo keeps their stored 60 but resolves to 30', () => {
  const stored = { ring1: 15, ring2: 60 };
  const asPro = resolveRingRadii('pro', stored.ring1, stored.ring2);
  assert.deepEqual([asPro.ring1Km, asPro.ring2Km], [15, 60]);
  const asSolo = resolveRingRadii('solo', stored.ring1, stored.ring2);
  assert.deepEqual([asSolo.ring1Km, asSolo.ring2Km], [15, 30]);
});

test('negative / NaN / Infinity stored values degrade instead of exploding', () => {
  assert.equal(resolveRingRadii('pro', -5, -5).ring1Km, 0);
  assert.equal(resolveRingRadii('pro', -5, -5).ring2Km, 0);
  // Non-finite is treated as "never set", NOT as "infinite reach": Ring 2 falls
  // back to the tier cap and Ring 1 to 0 (no free-travel ring).
  assert.equal(resolveRingRadii('pro', Number.NaN, Number.NaN).ring2Km, 60);
  assert.equal(resolveRingRadii('pro', Number.NaN, Number.NaN).ring1Km, 0);
  assert.equal(resolveRingRadii('pro', Infinity, Infinity).ring2Km, 60);
  assert.equal(resolveRingRadii('pro', Infinity, Infinity).ring1Km, 0);
});

/* ── RING VERDICT ────────────────────────────────────────────────────────── */

test('inside Ring 1 → free travel, transport LOCKED, discoverable', () => {
  const v = resolveReachRing(input({ ring1Km: 10, ring2Km: 50 }));
  assert.equal(v.ring, 'ring_1');
  assert.equal(v.transportLocked, true);
  assert.equal(v.discoverable, true);
  assert.equal(v.coupleLabel, 'Free Transportation');
  assert.ok(v.distanceKm !== null && v.distanceKm > 4.5 && v.distanceKm < 5.5);
});

test('between the rings → travel fee may apply, transport EDITABLE, discoverable', () => {
  const far = venueKmEast(25);
  const v = resolveReachRing(input({ venueLat: far.lat, venueLng: far.lng }));
  assert.equal(v.ring, 'ring_2');
  assert.equal(v.transportLocked, false);
  assert.equal(v.discoverable, true);
  assert.equal(v.coupleLabel, 'Travel fee may apply');
});

test('beyond Ring 2 → NOT discoverable, no label, transport not locked', () => {
  const far = venueKmEast(90);
  const v = resolveReachRing(input({ venueLat: far.lat, venueLng: far.lng }));
  assert.equal(v.ring, 'out_of_range');
  assert.equal(v.discoverable, false);
  assert.equal(v.transportLocked, false);
  assert.equal(v.coupleLabel, null);
});

test('the TIER CAP — not the stored value — decides out-of-range', () => {
  const far = venueKmEast(45); // inside a stored 60, outside Solo's 30 cap
  const asPro = resolveReachRing(input({ tier: 'pro', ring2Km: 60, venueLat: far.lat, venueLng: far.lng }));
  assert.equal(asPro.ring, 'ring_2');
  const asSolo = resolveReachRing(input({ tier: 'solo', ring2Km: 60, venueLat: far.lat, venueLng: far.lng }));
  assert.equal(asSolo.ring, 'out_of_range');
  assert.equal(asSolo.discoverable, false);
});

test('boundaries are INCLUSIVE of the inner ring (ties favour the couple)', () => {
  // A venue exactly at the HQ pin is 0 km → inside any Ring 1, incl. a 0 km one.
  const atPin = resolveReachRing(
    input({ ring1Km: 0, venueLat: HQ.lat, venueLng: HQ.lng }),
  );
  assert.equal(atPin.ring, 'ring_1');
  assert.equal(atPin.transportLocked, true);
});

test('default settings (both rings unset) never lock transport — only widen reach', () => {
  for (const tier of VENDOR_TIERS) {
    const near = venueKmEast(1);
    const v = resolveReachRing(
      input({ tier, ring1Km: null, ring2Km: null, venueLat: near.lat, venueLng: near.lng }),
    );
    assert.equal(v.transportLocked, false, `${tier} must not auto-lock transport`);
    assert.equal(v.ring, 'ring_2', `${tier} still discoverable + editable`);
  }
});

/* ── FAIL-OPEN PATHS ─────────────────────────────────────────────────────── */

const MISSING: Array<[string, Partial<ReachRingInput>]> = [
  ['no vendor pin', { vendorLat: null, vendorLng: null }],
  ['no vendor latitude', { vendorLat: null }],
  ['no venue pin', { venueLat: null, venueLng: null }],
  ['no venue longitude', { venueLng: undefined }],
  ['NaN venue latitude', { venueLat: Number.NaN }],
  ['out-of-domain latitude', { venueLat: 200 }],
  ['out-of-domain longitude', { vendorLng: -999 }],
];

for (const [name, over] of MISSING) {
  test(`${name} → 'unknown': stays discoverable, transport stays editable`, () => {
    const v = resolveReachRing(input(over));
    assert.equal(v.ring, 'unknown');
    assert.equal(v.distanceKm, null);
    assert.equal(v.transportLocked, false, 'never confiscate a fee on a guess');
    assert.equal(v.discoverable, true, 'a missing pin must not hide a vendor');
    assert.equal(v.coupleLabel, null);
  });
}

test("'unknown' still reports the vendor's effective radii (the settings card needs them)", () => {
  const v = resolveReachRing(input({ tier: 'enterprise', ring1Km: 12, ring2Km: 500, venueLat: null }));
  assert.equal(v.ring1Km, 12);
  assert.equal(v.ring2Km, 100);
  assert.equal(v.capKm, 100);
});

/* ── SERVER RE-ASSERTION (the client composes line items — never trust them) ─ */

const QUOTE = [
  { label: 'Full-day coverage', detail: null, amount_centavos: 45_000_00 },
  { label: 'Transportation', detail: 'Flat fee', amount_centavos: 15_000_00 },
  { label: 'Discount', detail: null, amount_centavos: -2_000_00 },
];

test('locked ring: a crafted paid transport line is REWRITTEN to ₱0 free travel', () => {
  const out = enforceFreeTransport(QUOTE, { transportLocked: true });
  const transport = out.filter((l) => l.label === 'Transportation');
  assert.equal(transport.length, 1, 'exactly one transportation line survives');
  assert.equal(transport[0]!.amount_centavos, 0);
  assert.equal(transport[0]!.detail, FREE_TRANSPORT_DETAIL);
  // Nothing else is touched, and order is preserved.
  assert.deepEqual(
    out.map((l) => l.label),
    ['Full-day coverage', 'Transportation', 'Discount'],
  );
  assert.equal(out[0]!.amount_centavos, 45_000_00);
  assert.equal(out[2]!.amount_centavos, -2_000_00);
});

test('locked ring: duplicate transport lines are collapsed to the single free one', () => {
  const out = enforceFreeTransport(
    [
      { label: 'Transportation', detail: 'Flat fee', amount_centavos: 9_000_00 },
      { label: ' TRANSPORTATION ', detail: 'Second helping', amount_centavos: 9_000_00 },
    ],
    { transportLocked: true },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.amount_centavos, 0);
});

test('locked ring: the free line is ADDED when the client omitted transport entirely', () => {
  const out = enforceFreeTransport(
    [{ label: 'Full-day coverage', detail: null, amount_centavos: 45_000_00 }],
    { transportLocked: true },
  );
  assert.equal(out.length, 2);
  assert.equal(out[1]!.label, 'Transportation');
  assert.equal(out[1]!.amount_centavos, 0);
});

test('unlocked / unknown / absent ring: the itemization passes through UNCHANGED', () => {
  for (const ring of [
    null,
    undefined,
    { transportLocked: false },
  ] as const) {
    const out = enforceFreeTransport(QUOTE, ring);
    assert.deepEqual(out, QUOTE, `ring=${JSON.stringify(ring)}`);
  }
});

test('a real out-of-ring verdict never triggers the rewrite', () => {
  const far = venueKmEast(25);
  const verdict = resolveReachRing(input({ venueLat: far.lat, venueLng: far.lng }));
  assert.deepEqual(enforceFreeTransport(QUOTE, verdict), QUOTE);
});

/* ── SETTINGS PARSE (server-authoritative) ───────────────────────────────── */

test('parseRingSettings clamps rather than rejects an over-tier submission', () => {
  const r = parseRingSettings('solo', '10', '90');
  // Clamped to the Solo cap — and stored as NULL, because "the cap" must stay a
  // RELATIVE choice that follows a later upgrade (see the ring2Store block).
  assert.deepEqual(r, { ok: true, ring1Km: 10, ring2Km: 30, ring2Store: null });
});

test('parseRingSettings pulls Ring 1 in when it exceeds Ring 2', () => {
  assert.deepEqual(parseRingSettings('pro', '55', '20'), {
    ok: true,
    ring1Km: 20,
    ring2Km: 20,
    ring2Store: 20,
  });
});

test('parseRingSettings rounds and accepts numeric strings from the form', () => {
  assert.deepEqual(parseRingSettings('pro', '9.6', '40.2'), {
    ok: true,
    ring1Km: 10,
    ring2Km: 40,
    ring2Store: 40,
  });
});

test('parseRingSettings rejects junk and negatives', () => {
  assert.equal(parseRingSettings('pro', 'abc', '10').ok, false);
  assert.equal(parseRingSettings('pro', '', '').ok, false);
  assert.equal(parseRingSettings('pro', null, undefined).ok, false);
  assert.equal(parseRingSettings('pro', '-1', '10').ok, false);
});

test('parseRingSettings on an unknown tier uses the FREE cap (no privilege by typo)', () => {
  assert.deepEqual(parseRingSettings('platinum', '5', '100'), {
    ok: true,
    ring1Km: 5,
    ring2Km: 30,
    ring2Store: null,
  });
});
