/**
 * THE admin predicate — pure, dependency-free, unit-testable.
 *
 * Split out of `lib/admin/require-admin.ts` on 2026-07-27 so the RULE can be
 * tested without dragging in `server-only` / `next/navigation` / the Supabase
 * server client. `require-admin.ts` re-exports it; import it from there in app
 * code and from here in tests.
 *
 * Three clauses, all of them load-bearing:
 *   - `is_internal`    → Setnayan-owned internal accounts (§ 10a)
 *   - `is_team_member` → Team Pool staff (§ 10b) — the people hired to work the
 *                        moderation queues
 *   - `account_type === 'admin'` → explicitly-typed admin accounts
 *
 * Dropping any clause locks out a real class of staff. That is exactly what
 * `app/admin/editorial-review/[editorialId]/actions.ts` did until 2026-07-27
 * with an `is_internal`-only copy: a team member could approve payouts and
 * verify vendors but got a hard "Unauthorized" on the editorial queue.
 */

/** The columns the admin predicate reads off `public.users`. */
export type AdminProfileRow = {
  is_internal?: boolean | null;
  is_team_member?: boolean | null;
  account_type?: string | null;
};

/** Is this `public.users` row an admin? Exact match on `account_type`. */
export function isAdminProfile(profile: AdminProfileRow | null | undefined): boolean {
  return !!(
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin'
  );
}
