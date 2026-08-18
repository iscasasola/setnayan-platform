/**
 * THE WAY FROM ONE ROOM TO ANOTHER.
 *
 * ── THE DEFECT, MEASURED 2026-08-17 ─────────────────────────────────────────
 * The Event Hub is thirteen addresses. Before this, **not one of them linked to
 * any other**:
 *
 *   · the bottom bar exists on the EVENT PAGE ONLY — `SiteMenuBar` had exactly
 *     one importer, and none of the eleven sub-rooms mounted it
 *   · seat · find-seat · find-my-table · venue · gifts · recap — their ONLY
 *     outbound link was back to the event page
 *   · welcome · invite · live-wall · print — NO outbound links at all
 *
 * A hub and spoke with no rim. A guest standing in the venue looking at their
 * seat had to go back to the event page and find their way again — and the
 * owner had guessed this was true without checking, then asked for it to be
 * verified before anything was built. It was true, and worse than he put it.
 *
 * ── WHY THIS IS NOT "MOUNT THE BAR IN EVERY ROOM" ───────────────────────────
 * 🚨 THE BAR'S SLOTS ARE IN-PAGE ANCHORS. `resolveSiteNav` returns `#site-home`,
 * `#site-details`, `#site-story` — they scroll the EVENT PAGE. Mounting that bar
 * on `/seat` would produce five taps that do nothing, which is precisely the
 * dead-anchor failure `site-nav.ts` exists to prevent ("a tab that leads
 * nowhere teaches people the bar is unreliable"). A room needs links that LEAVE,
 * so it gets its own resolver rather than a borrowed one.
 *
 * ── THE RULES, INHERITED NOT REINVENTED ─────────────────────────────────────
 * 🔒 **Announce features, hide content.** A room is listed only when it would
 * actually let this visitor in. Nothing is ever drawn greyed: a greyed "Album"
 * would announce that photographs exist and are being withheld, which is the
 * couple's to disclose. Same rule the bar and the doorway cards already obey.
 *
 * 🔒 **A doorway is gated on what the DESTINATION demands.** Every condition
 * below restates the target route's own gate — `/venue` answers "not ready yet"
 * until the floor plan is published, `/pabuya` answers "hasn't set up e-gifts"
 * until a destination is enabled. Linking without those checks would trade an
 * invisible page for a visible dead end, and a guest turned away once stops
 * tapping.
 *
 * ⛔ **The two DOOR screens are deliberately excluded** — `/welcome` (a plus-one
 * confirming their name) and `/invite` (asking to be let in) wear the
 * owner-locked door register: one paper card, ONE terracotta action, the
 * wordmark as the way out. A list of other rooms on those screens would break a
 * design that was settled across thirteen pages, and both are mid-task screens
 * where a side exit is a distraction rather than a service.
 */

export type RoomKey = 'home' | 'seat' | 'venue' | 'gifts' | 'album' | 'hub';

export type RoomLink = {
  key: RoomKey;
  /** Short, one or two words. These sit in a row on a phone. */
  label: string;
  href: string;
};

export type RoomLinksInput = {
  /** The event's own address. Absent → no links; we cannot build one. */
  slug: string | null | undefined;
  /** Which room the visitor is standing in, so it is not offered to itself. */
  current: RoomKey | null;
  /** The visitor's personal invitation token, when they hold one. It makes the
   *  3D room show THEIR seat, exactly as the doorway cards already pass it. */
  guestToken?: string | null;

  /** Does this event TYPE have seating at all? (`event_type_profiles`.) */
  seatingSurfaceEnabled: boolean;
  /** `event_floor_plan.published_at IS NOT NULL` — the seat rooms' own gate. */
  seatingPublished: boolean;
  /** `PABUYA_PUBLIC_ROUTE_ENABLED`. Off ⇒ the route 404s, so never listed. */
  pabuyaRouteEnabled: boolean;
  /** How many e-gift destinations are ENABLED. Zero ⇒ the page is an apology. */
  enabledEgiftCount: number;
  /** May THIS viewer open the money-gift page? The page applies the RAW
   *  visibility column, which is not the effective one the event page uses —
   *  see `resolveGuestDoorways`, which had the same trap. */
  pabuyaViewerAllowed: boolean;
  /** Is the written story published? `/recap` 404s until it is. */
  recapPublished: boolean;
  /** Is the live hub reachable — i.e. is the event running or just finished?
   *  Its entry chip exists only in those windows (owner-settled vocabulary). */
  liveHubOpen: boolean;
};

/**
 * The rooms this visitor can actually reach from where they are standing.
 * Order is fixed and deliberate: where you are → what you need in the room →
 * what you do afterwards. Never re-sorted per viewer; a list that reorders
 * itself is a list nobody learns.
 */
export function resolveRoomLinks(input: RoomLinksInput): RoomLink[] {
  const slug = (input.slug ?? '').trim();
  if (!slug) return [];
  const base = `/${encodeURIComponent(slug)}`;
  const token = (input.guestToken ?? '').trim();

  const all: RoomLink[] = [];

  // The event page itself — always reachable, and the only entry that is not
  // conditional. It is the address the guest was given.
  all.push({ key: 'home', label: 'The invitation', href: base });

  // The seat rooms. `/find-seat` is the FREE public finder, so it is the honest
  // one to offer a visitor who may hold no token; the paid map and the personal
  // pass are reached from it.
  if (input.seatingSurfaceEnabled && input.seatingPublished) {
    all.push({ key: 'seat', label: 'Find your seat', href: `${base}/find-seat` });
  }

  // The 3D walk-through. Both conditions are the RPC's own, restated.
  if (input.seatingSurfaceEnabled && input.seatingPublished) {
    all.push({
      key: 'venue',
      label: 'Walk the room',
      href: token ? `${base}/venue?t=${encodeURIComponent(token)}` : `${base}/venue`,
    });
  }

  // The money gift. Three gates, all the destination's own.
  if (input.pabuyaRouteEnabled && input.enabledEgiftCount > 0 && input.pabuyaViewerAllowed) {
    all.push({ key: 'gifts', label: 'Send a gift', href: `${base}/pabuya` });
  }

  // The live hub — only while the event is running or has just finished.
  if (input.liveHubOpen) {
    all.push({ key: 'hub', label: 'Happening now', href: `${base}/hub` });
  }

  // The story afterwards.
  if (input.recapPublished) {
    all.push({ key: 'album', label: 'The album', href: `${base}/recap` });
  }

  // Never offer a room to itself — that is the one link on the page that is
  // guaranteed to do nothing.
  return all.filter((r) => r.key !== input.current);
}
