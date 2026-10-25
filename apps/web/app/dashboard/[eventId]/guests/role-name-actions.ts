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
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER: every word goes through the ONE writer
 * of the column (`writeRoleNames`, a compare-and-set on the value as it is when
 * the write lands) — the same one the Maker's section headings use at ✓ Apply.
 *
 * 🏷 "Rename this section" (owner 2026-10-19, on the entourage: *"Immediate
 * Family change it to VIP."* → *"on guests?"*) — the same door, a section's key
 * (`section:<key>`) in the same column. See `lib/role-names.ts`.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { requireHostMembership, refuseLimitedHelper } from '@/lib/host-gate';
import { revalidateMarch } from '@/lib/entourage-write';
import { isRenamableSection } from '@/lib/entourage';
import { isRenamableRole, sectionNameKey, type RoleNames } from '@/lib/role-names';
import { isKnownGuestRole, writeRoleNames, type RoleWordChange } from '@/lib/role-names.server';
import type { JsonColumnClient } from '@/lib/update-json-column';
import type { GuestRole } from '@/lib/guests';
import { revalidatePath } from 'next/cache';

export type RenameRoleResult =
  | { ok: true; names: RoleNames }
  | { ok: false; reason: string };

const NOT_SAVED = 'The new name was not saved — nothing was changed.';

/** Write one word, then refresh every surface that prints a role word or a section heading. */
async function writeOneWord(eventId: string, change: RoleWordChange): Promise<RenameRoleResult> {
  let names: RoleNames | null;
  try {
    names = await writeRoleNames(createAdminClient() as unknown as JsonColumnClient, eventId, [change]);
  } catch {
    return { ok: false, reason: NOT_SAVED };
  }
  // A zero-row UPDATE returns no error — the write proves its row, or "saved" is a guess.
  if (!names) return { ok: false, reason: NOT_SAVED };
  await revalidateRoleWords(eventId);
  return { ok: true, names };
}

/**
 * Every surface that prints a role word or a section heading: the guest list + the invitation (`revalidateMarch`),
 * and the host screens that read them outside /guests.
 */
async function revalidateRoleWords(eventId: string): Promise<void> {
  await revalidateMarch(eventId);
  for (const path of [
    `/dashboard/${eventId}/invitation`,
    `/dashboard/${eventId}/studio/mood-board`,
    `/dashboard/${eventId}/prints`,
    `/dashboard/${eventId}/schedule`,
    `/dashboard/${eventId}/launch`,
  ]) {
    revalidatePath(path);
  }
}

export async function renameRole(
  eventId: string,
  role: string,
  one: string,
  many?: string | null,
): Promise<RenameRoleResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  await requireHostMembership(eventId);
  if (!isKnownGuestRole(role) || !isRenamableRole(role)) {
    return { ok: false, reason: 'That role can’t be renamed.' };
  }
  return writeOneWord(eventId, { key: role as GuestRole, one, many: many ?? null });
}

/** 🏷 "Rename this section" — one entourage section's heading, for this event. Blank = the usual heading. */
export async function renameSection(eventId: string, section: string, one: string): Promise<RenameRoleResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  await requireHostMembership(eventId);
  if (!isRenamableSection(section)) return { ok: false, reason: 'That section can’t be renamed.' };
  return writeOneWord(eventId, { key: sectionNameKey(section), one });
}
