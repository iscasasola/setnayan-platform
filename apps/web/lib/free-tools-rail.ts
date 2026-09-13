/**
 * free-tools-rail.ts — Planner / Builder / Together, the three rail groups
 * that sit above Studio for a signed-in person.
 *
 * PURE, like `studio-rail.ts` beside it. No session, no I/O, no `server-only`.
 *
 * ─── WHY THIS FILE IS SMALL ───────────────────────────────────────────────
 * The original brief for Planner/Builder listed five items each (Guest List,
 * Seat Plan, Mood Board, Schedule, Budget / Marketplace, Compare, Vendor
 * ledger, Contracts) — copied from a design prototype that was never checked
 * against the event's own rail menu. It turns out four of those five Planner
 * items, and the Marketplace half of Builder, are ALREADY real, working,
 * active-highlighted rows in `EventRailContext` (via `customer-nav-config.ts`
 * — Guests, Marketplace→`/vendors`, Schedule, Seat plan, Budget). Adding a
 * second copy under a new heading would be the exact "same destination, two
 * names" defect `event-rail-context.tsx`'s own docblock warns against — the
 * Studio/Suite rail once shipped precisely this duplicate and had to be
 * corrected. "Vendor ledger" turned out to be the same trap one level
 * deeper: `/vendors` already carries `deposit_paid_php` per vendor, so a
 * separate ledger card would point at payment data Marketplace + Budget
 * already surface.
 *
 * What's left, verified against `customer-nav-config.ts`'s full key list
 * (launch/home/guests/explore/studio/personalization/hosts/refer/schedule/
 * seat/budget/editorial/galleries — no mood-board, compare, or contracts key
 * anywhere in it), is genuinely missing:
 *   Planner: Mood Board only (it lives inside Studio → Branding, not the
 *            event's own top-level menu).
 *   Builder: Compare, Contracts — neither exists in the event menu or
 *            anywhere else in the rail today.
 *   Together: unaffected by this — Samahan and chat are not event-menu
 *            concepts at all (Samahan is account-level; the event menu has
 *            no messages/chat row).
 */
import type { RailTool } from '@/app/_components/frontdoor/front-door-shell';

/**
 * Planner — shown ONLY inside a specific event (same `insideEvent` gate the
 * shell already applies to Marketplace/Browse-by-category), because a
 * `eventId` is required to build a real href and there is exactly one
 * genuine gap to fill.
 */
export function plannerRailItems(_eventId: string): ReadonlyArray<RailTool> {
  /*
    🔴 EMPTY SINCE 2026-09-06, AND THE ROW IT HELD WAS A DUPLICATE.

    This returned a Mood Board row, on the reasoning recorded above: the board
    *"lives inside Studio → Branding, not the event's own top-level menu"*. That
    was TRUE WHEN IT WAS WRITTEN and stopped being true on 2026-09-03, when the
    owner promoted the Mood Board into the Studio rail group (*"i do not see
    it"*). From that day the in-event rail carried **Mood Board → the same
    href** twice: once in Studio, once here. Nobody noticed for three days.

    🔑 FOUND BY ASKING THE RAIL, NOT BY READING IT — every in-event row from all
    four groups was listed and grouped by destination, and this was the only
    undocumented collision. (The two Together pairs that share a destination are
    deliberate and `front-door-shell.tsx` says so.)

    ⚠ THE STUDIO ROW IS THE ONE THAT STAYS. Its placement is the owner's own
    2026-09-03 ruling, made because he could not find the board when it lived
    anywhere else. Removing THIS one keeps both rulings intact.

    ⚠ AND THE GROUP IS NOT DEAD. `plannerDoorwayRows` in `lib/studio-rail.ts`
    fills Planner OUTSIDE an event with the five free planning tools' doorways.
    Inside one, Planner is now genuinely empty — the event's own rail carries
    every tool it would have listed — and an empty array renders no group at
    all, which is the correct answer rather than a heading over nothing.

    Kept as a function, with its argument, so a future in-event Planner row has
    an obvious home and this reasoning is the first thing its author reads.
  */
  return [];
}

/**
 * Builder — same `insideEvent` gate as Planner. Compare is a marketplace
 * tool, not an event record, but it's kept inside-event for now to match
 * the owner's stated scope ("Planner and Builder only show on the event").
 */
export function builderRailItems(eventId: string): ReadonlyArray<RailTool> {
  return [
    {
      key: 'builder-compare',
      href: '/explore/compare',
      name: 'Compare',
      line: 'Shortlist suppliers side by side.',
    },
    {
      key: 'builder-contracts',
      href: `/dashboard/${eventId}/contracts`,
      name: 'Contracts',
      line: 'Every signed thing, kept.',
    },
  ];
}

/**
 * Together — NOT gated by `insideEvent`. Samahan is account-level (confirmed:
 * `app/dashboard/(account)/samahan/` is keyed on the user, never nested under
 * `[eventId]`), so it belongs in every signed-in state, not just inside one
 * event.
 *
 * Vendor chat / Event chat ARE event-scoped pages — a thread lives at
 * `/dashboard/{eventId}/messages`. `eventId` here is whatever the caller
 * already has honestly resolved (the front door's `resolveRailStudioEvent()`
 * result, or the real `studioEventId` `AppRailShell` already carries inside
 * an event) — never guessed. With none, both fall back to `/dashboard`, the
 * board a person can always reach and pick from.
 */
export function togetherRailItems(
  eventId: string | null,
): ReadonlyArray<RailTool> {
  const messagesHref = eventId ? `/dashboard/${eventId}/messages` : '/dashboard';
  return [
    {
      key: 'together-samahan',
      href: '/dashboard/samahan',
      name: 'Samahan groups',
      line: 'Your barkada, ninongs, family — organized.',
    },
    {
      key: 'together-samahan-stories',
      href: '/dashboard/samahan',
      name: 'Samahan Stories',
      line: 'Clips that live for 24 hours, inside your group.',
    },
    {
      key: 'together-vendor-chat',
      href: messagesHref,
      name: 'Vendor chat',
      line: 'Talk to your booked suppliers here.',
    },
    {
      key: 'together-event-chat',
      href: messagesHref,
      name: 'Event chat',
      line: 'One thread for the whole entourage.',
    },
  ];
}
