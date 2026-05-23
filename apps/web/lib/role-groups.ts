import type { GuestRole } from './guests';

export type RoleGroup =
  | 'couple'
  | 'vip_family'
  | 'wedding_party'
  | 'principal_sponsors'
  | 'secondary_sponsors'
  | 'bearers_flower_girl'
  | 'officiants'
  | 'other_roles';

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
  couple: 'Bride & Groom',
  // Owner directive 2026-05-23 PM — 4 VIP-family roles for Tier-1
  // seating auto-fill per iteration 0008. Surface as one group in the
  // sidebar so hosts can filter the VIP cluster at a glance.
  vip_family: 'VIP · Immediate Family',
  wedding_party: 'Wedding Party',
  principal_sponsors: 'Principal Sponsors',
  secondary_sponsors: 'Secondary Sponsors',
  bearers_flower_girl: 'Bearers & Flower Girl',
  officiants: 'Officiants & Readers',
  other_roles: 'Other roles',
};

const ROLE_TO_GROUP: Record<GuestRole, RoleGroup | 'guest'> = {
  guest: 'guest',
  bride: 'couple',
  groom: 'couple',
  bride_parents: 'vip_family',
  groom_parents: 'vip_family',
  bride_immediate_family: 'vip_family',
  groom_immediate_family: 'vip_family',
  maid_of_honor: 'wedding_party',
  matron_of_honor: 'wedding_party',
  best_man: 'wedding_party',
  bridesmaid: 'wedding_party',
  groomsman: 'wedding_party',
  principal_sponsor: 'principal_sponsors',
  candle_sponsor: 'secondary_sponsors',
  veil_sponsor: 'secondary_sponsors',
  cord_sponsor: 'secondary_sponsors',
  coin_sponsor: 'secondary_sponsors',
  ring_bearer: 'bearers_flower_girl',
  bible_bearer: 'bearers_flower_girl',
  coin_bearer: 'bearers_flower_girl',
  flower_girl: 'bearers_flower_girl',
  officiant: 'officiants',
  reader_lector: 'officiants',
  soloist_musician: 'officiants',
};

export function roleGroupOf(role: GuestRole): RoleGroup | 'guest' {
  return ROLE_TO_GROUP[role];
}

// Tailwind tint per role group. Cream/ink/terracotta-aligned palette.
export const ROLE_GROUP_CHIP: Record<RoleGroup | 'guest', string> = {
  couple: 'bg-rose-100 text-rose-900 ring-1 ring-rose-200',
  // VIP family tint — deeper rose to read as kin-of-couple, distinct
  // from the wedding-party terracotta tone.
  vip_family: 'bg-rose-200/70 text-rose-950 ring-1 ring-rose-300',
  wedding_party: 'bg-terracotta/10 text-terracotta-700 ring-1 ring-terracotta/20',
  principal_sponsors: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
  secondary_sponsors: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  bearers_flower_girl: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  officiants: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  other_roles: 'bg-ink/10 text-ink/70 ring-1 ring-ink/15',
  guest: 'bg-ink/[0.06] text-ink/60 ring-1 ring-ink/10',
};

// Filter a guest list by selected role-group key (or 'all'). Owner
// directive 2026-05-23 PM removed the social-category filters
// (family/friends/work/school) — those live in the GROUPS section of
// the sidebar (custom guest_groups) rather than as role-based views.
export function filterByRoleGroup<T extends { role: GuestRole }>(
  guests: T[],
  view: string | null,
): T[] {
  if (!view || view === 'all') return guests;
  return guests.filter((g) => roleGroupOf(g.role) === view);
}
