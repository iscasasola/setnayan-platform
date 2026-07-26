/**
 * vendor-reach-rings.ts — the PURE two-ring reach resolver.
 *
 * Owner-locked model (`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6):
 *
 *   • Ring 1 — "free travel": served + discoverable, and the vendor's proposal
 *     **transportation line is locked to ₱0 with the field disabled**. The
 *     couple sees "Free Transportation."
 *   • Ring 2 — "willing to travel": discoverable; the couple sees "travel fee
 *     may apply" and the transportation line stays editable.
 *   • Beyond Ring 2 — the vendor is not shown to that couple.
 *   • **The EVENT VENUE decides the ring.** Vendors set both rings; the Ring-2
 *     outer bound is TIER-CAPPED — Free/Solo ~30 km · Pro ~60 km · Enterprise
 *     100 km.
 *
 * WHY this file is pure (no env read, no clock, no I/O, no Supabase): the ring a
 * couple falls in decides whether a vendor may charge for travel — that is a
 * money boundary, so it has to be exercisable under `tsx --test` with plain
 * numbers. The env flag lives in `vendor-reach-rings-flag.ts`; every DB read
 * lives in `vendor-reach-rings.server.ts`. Keep those concerns out of here.
 *
 * RELATIONSHIP TO `vendor-tier-caps.ts` · `serviceRadiusKm`
 * --------------------------------------------------------
 * `TIER_CAPS.serviceRadiusKm` (0 / 20 / 20 / 50 / 100) is the LEGACY single-ring
 * reach the shipped marketplace search gates on today. It is deliberately NOT
 * edited here: flipping those numbers would move live discovery for every
 * vendor the moment it merged. The 2026-07-25 model's Ring-2 ladder is a
 * SEPARATE, flag-dark table below; it only becomes authoritative when the owner
 * flips `NEXT_PUBLIC_VENDOR_REACH_RINGS_V1`. When that happens, the legacy
 * `serviceRadiusKm` gate should be retired in favour of `resolveReachRing`
 * (tracked as a cross-track dependency — `category-search.ts` is not this
 * track's file).
 */

import { asVendorTier, type VendorTier } from './vendor-tier-caps';
import { haversineKm } from './geo';

/* ── Tier ladder ─────────────────────────────────────────────────────────── */

/**
 * Ring-2 ("willing to travel") OUTER CAP per tier, in km — owner-locked
 * 2026-07-25 § 1 capability matrix, row "Reach — Ring 2 outer cap":
 * Free ~30 · Solo ~30 · Pro ~60 · Enterprise 100.
 *
 * `verified` is the legacy free tier → same 30 km as Free. `custom` runs as
 * Enterprise-or-better by the standing owner rule, so it clones Enterprise;
 * a composed Custom plan that buys extra reach overlays on top at read time
 * (same shape as `vendorEffectiveCaps`) — not modelled here.
 */
export const RING2_CAP_KM: Readonly<Record<VendorTier, number>> = Object.freeze({
  free: 30,
  verified: 30,
  solo: 30,
  pro: 60,
  enterprise: 100,
  custom: 100,
});

/** Hard sanity bounds for a stored ring value (mirrors the DB CHECK). */
export const RING_KM_MIN = 0;
export const RING_KM_MAX = 100;

/**
 * Ring 1 default when the vendor has never set one: **0 km — no free-travel
 * ring at all.**
 *
 * FAIL-SAFE DIRECTION MATTERS. Ring 1 is the ring that FORCES the vendor's
 * transportation line to ₱0. Defaulting it to any positive number would silently
 * confiscate travel fees from vendors who never opted in. Zero means "until you
 * draw a free-travel ring, nothing is locked" — the vendor opts IN to free
 * transport, they are never opted in for them.
 */
export const RING1_DEFAULT_KM = 0;

/**
 * The smallest Ring 2 a vendor may SAVE: 1 km.
 *
 * Ring 2 is the outer bound BEYOND WHICH the vendor is not shown to a couple, so
 * `reach_ring2_km = 0` means "invisible to every couple on earth" — and combined
 * with the NULL sentinel below, saving it once would be a self-inflicted,
 * silent, permanent delisting from one stray slider drag. Visibility is what
 * `public_visibility` is for (admin-guarded); the coverage slider must not be a
 * second, unguarded way to disappear. `parseRingSettings` REJECTS anything under
 * this and the settings slider starts here.
 *
 * This is a WRITE-side floor only. `resolveRingRadii` still honours a stored 0
 * (nothing can write one today, but a direct PostgREST PATCH could, and it only
 * ever narrows the patcher's own reach).
 */
