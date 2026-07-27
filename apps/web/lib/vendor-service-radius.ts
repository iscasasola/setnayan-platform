/**
 * vendor-service-radius.ts — the INNER / OUTER service radius, end to end.
 *
 * Owner-locked 2026-07-27: *"they have inner radius. this radius must comply to
 * give free transportation fee if within this radius. outer radius is the
 * overall range."* · *"Per vendor. Vendor has their HQ and x km from their HQ
 * means free transportation fee."*
 *
 * Spec: Explore_Replan_BUILD_SPEC_2026-07-27.md §17 · DECISION_LOG 2026-07-27.
 *
 * ── THE MODEL ───────────────────────────────────────────────────────────────
 *   inside inner ............ transport is FREE
 *   inner → outer ........... they travel, a TRAVEL FEE applies
 *   beyond outer ............ OUT OF RANGE
 *
 * Both rings are the vendor's own declaration, measured straight-line from
 * their HQ pin. The distance itself is NOT computed here — the couple's bench
 * already haversines `hq_latitude/hq_longitude` against the event's venue per
 * candidate. Inner/outer are two thresholds on a number that already exists.
 *
 * ── WHAT THIS FILE IS NOT ───────────────────────────────────────────────────
 * Zero I/O, zero React, zero Supabase. Everything here is a pure function of
 * its arguments so it can be unit-tested hard and reused identically by the
 * write path (the vendor's server action) and the read path (the couple's
 * bench). The ranking scorer is deliberately NOT wired in this pass — see
 * `lib/compat-score.ts` / `lib/bench-sort.ts`, untouched.
 *
 * ── THE TWO ENFORCEMENT POINTS, AND WHY THERE ARE TWO ───────────────────────
 * 1. WRITE TIME — `validateServiceRadiusPair` refuses an outer radius above the
 *    vendor's tier cap, with a sentence a human can act on.
 * 2. READ TIME — `effectiveOuterRadiusKm` re-clamps to the CURRENT tier cap on
 *    every read. This is the half that matters. A vendor who declared 50 km on
 *    Pro and then lapses to Verified keeps a stale 50 in the column; without
 *    the read-time clamp a cancelled subscription would go on buying reach
 *    forever. With it, the stale value is simply never believed above the cap —
 *    no backfill job, no cron, no downgrade hook to forget to call.
 */

import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';

/**
 * The couple-facing verdict for one vendor at one venue.
 *
 *   'free_travel'   — inside the inner ring. No transportation fee.
 *   'travel_fee'    — between inner and outer. They come; a fee applies.
 *   'outside_range' — beyond the outer ring.
 *   null            — NOT DECLARED / NOT MEASURABLE. The caller must fall back
 *                     to today's tier-derived reach read. Never a penalty.
 */
export type TravelFeeVerdict = 'free_travel' | 'travel_fee' | 'outside_range' | null;

/** Hard ceiling on a declared ring — the widest tier cap, so a typo'd 99999
 *  is rejected at the form rather than clamped silently into something odd. */
export const MAX_DECLARABLE_RADIUS_KM = 1000;

/**
 * Coerce a stored / submitted radius to a usable whole-km number.
 *
 * Returns null for anything that isn't a finite, non-negative, integral number
 * — which folds "not declared" (NULL), "empty string", and "garbage" into the
 * SAME answer on purpose: all three mean "we have no declaration here", and the
 * fallback path is identical for all three.
 *
 * ⚠ 0 survives. `inner = 0` is a real declaration ("we charge travel from the
 * front door") and is deliberately distinct from null ("haven't said").
 */
export function normalizeRadiusKm(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return normalizeRadiusKm(parsed);
  }
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0) return null;
  return value;
}

/**
 * The tier's ceiling on the outer radius, in km.
 *
 * `tierCaps().serviceRadiusKm` is the SAME number the public plans page
 * advertises as "Service reach" (`vendor-tier-matrix.tsx`): free 0 · verified
 * 20 · solo 20 · pro 50 · enterprise 100 · custom 100. Under the inner/outer
 * model that number stops being a CLAIM about the vendor and becomes the CAP on
 * what the vendor may claim — which is what makes the published feature honest
 * (spec §17.2.1).
 */
export function tierOuterRadiusCapKm(tier: string | null | undefined): number {
  return tierCaps(asVendorTier(tier)).serviceRadiusKm;
}

