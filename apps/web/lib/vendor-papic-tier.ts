/**
 * Vendor on-the-day Papic capture — the tier + capture-points model.
 * Owner-locked 2026-07-18 (DECISION_LOG). PURE + unit-testable; every value here
 * is admin-dialable later without a schema change.
 *
 * TARGET model — owner 2026-07-22 "points in proportion to what they paid":
 * every booked vendor gets Papic as a GIFT so they can document the events they
 * work. The free allowance is a floor of 50 points that SCALES UP with the
 * booking fee the vendor paid — 50 pts at ₱0, up to 200 pts at a ₱4,000 fee,
 * proportional in between (see vendorPapicPointsForBookingFee). Photos + video
 * throughout. ⚠ INPUT PENDING: the booking-fee mechanism is still a working doc
 * (unbuilt) — until it lands there is no per-event fee to scale on, so the
 * derivation below is the INTERIM.
 *
 * INTERIM tier (until the fee input exists) — derived, never chosen:
 *   • FOUNDER-comped accept (vendor_event_unlocks.comp_reason='founder', a
 *     token-free, as-if-paid perk) → Papic Ltd (70 pts).
 *   • Any other booked accept → Papic Lite (the 50-pt gift floor + video).
 * Unli (unlimited) stays a latent tier an admin can comp (a grant row with
 * tier='unli'); the vendor-facing +₱50 self-serve upgrade was DROPPED
 * (owner 2026-07-18 — "not allow upgrade +50 if it is difficult").
 *
 * 🚫 TOKENS RETIRED (owner 2026-07-21). The old "earn Ltd by SPENDING a lead
 * token" path is GONE — tokens don't exist, so tokens_burned / lead_token_holds
 * are dead signals and are no longer read (see lib/vendor-papic-grants.ts). Only
 * the non-token founder-comp still bumps a vendor above the free floor. The
 * fee-scaled formula supersedes this whole Lite/Ltd ladder once the fee lands.
 *
 * Capture-points currency (owner 2026-07-17; clip reweighted 2026-07-22 · §0):
 * 1 photo = 1 pt · 1×10s clip = 8 pts.
 *
 * The base tier (Lite/Ltd) is DERIVED live from vendor_event_unlocks — never
 * stored. Only the paid Unli upgrade is persisted (vendor_papic_capture_grants
 * with tier='unli'). See lib/vendor-papic-grants.ts for the DB reads.
 *
 * Scope: ON-THE-DAY only (the vendor floor console), not a standalone capture
 * feature. Counsel-gated — no capture runs until the DPO/NPC ruling flips the
 * admin Data Privacy control (see lib/vendor-dayof-flags.ts).
 */

import { PAPIC_CLIP_COST_MAX, PAPIC_POINTS_PER_PHOTO } from './papic-cameras-pure';

export type VendorPapicTier = 'lite' | 'ltd' | 'unli';
export type VendorPapicMedia = 'photo' | 'clip';

/**
 * Points a single vendor capture costs.
 *
 * 🚨 THIS SAID 7 WHILE ITS OWN DOCBLOCK SAID 8, IN TWO PLACES, SINCE 2026-07-29.
 * The header above and the line right here both claimed "1×10s clip = 8 pts" and
 * both claimed to mirror the couple pool's clip weight; the value was 7. It
 * drifted when the owner moved the couple's clip 7 → 8 with the two-type lock,
 * and nothing pointed the two at each other, so the reprice reached one meter
 * and not the other. Corrected here by DERIVING it, which is the only fix that
 * cannot drift again.
 *
 * 🔒 VENDOR CLIPS STAY FLAT — they are NOT band-priced by length, even though
 * couple captures are since 2026-08-11. Two reasons, both deliberate:
 *   • this is a different meter (a vendor's documentation allowance, not the
 *     couple's credits), and the owner's length table was a decision about what
 *     a COUPLE pays;
 *   • the vendor capture route charges server-side from a media TYPE and has no
 *     duration in hand, so band-pricing it would silently bill every vendor clip
 *     at the ceiling anyway — the same number, reached less honestly.
 */
export const VENDOR_PAPIC_POINTS: Record<VendorPapicMedia, number> = {
  photo: PAPIC_POINTS_PER_PHOTO,
  clip: PAPIC_CLIP_COST_MAX,
};

export function pointsForMedia(media: VendorPapicMedia): number {
  return VENDOR_PAPIC_POINTS[media];
}