export const RING2_MIN_KM = 1;

/** The Ring-2 outer cap for a tier (unknown/garbage tier → Free's 30 km). */
export function ring2CapKm(tier: string | null | undefined): number {
  return RING2_CAP_KM[asVendorTier(tier)];
}

/**
 * What to WRITE into `vendor_profiles.reach_ring2_km` for a chosen radius —
 * **NULL when the choice is the tier cap.**
 *
 * ── WHY THIS FUNCTION EXISTS (it is a money bug, not a tidiness one) ────────
 * NULL in that column does not mean "0 km", it means **"follow my plan's cap"**
 * (see `resolveRingRadii` rule 1 and the migration's FAIL-SAFE DEFAULTS block).
 * The settings card is seeded with the vendor's EFFECTIVE radius, which for an
 * untouched vendor IS the cap — so a naive "write what the slider says" save
 * persists the *derived* number and destroys the sentinel.
 *
 * The consequence is permanent and invisible: a Solo vendor (cap 30) opens
 * Coverage, nudges Ring 1, saves → `reach_ring2_km = 30`. They then buy Pro at
 * ₱2,499/28d for the advertised 60 km, and `resolveRingRadii` clamps their
 * stored 30 to `min(30, 60) = 30`. They paid for reach and got none of it,
 * forever, under a card that reads "Upgrade to reach farther."
 *
 * Collapsing at-or-above the cap to NULL means "at the cap" stays a RELATIVE
 * choice that follows the plan up and down, while any deliberately narrower
 * radius stays absolute. Downgrades are unaffected — the read-side clamp already
 * handles those without a destructive write.
 */
export function ring2ColumnValue(
  tier: string | null | undefined,
  effectiveRing2Km: number,
): number | null {
  return effectiveRing2Km >= ring2CapKm(tier) ? null : effectiveRing2Km;
}

/* ── Radii resolution (clamping) ─────────────────────────────────────────── */

export type ResolvedRingRadii = {
  /** Effective Ring 1 (free-travel) radius in km, after clamping. */
  ring1Km: number;
  /** Effective Ring 2 (willing-to-travel) radius in km, after clamping. */
  ring2Km: number;
  /** The tier's Ring-2 outer cap that was applied. */
  capKm: number;
  /** TRUE when the vendor's stored Ring 2 was cut down by the tier cap. */
  ring2CappedByTier: boolean;
  /** TRUE when the vendor's stored Ring 1 was cut down to fit inside Ring 2. */
  ring1CappedByRing2: boolean;
};

const finite = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? n : null;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/**
 * Resolve a vendor's STORED ring settings into the EFFECTIVE radii, applying
 * the tier cap.
 *
 * Rules, in order:
 *   1. Ring 2 defaults to the tier cap when unset, then is clamped to
 *      [0, tier cap] — a vendor who downgrades keeps their stored preference
 *      but only reaches as far as the new tier allows (no destructive write).
 *   2. Ring 1 defaults to 0 (see RING1_DEFAULT_KM) and is clamped to
 *      [0, effective Ring 2] — the free-travel ring can never poke outside the
 *      willing-to-travel ring.
 *
 * Clamp-at-READ (rather than trusting the column) is the security boundary:
 * `vendor_profiles` RLS is row-level and `vendor_profiles_owner` is FOR ALL, so
 * a vendor CAN PATCH their own `reach_ring2_km` to 999 through PostgREST. That
 * is harmless precisely because nothing downstream reads the raw column — every
 * consumer goes through here and gets the capped number.
 */
export function resolveRingRadii(
  tier: string | null | undefined,
  storedRing1Km: number | null | undefined,
  storedRing2Km: number | null | undefined,
): ResolvedRingRadii {
  const capKm = ring2CapKm(tier);

  const raw2 = finite(storedRing2Km);
  const want2 = raw2 === null ? capKm : raw2;
  const ring2Km = clamp(want2, RING_KM_MIN, capKm);

  const raw1 = finite(storedRing1Km);
  const want1 = raw1 === null ? RING1_DEFAULT_KM : raw1;
  const ring1Km = clamp(want1, RING_KM_MIN, ring2Km);

  return {
    ring1Km,
    ring2Km,
    capKm,
    ring2CappedByTier: raw2 !== null && raw2 > capKm,
    ring1CappedByRing2: raw1 !== null && raw1 > ring2Km,
  };
}

