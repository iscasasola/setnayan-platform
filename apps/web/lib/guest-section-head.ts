/**
 * guest-section-head.ts — WHAT A GUEST-LIST HEADER CAN DO WHEN IT IS PRESSED (R4 slice 4, owner 2026-10-29).
 *
 * ⚖ Owner, on the Guests prototype v20–v22: tapping a group header SELECTS it, opens it, and raises a toolbar —
 * Rename · ＋ Add guest here (*"i like the concept of adding guests directly on the highlighted category"*); tapping the
 * SELECTED header again folds it AND unselects it; and the guest card loses its rename row (*"the renaming of that group
 * will be removed since it will be set on when the highlighted group/role is pressed"*).
 *
 * This file answers, for one section key of `rosterSections` (lib/guest-roster-view.ts), two honest questions:
 *   · RENAME — which ONE word renames this heading, through which shipped door? A role group's word
 *     (`roleGroupRenameDoor` — `renameRole` / `renameSection`), an own group's label (`editGuestGroupInPlace` rename),
 *     or none (a side, a reply, a letter, a heading of two sections).
 *   · ADD HERE — what does a name typed now need, so that it LANDS in this section? A role, a side, a group — or null
 *     when no pick can promise that (a last-name letter is decided by the name; a reply heading by the answer). A
 *     toolbar never offers an add that would put the guest somewhere else.
 * A header with neither is not selectable: its tap stays the shipped fold toggle. The celebrants never are.
 *
 * 🔒 lib/guest-section-head.test.ts
 */
import type { GuestRole, GuestSide } from './guests';
import { roleGroupOf, roleGroupRenameDoor, type RoleGroup, type RoleGroupRenameDoor } from './role-groups';

export type SectionHeadRename = RoleGroupRenameDoor | { kind: 'group'; groupId: string };

/** What an add from this header sets — only the picks it names; the rest are the box's own sticky picks. */
export type SectionHeadAdd = {
  /** The roles that land here, in the role set's own order — one = a plain ＋, several = ＋ ▾. */
  roles?: readonly GuestRole[];
  side?: GuestSide;
  /** The own groups the new guest joins ([] = "No group"). */
  groupIds?: readonly string[];
};

export type SectionHeadDoors = { rename: SectionHeadRename | null; add: SectionHeadAdd | null };

const NONE: SectionHeadDoors = { rename: null, add: null };

export function sectionHeadDoors(
  key: string,
  ctx: {
    /** The event's own groups (the screen's `allGroups`). */
    groups: readonly { group_id: string; label: string }[];
    /** The event's role set, in its order (`resolveRoleSet(…).offeredRoles`). */
    offeredRoles: readonly GuestRole[];
  },
): SectionHeadDoors {
  if (key === 'celebrants') return NONE;
  const at = key.indexOf(':');
  if (at < 0) return NONE;
  const view = key.slice(0, at);
  const rest = key.slice(at + 1);
  if (view === 'role') {
    if (rest === 'guest') return { rename: null, add: { roles: ['guest'] } };
    const grp = rest as RoleGroup;
    const roles = ctx.offeredRoles.filter((r) => roleGroupOf(r) === grp);
    return { rename: roleGroupRenameDoor(grp), add: roles.length ? { roles } : null };
  }
  if (view === 'side') {
    return rest === 'bride' || rest === 'groom' || rest === 'both' ? { rename: null, add: { side: rest } } : NONE;
  }
  if (view === 'group') {
    if (rest === 'none') return { rename: null, add: { groupIds: [] } };
    const same = ctx.groups.filter((g) => g.label === rest);
    // Two groups of one name (one per side) share one heading — no one group to rename or to join.
    return same.length === 1 ? { rename: { kind: 'group', groupId: same[0]!.group_id }, add: { groupIds: [same[0]!.group_id] } } : NONE;
  }
  // A new guest is "To invite" until their invitation goes — the one reply heading an add lands in.
  if (view === 'rsvp' && rest === 'to_invite') return { rename: null, add: {} };
  return NONE;
}

/** Is this header one a tap selects (and raises the toolbar for)? */
export function sectionHeadSelectable(doors: SectionHeadDoors): boolean {
  return doors.rename !== null || doors.add !== null;
}