// ── Fee-scaled documentation allowance (owner 2026-07-22) ───────────────────
// The gift floor every booked vendor gets, and the ceiling it scales to as the
// booking fee grows. Papic points = 50 at a ₱0 fee → 200 at a ₱4,000+ fee,
// linear in between ("goes smaller in proportion to the amount they paid for").
/** The gift floor — what every booked supplier gets having paid nothing. */
export const VENDOR_PAPIC_BASE_GIFT_POINTS = 50;

/**
 * ⚠ THE RATE WAS RESET 2026-08-26, AND THE REASON IS THAT THE ALLOWANCE CHANGED
 * PURPOSE. The old model gave 50 → 200 points across a ₱0–₱4,000 fee, and it was
 * sized for a supplier DOCUMENTING THE DAY — a handful of shots between jobs.
 * Owner 2026-08-26: *"they can upload their work via papic credits as well per
 * event."* A wedding photographer delivers 300–800 photographs. **200 cannot
 * hold a gallery**, so the old ceiling was sized for a job nobody is doing.
 *
 * The principle is unchanged and still the owner's (2026-07-22, *"points in
 * proportion to what they paid"*) — only the rate and the ceiling move.
 *
 * ⚖ ONE SHOT PER ₱5 OF FEE PAID. A ₱50,000 booking earns a ₱2,500 fee → 500
 * shots; ₱80,000 → 800. 🔑 **It costs us nothing that matters**: 500 kept photos
 * are ~6 centavos a YEAR of storage, against ₱165 if a couple bought the same
 * 500. The gift feels substantial and is a rounding error to serve.
 */
export const VENDOR_PAPIC_PHP_PER_POINT = 5;

/** The ceiling, so a ₱2M booking cannot mint twenty thousand free credits. */
export const VENDOR_PAPIC_MAX_POINTS = 2000;

/** The fee at which the ceiling is reached — DERIVED, never re-typed. */
export const VENDOR_PAPIC_FEE_CEILING_PHP =
  VENDOR_PAPIC_MAX_POINTS * VENDOR_PAPIC_PHP_PER_POINT;

/**
 * VIDEO UNLOCKS AT 800 — owner 2026-08-26: *"800 credits will allow them to
 * take videos."*
 *
 * 🚨 UNTIL NOW `allowVideo` WAS `true` ON EVERY TIER, so `canCapture`'s
 * `video_not_allowed` refusal **could never fire** — a dead branch describing a
 * rule nothing enforced. This is the number that gives it meaning.
 *
 * ⚠ IT NARROWS VIDEO RELATIVE TO THE (UNREACHABLE) STATE BEFORE IT: a supplier
 * on the 50-point floor could nominally shoot video and now cannot. Safe by
 * arithmetic — production holds **zero** vendor captures and the whole lane is
 * switched off behind the DPO ruling, so nobody loses something they were
 * using. Stated rather than buried, because it is a narrowing.
 *
 * At one shot per ₱5, 800 points is a ₱4,000 booking fee.
 */
export const VENDOR_PAPIC_VIDEO_MIN_POINTS = 800;

/**
 * Papic documentation points a vendor earns for a booked event, scaled by the
 * booking fee (in PHP) they paid: the 50-pt gift floor at ₱0, rising linearly to
 * 200 pts at the ₱4,000 ceiling and capped there. PURE — the caller supplies the
 * fee once the booking-fee mechanism exists; a missing/0 fee yields the floor,
 * so this is safe to wire before that lands (it just returns the base gift).
 */
export function vendorPapicPointsForBookingFee(bookingFeePhp: number): number {
  const fee = Number(bookingFeePhp);
  // A missing, negative or nonsense fee is not evidence of payment — it earns
  // the floor, never a windfall.
  if (!Number.isFinite(fee) || fee <= 0) return VENDOR_PAPIC_BASE_GIFT_POINTS;
  const earned = Math.floor(fee / VENDOR_PAPIC_PHP_PER_POINT);
  return Math.min(
    VENDOR_PAPIC_MAX_POINTS,
    Math.max(VENDOR_PAPIC_BASE_GIFT_POINTS, earned),
  );
}

export type VendorPapicTierSpec = {
  tier: VendorPapicTier;
  /** Capture-point budget for the day. null = unlimited (Unli). */
  points: number | null;
  /** Whether clips (≤10s) are allowed. */
  allowVideo: boolean;
  /** Short human label for the readout badge. */
  label: string;
};

