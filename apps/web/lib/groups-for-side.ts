/**
 * Which groups a guest's "+ add to group" offers.
 *
 * ⚖ Owner 2026-09-21, on the dashed + in a guest's Groups cell: *"clicking
 * here should popup options of what group the side has. example. bride side,
 * then groups from the bride should show."*
 *
 * · A Bride's-side guest sees the Bride's groups and the shared ('both') ones.
 * · A Groom's-side guest, likewise.
 * · A guest on BOTH sides belongs to either family, so sees every group.
 *
 * Pure, so the popup and its test run the same rule.
 */
import type { GuestGroupTeamSide, GuestSide } from '@/lib/guests';
import { groupNameKey } from '@/lib/group-name-clash';

/** The one rule: a group fits a guest when it is their side's or both sides'; a guest on both sides (or no side) fits all. */
export function groupFitsSide(teamSide: GuestGroupTeamSide, side: GuestSide | null | undefined): boolean {
  if (side !== 'bride' && side !== 'groom') return true;
  return teamSide === side || teamSide === 'both';
}

export function groupsForSide<T extends { team_side: GuestGroupTeamSide }>(
  groups: readonly T[],
  side: GuestSide | null | undefined,
): T[] {
  return groups.filter((g) => groupFitsSide(g.team_side, side));
}

/** A group made from a guest's own + belongs to that guest's side. */
export function teamSideForNewGroup(side: GuestSide | null | undefined): GuestGroupTeamSide {
  return side === 'bride' || side === 'groom' ? side : 'both';
}

/**
 * 👥 THE GROUP LIST FOLLOWS THE GUEST'S SIDE (owner 2026-10-20, DECISION_LOG "THE GROUP LIST FOLLOWS THE GUEST'S SIDE"):
 * *"if i pick bride's side. it should show the groups for the bride's side and the groups that also cover both … if i
 * pick groom's side, then i only see groups that is related on the grooms or both"*. The ONE Group dropdown's "Your
 * groups" (`guest-group-picker.tsx`) draws exactly this list, in the given order:
 *
 *   · every group that fits the guest's side (`groupFitsSide`) — `side` undefined / null / 'both' = every group;
 *   · PLUS a group the guest is already in (`picked`) whatever its side — never silently dropped. Its `offSide` names
 *     that side, for the row's small "· groom's side".
 */
export function listedOwnGroups<T extends { groupId: string; teamSide: GuestGroupTeamSide }>(
  groups: readonly T[],
  side: GuestSide | null | undefined,
  picked: readonly string[],
): { group: T; offSide: 'bride' | 'groom' | null }[] {
  return groups.flatMap((group): { group: T; offSide: 'bride' | 'groom' | null }[] => {
    if (groupFitsSide(group.teamSide, side)) return [{ group, offSide: null }];
    if (!picked.includes(group.groupId) || group.teamSide === 'both') return [];
    return [{ group, offSide: group.teamSide }];
  });
}

/** The small word on an already-ticked group from the other side. */
export const OFF_SIDE_WORD: Record<'bride' | 'groom', string> = { bride: 'bride’s side', groom: 'groom’s side' };

/** The small word naming a group's side — the off-side word, plus both sides'. */
export const GROUP_SIDE_WORD: Record<GuestGroupTeamSide, string> = { ...OFF_SIDE_WORD, both: 'both sides' };

/**
 * 👥 SAME NAME, SAY THE SIDE (owner 2026-10-21, on the Group list showing Bob · Bob · Loo · Loo · Mama · Mama ·
 * Relatives · Relatives: *"why do i see dupes on group names"*). Two own groups may share a name on two sides (the
 * table's key is name + side), and a list that draws both — a guest on both sides, or a bride's-side guest seeing a
 * both-sides "Relatives" beside the bride's "Relatives" — showed two identical rows. Of the groups a list draws, each
 * whose name (`groupNameKey`: case, spaces and punctuation ignored) is shared with ANOTHER drawn group, or with one of
 * `alsoListed` (the standard groups' names in the same list), is given its side; a name drawn once is given nothing.
 * Map: groupId → its side. Pure, so every list that draws own groups runs the same rule.
 */
export function sidesForNamesakes<T extends { groupId: string; label: string; teamSide: GuestGroupTeamSide }>(
  drawn: readonly T[],
  alsoListed: readonly string[] = [],
): Map<string, GuestGroupTeamSide> {
  const count = new Map<string, number>();
  for (const name of alsoListed) {
    const k = groupNameKey(name);
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  for (const g of drawn) {
    const k = groupNameKey(g.label);
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out = new Map<string, GuestGroupTeamSide>();
  for (const g of drawn) if ((count.get(groupNameKey(g.label)) ?? 0) > 1) out.set(g.groupId, g.teamSide);
  return out;
}

/** A one-line list's words for an own group (a PickMenu option): its name, plus " · groom’s side" when it is a namesake. */
export function groupLabelWithSide(label: string, side: GuestGroupTeamSide | undefined): string {
  return side ? `${label} · ${GROUP_SIDE_WORD[side]}` : label;
}
