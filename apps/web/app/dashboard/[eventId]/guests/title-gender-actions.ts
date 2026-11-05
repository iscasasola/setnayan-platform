'use server';

/**
 * title-gender-actions.ts — the Guests page sheet "N people need Woman or Man for their title" saves each pick as it
 * is tapped (owner 2026-10-17). It writes ONLY `guests.gender`: the row's own Title dropdown there is narrowed to their
 * own title's two entries ("Atty. (Woman)" · "Atty. (Man)"), so the title itself never changes — a linked person's
 * name stays theirs. RLS-scoped couple client, like `updateGuest`; a zero-row write is a refusal, never "Saved".
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { parseTitleKey } from '@/lib/guest-title';
import { limitedHelperRefusal } from '@/lib/host-gate';

export type TitleGenderResult = { ok: true } | { ok: false; error: string };

export async function setGuestTitleGender(eventId: string, guestId: string, key: string): Promise<TitleGenderResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const { gender } = parseTitleKey(key);
  if (!gender) return { ok: false, error: 'Pick Woman or Man.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };
  const { data, error } = await supabase
    .from('guests')
    .update({ gender })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .select('guest_id');
  if (error) {
    logQueryError('setGuestTitleGender', error, { event_id: eventId, guest_id: guestId }, 'graceful_degrade');
    return { ok: false, error: 'Couldn’t save — try again.' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'Couldn’t save — this guest can’t be changed from here.' };
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true };
}
