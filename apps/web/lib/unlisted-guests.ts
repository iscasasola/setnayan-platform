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
import { parseGuestInput } from '@/lib/guest-parse';

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

/** The couple are set when the event is created — never picked here. */
const NOT_OFFERED: readonly string[] = ['bride', 'groom'];

export type KeepLine = {
  prefix: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  side: GuestSide;
  role: GuestRole;
  groups: string[];
  plusOnes: number;
};

/**
 * Keep, the quick-add way — owner 2026-09-21: *"the option of adding a quick
 * add text box? same function as the quick add on the guestlist."* One line in
 * the SAME grammar the guest list's capture bar reads (`parseGuestInput`):
 *
 *     "Shey Ferriol bride #Barkada ninang +2"
 *
 * The grammar only names a few roles (vip · ninong · ninang · sponsor), so an
 * explicit Role pick, when made, wins over the line. A role this event does not
 * offer falls back to Guest — exactly what the capture bar does — except that
 * an EXPLICIT pick of an unoffered role is refused, because the couple chose it.
 */
export function readKeepLine(
  line: string,
  roleOverride: string,
  offeredRoles: readonly GuestRole[],
): { ok: true; value: KeepLine } | { ok: false; error: string } {
  const d = parseGuestInput(line);
  if (!d.firstName) return { ok: false, error: 'Type their name first — then side, #group, role or +N if you like.' };
  const offered = (r: string | null): r is GuestRole =>
    !!r && offeredRoles.includes(r as GuestRole) && !NOT_OFFERED.includes(r);
  const picked = roleOverride.trim();
  if (picked && !offered(picked)) {
    return { ok: false, error: 'That role isn’t available for this celebration — pick one from the list.' };
  }
  const role: GuestRole = picked ? (picked as GuestRole) : offered(d.roleHint) ? d.roleHint : 'guest';
  return {
    ok: true,
    value: {
      prefix: d.prefix,
      first_name: d.firstName,
      middle_name: d.middleName,
      last_name: d.lastName,
      suffix: d.suffix,
      side: d.side,
      role,
      groups: d.groups,
      plusOnes: d.plusOnes,
    },
  };
}
