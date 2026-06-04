import type { SupabaseClient } from '@supabase/supabase-js';
import type { NavGroup } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';

/**
 * Vendor role helpers — the UI side of the multi-user vendor workspace.
 *
 * The DB backbone already exists: `vendor_team_members(role)` (enum
 * owner>admin>agent>viewer) + the `current_vendor_ids(min_role)` RLS helper.
 * This module resolves the current user's role for nav/role-aware rendering
 * and centralizes the Phase-1 policy of WHAT each role may see in the nav.
 *
 * SCOPE (Phase 1 — role-aware nav shell): owner/admin see the full dashboard;
 * agent/viewer see a reduced nav (Home/Overview only). Agents currently
 * resolve to NULL vendor data via the owner-only `fetchOwnVendorProfile`, so
 * no data is exposed — the per-service DATA scoping (agents see only their
 * assigned services + customers) + route guards land in Phase 2, where they
 * become load-bearing.
 */

const ROLE_RANK: Record<VendorTeamRole, number> = {
  owner: 4,
  admin: 3,
  agent: 2,
  viewer: 1,
};

/** owner/admin manage the whole vendor; agent/viewer are scoped members. */
export function canManageVendor(role: VendorTeamRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Resolve the current user's role within their vendor workspace.
 *
 * Source of truth = `vendor_team_members` (a user can sit on multiple vendors;
 * we take the highest-ranked membership). Legacy fallback: a user who owns a
 * `vendor_profiles` row but has no membership row (pre-owner-seed trigger) is
 * treated as 'owner'. Returns null if the user has no vendor relationship.
 */
export async function resolveVendorRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorTeamRole | null> {
  const { data: memberships } = await supabase
    .from('vendor_team_members')
    .select('role')
    .eq('user_id', userId);

  const roles = (memberships ?? [])
    .map((m) => (m as { role: VendorTeamRole }).role)
    .filter((r): r is VendorTeamRole => r in ROLE_RANK);
  if (roles.length > 0) {
    return roles.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? 'viewer';
  }

  const { data: owned } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', userId)
    .maybeSingle();
  return owned ? 'owner' : null;
}

/**
 * Nav item keys an agent/viewer may see in Phase 1. Owner/admin always see
 * the full nav. Phase 2 expands this to the agent's operational surfaces
 * (Services / Bookings / Messages) once per-service data scoping lands.
 */
export const VENDOR_SCOPED_NAV_ITEM_KEYS: ReadonlySet<string> = new Set(['overview']);

/** Bottom-nav tab keys an agent/viewer may see in Phase 1 (Home + More). */
export const VENDOR_SCOPED_BOTTOM_NAV_KEYS: ReadonlySet<string> = new Set([
  'profile', // the Home tab (key kept as 'profile' for localStorage continuity)
  'more',
]);

/** Filter a vendor NavGroup[] down to what `role` may see; drops empty groups. */
export function filterVendorNavGroups(
  groups: NavGroup[],
  role: VendorTeamRole | null | undefined,
): NavGroup[] {
  if (canManageVendor(role)) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => VENDOR_SCOPED_NAV_ITEM_KEYS.has(it.key)),
    }))
    .filter((g) => g.items.length > 0);
}
