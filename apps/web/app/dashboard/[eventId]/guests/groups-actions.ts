'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  GUEST_GROUP_TEAM_SIDES,
  SINGLETON_GUEST_ROLES,
  type GuestGroupTeamSide,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';

// Side enum values — owner directive 2026-05-23 added bulk Side
// assignment to the SelectionBar. Mirrors the existing per-guest side
// picker (GuestSide = 'bride' | 'groom' | 'both').
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];

const ROLE_VALUES: GuestRole[] = [
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

  if (!ROLE_VALUES.includes(role)) {
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
    // 23505 from migration 20260531010000 partial unique indexes — fires
    // when someone tries to set a second bride/groom even via the bulk
    // path (e.g. via a race with another tab).
    const friendly =
      (error as { code?: string }).code === '23505' &&
      /guests_one_(bride|groom)_per_event/.test(error.message)
        ? role === 'bride'
          ? 'Already a Bride in this event — change theirs first.'
          : 'Already a Groom in this event — change theirs first.'
        : error.message;
    redirect(backToList(eventId, { error: encodeURIComponent(friendly) }));
  }

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
    if (!ROLE_VALUES.includes(role)) {
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
      const friendly =
        (error as { code?: string }).code === '23505' &&
        /guests_one_(bride|groom)_per_event/.test(error.message)
          ? role === 'bride'
            ? 'Already a Bride in this event — change theirs first.'
            : 'Already a Groom in this event — change theirs first.'
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
      view: `group:${inserted.group_id}`,
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
      view: `group:${groupId}`,
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
      view: `group:${groupId}`,
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
    .select('guest_id, rsvp_status, first_name, last_name, display_name')
    .eq('event_id', eventId)
    .in('guest_id', guestIds)
    .is('deleted_at', null);

  if (readErr) {
    redirect(backToList(eventId, { error: encodeURIComponent(readErr.message) }));
  }
  if (!rows || rows.length === 0) {
    redirect(backToList(eventId, { error: 'no_selection' }));
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
