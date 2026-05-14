'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { emitNotification } from '@/lib/notification-emit';
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
    .select('slug, display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  // Notify couple-side members that an RSVP came in. emitNotification handles
  // both the in-app row + the Resend email (when configured). Failures here
  // never roll back the RSVP — best-effort.
  if (status === 'attending' || status === 'declined') {
    try {
      const { data: guest } = await admin
        .from('guests')
        .select('first_name, last_name, display_name')
        .eq('guest_id', guestId)
        .maybeSingle();
      const guestName =
        (guest?.display_name ?? '').trim() ||
        `${guest?.first_name ?? ''} ${guest?.last_name ?? ''}`.trim() ||
        'A guest';
      const statusLabel = status === 'attending' ? 'attending' : 'not attending';
      const { data: coupleMembers } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of coupleMembers ?? []) {
        await emitNotification({
          userId: m.user_id,
          type: 'rsvp_received',
          title: `${guestName} RSVP'd: ${statusLabel}`,
          body:
            status === 'attending' && meal && meal !== 'no_preference'
              ? `Meal preference: ${meal}.`
              : null,
          relatedUrl: `/dashboard/${eventId}/guests/${guestId}`,
        });
      }
    } catch {
      // Notification failures must not break the guest-side RSVP submit.
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(ev?.slug ? `/${ev.slug}?saved=1` : '/');
}
