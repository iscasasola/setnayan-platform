/**
 * Helpers for the dual-role customer ↔ vendor ↔ admin chrome — iteration
 * 0000 event switcher + empty-state monogram (locked 2026-05-15).
 *
 * A single `users` row may carry `account_type='vendor'` AND own/host
 * events as a customer, and a customer-account may carry admin grants
 * via `is_internal` / `is_team_member`. The event switcher (and the
 * empty-state monogram) needs a cheap, single-source check for "which
 * consoles does this user have access to right now."
 *
 * Membership shapes:
 *   - Vendor owner: `vendor_profiles.user_id = auth.uid()`
 *   - Vendor team member: `vendor_team_members.user_id = auth.uid()`
 *   - Admin grant: `users.is_internal` OR `users.is_team_member` OR
 *     `users.account_type = 'admin'`
 */
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRoleSummary = {
  /**
   * True when /dashboard is a reachable surface for this user — i.e. the
   * `/dashboard` layout guard (`account_type === 'vendor' → redirect`)
   * will let them through. Used by the always-visible Switch view pill
   * to decide whether to offer "Customer view" as a target.
   */
  hasCustomerAccess: boolean;
  /**
   * True if the user owns a `vendor_profiles` row OR sits on any
   * `vendor_team_members` row. Either of these grants access to the
   * Shop console (iteration 0022 / `/vendor-dashboard`).
   */
  hasVendorAccess: boolean;
  /**
   * True if the user has any admin grant. Maps to the rule used by
   * `/admin` layout: `is_internal` OR `is_team_member` OR
   * `account_type='admin'`.
   */
  hasAdminAccess: boolean;
  /**
   * List of vendor profiles the user can switch into. Each entry is the
   * minimal payload needed by the switcher row — vendor_profile_id,
   * business_name, logo_url. Empty array when the user has no vendor
   * access.
   */
  vendorProfiles: VendorSwitchTarget[];
};

export type VendorSwitchTarget = {
  vendor_profile_id: string;
  business_name: string;
  logo_url: string | null;
};

/**
 * Resolves the user's role summary in one round trip. Cheap enough to run
 * inside the chrome layout — three small reads in parallel, each scoped
 * to the user's id by RLS / explicit predicate.
 *
 * Returns an empty summary when no user is signed in (the chrome callers
 * already short-circuit to /login in that case; this is defensive).
 *
 * Wrapped in React `cache()` — the outer dashboard layout AND the inner
 * `[eventId]` layout both need the role pills, so before the cache they ran
 * the three sub-queries twice per navigation. Now they share one fetch.
 */
export const fetchUserRoleSummary = cache(async (
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRoleSummary> => {
  const [profileRes, ownedRes, teamRes] = await Promise.all([
    supabase
      .from('users')
      .select('account_type, is_internal, is_team_member')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, logo_url')
      .eq('user_id', userId),
    supabase
      .from('vendor_team_members')
      .select(
        'vendor_profile_id, vendor_profiles:vendor_profile_id ( business_name, logo_url )',
      )
      .eq('user_id', userId),
  ]);

  const profile = profileRes.data;
  const hasAdminAccess = !!(
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin'
  );

  const owned = (ownedRes.data ?? []) as Array<{
    vendor_profile_id: string;
    business_name: string | null;
    logo_url: string | null;
  }>;
  type TeamRow = {
    vendor_profile_id: string;
    vendor_profiles:
      | { business_name: string | null; logo_url: string | null }
      | Array<{ business_name: string | null; logo_url: string | null }>
      | null;
  };
  const team = (teamRes.data ?? []) as TeamRow[];

  const vendorProfiles: VendorSwitchTarget[] = [];
  const seen = new Set<string>();
  for (const row of owned) {
    if (seen.has(row.vendor_profile_id)) continue;
    seen.add(row.vendor_profile_id);
    vendorProfiles.push({
      vendor_profile_id: row.vendor_profile_id,
      business_name: row.business_name?.trim() || 'My vendor profile',
      logo_url: row.logo_url ?? null,
    });
  }
  for (const row of team) {
    if (seen.has(row.vendor_profile_id)) continue;
    seen.add(row.vendor_profile_id);
    const vp = Array.isArray(row.vendor_profiles)
      ? row.vendor_profiles[0]
      : row.vendor_profiles;
    vendorProfiles.push({
      vendor_profile_id: row.vendor_profile_id,
      business_name: vp?.business_name?.trim() || 'Team vendor',
      logo_url: vp?.logo_url ?? null,
    });
  }

  return {
    hasCustomerAccess: profile?.account_type !== 'vendor',
    hasVendorAccess: vendorProfiles.length > 0,
    hasAdminAccess,
    vendorProfiles,
  };
});
