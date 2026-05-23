'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  INVITED_TO_BLOCKS,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type InvitedToBlock,
  type MealPreference,
  type RsvpStatus,
} from '@/lib/guests';

const ROLE_VALUES: GuestRole[] = [
  'guest',
  'bride',
  'groom',
  // VIP family — owner directive 2026-05-23 PM (PR #424 lock).
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
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

function parseTags(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function parseInvitedToBlocks(formData: FormData): InvitedToBlock[] {
  const result: InvitedToBlock[] = [];
  for (const block of INVITED_TO_BLOCKS) {
    if (formData.get(`invited_${block}`) === 'on') {
      result.push(block);
    }
  }
  if (result.length === 0) return ['ceremony', 'reception'];
  return result;
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
  const custom_tags = parseTags(clean(formData.get('custom_tags')));
  const invited_to_blocks = parseInvitedToBlocks(formData);

  // Plus-one fields (sub-block, only meaningful when plus_one_allowed === true)
  const plus_one_allowed = clean(formData.get('plus_one_allowed')) === 'on';
  const plus_one_first_name = clean(formData.get('plus_one_first_name'));
  const plus_one_last_name = clean(formData.get('plus_one_last_name'));
  const plus_one_mode_raw = clean(formData.get('plus_one_mode')) || 'full';
  const plus_one_mode = (plus_one_mode_raw === 'limited' ? 'limited' : 'full') as
    | 'full'
    | 'limited';

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

  // Snapshot of the plus-one display name for UI hints on the primary's row.
  const plus_one_name = plus_one_allowed
    ? [plus_one_first_name, plus_one_last_name].filter(Boolean).join(' ') || 'TBA'
    : null;

  const { data: inserted, error } = await supabase
    .from('guests')
    .insert({
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
      custom_tags,
      invited_to_blocks,
      plus_one_allowed,
      plus_one_name,
    })
    .select('guest_id')
    .single();

  if (error || !inserted) {
    // 23505 from the partial unique indexes (migration 20260531010000)
    // when trying to set a second bride or groom. Friendlier copy than
    // the raw constraint name.
    const friendly =
      error && (error as { code?: string }).code === '23505' &&
      /guests_one_(bride|groom)_per_event/.test(error.message)
        ? role === 'bride'
          ? 'Already a Bride in this event — change theirs first.'
          : 'Already a Groom in this event — change theirs first.'
        : (error?.message ?? 'insert_failed');
    return redirect(
      `/dashboard/${eventId}/guests/new?error=${encodeURIComponent(friendly)}`,
    );
  }

  // If plus-one is allowed, create a SECOND guests row for the +1.
  // TBA is valid: first_name / last_name may be empty strings.
  if (plus_one_allowed) {
    const { error: plusOneErr } = await supabase.from('guests').insert({
      event_id: eventId,
      first_name: plus_one_first_name || 'TBA',
      last_name: plus_one_last_name || '+1',
      side,
      group_category,
      role: 'guest',
      rsvp_status: 'pending',
      photo_consent: true,
      invited_to_blocks,
      plus_one_of_guest_id: inserted.guest_id,
      plus_one_mode,
      display_name: !plus_one_first_name && !plus_one_last_name ? `+ TBA · brought by ${first_name}` : null,
    });

    if (plusOneErr) {
      return redirect(
        `/dashboard/${eventId}/guests/new?error=${encodeURIComponent('plus_one_failed: ' + plusOneErr.message)}`,
      );
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  return redirect(`/dashboard/${eventId}/guests?added=1`);
}
