/**
 * studio-rail.ts — the seven Studio rows, built from the one source.
 *
 * PURE. No session, no I/O, no `server-only` — which is the point: the rules
 * below are the ones most worth testing (which row offers a demo, where a
 * signed-in row goes, which rows are dropped for an event type), and behind the
 * server-only boundary a plain node test cannot even import them.
 *
 * The data is `lib/studio-apps.ts`. The server half — resolving WHICH event —
 * stays in `app/_components/frontdoor/rail-data.ts`, which re-exports these.
 */
import { addOnHref } from './add-ons-catalog';
import { STUDIO_HUB_ALL_LABEL, studioHubHref } from './studio-hub';
import type { EventTypeProfile } from './event-type-profile';
import { addOnOfferedForEvent } from './add-on-event-scope';
import { STUDIO_APPS } from './studio-apps';

import type { RailTool } from '@/app/_components/frontdoor/front-door-shell';

/**
 * The signed-out rail: every product, its own line, and a demo where one
 * exists.
 *
 * ⚠ `demo` IS A MARKER, NOT AN OPENER (owner 2026-08-15: *"we still want a
 * feature description instead of directly just going to the demo"*). The row
 * navigates to the product's page; the demo button lives there. So there is no
 * host to gate on and no flag: the marker simply says which products are
 * try-able, and `studio-apps.test.ts` pins it to a page that really offers one.
 */
export function railToolsSignedOut(): ReadonlyArray<RailTool> {
  return STUDIO_APPS.map((a) => ({
    key: a.key,
    href: a.href,
    name: a.name,
    line: a.railLine,
    demo: a.demo?.id,
  }));
}

/**
 * The signed-in rail: the same seven rows, pointed at the person's own tools.
 *
 * 🔴 THE EVENT IS RESOLVED HONESTLY, NEVER GUESSED.
 *   exactly one organiser event → straight into the tool for that event
 *   two or more                 → `/dashboard`, the board that IS the picker.
 *                                 Guessing `events[0]` would open somebody's
 *                                 OTHER wedding, and a door that opens onto the
 *                                 wrong thing is worse than one that asks.
 *   none                        → the public page is still the right answer.
 *                                 There is nothing to open yet, and the page
 *                                 that explains the product is what a person
 *                                 without an event actually needs.
 *
 * 🔴 AND A ROW IS DROPPED WHEN ITS SURFACE IS OFF FOR THAT EVENT TYPE. `monogram`
 * is WEDDING-ONLY and `/dashboard/[id]/monogram` `redirect()`s away with no
 * message — so a birthday organiser pressing "Logo Maker" would be silently dumped
 * on their event page, strictly worse than the marketing page it replaced.
 *
 * 🔴 THROUGH `addOnOfferedForEvent`, NOT A RE-DERIVED CHECK (S1, owner
 * 2026-09-01). This used to call `surfaceEnabled(profile, a.surface)` directly
 * — the SAME rule the Suite grid's `surfaceOk` applies via
 * `addOnOfferedForEvent`, but a second hand-written copy of it, which is
 * exactly the shape that let the sidebar drift from the Suite grid before (see
 * `add-on-event-scope.ts`'s own docblock — Suite ran the gate, the About route
 * ran nothing, and the sidebar ran nothing either). Calling the one function
 * both surfaces call means a future second layer on that predicate (like the
 * papic-guest phase ladder, or the panood/live-studio-roam de-dupe) reaches the
 * sidebar automatically instead of needing a matching edit here.
 *
 * `communityId` is passed as `null`: it only changes the answer for
 * `entry.key === 'papic-guest'`, and no `StudioApp.addOnKey` is that key today
 * (the sidebar's Papic row opens `papic`, the couple's own setup page — the
 * Papic Pool GUEST PASS predicate lives on a different catalogue entry this
 * rail never renders). If that ever changes, thread the event's real
 * `community_id` through here the way `suite/page.tsx` does.
 */
export function railToolsSignedIn(
  studio: { eventId: string | null; count: number; profile: EventTypeProfile | null },
): ReadonlyArray<RailTool> {
  const { eventId, count, profile } = studio;
  const rows: RailTool[] = STUDIO_APPS.filter((a) => {
    /*
      ⛔ DO NOT DROP A PRODUCT ROW HERE TO DE-DUPE THE RAIL. Tried 2026-09-02
      and reverted: `studio-menu-adapts-to-event.test.ts` reads THIS function as
      the sidebar's half of an owner-ruled parity — "sidebar and Suite agree",
      with exact row counts (wedding 9 · ceremonial 8 · simple_event 7 ·
      date/hangout/travel 5). Removing a row here breaks that ruling for a
      problem that does not live here: two rows opening ONE page is a MATCHING
      question, and it is settled where the match list is built
      (`front-door-shell.tsx`), leaving every rendered row intact.
    */
    // Nothing is gated until we know WHICH event — the surface list is a
    // property of the event type, and without one there is nothing to ask.
    if (!eventId || !profile) return true;
    return addOnOfferedForEvent({ key: a.key, surface: a.surface }, profile, null);
  }).map((a) => {
    /*
      THE THREE CASES, EXPLICIT. An earlier cut collapsed the last two into
      `a.href` and silently dropped the picker: somebody with two weddings got
      the marketing page for a product they own, which is the exact complaint
      this change exists to fix.
    */
    let href: string;
    if (eventId && a.addOnKey) {
      href = addOnHref(a.addOnKey, eventId); // exactly one event
    } else if (count > 1) {
      href = '/dashboard'; // several — the board IS the picker; never guess
    } else {
      href = a.href; // none, or a product with no in-app home
    }
    return {
      key: a.key,
      href,
      name: a.name,
      // See the `line` note on RailTool: signed in, silence beats selling.
      line: null,
    };
  });

  /*
    ─── AND ONE ROW FOR EVERYTHING ELSE ─────────────────────────────────────
    Owner, 2026-08-21, looking at the rail before and after opening a wedding:
    *"we lose the consistency of the concept … what we want is for that Studio
    to still show on the sidebar, but now it is link to that event."*

    The named products are the Studio group. But a wedding's shelf holds more
    than the products — the free parts (the seat plan, the mood board, the
    day-of page), the upgrades, the order history. Those have always lived on
    the services hub, and the hub is what the event's own menu used to carry.

    🔑 IT IS CALLED "All services", NOT "Studio". Inside an event this row sits
    directly under a group heading that already says Studio, and the same word
    twice in one rail reads as two different places — the exact trap the
    Marketplace row's own note in the shell records. The event menu's Studio
    row is dropped from the rail for the same reason (see `EventRailContext`);
    the phone's bottom bar, which carries no Studio group, keeps it untouched.

    🔑 AND ONLY WHEN THERE IS AN EVENT TO OPEN. With none, or with several and
    no way to know which was meant, there is no single shelf to point at — the
    rows above already answer that case honestly and this one must not invent
    a different answer.
  */
  if (!eventId) return rows;
  return [
    ...rows,
    { key: '__all__', href: studioHubHref(eventId), name: STUDIO_HUB_ALL_LABEL, line: null },
  ];
}

/**
 * ⚠ KEPT AS THE PUBLIC SHAPE THE DOORWAY GUARD READS. `doorway-invariants`
 * asserts the seven hrefs; deriving it from the one source means a product can
 * never be renamed in the rail without its page moving too.
 */
export const RAIL_TOOLS: ReadonlyArray<RailTool> = railToolsSignedOut();
