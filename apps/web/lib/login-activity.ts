import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Stamp users.last_login_at = now() at the moment a login completes.
 *
 * The column has existed since the 0000 shell schema but was never written.
 * It's the "now" reference for the login-driven ghosting check (lib/ghosting.ts)
 * — that check compares last_login_at to last_ghost_check_at so it runs exactly
 * once per login, with no cron.
 *
 * Called from the two places a session is actually created:
 *   • signInWithPassword (apps/web/app/login/actions.ts) — password login
 *   • /auth/callback (apps/web/app/auth/callback/route.ts) — magic link / OAuth
 *
 * Uses the service-role client for the write (a plain own-row UPDATE would work
 * under RLS too, but the admin client avoids any policy surprises during the
 * narrow login window). Fail-soft: a stamping hiccup must never block the login
 * redirect.
 */
export async function stampLastLogin(authedClient: SupabaseClient): Promise<void> {
  try {
    const {
      data: { user },
    } = await authedClient.auth.getUser();
    if (!user) return;
    const admin = createAdminClient();
    await admin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', user.id);
  } catch (e) {
    // Never block login on a telemetry write.
    console.error('[login] stampLastLogin failed:', e);
  }
}
