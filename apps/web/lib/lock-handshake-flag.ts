/**
 * Lock-handshake feature flag (PR_H_Lock_Request_Handshake_BUILD_SPEC_2026-08-04.md;
 * owner ruling 2026-07-27, and the funnel locked in
 * 03_Strategy/Service_Schedule_and_Quotation_Flow_2026-06-02.md).
 *
 * Gates the step the product has always promised and never performed: a couple
 * pressing **Lock** ASKS the supplier, and the supplier's yes is what makes the
 * booking. Steps 1, 3, 4 and 5 of that handshake ship; step 2 did not exist —
 * `finalizeVendor` wrote `status='contracted'` outright and the supplier was
 * TOLD afterwards ("You have a new confirmed booking").
 *
 * While OFF every surface behaves byte-identically to today: the couple's Lock
 * books the supplier, no `lock_*` column is written, and the vendor's Overview
 * shows no request card. The DB objects added by 20271143289546 are live in both
 * states — a migration cannot read a `NEXT_PUBLIC_` env var — but none of them
 * can fire without a caller, and there are no callers while this is off.
 *
 * ⚠ THE FLAG DOES NOT GATE THE SWEEP. `lib/lock-request-expiry.ts` runs in both
 * states on purpose: closing a stale request is safe either way, and a sweep
 * that checked the flag would strand every in-flight request the moment the flag
 * went back off — the pending indexes are DB objects and keep holding their slot
 * whatever the app believes.
 *
 * NEXT_PUBLIC_ so the same value is readable on the server (which decides
 * whether Lock asks or books) and the client (which decides whether the toast
 * says "Sent!" or congratulates). Off by default; the owner flips it after
 * previewing, never in-code.
 */
export function isLockHandshakeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
