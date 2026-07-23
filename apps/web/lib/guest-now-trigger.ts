/**
 * NEXT_PUBLIC_GUEST_NOW_TRIGGER — gate for the guest-side run-of-show trigger
 * read (owner directive 2026-07-23: guests' "What's happening now" follows the
 * host/coordinator-set live block instead of the wall clock, and the RSVP-season
 * schedule is labeled "Estimated").
 *
 * Default OFF. Flag exists ONLY because the in-flight 5-tab open-browse hub
 * rebuild re-homes the exact guest panels this feature touches (§ 5.5 PR-3 of
 * the 2026-07-23 build studies) — flip it once the surfaces settle. The
 * host/coordinator WRITE side (advance_schedule_block + the widened delegate
 * gate, migration 20270917100000) is live regardless of this flag.
 *
 * Evaluated server-side only (both /[slug] and /[slug]/hub are server
 * components); the resulting booleans are passed to client components as props
 * so no client-bundle env inlining is involved.
 */
export function isGuestNowTriggerEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_GUEST_NOW_TRIGGER;
  return v === 'true' || v === '1';
}