/**
 * THE DOWNGRADE CLAMP. `min(declared ?? cap, cap)`.
 *
 *   declared > cap  → cap       (a lapsed subscription stops buying reach)
 *   declared ≤ cap  → declared  (the vendor's own, narrower word wins)
 *   declared null   → cap       (undeclared keeps today's tier-derived reach)
 *
 * Called on EVERY read, so the stored column may be stale forever without ever
 * being believed. Free tier's cap is 0, so a free vendor's declaration collapses
 * to 0 — which every caller reads as "no usable ring", matching today's
 * behaviour exactly (free already renders as "No" service reach on the public
 * matrix and already hides the bench's reach badge).
 *
 * `Infinity` is passed through untouched for any future unlimited tier —
 * `Math.min(n, Infinity) === n`, so a declaration is honoured verbatim.
 */
export function effectiveOuterRadiusKm(
  declaredKm: number | null | undefined,
  tier: string | null | undefined,
): number {
  const cap = tierOuterRadiusCapKm(tier);
  const declared = normalizeRadiusKm(declaredKm);
  if (declared === null) return cap;
  return Math.min(declared, cap);
}

/**
 * The inner ring, clamped the same way — a stale inner can never poke outside
 * the effective outer.
 *
 * Concretely: a Pro vendor declares 15 free / 50 furthest, then lapses to
 * Verified (cap 20). The outer clamps 50 → 20, and 15 still fits, so nothing
 * moves. But a vendor who declared 30 free / 50 furthest on Pro would, after the
 * same lapse, have an inner ring WIDER than their own effective outer — an
 * incoherent state that would make every venue between 20 and 30 km read
 * "free travel" while simultaneously being out of range. Clamping inner to the
 * effective outer collapses that to a coherent "free everywhere we go".
 *
 * Returns null when the inner ring is undeclared — the badge needs BOTH rings.
 */
export function effectiveInnerRadiusKm(
  declaredInnerKm: number | null | undefined,
  declaredOuterKm: number | null | undefined,
  tier: string | null | undefined,
): number | null {
  const inner = normalizeRadiusKm(declaredInnerKm);
  if (inner === null) return null;
  return Math.min(inner, effectiveOuterRadiusKm(declaredOuterKm, tier));
}

/**
 * THE THREE-STATE BADGE. Returns null whenever the honest answer is "we don't
 * know" — the caller then renders today's tier-derived reach badge, unchanged.
 *
 * A null is returned when ANY of these is true:
 *   • the distance is unknown (manual vendor / no HQ pin / no venue anchor),
 *   • the inner ring is undeclared,
 *   • the outer ring is undeclared,
 *   • the effective outer ring is 0 or non-finite (free tier / unscoped) — a
 *     zero-width ring can't distinguish "free" from "outside", so it says
 *     nothing rather than something wrong.
 *
 * Boundaries are INCLUSIVE at both rings: standing exactly on the inner ring is
 * free travel, standing exactly on the outer ring is still in range. A vendor
 * who writes "free within 15 km" means 15 km is free.
 *
 * Edge worth naming: inner === outer collapses the middle band to nothing —
 * "free where we go, and we go nowhere else". That is a coherent declaration
 * (many PH suppliers price exactly this way) and resolves to free_travel /
 * outside_range with no travel_fee state ever reachable. Not a bug.
 */
export function resolveTravelFeeVerdict(input: {
  distanceKm: number | null | undefined;
  /** ALREADY tier-clamped — pass `effectiveInnerRadiusKm(...)`. */
  innerKm: number | null | undefined;
  /** ALREADY tier-clamped — pass `effectiveOuterRadiusKm(...)`. */
  outerKm: number | null | undefined;
}): TravelFeeVerdict {
  const { distanceKm, innerKm, outerKm } = input;
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return null;
  }
  if (typeof innerKm !== 'number' || !Number.isFinite(innerKm) || innerKm < 0) return null;
  if (typeof outerKm !== 'number' || !Number.isFinite(outerKm) || outerKm <= 0) return null;
  // An inner wider than the outer should be impossible (DB CHECK + the clamp
  // above), but if a caller hands us one raw, believe the OUTER — never promise
  // free travel outside the range we're willing to go.
  const inner = Math.min(innerKm, outerKm);

  if (distanceKm <= inner) return 'free_travel';
  if (distanceKm <= outerKm) return 'travel_fee';
  return 'outside_range';
}

