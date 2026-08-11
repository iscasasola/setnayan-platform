import { surfaceEnabled, type EventTypeProfile } from '@/lib/event-type-profile';
import { papicGuestPassAccess } from '@/lib/papic-event-access';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import type { AddOnEntry } from '@/lib/add-ons-catalog';

/**
 * add-on-event-scope.ts — IS THIS ADD-ON OFFERED FOR THIS EVENT?
 *
 * The ONE event-type gate for in-app services, extracted 2026-07-31 so the
 * Suite grid and the `/studio/about/<key>` deep-link cannot drift. They already
 * had: Suite ran the two-layer gate, and the About route — the page every "learn
 * more" link in the product points at — ran NOTHING. So
 * `/dashboard/<id>/studio/about/papic-guest` rendered the Papic Pool pitch on
 * event types the grid was hiding. A grid that hides a card does not close the
 * URL behind it. (The example that motivated this was `travel`, then on a deny
 * list. Since 2026-08-01 NO live type is out of scope — the owner ruled "offer
 * Papic everywhere" — so this split currently gates nothing but a
 * newer-than-the-ruling event type. Keep both surfaces on the shared predicate
 * anyway: the drift is what bites, and it bit before the scope narrowed.)
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
 *      pool everywhere. `papicGuestPassAccess()` carries the phase ladder and
 *      FAILS CLOSED for a type nobody has scoped.
 *
 *      ⚠ Since the owner's 2026-08-01 "offer Papic everywhere" ruling, layer 2
 *      denies NO live type: all 16 are Phase 1, and the anniversary controller
 *      split is gone. It still earns its keep for the SEVENTEENTH type — one
 *      created from /admin/event-types needs no code change and must not
 *      inherit a guest-camera pass by default.
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
  // ⚠ ONE LIVESTREAM TILE, NOT TWO — and it has to live HERE.
  // The retired "Live Studio Cast" tile chips "Free" and lands on the same
  // ₱2,999 page as the unified Live Studio tile, because /studio/panood is now a
  // redirect. PR #4354 filtered it in the Studio hub's own surfaceOk — WHICH
  // NEVER RUNS: `studio/page.tsx` redirects to /suite on its 11th line, and its
  // own comment says Suite being off "never [happens] in prod". So the fix was
  // real, in dead code, and the couple still saw both tiles. This is the gate
  // the Suite actually calls.
  // 🔑 A FIX IN A FILE NOBODY EXECUTES IS NOT A FIX — reachability first.
  // Flag OFF: the unified tile is not appended to ADD_ONS at all, /studio/panood
  // forwards to the free single-camera setup, and this Cast tile is the only
  // livestream doorway there is — so it must stay. The free single-cam
  // livestream is never hidden by this: with the flag ON its doorway is the
  // unified tile, which opens the same setup.
  if (entry.key === 'panood') return !liveStudioRoamEnabled();
  return true;
}
