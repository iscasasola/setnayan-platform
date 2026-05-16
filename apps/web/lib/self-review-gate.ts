import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Decision 1 (CLAUDE.md 2026-05-15) — self-review hard-gate.
 *
 * The DB trigger `block_related_account_review()` raises a check_violation
 * with a message of the form `SELF_REVIEW_BLOCKED: <signal> (appeal via …)`
 * when the reviewer shares any of 5 related-account signals with the vendor's
 * owner. This module parses that message into the structured response shape
 * spec'd in 0006 § "Dual-role customer ↔ vendor — review gate" + 0023 § 3.9.
 */

export const SELF_REVIEW_SIGNALS = [
  'owner_self',
  'team_member',
  'payment_match',
  'device_match',
  'household_match',
] as const;

export type SelfReviewSignal = (typeof SELF_REVIEW_SIGNALS)[number];

export type SelfReviewBlocked = {
  matched_signal: SelfReviewSignal;
  next_action: 'contest_via_help';
};

const SIGNAL_SET = new Set<string>(SELF_REVIEW_SIGNALS);

/**
 * Parse the Postgres error message raised by block_related_account_review().
 * Returns the matched_signal name on a match; null when the error is unrelated.
 *
 * Format expected:
 *   "SELF_REVIEW_BLOCKED: team_member (appeal via 0023 Help inbox)"
 */
export function parseSelfReviewBlock(
  message: string | null | undefined,
): SelfReviewSignal | null {
  if (!message) return null;
  // PostgREST / supabase-js wraps the raw Postgres message; the substring
  // we care about is the prefix written by RAISE EXCEPTION.
  const m = message.match(/SELF_REVIEW_BLOCKED:\s*([a-z_]+)/i);
  if (!m || !m[1]) return null;
  const signal = m[1].toLowerCase();
  if (!SIGNAL_SET.has(signal)) return null;
  return signal as SelfReviewSignal;
}

export function selfReviewBlockedBody(
  signal: SelfReviewSignal,
): SelfReviewBlocked {
  return { matched_signal: signal, next_action: 'contest_via_help' };
}

export const SELF_REVIEW_SIGNAL_LABEL: Record<SelfReviewSignal, string> = {
  owner_self: "You can't review your own services.",
  team_member: "You can't review a vendor you're on the team for.",
  payment_match:
    "We detected a shared payment method between you and this vendor's owner.",
  device_match:
    "We detected a shared device fingerprint between you and this vendor's owner.",
  household_match:
    "We detected a shared address between you and this vendor's owner.",
};

export const SELF_REVIEW_SIGNAL_TONE: Record<SelfReviewSignal, 'hard' | 'soft'> = {
  owner_self: 'hard',
  team_member: 'hard',
  payment_match: 'soft',
  device_match: 'soft',
  household_match: 'soft',
};

/**
 * Read-only probe — returns the signal that *would* block a review, or null
 * when it would succeed. Wraps the `detect_self_review_signal` SECURITY DEFINER
 * SQL function declared in 20260515000000_self_review_gate.sql.
 *
 * Use this to disable the "Leave a review" CTA on the booked-vendor card
 * before the user clicks submit (cheaper than waiting for a 403 round-trip).
 */
export async function detectSelfReviewSignal(
  supabase: SupabaseClient,
  vendorProfileId: string,
  reviewerUserId: string,
): Promise<SelfReviewSignal | null> {
  const { data, error } = await supabase.rpc('detect_self_review_signal', {
    p_vendor_profile_id: vendorProfileId,
    p_reviewer_user_id: reviewerUserId,
  });
  if (error) {
    // Fail open — let the trigger be authoritative if the probe fails.
    return null;
  }
  if (typeof data !== 'string') return null;
  return SIGNAL_SET.has(data) ? (data as SelfReviewSignal) : null;
}
