/**
 * Vendor on-the-day Papic capture — the tier + capture-points model.
 * Owner-locked 2026-07-18 (DECISION_LOG). PURE + unit-testable; every value here
 * is admin-dialable later without a schema change.
 *
 * A vendor's free capture tier for a booked event is EARNED by HOW they accepted
 * the customer inquiry — it is derived, never chosen:
 *   • Accepted by SPENDING a lead token, OR a FOUNDER-comped (token-free) accept
 *     → Papic Ltd (70 capture points, photos + 10-second clips).
 *   • Any other accept (no token) → Papic Lite. Owner 2026-07-22: the FREE
 *     documentation allowance is 50 points, photos + 10-second video (raised from
 *     20 pts / photos-only, matching the couple free-pool grant). ⚠ video is no
 *     longer a paid differentiator — Ltd now only adds +20 pts.
 * Unli (unlimited) stays a latent tier an admin can comp (a grant row with
 * tier='unli'); the vendor-facing +₱50 self-serve upgrade was DROPPED
 * (owner 2026-07-18 — "not allow upgrade +50 if it is difficult"), which removes
 * the whole apply-then-pay / order-reconciliation path.
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
