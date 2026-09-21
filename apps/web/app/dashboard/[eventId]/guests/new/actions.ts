'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { guestEditsLocked } from '@/lib/pax';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { createAdminClient } from '@/lib/supabase/admin';
import { maybeAutoSurfaceEventForGuest } from '@/lib/account-autosurface';
import {
  INVITED_TO_BLOCKS,
  singletonRoleDuplicateMessage,
  singletonRoleFromIndexError,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type InvitedToBlock,
  type MealPreference,
  type RsvpStatus,
} from '@/lib/guests';
import { normalizeGuestName } from '@/lib/guest-name';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { resolveSubmittedSide } from '@/lib/guest-side-question';

// Iteration 0053 P2: the valid role set is per event type (resolveRoleSetForEvent).
// The SIDE list + the "is a side meaningful here?" decision live in
// lib/guest-side-question.ts, which is pure and test-executed.
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
  const first_name = normalizeGuestName(clean(formData.get('first_name')));
  const last_name = normalizeGuestName(clean(formData.get('last_name')));
  // The three OPTIONAL parts (2026-09-14). The client island pre-fills them by
  // parsing what the host types, but they are plain editable inputs — whatever
  // the host leaves in the box is what is stored, and blank stores NULL.
  const name_prefix = normalizeGuestName(clean(formData.get('name_prefix'))) || null;
  const middle_name = normalizeGuestName(clean(formData.get('middle_name'))) || null;
  const name_suffix = normalizeGuestName(clean(formData.get('name_suffix'))) || null;
  const submittedSide = clean(formData.get('side'));
  const group_category = clean(formData.get('group_category')) as GuestGroupCategory;
  const role = (clean(formData.get('role')) || 'guest') as GuestRole;
  const email = clean(formData.get('email')) || null;
  const mobile = clean(formData.get('mobile')) || null;
  const meal_preference =
    (clean(formData.get('meal_preference')) || null) as MealPreference | null;
  const rsvp_status = (clean(formData.get('rsvp_status')) || 'pending') as RsvpStatus;
  const photo_consent = clean(formData.get('photo_consent')) === 'on';
  const notes = clean(formData.get('notes')) || null;
  // Tea-ceremony serving order (Chinese / Tsinoy weddings) — both optional. A
  // free-text relationship label + an integer within-side serve order (lower
  // serves first). Parse seniority defensively — non-numeric / empty → null.
  const relation = clean(formData.get('relation')) || null;
  const seniorityRaw = clean(formData.get('seniority_rank'));
  const seniorityParsed = seniorityRaw ? Number.parseInt(seniorityRaw, 10) : NaN;
  const seniority_rank = Number.isFinite(seniorityParsed) ? seniorityParsed : null;
  // Custom tags RETIRED 2026-05-23 PM — owner directive: tags now
  // auto-derived from side/group/role/table at render time, host can't
  // pick free-text. Legacy column stays in schema (no migration) but
  // we no longer write from this action. New guests start with [].
  const custom_tags: string[] = [];
  const invited_to_blocks = parseInvitedToBlocks(formData);

  // Plus-one fields (sub-block, only meaningful when plus_one_allowed === true)
  // Extra seats, 0–4 (owner 2026-09-21). An old form's checkbox still counts as one.
  const rawPlus = Number(clean(formData.get('plus_one_count')) || Number.NaN);
  const plus_one_count =
    Number.isInteger(rawPlus) && rawPlus >= 0 && rawPlus <= 4
      ? rawPlus
      : clean(formData.get('plus_one_allowed')) === 'on' ? 1 : 0;
  const plus_one_allowed = plus_one_count > 0;
  const plus_one_first_name = normalizeGuestName(clean(formData.get('plus_one_first_name')));
  const plus_one_last_name = normalizeGuestName(clean(formData.get('plus_one_last_name')));
  const plus_one_mode_raw = clean(formData.get('plus_one_mode')) || 'full';
  const plus_one_mode = (plus_one_mode_raw === 'limited' ? 'limited' : 'full') as
    | 'full'
    | 'limited';

  if (!first_name || !last_name) {
    return redirect(`/dashboard/${eventId}/guests/new?error=missing_name`);
  }
  if (!GROUP_VALUES.includes(group_category)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=missing_group`);
  }
  const roleSet = await resolveRoleSetForEvent(eventId);
  // Sides are a wedding idea. On an event type whose role set names no side
  // principals the form never asked, so store what quick-add stores instead of
  // refusing with "Pick a side first." A wedding is unchanged: still required.
  const sideResult = resolveSubmittedSide(roleSet, submittedSide);
  if (!sideResult.ok) {
    return redirect(`/dashboard/${eventId}/guests/new?error=${sideResult.error}`);
  }
  const side: GuestSide = sideResult.side;
  if (!roleSet.offeredRoles.includes(role)) {
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
  // Post-finalize guard (Adaptive Pax Pricing Phase 9) — friendly pre-check; the
  // guard_guest_edits_when_locked trigger is the backstop for every other path.
  if (await guestEditsLocked(supabase, eventId)) {
    return redirect(`/dashboard/${eventId}/guests/new?error=finalized`);
  }

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
      // Optional: omitted entirely when blank, so the row is byte-identical to
      // a pre-2026-09-14 insert when the guest carries no title.
      ...(name_prefix ? { name_prefix } : {}),
      ...(middle_name ? { middle_name } : {}),
      ...(name_suffix ? { name_suffix } : {}),
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
      plus_one_count,
      plus_one_name,
      relation,
      seniority_rank,
    })
    .select('guest_id')
    .single();

  if (error || !inserted) {
    // 23505 from the partial unique indexes (bride/groom: migration
    // 20260531010000; Muslim wali/imam/wakil: 20270308998862) when setting a
    // second singleton. Friendlier copy than the raw constraint name.
    const dupRole =
      error && (error as { code?: string }).code === '23505'
        ? singletonRoleFromIndexError(error.message)
        : null;
    const friendly = dupRole
      ? singletonRoleDuplicateMessage(dupRole)
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

  // Smart seat-plan Phase 5: auto-place the new guest (+ any +1) into a
  // provisional seat. Best-effort — never blocks the add.
  await applyReconcileForEvent(supabase, eventId);

  // Account auto-surface (#7b) — flag-gated OFF; a no-op until counsel clears
  // FEATURE_ACCOUNT_AUTOSURFACE. Surfaces the event into the guest's own account
  // when their person resolves to an already-claimed account.
  await maybeAutoSurfaceEventForGuest(createAdminClient(), eventId, inserted.guest_id);

  revalidatePath(`/dashboard/${eventId}/guests`);
  return redirect(`/dashboard/${eventId}/guests?added=1`);
}
