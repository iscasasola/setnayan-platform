/**
 * lib/role-alternatives.ts — THE ROLES THAT ARE ONE PLACE WITH TWO WORDS.
 *
 * ⚖ Owner, verbatim 2026-09-30: *"Also on guestlist (We can pick either best man
 * or best woman and maid or matron of honor)"*.
 *
 * Two honour attendants each have several words for the SAME place in the day:
 *
 *   • the groom's side — Best Man  /  Best Woman
 *   • the bride's side — Maid of Honour  /  Matron of Honour  /  Man of Honour
 *
 * 🤵‍♂️ The third word on the bride's side is the owner's, 2026-10-19: *"we give them a choice maid/matron/man of
 * honor. so they can have male/female version like bestman and best woman"*. A set may hold more than two words;
 * every reader below takes the set as a list.
 *
 * Each set shares one column in the Wedding March, one colour slot on the Mood
 * Board and one host template. What differs is the word, and the couple should
 * see that at the moment they pick — two unrelated lines in a long dropdown hide
 * the fact that one is simply the other said differently.
 *
 * 🔑 ALTERNATIVES, NOT EXCLUSIVE. Nothing here stops a couple having a best man
 * AND a best woman, or a maid AND a matron (many weddings have both — owner
 * ruling 2026-09-14: "they can do as much as they want"). This module only
 * decides how the choice is PRESENTED; it validates nothing.
 *
 * Pure. No React, no I/O — read by the client pickers and by the tests.
 */
import type { GuestRole } from './guests';

/** Each set, in the order the picker shows it: the traditional word first. */
export const ROLE_ALTERNATIVES: ReadonlyArray<readonly GuestRole[]> = [
  ['best_man', 'best_woman'],
  ['maid_of_honor', 'matron_of_honor', 'man_of_honor'],
];

/** The plain-English heading a picker shows over a pair. */
export const ROLE_ALTERNATIVE_HEADING: Readonly<Record<string, string>> = {
  best_man: 'Best man or best woman',
  maid_of_honor: 'Maid, matron or man of honour',
};

/** Every other word for the same place, in the set's order — empty when a role has only one. */
export function alternativesOf(role: GuestRole): GuestRole[] {
  const set = ROLE_ALTERNATIVES.find((s) => s.includes(role));
  return set ? set.filter((r) => r !== role) : [];
}

/** The first other word for the same place, or null when a role has only one. */
export function alternativeOf(role: GuestRole): GuestRole | null {
  return alternativesOf(role)[0] ?? null;
}

/** One line of a role picker: a single role, or an either-or pair. */
export type RolePickItem =
  | { kind: 'one'; role: GuestRole }
  | { kind: 'pair'; roles: readonly GuestRole[]; heading: string };

/**
 * Fold a picker's role list into lines, collapsing each set into ONE line at
 * the position of whichever word comes first.
 *
 * 🔑 NOTHING IS DROPPED OR INVENTED. A set collapses only when at least two of
 * its words are in the list the caller offers, and it carries ONLY the offered
 * ones — an event whose role set lacks `best_woman` still shows a plain "Best
 * Man" line, never a toggle to a role it cannot save. Every role in, exactly
 * once out (`rolesOfPickItems` is the inverse).
 */
export function pickItems(roles: readonly GuestRole[]): RolePickItem[] {
  const offered = new Set(roles);
  const done = new Set<GuestRole>();
  const out: RolePickItem[] = [];
  for (const role of roles) {
    if (done.has(role)) continue;
    const set = ROLE_ALTERNATIVES.find((s) => s.includes(role));
    const here = set ? set.filter((r) => offered.has(r)) : [];
    if (set && here.length >= 2) {
      for (const r of here) done.add(r);
      out.push({ kind: 'pair', roles: here, heading: ROLE_ALTERNATIVE_HEADING[set[0]!] ?? '' });
      continue;
    }
    done.add(role);
    out.push({ kind: 'one', role });
  }
  return out;
}

/** Every role a set of pick lines offers — the inverse of `pickItems`. */
export function rolesOfPickItems(items: readonly RolePickItem[]): GuestRole[] {
  return items.flatMap((it) => (it.kind === 'pair' ? [...it.roles] : [it.role]));
}
