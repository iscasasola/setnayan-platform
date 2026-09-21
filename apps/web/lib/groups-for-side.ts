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

export function groupsForSide<T extends { team_side: GuestGroupTeamSide }>(
  groups: readonly T[],
  side: GuestSide | null | undefined,
): T[] {
  if (side !== 'bride' && side !== 'groom') return [...groups];
  return groups.filter((g) => g.team_side === side || g.team_side === 'both');
}

/** A group made from a guest's own + belongs to that guest's side. */
export function teamSideForNewGroup(side: GuestSide | null | undefined): GuestGroupTeamSide {
  return side === 'bride' || side === 'groom' ? side : 'both';
}
