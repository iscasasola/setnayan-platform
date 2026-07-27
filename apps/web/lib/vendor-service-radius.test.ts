/**
 * Unit suite for the INNER / OUTER service radius.
 *
 * Owner-locked 2026-07-27 · Explore_Replan_BUILD_SPEC_2026-07-27.md §17.
 *
 * Most cases below are stated as the DEFECT they lock out. The two that matter
 * most, and the reason this file is longer than the module it tests:
 *
 *   1. THE DOWNGRADE. A vendor who declared 50 km on Pro and drops to Verified
 *      must not keep 50. The clamp is at READ time, so a stale column is never
 *      believed — a lapsed subscription can't go on buying reach.
 *   2. THE BLANK. An undeclared ring must fall back to today's tier-derived
 *      behaviour EXACTLY, never to a penalty and never to a new claim. There are
 *      two independent blank paths (inner blank, outer blank) and both are here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRadiusKm,
  tierOuterRadiusCapKm,
  effectiveOuterRadiusKm,
  effectiveInnerRadiusKm,
  resolveTravelFeeVerdict,
  resolveReachBadge,
  travelFeeVerdictForVendor,
  validateServiceRadiusPair,
  TRAVEL_FEE_BADGE,
  MAX_DECLARABLE_RADIUS_KM,
} from './vendor-service-radius';
import { tierCaps } from './vendor-tier-caps';

/* ── The tier ladder this whole feature is capped by ────────────────────────
 * free 0 · verified 20 · solo 20 · pro 50 · enterprise 100 · custom 100.
 * Asserted against the real cap table so a tier reprice can't silently rot the
 * expectations below. */
test('tierOuterRadiusCapKm mirrors the published Service reach ladder', () => {
  assert.equal(tierOuterRadiusCapKm('free'), 0);
  assert.equal(tierOuterRadiusCapKm('verified'), 20);
  assert.equal(tierOuterRadiusCapKm('solo'), 20);
  assert.equal(tierOuterRadiusCapKm('pro'), 50);
  assert.equal(tierOuterRadiusCapKm('enterprise'), 100);
  assert.equal(tierOuterRadiusCapKm('custom'), 100);
  // Unknown / null tier degrades to `free` via asVendorTier — never to a
  // generous default. A garbage tier_state must not hand out 100 km.
  assert.equal(tierOuterRadiusCapKm(null), tierCaps('free').serviceRadiusKm);
  assert.equal(tierOuterRadiusCapKm('platinum-deluxe'), 0);
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

test('clamp · declared ABOVE the cap reads as the cap', () => {
  assert.equal(effectiveOuterRadiusKm(80, 'pro'), 50);
  assert.equal(effectiveOuterRadiusKm(500, 'verified'), 20);
});

test('clamp · declared AT OR BELOW the cap is honoured verbatim', () => {
  assert.equal(effectiveOuterRadiusKm(30, 'pro'), 30);
  assert.equal(effectiveOuterRadiusKm(50, 'pro'), 50); // exactly the cap
  assert.equal(effectiveOuterRadiusKm(5, 'verified'), 5);
  assert.equal(effectiveOuterRadiusKm(0, 'pro'), 0); // "we don't travel"
});

test('clamp · a BLANK declaration reads as the tier cap (today’s behaviour)', () => {
  assert.equal(effectiveOuterRadiusKm(null, 'pro'), 50);
  assert.equal(effectiveOuterRadiusKm(undefined, 'enterprise'), 100);
  assert.equal(effectiveOuterRadiusKm(null, 'verified'), 20);
  // …and a blank on FREE stays 0, exactly as the tier-derived read does today.
  assert.equal(effectiveOuterRadiusKm(null, 'free'), 0);
});

test('clamp · THE DOWNGRADE: 50 km declared on Pro reads 20 km on Verified', () => {
  // The whole point of clamping at READ time. The column still says 50 — nobody
  // backfilled it, no downgrade hook ran — but a lapsed subscription must stop
  // buying reach the moment the tier changes.
  const declaredOnPro = 50;
  assert.equal(effectiveOuterRadiusKm(declaredOnPro, 'pro'), 50);
  assert.equal(effectiveOuterRadiusKm(declaredOnPro, 'verified'), 20);
  assert.equal(effectiveOuterRadiusKm(declaredOnPro, 'solo'), 20);
  // …all the way down to Free, where the ring collapses to nothing.
  assert.equal(effectiveOuterRadiusKm(declaredOnPro, 'free'), 0);
  // …and an UNKNOWN tier_state degrades to free, not to the declared value.
  assert.equal(effectiveOuterRadiusKm(declaredOnPro, null), 0);
});

test('clamp · an UPGRADE does not inflate a narrower declaration', () => {
  // Verified vendor said 8 km, then buys Pro. Their own word still stands —
  // the cap rose, the declaration didn't.
  assert.equal(effectiveOuterRadiusKm(8, 'pro'), 8);
});

test('clamp · a garbage stored value falls back to the cap, not to zero', () => {
  // A fractional/negative value can only arrive from outside the DB CHECK (a
  // hand-edited row, a bad import). It must read as "undeclared", which is the
  // tier cap — never as 0, which would read as "we don't travel".
  assert.equal(effectiveOuterRadiusKm(-5 as unknown as number, 'pro'), 50);
  assert.equal(effectiveOuterRadiusKm(12.5 as unknown as number, 'pro'), 50);
});

/* ── the inner ring's own clamp ─────────────────────────────────────────── */

test('inner clamp · undeclared inner stays null (the badge needs BOTH rings)', () => {
  assert.equal(effectiveInnerRadiusKm(null, 40, 'pro'), null);
  assert.equal(effectiveInnerRadiusKm(undefined, 40, 'pro'), null);
});

test('inner clamp · a stale inner can never poke outside the effective outer', () => {
  // Declared 30 free / 50 furthest on Pro, then lapsed to Verified (cap 20).
  // Without this clamp every venue 20–30 km out would read "free travel" while
  // simultaneously being out of range.
  assert.equal(effectiveInnerRadiusKm(30, 50, 'pro'), 30);
  assert.equal(effectiveInnerRadiusKm(30, 50, 'verified'), 20);
  // A coherent pair is untouched by the same downgrade.
  assert.equal(effectiveInnerRadiusKm(15, 50, 'verified'), 15);
});

test('inner clamp · inner 0 survives the clamp', () => {
  assert.equal(effectiveInnerRadiusKm(0, 30, 'pro'), 0);
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
  // Free tier clamps outer to 0. A zero ring can't tell "free" from "outside",
  // so the badge hides and the tier-derived read stands.
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 0, distanceKm: 0 }), null);
  assert.equal(resolveTravelFeeVerdict({ innerKm: 0, outerKm: 0, distanceKm: 5 }), null);
});

