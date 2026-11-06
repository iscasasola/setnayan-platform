/**
 * rsvp-push-count.ts — WHAT THE RSVP NOTICE COUNTS: THE HOST'S UNREAD REPLIES.
 *
 * Owner, 2026-10-31: every reply pushes at once and replaces the last one on the
 * lock screen, reading "Maria replied" → "Maria + 1 other replied" → "Maria + 5
 * others replied". The count is the host's UNREAD `rsvp_received` bell rows for
 * this event — opening Guests or reading the bell marks them read, so it starts
 * over. Counted by GUEST (one guest who answered and then changed their meal is
 * one person), the newest guest named.
 *
 * Pure, so `lib/rsvp-push-count.test.ts` runs it. The server half is
 * `lib/rsvp-push.server.ts`.
 */
import { guestNameFromRsvpTitle } from './push-message';

export type UnreadReplyRow = { title: string; related_url: string | null; created_at: string };

export type RsvpPushFacts = { latestGuest: string; others: number; coming: number | null; url: string };

export function rsvpPushFacts(
  unread: readonly UnreadReplyRow[],
  eventId: string,
  coming: number | null,
): RsvpPushFacts | null {
  if (unread.length === 0) return null;
  const sorted = [...unread].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const latest = sorted[0]!;
  const guests = new Set(sorted.map((r, i) => r.related_url ?? `row-${i}`));
  const others = guests.size - 1;
  return {
    latestGuest: guestNameFromRsvpTitle(latest.title),
    others,
    coming,
    // One guest → their card; several → the list, where they all are.
    url: others > 0 ? `/dashboard/${eventId}/guests` : latest.related_url ?? `/dashboard/${eventId}/guests`,
  };
}
