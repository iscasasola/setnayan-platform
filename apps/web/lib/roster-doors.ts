/**
 * roster-doors.ts — which doors the guest list offers, and when.
 *
 * PURE, so it can be executed. The tab row (`roster-tabs.tsx`) renders from
 * this list and decides nothing itself.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * When the masthead's buttons became one row of tabs (owner 2026-09-20), the
 * full test suite and all 32 CI guards stayed green — and that turned out to
 * be because NOTHING was watching. Every test near these doors checks the
 * DESTINATION page; none checks that the guest list still has a way in. So
 * "Arrange the room" could have been dropped outright and the whole suite
 * would have passed. It has happened here before: the desktop guest page once
 * had no door to the seating editor at all, and a comment in page.tsx still
 * records it.
 *
 * ── THE RULES, EACH MOVED WITH ITS REASON ──────────────────────────────────
 *   Roster            always
 *   (Wedding March    moved to the Maker's Details, owner 2026-09-29)
 *   Share the link    before the event (it was "Invite guests"); after it,
 *                     inviting people "is the one door that stops making sense"
 *   (Arrange the room left on 2026-09-29 — owner, DECISION_LOG "THE GUEST
 *   LIST KEEPS PEOPLE…": its home is the Maker's Details › Your event › Seat
 *   plan, in the three parts; `/seating` lands there for the couple.)
 *   Check-in          after the event
 *   Share ▾           after the event, when there is a join link — the quick
 *                     copy survives the day, because the link still lets
 *                     guests into the event page afterwards
 *   (QR codes (PDF) left on 2026-09-29 — owner, DECISION_LOG "THE GUEST LIST
 *   KEEPS PEOPLE…": its home is the Maker's Details › For the day › Guest QR
 *   codes, the same free sheet from the same route.)
 *
 * The ONE removal in the move was a duplicate: before the event, "Invite
 * guests" and the Share dropdown both handed out the same join link.
 */

export type RosterDoor =
  | { kind: 'tab'; key: 'roster' | 'share'; label: string; href: string; current: boolean }
  | { kind: 'link'; key: 'checkin'; label: string; href: string }
  | { kind: 'shareMenu'; key: 'share-menu' };

export function rosterDoors({
  eventId,
  view,
  finished,
  hasJoinLink,
}: {
  eventId: string;
  view: 'list' | 'map' | 'share';
  finished: boolean;
  hasJoinLink: boolean;
}): { tabs: RosterDoor[]; trailing: RosterDoor[] } {
  const base = `/dashboard/${eventId}/guests`;
  // `map` is a way of LOOKING at the roster, not a different task — it keeps
  // the Roster tab lit rather than leaving the row with nothing selected.
  const tabs: RosterDoor[] = [
    // `map` is a way of LOOKING at the roster; share is its own tab.
    { kind: 'tab', key: 'roster', label: 'Roster', href: base, current: view === 'list' || view === 'map' },
  ];
  // ⚖ NO WEDDING MARCH TAB (owner 2026-09-29, DECISION_LOG "THE GUEST LIST
  // KEEPS PEOPLE…"): its home is the Maker — Details › Your event › the march,
  // in the three parts. An old `?gview=walk` link lands there (`page.tsx`). The
  // order data (`guests.entourage_order`, `events.entourage_section_order`) is
  // untouched.
  // ⚖ A REAL TAB NOW (owner 2026-09-21: "pressing buttons inside the guest list
  // should not clear the whole page. only the body."). It was a link to
  // /guests/invite, which measured on the live page removed the whole guest
  // list 185ms after the click. `?gview=share` renders the same invite panel in
  // this page's body, so the header, tabs and meters stay where they are. The
  // /guests/invite page still exists — the sidebar and journey link there.
  if (!finished) {
    /* ⚙ SETUP (owner 2026-10-07, DECISION_LOG "GUESTS › SETUP"): the third segment
       is the guest settings the Maker reads (`invite-panel.tsx`); same `?gview=share`. */
    tabs.push({ kind: 'tab', key: 'share', label: 'Setup', href: `${base}?gview=share`, current: view === 'share' });
  }

  // ⚖ NO "ARRANGE THE ROOM" (owner 2026-09-29, DECISION_LOG "THE GUEST LIST
  // KEEPS PEOPLE…"): the seat plan's home is the Maker — Details › Your event ›
  // Seat plan. The Guest list keeps people; arranging the room is not one of
  // its doors any more (the seat plan still reaches every guest's name).
  const trailing: RosterDoor[] = finished
    ? // ⚖ F2 (owner 2026-09-30): arrivals are the Check-in COLUMN of this list
      // now, and the parts row is gone. This door is the door crew's scanner —
      // the standalone desk, the day-of menu row's own destination.
      [{ kind: 'link', key: 'checkin', label: 'Scan tickets', href: `${base}/checkin` }]
    : [];
  if (finished && hasJoinLink) trailing.push({ kind: 'shareMenu', key: 'share-menu' });
  // The free do-it-yourself QR sheet is NOT here any more (owner 2026-09-29,
  // DECISION_LOG "THE GUEST LIST KEEPS PEOPLE…"): the Guest list keeps people;
  // every print — this sheet included — lives in the Maker's Details, For the
  // day › Guest QR codes (`lib/free-prints.ts`, the same route).

  return { tabs, trailing };
}
