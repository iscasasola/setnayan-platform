/**
 * Unit suite for the INNER / OUTER service radius.
 *
 * Owner-locked 2026-07-27 · Explore_Replan_BUILD_SPEC_2026-07-27.md §17.
 * 🔓 Since 2026-11-19 reach is NOT a plan allowance (owner, verbatim: *"ok unlock the range. not plan dependend
 * anymore."* · *"Free Unverified account will have a range of 0km."*). The ONE ceiling is verification.
 *
 * Most cases below are stated as the DEFECT they lock out. The ones that matter most:
 *
 *   1. THE PLAN DOES NOTHING. A verified Free shop saves 200 km exactly as Ultra does; no tier is even an input.
 *   2. UNVERIFIED = 0. An unverified shop cannot declare a ring, and a stale ring from when it WAS verified reads 0.
 *   3. THE BLANK. An undeclared ring must fall back, never to a penalty and never to a new claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRadiusKm,
  reachCeilingKm,
  isVerifiedForReach,
  effectiveOuterRadiusKm,
  effectiveInnerRadiusKm,
  resolveTravelFeeVerdict,
  resolveReachBadge,
  travelFeeVerdictForVendor,
  validateServiceRadiusPair,
  TRAVEL_FEE_BADGE,
  MAX_DECLARABLE_RADIUS_KM,
  REACH_NEEDS_VERIFIED,
} from './vendor-service-radius';

/* ── The one ceiling ─────────────────────────────────────────────────────── */
test('reachCeilingKm · verified = no ceiling, anything else = 0 (owner 2026-11-19)', () => {
  assert.equal(reachCeilingKm(true), Infinity);
  assert.equal(reachCeilingKm(false), 0);
  // An unread verification never grants reach.
  assert.equal(reachCeilingKm(null), 0);
  assert.equal(reachCeilingKm(undefined), 0);
});

test('isVerifiedForReach · only verification_state = verified counts', () => {
  assert.equal(isVerifiedForReach('verified'), true);
  for (const s of ['unverified', 'pending_review', 'rejected', 'demoted', '', null, undefined]) {
    assert.equal(isVerifiedForReach(s), false, String(s));
  }
});

test('validateServiceRadiusPair takes NO plan — the tier is not an input any more', () => {
  // A form that posts a tier gets nothing for it: the type has no such key, and a smuggled one changes nothing.
  const smuggled = { inner: '10', outer: '200', verified: false, tier: 'enterprise' } as unknown as Parameters<
    typeof validateServiceRadiusPair
  >[0];
  assert.equal(validateServiceRadiusPair(smuggled).ok, false);
});

/* ═══════════════════════════════════════════════════════════════════════════
   normalizeRadiusKm
   ═══════════════════════════════════════════════════════════════════════════ */

test('normalizeRadiusKm: 0 survives — it is a real declaration, not a blank', () => {
  // "We charge travel from the front door" is a stance PH suppliers actually
  // take. Folding it into null would silently erase it.
  assert.equal(normalizeRadiusKm(0), 0);
  assert.equal(normalizeRadiusKm('0'), 0);
});

