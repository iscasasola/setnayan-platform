import type { SupabaseClient } from '@supabase/supabase-js';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { PLACEHOLDER_FIRST_NAME, planExtraSeats, type ExtraSeatRow } from '@/lib/extra-seats';

/**
 * Make a guest's seat rows match their `plus_one_count`, then seat them beside
 * the guest.
 *
 * ⚖ Owner 2026-09-21: "+ will have seats beside the person invited". The rule
 * (what to create, what may be removed, when to refuse) is `planExtraSeats`;
 * this only applies it:
 *   · missing seats → "TBA" rows linked to the guest (`plus_one_of_guest_id`),
 *     same side / group / blocks, so they belong where the guest belongs;
 *   · surplus placeholders → their seat released and the row soft-deleted,
 *     exactly as a removal from the list does;
 *   · then the seat engine re-seats the guest, which pulls every linked seat in
 *     beside them (lib/seating-reconcile.ts).
 *
 * Runs under the CALLER's client, so their RLS decides what they may write.
 * Call it with the count ALREADY saved — or use `checkExtraSeats` first to
 * refuse a change the named seats will not allow, before saving anything.
 */

type Primary = {
  guest_id: string;
  first_name: string | null;
  side: string;
  group_category: string;
  invited_to_blocks: string[] | null;
  plus_one_count: number | null;
};

async function readSeats(supabase: SupabaseClient, eventId: string, guestId: string) {
  const [{ data: primary, error: pErr }, { data: rows, error: rErr }] = await Promise.all([
    supabase
      .from('guests')
      .select('guest_id, first_name, side, group_category, invited_to_blocks, plus_one_count')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('guests')
      .select('guest_id, first_name, plus_one_name_confirmed_at, created_at')
      .eq('event_id', eventId)
      .eq('plus_one_of_guest_id', guestId)
      .is('deleted_at', null),
  ]);
  if (pErr || rErr || !primary) return null;
  const seats: ExtraSeatRow[] = (rows ?? []).map((r) => ({
    guest_id: r.guest_id as string,
    first_name: (r.first_name as string | null) ?? null,
    confirmed_at: (r.plus_one_name_confirmed_at as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
  }));
  return { primary: primary as Primary, seats };
}

/** The sentence every finalized-list refusal uses — the RSVP lock's own words. */
export const GUEST_LIST_FINALIZED = 'Your guest list is finalized — the guest count is locked.';

/**
 * Would setting `want` be allowed? Refuses when the guest list is closed and
 * the number would change, or when named seats exceed it.
 *
 * ⚖ Owner 2026-09-21 ("1. yes"): once the guest count is finalized, extra seats
 * no longer move — the head count suppliers priced against is closed, and each
 * seat is a guest row the lock already refuses to add or remove. Asked HERE,
 * before anything is saved, so a refused change never leaves a number without
 * its chairs. "Closed" is `guestListIsClosed` — the stamp OR the deadline — the
 * same answer the RSVP and the roster's finalized banner use.
 */
export async function checkExtraSeats(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
  want: number,
  guestName?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const read = await readSeats(supabase, eventId, guestId);
  if (!read) return { ok: false, error: 'Couldn’t read this guest’s seats — nothing was changed.' };
  if ((read.primary.plus_one_count ?? 0) !== want) {
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('guest_count_locked_at, guest_list_edit_deadline, event_date')
      .eq('event_id', eventId)
      .maybeSingle();
    // Unreadable is not "open": refuse rather than risk a half-made change.
    if (evErr || !ev) return { ok: false, error: 'Couldn’t check whether your guest list is finalized — nothing was changed.' };
    if (
      guestListIsClosed({
        lockedAt: ev.guest_count_locked_at as string | null,
        editDeadline: ev.guest_list_edit_deadline as string | null,
        eventDate: ev.event_date as string | null,
      })
    ) {
      return { ok: false, error: GUEST_LIST_FINALIZED };
    }
  }
  const plan = planExtraSeats(want, read.seats, guestName ?? read.primary.first_name ?? 'This guest');
  return plan.ok ? { ok: true } : { ok: false, error: plan.reason };
}

export async function syncExtraSeats(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<{ ok: true; created: number; removed: number } | { ok: false; error: string }> {
  const read = await readSeats(supabase, eventId, guestId);
  if (!read) return { ok: false, error: 'Couldn’t read this guest’s seats.' };
  const { primary, seats } = read;
  const plan = planExtraSeats(primary.plus_one_count ?? 0, seats, primary.first_name ?? 'This guest');
  if (!plan.ok) return { ok: false, error: plan.reason };

  if (plan.create > 0) {
    const host = (primary.first_name ?? '').trim() || 'their guest';
    const numbered = seats.length + plan.create > 1;
    const inserts = Array.from({ length: plan.create }, (_, i) => ({
      event_id: eventId,
      first_name: PLACEHOLDER_FIRST_NAME,
      last_name: '+1',
      display_name: numbered ? `+ TBA ${seats.length + i + 1} · brought by ${host}` : `+ TBA · brought by ${host}`,
      side: primary.side,
      group_category: primary.group_category,
      role: 'guest',
      rsvp_status: 'pending',
      photo_consent: true,
      // Same invitation as the guest who brings them; the column's default otherwise.
      ...(primary.invited_to_blocks ? { invited_to_blocks: primary.invited_to_blocks } : {}),
      plus_one_of_guest_id: primary.guest_id,
      // Limited, as the add-guest form documents: a plus-one is usually
      // less-known to the couple, so account creation waits for an upgrade.
      plus_one_mode: 'limited',
    }));
    const { error } = await supabase.from('guests').insert(inserts);
    if (error) return { ok: false, error: error.message };
  }

  if (plan.remove.length > 0) {
    // Release the chairs first, as removing a guest from the list does. If that
    // fails, stop: a removed seat still holding a chair is a ghost in the plan.
    const { error: seatErr } = await supabase
      .from('event_seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .in('guest_id', plan.remove);
    if (seatErr) return { ok: false, error: seatErr.message };
    const { error } = await supabase
      .from('guests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .in('guest_id', plan.remove);
    if (error) return { ok: false, error: error.message };
  }

  // Beside the person invited: re-seating the guest pulls their seats in.
  if (plan.create > 0 || plan.remove.length > 0) {
    await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: [primary.guest_id] });
  }
  return { ok: true, created: plan.create, removed: plan.remove.length };
}
