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
import { updateJsonColumn, type JsonColumnClient } from '@/lib/update-json-column';
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

  const cleanOne = cleanRoleName(one);
  const cleanMany = cleanRoleName(many ?? '');
  /* 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18, round 2): the one word is changed on the names AS THEY
     ARE when the write lands (`updateJsonColumn`, a compare-and-set on the value) — another host's rename of another
     role, landed meanwhile, stays. (Before: read → change → write the whole map back, the race "accepted".) */
  let value: Record<string, { one: string; many?: string }> | null = null;
  try {
    const wrote = await updateJsonColumn(
      createAdminClient() as unknown as JsonColumnClient,
      { table: 'events', row: { event_id: eventId }, column: 'role_names', what: 'The new name' },
      (stored) => {
        const next: Record<string, { one: string; many?: string }> = { ...readRoleNames(stored) };
        // 🔑 Blank means "the usual word" — the key is removed, never stored empty.
        if (!cleanOne) delete next[role];
        else next[role] = cleanMany && cleanMany !== cleanOne ? { one: cleanOne, many: cleanMany } : { one: cleanOne };
        value = Object.keys(next).length > 0 ? next : null;
        return { next: value };
      },
    );
    // A zero-row UPDATE returns no error — the write proves its row, or "saved" is a guess.
    if (!wrote.written) return { ok: false, reason: 'The new name was not saved — nothing was changed.' };
  } catch {
    return { ok: false, reason: 'The new name was not saved — nothing was changed.' };
  }

  // Every surface that prints a role word: the guest list + the invitation
  // (revalidateMarch), and the host screens that read it outside /guests.
  await revalidateMarch(eventId);
  for (const path of [
    `/dashboard/${eventId}/invitation`,
    `/dashboard/${eventId}/studio/mood-board`,
    `/dashboard/${eventId}/prints`,
    `/dashboard/${eventId}/schedule`,
  ]) {
    revalidatePath(path);
  }
  return { ok: true, names: readRoleNames(value) };
}
