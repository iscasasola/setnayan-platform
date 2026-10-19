'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { GROUP_CATEGORY_LABELS, type GuestGroupTeamSide } from '@/lib/guests';
import { clashWords, groupNameClash, type GroupNameClash } from '@/lib/group-name-clash';

/**
 * group-edit-actions.ts — ✎ RENAME AND 🗑 DELETE A COUPLE'S OWN GROUP IN PLACE (owner 2026-10-20: *"before we can always
 * create a new group anytime and add or delete a group name."*; DECISION_LOG "GUEST CARD: ONE GROUP DROPDOWN AND ONE ROLE
 * DROPDOWN, EACH MULTI"; prototype `guest_group_and_fast_add_2026-10-20.html` A4 · A5).
 *
 * The ONE Group dropdown (`_components/guest-group-picker.tsx`) creates here too (`op: 'create'`, 2026-10-20 — the same
 * insert as the shipped `quickCreateGroup`, plus the name rule below; the capture bar's `#Group`, claims and the Quick add
 * sheet keep `quickCreateGroup`'s find-or-create). Renaming and deleting already exist — `updateGuestGroup` / `deleteGuestGroup` in
 * groups-actions.ts — but those REDIRECT to the guest list, which would navigate a card away mid-edit. These are the same
 * writes, RETURNING a result, with the same checks as `quickCreateGroup`: a signed-in user, this event's row only
 * (`.eq('event_id', …)`), and RLS on `guest_groups` (couples + admins) decides the rest.
 *
 * 🔑 A ZERO-ROW WRITE IS NOT SUCCESS. RLS refuses an update or a delete by matching no rows — no error — so each write
 * reads back the row it touched (`.select('group_id')`) and says "Couldn’t…" when there is none.
 *
 * Deleting a group removes ONLY the group: `guest_group_memberships.group_id` is `ON DELETE CASCADE`, so its guests
 * leave it and stay on the list (the confirm says exactly that, with their count — `countGuestGroupMembers`).
 *
 * 👥 ONE NAME, ONE GROUP (owner 2026-10-20: *"also not allow to have a group name similarly written on the group
 * already."*). Create (`op: 'create'`, the picker's ＋ New group… — on the guest's side) and rename both refuse a name that
 * `groupNameClash` (lib/group-name-clash.ts) finds among the standard groups or the own groups sharing a list with the
 * group's side — HERE, on the server, not only in the picker — and hand back which group it is (`clash`) so the picker
 * offers "Use “Family”". Rename keeps the group's side: it writes the name only.
 */

export type GroupEditResult =
  | { ok: true; group: { group_id: string; label: string } }
  | { ok: false; error: string; clash?: GroupNameClash };
export type GroupCountResult = { ok: true; n: number } | { ok: false; error: string };

/**
 * 🧮 ONE exported action, three writes (the route budget: every exported server action is a Vercel route, and the repo
 * sits at its ceiling — `scripts/lint-server-action-budget.mjs`). The helpers below are module-private.
 */
export type GroupEdit = { op: 'create'; label: string; side: GuestGroupTeamSide } | { op: 'rename'; label: string } | { op: 'delete' } | { op: 'count' };
export async function editGuestGroupInPlace(eventId: string, groupId: string, edit: GroupEdit): Promise<GroupEditResult | GroupCountResult> {
  if (edit.op === 'create') return createGuestGroupInPlace(eventId, edit.label, edit.side);
  if (edit.op === 'rename') return renameGuestGroupInPlace(eventId, groupId, edit.label);
  if (edit.op === 'delete') return deleteGuestGroupInPlace(eventId, groupId);
  return countGuestGroupMembers(eventId, groupId);
}

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

const STANDARD = Object.entries(GROUP_CATEGORY_LABELS).map(([key, label]) => ({ key, label }));
const asSide = (v: unknown): GuestGroupTeamSide => (v === 'bride' || v === 'groom' ? v : 'both');

type Db = NonNullable<Awaited<ReturnType<typeof signedIn>>>;
/** This event's own groups, with their sides — for the name rule. A refused read refuses the write (never "no clash"). */
async function ownGroupsOf(supabase: Db, eventId: string) {
  const { data, error } = await supabase.from('guest_groups').select('group_id, label, team_side').eq('event_id', eventId);
  if (error) return null;
  return ((data ?? []) as { group_id: string; label: string | null; team_side: string | null }[]).map((g) => ({ groupId: g.group_id, label: g.label ?? '', teamSide: asSide(g.team_side) }));
}

