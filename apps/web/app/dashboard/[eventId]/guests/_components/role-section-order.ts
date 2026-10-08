import { ROLE_GROUP_LABELS, type RoleGroup } from '@/lib/role-groups';

type SectionGroup = RoleGroup | 'guest';

const SECTION_CONFIG: {
  group: SectionGroup;
  label: string;
}[] = [
  { group: 'couple', label: ROLE_GROUP_LABELS.couple },
  { group: 'vip_family', label: ROLE_GROUP_LABELS.vip_family },
  // Nikah principals (wali/witness/imam/wakil) — only populated for muslim
  // weddings; the section is filtered out when empty, so it never shows on a
  // Catholic/civil wedding. Ranked just under VIP family to mirror ROLE_IMPORTANCE.
  { group: 'muslim_principals', label: ROLE_GROUP_LABELS.muslim_principals },
  { group: 'groomsmen', label: ROLE_GROUP_LABELS.groomsmen },
  { group: 'bridesmaids', label: ROLE_GROUP_LABELS.bridesmaids },
  { group: 'principal_sponsors', label: ROLE_GROUP_LABELS.principal_sponsors },
  { group: 'secondary_sponsors', label: ROLE_GROUP_LABELS.secondary_sponsors },
  { group: 'bearers_flower_girl', label: ROLE_GROUP_LABELS.bearers_flower_girl },
  { group: 'officiants', label: ROLE_GROUP_LABELS.officiants },
  { group: 'guest', label: 'Guests' },
];

/**
 * The order role sections appear in — the roster's curated hierarchy.
 *
 * 🔑 EXPORTED because the page needs the identical order to SORT by role when
 * Role is one of the ordering ticks. Two copies would let the headings and the
 * rows under them disagree about where Principal Sponsors goes.
 */
export const ROLE_SECTION_ORDER: readonly string[] = SECTION_CONFIG.map((c) => c.label);