test('badge · a raw inner > outer is resolved by believing the OUTER', () => {
  // Should be impossible (DB CHECK + the clamp), but if an unclamped pair is
  // handed in, never promise free travel beyond where we said we'd go.
  assert.equal(resolveTravelFeeVerdict({ innerKm: 90, outerKm: 20, distanceKm: 50 }), 'outside_range');
  assert.equal(resolveTravelFeeVerdict({ innerKm: 90, outerKm: 20, distanceKm: 10 }), 'free_travel');
});

/* ── the composed read path, tier included ──────────────────────────────── */

test('composed · the downgrade CHANGES the badge a couple sees', () => {
  // Venue 35 km out. On Pro (declared 15/50) it's a travel fee. The same vendor,
  // same declaration, after lapsing to Verified is OUT OF RANGE — which is the
  // honest answer, because Verified only buys 20 km of reach.
  const decl = { declaredInnerKm: 15, declaredOuterKm: 50, distanceKm: 35 };
  assert.equal(travelFeeVerdictForVendor({ ...decl, tier: 'pro' }), 'travel_fee');
  assert.equal(travelFeeVerdictForVendor({ ...decl, tier: 'verified' }), 'outside_range');
});

test('composed · an undeclared vendor gets null on EVERY tier', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom', null]) {
    assert.equal(
      travelFeeVerdictForVendor({
        distanceKm: 12,
        declaredInnerKm: null,
        declaredOuterKm: null,
        tier,
      }),
      null,
      `tier ${String(tier)} must fall back, not claim`,
    );
  }
});

test('composed · a FREE-tier vendor’s declaration is inert (cap 0)', () => {
  assert.equal(
    travelFeeVerdictForVendor({
      distanceKm: 2,
      declaredInnerKm: 5,
      declaredOuterKm: 20,
      tier: 'free',
    }),
    null,
  );
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
      text: 'Outside their range',
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
    { source: 'tier', text: 'Beyond 50km', tone: 'warn', inRange: false },
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
    { source: 'tier', text: 'Travel fee likely', tone: 'warn', inRange: false },
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
  assert.equal(resolveReachBadge({ ...rings, distanceKm: 21 })?.text, 'Outside their range');
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

test('validate · a sane pair inside the cap is accepted', () => {
  const v = validateServiceRadiusPair({ inner: '15', outer: '40', tier: 'pro' });
  assert.deepEqual(v, { ok: true, innerRadiusKm: 15, outerRadiusKm: 40 });
});

test('validate · clearing BOTH fields is a legitimate save (back to undeclared)', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: '', outer: '', tier: 'pro' }), {
    ok: true,
    innerRadiusKm: null,
    outerRadiusKm: null,
  });
  assert.deepEqual(validateServiceRadiusPair({ inner: null, outer: undefined, tier: 'pro' }), {
    ok: true,
    innerRadiusKm: null,
    outerRadiusKm: null,
  });
});

