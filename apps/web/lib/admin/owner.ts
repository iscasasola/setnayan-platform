/**
 * Who "the owner" is — pure, so the rule is testable.
 *
 * The owner is the one account the signup trigger already singles out (§ 10a,
 * `on_auth_user_created`): this address AND `is_internal`.
 *
 * ⚠ `isOwnerProfile` is a PRE-FILTER for display only. It reads a `public.users`
 * row, whose email is neither unique nor guarded — and an `account_type = 'admin'`
 * session may set its own `is_internal` (it is "privileged" in
 * `guard_users_privilege_columns`). So a row can look like the owner without being
 * him. Every decision asks the database instead: `readIsPlatformOwner`
 * (`./owner.server.ts`), which reads the sign-in address from `auth.users`.
 *
 * SQL twin: `public.is_platform_owner(uuid)` in migration
 * 20271350705084_admin_team_areas_levels_and_owner_self_approval.sql. The test
 * beside this file reads that migration and fails if the address differs.
 *
 * The owner:
 *   · has every admin area at both levels, and the Team screen cannot narrow him;
 *   · is the ONLY admin who may decide his own two-admin request — by typing the
 *     word, after which it waits 24 hours and then runs (DECISION_LOG
 *     2026-11-13 "THE OWNER APPROVES HIS OWN TWO-ADMIN ACTIONS — TYPED + 24 H").
 */

export const OWNER_EMAIL = 'iscasasolaii@gmail.com';

export type OwnerProfileRow = {
  email?: string | null;
  is_internal?: boolean | null;
};

export function isOwnerProfile(profile: OwnerProfileRow | null | undefined): boolean {
  return Boolean(
    profile?.is_internal === true &&
      typeof profile.email === 'string' &&
      profile.email.trim().toLowerCase() === OWNER_EMAIL,
  );
}
