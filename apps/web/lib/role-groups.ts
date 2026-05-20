import type { GuestRole } from './guests';

export type RoleGroup =
  | 'couple'
  | 'wedding_party'
  | 'principal_sponsors'
  | 'secondary_sponsors'
  | 'bearers_flower_girl'
  | 'officiants'
  | 'other_roles';

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
  couple: 'Bride & Groom',
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
  wedding_party: 'bg-terracotta/10 text-terracotta-700 ring-1 ring-terracotta/20',
  principal_sponsors: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
  secondary_sponsors: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  bearers_flower_girl: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  officiants: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  other_roles: 'bg-ink/10 text-ink/70 ring-1 ring-ink/15',
  guest: 'bg-ink/[0.06] text-ink/60 ring-1 ring-ink/10',
};

// Filter a guest list by selected role-group key (or 'all').
export function filterByRoleGroup<T extends { role: GuestRole; group_category: string }>(
  guests: T[],
  view: string | null,
): T[] {
  if (!view || view === 'all') return guests;

  if (view === 'family' || view === 'friends' || view === 'work' || view === 'school') {
    return guests.filter((g) => g.group_category === view);
  }

  return guests.filter((g) => roleGroupOf(g.role) === view);
}