/**
 * THE ONE COMPOSER — raw stored columns + tier → the pair of EFFECTIVE rings
 * every downstream reader is allowed to see.
 *
 * ── WHY THIS IS A FUNCTION AND NOT TWO CALLS AT EACH CALL SITE ──────────────
 * There are now TWO consumers of the same two numbers, and they must never
 * disagree:
 *
 *   • the couple's BADGE ("No travel fee" / "Travel fee applies") — the promise;
 *   • the server-side ENFORCEMENT that zeroes a quote's transportation line
 *     (`lib/vendor-free-transport.ts`) — the rule the vendor is held to.
 *
 * A promise the platform shows and a rule the platform enforces that read
 * different numbers is the worst possible failure here: either the couple is
 * billed for travel the badge called free, or the vendor is forced to eat travel
 * they never advertised. Composing the two helpers by hand at each call site is
 * one copy-paste away from exactly that, so the composition lives here, once.
 *
 * ── THE ONE NON-OBVIOUS RULE ────────────────────────────────────────────────
 * `outerKm` is null unless the vendor ACTUALLY DECLARED an outer ring.
 * `effectiveOuterRadiusKm` answers a blank with the TIER CAP, which is the right
 * answer for "how far does their plan let them go" and the WRONG answer for
 * "what did they say" — shipping it downstream would silently convert "hasn't
 * said" into "declared their tier cap", i.e. reinstate the tier-proxy claim that
 * §17 exists to delete. `innerKm` is null on the same principle (its helper
 * already returns null for an undeclared inner).
 *
 * Either ring null → `resolveTravelFeeVerdict` returns null → the badge falls
 * back to today's tier-derived read and enforcement does nothing. A blank is
 * never a penalty, never a claim, and never a lock.
 */
export function resolveDeclaredRings(input: {
  declaredInnerKm: number | null | undefined;
  declaredOuterKm: number | null | undefined;
  tier: string | null | undefined;
}): { innerKm: number | null; outerKm: number | null } {
  const declaredOuter = normalizeRadiusKm(input.declaredOuterKm);
  return {
    innerKm: effectiveInnerRadiusKm(input.declaredInnerKm, input.declaredOuterKm, input.tier),
    outerKm: declaredOuter === null ? null : effectiveOuterRadiusKm(declaredOuter, input.tier),
  };
}

/**
 * The whole read path in one call: raw stored columns + tier + distance → the
 * badge verdict. This is what the couple's bench uses, so the clamp can never
 * be skipped by forgetting to compose the two helpers.
 */
export function travelFeeVerdictForVendor(input: {
  distanceKm: number | null | undefined;
  declaredInnerKm: number | null | undefined;
  declaredOuterKm: number | null | undefined;
  tier: string | null | undefined;
}): TravelFeeVerdict {
  return resolveTravelFeeVerdict({
    distanceKm: input.distanceKm,
    ...resolveDeclaredRings(input),
  });
}

/** Plain-words label + tone for each verdict. One definition, so the bench card
 *  and the quickview inspector can never word the same fact differently. */
export const TRAVEL_FEE_BADGE: Record<
  Exclude<TravelFeeVerdict, null>,
  { text: string; tone: 'ok' | 'warn' }
> = {
  free_travel: { text: 'No travel fee', tone: 'ok' },
  travel_fee: { text: 'Travel fee applies', tone: 'warn' },
  outside_range: { text: 'Outside their range', tone: 'warn' },
};

/**
 * The rendered reach badge, or null for "show nothing".
 *
 * `source` says which of the two worlds answered:
 *   'declared' — the vendor's own inner/outer rings (§17). Trustworthy: they
 *                said it.
 *   'tier'     — TODAY'S BEHAVIOUR, untouched. An inference from what the
 *                vendor's plan buys, kept verbatim as the fallback.
 * `inRange` is icon-only (pin vs struck-through pin), not copy.
 */
export type ReachBadgeResolution =
  | {
      source: 'declared';
      verdict: Exclude<TravelFeeVerdict, null>;
      text: string;
      tone: 'ok' | 'warn';
      inRange: boolean;
    }
  | { source: 'tier'; text: string; tone: 'ok' | 'warn'; inRange: boolean }
  | null;

/**
 * THE PRECEDENCE, in one place: a vendor's own declaration BEATS the tier
 * inference; an absent declaration falls through to the tier inference exactly
 * as it renders today; absent both, nothing renders.
 *
 * This lives here rather than inside a component so the bench card and the
 * quickview inspector are literally the same decision — the corpus already
 * carries one open defect of the "two screens give different answers for the
 * same vendor" shape (Explore_Replan §15.9 decision 5), and this is the cheapest
 * possible way not to add a second.
 *
 * `innerKm` / `outerKm` must ALREADY be tier-clamped (they are, on the vendors
 * page, where the tier is in hand).
 */