/* ── Ring verdict ────────────────────────────────────────────────────────── */

export type ReachRing = 'ring_1' | 'ring_2' | 'out_of_range' | 'unknown';

export type ReachRingVerdict = ResolvedRingRadii & {
  ring: ReachRing;
  /** Great-circle km from the vendor's HQ to the event venue; null when unknown. */
  distanceKm: number | null;
  /**
   * TRUE only in Ring 1 — the Proposal Maker must force the transportation line
   * to ₱0 and DISABLE the field.
   */
  transportLocked: boolean;
  /**
   * Should this vendor be shown to this couple at all? FALSE only for a
   * confidently-resolved `out_of_range`. `unknown` FAILS OPEN (stays
   * discoverable) — a missing geocode must never delete a vendor from the
   * marketplace.
   */
  discoverable: boolean;
  /** Couple-facing transportation label, or null when we can't claim either way. */
  coupleLabel: string | null;
};

/** Couple-facing copy — owner-locked wording, § 6. */
export const RING_COUPLE_LABEL: Readonly<Record<ReachRing, string | null>> =
  Object.freeze({
    ring_1: 'Free Transportation',
    ring_2: 'Travel fee may apply',
    out_of_range: null,
    unknown: null,
  });

export type ReachRingInput = {
  tier: string | null | undefined;
  /** Stored `vendor_profiles.reach_ring1_km` (null = never set). */
  ring1Km: number | null | undefined;
  /** Stored `vendor_profiles.reach_ring2_km` (null = never set). */
  ring2Km: number | null | undefined;
  /** `vendor_profiles.hq_latitude` / `hq_longitude`. */
  vendorLat: number | null | undefined;
  vendorLng: number | null | undefined;
  /** `events.venue_latitude` / `venue_longitude` — THE VENUE decides the ring. */
  venueLat: number | null | undefined;
  venueLng: number | null | undefined;
};

const validLat = (n: number | null): n is number => n !== null && n >= -90 && n <= 90;
const validLng = (n: number | null): n is number => n !== null && n >= -180 && n <= 180;

/**
 * Which ring does this event venue fall in for this vendor?
 *
 * Boundaries are INCLUSIVE of the inner ring: exactly `ring1Km` away is still
 * Ring 1 (free travel), exactly `ring2Km` away is still Ring 2. Ties resolve in
 * the couple's favour, which is also the vendor's marketing interest.
 *
 * A zero-width Ring 1 (the default) can never match, because a distance is
 * `>= 0` and Ring 1 requires `d <= 0` — only a venue at the exact HQ pin, which
 * is genuinely free travel. That is the intended degenerate case.
 */
export function resolveReachRing(input: ReachRingInput): ReachRingVerdict {
  const radii = resolveRingRadii(input.tier, input.ring1Km, input.ring2Km);

  const vLat = finite(input.vendorLat);
  const vLng = finite(input.vendorLng);
  const eLat = finite(input.venueLat);
  const eLng = finite(input.venueLng);

  const haveCoords =
    validLat(vLat) && validLng(vLng) && validLat(eLat) && validLng(eLng);

  if (!haveCoords) {
    return {
      ...radii,
      ring: 'unknown',
      distanceKm: null,
      transportLocked: false, // never confiscate a travel fee on a guess
      discoverable: true, // fail OPEN — a missing pin must not hide a vendor
      coupleLabel: RING_COUPLE_LABEL.unknown,
    };
  }

  const distanceKm = haversineKm(vLat, vLng, eLat, eLng);

  const ring: ReachRing =
    distanceKm <= radii.ring1Km
      ? 'ring_1'
      : distanceKm <= radii.ring2Km
        ? 'ring_2'
        : 'out_of_range';

  return {
    ...radii,
    ring,
    distanceKm,
    transportLocked: ring === 'ring_1',
    discoverable: ring !== 'out_of_range',
    coupleLabel: RING_COUPLE_LABEL[ring],
  };
}

