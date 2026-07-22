/**
 * Feature flag — Coordinator P1 "prep-then-release" schedule visibility.
 *
 * When ON, a coordinator (event_moderators wedding_planner_external with
 * schedule 'edit') can stage schedule blocks as `coordinator_only` (hidden
 * from the couple, guests, and booked vendors) and later RELEASE them to the
 * couple. When OFF (default), no block is ever staged — the visibility column
 * defaults to `couple_visible`, so the tightened read policies + the guest-read
 * filter are inert, and behavior is byte-identical to today.
 *
 * DPO-gated: prep-then-release widens the coordinator's private working set
 * over the couple's planning surface — ships flag-OFF until the same
 * counsel packet that clears the consent gate signs off (spec § 4 / § 6.4).
 *
 * Read on both server (schedule reads/actions) and client (schedule UI), so it
 * must be a NEXT_PUBLIC_ variable. Mirrors lib/coordinator-consent-gate.ts.
 */
export function isCoordinatorPrepReleaseEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_COORDINATOR_PREP_RELEASE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
