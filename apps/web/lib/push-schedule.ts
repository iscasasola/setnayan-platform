/**
 * push-schedule.ts — WHAT THE 7 AM RELEASE AND THE EVENING SUMMARY SEND, pure, so
 * `lib/push-schedule.test.ts` runs it. The server half is `push-schedule.server.ts`.
 */
import { noticeSentence } from './push-message';
import { eventIdFromRelatedUrl } from './notification-event-id';
import type { NotificationType } from './notifications';

export type HeldRow = {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_url: string | null;
  event_id: string | null;
  created_at: string;
};

export type ReleaseItem = { row: HeldRow; rsvpEventId: string | null };

/**
 * One notice per person per collapse key — the latest row wins, exactly what the
 * phone would hold had they arrived one by one. Rows arrive oldest first.
 */
export function planMorningRelease(rows: readonly HeldRow[]): ReleaseItem[] {
  const latest = new Map<string, HeldRow>();
  for (const row of rows) {
    const eventId = row.event_id ?? eventIdFromRelatedUrl(row.related_url);
    const key =
      row.type === 'rsvp_received' && eventId
        ? `rsvp:${eventId}`
        : noticeSentence({ type: row.type, title: row.title, body: row.body, relatedUrl: row.related_url, eventId }).collapseKey;
    latest.set(`${row.user_id}|${key}`, row);
  }
  return [...latest.values()].map((row) => ({
    row,
    rsvpEventId: row.type === 'rsvp_received' ? (row.event_id ?? eventIdFromRelatedUrl(row.related_url)) : null,
  }));
}

export type SummaryPerson = { userId: string; count: number; eventIds: string[]; vendorSide: boolean };

/** One line per person: how many Low notices today, across which events, and which bell. */
export function summaryCounts(rows: readonly HeldRow[]): SummaryPerson[] {
  const by = new Map<string, { count: number; events: Set<string>; vendor: number }>();
  for (const r of rows) {
    const p = by.get(r.user_id) ?? { count: 0, events: new Set<string>(), vendor: 0 };
    p.count += 1;
    const eventId = r.event_id ?? eventIdFromRelatedUrl(r.related_url);
    if (eventId) p.events.add(eventId);
    if (r.related_url?.startsWith('/vendor-dashboard')) p.vendor += 1;
    by.set(r.user_id, p);
  }
  return [...by.entries()].map(([userId, p]) => ({
    userId,
    count: p.count,
    eventIds: [...p.events],
    vendorSide: p.vendor > p.count / 2,
  }));
}

/** "Opens the 🔔" — the full notifications page of the side most of the updates belong to. */
export function summaryUrl(vendorSide: boolean): string {
  return vendorSide ? '/vendor-dashboard/notifications' : '/dashboard/notifications';
}