/**
 * The narrowed ring verdict passed around SERVER-SIDE ONLY.
 *
 * ⚠ This type must not cross into a `'use client'` module or a props object.
 * It carries the ring, which the vendor can binary-search into the couple's
 * venue coordinates (see invariant 3 in `vendor-reach-rings.server.ts`). It is
 * `Pick`ed down from the full verdict so that even server code handling it can't
 * accidentally forward `distanceKm`.
 */
export type TransportRingSummary = Pick<
  ReachRingVerdict,
  'ring' | 'transportLocked' | 'ring1Km' | 'ring2Km' | 'coupleLabel'
>;

/* ── Server-side re-assertion of the Ring-1 lock ─────────────────────────── */

/** The minimum shape of a composed proposal line (mirrors `ProposalLineItem`). */
export type TransportEnforceableLine = {
  label: string;
  detail?: string | null;
  amount_centavos: number | null;
};

/** The label the composer uses for the transportation line. */
const TRANSPORT_LABEL = 'transportation';
/** Ring-1 detail copy, kept in one place so UI and server agree verbatim. */
export const FREE_TRANSPORT_DETAIL =
  'Free Transportation — your venue is inside our free-travel range';

/**
 * Re-assert the Ring-1 lock over an itemization that arrived from a client.
 *
 * WHY THIS EXISTS: the Proposal Maker composes its line items in the browser
 * and POSTs them as JSON — the disabled `<select>` is a UX affordance, not an
 * enforcement boundary. A vendor who crafts the request can still put a
 * ₱15,000 "Transportation" line on a Ring-1 quote unless the server rewrites
 * it. Same lesson as `assertVendorAddonActivationEligible`: gating the UI is
 * only half the job.
 *
 * Pure and total: given a locked ring it replaces every transportation line
 * with the ₱0 free-travel line (adding one if the client omitted it); given any
 * other ring it returns the input UNCHANGED (same array contents), so it is safe
 * to call unconditionally.
 *
 * WIRED AT: `sendCustomProposalCore` (lib/proposal-send.ts), immediately after
 * `gateVendorProposalThread` + `sanitizeCustomLineItems` and before the row is
 * inserted — the single server-side chokepoint every vendor-authored quote goes
 * through, web action and native endpoint alike. The caller recomputes the
 * total from the returned lines. If you find this function with no call sites
 * again, the ₱0 lock is NOT enforced and the changelog must stop saying it is.
 */
export function enforceFreeTransport<T extends TransportEnforceableLine>(
  lines: readonly T[],
  ring: Pick<ReachRingVerdict, 'transportLocked'> | null | undefined,
): Array<T | TransportEnforceableLine> {
  if (!ring?.transportLocked) return [...lines];
  const isTransport = (l: T) => l.label.trim().toLowerCase() === TRANSPORT_LABEL;
  const free: TransportEnforceableLine = {
    label: 'Transportation',
    detail: FREE_TRANSPORT_DETAIL,
    amount_centavos: 0,
  };
  const out: Array<T | TransportEnforceableLine> = [];
  let replaced = false;
  for (const l of lines) {
    if (isTransport(l)) {
      if (!replaced) {
        out.push(free);
        replaced = true;
      }
      continue; // drop any additional transportation lines outright
    }
    out.push(l);
  }
  if (!replaced) out.push(free);
  return out;
}

/**
 * `enforceFreeTransport` + a RE-SUM, as one step.
 *
 * The re-sum is the half that is easy to forget and impossible to see: zeroing a
 * ₱15,000 transportation line without re-totalling persists `total_centavos =
 * 15000_00` against an itemization that adds up to ₱0 more — the couple accepts
 * a quote whose lines and total disagree, and the total is the number the
 * booking-fee and payment-schedule maths read. Keeping the two operations in one
 * pure function means a caller cannot do one without the other.
 *
 * `ring == null` (always, while the flag is dark) → the lines pass through and
 * the total is the plain sum, i.e. exactly what `sanitizeCustomLineItems`
 * already produced.
 */
export function applyFreeTransportToQuote<T extends TransportEnforceableLine>(
  lines: readonly T[],
  ring: Pick<ReachRingVerdict, 'transportLocked'> | null | undefined,
): { lineItems: TransportEnforceableLine[]; totalCentavos: number } {
  const lineItems = enforceFreeTransport(lines, ring).map((li) => ({
    label: li.label,
    detail: li.detail ?? null,
    amount_centavos: li.amount_centavos,
  }));
  const totalCentavos = Math.max(
    0,
    lineItems.reduce((s, li) => s + (li.amount_centavos ?? 0), 0),
  );
  return { lineItems, totalCentavos };
}

