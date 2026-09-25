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
 *   Wedding March     before the event, and only with a processional — a
 *                     birthday's guests walk down no aisle
 *   Share the link    before the event (it was "Invite guests"); after it,
 *                     inviting people "is the one door that stops making sense"
 *   Arrange the room  before the event
 *   Check-in          after the event
 *   Share ▾           after the event, when there is a join link — the quick
 *                     copy survives the day, because the link still lets
 *                     guests into the event page afterwards
 *   QR codes (PDF)    always — the free do-it-yourself sheet (owner 09-25)
 *
 * The ONE removal in the move was a duplicate: before the event, "Invite
 * guests" and the Share dropdown both handed out the same join link.
 */

export type RosterDoor =
  | { kind: 'tab'; key: 'roster' | 'walk' | 'share'; label: string; href: string; current: boolean }
  | { kind: 'link'; key: 'arrange' | 'checkin'; label: string; href: string }
  | { kind: 'shareMenu'; key: 'share-menu' }
  /** A FILE, not a page — rendered as a plain `<a download>`, never a Link. */
  | { kind: 'download'; key: 'qr-pdf'; label: string; href: string };

export function rosterDoors({
  eventId,
  view,
  finished,
  hasProcessional,
  hasJoinLink,
}: {
  eventId: string;
  view: 'list' | 'map' | 'walk' | 'share';
  finished: boolean;
  hasProcessional: boolean;
  hasJoinLink: boolean;
}): { tabs: RosterDoor[]; trailing: RosterDoor[] } {
  const base = `/dashboard/${eventId}/guests`;
  // `map` is a way of LOOKING at the roster, not a different task — it keeps
  // the Roster tab lit rather than leaving the row with nothing selected.
  const tabs: RosterDoor[] = [
    // `map` is a way of LOOKING at the roster; walk and share are their own tabs.
    { kind: 'tab', key: 'roster', label: 'Roster', href: base, current: view === 'list' || view === 'map' },
  ];
  if (!finished && hasProcessional) {
    tabs.push({ kind: 'tab', key: 'walk', label: 'Wedding March', href: `${base}?gview=walk`, current: view === 'walk' });
  }
  // ⚖ A REAL TAB NOW (owner 2026-09-21: "pressing buttons inside the guest list
  // should not clear the whole page. only the body."). It was a link to
  // /guests/invite, which measured on the live page removed the whole guest
  // list 185ms after the click. `?gview=share` renders the same invite panel in
  // this page's body, so the header, tabs and meters stay where they are. The
  // /guests/invite page still exists — the sidebar and journey link there.
  if (!finished) {
    tabs.push({ kind: 'tab', key: 'share', label: 'Share the link', href: `${base}?gview=share`, current: view === 'share' });
  }

  const trailing: RosterDoor[] = finished
    ? [{ kind: 'link', key: 'checkin', label: 'Check-in', href: `${base}/checkin` }]
    : [{ kind: 'link', key: 'arrange', label: 'Arrange the room', href: `/dashboard/${eventId}/seating` }];
  if (finished && hasJoinLink) trailing.push({ kind: 'shareMenu', key: 'share-menu' });
  // ⚖ THE FREE DO-IT-YOURSELF QR PDF LIVES HERE (owner 2026-09-25: "the free
  // version is the PDF of QRs if they want to do it themselves" → "found on
  // Guestlist"). Every guest's QR with their name, before AND after the day, for
  // every event, store shell included — a QR is not a purchase. Prints &
  // Tickets (the themed, print-ready set) only points back here.
  trailing.push({
    kind: 'download',
    key: 'qr-pdf',
    label: 'Download QR codes (PDF)',
    href: `/api/hub-print/qr-codes?event=${encodeURIComponent(eventId)}`,
  });

  return { tabs, trailing };
}
