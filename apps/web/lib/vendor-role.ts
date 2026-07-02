import { cache } from 'react';
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
 * `vendor_profiles` row but has no membership row (pre-seed trigger) is treated
 * as 'admin' (the store creator is the founding admin in the multi-admin org
 * model). Returns null if the user has no vendor relationship.
 *
 * Wrapped in React `cache()` (2026-07-01 perf): the vendor layout AND the page
 * it renders both resolve the role in the SAME request. Because the server
 * `createClient()` is itself request-cached, both call sites pass the identical
 * client reference — so `cache()` keyed on `(supabase, userId)` collapses the
 * two calls into a single set of DB reads instead of running the queries twice.
 */
export const resolveVendorRole = cache(async (
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorTeamRole | null> => {
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
  return owned ? 'admin' : null;
});

/**
 * Nav item keys an agent/viewer may see. Owner/admin always see the full nav.
 * Phase 2b opened the agent's operational surfaces (Bookings / Messages) now
 * that per-customer RLS scoping is live. NOTE (2026-07-02): 'services' was
 * removed here when the Services editor was fully folded into My Shop (which is
 * owner/admin-only) — staff have no scoped services surface until My Shop, or a
 * dedicated staff services view, is opened to them.
 */
export const VENDOR_SCOPED_NAV_ITEM_KEYS: ReadonlySet<string> = new Set([
  'overview',
  'bookings',
  'messages',
]);

/**
 * Bottom-nav tab keys an agent/viewer may see. Reroster 2026-07-01 to the
 * 6-tab proto-shell strip (Overview · Shop · Customers · Performance · Services
 * · On the Day). Agents keep Overview (their landing) + Services (they manage
 * their assigned services); the storefront/money/analytics tabs stay owner/admin
 * only until per-agent data scoping opens them in a later phase.
 */
export const VENDOR_SCOPED_BOTTOM_NAV_KEYS: ReadonlySet<string> = new Set([
  'profile', // the Overview tab (key kept as 'profile' for localStorage continuity)
  // 'services' retired 2026-07-02 — folded into owner/admin-only My Shop.
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
