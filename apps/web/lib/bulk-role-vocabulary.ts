/**
 * bulk-role-vocabulary.ts — THE ONE LIST the bulk "Assign role…" picker offers
 * and the ONE LIST its server action accepts.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
 * It used to be two hand-maintained lists that had drifted into near-INVERSES
 * at both edges, and the disagreement was invisible until a host clicked Apply:
 *
 *   • the picker (`BULK_ROLE_SECTIONS`, in the client component) offered the
 *     four VIP-family roles — bride_parents, groom_parents,
 *     bride_immediate_family, groom_immediate_family — per owner directive
 *     2026-05-23 (PR #424 lock), and deliberately OMITTED bride/groom;
 *   • the validator (`WEDDING_BULK_ROLE_VALUES`, in groups-actions.ts)
 *     REJECTED all four of those and ALLOWED bride/groom.
 *
 * So "Bride's Parents" and "Groom's Parents" were selectable and un-appliable:
 * the host picked a role the UI offered, hit Apply, and got bounced with
 * `invalid_role`. Reported from the live roster 2026-09-14.
 *
 * 🔑 A PICKER AND ITS VALIDATOR ARE TWO HALVES OF ONE DECISION. Keeping them
 * as two literals meant each was internally consistent and the PAIR was wrong,
 * which no test of either half alone could catch. They now read the same
 * export, so the failure mode is deleted rather than fixed — and
 * `bulk-role-vocabulary.test.ts` pins the vocabulary against the event's real
 * offered-role set so a role can never be offered that the schema rejects.
 *
 * Pure: no React, no DOM, no server imports — importable from the client
 * component AND the 'use server' action, which is the whole point.
 */

import type { GuestRole } from './guests';
import { ROLE_GROUP_LABELS } from './role-groups';
import { resolveRoleSet } from './role-sets';

/** One labelled group of roles in the picker's dropdown. */
export type RoleSection = { label: string; roles: GuestRole[] };

/**
 * The wedding bulk-assign picker, in display order.
 *
 * ⚠ BRIDE & GROOM ARE DELIBERATELY ABSENT (owner directive 2026-06-03): the
 * couple is set at event creation and is the foundation of the event. They are
 * renamable but not a role you bulk-assign, so they must appear in NEITHER the
 * picker nor the validator — the old validator accepting them was a hole, not
 * a feature, and closing it is part of this fix.
 */
export const BULK_ROLE_SECTIONS: RoleSection[] = [
  // VIP family — owner directive 2026-05-23 PM (PR #424 lock). 4 roles for
  // Tier-1 seating auto-fill per iteration 0008. THESE ARE THE FOUR the old
  // validator dropped; do not remove one without removing it from the event's
  // offered-role set too, or the guard test will fail (as it should).
  {
    label: ROLE_GROUP_LABELS.vip_family,
    roles: [
      'bride_parents',
      'groom_parents',
      'bride_immediate_family',
      'groom_immediate_family',
    ],
  },
  {
    label: ROLE_GROUP_LABELS.wedding_party,
    roles: ['maid_of_honor', 'matron_of_honor', 'best_man', 'bridesmaid', 'groomsman'],
  },
  {
    label: ROLE_GROUP_LABELS.principal_sponsors,
    // Ninong/Ninang first — they are what a host picks now. The plain
    // `principal_sponsor` stays last and offered: 47 live rows hold it, and a
    // host must be able to set a sponsor back to "not yet specified".
    roles: ['principal_sponsor_ninong', 'principal_sponsor_ninang', 'principal_sponsor'],
  },
  {
    label: ROLE_GROUP_LABELS.secondary_sponsors,
    roles: ['candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor'],
  },
  {
    label: ROLE_GROUP_LABELS.bearers_flower_girl,
    roles: ['ring_bearer', 'bible_bearer', 'coin_bearer', 'flower_girl'],
  },
  {
    label: ROLE_GROUP_LABELS.officiants,
    roles: ['officiant', 'reader_lector', 'soloist_musician'],
  },
  { label: 'Generic', roles: ['guest'] },
];

/**
 * The picker's sections for an event's role-set key.
 *
 * Wedding → BULK_ROLE_SECTIONS above. A non-wedding event → a simple set built
 * from its profile's offered roles. Shared by the desktop SelectionBar, the
 * mobile Assign sheet, and the server validator, so all three stay in lockstep.
 */
export function bulkRoleSectionsFor(roleSetKey: string | null | undefined): RoleSection[] {
  if ((roleSetKey ?? 'wedding') === 'wedding') return BULK_ROLE_SECTIONS;
  const offered = resolveRoleSet(roleSetKey).offeredRoles;
  const nonGuest = offered.filter((r) => r !== 'guest');
  const sections: RoleSection[] = [];
  if (nonGuest.length > 0) sections.push({ label: 'Roles', roles: nonGuest });
  sections.push({ label: 'Generic', roles: ['guest'] });
  return sections;
}

/**
 * Every role the bulk picker can actually offer for this event — the FLATTENED
 * form of `bulkRoleSectionsFor`, and the only list `bulkApplyRoleAndGroup`
 * should validate against.
 *
 * Derived, never re-typed: that is what makes offered-but-rejected impossible.
 */
export function bulkAssignableRolesFor(roleSetKey: string | null | undefined): GuestRole[] {
  return bulkRoleSectionsFor(roleSetKey).flatMap((s) => s.roles);
}
