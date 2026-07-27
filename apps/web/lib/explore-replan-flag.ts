/**
 * Explore Replan feature flag (Explore_Replan_BUILD_SPEC_2026-07-27.md).
 *
 * Gates every user-visible piece of the Explore/Merkado replan wave (slices
 * A–J: the done-or-add-more toast, "✓ Covered" collapse, Coverage Strip v2,
 * adaptive category set, three-action card, Your-team merge, Plans reframe,
 * compatibility tiers, handshake states, found-you attribution). While OFF,
 * the live takeover renders byte-identically to pre-replan production.
 *
 * NEXT_PUBLIC_ so the same value is readable on both the client (bench/toast
 * UI decides what to render) and the server (the auto-complete writes are a
 * no-op path otherwise) — the same pattern as payment-gated-lock. Off by
 * default — the owner flips it after previewing, never in-code.
 */
export function isExploreReplanEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
