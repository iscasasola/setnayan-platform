'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  GuestGroupCategory,
  GuestRole,
  GuestSide,
  MealPreference,
  RsvpStatus,
} from '@/lib/guests';

const ROLE_VALUES: GuestRole[] = [
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];
const GROUP_VALUES: GuestGroupCategory[] = [
  'family',
  'friends',
  'work',
  'school',
  'officiant',
  'other',
];
const MEAL_VALUES: MealPreference[] = [
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
  'no_preference',
];
const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

export async function createGuest(eventId: string, formData: FormData) {
  const first_name = clean(formData.get('first_name'));
  const last_name = clean(formData.get('last_name'));
  const side = clean(formData.get('side')) as GuestSide;
  const group_category = clean(formData.get('group_category')) as GuestGroupCategory;
  const role = (clean(formData.get('role')) || 'guest') as GuestRole;
  const email = clean(formData.get('email')) || null;
  const mobile = clean(formData.get('mobile')) || null;
  const meal_preference =
    (clean(formData.get('meal_preference')) || null) as MealPreference | null;
  const rsvp_status = (clean(formData.get('rsvp_status')) || 'pending') as RsvpStatus;
  const photo_consent = clean(formData.get('photo_consent')) === 'on';
  const notes = clean(formData.get('notes')) || null;

  if (!first_name || !last_name) {
    return redirect(`/dashboard/${eventId}/guests/new?error=missing_name`);
  }
  if (!SIDE_VALUES.includes(side)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=missing_side`);
  }
  if (!GROUP_VALUES.includes(group_category)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=missing_group`);
  }
  if (!ROLE_VALUES.includes(role)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=invalid_role`);
  }
  if (!RSVP_VALUES.includes(rsvp_status)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=invalid_rsvp`);
  }
  if (meal_preference && !MEAL_VALUES.includes(meal_preference)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=invalid_meal`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const { error } = await supabase.from('guests').insert({
    event_id: eventId,
    first_name,
    last_name,
    side,
    group_category,
    role,
    email,
    mobile,
    meal_preference,
    rsvp_status,
    photo_consent,
    notes,
  });

  if (error) {
    return redirect(
      `/dashboard/${eventId}/guests/new?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  return redirect(`/dashboard/${eventId}/guests?added=1`);
}
