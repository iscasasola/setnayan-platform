/**
 * 🍽 SHOW & SORT LISTS THE PAX SERVICES (owner 2026-11-12, DECISION_LOG "GUEST LIST SHOW & SORT LISTS THE PAX
 * SERVICES"). Owner, verbatim: *"on show & sort. we can add the pax related services"*. The guest list is the control
 * for every per-guest service — each counts the list minus the guests ticked "Not counted for ▾" it — so the list's
 * Show & sort gains one row per per-head service on the event: "Catering ▾ Everyone · Counted · Not counted".
 *
 *   · Not counted = EXACTLY the guests ticked out of that service on their card (`guest_not_counted_for`).
 *   · Counted     = everyone the service's supplier counts: attending, counted toward the event, inside the service's
 *                   rule (`event_vendor_count_rules`), not ticked — the same guests `get_event_service_counts` counts.
 *
 * ONLY per-head services get a row (owner 2026-11-12, "PAX CARDS ONLY"): the list comes from `readBookedServices`,
 * whose SQL keeps `event_vendor_counts_per_head` (`vendor_services.pricing_basis = 'per_pax'`). A flat-priced service is
 * never in it, so it can never become a row here.
 *
 * PURE and tiny — it rides in the List's first load (the open sheet is its own chunk). The server hands it the words
 * and the ids (`paxServicesForList`, `guest-not-counted.server.ts`).
 * 🔒 lib/the-list-shows-who-each-pax-service-counts.test.ts
 */
import { countsTowardEvent } from './guests';

/** One per-head service as the List's Show & sort offers it. `ticked` = the guests left out on their card;
 *  `outside` = the attending guests the service's own rule leaves out (empty for "Everyone attending"). */
export type PaxListService = { id: string; name: string; ticked: string[]; outside: string[] };

export type PaxSide = 'counted' | 'out';
/** The one pax narrowing the List holds — one service at a time; null = no pax narrowing. */
export type PaxPick = { id: string; side: PaxSide };

/** The row's three words. */
export const PAX_EVERYONE = 'Everyone';
export const PAX_SIDE_WORDS: Record<PaxSide, string> = { counted: 'Counted', out: 'Not counted' };

/** The fields a row needs to be judged. */
export type PaxGuestFields = {
  guest_id: string;
  rsvp_status: string;
  entry_source?: string | null;
  passed_away?: boolean | null;
  represented_by_guest_id?: string | null;
};

/** Is this row one the pick shows? `null` → every row. A pick naming a service no longer listed → nobody (never all). */
export function paxFilterMatches(
  g: PaxGuestFields,
  pick: PaxPick | null,
  services: readonly PaxListService[],
): boolean {
  if (pick === null) return true;
  const s = services.find((x) => x.id === pick.id);
  if (!s) return false;
  const ticked = s.ticked.includes(g.guest_id);
  if (pick.side === 'out') return ticked;
  return (
    !ticked &&
    countsTowardEvent(g) &&
    g.rsvp_status === 'attending' &&
    !s.outside.includes(g.guest_id)
  );
}

/** "Catering" — and "Catering · Juan's Kitchen" when two per-head services share the trade's word. */
export function paxServiceNames<T extends { id: string; label: string; shop: string | null }>(
  services: readonly T[],
): Map<string, string> {
  const seen = new Map<string, number>();
  for (const s of services) seen.set(s.label, (seen.get(s.label) ?? 0) + 1);
  return new Map(
    services.map((s) => [s.id, (seen.get(s.label) ?? 0) > 1 && s.shop ? `${s.label} · ${s.shop}` : s.label] as const),
  );
}

/** The dropdown keys: "pax:<id>:counted" · "pax:<id>:out"; "pax:<id>:all" is Everyone. */
export function paxKey(id: string, side: PaxSide | 'all'): string {
  return `pax:${id}:${side}`;
}
export function paxPickOfKey(key: string): PaxPick | null {
  const m = /^pax:(.+):(counted|out|all)$/.exec(key);
  if (!m || m[2] === 'all') return null;
  return { id: m[1]!, side: m[2] as PaxSide };
}
