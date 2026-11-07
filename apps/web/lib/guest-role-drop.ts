/**
 * ✋ GUESTS › LIST: DRAG TO CHANGE ROLE — WHAT ONE DROP MEANS (owner 2026-11-01, DECISION_LOG "GUESTS › LIST: DRAG TO
 * CHANGE ROLE · HONOUR ATTENDANTS GET THEIR OWN GROUP", verbatim: *"guests list can also be dragged and dropped to they
 * can change their role accordingly"*).
 *
 * In Role grouping a guest is pressed, held and dragged into another section. This file is the one answer to "what does
 * letting go over THAT section do?" — pure, so the guard runs it on real rows (`a-guest-is-dragged-to-a-new-role.test.ts`):
 *
 *   · a ROLE section → their role becomes that section's role. A section that holds several roles (👯 Honour attendants:
 *     best man, best woman, maid / matron / man of honor) answers every role it can take, and the List asks which
 *     with a small PickMenu;
 *   · a "GUESTS OF [ROLE]" section (#7144) → they become the +1 of somebody in that role — ONLY when they have no role
 *     of their own (owner, verbatim: *"they get to that group only if they do not have a role and their role is
 *     guest"*). Anybody else is refused, with the reason in one line. Several people in that role → "Whose guest?";
 *   · the couple and the honoree are never moved (they are not even picked up — `mayDragForRole`).
 *
 * The server checks the same things again (`setGuestPrimaryRole`, `via: 'list-drag'`): the role must be one the event
 * offers — the check `addSingleGuest` uses (`resolveRoleSetForEvent(…).offeredRoles`).
 */
import type { GuestRole, GuestRow } from './guests';
import { guestRoleLabel } from './guests';
import { isHonoreeRole, mostImportantRole } from './role-groups';
import type { RoleNames } from './role-names';
import { plusOneHasNoName } from './extra-seats';
import { sectionHeadDoors } from './guest-section-head';
import {
  guestsOfKey,
  guestsOfLabel,
  plusOneAnchorOf,
  roleBucket,
  roleLabel,
  roleSectionOf,
  type RosterRoleBucket,
} from './guest-roster-view';

/** The most +1s one guest may bring (owner 2026-09-21: "+1 … up to number 4"). */
export const MOST_PLUS_ONES = 4;

/** Where a section key sends a drop — a role, a "Guests of [Role]", or nowhere (the couple's own heading). */
export type RoleDropTarget =
  | { kind: 'role'; bucket: RosterRoleBucket }
  | { kind: 'guests_of'; bucket: RosterRoleBucket }
  | { kind: 'none' };

const GUESTS_OF_PREFIX = guestsOfKey('guest').replace(/guest$/, '');

/** Read a Role-view section key (`role:bridesmaids`, `role:guests-of:groomsmen`) back into where a drop goes. */
export function dropTargetOf(sectionKey: string): RoleDropTarget {
  if (sectionKey.startsWith(GUESTS_OF_PREFIX)) return { kind: 'guests_of', bucket: sectionKey.slice(GUESTS_OF_PREFIX.length) as RosterRoleBucket };
  if (sectionKey.startsWith('role:')) return { kind: 'role', bucket: sectionKey.slice(5) as RosterRoleBucket };
  return { kind: 'none' };
}

/** May this row be picked up at all? Never the couple or the honoree, never a seat that has no name yet. */
export function mayDragForRole(g: GuestRow): boolean {
  if (isHonoreeRole(g.role)) return false;
  return !plusOneHasNoName(g);
}

/**
 * The roles a section can give — the SAME answer as its header's ＋ (`sectionHeadDoors`, lib/guest-section-head.ts): the
 * roles this event OFFERS that are drawn there, in the event's own order. One list, so a drop can never give a role the
 * section's own ＋ would not.
 */
export function rolesForSection(sectionKey: string, offeredRoles: readonly GuestRole[]): GuestRole[] {
  return (sectionHeadDoors(sectionKey, { groups: [], offeredRoles }).add?.roles ?? []).filter((r) => !isHonoreeRole(r));
}

export type RoleDropChoice = { key: string; label: string };

export type RoleDropPlan =
  /** Let go where they already are, or over nothing a guest can go into. */
  | { kind: 'stay' }
  /** Refused, with the reason in one line. */
  | { kind: 'refuse'; words: string }
  /** Their role becomes one of `roles` (one → at once; several → the PickMenu asks). `landsIn` names where they show. */
  | { kind: 'role'; label: string; landsIn: string; roles: RoleDropChoice[] }
  /** They become the +1 of one of `hosts` (one → at once; several → "Whose guest?"). */
  | { kind: 'guests_of'; label: string; hosts: RoleDropChoice[] };

