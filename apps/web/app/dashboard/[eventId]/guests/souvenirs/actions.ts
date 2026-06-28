'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// Souvenir-table actions (owner 2026-06-28). Mirror the check-in desk exactly —
// the same couple+coordinator actor pair runs the giveaway table, scanning the
// SAME guests.qr_token to confirm a guest received their souvenir. One row in
// guest_souvenir_claims = received; undo = DELETE. RLS on the table is the
// security layer; the membership check here is the friendly-error layer.

export type SouvenirActionResult =
  | { ok: true; claimedAt: string }
  | { ok: false; error: string };

export type UndoActionResult = { ok: true } | { ok: false; error: string };

async function assertStationCrew(eventId: string) {
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

/** Mark a guest's souvenir as received. Idempotent — a double-scan is a no-op. */
export async function markSouvenirReceived(
  eventId: string,
  guestId: string,
  method: 'qr_scan' | 'manual_search',
): Promise<SouvenirActionResult> {
  let user;
  try {
    user = await assertStationCrew(eventId);
  } catch {
    return {
      ok: false,
      error: 'Only the couple or a coordinator can confirm souvenirs.',
    };
  }

  const supabase = await createClient();

  const { data: guest } = await supabase
    .from('guests')
    .select('guest_id')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) return { ok: false, error: 'That guest is not on this event’s list.' };

  const { data: inserted, error } = await supabase
    .from('guest_souvenir_claims')
    .insert({
      event_id: eventId,
      guest_id: guestId,
      claimed_by_user_id: user.id,
      method,
    })
    .select('claimed_at')
    .single();

  if (error) {
    // 23505 = already received (unique guest_id) — surface the original time so
    // a double-scan at the table is a no-op.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('guest_souvenir_claims')
        .select('claimed_at')
        .eq('guest_id', guestId)
        .maybeSingle();
      if (existing) return { ok: true, claimedAt: existing.claimed_at };
    }
    return { ok: false, error: 'Couldn’t record that — try again.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests/souvenirs`);
  return { ok: true, claimedAt: inserted.claimed_at };
}

/** Undo a souvenir claim (mis-scan at the table). */
export async function undoSouvenirReceived(
  eventId: string,
  guestId: string,
): Promise<UndoActionResult> {
  try {
    await assertStationCrew(eventId);
  } catch {
    return {
      ok: false,
      error: 'Only the couple or a coordinator can undo a souvenir.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guest_souvenir_claims')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) return { ok: false, error: 'Couldn’t undo that — try again.' };

  revalidatePath(`/dashboard/${eventId}/guests/souvenirs`);
  return { ok: true };
}
