/**
 * E-gifts (Pabuya) — feature flag.
 *
 * `egiftEnabled()` defaults OFF. E-gifts are QR-DISPLAY ONLY (owner-clarified
 * 2026-07-13: "we do not offer transaction on e-gifts; they just share their own
 * QR codes"). A user stores their OWN receive-QR (GCash/Maya/bank) and the
 * platform only DISPLAYS it — a giver scans it with their own app and the money
 * goes straight to the user's account. Setnayan never touches funds, reads no
 * transaction, and keeps no ledger. So this is an asset-display surface, not a
 * payments one.
 *
 * Kept behind a flag (default OFF) because it is money-adjacent and the display
 * surface for givers (event/day-of Pabuya) is still being placed. Flip with
 * NEXT_PUBLIC_EGIFT=1 once the owner confirms placement. Mirrors the other
 * default-OFF gates (dependentPeopleEnabled, personLifeStoriesEnabled).
 */
export function egiftEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EGIFT === '1';
}
