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
// `bulkAssignGuestRole` + `bulkAddGuestsToGroup` DELETED (2026-09-03).
//
// Both were folded into `bulkApplyRoleAndGroup` below on the owner's directive
// (2026-05-23 PM, verbatim): "apply and add button should be 1 only and at the
// last, Apply". That one action reads `role`, `group_id` AND `side` off the same
// FormData and no-ops on whichever is blank, so the two single-purpose halves
// have been callerless ever since — the live toolbars
// (`_components/guest-list-multiselect.tsx`, `_components/mobile-guest-carousel.tsx`)
// bind only the combined one.
//
// Do not re-split them. One Apply button is the decision, not an accident.
// -----------------------------------------------------------------------

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
// Living Roster P1 · optimistic delete + undo. THE ONLY WAY THIS PAGE REMOVES
// A GUEST (2026-09-06 — the redirect-based `bulkSoftDeleteGuests` that used to
// sit above this was deleted; see "why there is only one" below).
//
// It hides the rows optimistically and drops a 6s undo snackbar, so it needs
// actions that RETURN a result rather than redirect: this pair returns
// `{ ok, removedIds, releasedSeats }`. `restoreDeletedGuests` is the inverse —
// it un-soft-deletes and re-inserts those seats.
//
// ── THE GATES (owner directive 2026-05-23, carried over verbatim in effect) ──
// Blocks when any guest has already RSVP'd (`rsvp_status != 'pending'`) —
// owner's phrasing: "delete cannot be performed when RSVP has been already
// set". "RSVP set" = anything other than 'pending'. The 4 enum values are
// pending / attending / declined / maybe; pending is the only "no response
// yet" state. The other three all imply the guest engaged with the invitation,
// so removing them silently would wipe legitimate signal (an attending count
// drops, a declined gets re-invited). The couple is blocked outright — they are
// the foundation of the event.
//
// ── WHY THE SEAT IS DELETED EXPLICITLY ──────────────────────────────────────
// `event_seat_assignments` has a FK to `guests` with ON DELETE CASCADE — but we
// SOFT delete (set `deleted_at`), so the cascade never fires. The assignment
// rows are deleted explicitly to match the cascade's intent and free the chair.
// Safe against a guest with no seat: the DELETE just affects 0 rows.
//
// ── WHY THERE IS ONLY ONE OF THESE ──────────────────────────────────────────
// There were two. `bulkSoftDeleteGuests` (FormData → redirect) backed the phone
// swipe and released the seat WITHOUT capturing it; this one captures it first.
// So the same act, from a phone, permanently lost the guest's chair and offered
// no undo, while the desktop bulk bar could take it back in full — and from the
// roster the two looked identical. The swipe was moved onto this action, which
// left the other with no callers at all, and a dead lossy delete is just a
// waiting re-wire. It is gone. Its gates were byte-equivalent to these; nothing
// was lost but the duplication.
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

  // Pre-flight for the gates: RSVP status + names + role. RLS scopes the read
  // to the couple's own event.
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
  // guest on the exact same table/chair. This read IS the undo — without it the
  // chair is simply gone, which is what the deleted sibling action did.
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
