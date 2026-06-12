'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export type CheckinActionResult =
  | { ok: true; checkedInAt: string }
  | { ok: false; error: string };

export type UndoActionResult = { ok: true } | { ok: false; error: string };

/**
 * Throw unless the caller is a couple OR coordinator member of this event —
 * the two roles that run the door on the day (mirrors the RLS policy on
 * guest_checkins, so this is the friendly-error layer, not the security layer).
 */
async function assertDoorCrew(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const supabase = await createClient();
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!data) throw new Error('forbidden');
  return user;
}

/** Check a guest in. Idempotent — a second call reports the existing time. */
export async function checkInGuest(
  eventId: string,
  guestId: string,
  method: 'qr_scan' | 'manual_search',
): Promise<CheckinActionResult> {
  let user;
  try {
    user = await assertDoorCrew(eventId);
  } catch {
    return { ok: false, error: 'Only the couple or a coordinator can check guests in.' };
  }

  const supabase = await createClient();

  // Belongs-to-event guard (RLS + the composite FK also enforce this; this
  // exists to return a friendly message instead of a constraint error).
  const { data: guest } = await supabase
    .from('guests')
    .select('guest_id')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) return { ok: false, error: 'That guest is not on this event’s list.' };

  const { data: inserted, error } = await supabase
    .from('guest_checkins')
    .insert({
      event_id: eventId,
      guest_id: guestId,
      checked_in_by_user_id: user.id,
      method,
    })
    .select('checked_in_at')
    .single();

  if (error) {
    // 23505 = already checked in (unique guest_id) — treat as success and
    // surface the original time so a double-scan at the door is a no-op.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('guest_checkins')
        .select('checked_in_at')
        .eq('guest_id', guestId)
        .maybeSingle();
      if (existing) {
        return { ok: true, checkedInAt: existing.checked_in_at };
      }
    }
    return { ok: false, error: 'Couldn’t check that guest in — try again.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests/checkin`);
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, checkedInAt: inserted.checked_in_at };
}

/** Undo a check-in (mis-scan at the door). */
export async function undoCheckIn(
  eventId: string,
  guestId: string,
): Promise<UndoActionResult> {
  try {
    await assertDoorCrew(eventId);
  } catch {
    return { ok: false, error: 'Only the couple or a coordinator can undo a check-in.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guest_checkins')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) return { ok: false, error: 'Couldn’t undo that check-in — try again.' };

  revalidatePath(`/dashboard/${eventId}/guests/checkin`);
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true };
}
