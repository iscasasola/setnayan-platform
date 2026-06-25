/**
 * Pure helpers for interpreting the `finalize_guest_claim` RPC result
 * (supabase/migrations/20261102000000_guest_invite_claim.sql). Kept dependency-
 * free (no 'server-only') so the concurrency logic in approveClaimAction is
 * unit-testable.
 *
 * The RPC returns one of:
 *   { linked:true,  already:false, guest_id }          → it bound OUR guest (success)
 *   { linked:true,  already:true,  reason:'already_confirmed' } → a concurrent
 *        approve already finalized this claim; OUR guest was NOT used
 *   { linked:false, reason:'…' }                       → it declined to bind
 */
export type FinalizeClaimResult =
  | { linked?: boolean; already?: boolean; reason?: string; guest_id?: string }
  | null
  | undefined;

/**
 * True when a guest row we minted during claim approval is an ORPHAN — i.e.
 * `finalize_guest_claim` did NOT bind it, so it must be cleaned up.
 *
 * - `already === true`  → a racing approve finalized the claim first; our fresh
 *   guest is unused → orphan.
 * - `linked !== true`   → finalize declined (claim vanished / mismatch) → orphan.
 * - a null/undefined result is AMBIGUOUS (RPC error — the bind may or may not
 *   have committed); we deliberately return false there so we never delete a
 *   possibly-bound guest. A cosmetic orphan is strictly better than data loss.
 */
export function newGuestIsOrphaned(result: FinalizeClaimResult): boolean {
  if (!result) return false; // ambiguous → keep (never risk deleting a bound guest)
  return result.already === true || result.linked !== true;
}
