/**
 * vendor-servable-event-types.ts — which event types a SUPPLIER may claim to
 * serve. Pure; executed by `vendor-servable-event-types.test.ts`.
 *
 * ── THE DEFECT (owner, 2026-09-23) ────────────────────────────────────────
 * "simple event will not show on the events they serve because simple event
 * does not have a vendor." Measured on prod the same day: `simple_event` is
 * active and enabled, its profile says `marketplace_enabled = FALSE` (the
 * 0053 design: a vendor-free type whose Explore is hidden), and yet every
 * vendor-side picker — the open-shop wizard's "Events you serve", the service
 * card's audience, the coverage editor — listed it, and one shop had already
 * ticked it. A supplier can tick a box that no couple can ever search by.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * The vocab reader is shared with the COUPLE side, where simple_event must
 * stay (it is how couples create one). So the vocab is not narrowed at
 * source; the SUPPLIER readers filter through this function instead, on the
 * COLUMN that already encodes "no vendors" — never on the type's name, so the
 * next vendor-free type needs no code change (the repo's own rule, stated in
 * app/dashboard/[eventId]/vendors/page.tsx).
 *
 * A missing profile row means the column's DEFAULT (TRUE): the 8 non-wedding
 * types shipped before the column existed and are all marketplace types.
 */
import type { EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';

/** `event_type → marketplace_enabled`, as read off `event_type_profiles`. */
export type MarketplaceFlags = ReadonlyMap<string, boolean | null | undefined>;

/** Is this type one a supplier may serve? Only an explicit FALSE says no. */
export function isVendorServable(flags: MarketplaceFlags, eventType: string): boolean {
  return flags.get(eventType) !== false;
}

/** The vocab, minus every type whose profile turns the marketplace off. Order kept. */
export function vendorServableEventTypes(
  vocab: readonly EventTypeRow[],
  flags: MarketplaceFlags,
): EventTypeRow[] {
  return vocab.filter((t) => isVendorServable(flags, t.key));
}
