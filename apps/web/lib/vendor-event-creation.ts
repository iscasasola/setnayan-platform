import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserRoleSummary } from '@/lib/roles';

/**
 * vendor-event-creation.ts — the one place that answers "may this account make
 * an event?"
 *
 * ─── THE RULING ────────────────────────────────────────────────────────────
 * Owner, 2026-08-15, verbatim: *"supplier/vendors also has their own user
 * account. but they cannot make from their vendor account."* A supplier plans
 * their own celebrations from a SEPARATE personal account. The shop account is
 * the business, and the business does not plan celebrations.
 *
 * Asked what should happen to the personal side of an account that opens a
 * shop, he chose **keep both, block only creating**. So this is the entire
 * scope of the restriction: creating. Reading, opening, editing and deleting an
 * event they already made are all untouched.
 *
 * ─── WHY A SHARED FUNCTION AND NOT A CHECK PER SCREEN ──────────────────────
 * 🔑 ONE GATE, NOT FOUR CHECKS. Four server entry points create an event —
 * `createWeddingEvent`, `planNextYearEvent`, `commitOnboardingEvent` and
 * `commitSimpleEvent`. Checking a rule in four places is four chances to forget,
 * and the next creation path makes five. This is the same shape as the live
 * photo wall (2026-08-12), where three surfaces each asked one half of a
 * question and the fix was to fuse them into one call.
 *
 * ⚠ AND IT REPLACES A LAYOUT REDIRECT THAT COULD NEVER HAVE HELD THE RULE. The
 * old block lived in `dashboard/layout.tsx`, so it covered only routes under
 * `/dashboard` — while two of the four creation paths commit from
 * `/onboarding/*`, entirely outside that tree. A guard that cannot see two of
 * the four doors is not the rule; it just looked like it while nobody had a
 * vendor account to try it with.
 *
 * ─── WHAT COUNTS AS A SHOP ACCOUNT ─────────────────────────────────────────
 * BOTH halves, deliberately: the `account_type` LABEL says vendor **and**
 * `hasVendorAccess` is true (a `vendor_profiles` or `vendor_team_members` row
 * really exists). Asking only the label would strand somebody whose shop was
 * deleted without resetting it — the exact disagreement that caused the
 * 2026-08-10 "more than 20 redirections" loop, whose fix was to make both sides
 * ask the same authoritative question. The cheap label is tested FIRST, so a
 * customer pays for no extra lookup at all.
 */
export async function shopAccountMayNotCreateEvents(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('users')
    .select('account_type')
    .eq('user_id', userId)
    .maybeSingle();

  // The cheap label first: a customer never pays for the authoritative lookup.
  if (profile?.account_type !== 'vendor') return false;

  const roles = await fetchUserRoleSummary(supabase, userId);
  return roles.hasVendorAccess;
}

/**
 * Re-exported so a server caller has ONE import for the rule and its sentence.
 * The string itself lives in a boundary-free module because the onboarding
 * wizard that shows it is a client component and cannot import `server-only`.
 */
export { SHOP_ACCOUNT_CANNOT_CREATE_COPY } from './vendor-event-creation-copy';
