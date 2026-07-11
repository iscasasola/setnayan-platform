'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import {
  GUEST_GROUP_TEAM_SIDES,
  SINGLETON_GUEST_ROLES,
  singletonRoleDuplicateMessage,
  singletonRoleFromIndexError,
  type GuestGroupTeamSide,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import type { ReleasedSeat } from '@/lib/guest-optimistic';

// Side enum values — owner directive 2026-05-23 added bulk Side
// assignment to the SelectionBar. Mirrors the existing per-guest side
// picker (GuestSide = 'bride' | 'groom' | 'both').
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];

// Iteration 0053 P4 Unit 5: the bulk-assignable role set is per event type.
// For WEDDINGS we keep the exact pre-0053 list (BYTE-IDENTICAL — note it is the
// historical 20-value set that, by a pre-existing quirk, includes bride/groom
// but NOT the 4 VIP-family roles; we preserve that exactly rather than widen it
// to the 24-value offeredRoles). For non-weddings we accept the generic
// profile's offeredRoles. Resolved per-action via resolveRoleSetForEvent(eventId).
const WEDDING_BULK_ROLE_VALUES: GuestRole[] = [
  'guest',
  'bride',
  'groom',
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

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

function parseGuestIds(formData: FormData): string[] {
  // Hidden inputs from the client component come through as repeated
  // entries with name="guest_ids[]". We also accept a single
  // comma-separated "guest_ids" field as a fallback.
  const collected = new Set<string>();
  for (const entry of formData.getAll('guest_ids[]')) {
    const v = String(entry).trim();
    if (v) collected.add(v);
  }
  const fallback = clean(formData.get('guest_ids'));
  if (fallback) {
    for (const v of fallback.split(',')) {
      const t = v.trim();
      if (t) collected.add(t);
    }
  }
  return Array.from(collected);
}

function backToList(eventId: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/dashboard/${eventId}/guests?${q.toString()}`;
}

// -----------------------------------------------------------------------
// Bulk role assign · updates `role` for N guests in a single statement.
// Honors SINGLETON_GUEST_ROLES — bride + groom can only be ONE per event,
// so bulk-assigning multiple guests to a singleton is rejected with a
// polite error message redirect.
// -----------------------------------------------------------------------

export async function bulkAssignGuestRole(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const role = clean(formData.get('role')) as GuestRole;
  const guestIds = parseGuestIds(formData);

  const roleSet = await resolveRoleSetForEvent(eventId);
  const allowedRoles =
    roleSet.key === 'wedding' ? WEDDING_BULK_ROLE_VALUES : roleSet.offeredRoles;
  if (!allowedRoles.includes(role)) {
    redirect(backToList(eventId, { error: 'invalid_role' }));
  }
  if (guestIds.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
  }
  if (
    SINGLETON_GUEST_ROLES.includes(role) &&
    guestIds.length > 1
  ) {
    const label = role === 'bride' ? 'Bride' : 'Groom';
    redirect(
      backToList(eventId, {
        error: encodeURIComponent(
          `Only one ${label} per event — pick a single guest for this role.`,
        ),
      }),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guests')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('guest_id', guestIds);

  if (error) {
    // 23505 from the partial unique indexes — fires when someone tries to set a
    // second singleton (bride/groom or Muslim wali/imam/wakil) even via the
    // bulk path (e.g. via a race with another tab).
    const dupRole =
      (error as { code?: string }).code === '23505'
        ? singletonRoleFromIndexError(error.message)
        : null;
    const friendly = dupRole
      ? singletonRoleDuplicateMessage(dupRole)
      : error.message;
    redirect(backToList(eventId, { error: encodeURIComponent(friendly) }));
  }

  // Smart seat-plan Phase 5: role drives the seating tier — re-place the changed guests.
  await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: guestIds });

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, {
      bulk_assigned: String(guestIds.length),
    }),
  );
}

// -----------------------------------------------------------------------
// Bulk add to existing group · upserts memberships for N guests.
// -----------------------------------------------------------------------

export async function bulkAddGuestsToGroup(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const groupId = clean(formData.get('group_id'));
  const guestIds = parseGuestIds(formData);

  if (!groupId) {
    redirect(backToList(eventId, { error: 'invalid_group' }));
  }
  if (guestIds.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
  }

  const supabase = await createClient();

  // Verify the group belongs to this event before inserting — RLS would
  // catch a cross-event insert too, but an explicit check gives us a
  // friendlier error path.
  const { data: groupRow, error: groupErr } = await supabase
    .from('guest_groups')
    .select('event_id')
    .eq('group_id', groupId)
    .maybeSingle();

  if (groupErr || !groupRow || groupRow.event_id !== eventId) {
    redirect(backToList(eventId, { error: 'invalid_group' }));
  }

  // upsert ignores already-existing memberships (group_id, guest_id PK).
  const rows = guestIds.map((guest_id) => ({ group_id: groupId, guest_id }));
  const { error } = await supabase
    .from('guest_group_memberships')
    .upsert(rows, { onConflict: 'group_id,guest_id', ignoreDuplicates: true });

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  // Smart seat-plan Phase 5: joining a group re-clusters these guests with it (#9).
  await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: guestIds });

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, {
      bulk_grouped: String(guestIds.length),
    }),
  );
}

// -----------------------------------------------------------------------
// Combined bulk apply — single Apply button on the toolbar (owner
// directive 2026-05-23 PM: "apply and add button should be 1 only and
// at the last, Apply").
//
// Reads `role` AND `group_id` from the same FormData. Each is optional;
// the action no-ops on whichever is empty and applies the other. The
// host's UI gives one Apply button, the server does the right thing
// per which selects were touched.
// -----------------------------------------------------------------------

export async function bulkApplyRoleAndGroup(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const rawRole = clean(formData.get('role'));
  const rawGroupId = clean(formData.get('group_id'));
  const rawSide = clean(formData.get('side'));
  const guestIds = parseGuestIds(formData);

  if (guestIds.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
  }
  if (!rawRole && !rawGroupId && !rawSide) {
    // Nothing to do — Apply was clicked with all three selects on
    // placeholder. Silent return rather than red-error since the host
    // might've meant to back out.
    redirect(backToList(eventId, {}));
  }

  const supabase = await createClient();
  let didRole = false;
  let didGroup = false;
  let didSide = false;

  // ---- Role half ----
  if (rawRole) {
    const role = rawRole as GuestRole;
    const roleSet = await resolveRoleSetForEvent(eventId);
    const allowedRoles =
      roleSet.key === 'wedding' ? WEDDING_BULK_ROLE_VALUES : roleSet.offeredRoles;
    if (!allowedRoles.includes(role)) {
      redirect(backToList(eventId, { error: 'invalid_role' }));
    }
    if (SINGLETON_GUEST_ROLES.includes(role) && guestIds.length > 1) {
      const label = role === 'bride' ? 'Bride' : 'Groom';
      redirect(
        backToList(eventId, {
          error: encodeURIComponent(
            `Only one ${label} per event — pick a single guest for this role.`,
          ),
        }),
      );
    }
    const { error } = await supabase
      .from('guests')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .in('guest_id', guestIds);
    if (error) {
      const dupRole =
        (error as { code?: string }).code === '23505'
          ? singletonRoleFromIndexError(error.message)
          : null;
      const friendly = dupRole
        ? singletonRoleDuplicateMessage(dupRole)
        : error.message;
      redirect(backToList(eventId, { error: encodeURIComponent(friendly) }));
    }
    didRole = true;
  }

  // ---- Side half (owner directive 2026-05-23) ----
  if (rawSide) {
    const side = rawSide as GuestSide;
    if (!SIDE_VALUES.includes(side)) {
      redirect(backToList(eventId, { error: 'invalid_side' }));
    }
    const { error } = await supabase
      .from('guests')
      .update({ side, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .in('guest_id', guestIds);
    if (error) {
      redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
    }
    didSide = true;
  }

  // ---- Group half ----
  if (rawGroupId) {
    const { data: groupRow, error: groupErr } = await supabase
      .from('guest_groups')
      .select('event_id')
      .eq('group_id', rawGroupId)
      .maybeSingle();
    if (groupErr || !groupRow || groupRow.event_id !== eventId) {
      redirect(backToList(eventId, { error: 'invalid_group' }));
    }
    const rows = guestIds.map((guest_id) => ({
      group_id: rawGroupId,
      guest_id,
    }));
    const { error } = await supabase
      .from('guest_group_memberships')
      .upsert(rows, { onConflict: 'group_id,guest_id', ignoreDuplicates: true });
    if (error) {
      redirect(
        backToList(eventId, { error: encodeURIComponent(error.message) }),
      );
    }
    didGroup = true;
  }

  // Smart seat-plan Phase 5: re-place the changed guests when role or group moved
  // (a side-only change doesn't affect the seating tier, so it's skipped).
  if (didRole || didGroup) {
    await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: guestIds });
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, {
      ...(didRole ? { bulk_assigned: String(guestIds.length) } : {}),
      ...(didGroup ? { bulk_grouped: String(guestIds.length) } : {}),
      ...(didSide ? { bulk_sided: String(guestIds.length) } : {}),
    }),
  );
}

// -----------------------------------------------------------------------
// Create group · also accepts an optional preselected list of guest_ids
// to add at creation time (the multi-select bar "Add to NEW group…" path).
// -----------------------------------------------------------------------

export async function createGuestGroup(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const label = clean(formData.get('label'));
  const teamSideRaw = clean(formData.get('team_side')) || 'both';
  const teamSide = (
    GUEST_GROUP_TEAM_SIDES.includes(teamSideRaw as GuestGroupTeamSide)
      ? teamSideRaw
      : 'both'
  ) as GuestGroupTeamSide;
  const guestIds = parseGuestIds(formData);

  if (!label || label.length > 64) {
    redirect(backToList(eventId, { error: 'invalid_group_label' }));
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from('guest_groups')
    .insert({ event_id: eventId, label, team_side: teamSide })
    .select('group_id')
    .single();

  if (error || !inserted) {
    // 23505 from the case-insensitive unique index — friendlier copy
    // than the raw constraint name.
    const friendly =
      error && (error as { code?: string }).code === '23505'
        ? 'A group with that name already exists for this event.'
        : (error?.message ?? 'insert_failed');
    redirect(backToList(eventId, { error: encodeURIComponent(friendly) }));
  }

  // Auto-attach any preselected guests so a single submit covers both
  // "new group" + "add these guests to it".
  if (guestIds.length > 0) {
    const rows = guestIds.map((guest_id) => ({
      group_id: inserted.group_id,
      guest_id,
    }));
    await supabase
      .from('guest_group_memberships')
      .upsert(rows, { onConflict: 'group_id,guest_id', ignoreDuplicates: true });
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, {
      group: inserted.group_id,
      group_created: '1',
    }),
  );
}

// -----------------------------------------------------------------------
// Edit / delete group · admin actions reachable from the sidebar kebab.
// -----------------------------------------------------------------------

export async function updateGuestGroup(
  eventId: string,
  groupId: string,
  formData: FormData,
): Promise<void> {
  const label = clean(formData.get('label'));
  const teamSideRaw = clean(formData.get('team_side')) || 'both';
  const teamSide = (
    GUEST_GROUP_TEAM_SIDES.includes(teamSideRaw as GuestGroupTeamSide)
      ? teamSideRaw
      : 'both'
  ) as GuestGroupTeamSide;

  if (!label || label.length > 64) {
    redirect(backToList(eventId, { error: 'invalid_group_label' }));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guest_groups')
    .update({ label, team_side: teamSide })
    .eq('event_id', eventId)
    .eq('group_id', groupId);

  if (error) {
    const friendly =
      (error as { code?: string }).code === '23505'
        ? 'A group with that name already exists for this event.'
        : error.message;
    redirect(backToList(eventId, { error: encodeURIComponent(friendly) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, {
      group: groupId,
      group_saved: '1',
    }),
  );
}

export async function deleteGuestGroup(
  eventId: string,
  groupId: string,
  _formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('guest_groups')
    .delete()
    .eq('event_id', eventId)
    .eq('group_id', groupId);

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(backToList(eventId, { group_deleted: '1' }));
}

// -----------------------------------------------------------------------
// Remove a single guest from a group · used by the "Remove from group"
// chip on each guest row when viewing a custom-group view.
// -----------------------------------------------------------------------

export async function removeGuestFromGroup(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const groupId = clean(formData.get('group_id'));
  const guestId = clean(formData.get('guest_id'));

  if (!groupId || !guestId) {
    redirect(backToList(eventId, { error: 'invalid_input' }));
  }

  const supabase = await createClient();
  // RLS gates the delete to this event's couples + admins; we still
  // double-check the group's event for an explicit error path.
  const { data: groupRow } = await supabase
    .from('guest_groups')
    .select('event_id')
    .eq('group_id', groupId)
    .maybeSingle();
  if (!groupRow || groupRow.event_id !== eventId) {
    redirect(backToList(eventId, { error: 'invalid_group' }));
  }

  const { error } = await supabase
    .from('guest_group_memberships')
    .delete()
    .eq('group_id', groupId)
    .eq('guest_id', guestId);

  if (error) {
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, {
      group: groupId,
      group_member_removed: '1',
    }),
  );
}

// -----------------------------------------------------------------------
// Bulk soft-delete · owner directive 2026-05-23. Deletes the selected
// guests AND releases their seat assignments so the seats open up for
// other guests. Blocks when any guest has already RSVP'd
// (rsvp_status != 'pending') — owner's phrasing: "delete cannot be
// performed when RSVP has been already set".
//
// "RSVP set" = anything other than 'pending'. The 4 enum values are
// pending / attending / declined / maybe — pending is the only "no
// response yet" state. The other three all imply the guest engaged
// with the invitation, so removing them silently would wipe legitimate
// signal (an attending count drops, a declined gets re-invited, etc.).
//
// Seat release: event_seat_assignments has a FK to guests with ON
// DELETE CASCADE — but we soft-delete (set deleted_at) instead of hard
// DELETE, so the FK cascade never fires. We DELETE the assignment rows
// explicitly to match the cascade intent. Safe to call against guests
// with no seat assignment — DELETE just affects 0 rows.
// -----------------------------------------------------------------------

export async function bulkSoftDeleteGuests(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const guestIds = parseGuestIds(formData);

  if (guestIds.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
  }

  const supabase = await createClient();

  // Pre-flight: load every selected guest's current RSVP status +
  // display name. We need names for the error message + statuses for
  // the gate. Filtering on event_id + .in('guest_id', ...) + deleted_at
  // IS NULL is RLS-safe (couple sees their own event's guests).
  const { data: rows, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, role, rsvp_status, first_name, last_name, display_name')
    .eq('event_id', eventId)
    .in('guest_id', guestIds)
    .is('deleted_at', null);

  if (readErr) {
    redirect(backToList(eventId, { error: encodeURIComponent(readErr.message) }));
  }
  if (!rows || rows.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
  }

  // Couple gate (owner directive 2026-06-03) — the bride & groom are the
  // foundation of the event and can never be removed. Block the whole batch if
  // any is selected so the host gets a couple-specific message rather than the
  // RSVP-gate copy (the couple is always Attending, which would trip it).
  if (rows.some((r) => r.role === 'bride' || r.role === 'groom')) {
    redirect(
      backToList(eventId, {
        error: encodeURIComponent(
          "The bride and groom can't be removed — they're the foundation of the event. Deselect them and try again.",
        ),
      }),
    );
  }

  // RSVP-set gate. If ANY selected guest has a non-pending RSVP, block
  // the entire operation + surface the first few names so the host
  // knows which guests need their RSVP reset before they can be
  // removed. All-or-nothing matches the spirit of "delete cannot be
  // performed when RSVP has been already set" — we don't silently
  // delete the deletable subset.
  const blocked = rows.filter((r) => r.rsvp_status !== 'pending');
  if (blocked.length > 0) {
    const names = blocked
      .slice(0, 3)
      .map((r) =>
        r.display_name?.trim() || `${r.first_name} ${r.last_name}`.trim(),
      )
      .filter(Boolean);
    const tail =
      blocked.length > 3 ? ` (and ${blocked.length - 3} more)` : '';
    const friendly = `Can't delete — ${names.join(', ')}${tail} already RSVP'd. Reset their RSVP to "Pending" first.`;
    redirect(backToList(eventId, { error: encodeURIComponent(friendly) }));
  }

  // Release seat assignments for the qualifying guests. Best-effort —
  // an error here is logged via the redirect path but we don't block
  // the soft-delete (a guest's row living past the seat-DELETE failure
  // is recoverable; the seat will just need a manual unassign).
  await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .in('guest_id', guestIds);

  // Soft-delete.
  const { error: updateErr } = await supabase
    .from('guests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('guest_id', guestIds);

  if (updateErr) {
    redirect(
      backToList(eventId, { error: encodeURIComponent(updateErr.message) }),
    );
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(
    backToList(eventId, { bulk_deleted: String(rows.length) }),
  );
}

// -----------------------------------------------------------------------
// Living Roster P1 · optimistic delete + undo.
//
// `bulkSoftDeleteGuests` above (FormData → redirect) still backs the mobile
// swipe-to-delete path unchanged. The desktop SelectionBar now deletes WITHOUT
// a confirm dialog: it hides the rows optimistically and drops a 6s undo
// snackbar. That flow needs actions that RETURN a result (to build the undo)
// rather than redirect, so the pair below mirrors the gates of
// `bulkSoftDeleteGuests` but (a) captures the released seats before deleting so
// an undo can re-place them, and (b) returns `{ ok, removedIds, releasedSeats }`
// instead of navigating. `restoreDeletedGuests` is the inverse — it un-soft-
// deletes and re-inserts those seats.
//
// RLS: `couple_writes_guest` is FOR ALL and NOT gated on `deleted_at IS NULL`
// (only the SELECT read policy is), so a couple can flip `deleted_at` back to
// NULL. `event_seat_assignments` accepts couple upserts (the seat editor writes
// under the user client). Seat restore is best-effort — if the exact chair was
// re-taken during the undo window, the guest is still restored (just unseated),
// never a hard failure.
// -----------------------------------------------------------------------

export type SoftDeleteForUndoResult =
  | { ok: true; removedIds: string[]; releasedSeats: ReleasedSeat[] }
  | { ok: false; error: string };

export async function bulkSoftDeleteGuestsForUndo(
  eventId: string,
  guestIds: string[],
): Promise<SoftDeleteForUndoResult> {
  const ids = Array.from(
    new Set((guestIds ?? []).map((s) => String(s).trim()).filter(Boolean)),
  );
  if (ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  const supabase = await createClient();

  // Same pre-flight as bulkSoftDeleteGuests: RSVP status + names + role for the
  // gates. RLS scopes the read to the couple's own event.
  const { data: rows, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, role, rsvp_status, first_name, last_name, display_name')
    .eq('event_id', eventId)
    .in('guest_id', ids)
    .is('deleted_at', null);

  if (readErr) return { ok: false, error: readErr.message };
  if (!rows || rows.length === 0) return { ok: false, error: 'Nothing selected.' };

  // Couple gate — bride & groom are never removable.
  if (rows.some((r) => r.role === 'bride' || r.role === 'groom')) {
    return {
      ok: false,
      error:
        "The bride and groom can't be removed — they're the foundation of the event.",
    };
  }

  // RSVP-set gate — all-or-nothing, same as the redirect path.
  const blocked = rows.filter((r) => r.rsvp_status !== 'pending');
  if (blocked.length > 0) {
    const names = blocked
      .slice(0, 3)
      .map((r) => r.display_name?.trim() || `${r.first_name} ${r.last_name}`.trim())
      .filter(Boolean);
    const tail = blocked.length > 3 ? ` (and ${blocked.length - 3} more)` : '';
    return {
      ok: false,
      error: `Can't delete — ${names.join(', ')}${tail} already RSVP'd. Reset their RSVP to "Pending" first.`,
    };
  }

  const removedIds = rows.map((r) => r.guest_id as string);

  // Capture seat placements BEFORE releasing them, so an undo can re-place the
  // guest on the exact same table/chair. (bulkSoftDeleteGuests drops these with
  // no capture — the undo path is the reason we read them first.)
  const { data: seatRows } = await supabase
    .from('event_seat_assignments')
    .select('guest_id, table_id, seat_number, locked')
    .eq('event_id', eventId)
    .in('guest_id', removedIds);

  const releasedSeats: ReleasedSeat[] = (seatRows ?? []).map((s) => ({
    guest_id: s.guest_id as string,
    table_id: s.table_id as string,
    seat_number: (s.seat_number as number | null) ?? null,
    locked: (s.locked as boolean | null) ?? false,
  }));

  // Release seats (matches the ON DELETE CASCADE intent for a soft-delete).
  await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .in('guest_id', removedIds);

  // Soft-delete.
  const { error: updateErr } = await supabase
    .from('guests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('guest_id', removedIds);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, removedIds, releasedSeats };
}

export type RestoreResult = { ok: boolean; error?: string };

export async function restoreDeletedGuests(
  eventId: string,
  guestIds: string[],
  seats: ReleasedSeat[],
): Promise<RestoreResult> {
  const ids = Array.from(
    new Set((guestIds ?? []).map((s) => String(s).trim()).filter(Boolean)),
  );
  if (ids.length === 0) return { ok: true };

  const supabase = await createClient();

  // Un-soft-delete. RLS (couple_writes_guest · FOR ALL, not deleted_at-gated)
  // lets the couple flip deleted_at back to NULL for their own event's guests.
  const { error: undeleteErr } = await supabase
    .from('guests')
    .update({ deleted_at: null })
    .eq('event_id', eventId)
    .in('guest_id', ids);

  if (undeleteErr) return { ok: false, error: undeleteErr.message };

  // Re-place seats — best-effort. Only the guests we just restored, scoped to
  // this event. Upsert on (event_id, guest_id) so a retry is idempotent; a
  // physical-chair collision (someone took the seat during the undo window)
  // leaves the guest restored-but-unseated rather than failing the whole undo.
  const restoreSet = new Set(ids);
  const seatRows = (seats ?? [])
    .filter((s) => s && restoreSet.has(s.guest_id))
    .map((s) => ({
      event_id: eventId,
      guest_id: s.guest_id,
      table_id: s.table_id,
      seat_number: s.seat_number,
      locked: s.locked,
    }));

  if (seatRows.length > 0) {
    await supabase
      .from('event_seat_assignments')
      .upsert(seatRows, { onConflict: 'event_id,guest_id' });
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true };
}
