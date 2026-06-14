import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Force-logout helper — revoke ALL of a user's auth sessions by user id.
 *
 * Mechanism (migration 20261125000000): a service-role-only SECURITY DEFINER
 * function `public.admin_revoke_user_sessions(uuid)` deletes the user's
 * `auth.sessions` rows (+ sweeps `auth.refresh_tokens`). That kills BOTH
 * refresh AND `supabase.auth.getUser()` on every device immediately — GoTrue
 * resolves the access token's session_id claim against auth.sessions on every
 * /user call, so the next request returns session_not_found and the app's
 * auth guards bounce the user to /login.
 *
 * Why not the SDK / REST? `auth.admin.signOut(jwt)` needs the TARGET user's
 * access token (we never have it server-side), and the GoTrue admin REST API
 * exposes NO per-user logout endpoint (verified against supabase/auth master
 * route table + openapi.yaml, 2026-06-12) — /admin/users/{id} has only
 * GET/PUT/DELETE + factors/passkeys.
 *
 * SECURITY: server-only (service-role). Callers MUST authorize first:
 * - vendor remove-member: only for the member being removed, after the
 *   Owner-gated delete succeeded (best-effort via after()).
 * - Setnayan HQ /admin/users Force sign-out: requireAdmin + audit-logged.
 * Never expose to non-HQ callers beyond those two paths.
 */
export type RevokeAllSessionsResult =
  | { ok: true; sessionsRevoked: number }
  | { ok: false; error: string };

export async function revokeAllSessions(
  userId: string,
): Promise<RevokeAllSessionsResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('admin_revoke_user_sessions', {
      p_user_id: userId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, sessionsRevoked: typeof data === 'number' ? data : 0 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unknown error revoking sessions',
    };
  }
}
