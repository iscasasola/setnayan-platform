/**
 * unlisted-guests.ts — the rules behind the Unlisted guests page.
 *
 * ⚖ Owner 2026-09-21, on "Same as · Choose a guest on your list…": *"this
 * should only show accounts that are not yet linked. there should be a search
 * bar also. And allow manual add to list where you can choose their role,
 * group, side, and name as well."*
 *
 * Pure: the page and the action both ask this module, so the list the couple
 * picks from and the check the server makes cannot disagree.
 */
import type { GuestRole, GuestSide } from '@/lib/guests';

export type LinkCandidate = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
};

export const candidateName = (c: LinkCandidate): string =>
  (c.display_name?.trim() || `${c.first_name} ${c.last_name}`).trim();

/**
 * Who a joiner may be linked to: guests NO account has claimed yet. A guest
 * someone already signed in as is that person — linking a second account to
 * them is refused by the action anyway, so offering it only produces an error.
 */
export function unlinkedCandidates(
  all: readonly LinkCandidate[],
  linkedGuestIds: ReadonlySet<string>,
): LinkCandidate[] {
  return all.filter((c) => !linkedGuestIds.has(c.guest_id));
}

/** Search: every word typed must appear somewhere in the name (any order, any case, accents ignored). */
export function searchCandidates(list: readonly LinkCandidate[], query: string, limit = 8): LinkCandidate[] {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return list.filter((c) => words.every((w) => fold(candidateName(c)).includes(w))).slice(0, limit);
}

export type KeepChoice = {
  first_name: string;
  last_name: string;
  side: GuestSide;
  role: GuestRole;
  group_id: string | null;
};

const SIDES: readonly GuestSide[] = ['bride', 'groom', 'both'];
/** The couple are set when the event is created — never picked here. */
const NOT_OFFERED: readonly string[] = ['bride', 'groom'];

/** Validate the Keep form against what this event actually offers. */
export function readKeepChoice(
  form: { get(name: string): FormDataEntryValue | null },
  offeredRoles: readonly GuestRole[],
  groupIds: ReadonlySet<string>,
): { ok: true; value: KeepChoice } | { ok: false; error: string } {
  const text = (k: string) => String(form.get(k) ?? '').replace(/\s+/g, ' ').trim();
  const first_name = text('first_name');
  const last_name = text('last_name');
  if (!first_name) return { ok: false, error: 'Add their first name.' };
  if (first_name.length > 80 || last_name.length > 80) return { ok: false, error: 'That name is too long.' };
  const side = text('side') as GuestSide;
  if (!SIDES.includes(side)) return { ok: false, error: 'Pick a side.' };
  const role = (text('role') || 'guest') as GuestRole;
  if (!offeredRoles.includes(role) || NOT_OFFERED.includes(role)) {
    return { ok: false, error: 'That role isn’t available for this celebration — pick one from the list.' };
  }
  const group = text('group_id');
  if (group && !groupIds.has(group)) return { ok: false, error: 'That group isn’t part of this event.' };
  return { ok: true, value: { first_name, last_name, side, role, group_id: group || null } };
}
