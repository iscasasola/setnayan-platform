/**
 * 🔗 The plain half of "where a service card can be shared" — the row shape and the ONE predicate for which
 * conversation is a client event's chat. Kept out of `service-share-targets.server.ts` so the Share sheet (a client
 * component) and the share action can both name them; the reader lives in that file.
 * 🔒 app/vendor-dashboard/services/share-posts-the-card-into-a-client-chat.test.ts
 */
export type ShareTarget = {
  threadId: string;
  eventId: string;
  /** The event's own title ("Reyes–Santos Wedding"); "A Setnayan event" when it has none. */
  name: string;
  /** `events.event_date` (a DATE) or null. */
  eventDate: string | null;
  /** "14 Dec 2026", or '' when the event has no date. */
  dateLabel: string;
  /** The two letters on the row's tile — the inbox's own `initialsFor`, so both screens show the same letters. */
  initials: string;
};

export type ShareTargetsRead = { status: 'ok'; targets: ShareTarget[] } | { status: 'unreadable' };

/** The same predicate the share action asks again on the server, so the two can never disagree. */
export function isShareableThread(t: { inquiry_status: string | null; archived_at: string | null }): boolean {
  return t.inquiry_status === 'accepted' && t.archived_at === null;
}

export const SHARE_TARGET_UNNAMED = 'A Setnayan event';
