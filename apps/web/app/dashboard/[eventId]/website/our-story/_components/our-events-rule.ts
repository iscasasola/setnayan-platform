/**
 * "PICK FROM OUR EVENTS" — WHICH EVENTS, AND WHICH MAY OFFER PHOTOS. Pure.
 *
 * Owner 2026-09-27, verbatim: *"this should show all events that they are both
 * there."* The pair is THIS event's couple members (both partners' accounts).
 * An event is theirs to show when EVERY one of the pair is a member of it — in
 * any role: couple, guest, coordinator, supplier.
 *
 *   · HOSTED — either partner is the COUPLE there (decided by the reader as
 *     `host`) → its public photos (the hero
 *     and "Photos you add") are offered, as before.
 *   · SOMEONE ELSE'S — listed, with NO photos. The only photos the two of them
 *     took there are Papic captures, and those sit in a PRIVATE bucket that an
 *     Event Hub may never name (`site-media-ref.ts`); a pick stores a ref and
 *     never copies. So nothing from another couple's event is offered — not
 *     their gallery, and not the pair's own captures either.
 *
 * A membership the guest declined or left (`hidden_at`) is not "there".
 */
export type MembershipRow = {
  event_id: string;
  user_id: string;
  /** `member_type === 'couple'` — a coordinator runs another couple's event. Decided by the reader. */
  host: boolean;
  hidden_at: string | null;
};

export type SharedEvent = { eventId: string; hosted: boolean };

/** The OTHER events every one of `pair` is a live member of. Sorted by id (callers sort by date). */
export function sharedEvents(
  rows: readonly MembershipRow[],
  pair: readonly string[],
  thisEventId: string,
): SharedEvent[] {
  const people = [...new Set(pair)].filter(Boolean);
  if (people.length === 0) return [];
  const byEvent = new Map<string, { who: Set<string>; hosted: boolean }>();
  for (const r of rows) {
    if (r.event_id === thisEventId || r.hidden_at !== null) continue;
    if (!people.includes(r.user_id)) continue;
    const e = byEvent.get(r.event_id) ?? { who: new Set<string>(), hosted: false };
    e.who.add(r.user_id);
    if (r.host) e.hosted = true;
    byEvent.set(r.event_id, e);
  }
  return [...byEvent.entries()]
    .filter(([, e]) => people.every((p) => e.who.has(p)))
    .map(([eventId, e]) => ({ eventId, hosted: e.hosted }))
    .sort((a, b) => a.eventId.localeCompare(b.eventId));
}

/** Newest first; undated last; id breaks ties so the order is stable. */
export function newestFirst<T extends { eventId: string; date: string | null }>(list: readonly T[]): T[] {
  return [...list].sort((x, y) => {
    const dx = x.date ?? '';
    const dy = y.date ?? '';
    if (dx !== dy) {
      if (!dx) return 1;
      if (!dy) return -1;
      return dy.localeCompare(dx);
    }
    return x.eventId.localeCompare(y.eventId);
  });
}
