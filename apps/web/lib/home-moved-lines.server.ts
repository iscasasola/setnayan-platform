import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { unseatedCount, type SeatPlanAssignment, type SeatPlanPerson, type SeatPlanTable } from './print-entrance-chart';
import { readFindInspiration } from './find-inspiration.server';

/**
 * 🏠 HOME'S LINES FOR THE THINGS THAT MOVED (event-menu reorganisation, owner 2026-10-27: *"Each move removes its Studio
 * tile AND repoints Home's progress … in the SAME PR, or Home says 'Missing' about finished work"*; the finished map:
 * "Home — status lines that open the exact item in its new home"). Two reads, each answered by the moved page's OWN rule:
 *
 *   · SEATS — Guests › Seats' "Unseated" count (`unseatedCount`: no seat and not declined — `seatPlanGuestSections`'s rule),
 *     over the seat plan's own tables and seats. No tables yet = no seat plan = no line (`null`), never "N without a seat"
 *     for a plan nobody has started.
 *   · INSPIRATION — the board in Suppliers › Find (`readFindInspiration`, reorg R5): its photos and parts.
 *
 * A refused read is `'unread'` and the widget SAYS so — never 0.
 */

export type HomeSeatRows = { tables: SeatPlanTable[]; assignments: SeatPlanAssignment[] } | 'unread';

/** The seat plan's tables and seats — the two rows `unseatedCount` needs. */
export async function readHomeSeatRows(supabase: SupabaseClient, eventId: string): Promise<HomeSeatRows> {
  const [t, a] = await Promise.all([
    supabase.from('event_tables').select('table_id').eq('event_id', eventId),
    supabase.from('event_seat_assignments').select('table_id, guest_id').eq('event_id', eventId),
  ]);
  if (t.error || a.error) {
    logQueryError('readHomeSeatRows', (t.error ?? a.error)!, { event_id: eventId }, 'graceful_degrade');
    return 'unread';
  }
  return {
    tables: (t.data ?? []) as unknown as SeatPlanTable[],
    assignments: (a.data ?? []) as SeatPlanAssignment[],
  };
}

/** How many coming-or-unanswered guests have no seat yet; null = no seat plan yet; 'unread' = a read failed. */
export function homeUnseated(
  rows: HomeSeatRows,
  guests: readonly Pick<SeatPlanPerson, 'guest_id' | 'rsvp_status'>[] | null,
): number | 'unread' | null {
  if (rows === 'unread' || guests === null) return 'unread';
  if (rows.tables.length === 0) return null;
  return unseatedCount(rows.tables, rows.assignments, guests as SeatPlanPerson[]);
}

/** The board's photos and parts, for Home's Suppliers widget. */
export async function readHomeInspiration(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ photos: number; parts: number } | 'unread'> {
  const board = await readFindInspiration(supabase, eventId, new Set());
  return board.read === 'ok' ? { photos: board.photos, parts: board.parts } : 'unread';
}
