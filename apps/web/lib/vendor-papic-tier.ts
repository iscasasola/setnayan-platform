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
 * 1 photo = 1 pt · 1×10s clip = 7 pts.
 *
 * The base tier (Lite/Ltd) is DERIVED live from vendor_event_unlocks — never
 * stored. Only the paid Unli upgrade is persisted (vendor_papic_capture_grants
 * with tier='unli'). See lib/vendor-papic-grants.ts for the DB reads.
 *
 * Scope: ON-THE-DAY only (the vendor floor console), not a standalone capture
 * feature. Counsel-gated — no capture runs until the DPO/NPC ruling flips the
 * admin Data Privacy control (see lib/vendor-dayof-flags.ts).
 */

export type VendorPapicTier = 'lite' | 'ltd' | 'unli';
export type VendorPapicMedia = 'photo' | 'clip';

/** Points a single capture costs. 1 photo = 1 pt · 1×10s clip = 7 pts
 *  (owner override 2026-07-22 · §0). Mirrors the couple pool's clip weight. */
export const VENDOR_PAPIC_POINTS: Record<VendorPapicMedia, number> = {
  photo: 1,
  clip: 7,
};

export function pointsForMedia(media: VendorPapicMedia): number {
  return VENDOR_PAPIC_POINTS[media];
}

// ── Fee-scaled documentation allowance (owner 2026-07-22) ───────────────────
// The gift floor every booked vendor gets, and the ceiling it scales to as the
// booking fee grows. Papic points = 50 at a ₱0 fee → 200 at a ₱4,000+ fee,
// linear in between ("goes smaller in proportion to the amount they paid for").
export const VENDOR_PAPIC_BASE_GIFT_POINTS = 50;
export const VENDOR_PAPIC_MAX_POINTS = 200;
export const VENDOR_PAPIC_FEE_CEILING_PHP = 4000;

/**
 * Papic documentation points a vendor earns for a booked event, scaled by the
 * booking fee (in PHP) they paid: the 50-pt gift floor at ₱0, rising linearly to
 * 200 pts at the ₱4,000 ceiling and capped there. PURE — the caller supplies the
 * fee once the booking-fee mechanism exists; a missing/0 fee yields the floor,
 * so this is safe to wire before that lands (it just returns the base gift).
 */
export function vendorPapicPointsForBookingFee(bookingFeePhp: number): number {
  const fee = Number.isFinite(bookingFeePhp) ? Math.max(0, bookingFeePhp) : 0;
  const clamped = Math.min(fee, VENDOR_PAPIC_FEE_CEILING_PHP);
  const span = VENDOR_PAPIC_MAX_POINTS - VENDOR_PAPIC_BASE_GIFT_POINTS;
  return Math.round(
    VENDOR_PAPIC_BASE_GIFT_POINTS + span * (clamped / VENDOR_PAPIC_FEE_CEILING_PHP),
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
): CaptureAllowance {
  const spec = tierSpec(tier);
  const cleanSpent = Math.max(0, Math.floor(Number(spent)) || 0);
  const pointsLeft =
    spec.points == null ? null : Math.max(0, spec.points - cleanSpent);
  return {
    tier,
    allowVideo: spec.allowVideo,
    pointsCap: spec.points,
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
): CaptureCheck {
  const spec = tierSpec(tier);
  if (media === 'clip' && !spec.allowVideo) {
    return { ok: false, reason: 'video_not_allowed' };
  }
  if (spec.points == null) return { ok: true }; // unlimited
  const cleanSpent = Math.max(0, Math.floor(Number(spent)) || 0);
  if (cleanSpent + pointsForMedia(media) > spec.points) {
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
export function tierReadout(tier: VendorPapicTier): string {
  const spec = tierSpec(tier);
  if (spec.points == null) return `${spec.label} · unlimited`;
  if (!spec.allowVideo) return `${spec.label} · ${spec.points} photos`;
  return `${spec.label} · ${spec.points} pts · photos + video`;
}
