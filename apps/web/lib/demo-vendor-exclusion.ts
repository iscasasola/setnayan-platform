/**
 * Which demo shops a couple's supplier search must hide — ONE rule for every
 * search a couple types into on the Suppliers page.
 *
 * The rule (unchanged — `lib/demo-mode.ts`, `/explore`): a real couple never
 * sees an `is_demo = TRUE` shop; only an ADMIN in demo mode (admin profile +
 * the demo cookie) does.
 *
 * Why it is one helper (owner 2026-10-21 — *"and typing saysay did not
 * show?"*): the category search (`_actions/category-search.ts`) honoured demo
 * mode, while the bench's whole-marketplace search — the one the bottom search
 * bar runs — hid demo shops from EVERYONE, admins in demo mode included. Saysay
 * Host and Band is a demo shop by the owner's own ruling (DECISION_LOG
 * 2026-09-29 "LANE 2 §2C" (1): *SetnaProd and Saysay become `is_demo = true`*),
 * so the owner could find it by category and never by name. Two copies of one
 * rule disagreed; now both call this.
 */
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile, type AdminProfileClaim } from '@/lib/demo-mode';
import { fetchDemoVendorIds } from '@/lib/demo-vendors';

/** PURE. Demo shops are shown only to an admin with the demo cookie set. */
export function demoShopsShownTo(viewer: { hasDemoCookie: boolean; profile: AdminProfileClaim | null }): boolean {
  return viewer.hasDemoCookie && isAdminProfile(viewer.profile);
}

/**
 * The vendor ids this viewer's search must drop: every demo shop, or none when
 * the viewer is an admin in demo mode. Cheap fast-path: no profile read unless
 * the demo cookie is present.
 */
export async function demoVendorIdsHiddenFrom(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const cookieStore = await cookies();
  const hasDemoCookie = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1';
  let profile: AdminProfileClaim | null = null;
  if (hasDemoCookie) {
    const { data } = await supabase
      .from('users')
      .select('account_type, is_internal, is_team_member')
      .eq('user_id', userId)
      .maybeSingle();
    profile = (data as AdminProfileClaim | null) ?? null;
  }
  return demoShopsShownTo({ hasDemoCookie, profile }) ? [] : fetchDemoVendorIds(admin);
}
