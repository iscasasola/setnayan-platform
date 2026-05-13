'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import type { MealPreference, RsvpStatus } from '@/lib/guests';

const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
const MEAL_VALUES: MealPreference[] = [
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
  'no_preference',
];

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

export async function submitRsvp(
  eventId: string,
  guestId: string,
  formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    // Session got out of sync — kick them back to the slug landing.
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    redirect(ev?.slug ? `/${ev.slug}` : '/');
  }

  const status = clean(formData.get('rsvp_status')) as RsvpStatus;
  const meal_raw = clean(formData.get('meal_preference'));
  const meal = (meal_raw || 'no_preference') as MealPreference;
  const dietary = clean(formData.get('dietary_restrictions')) || null;
  const notes = clean(formData.get('notes')) || null;

  if (!RSVP_VALUES.includes(status)) {
    return;
  }
  if (meal && !MEAL_VALUES.includes(meal)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('guests')
    .update({
      rsvp_status: status,
      meal_preference: meal,
      dietary_restrictions: dietary,
      notes,
      rsvp_responded_at:
        status === 'attending' || status === 'declined'
          ? new Date().toISOString()
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);

  if (error) {
    // Best-effort silent failure for guest-side surface; couple sees the row
    // unchanged. A toast UI lands with the polish pass.
    return;
  }

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(ev?.slug ? `/${ev.slug}?saved=1` : '/');
}
