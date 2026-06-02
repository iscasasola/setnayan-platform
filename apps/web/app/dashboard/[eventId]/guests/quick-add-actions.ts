'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  defaultInvitedToForRole,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';

// Mirror of the role enum from new/actions.ts — kept local so this fast
// path never imports the redirecting form action. Singletons (bride /
// groom) stay in the list; the DB partial-unique index (migration
// 20260531010000) guards a second one and we surface a friendly error.
const ROLE_VALUES: GuestRole[] = [
  'guest',
  'bride',
  'groom',
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

export type QuickAddInput = {
  first_name: string;
  last_name: string;
  side: string;
  role: string;
  group_id?: string | null;
};

export type QuickAddResult =
  | {
      ok: true;
      guest: {
        guest_id: string;
        first_name: string;
        last_name: string;
        side: GuestSide;
        role: GuestRole;
      };
    }
  | { ok: false; error: string };

/**
 * Fast quick-add (iteration 0001 — additive Phase 1, 2026-06-02).
 *
 * Inserts ONE guest from the bottom-sheet quick-add and RETURNS a result
 * instead of redirecting, so the sheet stays open for rapid back-to-back
 * entry (the sticky-batch-context flow). The detailed `/guests/new`
 * form-action (createGuest) keeps the redirect-on-save behaviour and the
 * full option set (plus-one / meal / email / invited-to blocks).
 *
 * group_category is required on the row; quick-adds default to 'other'
 * (host refines later). Custom-group membership is the prototype's
 * sticky "Group" chip — wired here as an optional upsert into
 * guest_group_memberships when a group_id is passed.
 */
export async function quickAddGuest(
  eventId: string,
  input: QuickAddInput,
): Promise<QuickAddResult> {
  const first_name = (input.first_name ?? '').trim();
  const last_name = (input.last_name ?? '').trim();
  const side = input.side as GuestSide;
  const role = (input.role || 'guest') as GuestRole;

  // Both names required — matches createGuest's contract and the
  // guests.last_name NOT NULL column. Edge cases (mononyms, TBA) go
  // through the detailed form.
  if (!first_name || !last_name) {
    return { ok: false, error: 'Add both a first and last name.' };
  }
  if (!SIDE_VALUES.includes(side)) {
    return { ok: false, error: 'Pick a side first.' };
  }
  if (!ROLE_VALUES.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  const { data: inserted, error } = await supabase
    .from('guests')
    .insert({
      event_id: eventId,
      first_name,
      last_name,
      side,
      group_category: 'other',
      role,
      rsvp_status: 'pending',
      photo_consent: true,
      invited_to_blocks: defaultInvitedToForRole(role),
      custom_tags: [],
    })
    .select('guest_id')
    .single();

  if (error || !inserted) {
    // 23505 from the per-event single-bride / single-groom partial unique
    // indexes — friendlier than the raw constraint name.
    const friendly =
      error &&
      (error as { code?: string }).code === '23505' &&
      /guests_one_(bride|groom)_per_event/.test(error.message)
        ? role === 'bride'
          ? 'There’s already a Bride — change theirs first.'
          : 'There’s already a Groom — change theirs first.'
        : (error?.message ?? 'Couldn’t add that guest.');
    return { ok: false, error: friendly };
  }

  // Optional sticky custom-group assignment. Verify the group belongs to
  // this event (RLS guards too) before the membership upsert; a bad
  // group_id silently no-ops rather than failing the whole add.
  const groupId = (input.group_id ?? '').trim();
  if (groupId) {
    const { data: groupRow } = await supabase
      .from('guest_groups')
      .select('event_id')
      .eq('group_id', groupId)
      .maybeSingle();
    if (groupRow && groupRow.event_id === eventId) {
      await supabase
        .from('guest_group_memberships')
        .upsert([{ group_id: groupId, guest_id: inserted.guest_id }], {
          onConflict: 'group_id,guest_id',
          ignoreDuplicates: true,
        });
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  return {
    ok: true,
    guest: { guest_id: inserted.guest_id, first_name, last_name, side, role },
  };
}
