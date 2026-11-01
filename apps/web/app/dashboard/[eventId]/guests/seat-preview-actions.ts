'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchEntrance, type EntrancePos } from '@/lib/indoor-blueprint';
import { boothCardFromRow, boothHasSupplier } from '@/lib/booth-card-from-row';
import { fetchBooths, type EventTableRow } from '@/lib/seating';
import { parseGuestSeatView, type GuestSeatView } from '@/lib/guest-seat-view';
import type { Lab3DBooth } from '@/lib/seating-3d';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 🪑 THE GUEST CARD'S SEAT, AS THE GUEST WILL SEE IT (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW DOES" item 4):
 * *"The host's guest card shows that guest's seat plan exactly as the guest will see it (per that setting), their seat
 * lit, tap for full screen."* Read when the card's Seat Plan fold draws it — never with the card's first load. The SAME
 * facts the guest's seat page reads (`/[slug]/find-seat`): the couple's seat-view choice, the room's tables and entrance,
 * the booked suppliers' booths, and this guest's seat. Under the host's own session (RLS = the event's hosts).
 *
 * A refused read is said (`ok: false`) — the card never draws an empty room as if it were theirs.
 */
export type GuestSeatPreview =
  | {
      ok: true;
      view: GuestSeatView;
      tables: EventTableRow[];
      entrance: EntrancePos;
      tableId: string | null;
      seatNumber: number | null;
      booths: Lab3DBooth[];
    }
  | { ok: false };

const TABLES_SELECT = 'table_id,public_id,event_id,table_label,table_type,capacity,sort_order,x_pos,y_pos';

export async function readGuestSeatPreview(eventId: string, guestId: string): Promise<GuestSeatPreview> {
  if (!eventId || !guestId) return { ok: false };
  const supabase = await createClient();
  const [view, tables, seat, entrance, booths] = await Promise.all([
    supabase.from('event_floor_plan').select('guest_seat_view').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_tables').select(TABLES_SELECT).eq('event_id', eventId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('event_seat_assignments').select('table_id, seat_number').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
    fetchEntrance(supabase, eventId),
    fetchBooths(supabase, eventId).catch(() => []),
  ]);
  const failed = view.error ?? tables.error ?? seat.error;
  if (failed) {
    logQueryError('readGuestSeatPreview', failed, { eventId, guestId }, 'graceful_degrade');
    return { ok: false };
  }
  const s = seat.data as { table_id?: string | null; seat_number?: number | null } | null;
  return {
    ok: true,
    view: parseGuestSeatView((view.data as { guest_seat_view?: unknown } | null)?.guest_seat_view),
    tables: (tables.data ?? []) as EventTableRow[],
    entrance,
    tableId: s?.table_id ?? null,
    seatNumber: typeof s?.seat_number === 'number' ? s.seat_number : null,
    booths: booths.filter(boothHasSupplier).map(boothCardFromRow),
  };
}
