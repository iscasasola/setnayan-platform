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