export type RoleDropFacts = {
  /** The WHOLE list (a search may show fewer) — who holds a role, who brings whom. */
  roster: readonly GuestRow[];
  offeredRoles: readonly GuestRole[];
  roleNames?: RoleNames | null;
  /** A guest's name as the List prints it. */
  nameOf: (g: GuestRow) => string;
};

const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);

/** Plan the drop of `g` on the section `sectionKey`. Pure: reads only what it is handed. */
export function planRoleDrop(g: GuestRow, sectionKey: string, facts: RoleDropFacts): RoleDropPlan {
  const name = facts.nameOf(g);
  if (isHonoreeRole(g.role)) return { kind: 'refuse', words: `${name} stays at the top — the couple and the honoree aren’t moved.` };
  const target = dropTargetOf(sectionKey);
  if (target.kind === 'none') return { kind: 'stay' };

  const byId = new Map(facts.roster.map((x) => [x.guest_id, x] as const));
  const at = plusOneAnchorOf(facts.roster, { guestById: (id) => byId.get(id) });
  const here = roleSectionOf(g, at);
  const host = at(g) === g ? null : at(g);
  const hostBucket = host && !isHonoreeRole(host.role) ? roleBucket(host) : null;
  const label = target.kind === 'role' ? roleLabel(target.bucket, facts.roleNames) : guestsOfLabel(target.bucket, facts.roleNames);
  const extras = g.extra_roles ?? [];

  if (target.kind === 'guests_of') {
    if (here.kind === 'guests_of' && here.bucket === target.bucket) return { kind: 'stay' };
    // 👥 The owner's rule: only a guest whose role is Guest and who holds no other role.
    if (g.role !== 'guest' || extras.length > 0) {
      const word = guestRoleLabel(mostImportantRole([g.role, ...extras]), facts.roleNames);
      return { kind: 'refuse', words: `${name} is ${aOrAn(word)} — only a guest with no role of their own joins ${label}.` };
    }
    if ((g.plus_one_count ?? 0) > 0 || facts.roster.some((x) => x.plus_one_of_guest_id === g.guest_id && x.guest_id !== g.guest_id)) {
      return { kind: 'refuse', words: `${name} brings their own +1 — a +1 can’t bring anyone.` };
    }
    const hosts = facts.roster.filter(
      (h) =>
        h.guest_id !== g.guest_id &&
        h.guest_id !== g.plus_one_of_guest_id &&
        !h.plus_one_of_guest_id &&
        !isHonoreeRole(h.role) &&
        roleBucket(h) === target.bucket &&
        (h.plus_one_count ?? 0) < MOST_PLUS_ONES,
    );
    if (hosts.length === 0) {
      return { kind: 'refuse', words: `Nobody in ${roleLabel(target.bucket, facts.roleNames)} can bring another guest — ${MOST_PLUS_ONES} is the most.` };
    }
    return { kind: 'guests_of', label, hosts: hosts.map((h) => ({ key: h.guest_id, label: facts.nameOf(h) })) };
  }

  if (here.kind === 'role' && here.bucket === target.bucket) return { kind: 'stay' };
  const roles = rolesForSection(sectionKey, facts.offeredRoles);
  if (roles.length === 0) return { kind: 'refuse', words: `${label} isn’t a role this event has.` };
  // A role they ALSO hold that ranks above the new one keeps them where they are — say so, never a drop that does nothing.
  const outranks = extras.filter((x) => !roles.includes(x)).find((x) => roleBucket({ role: roles[0]!, extra_roles: [x] }) !== target.bucket);
  if (outranks) {
    return { kind: 'refuse', words: `${name} is also ${aOrAn(guestRoleLabel(outranks, facts.roleNames))}, which comes first — change that on their card.` };
  }
  // A +1 with no role of their own sits under "Guests of [their guest's role]" — Guests is where they already are.
  if (target.bucket === 'guest' && hostBucket && hostBucket !== 'guest') {
    const where = guestsOfLabel(hostBucket, facts.roleNames);
    if (g.role === 'guest' && extras.length === 0) return { kind: 'refuse', words: `${name} comes as ${facts.nameOf(host!)}’s +1, so they’re counted under ${where}.` };
    return { kind: 'role', label, landsIn: where, roles: roles.map((r) => ({ key: r, label: guestRoleLabel(r, facts.roleNames) })) };
  }
  return { kind: 'role', label, landsIn: label, roles: roles.map((r) => ({ key: r, label: guestRoleLabel(r, facts.roleNames) })) };
}
