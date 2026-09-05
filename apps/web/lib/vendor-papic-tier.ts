/**
 * Vendor on-the-day Papic capture — the tier + capture-points model.
 * Owner-locked 2026-07-18 (DECISION_LOG). PURE + unit-testable; every value here
 * is admin-dialable later without a schema change.
 *
 * CURRENT model — owner 2026-09-05 (supersedes 2026-07-22's "points in
 * proportion to what they paid" and 2026-08-26's ₱5/point): a supplier holds
 * CREDITS per event — 5% of the booking fee they paid (cap 1,000, no floor) plus
 * any ₱500/25 packs — written to a ledger on admin payment approval. The rate
 * lives in lib/vendor-papic-credits.ts, the ledger read in
 * lib/vendor-papic-grants.ts; this module is handed the credit total and turns
 * it into an allowance (`allowancePointsFor`), never lower than the tier's own
 * gift. Photos + video, video behind the 800 threshold.
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

// ── The credits a supplier holds for an event (owner 2026-09-05) ──────────────
// 🔁 RETIRED HERE 2026-09-05, owner: *"replace it."* This block used to hold the
// 2026-08-26 fee-scaled rate — `VENDOR_PAPIC_PHP_PER_POINT` (₱5/point),
// `VENDOR_PAPIC_BASE_GIFT_POINTS` (the 50 floor), `VENDOR_PAPIC_MAX_POINTS`
// (the 2,000 ceiling) and `vendorPapicPointsForBookingFee`. The rule that
// replaced it — 5% of the booking fee, cap 1,000, NO floor, plus a ₱500/25
// pack — lives in lib/vendor-papic-credits.ts, and the credits it produces are
// written to a LEDGER (vendor_papic_portfolio_credit_grants) on admin payment
// approval rather than derived live from the fee. This module no longer knows
// the rate at all: it is handed the supplier's credit total and asks only
// "how many shots does that buy, and is video unlocked?"

/**
 * VIDEO UNLOCKS AT 800 — owner 2026-08-26: *"800 credits will allow them to
 * take videos."*
 *
 * 🚨 UNTIL 2026-08-26 `allowVideo` WAS `true` ON EVERY TIER, so `canCapture`'s
 * `video_not_allowed` refusal **could never fire** — a dead branch describing a
 * rule nothing enforced. This is the number that gives it meaning.
 *
 * ⚠ OPEN — owner question, 2026-09-05. *"Replace it"* retired the RATE this
 * threshold was priced against (800 points was a ₱4,000 fee at ₱5/point; at 5%
 * it is a ₱16,000 fee, or 32 packs). The owner has not said whether 800 still
 * stands, moves, or goes. Until he does, the threshold is UNCHANGED and is
 * compared against the same allowance it always was — now fed by the credit
 * ledger instead of the fee. Deliberately neither kept-by-assumption nor
 * dropped-by-assumption: it is in the PR body as a question.
 *
 * ⚠ It is a narrowing relative to the never-reachable state before it (a
 * supplier on the 50-point floor could nominally shoot video and cannot).
 * Safe by arithmetic — production holds **zero** vendor captures and the lane
 * is switched off behind the DPO ruling. Stated rather than buried.
 */
export const VENDOR_PAPIC_VIDEO_MIN_POINTS = 800;

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
 * THE ALLOWANCE A SUPPLIER ACTUALLY HAS, once their CREDITS for the event are
 * known.
 *
 * Owner 2026-09-05: *"vendors get 5% of the amount they paid for on booking
 * fee … they pay 500 pesos for 25 papic credits"* — and, asked what the credits
 * are for: *"base it all from the supplier's shots per event not from what the
 * host gives them."* The credits are summed from the supplier's ledger
 * (`fetchVendorPapicCreditsGranted`) and handed in here. Before 2026-09-05 this
 * argument was the booking fee itself and the rate lived in this file; the
 * rate is retired (*"replace it"*), the shape of the wire is not.
 *
 * 🔑 CREDITS CAN ONLY EVER RAISE, NEVER LOWER. A founder-comped supplier sits
 * on `ltd` (70) having paid nothing; a ledger holding 0 would otherwise hand
 * them 0 and TAKE 70 POINTS AWAY. Nobody may lose an allowance they already had
 * because we connected a wire, so this is a MAX, not a replacement.
 *
 * ⚠ THAT MEANS THE TIER'S OWN NUMBER IS STILL A FLOOR FOR ON-THE-DAY SHOTS.
 * The owner's *"no floor"* (2026-09-05) was said of the 5% FORMULA — a ₱0 fee
 * earns 0 credits — and the ledger honours it exactly. The 50-point Lite gift
 * is an older, separate lock (2026-07-22, *"every booked vendor gets a FREE
 * 50-point documentation allowance"*) that this ruling did not mention. It is
 * kept, not silently dropped, and named in the PR body as a question.
 *
 * 🔑 AN UNREAD LEDGER GRANTS NOTHING. `null` means we could not read the
 * credits — never "they hold none". It falls back to the tier's own number,
 * the mirror of this module's existing posture that a failed spend read fails
 * CLOSED. A metering outage must not mint points.
 *
 * ⛔ Unlimited stays unlimited: `null` points is not a number to compare.
 */
export function allowancePointsFor(
  tier: VendorPapicTier,
  creditsGranted: number | null,
): number | null {
  const base = tierSpec(tier).points;
  if (base == null) return null; // unli — nothing to raise
  if (creditsGranted == null) return base;
  const credits = Math.max(0, Math.floor(Number(creditsGranted)) || 0);
  return Math.max(base, credits);
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
  creditsGranted: number | null,
): boolean {
  if (!tierSpec(tier).allowVideo) return false;
  const cap = allowancePointsFor(tier, creditsGranted);
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
  /** The supplier's Papic credits for this event, summed from the ledger.
   *  null = unread; see `allowancePointsFor`. Omitted → the flat tier number. */
  creditsGranted: number | null = null,
): CaptureAllowance {
  const cap = allowancePointsFor(tier, creditsGranted);
  const cleanSpent = Math.max(0, Math.floor(Number(spent)) || 0);
  const pointsLeft = cap == null ? null : Math.max(0, cap - cleanSpent);
  return {
    tier,
    allowVideo: allowVideoFor(tier, creditsGranted),
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
  /** The supplier's credits for this event. See `allowancePointsFor`. Omitted →
   *  the flat tier number. */
  creditsGranted: number | null = null,
): CaptureCheck {
  if (media === 'clip' && !allowVideoFor(tier, creditsGranted)) {
    return { ok: false, reason: 'video_not_allowed' };
  }
  const cap = allowancePointsFor(tier, creditsGranted);
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
  /** The supplier's credits for this event. Omitted → the bare tier number,
   *  which is only the floor. See the warning below. */
  creditsGranted: number | null = null,
): string {
  // ⚠ THIS IS THE THIRD SURFACE THAT MUST KNOW ABOUT THE CREDITS, and it is the
  // one a supplier actually READS on their on-the-day page. Left on the bare
  // tier it would say "Papic Lite · 50 pts" to somebody whose real allowance is
  // 1,000 — a screen contradicting the two beside it, with no error anywhere.
  const spec = tierSpec(tier);
  const cap = allowancePointsFor(tier, creditsGranted);
  if (cap == null) return `${spec.label} · unlimited`;
  const video = allowVideoFor(tier, creditsGranted);
  return video
    ? `${spec.label} · ${cap} pts · photos + video`
    : `${spec.label} · ${cap} photos`;
}