test('normalizeRadiusKm: blanks, junk, negatives and fractions all read null', () => {
  assert.equal(normalizeRadiusKm(null), null);
  assert.equal(normalizeRadiusKm(undefined), null);
  assert.equal(normalizeRadiusKm(''), null);
  assert.equal(normalizeRadiusKm('   '), null);
  assert.equal(normalizeRadiusKm('twenty'), null);
  assert.equal(normalizeRadiusKm(-1), null);
  assert.equal(normalizeRadiusKm(12.5), null);
  assert.equal(normalizeRadiusKm(Number.NaN), null);
  assert.equal(normalizeRadiusKm(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizeRadiusKm({ km: 20 }), null);
});

test('normalizeRadiusKm accepts a numeric string (the form submits strings)', () => {
  assert.equal(normalizeRadiusKm('20'), 20);
  assert.equal(normalizeRadiusKm(' 35 '), 35);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE CLAMP — effectiveOuterRadiusKm
   ═══════════════════════════════════════════════════════════════════════════ */

test('clamp · a VERIFIED shop\'s declaration is honoured verbatim, at any distance', () => {
  assert.equal(effectiveOuterRadiusKm(30, true), 30);
  assert.equal(effectiveOuterRadiusKm(200, true), 200); // was capped at the plan before 2026-11-19
  assert.equal(effectiveOuterRadiusKm(900, true), 900);
  assert.equal(effectiveOuterRadiusKm(0, true), 0); // "we don't travel"
});

test('clamp · a verified BLANK reads as no limit of its own', () => {
  assert.equal(effectiveOuterRadiusKm(null, true), Infinity);
  assert.equal(effectiveOuterRadiusKm(undefined, true), Infinity);
});

test('clamp · UNVERIFIED reads 0 whatever the column holds', () => {
  assert.equal(effectiveOuterRadiusKm(null, false), 0);
  assert.equal(effectiveOuterRadiusKm(80, false), 0);
  assert.equal(effectiveOuterRadiusKm(80, null), 0);
});

test('clamp · THE UN-VERIFY: 80 km saved while verified reads 0 once the shop is not', () => {
  // The column still says 80 — nobody backfilled it — but the clamp is at READ time.
  assert.equal(effectiveOuterRadiusKm(80, true), 80);
  assert.equal(effectiveOuterRadiusKm(80, false), 0);
});

test('clamp · a garbage stored value falls back to the ceiling, not to zero', () => {
  assert.equal(effectiveOuterRadiusKm(-5 as unknown as number, true), Infinity);
  assert.equal(effectiveOuterRadiusKm(12.5 as unknown as number, true), Infinity);
});

/* ── the inner ring's own clamp ─────────────────────────────────────────── */

test('inner clamp · undeclared inner stays null (the badge needs BOTH rings)', () => {
  assert.equal(effectiveInnerRadiusKm(null, 40, true), null);
  assert.equal(effectiveInnerRadiusKm(undefined, 40, true), null);
});

test('inner clamp · a stale inner can never poke outside the effective outer', () => {
  assert.equal(effectiveInnerRadiusKm(30, 50, true), 30);
  assert.equal(effectiveInnerRadiusKm(30, 50, false), 0);
  assert.equal(effectiveInnerRadiusKm(60, 50, true), 50);
});

test('inner clamp · inner 0 survives the clamp', () => {
  assert.equal(effectiveInnerRadiusKm(0, 30, true), 0);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE THREE-STATE BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

test('badge · the three states, from one declaration', () => {
  const rings = { innerKm: 15, outerKm: 40 };
  assert.equal(resolveTravelFeeVerdict({ ...rings, distanceKm: 3 }), 'free_travel');
  assert.equal(resolveTravelFeeVerdict({ ...rings, distanceKm: 25 }), 'travel_fee');
  assert.equal(resolveTravelFeeVerdict({ ...rings, distanceKm: 60 }), 'outside_range');
});

test('badge · both ring boundaries are INCLUSIVE', () => {
  // "Free within 15 km" means 15 km is free. "We travel up to 40 km" means 40
  // km is still in range.
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: 40, distanceKm: 15 }), 'free_travel');
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: 40, distanceKm: 40 }), 'travel_fee');
  // One metre past the outer ring flips it.
  assert.equal(
    resolveTravelFeeVerdict({ innerKm: 15, outerKm: 40, distanceKm: 40.001 }),
    'outside_range',
  );
});

test('badge · EDGE: inner === outer collapses the middle band, never a travel_fee', () => {
  // "Free where we go, and we go nowhere else" — a coherent declaration.
  const rings = { innerKm: 20, outerKm: 20 };
  assert.equal(resolveTravelFeeVerdict({ ...rings, distanceKm: 5 }), 'free_travel');
  assert.equal(resolveTravelFeeVerdict({ ...rings, distanceKm: 20 }), 'free_travel');
  assert.equal(resolveTravelFeeVerdict({ ...rings, distanceKm: 20.5 }), 'outside_range');
  // There is no distance at all that yields travel_fee under inner === outer.
  for (const d of [0, 1, 10, 19.9, 20, 21, 100]) {
    assert.notEqual(resolveTravelFeeVerdict({ ...rings, distanceKm: d }), 'travel_fee');
  }
});

test('badge · distance 0 (vendor AT the venue) is free travel', () => {
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 30, distanceKm: 0 }), 'free_travel');
});

test('badge · inner 0 means every trip costs — no free band, but still in range', () => {
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 30, distanceKm: 1 }), 'travel_fee');
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 30, distanceKm: 31 }), 'outside_range');
});

/* ── THE FALLBACK. Both undeclared paths, independently. ────────────────── */

test('badge · FALLBACK path 1 — INNER undeclared → null (tier-derived read stands)', () => {
  assert.equal(resolveTravelFeeVerdict({ innerKm: null, outerKm: 40, distanceKm: 5 }), null);
  assert.equal(resolveTravelFeeVerdict({ innerKm: undefined, outerKm: 40, distanceKm: 5 }), null);
});

