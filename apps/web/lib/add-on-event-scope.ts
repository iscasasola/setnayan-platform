import { surfaceEnabled, type EventTypeProfile } from '@/lib/event-type-profile';
import { papicGuestPassAccess } from '@/lib/papic-event-access';
import type { AddOnEntry } from '@/lib/add-ons-catalog';

/**
 * add-on-event-scope.ts — IS THIS ADD-ON OFFERED FOR THIS EVENT?
 *
 * The ONE event-type gate for in-app services, extracted 2026-07-31 so the
 * Suite grid and the `/studio/about/<key>` deep-link cannot drift. They already
 * had: Suite ran the two-layer gate, and the About route — the page every "learn
 * more" link in the product points at — ran NOTHING. So
 * `/dashboard/<id>/studio/about/papic-guest` rendered the Papic Pool pitch on a
 * `travel` event, the one type on the permanent V1 deny list. A grid that hides
 * a card does not close the URL behind it.
 *
 * ── WHY THIS IS ITS OWN MODULE AND NOT PART OF add-ons-catalog.ts ────────────
 * Because putting it there broke the production build, and the failure is worth
 * recording. `add-ons-catalog.ts` is imported by CLIENT components, and it had
 * only ever imported `type ProfileSurface` from `event-type-profile` — a
 * TYPE-only import, erased at compile time. Adding `surfaceEnabled` (a VALUE)
 * turned that into a runtime import, which dragged `event-type-profile`'s
 * Supabase server client — and therefore `next/headers` — into every client
 * bundle that touches the catalog:
 *
 *     x You're importing a component that needs "next/headers".
 *       That only works in a Server Component…
 *
 * `tsc --noEmit` was clean and all 5752 unit tests passed. ONLY the production
 * build catches this class, and `npm run build` cannot run on the owner's
 * machine (7 GB heap → OOM), so CI is the sole detector. The same hazard is
 * documented on `lib/papic-tier-config-read.ts`, which is split out of
 * `papic-tier-copy.ts` for exactly this reason.
 *
 * The rule: a module imported by client components may import TYPES from a
 * server module, never VALUES. This file is the server-side half.
 *
 * ── THE GATE ─────────────────────────────────────────────────────────────────
 * TWO layers, and the second is not derivable from the first:
 *   1. The generic SURFACE gate (0053) — an add-on tagged with a `surface`
 *      shows only where the profile enables it.
 *   2. The Papic Pool PREDICATE. `papic-guest` is tagged `surface: 'rsvp'`, but
 *      migration 20270804110223 put `rsvp` on EVERY non-wedding profile row —
 *      all 16 types carry it in prod — so the surface check alone admits the
 *      pool everywhere. `papicGuestPassAccess()` carries the permanent travel
 *      deny, the anniversary controller split and the phase ladder, and it
 *      FAILS CLOSED for a type nobody has scoped.
 *
 * PURE + synchronous: callers pass the already-resolved profile and
 * `events.community_id`, so this adds no I/O to either surface.
 */
export function addOnOfferedForEvent(
  entry: Pick<AddOnEntry, 'key' | 'surface'>,
  profile: EventTypeProfile,
  communityId: string | null = null,
): boolean {
  if (entry.surface && !surfaceEnabled(profile, entry.surface)) return false;
  if (entry.key === 'papic-guest') {
    return papicGuestPassAccess({ profile, communityId }).allowed;
  }
  return true;
}
