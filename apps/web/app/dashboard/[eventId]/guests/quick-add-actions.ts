'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { guestEditsLocked } from '@/lib/pax';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import {
  defaultInvitedToForRole,
  SINGLETON_GUEST_ROLES,
  singletonRoleConflictMessage,
  singletonRoleDuplicateMessage,
  singletonRoleFromIndexError,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { normalizeGuestName } from '@/lib/guest-name';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { pickReuseGroup } from '@/lib/guest-group-reuse';

// Iteration 0053 P2: the valid role set is per event type — each action below
// resolves it via resolveRoleSetForEvent(eventId) (wedding → the 24-role set;
// singletons bride/groom stay offered, the DB partial-unique index guards a
// second one and we surface a friendly error).
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
  const first_name = normalizeGuestName(input.first_name);
  const last_name = normalizeGuestName(input.last_name);
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
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };
  // Post-finalize guard (Adaptive Pax Pricing Phase 9); the DB trigger backs it.
  if (await guestEditsLocked(supabase, eventId)) {
    return { ok: false, error: 'Your guest list is finalized — the guest count is locked.' };
  }

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
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Quick-add guest (insert)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: error?.message ?? 'insert returned no row',
      payload_snapshot: { eventId, side, role },
    });
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

  // Smart seat-plan Phase 5: auto-place the new guest (clusters with its group
  // when one was picked). Best-effort — never blocks the add.
  await applyReconcileForEvent(supabase, eventId);

  revalidatePath(`/dashboard/${eventId}/guests`);
  return {
    ok: true,
    guest: { guest_id: inserted.guest_id, first_name, last_name, side, role },
  };
}

export type QuickGroupResult =
  // `created` distinguishes a FRESH insert (true) from the case-insensitive
  // find-or-create REUSE of a pre-existing group (false). The capture-bar
  // single-add (inline-actions.ts › addSingleGuest) reads it so that, when the
  // guest insert then fails, it deletes ONLY the groups it just minted and
  // never a group the couple already had. See T18 (orphan-groups on-failed-add).
  | { ok: true; group: { group_id: string; label: string }; created: boolean }
  | { ok: false; error: string };

/**
 * Create a custom guest group from the quick-add sheet's Group picker
 * (iteration 0001 — additive, 2026-06-02). Mirrors createGuestGroup
 * (groups-actions.ts) but RETURNS the new row instead of redirecting,
 * so the sheet stays open and can lock the new group for the next adds.
 *
 * team_side defaults to 'both' on this fast path (the host refines it in
 * the Groups sidebar). The case-insensitive unique index is treated as
 * idempotent: if a group with that name already exists for the event we
 * return it as success — the host wanted that group, it's already there.
 */