test('badge · FALLBACK path 2 — OUTER undeclared → null (tier-derived read stands)', () => {
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: null, distanceKm: 5 }), null);
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: undefined, distanceKm: 5 }), null);
});

test('badge · FALLBACK path 3 — unknown DISTANCE → null, never a false "outside"', () => {
  // Manual vendor, no HQ pin, or no venue anchor. Same fail-open rule the
  // existing reach badge already honours: unknown never reads as out of range.
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: 40, distanceKm: null }), null);
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: 40, distanceKm: undefined }), null);
  assert.equal(resolveTravelFeeVerdict({ innerKm: 15, outerKm: 40, distanceKm: Number.NaN }), null);
});

test('badge · a zero-width outer ring says NOTHING rather than something wrong', () => {
  // An unverified shop's outer clamps to 0. A zero ring can't tell "free" from
  // "outside", so the badge hides and the fallback read stands.
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 0, distanceKm: 0 }), null);
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 0, distanceKm: 5 }), null);
});

test('badge · a raw inner > outer is resolved by believing the OUTER', () => {
  // Should be impossible (DB CHECK + the clamp), but if an unclamped pair is
  // handed in, never promise free travel beyond where we said we'd go.
  assert.equal(resolveTravelFeeVerdict({ innerKm: 90, outerKm: 20, distanceKm: 50 }), 'outside_range');
  assert.equal(resolveTravelFeeVerdict({ innerKm: 90, outerKm: 20, distanceKm: 10 }), 'free_travel');
});

/* ── the composed read path, verification included ──────────────────────── */

test('composed · un-verifying CHANGES the badge a couple sees', () => {
  const decl = { declaredInnerKm: 15, declaredOuterKm: 50, distanceKm: 35 };
  assert.equal(travelFeeVerdictForVendor({ ...decl, verified: true }), 'travel_fee');
  // Outer reads 0 → a zero ring says nothing, never a false promise.
  assert.equal(travelFeeVerdictForVendor({ ...decl, verified: false }), null);
});

test('composed · an undeclared vendor gets null, verified or not', () => {
  for (const verified of [true, false, null]) {
    assert.equal(
      travelFeeVerdictForVendor({ distanceKm: 12, declaredInnerKm: null, declaredOuterKm: null, verified }),
      null,
      `verified ${String(verified)} must fall back, not claim`,
    );
  }
});

