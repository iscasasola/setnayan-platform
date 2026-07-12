import type { SupabaseClient } from '@supabase/supabase-js';
import { manilaToday } from '@/lib/std-views';

/**
 * Wedding cardinality — "one wedding IN PLANNING at a time" (owner-locked
 * 2026-07-12, HARD BLOCK, reconciled after the flow-check 2026-07-12).
 *
 * A user may have at most ONE wedding that is still IN PLANNING. Tapping
 * "Wedding" again while one is in planning is blocked — but the block is now
 * GUIDED (the picker offers "same-marriage church ceremony / vow renewal / a
 * new marriage") rather than a flat wall.
 *
 * ⚠ Flow-check fix: the slot must FREE for a SETTLED wedding, not only an
 * archived one. A wedding is SETTLED when it is archived OR completed (its
 * event_date has passed — the wedding happened: a widow/annulled/remarrying
 * user). Only an IN-PLANNING wedding blocks:
 *
 *     in-planning  =  NOT archived  AND  (event_date IS NULL OR event_date >= today)
 *
 * So a widow/annulled user can create a new wedding without archiving their
 * past one (that was the live defect this repairs).
 *
 * Same-marriage civil+church is one wedding with two ceremonies (never a second
 * event). Muslim-rite concurrency stays blocked in V1 (accepted).
 *
 * Shared by the create-event PAGE (guided router) + SERVER ACTION (authoritative).
 */

export type InPlanningWedding = {
  eventId: string;
  displayName: string;
  eventDate: string | null;
};

type WeddingRow = {
  event_id: string;
  event_type: string;
  display_name: string;
  event_date: string | null;
  archived: boolean;
};

/**
 * Pure predicate: does this event count as an IN-PLANNING wedding that blocks a
 * new one? A wedding blocks iff it is not archived AND not completed (event_date
 * null or still today/future). Settled (archived, or event_date strictly before
 * `todayIso`) → does not block. Non-weddings never block.
 */
export function isInPlanningWedding(
  ev: { event_type: string; event_date: string | null; archived: boolean } | null | undefined,
  todayIso: string,
): boolean {
  if (ev == null || ev.event_type !== 'wedding' || ev.archived) return false;
  if (ev.event_date != null && ev.event_date < todayIso) return false; // completed
  return true;
}

/**
 * The user's IN-PLANNING wedding (not archived, date unset or still upcoming),
 * or null. A settled wedding (archived, or event_date in the past) returns null
 * — it does NOT block a new wedding.
 */
export async function getInPlanningWedding(
  supabase: SupabaseClient,
  userId: string,
): Promise<InPlanningWedding | null> {
  const { data } = await supabase
    .from('event_members')
    .select('events:event_id(event_id, event_type, display_name, event_date, archived)')
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  const today = manilaToday();

  for (const row of data ?? []) {
    const e = (row as { events: WeddingRow | WeddingRow[] | null }).events;
    const ev = Array.isArray(e) ? e[0] : e;
    if (ev != null && isInPlanningWedding(ev, today)) {
      return { eventId: ev.event_id, displayName: ev.display_name, eventDate: ev.event_date };
    }
  }
  return null;
}

/** Authoritative boolean for the server action. */
export async function hasInPlanningWeddingForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await getInPlanningWedding(supabase, userId)) != null;
}
