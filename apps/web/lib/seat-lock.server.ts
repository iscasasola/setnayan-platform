/**
 * seat-lock.server.ts — 🔒 THE ONE SERVER READ OF A LOCKED SEAT (seat plan #17, controller review of #8460).
 *
 * A locked seat is never moved by a hand: not from a stale tab, the 3D room, the phone's "Move to…", a new table's
 * "+ New table" seat, a group seated at a table, two tables trading, a table changing shape, or a direct call. Every
 * server action that moves or removes a seat by hand asks this BEFORE it writes, and answers `SEAT_LOCKED_REFUSAL`
 * (said in the editor as "Locked · Unlock to move") instead of a thrown error, which a production build would hide.
 *
 * A table deleted takes its seats with it (ON DELETE CASCADE), so deleting a table is a seat write too: a table that
 * holds a locked seat is not deleted by a hand (`deleteTable`) nor by Auto arrange's Undo.
 *
 * The auto passes (Auto arrange, Fill around locked, the draft, the reconcile) keep their own `locked` rules.
 * 🔒 lib/every-seat-write-asks-the-lock.test.ts lists every action that writes a seat.
 */
import type { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;

/** What a seat write answers when a locked seat would move. */
export const SEAT_LOCKED_REFUSAL = { refused: 'locked' } as const;
export type SeatLockedRefusal = typeof SEAT_LOCKED_REFUSAL;

/** The guests among `guestIds` whose seat is locked. A failed read throws — never read as "nobody is locked". */
export async function lockedSeatGuests(supabase: Db, eventId: string, guestIds: readonly string[]): Promise<string[]> {
  if (guestIds.length === 0) return [];
  const { data, error } = await supabase
    .from('event_seat_assignments')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('locked', true)
    .in('guest_id', [...guestIds]);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { guest_id: string }).guest_id);
}

/** Does any of these tables hold a locked seat? A failed read throws. */
export async function tablesHoldLockedSeats(supabase: Db, eventId: string, tableIds: readonly string[]): Promise<boolean> {
  if (tableIds.length === 0) return false;
  const { data, error } = await supabase
    .from('event_seat_assignments')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('locked', true)
    .in('table_id', [...tableIds])
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** The tables among `tableIds` that hold a locked seat (a delete would cascade it away). A failed read throws. */
export async function tablesWithLockedSeats(supabase: Db, eventId: string, tableIds: readonly string[]): Promise<Set<string>> {
  if (tableIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('event_seat_assignments')
    .select('table_id')
    .eq('event_id', eventId)
    .eq('locked', true)
    .in('table_id', [...tableIds]);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => (r as { table_id: string }).table_id));
}