test('composed · a verified shop\'s own 200 km ring is believed whole', () => {
  const v = (distanceKm: number) =>
    travelFeeVerdictForVendor({ distanceKm, declaredInnerKm: 20, declaredOuterKm: 200, verified: true });
  assert.equal(v(10), 'free_travel');
  assert.equal(v(150), 'travel_fee');
  assert.equal(v(201), 'outside_range');
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE RENDERED BADGE — precedence between a declaration and today's tier read.
   Lives in the lib (not in a component) so the bench card and the quickview
   inspector are provably the same decision.
   ═══════════════════════════════════════════════════════════════════════════ */

test('rendered badge · a DECLARATION beats the tier inference, all three states', () => {
  // The tier read below says "Reaches you" for all three. The vendor's own word
  // must win, including when it CONTRADICTS the tier read (the last case: the
  // tier thinks they reach, they themselves say they don't).
  const tierSaysReaches = { reachesVenue: true, serviceRadiusKm: 50 };
  assert.deepEqual(
    resolveReachBadge({ ...tierSaysReaches, innerKm: 15, outerKm: 40, distanceKm: 5 }),
    { source: 'declared', verdict: 'free_travel', text: 'No travel fee', tone: 'ok', inRange: true },
  );
  assert.deepEqual(
    resolveReachBadge({ ...tierSaysReaches, innerKm: 15, outerKm: 40, distanceKm: 25 }),
    {
      source: 'declared',
      verdict: 'travel_fee',
      text: 'Travel fee applies',
      tone: 'warn',
      inRange: true,
    },
  );
  assert.deepEqual(
    resolveReachBadge({ ...tierSaysReaches, innerKm: 15, outerKm: 40, distanceKm: 45 }),
    {
      source: 'declared',
      verdict: 'outside_range',
      // 🧭 owner 2026-11-17 (drawing v15): past their reach reads "Beyond reach", with the distance read.
      text: 'Beyond reach · 45 km away',
      tone: 'warn',
      inRange: false,
    },
  );
});

test('rendered badge · FALLBACK path 1 — inner undeclared reproduces today’s badge EXACTLY', () => {
  assert.deepEqual(
    resolveReachBadge({
      innerKm: null,
      outerKm: 40,
      distanceKm: 5,
      reachesVenue: true,
      serviceRadiusKm: 50,
    }),
    { source: 'tier', text: 'Reaches you', tone: 'ok', inRange: true },
  );
  assert.deepEqual(
    resolveReachBadge({
      innerKm: null,
      outerKm: 40,
      distanceKm: 90,
      reachesVenue: false,
      serviceRadiusKm: 50,
    }),
    { source: 'tier', text: 'Beyond reach · 90 km away', tone: 'warn', inRange: false },
  );
});

test('rendered badge · FALLBACK path 2 — outer undeclared reproduces today’s badge EXACTLY', () => {
  assert.deepEqual(
    resolveReachBadge({
      innerKm: 15,
      outerKm: null,
      distanceKm: 5,
      reachesVenue: true,
      serviceRadiusKm: 20,
    }),
    { source: 'tier', text: 'Reaches you', tone: 'ok', inRange: true },
  );
  // …including the "no finite radius" wording of the out-of-range case.
  assert.deepEqual(
    resolveReachBadge({
      innerKm: 15,
      outerKm: null,
      distanceKm: 90,
      reachesVenue: false,
      serviceRadiusKm: null,
    }),
    { source: 'tier', text: 'Beyond reach · 90 km away', tone: 'warn', inRange: false },
  );
});

test('rendered badge · a BLANK declaration is never a penalty', () => {
  // Undeclared + tier says in-range → still the positive badge. Nobody is worse
  // off for not having filled the fields in.
  const r = resolveReachBadge({
    innerKm: null,
    outerKm: null,
    distanceKm: 12,
    reachesVenue: true,
    serviceRadiusKm: 20,
  });
  assert.equal(r?.source, 'tier');
  assert.equal(r?.tone, 'ok');
});

test('rendered badge · nothing declared AND nothing inferable → no badge at all', () => {
  assert.equal(
    resolveReachBadge({
      innerKm: null,
      outerKm: null,
      distanceKm: null,
      reachesVenue: null,
      serviceRadiusKm: null,
    }),
    null,
  );
});

test('rendered badge · declared rings but UNKNOWN distance falls back, never claims', () => {
  // A manual vendor / no HQ pin. The declaration is real but unmeasurable here.
  assert.deepEqual(
    resolveReachBadge({
      innerKm: 15,
      outerKm: 40,
      distanceKm: null,
      reachesVenue: null,
      serviceRadiusKm: 50,
    }),
    null,
  );
});

test('rendered badge · EDGE inner === outer renders free/outside and never a fee', () => {
  const rings = { innerKm: 20, outerKm: 20, reachesVenue: true, serviceRadiusKm: 20 };
  assert.equal(resolveReachBadge({ ...rings, distanceKm: 20 })?.text, 'No travel fee');
  assert.equal(resolveReachBadge({ ...rings, distanceKm: 21 })?.text, 'Beyond reach · 21 km away');
  for (const d of [0, 5, 19, 20, 25, 80]) {
    assert.notEqual(
      resolveReachBadge({ ...rings, distanceKm: d })?.text,
      'Travel fee applies',
      `inner === outer must never produce a fee band (d=${d})`,
    );
  }
});

test('rendered badge · icon side (inRange) tracks range, not cost', () => {
  const rings = { innerKm: 10, outerKm: 40, reachesVenue: null, serviceRadiusKm: null };
  // A travel FEE is still in range — the struck-through pin is reserved for
  // genuinely out-of-range.
  assert.equal(resolveReachBadge({ ...rings, distanceKm: 5 })?.inRange, true);
  assert.equal(resolveReachBadge({ ...rings, distanceKm: 30 })?.inRange, true);
  assert.equal(resolveReachBadge({ ...rings, distanceKm: 41 })?.inRange, false);
});

test('badge copy is one definition, in plain words', () => {
  assert.equal(TRAVEL_FEE_BADGE.free_travel.text, 'No travel fee');
  assert.equal(TRAVEL_FEE_BADGE.travel_fee.text, 'Travel fee applies');
  assert.equal(TRAVEL_FEE_BADGE.outside_range.text, 'Outside their range');
  assert.equal(TRAVEL_FEE_BADGE.free_travel.tone, 'ok');
  assert.equal(TRAVEL_FEE_BADGE.travel_fee.tone, 'warn');
  assert.equal(TRAVEL_FEE_BADGE.outside_range.tone, 'warn');
});

/* ═══════════════════════════════════════════════════════════════════════════
   WRITE-TIME VALIDATION
   ═══════════════════════════════════════════════════════════════════════════ */

function err(v: ReturnType<typeof validateServiceRadiusPair>): string {
  assert.equal(v.ok, false, 'expected a rejection');
  return v.ok ? '' : v.error;
}

test('validate · THE RULING: a verified shop (any plan) can save 200 km; an unverified one cannot', () => {
  // Owner 2026-11-19. No plan is an input — "Free" here is simply a verified shop that pays nothing.
  assert.deepEqual(validateServiceRadiusPair({ inner: '20', outer: '200', verified: true }), {
    ok: true,
    innerRadiusKm: 20,
    outerRadiusKm: 200,
  });
  assert.equal(err(validateServiceRadiusPair({ inner: '20', outer: '200', verified: false })), REACH_NEEDS_VERIFIED);
  // …and an unread verification is unverified, never generous.
  assert.equal(err(validateServiceRadiusPair({ inner: '', outer: '200', verified: null })), REACH_NEEDS_VERIFIED);
});

test('validate · an unverified shop may still CLEAR its rings', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: '', outer: '', verified: false }), {
    ok: true,
    innerRadiusKm: null,
    outerRadiusKm: null,
  });
});

