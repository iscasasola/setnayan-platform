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
  return result;
}

export async function updateGuest(eventId: string, guestId: string, formData: FormData) {
  const first_name = clean(formData.get('first_name'));
  const last_name = clean(formData.get('last_name'));
  const display_name = clean(formData.get('display_name')) || null;
  const side = clean(formData.get('side')) as GuestSide;
  const group_category = clean(formData.get('group_category')) as GuestGroupCategory;
  const role = (clean(formData.get('role')) || 'guest') as GuestRole;
  const email = clean(formData.get('email')) || null;
  const mobile = clean(formData.get('mobile')) || null;
  const meal_preference =
    (clean(formData.get('meal_preference')) || null) as MealPreference | null;
  const dietary_restrictions = clean(formData.get('dietary_restrictions')) || null;
  const rsvp_status = (clean(formData.get('rsvp_status')) || 'pending') as RsvpStatus;
  const photo_consent = clean(formData.get('photo_consent')) === 'on';
  // Plus-one toggle · owner directive 2026-05-23 PM. Host approves
  // permission only; the +1's name + RSVP confirmation lands on the
  // public RSVP widget (PR B follow-up). Toggling OFF is non-
  // destructive — we unflag the primary but DO NOT soft-delete any
  // existing +1 guest row that's already linked via plus_one_of_guest_id.
  // That row stays on the list so the host can manually remove it if
  // they're sure (defends against accidental loss of a real RSVP'd +1
  // to a stray checkbox toggle).
  const plus_one_allowed = clean(formData.get('plus_one_allowed')) === 'on';
  const notes = clean(formData.get('notes')) || null;
  // Custom tags RETIRED 2026-05-23 PM — owner directive: tags now
  // auto-derived from side/group/role/table at render time, host can't
  // pick free-text. Legacy column stays in schema (no migration) but
  // we no longer read or write from this update path. Existing rows'
  // custom_tags values are preserved (the column simply doesn't appear
  // in the .update() call below so it's left untouched).
  const invited_to_blocks = parseInvitedToBlocks(formData);

  const backTo = `/dashboard/${eventId}/guests/${guestId}`;

  if (!first_name || !last_name) {
    return redirect(`${backTo}?error=missing_name`);
  }
  if (!SIDE_VALUES.includes(side)) {
    return redirect(`${backTo}?error=missing_side`);
  }
  if (!GROUP_VALUES.includes(group_category)) {
    return redirect(`${backTo}?error=missing_group`);
  }
  if (!ROLE_VALUES.includes(role)) {
    return redirect(`${backTo}?error=invalid_role`);
  }
  if (!RSVP_VALUES.includes(rsvp_status)) {
    return redirect(`${backTo}?error=invalid_rsvp`);
  }
  if (meal_preference && !MEAL_VALUES.includes(meal_preference)) {
    return redirect(`${backTo}?error=invalid_meal`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guests')
    .update({
      first_name,
      last_name,
      display_name,
      side,
      group_category,
      role,
      email,
      mobile,
      meal_preference,
      dietary_restrictions,
      rsvp_status,
      photo_consent,
      plus_one_allowed,
      notes,
      invited_to_blocks,
      rsvp_responded_at: ['attending', 'declined'].includes(rsvp_status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) {
    // The partial unique indexes from migration 20260531010000 raise
    // 23505 (unique_violation) when a second bride or groom is set.
    // Rewrite the cryptic constraint name into something the couple can
    // act on; everything else falls through to the raw message.
    const friendly =
      (error as { code?: string }).code === '23505' &&
      /guests_one_(bride|groom)_per_event/.test(error.message)
        ? role === 'bride'
          ? 'Already a Bride in this event — change theirs first.'
          : 'Already a Groom in this event — change theirs first.'
        : error.message;
    return redirect(`${backTo}?error=${encodeURIComponent(friendly)}`);
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(backTo);
  // Owner directive 2026-05-22: when information is saved on guest,
  // it needs to return to guest list. The guests list page consumes
  // ?saved=1 to render a "Saved." flash banner.
  return redirect(`/dashboard/${eventId}/guests?saved=1`);
}

export async function softDeleteGuest(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  const supabase = await createClient();

  // RSVP-set gate (owner directive 2026-05-23) — block delete when the
  // guest has already responded (rsvp_status != 'pending'). 'pending' is
  // the only "haven't replied yet" state; attending / declined / maybe
  // are all "RSVP already set". The bulk-delete path enforces the same
  // gate; this single-guest path mirrors it for consistency.
  const { data: row, error: readErr } = await supabase
    .from('guests')
    .select('rsvp_status, first_name, last_name, display_name')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();

  if (readErr) {
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(readErr.message)}`,
    );
  }
  if (!row) {
    redirect(`/dashboard/${eventId}/guests?error=not_found`);
  }
  if (row.rsvp_status !== 'pending') {
    const displayName =
      row.display_name?.trim() || `${row.first_name} ${row.last_name}`.trim();
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(
        `${displayName || 'This guest'} has already RSVP'd — reset their RSVP to "Pending" before removing.`,
      )}`,
    );
  }

  // Release the seat assignment first (best-effort; the soft-delete
  // proceeds even if there's no row, since event_seat_assignments
  // doesn't have a row for every guest). Hard-delete here matches the
  // ON DELETE CASCADE intent — soft-deleting the guest wouldn't trip
  // the FK cascade because deleted_at is just a flag.
  await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  const { error } = await supabase
    .from('guests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(`/dashboard/${eventId}/guests?removed=1`);
}
