/**
 * Payment-gated lock feature flag.
 *
 * When enabled, locking a vendor prompts the couple to submit the DOWNPAYMENT
 * through the vendor's PUBLISHED payment method with a REQUIRED screenshot,
 * recorded at lock (reverses the "Lock-Free" default — deposit was optional +
 * free-text). The vendor then confirms receipt. Setnayan never holds the money
 * (0% commission, off-platform) — this only changes WHEN/HOW the couple records
 * the deposit, not who is paid.
 *
 * NEXT_PUBLIC_ so the same value is readable on both the client (the lock button
 * decides whether to open the downpayment modal) and the server (the record
 * action is a no-op path otherwise). Off by default — the live lock flow is
 * unchanged until the owner sets NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED=true.
 */
export function isPaymentGatedLockEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