export function resolveReachBadge(input: {
  distanceKm: number | null | undefined;
  innerKm: number | null | undefined;
  outerKm: number | null | undefined;
  /** Today's tier-derived read. TRUE = in range · FALSE = out · null = unknown. */
  reachesVenue: boolean | null | undefined;
  /** Today's tier radius in km, for the "Beyond N km" label. */
  serviceRadiusKm: number | null | undefined;
}): ReachBadgeResolution {
  const verdict = resolveTravelFeeVerdict({
    distanceKm: input.distanceKm,
    innerKm: input.innerKm,
    outerKm: input.outerKm,
  });
  if (verdict) {
    return {
      source: 'declared',
      verdict,
      text: TRAVEL_FEE_BADGE[verdict].text,
      tone: TRAVEL_FEE_BADGE[verdict].tone,
      inRange: verdict !== 'outside_range',
    };
  }
  if (input.reachesVenue === true) {
    return { source: 'tier', text: 'Reaches you', tone: 'ok', inRange: true };
  }
  if (input.reachesVenue === false) {
    return {
      source: 'tier',
      text: input.serviceRadiusKm ? `Beyond ${input.serviceRadiusKm}km` : 'Travel fee likely',
      tone: 'warn',
      inRange: false,
    };
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   WRITE PATH — validation for the vendor's own declaration.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ServiceRadiusPair = {
  innerRadiusKm: number | null;
  outerRadiusKm: number | null;
};

export type ServiceRadiusValidation =
  | ({ ok: true } & ServiceRadiusPair)
  | { ok: false; error: string };

/** Human-readable km, so "up to 100 km" never renders as "up to Infinity km". */
function capLabel(cap: number): string {
  return Number.isFinite(cap) ? `${cap} km` : 'any distance';
}

/**
 * Validate a submitted (inner, outer) pair against the vendor's CURRENT tier.
 *
 * Blank is always allowed and means "not declared" — clearing both fields is a
 * legitimate save that returns the vendor to the tier-derived fallback.
 *
 * Rejections, in the order they're checked:
 *   • a value that isn't a whole, non-negative number of km,
 *   • either ring above `MAX_DECLARABLE_RADIUS_KM` (typo guard),
 *   • the tier having no service reach at all (free tier, cap 0),
 *   • either ring above the tier cap — INCLUDING the inner, since inner ≤ outer
 *     ≤ cap means an inner above the cap is impossible by construction,
 *   • inner > outer.
 *
 * Note the deliberate asymmetry with the DB: the database enforces ordering and
 * non-negativity (invariants that are true regardless of subscription state),
 * while the TIER CAP is enforced only here and re-clamped at read time. A
 * tier-reading CHECK constraint would fire on downgrade and brick every write to
 * a lapsed vendor's row.
 */
export function validateServiceRadiusPair(input: {
  inner: unknown;
  outer: unknown;
  tier: string | null | undefined;
}): ServiceRadiusValidation {
  const cap = tierOuterRadiusCapKm(input.tier);

  const innerRaw = typeof input.inner === 'string' ? input.inner.trim() : input.inner;
  const outerRaw = typeof input.outer === 'string' ? input.outer.trim() : input.outer;
  const innerBlank = innerRaw === '' || innerRaw === null || innerRaw === undefined;
  const outerBlank = outerRaw === '' || outerRaw === null || outerRaw === undefined;

  const inner = innerBlank ? null : normalizeRadiusKm(innerRaw);
  const outer = outerBlank ? null : normalizeRadiusKm(outerRaw);

  if (!innerBlank && inner === null) {
    return { ok: false, error: 'Free-travel distance must be a whole number of kilometres.' };
  }
  if (!outerBlank && outer === null) {
    return { ok: false, error: 'Furthest distance must be a whole number of kilometres.' };
  }
  if (inner !== null && inner > MAX_DECLARABLE_RADIUS_KM) {
    return {
      ok: false,
      error: `Free-travel distance can’t be more than ${MAX_DECLARABLE_RADIUS_KM} km.`,
    };
  }
  if (outer !== null && outer > MAX_DECLARABLE_RADIUS_KM) {
    return {
      ok: false,
      error: `Furthest distance can’t be more than ${MAX_DECLARABLE_RADIUS_KM} km.`,
    };
  }

  const declaresSomething = inner !== null || outer !== null;
  if (declaresSomething && !(cap > 0)) {
    return {
      ok: false,
      error:
        'Your current plan doesn’t include a service reach yet, so there’s no distance to set. Upgrade to appear on couples’ maps.',
    };
  }
  if (outer !== null && outer > cap) {
    return {
      ok: false,
      error: `Your plan covers up to ${capLabel(cap)}. Lower your furthest distance, or upgrade for more reach.`,
    };
  }
  if (inner !== null && inner > cap) {
    return {
      ok: false,
      error: `Your plan covers up to ${capLabel(cap)}. Lower your free-travel distance, or upgrade for more reach.`,
    };
  }
  if (inner !== null && outer !== null && inner > outer) {
    return {
      ok: false,
      error: 'Your free-travel distance can’t be further than the furthest you’ll travel.',
    };
  }

  return { ok: true, innerRadiusKm: inner, outerRadiusKm: outer };
}
