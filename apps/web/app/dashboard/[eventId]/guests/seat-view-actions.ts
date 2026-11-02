'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { refuseLimitedHelper } from '@/lib/host-gate';
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

async function readGuestSeatPreview(eventId: string, guestId: string): Promise<GuestSeatPreview> {
  if (!eventId || !guestId) return { ok: false };
  const supabase = await createClient();
  const [view, tables, seat, entrance, booths] = await Promise.all([
    supabase.from('event_floor_plan').select('guest_seat_view').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_tables').select(TABLES_SELECT).eq('event_id', eventId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('event_seat_assignments').select('table_id, seat_number').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
    fetchEntrance(supabase, eventId),
    // The per-event branding read is service_role-only (`fetchBooths`' own rule for a session client).
    fetchBooths(supabase, eventId, { brandedReader: createAdminClient() }).catch(() => []),
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

// 🪑 HOW GUESTS SEE THEIR SEAT — 2D map · 3D walk · Both (owner 2026-11-01, item 3; lib/guest-seat-view.ts). The Seats ⚙
// row beside "Show guests their seats early" writes it — live, like that switch (no seat-plan lock: it changes what
// guests are shown, not the plan). Upsert, like publishSeating (the singleton row may not exist yet), and the written
// row is read back: zero rows is a refusal, never a quiet success.
async function writeGuestSeatView(eventId: string, view: string): Promise<GuestSeatViewSaved> {
  if (view !== '2d' && view !== '3d' && view !== 'both') return { ok: false, error: 'That is not a way guests can see their seat.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase
    .from('event_floor_plan')
    .upsert({ event_id: eventId, guest_seat_view: view, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
    .select('guest_seat_view');
  if (error || !data || data.length === 0) {
    if (error) logQueryError('writeGuestSeatView', error, { eventId }, 'graceful_degrade');
    return { ok: false, error: 'That did not save — nothing changed. Please try again.' };
  }
  revalidatePath(`/dashboard/${eventId}/seating`);
  return { ok: true, view: parseGuestSeatView((data[0] as { guest_seat_view?: unknown }).guest_seat_view) };
}

export type GuestSeatViewSaved = { ok: true; view: GuestSeatView } | { ok: false; error: string };

/**
 * ONE door for the guest's seat view (owner 2026-11-01) — the Seats ⚙ choice (`set`) and the guest card's preview of
 * it (`preview`). One export, not two: every exported server action is a Vercel route (lint-server-action-budget.mjs).
 */
export async function guestSeatView<Op extends GuestSeatViewOp>(eventId: string, op: Op): Promise<GuestSeatViewAnswer<Op>> {
  // How guests are shown their seat is the hosts' — like publishing the plan, never a helper's (the preview only reads).
  if (op.kind === 'set') await refuseLimitedHelper(eventId, null);
  return (await answer(eventId, op)) as GuestSeatViewAnswer<Op>;
}
export type GuestSeatViewOp = { kind: 'set'; view: string } | { kind: 'preview'; guestId: string };
type GuestSeatViewAnswer<Op> = Op extends { kind: 'set' } ? GuestSeatViewSaved : GuestSeatPreview;
async function answer(eventId: string, op: GuestSeatViewOp): Promise<GuestSeatViewSaved | GuestSeatPreview> {
  if (typeof eventId !== 'string' || eventId.length === 0) return op.kind === 'set' ? { ok: false, error: 'That did not save — nothing changed.' } : { ok: false };
  return op.kind === 'set' ? writeGuestSeatView(eventId, op.view) : readGuestSeatPreview(eventId, op.guestId);
}
