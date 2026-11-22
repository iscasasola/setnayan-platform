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
 * ── 🔓 REACH IS NOT A PLAN ALLOWANCE (owner 2026-11-19, DECISION_LOG) ────────
 * Verbatim: *"ok unlock the range. not plan dependend anymore."* · *"Free
 * Unverified account will have a range of 0km."* This REPLACES the 2026-11-18
 * 5 · 10 · 50 · 100 km · nationwide ladder. The ONE ceiling is
 * {@link reachCeilingKm}, and it reads VERIFICATION, never the plan:
 *   · unverified → 0 km. Not in search, Discover or Find (lib/findable-shop.ts);
 *     reached by its own link or QR. It cannot declare a ring.
 *   · verified, ANY plan → no plan ceiling: the shop's own declared ring speaks,
 *     bounded only by the typo guard {@link MAX_DECLARABLE_RADIUS_KM}. A blank
 *     ring means no distance limit of its own.
 *
 * ── THE TWO ENFORCEMENT POINTS, AND WHY THERE ARE TWO ───────────────────────
 * 1. WRITE TIME — `validateServiceRadiusPair` refuses any ring from a shop that
 *    is not verified, and any ring past the typo guard.
 * 2. READ TIME — `effectiveOuterRadiusKm` re-applies the ceiling on every read.
 *    A shop that declared 50 km while verified and is later un-verified keeps a
 *    stale 50 in the column; without the read-time clamp it would go on
 *    reaching couples. With it, the stale value reads 0 — no backfill job.
 */

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

