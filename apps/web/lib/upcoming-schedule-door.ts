/**
 * WHERE AN "UPCOMING SCHEDULES" ROW GOES — the decision, with no I/O in it.
 *
 * ── THE REPORT THAT MADE THIS FILE (owner, 2026-09-20) ──────────────────────
 * On /vendor-dashboard (the Today page), supplier Saysay: *"pressing the
 * upcoming schedules doesn't open our customer card. where we can see updates
 * about our project on them."*
 *
 * He was right, and the DOM said so: every row was
 * `<a href="/vendor-dashboard/messages/<threadId>">`. The row shows a DATE, an
 * event name and a place — the language of a booking — and opened a chat. The
 * booking's money, brief, schedule and next steps live on the customer card,
 * `/vendor-dashboard/clients/[eventId]`, and there was no way to reach it from
 * the row at all.
 *
 * ── WHY THE CARD LINK CARRIES A `?tab=` ────────────────────────────────────
 * 🔒 A BARE `/vendor-dashboard/clients/<id>` IS A CHAT LANDING. #5614 made the
 * client page redirect to the thread when no `?tab=` is named (see
 * `clients/[eventId]/page.tsx`: `!rawTab || rawTab === 'chat' || rawTab ===
 * 'call'`). So "point the row at the customer card" and "point the row at the
 * chat" are THE SAME URL unless the section is named. `?tab=details` is the
 * idiom already shipped for exactly this — the chat rail's "Full customer
 * profile" button uses it, and `lib/every-door-off-the-frame-lands-elsewhere.test.ts`
 * holds it there. Both shells resolve it: the Relationship Workspace has a
 * `details` tab, and the flag-off card's `normalizeTab` falls through to
 * Overview, which is the same brief.
 *
 * ── WHEN THERE IS NO CARD ──────────────────────────────────────────────────
 * `get_vendor_event_brief` raises `not_booked` — and the page then bounces to
 * /vendor-dashboard/clients — unless the caller's org holds a live
 * `event_vendors` row or a live thread on that event. An Upcoming row can be
 * admitted by `fetchVendorRoomEvents` arm 1 (a schedule-pool booking) with
 * NEITHER: a manual or off-platform booking the shop put on its own pool. Such
 * a row must not be sent to a page that will bounce it, so it falls back — to
 * the conversation if there is one, and otherwise to the calendar, which is
 * where that booking's date actually lives.
 *
 * 🔑 THE FALLBACK IS A LAST RESORT, NOT A TIE-BREAK. `opensCard` is returned so
 * a guard can prove the fallback is taken ONLY when the card is unreachable —
 * the sabotage this rule invites is "fall back whenever a thread exists", which
 * is exactly the bug it was written to remove.
 */

/** The client-card sections both shells resolve (never 'chat' / 'call'). */
export type CardSection = 'details' | 'quote' | 'schedule' | 'files';

/**
 * The section an Upcoming row opens on: the brief, the returning-client marker,
 * the activity log and the completion handshake — "updates about our project".
 */
export const UPCOMING_CARD_SECTION: CardSection = 'details';

export function customerCardHref(eventId: string, section: CardSection): string {
  return `/vendor-dashboard/clients/${eventId}?tab=${section}`;
}

export function vendorThreadHref(threadId: string): string {
  return `/vendor-dashboard/messages/${threadId}`;
}

/** What the rule needs to know about one booked date. */
export type UpcomingDoorInput = {
  eventId: string;
  /**
   * `event_vendors.vendor_id` — non-null only when the shop's OWN booked row
   * admitted this booking (`admitRoomBookings` arms 2 and 3). Non-null is a
   * guarantee, not a guess: that row carries a booked status and names this
   * shop, which is the brief RPC's first branch, so the card opens.
   */
  eventVendorId: string | null;
  /** The conversation on this event, when the shop has one. */
  threadId: string | null;
  /**
   * True when a thread on this event is one the brief RPC's 'inquiry' rung
   * admits — accepted, or pending and not archived. A declined or withdrawn
   * thread is not one of them, so it does not open the card.
   */
  briefOpensOnThread: boolean;
};

export type UpcomingDoor = {
  /** Where the row itself goes. */
  href: string;
  /** The conversation, kept reachable beside the row. Null when there is none. */
  threadHref: string | null;
  /** True when `href` is the customer card rather than a fallback. */
  opensCard: boolean;
};

/** The whole decision. Pure — every caller and the guard go through it. */
export function upcomingScheduleDoor(input: UpcomingDoorInput): UpcomingDoor {
  const threadHref = input.threadId ? vendorThreadHref(input.threadId) : null;
  const opensCard = input.eventVendorId !== null || input.briefOpensOnThread;
  return {
    href: opensCard
      ? customerCardHref(input.eventId, UPCOMING_CARD_SECTION)
      : // No card to open. The conversation is the next-best real destination;
        // the calendar is the last one, and it is never a dead link.
        (threadHref ?? '/vendor-dashboard/calendar'),
    threadHref,
    opensCard,
  };
}
