import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The ONE authorised vendor-initiated writer of `vendor_profiles.verification_state`.
 *
 * ── WHY THIS MODULE EXISTS (P0, 2026-07-27) ────────────────────────────────
 * `guard_vendor_profiles_entitlement` (migration 20271004444950, extended by
 * 20271013500000) RAISES `insufficient_privilege` whenever
 * `current_user IN ('authenticated','anon') AND NOT is_admin()` and
 * `verification_state` changes. That guard is CORRECT — a vendor must never be
 * able to hand themselves the public "Verified" badge.
 *
 * But both vendor submit paths flipped the column through the VENDOR'S OWN
 * authenticated client and then never checked the result:
 *
 *     await supabase.from('vendor_profiles').update({ verification_state: … })
 *     //  ^ no `const { error } =` — the refusal was discarded
 *
 * So Postgres refused, the app ignored the refusal, and the vendor was told
 * nothing. `verification_state` never left 'unverified'. Prod corroborates:
 * 0 verified vendors, 0 vendor_tier_history rows, 0 vendor_verifications rows —
 * nobody has ever successfully applied.
 *
 * ── THE MECHANISM ──────────────────────────────────────────────────────────
 * The guard's own HINT names the sanctioned escape hatch: "granted by the admin
 * console or the paid activation path (service_role)". `service_role` never
 * matches `current_user IN ('authenticated','anon')`, so it passes the guard
 * untouched. This module therefore takes a SERVICE-ROLE client and does the
 * authorization in application code — exactly the contract lib/supabase/admin.ts
 * documents ("perform application-level authorization inside the calling code")
 * and the pattern ~a dozen vendor-dashboard actions already follow.
 *
 * Authorization here is belt-and-braces: every statement is pinned to BOTH
 * `vendor_profile_id` AND `user_id`, so even a mis-passed profile id cannot
 * touch another vendor's row.
 *
 * The client is a PARAMETER (the lib/panood-control.ts + live-studio-window-server
 * convention) so the failure paths are unit-testable without module mocking.
 */

export const VENDOR_VERIFICATION_STATES = [
  'unverified',
  'pending_review',
  'verified',
  'demoted',
  'rejected',
] as const;

export type VendorVerificationState = (typeof VENDOR_VERIFICATION_STATES)[number];

/**
 * The states a VENDOR-initiated submit may advance to 'pending_review'.
 *
 * Deliberately excludes the two states where advancing would be wrong:
 *   • 'pending_review' — already there; idempotent no-op, not an error.
 *   • 'verified'       — an `annual_renewal` / re-verification application is
 *     submitted BY a currently-verified shop. Flipping them to 'pending_review'
 *     would strip the public Verified badge and DELIST them from the marketplace
 *     (`vendor_profiles_public_read` requires verification_state = 'verified')
 *     for the whole review window. The application row carries the in-flight
 *     signal; the badge stays until an admin decides otherwise.
 */
export const PENDING_REVIEW_ADVANCEABLE: readonly VendorVerificationState[] = [
  'unverified',
  'demoted',
  'rejected',
];

export type PendingReviewFlip =
  | { ok: true; fromState: VendorVerificationState; changed: boolean }
  | { ok: false; error: string };

function parseState(raw: unknown): VendorVerificationState | null {
  return typeof raw === 'string' &&
    (VENDOR_VERIFICATION_STATES as readonly string[]).includes(raw)
    ? (raw as VendorVerificationState)
    : null;
}

/**
 * Advance the CALLER'S OWN shop to 'pending_review'.
 *
 * @param admin  a SERVICE-ROLE client (`createAdminClient()`). Passing the
 *               vendor's own session client will be refused by the DB guard —
 *               and, unlike before, that refusal is now RETURNED, not swallowed.
 *
 * Returns `{ ok: false, error }` on ANY refusal, including a 0-row update (which
 * is what a silently-blocked write looks like from PostgREST). Callers MUST
 * surface it: a submit button that does nothing is the defect this fixes.
 */
export async function markVendorPendingReview(
  admin: SupabaseClient,
  args: { vendorProfileId: string; userId: string; nowIso: string },
): Promise<PendingReviewFlip> {
  const { vendorProfileId, userId, nowIso } = args;
  if (!vendorProfileId || !userId) {
    return { ok: false, error: 'Missing vendor identity — please sign in again.' };
  }

  const { data: row, error: readErr } = await admin
    .from('vendor_profiles')
    .select('verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) {
    return {
      ok: false,
      error: `Couldn't read your shop's verification status: ${readErr.message}`,
    };
  }
  if (!row) {
    return { ok: false, error: "We couldn't match that shop to your account." };
  }

  const fromState =
    parseState((row as { verification_state?: unknown }).verification_state) ??
    'unverified';

  // Idempotent / badge-preserving no-ops. Reported as success WITHOUT a write.
  if (fromState === 'pending_review' || fromState === 'verified') {
    return { ok: true, fromState, changed: false };
  }
  if (!PENDING_REVIEW_ADVANCEABLE.includes(fromState)) {
    return {
      ok: false,
      error: `Your shop is in the "${fromState}" state and can't start a review from here — please contact support.`,
    };
  }

  const { data: updated, error: updErr } = await admin
    .from('vendor_profiles')
    .update({ verification_state: 'pending_review', updated_at: nowIso })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('user_id', userId)
    .select('vendor_profile_id');
  if (updErr) {
    return {
      ok: false,
      error: `We couldn't start your review: ${updErr.message}`,
    };
  }
  // A 0-row result is the signature of a refused/filtered write. Treating it as
  // success is precisely the bug being fixed, so it is an ERROR here.
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error:
        "We couldn't start your review — the update was refused. Please contact support.",
    };
  }

  return { ok: true, fromState, changed: true };
}

/**
 * Compensating action: put a shop BACK to `toState` after a submit failed
 * partway through (profile flipped, then the application row write failed).
 *
 * Narrow by construction — it only ever moves a row OFF 'pending_review', and
 * only to a state a vendor could legitimately have been in. It can therefore
 * never be repurposed to grant trust.
 */
export async function revertVendorPendingReview(
  admin: SupabaseClient,
  args: {
    vendorProfileId: string;
    userId: string;
    toState: VendorVerificationState;
    nowIso: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { vendorProfileId, userId, toState, nowIso } = args;
  if (!PENDING_REVIEW_ADVANCEABLE.includes(toState)) {
    return { ok: false, error: `Refusing to revert to "${toState}".` };
  }
  const { error } = await admin
    .from('vendor_profiles')
    .update({ verification_state: toState, updated_at: nowIso })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('user_id', userId)
    .eq('verification_state', 'pending_review');
  return error ? { ok: false, error: error.message } : { ok: true };
}
