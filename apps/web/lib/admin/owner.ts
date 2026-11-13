/**
 * Who "the owner" is — pure, so the rule is testable.
 *
 * The owner is the one account the signup trigger already singles out (§ 10a,
 * `on_auth_user_created`): this address AND `is_internal`. Both halves, because
 * a person may edit their own email but may NOT set `is_internal`
 * (`guard_users_privilege_columns`), so neither half is enough alone.
 *
 * SQL twin: `public.is_platform_owner(uuid)` in migration
 * 20271344663185_admin_team_areas_levels_and_owner_self_approval.sql. The test
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
