/**
 * Vendor on-the-day Papic capture — the tier + capture-points model.
 * Owner-locked 2026-07-18 (DECISION_LOG). PURE + unit-testable; every value here
 * is admin-dialable later without a schema change.
 *
 * A vendor's free capture tier for a booked event is EARNED by HOW they accepted
 * the customer inquiry — it is derived, never chosen:
 *   • Accepted by SPENDING a lead token, OR a FOUNDER-comped (token-free) accept
 *     → Papic Ltd (70 capture points, photos + 5-second clips).
 *   • Any other accept (no token) → Papic Lite (20 points, PHOTOS-ONLY, no video).
 * On top of the free tier, the vendor may pay +₱50 to upgrade ONE booked event to
 * Papic Unli (unlimited). The upgrade is event-bound and non-transferable.
 *
 * Capture-points currency (owner 2026-07-17): 1 photo = 1 pt · 1×5s clip = 3 pts.
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

/** The +₱50 event-scoped upgrade to Unli. Priced in PHP (last-resort fallback;
 *  the live price is admin-managed on the retail catalog like other SKUs). */
export const VENDOR_PAPIC_UNLI_UPGRADE_PHP = 50;

/** orders.service_key marker for the Unli upgrade (its own key — never PAPIC_CAMERAS). */
export const VENDOR_PAPIC_UNLI_UPGRADE_SKU = 'VENDOR_PAPIC_UNLI_UPGRADE';

/** Points a single capture costs. 1 photo = 1 pt · 1×5s clip = 3 pts. */
export const VENDOR_PAPIC_POINTS: Record<VendorPapicMedia, number> = {
  photo: 1,
  clip: 3,
};

export function pointsForMedia(media: VendorPapicMedia): number {
  return VENDOR_PAPIC_POINTS[media];
}

export type VendorPapicTierSpec = {
  tier: VendorPapicTier;
  /** Capture-point budget for the day. null = unlimited (Unli). */
  points: number | null;
  /** Whether 5-second clips are allowed. Lite is PHOTOS-ONLY. */
  allowVideo: boolean;
  /** Short human label for the readout badge. */
  label: string;
};

export const VENDOR_PAPIC_TIERS: Record<VendorPapicTier, VendorPapicTierSpec> = {
  lite: { tier: 'lite', points: 20, allowVideo: false, label: 'Papic Lite' },
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
 * the base (unpaid) tier. Read from vendor_event_unlocks (+ lead_token_holds).
 */
export type VendorAcceptProvenance = {
  /** An unlock row exists for (vendor, event) — i.e. the vendor accepted. */
  hasUnlock: boolean;
  /** vendor_event_unlocks.comp_reason === 'founder' (token-free, as-if-paid). */
  founderComp: boolean;
  /** vendor_event_unlocks.tokens_burned (live burn or a consumed hold back-fills this). */
  tokensBurned: number;
  /** A lead_token_holds row with tokens>0 AND status IN ('held','consumed'). */
  hasActiveHold: boolean;
};

/**
 * Derive the BASE tier (before any paid Unli upgrade) from accept provenance.
 * founder-comp OR a spent/reserved token → Ltd; anything else → Lite.
 *
 * Fail-safe by construction: with no unlock row the vendor never accepted on
 * this platform → Lite (the floor), never Ltd.
 */
export function baseTierFromProvenance(p: VendorAcceptProvenance): VendorPapicTier {
  if (!p.hasUnlock) return 'lite';
  if (p.founderComp) return 'ltd'; // founder = as-if-paid
  if (p.tokensBurned > 0) return 'ltd'; // live burn or a consumed hold
  if (p.hasActiveHold) return 'ltd'; // a reserved (held) token counts as spent
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
