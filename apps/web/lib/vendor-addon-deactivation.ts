/**
 * vendor-addon-deactivation.ts — the PURE decision for reversing a paid vendor
 * add-on entitlement window (Vendor AI · 3D Booth) when its funding order is
 * REJECTED or REFUNDED.
 *
 * WHY: the add-on activation hooks stamp a 28-day window on
 * vendor_profiles.{ai,booth}_addon_expires_at. Like SETNAYAN_AI's stored flag,
 * that window is a one-way latch — nothing cleared it on a reversal, so a refund
 * left the paid add-on live ("refund the money, keep the feature"). This encodes
 * the safe reversal: expire the window ONLY when the reversed order is the one
 * that owns the CURRENT window; never clobber a later-stacked cycle.
 *
 * PURE (no I/O, no clock unless passed) so the sku-activation deactivation hook
 * stays unit-testable under `tsx --test`. Mirrors the shape of the pricing libs.
 */

/**
 * The new entitlement-window expiry after reversing ONE order's grant.
 *
 *   • currentExpiry        — vendor_profiles.{ai,booth}_addon_expires_at now.
 *   • orderStampedExpiry   — the window THIS order stamped (from its
 *                            'service_activated' ledger metadata); null if the
 *                            grant can't be attributed to this order.
 *
 * Returns:
 *   • an ISO "now" string — expire the window immediately — ONLY when the reversed
 *     order's stamp EXACTLY equals the current window (this order owns it, no
 *     later cycle stacked on top).
 *   • `currentExpiry` unchanged — a no-op — in every other case: nothing active,
 *     an unattributable grant, or a later cycle has since extended the window
 *     (currentExpiry !== the stamp) so a different paid order owns it.
 *
 * Setting expiry to "now" makes isVendor{Ai,3dBooth}Active (now < expiry) read
 * false immediately — the feature re-locks, matching how orders-backed gates
 * re-lock for free on reversal.
 */
export function resolveAddonDeactivationExpiry(
  currentExpiry: string | null | undefined,
  orderStampedExpiry: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  const current = currentExpiry ?? null;
  if (!current) return current; // nothing active → nothing to reverse
  if (!orderStampedExpiry) return current; // unknown grant → never clobber
  if (current !== orderStampedExpiry) return current; // a later cycle owns it → keep
  return new Date(nowMs).toISOString(); // this order owns the live window → expire now
}
