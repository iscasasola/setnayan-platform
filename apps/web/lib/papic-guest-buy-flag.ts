/**
 * GUEST-BOUGHT PAPIC feature flag (owner-locked 2026-07-29).
 *
 * Gates only the GUEST-FACING SURFACES — the "add more shots" entries on the two
 * capture screens and the account-less order page they lead to. Off ⇒ those
 * surfaces render nothing at all and the capture screens are byte-identical to
 * what ships today.
 *
 * Deliberately NOT gating the schema or the admin queue's handling of a guest
 * order. Both are inert without a surface to mint one (nothing else writes a
 * NULL-user order), and flag-gating a reconciliation path is how an admin ends
 * up unable to approve a row that exists.
 *
 * NEXT_PUBLIC_ so the server pages and the client capture components agree on
 * one value. NEXT_PUBLIC_ vars are BUILD-TIME INLINED into every bundle, so a
 * bare env flip does nothing until a redeploy — which fails safe rather than
 * half-open. Off by default.
 */
export function papicGuestBuyEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PAPIC_GUEST_BUY;
  return v === 'true' || v === '1' || v === 'TRUE';
}