test('validate · the refusal for an unverified shop names the one step, not a plan', () => {
  assert.match(REACH_NEEDS_VERIFIED, /verified/i);
  assert.doesNotMatch(REACH_NEEDS_VERIFIED, /plan|upgrade/i);
});

test('validate · a sane pair is accepted', () => {
  const v = validateServiceRadiusPair({ inner: '15', outer: '40', verified: true });
  assert.deepEqual(v, { ok: true, innerRadiusKm: 15, outerRadiusKm: 40 });
});

test('validate · clearing BOTH fields is a legitimate save (back to undeclared)', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: null, outer: undefined, verified: true }), {
    ok: true,
    innerRadiusKm: null,
    outerRadiusKm: null,
  });
});

test('validate · one ring alone is allowed (the DB CHECK is NULL-tolerant too)', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: '', outer: '30', verified: true }), {
    ok: true,
    innerRadiusKm: null,
    outerRadiusKm: 30,
  });
  assert.deepEqual(validateServiceRadiusPair({ inner: '10', outer: '', verified: true }), {
    ok: true,
    innerRadiusKm: 10,
    outerRadiusKm: null,
  });
});

test('validate · INNER ≤ OUTER is enforced', () => {
  const v = validateServiceRadiusPair({ inner: '40', outer: '15', verified: true });
  assert.match(err(v), /free-travel distance can’t be further/i);
  assert.equal(validateServiceRadiusPair({ inner: '20', outer: '20', verified: true }).ok, true);
});

test('validate · the typo guard is the only distance limit, the same for every shop', () => {
  assert.equal(validateServiceRadiusPair({ inner: '0', outer: String(MAX_DECLARABLE_RADIUS_KM), verified: true }).ok, true);
  assert.match(
    err(validateServiceRadiusPair({ inner: '1', outer: String(MAX_DECLARABLE_RADIUS_KM + 1), verified: true })),
    new RegExp(`more than ${MAX_DECLARABLE_RADIUS_KM} km`),
  );
  assert.match(
    err(validateServiceRadiusPair({ inner: String(MAX_DECLARABLE_RADIUS_KM + 1), outer: '', verified: true })),
    new RegExp(`more than ${MAX_DECLARABLE_RADIUS_KM} km`),
  );
});

test('validate · non-numeric, fractional and negative input is refused, not coerced', () => {
  assert.match(err(validateServiceRadiusPair({ inner: 'ten', outer: '40', verified: true })), /whole number/i);
  assert.match(err(validateServiceRadiusPair({ inner: '10', outer: '4.5', verified: true })), /whole number/i);
  assert.match(err(validateServiceRadiusPair({ inner: '-3', outer: '40', verified: true })), /whole number/i);
});

test('validate · 0 / 0 is accepted — "we don’t travel" is a declaration', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: '0', outer: '0', verified: true }), {
    ok: true,
    innerRadiusKm: 0,
    outerRadiusKm: 0,
  });
});

test('validate → clamp → badge round-trips a real declaration', () => {
  const v = validateServiceRadiusPair({ inner: '15', outer: '45', verified: true });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  const read = (distanceKm: number, verified: boolean) =>
    travelFeeVerdictForVendor({ distanceKm, declaredInnerKm: v.innerRadiusKm, declaredOuterKm: v.outerRadiusKm, verified });
  assert.equal(read(10, true), 'free_travel');
  assert.equal(read(30, true), 'travel_fee');
  assert.equal(read(60, true), 'outside_range');
  // Same stored row once the shop is no longer verified: nothing is claimed.
  assert.equal(read(10, false), null);
});
