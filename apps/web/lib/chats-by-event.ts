/**
 * ✉️ THE CHATS LISTS' TWO RULES — ONE ROW PER EVENT, AND MESSENGER ORDER WITH UNREAD PINNED ON TOP
 * (Supplier Build 3 · Lane A, 9 Nov 2026).
 *
 * Owner, 8 Nov (DECISION_LOG ✉️): *"that will just list all the events (no dupes). and always arranged like how messenger
 * facebook. the most recent conversation will be the one on top. above it will be pinned messages if unread."* And 🪞:
 * the host's list of this event's suppliers keeps *"the same ordering rule"*.
 *
 *   · `foldByEvent` — the supplier's threads, one row per EVENT. A shop has one `chat_threads` row per event today
 *     (`UNIQUE (event_id, vendor_profile_id)`), so this is usually the identity — it is the rule anyway, so a second
 *     thread on one event (another seat, a re-opened ask) can never draw the event twice. The row is the event's
 *     NEWEST thread; it is unread when ANY of its threads is; it is archived only when EVERY one is.
 *   · `messengerOrder` — unread rows pinned on top, then everything by its most recent message; each group keeps
 *     newest first. Archived rows are not ordered here (they fold below, as shipped).
 *
 * Pure — no React, no I/O. 🔒 lib/chats-by-event.test.ts
 */

export type FoldableThread = {
  threadId: string;
  eventId: string;
  /** The thread's last activity (ISO) — `chat_threads.updated_at`, the order the lists were already read in. */
  lastAt: string;
  unread: boolean;
  archived: boolean;
};

export type EventFold<T extends FoldableThread> = {
  /** The event's newest thread — the one the row speaks for (its preview, its time, its archive control). */
  lead: T;
  /** Every thread on this event, newest first. */
  threads: T[];
  unread: boolean;
  archived: boolean;
  lastAt: string;
};

const at = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** One row per event: newest thread leads, unread if any is, archived only if all are. Newest event first. */
export function foldByEvent<T extends FoldableThread>(threads: readonly T[]): EventFold<T>[] {
  const byEvent = new Map<string, T[]>();
  for (const t of threads) {
    const list = byEvent.get(t.eventId);
    if (list) list.push(t);
    else byEvent.set(t.eventId, [t]);
  }
  const folds: EventFold<T>[] = [];
  for (const list of byEvent.values()) {
    const sorted = [...list].sort((a, b) => at(b.lastAt) - at(a.lastAt));
    const lead = sorted[0]!;
    folds.push({
      lead,
      threads: sorted,
      unread: sorted.some((t) => t.unread),
      archived: sorted.every((t) => t.archived),
      lastAt: lead.lastAt,
    });
  }
  return folds.sort((a, b) => at(b.lastAt) - at(a.lastAt));
}

/**
 * Messenger order: unread pinned on top, then the rest — each in the order given (callers hand rows newest first).
 * Stable: two rows of one group never swap.
 */
export function messengerOrder<R extends { unread: boolean }>(rows: readonly R[]): { pinned: R[]; recent: R[] } {
  return { pinned: rows.filter((r) => r.unread), recent: rows.filter((r) => !r.unread) };
}

/**
 * 🚦 "NEEDS YOU" ON A CHATS ROW (DECISION_LOG 2026-11-09 🚦): a row whose client has a BLOCKER or a DUE-NOW item shows a
 * dot — the blocker's the stronger. The level itself is NOT decided here: it is Lane B's pure `needsYouLevel()` in
 * `apps/web/lib` (one rule, read by the pins, Today and this dot). Until that lands no row carries a level, so no dot is
 * drawn — never a guessed one.
 * TODO(Build 3 · Lane B): feed `InboxRow.needsYou` from `needsYouLevel()` on both Chats pages.
 */
export type ChatsRowNeedsYou = 'blocker' | 'due-now';

export const NEEDS_YOU_DOT_LABEL: Record<ChatsRowNeedsYou, string> = {
  blocker: 'Needs your answer before the booking can move',
  'due-now': 'Something is due now',
};