export async function quickCreateGroup(
  eventId: string,
  rawLabel: string,
): Promise<QuickGroupResult> {
  const label = (rawLabel ?? '').trim();
  if (!label) return { ok: false, error: 'Type a group name.' };
  if (label.length > 64) return { ok: false, error: 'Keep it under 64 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  // This fast path always creates on the 'both' team side (the host refines it
  // later in the Groups sidebar). Held in one const so the insert and the 23505
  // reuse-lookup below resolve the SAME (event_id, lower(label), team_side)
  // unique-index key.
  const teamSide = 'both';

  const { data: inserted, error } = await supabase
    .from('guest_groups')
    .insert({ event_id: eventId, label, team_side: teamSide })
    .select('group_id, label')
    .single();

  if (error || !inserted) {
    // 23505 from the case-insensitive unique index → reuse the existing
    // group of that name rather than erroring.
    if (error && (error as { code?: string }).code === '23505') {
      // The conflict is on (event_id, lower(label), team_side), so the row to
      // reuse shares our exact (label, teamSide) key. Fetch the same-label rows
      // and pick the team_side match in JS — a label-only `.maybeSingle()` also
      // caught cross-side namesakes (a bride-side + groom-side "Friends"), and
      // >1 row made maybeSingle throw, failing a legitimate reuse. The JS exact
      // compare also sidesteps `ilike` treating %/_ in a label as wildcards.
      const { data: candidates } = await supabase
        .from('guest_groups')
        .select('group_id, label, team_side')
        .eq('event_id', eventId)
        .ilike('label', label);
      const existing = pickReuseGroup(candidates ?? [], label, teamSide);
      if (existing) {
        // Reuse of a pre-existing group → created:false, so the caller never
        // deletes it during on-failed-add compensation.
        return {
          ok: true,
          group: { group_id: existing.group_id, label: existing.label },
          created: false,
        };
      }
      return { ok: false, error: 'A group with that name already exists.' };
    }
    return { ok: false, error: error?.message ?? 'Couldn’t create that group.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  // Fresh insert → created:true. Only these ids are eligible for the caller's
  // on-failed-add cleanup.
  return {
    ok: true,
    group: { group_id: inserted.group_id, label: inserted.label },
    created: true,
  };
}

export type QuickRoleResult =
  | {
      ok: true;
      guest: { guest_id: string; role: GuestRole; extra_roles: GuestRole[] };
    }
  | { ok: false; error: string };

// Canonical singleton list (lib/guests) — bride/groom + the Muslim Nikah
// singletons (wali/imam/wakil). Imported rather than re-declared so this guard
// can't drift from the DB partial-unique indexes.
const SINGLETON_ROLES: ReadonlyArray<GuestRole> = SINGLETON_GUEST_ROLES;

/**
 * Multi-role (iteration 0001 — 2026-06-02). When the quick-add finds a
 * same-name guest with a DIFFERENT role, the resolver can give that guest
 * a SECOND role instead of creating a duplicate. The primary `role` is
 * untouched (it keeps driving the seating tier + invite defaults); the
 * new role is appended to `extra_roles`.
 *
 * Singleton roles (Bride/Groom + the Muslim Nikah singletons wali/imam/
 * wakil) are one-per-event — guarded by the partial-unique indexes on the
 * primary `role` column and, for bride/groom, the
 * guests_extra_roles_no_singletons CHECK. The SINGLETON_ROLES guard below
 * blocks any of them from being added as a SECOND role here.
 */
export async function addRoleToGuest(
  eventId: string,
  guestId: string,
  rawRole: string,
): Promise<QuickRoleResult> {
  const role = rawRole as GuestRole;
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }
  if (SINGLETON_ROLES.includes(role)) {
    return { ok: false, error: singletonRoleConflictMessage(role) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  const { data: g, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, event_id, role, extra_roles')
    .eq('guest_id', guestId)
    .maybeSingle();
  if (readErr || !g || g.event_id !== eventId) {
    return { ok: false, error: 'Couldn’t find that guest.' };
  }

  const current: GuestRole[] = (g.extra_roles ?? []) as GuestRole[];
  // Already has it (as primary or extra) → no-op success.
  if (g.role === role || current.includes(role)) {
    return { ok: true, guest: { guest_id: g.guest_id, role: g.role, extra_roles: current } };
  }
  const next = [...current, role];

  const { error: updErr } = await supabase
    .from('guests')
    .update({ extra_roles: next })
    .eq('guest_id', guestId);
  if (updErr) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Add extra role to guest (update)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: updErr.message,
      payload_snapshot: { eventId, guestId, role },
    });
    return { ok: false, error: updErr.message ?? 'Couldn’t add that role.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, guest: { guest_id: g.guest_id, role: g.role, extra_roles: next } };
}

/**
 * Change a guest's PRIMARY role (the seating-tier / invite-defaults one).
 * If the new role was sitting in extra_roles, it's removed from there to
 * avoid a duplicate. Bride/Groom singletons surface the friendly 23505.
 */
export async function setGuestPrimaryRole(
  eventId: string,
  guestId: string,
  rawRole: string,
): Promise<QuickRoleResult> {
  const role = rawRole as GuestRole;
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  const { data: g, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, event_id, role, extra_roles')
    .eq('guest_id', guestId)
    .maybeSingle();
  if (readErr || !g || g.event_id !== eventId) {
    return { ok: false, error: 'Couldn’t find that guest.' };
  }

  const nextExtras = ((g.extra_roles ?? []) as GuestRole[]).filter((r) => r !== role);

  const { error: updErr } = await supabase
    .from('guests')
    .update({ role, extra_roles: nextExtras })
    .eq('guest_id', guestId);
  if (updErr) {
    const dupRole =
      (updErr as { code?: string }).code === '23505'
        ? singletonRoleFromIndexError(updErr.message)
        : null;
    const friendly = dupRole
      ? singletonRoleDuplicateMessage(dupRole)
      : (updErr.message ?? 'Couldn’t change that role.');
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Set guest primary role (update)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: updErr.message,
      payload_snapshot: { eventId, guestId, role },
    });
    return { ok: false, error: friendly };
  }

  // Smart seat-plan Phase 5: the primary role drives the seating tier, so
  // re-place this guest (and their +1) next to their new tier/group.
  await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: [guestId] });

  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, guest: { guest_id: g.guest_id, role, extra_roles: nextExtras } };
}