async function createGuestGroupInPlace(eventId: string, rawLabel: string, rawSide: unknown): Promise<GroupEditResult> {
  const label = (rawLabel ?? '').trim();
  if (!label) return { ok: false, error: 'Type a group name.' };
  if (label.length > 64) return { ok: false, error: 'Keep it under 64 characters.' };
  const side = asSide(rawSide);
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: 'Your session expired — sign in again.' };
  const own = await ownGroupsOf(supabase, eventId);
  if (!own) return { ok: false, error: 'Couldn’t make that group.' };
  const clash = groupNameClash(label, side, STANDARD, own);
  if (clash) return { ok: false, error: clashWords(clash), clash };
  const { data, error } = await supabase.from('guest_groups').insert({ event_id: eventId, label, team_side: side }).select('group_id, label');
  if (error) return { ok: false, error: (error as { code?: string }).code === '23505' ? 'A group with that name already exists.' : error.message };
  const row = (data ?? [])[0] as { group_id: string; label: string } | undefined;
  if (!row) return { ok: false, error: 'Couldn’t make that group.' };
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, group: { group_id: row.group_id, label: row.label } };
}

async function renameGuestGroupInPlace(eventId: string, groupId: string, rawLabel: string): Promise<GroupEditResult> {
  const label = (rawLabel ?? '').trim();
  if (!label) return { ok: false, error: 'Type a group name.' };
  if (label.length > 64) return { ok: false, error: 'Keep it under 64 characters.' };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: 'Your session expired — sign in again.' };
  const own = await ownGroupsOf(supabase, eventId);
  const self = own?.find((g) => g.groupId === groupId);
  if (!own || !self) return { ok: false, error: 'Couldn’t rename that group.' };
  const clash = groupNameClash(label, self.teamSide, STANDARD, own, groupId);
  if (clash) return { ok: false, error: clashWords(clash), clash };
  const { data, error } = await supabase
    .from('guest_groups')
    .update({ label })
    .eq('event_id', eventId)
    .eq('group_id', groupId)
    .select('group_id, label');
  if (error) {
    return (error as { code?: string }).code === '23505'
      ? { ok: false, error: 'A group with that name already exists.' }
      : { ok: false, error: error.message };
  }
  const row = (data ?? [])[0] as { group_id: string; label: string } | undefined;
  if (!row) return { ok: false, error: 'Couldn’t rename that group.' };
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, group: { group_id: row.group_id, label: row.label } };
}

async function deleteGuestGroupInPlace(eventId: string, groupId: string): Promise<GroupEditResult> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: 'Your session expired — sign in again.' };
  const { data, error } = await supabase
    .from('guest_groups')
    .delete()
    .eq('event_id', eventId)
    .eq('group_id', groupId)
    .select('group_id, label');
  if (error) return { ok: false, error: error.message };
  const row = (data ?? [])[0] as { group_id: string; label: string } | undefined;
  if (!row) return { ok: false, error: 'Couldn’t delete that group.' };
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, group: { group_id: row.group_id, label: row.label } };
}

/**
 * How many guests on the list are in a group — the delete's "N guests are in it". Guests still on the list only (a removed
 * guest's membership is not a person in the group). A refused read is a refusal, never a 0: the confirm then says what
 * happens without a number.
 */
async function countGuestGroupMembers(eventId: string, groupId: string): Promise<GroupCountResult> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: 'Your session expired — sign in again.' };
  const { data: group, error: groupError } = await supabase
    .from('guest_groups')
    .select('group_id')
    .eq('event_id', eventId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (groupError || !group) return { ok: false, error: groupError?.message ?? 'Couldn’t read that group.' };
  const { count, error } = await supabase
    .from('guest_group_memberships')
    .select('guest_id, guests!inner(deleted_at)', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .is('guests.deleted_at', null);
  if (error || count === null) return { ok: false, error: error?.message ?? 'Couldn’t count that group.' };
  return { ok: true, n: count };
}
