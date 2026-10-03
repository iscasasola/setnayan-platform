'use server';

import { redirect } from 'next/navigation';
import { bulkAssignableRolesFor } from '@/lib/bulk-role-vocabulary';
import { revalidatePath } from 'next/cache';
import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import {
  GUEST_GROUP_TEAM_SIDES,
  REQUEST_ENTRY_SOURCE,
  SINGLETON_GUEST_ROLES,
  singletonRoleDuplicateMessage,
  singletonRoleFromIndexError,
  type GuestGroupTeamSide,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import type { ReleasedSeat } from '@/lib/guest-optimistic';
import { restorableSongRequests, type ReleasedSongRequest } from '@/lib/released-song-requests';

// Side enum values — owner directive 2026-05-23 added bulk Side
// assignment to the SelectionBar. Mirrors the existing per-guest side
// picker (GuestSide = 'bride' | 'groom' | 'both').
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];

// Iteration 0053 P4 Unit 5: the bulk-assignable role set is per event type,
// and comes from `lib/bulk-role-vocabulary.ts` — THE SAME export the picker
// renders from.
//
// 🪤 THIS COMMENT USED TO DESCRIBE THE BUG AS A FEATURE. It said the wedding
// list was kept "BYTE-IDENTICAL ... includes bride/groom but NOT the 4
// VIP-family roles; we preserve that exactly rather than widen it" — so the
// divergence from the picker was known, written down, and deliberately
// preserved. What it never said is that the picker OFFERS those four, which
// made "Bride's Parents" selectable and un-appliable (reported 2026-09-14).
// A quirk you can describe is still a defect if a host can hit it.

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
// have been callerless ever since — the live toolbar (the bulk bar in
// `_components/guest-list-multiselect.tsx`) binds only the combined one.
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

/**
 * SET TABLE ▾ for the ticked rows (owner 2026-09-30, the Fable rows' bulk bar:
 * "Invite selected · Set group ▾ · Set table ▾ · ⋯"). One table for every
 * ticked guest, or `null` for "No table".
 *
 * Only guests who can sit are moved: a guest who is not coming, passed away,
 * or is a request is left alone (and counted as skipped, never as seated). A
 * guest already at that table keeps their chair; a move keeps none (the seat
 * plan places them at the new table). The table must be THIS event's — RLS on
 * the seat row scopes the event, not the table (`restoreGuestRsvpAndSeat`).
 */