/* ── Vendor-settings helpers ─────────────────────────────────────────────── */

/**
 * Decide the tier to save ring settings against, from the narrow `tier_state`
 * read — or REFUSE the save.
 *
 * Pure so the fail direction is testable without a Supabase client, because the
 * fail direction is the whole point. `asVendorTier(null)` is `'free'`, whose
 * Ring-2 cap (30 km) is the SMALLEST on the ladder. Treating an errored or empty
 * read as "no tier" would therefore clamp an Enterprise vendor's 100 km to 30
 * and then persist that 30 — a transient PostgREST blip permanently confiscating
 * 70 km of reach they are still paying for. Abort instead; a retry is cheap.
 */
export type RingSaveTierRead =
  | { ok: true; tier: string | null }
  | { ok: false; error: string };

export function resolveTierForRingSave(
  row: { tier_state?: unknown } | null | undefined,
  error: unknown,
): RingSaveTierRead {
  if (error || row === null || row === undefined) {
    return {
      ok: false,
      error: 'Couldn’t read your plan just now — please try saving again.',
    };
  }
  return {
    ok: true,
    tier: typeof row.tier_state === 'string' ? row.tier_state : null,
  };
}

export type RingSettingsParse =
  | {
      ok: true;
      /** Effective (clamped) Ring 1 — what the card should display after saving. */
      ring1Km: number;
      /** Effective (clamped) Ring 2 — what the card should display after saving. */
      ring2Km: number;
      /**
       * What to WRITE to `vendor_profiles.reach_ring2_km`. **NULL when the
       * vendor chose their tier cap** — see `ring2ColumnValue`. Writers MUST
       * persist this, never `ring2Km`, or a later upgrade delivers nothing.
       */
      ring2Store: number | null;
    }
  | { ok: false; error: string };

/**
 * Validate + clamp a vendor's ring-settings submission. Server-authoritative:
 * the settings card sliders are capped client-side for UX, this is what decides
 * what actually lands in the columns.
 *
 * Out-of-ladder values are CLAMPED, not rejected — an Enterprise vendor who
 * downgrades to Solo should keep saving their profile, just with a 30 km reach.
 * Only genuinely un-parseable input errors.
 */
export function parseRingSettings(
  tier: string | null | undefined,
  rawRing1: unknown,
  rawRing2: unknown,
): RingSettingsParse {
  // `Number(null)` and `Number('')` are BOTH 0, so a blank/absent field would
  // silently save "0 km" — which for Ring 2 means "invisible to every couple".
  // Reject emptiness explicitly before coercing.
  const blank = (v: unknown) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  if (blank(rawRing1) || blank(rawRing2)) {
    return { ok: false, error: 'Enter both distances in kilometres.' };
  }
  const n1 = Number(rawRing1);
  const n2 = Number(rawRing2);
  if (!Number.isFinite(n1) || !Number.isFinite(n2)) {
    return { ok: false, error: 'Enter both distances in kilometres.' };
  }
  if (n1 < 0 || n2 < 0) {
    return { ok: false, error: 'Distances can’t be negative.' };
  }
  // A Ring 2 under RING2_MIN_KM means "no couple anywhere can see me". Refuse it
  // rather than clamp it: clamping to 1 km is barely less of a delisting, and
  // the vendor deserves to be told, not silently corrected. Visibility belongs
  // to `public_visibility`, not to this slider.
  if (Math.round(n2) < RING2_MIN_KM) {
    return {
      ok: false,
      error: `Willing-to-travel has to be at least ${RING2_MIN_KM} km — at 0 km no couple can find you. Hide your shop from Profile → Visibility instead.`,
    };
  }
  const { ring1Km, ring2Km } = resolveRingRadii(
    tier,
    Math.round(n1),
    Math.round(n2),
  );
  // ring2Store, NOT ring2Km — writing the derived cap back destroys the NULL
  // "follow my plan" sentinel and freezes the vendor at today's cap forever.
  return { ok: true, ring1Km, ring2Km, ring2Store: ring2ColumnValue(tier, ring2Km) };
}
