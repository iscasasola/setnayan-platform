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
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';
import { STUDIO_APPS } from './studio-apps';

import type { RailTool } from '@/app/_components/frontdoor/front-door-shell';

/**
 * The signed-out rail: every product, its own line, and a demo where one
 * exists.
 *
 * ⚠ `withDemos` IS FALSE UNLESS AN OVERLAY HOST IS MOUNTED ON THIS ROUTE.
 * `HomeOverlays` renders from `SiteChrome`, which self-gates to `NAV_ROUTES` —
 * and `/` is deliberately NOT one. Passing a `demo` where nothing can open it
 * would put a fake door in front of every stranger who lands on the front page.
 * The front door mounts its own host and passes true; anything else passes
 * false and the rows stay plain links.
 */
export function railToolsSignedOut(withDemos: boolean): ReadonlyArray<RailTool> {
  return STUDIO_APPS.map((a) => ({
    key: a.key,
    href: a.href,
    name: a.name,
    line: a.railLine,
    demo: withDemos ? a.demo : undefined,
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
 * message — so a birthday organiser pressing "Palogo" would be silently dumped
 * on their event page, strictly worse than the marketing page it replaced. The
 * couple's own Studio hub filters on exactly this field; this is the same
 * predicate, not a second one.
 */
export function railToolsSignedIn(
  studio: { eventId: string | null; count: number; profile: EventTypeProfile | null },
): ReadonlyArray<RailTool> {
  const { eventId, count, profile } = studio;
  return STUDIO_APPS.filter((a) => {
    // Nothing is gated until we know WHICH event — the surface list is a
    // property of the event type, and without one there is nothing to ask.
    if (!eventId || !profile) return true;
    return !a.surface || surfaceEnabled(profile, a.surface);
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
}

/**
 * ⚠ KEPT AS THE PUBLIC SHAPE THE DOORWAY GUARD READS. `doorway-invariants`
 * asserts the seven hrefs; deriving it from the one source means a product can
 * never be renamed in the rail without its page moving too.
 */
export const RAIL_TOOLS: ReadonlyArray<RailTool> = railToolsSignedOut(false);
