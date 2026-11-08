import { openClientHref, type ClientDoorFacts } from '@/lib/upcoming-schedule-door';
/**
 * 🧮 THE CLIENTS LIST'S TILES — Booked · Schedules · Asked · To collect, then Overdue (n) › and Unread (n) › (v113
 * `listAll()` `.tot.t4` + `.qrow`; spec §9 #7, owner 2026-11-08). PURE: the page reads, this words.
 *
 * 🔑 HONEST, EVERY ONE (`reads-are-honest`): a read that did not happen is `null` → the tile says "couldn't load" (or
 * "—" for money), never 0 and never ₱0. A read that fell short with rows in hand says "N+".
 *
 *   · Booked / Asked — the roster's own door counts (`doorValue`), unchanged.
 *   · Schedules — the shop's meetings still to come (`event_appointments`, proposed or confirmed, from today): the
 *     ocular visits, tastings and run-throughs v113 lists as "Schedules".
 *   · To collect — Money's own "to come in" (`moneyPicture(…).totals.toComePhp`), the same figure Money's row shows.
 *   · Overdue — Money's own overdue count (`totals.overdue`).
 *   · Unread — the events on the list whose chat has an unread message (`readUnreadChatCountsByThread`).
 *
 * 🔒 customers/the-clients-list-is-v113.test.ts
 */
import { formatCount } from '@/lib/format-number';
import { formatPesoCompact } from '@/lib/vendors-plan-budget';
import { formatPhp } from '@/lib/php';
import type { MoneyTotals } from '@/lib/vendor-money';

export type ClientMeeting = {
  appointmentId: string;
  eventId: string;
  /** The meeting's own name ("Food tasting"). */
  label: string;
  scheduledAt: string | null;
  status: 'proposed' | 'confirmed';
};

/** A count read: the rows in hand, and whether the read reached the server's count. */
export type CountRead = { n: number; complete: boolean; failed: boolean };

/** "3" · "12+" when short with rows in hand · null when nothing could be read. */
export function countWords(r: CountRead): string | null {
  if (r.failed && r.n === 0) return null;
  if (r.failed || !r.complete) return `${formatCount(r.n)}+`;
  return formatCount(r.n);
}

/** To collect — Money's "to come in", compact; "—"-able (null) when the payday read fell short. */
export function toCollectWords(totals: MoneyTotals | null): string | null {
  return totals ? formatPesoCompact(Math.round(totals.toComePhp * 100)) : null;
}

/**
 * To collect on the one screen's tile (Build 2 #43c, v113 "₱18,000"): the exact peso under a million — the tile has the
 * room now it is off the pinned row — and compact above it, so a big shop's figure never runs into its neighbour.
 */
export function toCollectTileWords(totals: MoneyTotals | null): string | null {
  if (!totals) return null;
  return totals.toComePhp < 1_000_000 ? formatPhp(totals.toComePhp) : formatPesoCompact(Math.round(totals.toComePhp * 100));
}

/** Overdue — Money's own count; null when the payday read fell short. */
export function overdueRead(totals: MoneyTotals | null): CountRead | null {
  return totals ? { n: totals.overdue, complete: true, failed: false } : null;
}

/** The events on the list with an unread chat message — counted over the list's own thread ids. */
export function unreadEvents<R extends { eventId: string; threadId: string | null }>(
  rows: readonly R[],
  countByThread: ReadonlyMap<string, number>,
): R[] {
  return rows.filter((r) => r.threadId !== null && (countByThread.get(r.threadId) ?? 0) > 0);
}

/** "Sat, Nov 14 · 10:00 AM" in Manila — a meeting's when; "No time set" for a meeting proposed without one. */
export function meetingWhen(at: string | null): string {
  if (!at) return 'No time set';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return 'No time set';
  const day = d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * Where a tile's row opens: the picked client, on the page that holds the fact — through THE ONE OPEN PATH (#38), so an
 * unbooked client's money row lands on the Quotation (no Payment page before booking) and never builds its own link.
 */
export function clientPageHref(
  eventId: string,
  page: 'schedule' | 'payments' | 'chat',
  facts: Omit<ClientDoorFacts, 'page'> = { booked: true, hasChat: true },
): string {
  return openClientHref(eventId, { ...facts, page });
}