test('validate · one ring alone is allowed (the DB CHECK is NULL-tolerant too)', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: '', outer: '30', tier: 'pro' }), {
    ok: true,
    innerRadiusKm: null,
    outerRadiusKm: 30,
  });
  assert.deepEqual(validateServiceRadiusPair({ inner: '10', outer: '', tier: 'pro' }), {
    ok: true,
    innerRadiusKm: 10,
    outerRadiusKm: null,
  });
});

test('validate · INNER ≤ OUTER is enforced', () => {
  const v = validateServiceRadiusPair({ inner: '40', outer: '15', tier: 'pro' });
  assert.match(err(v), /free-travel distance can’t be further/i);
  // Equal is fine — the collapsed-band declaration.
  assert.equal(validateServiceRadiusPair({ inner: '20', outer: '20', tier: 'pro' }).ok, true);
});

test('validate · the TIER CAP is enforced at write time, per tier', () => {
  assert.match(
    err(validateServiceRadiusPair({ inner: '10', outer: '80', tier: 'pro' })),
    /up to 50 km/,
  );
  assert.match(
    err(validateServiceRadiusPair({ inner: '10', outer: '50', tier: 'verified' })),
    /up to 20 km/,
  );
  // Exactly the cap is allowed.
  assert.equal(validateServiceRadiusPair({ inner: '10', outer: '50', tier: 'pro' }).ok, true);
  assert.equal(validateServiceRadiusPair({ inner: '0', outer: '100', tier: 'enterprise' }).ok, true);
});

test('validate · an INNER above the cap is rejected even with a blank outer', () => {
  // inner ≤ outer ≤ cap, so an inner above the cap is impossible by
  // construction — it must not sneak through on the "outer is blank" path.
  assert.match(
    err(validateServiceRadiusPair({ inner: '90', outer: '', tier: 'pro' })),
    /up to 50 km/,
  );
});

test('validate · FREE tier has no reach to declare, and is told so in plain words', () => {
  const v = validateServiceRadiusPair({ inner: '5', outer: '10', tier: 'free' });
  assert.match(err(v), /doesn’t include a service reach/i);
  // …but a free vendor clearing the fields is still a valid save.
  assert.equal(validateServiceRadiusPair({ inner: '', outer: '', tier: 'free' }).ok, true);
});

test('validate · an unknown tier_state is treated as free, never as generous', () => {
  assert.match(
    err(validateServiceRadiusPair({ inner: '5', outer: '10', tier: 'mystery-tier' })),
    /doesn’t include a service reach/i,
  );
});

test('validate · non-numeric, fractional and negative input is refused, not coerced', () => {
  assert.match(err(validateServiceRadiusPair({ inner: 'ten', outer: '40', tier: 'pro' })), /whole number/i);
  assert.match(err(validateServiceRadiusPair({ inner: '10', outer: '4.5', tier: 'pro' })), /whole number/i);
  assert.match(err(validateServiceRadiusPair({ inner: '-3', outer: '40', tier: 'pro' })), /whole number/i);
});

test('validate · the typo guard fires before the tier-cap message', () => {
  // 99999 on Pro is a fat finger, not an upgrade prompt.
  assert.match(
    err(validateServiceRadiusPair({ inner: '1', outer: String(MAX_DECLARABLE_RADIUS_KM + 1), tier: 'pro' })),
    new RegExp(`more than ${MAX_DECLARABLE_RADIUS_KM} km`),
  );
});

test('validate · 0 / 0 is accepted — "we don’t travel" is a declaration', () => {
  assert.deepEqual(validateServiceRadiusPair({ inner: '0', outer: '0', tier: 'pro' }), {
    ok: true,
    innerRadiusKm: 0,
    outerRadiusKm: 0,
  });
});

test('validate → clamp → badge round-trips a real Pro declaration', () => {
  const v = validateServiceRadiusPair({ inner: '15', outer: '45', tier: 'pro' });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  const read = (distanceKm: number, tier: string) =>
    travelFeeVerdictForVendor({
      distanceKm,
      declaredInnerKm: v.innerRadiusKm,
      declaredOuterKm: v.outerRadiusKm,
      tier,
    });
  assert.equal(read(10, 'pro'), 'free_travel');
  assert.equal(read(30, 'pro'), 'travel_fee');
  assert.equal(read(60, 'pro'), 'outside_range');
  // Same stored row, after a lapse to Solo (cap 20).
  assert.equal(read(10, 'solo'), 'free_travel');
  assert.equal(read(18, 'solo'), 'travel_fee');
  assert.equal(read(30, 'solo'), 'outside_range');
});