async function setTableForGuests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  guestIds: string[],
  tableId: string | null,
): Promise<{ ok: true; moved: number; skipped: number } | { ok: false; error: string }> {
  const ids = [...new Set(guestIds)].slice(0, 1000);
  if (tableId) {
    const { data: table } = await supabase.from('event_tables').select('event_id').eq('table_id', tableId).maybeSingle();
    if (!table || table.event_id !== eventId) return { ok: false, error: 'That table isn’t part of this event.' };
  }
  const { data: rows, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, rsvp_status, passed_away, entry_source')
    .eq('event_id', eventId)
    .in('guest_id', ids)
    .is('deleted_at', null);
  if (readErr) return { ok: false, error: 'Couldn’t read those guests — nothing was moved.' };
  const canSit = (rows ?? [])
    .filter((r) => r.rsvp_status !== 'declined' && r.passed_away !== true && r.entry_source !== REQUEST_ENTRY_SOURCE)
    .map((r) => r.guest_id as string);
  const skipped = ids.length - canSit.length;
  if (canSit.length === 0) return { ok: true, moved: 0, skipped };

  if (!tableId) {
    const { error } = await supabase.from('event_seat_assignments').delete().eq('event_id', eventId).in('guest_id', canSit);
    if (error) return { ok: false, error: 'The tables could not be cleared just now. Please try again.' };
    return { ok: true, moved: canSit.length, skipped };
  }
  const { data: already } = await supabase
    .from('event_seat_assignments')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('table_id', tableId)
    .in('guest_id', canSit);
  const there = new Set((already ?? []).map((r) => r.guest_id as string));
  const move = canSit.filter((id) => !there.has(id));
  if (move.length > 0) {
    const { error } = await supabase
      .from('event_seat_assignments')
      .upsert(
        move.map((guest_id) => ({ event_id: eventId, guest_id, table_id: tableId, seat_number: null })),
        { onConflict: 'event_id,guest_id' },
      );
    if (error) return { ok: false, error: 'The table could not be set just now. Please try again.' };
  }
  return { ok: true, moved: canSit.length, skipped };
}

export async function bulkApplyRoleAndGroup(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const rawRole = clean(formData.get('role'));
  const rawGroupId = clean(formData.get('group_id'));
  const rawSide = clean(formData.get('side'));
  // Set table ▾ (owner 2026-09-30, the Fable rows' bulk bar): a table id, or
  // `none` for "No table". Rides this one action (+0 server actions).
  const rawTable = clean(formData.get('table'));
  const guestIds = parseGuestIds(formData);

  if (guestIds.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
  }
  if (rawTable) {
    const supabase = await createClient();
    const res = await setTableForGuests(supabase, eventId, guestIds, rawTable === 'none' ? null : rawTable);
    if (!res.ok) redirect(backToList(eventId, { error: encodeURIComponent(res.error) }));
    revalidatePath(`/dashboard/${eventId}/guests`);
    revalidatePath(`/dashboard/${eventId}/seating`);
    redirect(backToList(eventId, { bulk_seated: String(res.moved), ...(res.skipped > 0 ? { bulk_unseatable: String(res.skipped) } : {}) }));
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
    // Validate against EXACTLY what the picker offered — one derived list, not
    // a second hand-typed one. The previous literal rejected the four
    // VIP-family roles the picker shows (bride_parents / groom_parents /
    // bride_immediate_family / groom_immediate_family), so a host could pick
    // "Bride's Parents" and be bounced on Apply; it also ALLOWED bride/groom,
    // which the picker deliberately never offers. Both halves are fixed by
    // reading the same export.
    const allowedRoles = bulkAssignableRolesFor(roleSet.key);
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
// ── THE GATE ──────────────────────────────────────────────────────────────
// The couple is blocked outright — they are the foundation of the event.
// ⚖ The 2026-05-23 RSVP gate ("reset their RSVP to Pending first") is RETIRED
// (owner 2026-10-03, DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
// ACCEPTED"): any reply state may be deleted, behind one in-page warning that
// says what goes with them. Their +1 goes in the same soft-delete.
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
  | { ok: true; removedIds: string[]; releasedSeats: ReleasedSeat[]; releasedSongs: ReleasedSongRequest[] }
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

  // ⚖ NO RSVP GATE (owner 2026-10-03, DECISION_LOG "A HOST CAN DELETE A GUEST
  // WHO ALREADY ACCEPTED"): *"add a way to delete someone even if they accepted
  // just note that deleting them will automatically remove their decisions and
  // everything with it"*. The 2026-05-23 "reset their RSVP to Pending first"
  // rule is retired — in the live test it refused an attending guest and the
  // row silently came back. The warning the host confirms now says what goes
  // with them (`deleteWarningText`, _components/guest-delete.tsx).

  // THEIR +1 GOES WITH THEM — the warning says so, so it must be true. A named
  // +1 is its own row pointing at its bringer (`plus_one_of_guest_id`); left
  // behind it would be a guest nobody invited. Taken in the same soft-delete,
  // so the same Undo brings them back together.
  const { data: plusOneRows, error: plusOneErr } = await supabase
    .from('guests')
    .select('guest_id')
    .eq('event_id', eventId)
    .in('plus_one_of_guest_id', rows.map((r) => r.guest_id as string))
    .is('deleted_at', null);
  if (plusOneErr) return { ok: false, error: plusOneErr.message };
  const removedIds = Array.from(
    new Set([...rows.map((r) => r.guest_id as string), ...(plusOneRows ?? []).map((r) => r.guest_id as string)]),
  );

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

  // Soft-delete. The RETURNING list is the guests that were REALLY deleted —
  // RLS decides that, so it is what everything below acts on.
  const { data: deletedRows, error: updateErr } = await supabase
    .from('guests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('guest_id', removedIds)
    .select('guest_id');

  if (updateErr) return { ok: false, error: updateErr.message };
  const deletedIds = (deletedRows ?? []).map((r) => r.guest_id as string);

  // ⚖ THEIR SONG REQUEST GOES WITH THEM — the warning the host confirmed says
  // so (`deleteWarningText`), so it must be true (owner 2026-10-03, DECISION_LOG
  // "A HOST CAN DELETE A GUEST WHO ALREADY ACCEPTED"). A soft delete leaves the
  // guest's row in place, and with it their `event_song_requests` (its FK only
  // acts on a HARD delete) — the act would still see the request of somebody
  // who is no longer on the list, and the song's one-per-event slot would stay
  // taken by them. So the requests are taken here and handed back with the
  // Undo (`restoreDeletedGuests` puts them back).
  // 🔑 Service role, because a host may read and decide requests but never
  // delete one (the table's grants). Scoped to exactly the guests RLS let this
  // host delete a moment ago, in this event, on the guest lane.
  let releasedSongs: ReleasedSongRequest[] = [];
  if (deletedIds.length > 0) {
    const admin = createAdminClient();
    const { data: songRows } = await admin
      .from('event_song_requests')
      .select('request_id, guest_id, song_id, requester_name, status, decided_by_vendor_profile_id, decided_at, created_at')
      .eq('event_id', eventId)
      .eq('origin', 'guest')
      .in('guest_id', deletedIds);
    releasedSongs = restorableSongRequests(songRows ?? [], new Set(deletedIds));
    if (releasedSongs.length > 0) {
      const { error: songErr } = await admin
        .from('event_song_requests')
        .delete()
        .eq('event_id', eventId)
        .in(
          'request_id',
          releasedSongs.map((r) => r.request_id),
        );
      // Not taken → nothing to hand back; the Undo must not re-add a row that is still there.
      if (songErr) releasedSongs = [];
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  // 🔑 Carried over from the retired `softDeleteGuest`: the story's consent veto
  // is built from guests who opted out AND are not deleted, so a delete can
  // lift a veto — the cached public surfaces must hear about it now.
  await everyCopyIsNowStale(eventId);
  return { ok: true, removedIds, releasedSeats, releasedSongs };
}

/** `warning`: the guests came back, but something that went with them did not. */
export type RestoreResult = { ok: boolean; error?: string; warning?: string };

export async function restoreDeletedGuests(
  eventId: string,
  guestIds: string[],
  seats: ReleasedSeat[],
  songs: ReleasedSongRequest[] = [],
): Promise<RestoreResult> {
  const ids = Array.from(
    new Set((guestIds ?? []).map((s) => String(s).trim()).filter(Boolean)),
  );
  if (ids.length === 0) return { ok: true };

  const supabase = await createClient();

  // Un-soft-delete. RLS (couple_writes_guest · FOR ALL, not deleted_at-gated)
  // lets the couple flip deleted_at back to NULL for their own event's guests.
  const { data: restoredRows, error: undeleteErr } = await supabase
    .from('guests')
    .update({ deleted_at: null })
    .eq('event_id', eventId)
    .in('guest_id', ids)
    .select('guest_id');

  if (undeleteErr) return { ok: false, error: undeleteErr.message };

  // Their song requests come back with them — only for guests RLS really
  // restored just now, in this event, on the guest lane (`restorableSongRequests`
  // re-checks every field the client handed back). A song somebody else asked
  // for during the Undo window keeps their request (one per song per event).
  const songRows = restorableSongRequests(
    songs ?? [],
    new Set((restoredRows ?? []).map((r) => r.guest_id as string)),
  );
  let warning: string | undefined;
  if (songRows.length > 0) {
    const { error: songErr } = await createAdminClient()
      .from('event_song_requests')
      .upsert(
        songRows.map((r) => ({ ...r, event_id: eventId, origin: 'guest', anon_key: null })),
        { onConflict: 'event_id,song_id', ignoreDuplicates: true },
      );
    // Said where the host pressed Undo — never a restore that looks complete.
    if (songErr) warning = 'They are back, but their song request could not be put back.';
  }

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
  // An undo can put a consent veto back — same reason as the delete above.
  await everyCopyIsNowStale(eventId);
  return { ok: true, warning };
}