// Owner 2026-07-22: every booked vendor gets a FREE 50-point documentation
// allowance per event, photos AND video (matches the couple free-pool grant of
// 50 pts). This raised Lite from 20→50 pts and turned video ON for the free tier.
// ⚠ ladder note: video is no longer a paid differentiator — the paid Ltd tier now
// only adds +20 points over the free tier; re-tier the paid ladder if desired.
export const VENDOR_PAPIC_TIERS: Record<VendorPapicTier, VendorPapicTierSpec> = {
  lite: { tier: 'lite', points: 50, allowVideo: true, label: 'Papic Lite' },
  ltd: { tier: 'ltd', points: 70, allowVideo: true, label: 'Papic Ltd' },
  unli: { tier: 'unli', points: null, allowVideo: true, label: 'Papic Unli' },
};

export function tierSpec(tier: VendorPapicTier): VendorPapicTierSpec {
  return VENDOR_PAPIC_TIERS[tier];
}

/** Sum the capture points a set of captures has spent. */
export function pointsSpent(
  captures: readonly { media_type: VendorPapicMedia }[],
): number {
  return captures.reduce((sum, c) => sum + pointsForMedia(c.media_type), 0);
}

/**
 * THE ALLOWANCE A SUPPLIER ACTUALLY HAS, once the booking fee they PAID is known.
 *
 * Owner 2026-07-22: *"points in proportion to what they paid"* — 50 points at
 * ₱0, up to 200 at a ₱4,000 fee, proportional in between. Restated 2026-08-26:
 * *"photographer will buy credits or use their free credits from booking fee to
 * upload their photos."*
 *
 * 🚨 THAT RULING WAS WRITTEN, UNIT-TESTED, AND CALLED BY NOTHING.
 * `vendorPapicPointsForBookingFee` has existed since the ruling with **zero**
 * application callers — only its own tests referenced it — so every supplier
 * has been getting the flat tier number regardless of what they paid. The
 * reason is recorded in this file's own header: when it was written *"the
 * booking-fee mechanism is still a working doc (unbuilt)"*, so there was no fee
 * to scale on. `booking_fee_charges` exists now. This is the wire.
 *
 * 🔑 THE FEE CAN ONLY EVER RAISE, NEVER LOWER. A founder-comped supplier sits
 * on `ltd` (70) having paid nothing; the fee formula would hand them 50 and
 * TAKE 20 POINTS AWAY. Nobody may lose an allowance they already had because we
 * connected a wire, so this is a MAX, not a replacement.
 *
 * 🔑 AN UNPROVEN FEE GRANTS NOTHING. `null` means we could not read what they
 * paid — never "they paid nothing extra". It falls back to the tier's own
 * number, which is the mirror of this module's existing posture that a failed
 * spend read fails CLOSED. A metering outage must not mint points.
 *
 * ⛔ Unlimited stays unlimited: `null` points is not a number to compare.
 */
export function allowancePointsFor(
  tier: VendorPapicTier,
  bookingFeePaidPhp: number | null,
): number | null {
  const base = tierSpec(tier).points;
  if (base == null) return null; // unli — nothing to raise
  if (bookingFeePaidPhp == null) return base;
  return Math.max(base, vendorPapicPointsForBookingFee(bookingFeePaidPhp));
}

/**
 * MAY THIS SUPPLIER SHOOT VIDEO? Owner 2026-08-26: *"800 credits will allow
 * them to take videos."*
 *
 * 🔑 DERIVED FROM THE ALLOWANCE, NOT FROM THE TIER. Every tier sets
 * `allowVideo: true`, so the tier flag has never refused anybody — the refusal
 * branch in `canCapture` was unreachable. The threshold is what makes it real.
 * The tier flag is still ANDed in so a future tier can still veto outright,
 * rather than being deleted and silently losing that ability.
 *
 * ⛔ Unlimited is unlimited: no points ceiling means no video threshold either.
 */
export function allowVideoFor(
  tier: VendorPapicTier,
  bookingFeePaidPhp: number | null,
): boolean {
  if (!tierSpec(tier).allowVideo) return false;
  const cap = allowancePointsFor(tier, bookingFeePaidPhp);
  if (cap == null) return true; // unli
  return cap >= VENDOR_PAPIC_VIDEO_MIN_POINTS;
}

export type CaptureAllowance = {
  tier: VendorPapicTier;
  allowVideo: boolean;
  /** null = unlimited. */
  pointsCap: number | null;
  pointsSpent: number;
  /** null = unlimited remaining. */
  pointsLeft: number | null;
};

