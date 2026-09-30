/**
 * lib/role-seating-labels.ts — the Auto Arrange "Who sits together" switches,
 * named in this couple's own role words (`events.role_names`: Bridesmaid →
 * "Bride's Crew"). See lib/role-seating.ts for what the switches do.
 *
 * Kept apart from lib/role-seating.ts on purpose: the page builds these labels
 * on the server and hands the editor plain strings, so the lazy seat-plan chunk
 * never imports the role-word modules (which re-shuffled the shared split
 * chunks past the 202KB shared budget).
 */
import { roleGroupLabel } from './role-groups';
import { roleNameMany, type RoleNames } from './role-names';
import { ROLE_SEATING_SETS, type RoleSeatingKey } from './role-seating';

/** The toggle's words for one set, in this couple's role words. */
export function roleSeatingLabel(key: RoleSeatingKey, names?: RoleNames | null): string {
  switch (key) {
    case 'principal_sponsors':
      return roleGroupLabel('principal_sponsors', names);
    case 'immediate_family':
      return 'Immediate family (both sides)';
    case 'wedding_party':
      return `${roleGroupLabel('bridesmaids', names)} & ${roleGroupLabel('groomsmen', names)}`;
    case 'secondary_sponsors':
      return roleGroupLabel('secondary_sponsors', names);
    case 'bearers_flower_girl':
      return `${roleNameMany('ring_bearer', names) ?? 'Ring Bearers'} & ${
        roleNameMany('flower_girl', names) ?? 'Flower Girls'
      }`;
  }
}

/** Every set's label, keyed — what the seat-plan page passes to the editor. */
export function roleSeatingLabels(names?: RoleNames | null): Record<RoleSeatingKey, string> {
  return Object.fromEntries(
    ROLE_SEATING_SETS.map((s) => [s.key, roleSeatingLabel(s.key, names)]),
  ) as Record<RoleSeatingKey, string>;
}