/** Hard ceiling on a declared ring — a typo guard, the same for every shop and plan (it predates the 2026-11-19
 *  unlock and is the "sane max" that ruling keeps), so a typo'd 99999 is rejected at the form rather than clamped
 *  silently into something odd. Roughly the length of the Philippines. */
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
 * 🔓 THE ONE REACH CEILING, in km — verification, never the plan (owner 2026-11-19).
 *
 *   verified     → `Infinity` (no plan ceiling; the shop's own ring speaks)
 *   not verified → 0          (found only by its own link or QR)
 *
 * `verified` is `vendor_profiles.verification_state = 'verified'` — pass
 * {@link isVerifiedForReach} over the row. Anything but an explicit `true` is 0:
 * an unread state never grants reach.
 */
export function reachCeilingKm(verified: boolean | null | undefined): number {
  return verified === true ? Infinity : 0;
}

/** The verification read every reach caller uses: `verification_state = 'verified'`, nothing else. */
export function isVerifiedForReach(verificationState: string | null | undefined): boolean {
  return verificationState === 'verified';
}

/**
 * THE CLAMP. `min(declared ?? ceiling, ceiling)`.
 *
 *   not verified    → 0         (whatever the column holds)
 *   verified, said  → declared  (the shop's own word, on any plan)
 *   verified, blank → Infinity  (no distance limit of its own)
 *
 * Called on EVERY read, so the stored column may be stale forever without ever
 * being believed past the ceiling.
 */
export function effectiveOuterRadiusKm(
  declaredKm: number | null | undefined,
  verified: boolean | null | undefined,
): number {
  const cap = reachCeilingKm(verified);
  const declared = normalizeRadiusKm(declaredKm);
  if (declared === null) return cap;
  return Math.min(declared, cap);
}

/**
 * 🔎 DOES A COUPLE'S SEARCH FIND THIS SHOP AT THIS DISTANCE? — owner 2026-11-19: "verified sets its own range".
 *
 * The plan no longer limits reach, but the shop's OWN declared outer ring still does: a verified shop with a 20 km ring
 * is not found by a couple 500 km away. Pass the CLAMPED ring ({@link effectiveOuterRadiusKm}).
 *
 *   distance unknown          → found (fail-open: no anchor or no HQ pin)
 *   ring ∞ (verified, blank)  → found (no distance limit of its own)
 *   ring 0 (not verified)     → found HERE — not distance-scoped; `is_findable` keeps it out of search
 *   ring finite               → found only within it (inclusive)
 */
export function reachAdmits(distanceKm: number | null | undefined, effectiveOuterKm: number): boolean {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return true;
  if (!Number.isFinite(effectiveOuterKm) || effectiveOuterKm <= 0) return true;
  return distanceKm <= effectiveOuterKm;
}

/**
 * The inner ring, clamped the same way — a stale inner can never poke outside
 * the effective outer (an un-verified shop's outer reads 0, so its inner does too).
 *
 * Returns null when the inner ring is undeclared — the badge needs BOTH rings.
 */
export function effectiveInnerRadiusKm(
  declaredInnerKm: number | null | undefined,
  declaredOuterKm: number | null | undefined,
  verified: boolean | null | undefined,
): number | null {
  const inner = normalizeRadiusKm(declaredInnerKm);
  if (inner === null) return null;
  return Math.min(inner, effectiveOuterRadiusKm(declaredOuterKm, verified));
}

/**
 * THE THREE-STATE BADGE. Returns null whenever the honest answer is "we don't
 * know" — the caller then renders today's tier-derived reach badge, unchanged.
 *
 * A null is returned when ANY of these is true:
 *   • the distance is unknown (manual vendor / no HQ pin / no venue anchor),
 *   • the inner ring is undeclared,
 *   • the outer ring is undeclared,
 *   • the effective outer ring is 0 or non-finite (a 0 cap / unscoped) — a
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
  /** ALREADY clamped — pass `effectiveInnerRadiusKm(...)`. */
  innerKm: number | null | undefined;
  /** ALREADY clamped — pass `effectiveOuterRadiusKm(...)`. */
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
 * THE ONE COMPOSER — raw stored columns + verification → the pair of EFFECTIVE rings
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
 * `effectiveOuterRadiusKm` answers a blank with the CEILING, which is the right
 * answer for "how far may they go" and the WRONG answer for "what did they say"
 * — shipping it downstream would silently convert "hasn't said" into a claim. `innerKm` is null on the same principle (its helper
 * already returns null for an undeclared inner).
 *
 * Either ring null → `resolveTravelFeeVerdict` returns null → the badge falls
 * back to today's tier-derived read and enforcement does nothing. A blank is
 * never a penalty, never a claim, and never a lock.
 */
export function resolveDeclaredRings(input: {
  declaredInnerKm: number | null | undefined;
  declaredOuterKm: number | null | undefined;
  /** `isVerifiedForReach(verification_state)` — the shop's verification, never its plan. */
  verified: boolean | null | undefined;
}): { innerKm: number | null; outerKm: number | null } {
  const declaredOuter = normalizeRadiusKm(input.declaredOuterKm);
  return {
    innerKm: effectiveInnerRadiusKm(input.declaredInnerKm, input.declaredOuterKm, input.verified),
    outerKm: declaredOuter === null ? null : effectiveOuterRadiusKm(declaredOuter, input.verified),
  };
}

/**
 * The whole read path in one call: raw stored columns + verification + distance → the
 * badge verdict. This is what the couple's bench uses, so the clamp can never
 * be skipped by forgetting to compose the two helpers.
 */
export function travelFeeVerdictForVendor(input: {
  distanceKm: number | null | undefined;
  declaredInnerKm: number | null | undefined;
  declaredOuterKm: number | null | undefined;
  verified: boolean | null | undefined;
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
 * `innerKm` / `outerKm` must ALREADY be clamped (they are, on the vendors
 * page, where the verification is in hand).
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

/** What an unverified shop is told when it tries to set a distance (owner 2026-11-19: unverified = 0 km). */
export const REACH_NEEDS_VERIFIED =
  'Your shop reaches couples by distance once it’s verified. Get verified to set how far you go.';

/**
 * Validate a submitted (inner, outer) pair against the shop's CURRENT verification.
 *
 * Blank is always allowed and means "not declared" — clearing both fields is a
 * legitimate save that returns the vendor to the tier-derived fallback.
 *
 * Rejections, in the order they're checked:
 *   • a value that isn't a whole, non-negative number of km,
 *   • either ring above `MAX_DECLARABLE_RADIUS_KM` (typo guard),
 *   • the shop not being verified (ceiling 0 — owner 2026-11-19),
 *   • inner > outer.
 *
 * There is NO plan ceiling (owner 2026-11-19): a verified Free shop may save
 * 200 km exactly as an Ultra shop may.
 *
 * Note the deliberate asymmetry with the DB: the database enforces ordering and
 * non-negativity, while the verification ceiling is enforced only here and
 * re-clamped at read time. A CHECK reading verification would fire when a shop
 * is un-verified and brick every write to its row.
 */
export function validateServiceRadiusPair(input: {
  inner: unknown;
  outer: unknown;
  /** Read from the database by the caller — never the form's word for it. */
  verified: boolean | null | undefined;
}): ServiceRadiusValidation {
  const cap = reachCeilingKm(input.verified);

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
    return { ok: false, error: REACH_NEEDS_VERIFIED };
  }
  if (inner !== null && outer !== null && inner > outer) {
    return {
      ok: false,
      error: 'Your free-travel distance can’t be further than the furthest you’ll travel.',
    };
  }

  return { ok: true, innerRadiusKm: inner, outerRadiusKm: outer };
}
