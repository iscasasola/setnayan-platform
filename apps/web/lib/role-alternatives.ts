/**
 * lib/role-alternatives.ts — THE ROLES THAT ARE ONE PLACE WITH TWO WORDS.
 *
 * ⚖ Owner, verbatim 2026-09-30: *"Also on guestlist (We can pick either best man
 * or best woman and maid or matron of honor)"*.
 *
 * Two honour attendants each have two words for the SAME place in the day:
 *
 *   • the groom's side — Best Man  /  Best Woman
 *   • the bride's side — Maid of Honour  /  Matron of Honour
 *
 * Each pair shares one column in the Wedding March, one colour slot on the Mood
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

/** Each pair, in the order the picker shows it: the traditional word first. */
export const ROLE_ALTERNATIVES: ReadonlyArray<readonly [GuestRole, GuestRole]> = [
  ['best_man', 'best_woman'],
  ['maid_of_honor', 'matron_of_honor'],
];

/** The plain-English heading a picker shows over a pair. */
export const ROLE_ALTERNATIVE_HEADING: Readonly<Record<string, string>> = {
  best_man: 'Best man or best woman',
  maid_of_honor: 'Maid or matron of honour',
};

/** The other word for the same place, or null when a role has only one. */
export function alternativeOf(role: GuestRole): GuestRole | null {
  for (const [a, b] of ROLE_ALTERNATIVES) {
    if (role === a) return b;
    if (role === b) return a;
  }
  return null;
}

/** One line of a role picker: a single role, or an either-or pair. */
export type RolePickItem =
  | { kind: 'one'; role: GuestRole }
  | { kind: 'pair'; roles: readonly [GuestRole, GuestRole]; heading: string };

/**
 * Fold a picker's role list into lines, collapsing each pair into ONE line at
 * the position of whichever half comes first.
 *
 * 🔑 NOTHING IS DROPPED OR INVENTED. A pair collapses only when BOTH halves are
 * in the list the caller offers — an event whose role set lacks `best_woman`
 * still shows a plain "Best Man" line, never a toggle to a role it cannot save.
 * Every role in, exactly once out (`rolesOfPickItems` is the inverse).
 */
export function pickItems(roles: readonly GuestRole[]): RolePickItem[] {
  const offered = new Set(roles);
  const done = new Set<GuestRole>();
  const out: RolePickItem[] = [];
  for (const role of roles) {
    if (done.has(role)) continue;
    const other = alternativeOf(role);
    if (other && offered.has(other)) {
      const pair = ROLE_ALTERNATIVES.find(([a, b]) => a === role || b === role)!;
      done.add(pair[0]);
      done.add(pair[1]);
      out.push({ kind: 'pair', roles: pair, heading: ROLE_ALTERNATIVE_HEADING[pair[0]] ?? '' });
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
