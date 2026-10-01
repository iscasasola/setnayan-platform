'use server';

/**
 * role-name-actions.ts — "Rename this role", from the Guest list.
 *
 * ⚖ Owner 2026-09-30: *"Bride'smaid can be renamed as what - for us we picked
 * Bride's Crew. Groomsmen can be renamed as what - for us we picked Groom's
 * Crew"*.
 *
 * Writes ONE key of `events.role_names`. The role itself (`guests.role`) is
 * never touched — see `lib/role-names.ts`.
 *
 * Same door as the Wedding March's section order: `requireHostMembership`, then
 * the admin client (the column has no session UPDATE grant, on purpose — see
 * its migration). Returns a result the picker says in place; never redirects.
 *
 * ⚠ READ-MODIFY-WRITE ON ONE JSONB. Two hosts renaming two different roles in
 * the same instant could lose one of the two words. Accepted: one couple, one
 * picker, a word they can see and re-type. Not accepted anywhere money is.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { requireHostMembership } from '@/lib/host-gate';
import { revalidateMarch } from '@/lib/entourage-write';
import { cleanRoleName, isRenamableRole, type RoleNames } from '@/lib/role-names';
import { isKnownGuestRole, readRoleNames } from '@/lib/role-names.server';
import { revalidatePath } from 'next/cache';

export type RenameRoleResult =
  | { ok: true; names: RoleNames }
  | { ok: false; reason: string };

export async function renameRole(
  eventId: string,
  role: string,
  one: string,
  many?: string | null,
): Promise<RenameRoleResult> {
  await requireHostMembership(eventId);
  if (!isKnownGuestRole(role) || !isRenamableRole(role)) {
    return { ok: false, reason: 'That role can’t be renamed.' };
  }

  const admin = createAdminClient();
  const { data: ev, error: readErr } = await admin
    .from('events')
    .select('role_names')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readErr || !ev) {
    return { ok: false, reason: 'Couldn’t read your role names — nothing was changed. Try again.' };
  }

  const current = readRoleNames((ev as { role_names?: unknown }).role_names);
  const cleanOne = cleanRoleName(one);
  const cleanMany = cleanRoleName(many ?? '');
  const next: Record<string, { one: string; many?: string }> = { ...current };
  // 🔑 Blank means "the usual word" — the key is removed, never stored empty.
  if (!cleanOne) delete next[role];
  else next[role] = cleanMany && cleanMany !== cleanOne ? { one: cleanOne, many: cleanMany } : { one: cleanOne };

  const value = Object.keys(next).length > 0 ? next : null;
  // A zero-row UPDATE returns no error — count the rows, or "saved" is a guess.
  const { data, error } = await admin
    .from('events')
    .update({ role_names: value })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data || data.length === 0) {
    return { ok: false, reason: 'The new name was not saved — nothing was changed.' };
  }

  // Every surface that prints a role word: the guest list + the invitation
  // (revalidateMarch), and the host screens that read it outside /guests.
  await revalidateMarch(eventId);
  for (const path of [
    `/dashboard/${eventId}/invitation`,
    `/dashboard/${eventId}/website/dress-code`,
    `/dashboard/${eventId}/prints`,
    `/dashboard/${eventId}/schedule`,
  ]) {
    revalidatePath(path);
  }
  return { ok: true, names: readRoleNames(value) };
}