export function captureAllowance(
  tier: VendorPapicTier,
  spent: number,
  /** What the supplier PAID in booking fees for this event. null = unread; see
   *  `allowancePointsFor`. Omitted → today's flat tier number, unchanged. */
  bookingFeePaidPhp: number | null = null,
): CaptureAllowance {
  const cap = allowancePointsFor(tier, bookingFeePaidPhp);
  const cleanSpent = Math.max(0, Math.floor(Number(spent)) || 0);
  const pointsLeft = cap == null ? null : Math.max(0, cap - cleanSpent);
  return {
    tier,
    allowVideo: allowVideoFor(tier, bookingFeePaidPhp),
    pointsCap: cap,
    pointsSpent: cleanSpent,
    pointsLeft,
  };
}

export type CaptureCheck =
  | { ok: true }
  | { ok: false; reason: 'video_not_allowed' | 'out_of_points' };

/** Can this tier still afford ONE capture of `media`, given points already spent? */
export function canCapture(
  tier: VendorPapicTier,
  spent: number,
  media: VendorPapicMedia,
  /** See `allowancePointsFor`. Omitted → today's flat tier number, unchanged. */
  bookingFeePaidPhp: number | null = null,
): CaptureCheck {
  if (media === 'clip' && !allowVideoFor(tier, bookingFeePaidPhp)) {
    return { ok: false, reason: 'video_not_allowed' };
  }
  const cap = allowancePointsFor(tier, bookingFeePaidPhp);
  if (cap == null) return { ok: true }; // unlimited
  const cleanSpent = Math.max(0, Math.floor(Number(spent)) || 0);
  if (cleanSpent + pointsForMedia(media) > cap) {
    return { ok: false, reason: 'out_of_points' };
  }
  return { ok: true };
}

/**
 * The provenance of a vendor's accept on an event — everything needed to derive
 * the interim base (unpaid) tier. Read from vendor_event_unlocks.
 *
 * 🚫 Token signals RETIRED (owner 2026-07-21): tokens_burned / lead_token_holds
 * are no longer part of this — only the non-token founder-comp remains.
 */
export type VendorAcceptProvenance = {
  /** An unlock row exists for (vendor, event) — i.e. the vendor accepted. */
  hasUnlock: boolean;
  /** vendor_event_unlocks.comp_reason === 'founder' (token-free, as-if-paid). */
  founderComp: boolean;
};

/**
 * Derive the BASE tier (before any paid Unli upgrade) from accept provenance.
 * With tokens retired, only a founder-comp accept bumps above the free floor:
 * founder-comp → Ltd; anything else (incl. every ordinary booked accept) → Lite.
 *
 * Fail-safe by construction: with no unlock row the vendor never accepted on
 * this platform → Lite (the floor), never Ltd.
 */
export function baseTierFromProvenance(p: VendorAcceptProvenance): VendorPapicTier {
  if (!p.hasUnlock) return 'lite';
  if (p.founderComp) return 'ltd'; // founder = as-if-paid (non-token perk)
  return 'lite';
}

/** Final tier: a PAID Unli upgrade wins; else the derived base tier. */
export function resolveVendorPapicTier(
  provenance: VendorAcceptProvenance,
  hasPaidUnliUpgrade: boolean,
): VendorPapicTier {
  if (hasPaidUnliUpgrade) return 'unli';
  return baseTierFromProvenance(provenance);
}

/** The readout badge string for the launcher / console (e.g. "Papic Ltd · 70 pts · photos + video"). */
export function tierReadout(
  tier: VendorPapicTier,
  /** What they PAID. Omitted → the bare tier number, which is now only the
   *  floor. See the warning below. */
  bookingFeePaidPhp: number | null = null,
): string {
  // ⚠ THIS IS THE THIRD SURFACE THAT MUST KNOW ABOUT THE FEE, and it is the one
  // a supplier actually READS on their on-the-day page. Left on the bare tier
  // it would say "Papic Lite · 50 pts" to somebody whose real allowance is 800
  // — a screen contradicting the two beside it, with no error anywhere.
  const spec = tierSpec(tier);
  const cap = allowancePointsFor(tier, bookingFeePaidPhp);
  if (cap == null) return `${spec.label} · unlimited`;
  const video = allowVideoFor(tier, bookingFeePaidPhp);
  return video
    ? `${spec.label} · ${cap} pts · photos + video`
    : `${spec.label} · ${cap} photos`;
}
