import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin Account-Access Model — Phase 3 (account takeover) MASTER OFF SWITCH.
 *
 * Takeover (gated impersonation) is the single highest-risk admin power. It
 * ships FLAG-GATED OFF: prod is byte-identical until the owner deliberately
 * flips this on AFTER reviewing the governance scaffold. Every takeover entry
 * point (initiate / approve / start / end) calls `assertTakeoverEnabled()`
 * first, so with the flag off the whole capability is inert — the table, the
 * actions, and the UI exist, but no session can ever be started.
 *
 * DB-first / env-fallback, mirroring resolveSetnayanAiPaywallEnabled()
 * (lib/integration-config.ts) so the owner can flip it from an admin surface
 * WITHOUT a Vercel redeploy.
 *
 * platform_settings.admin_takeover_enabled is TRI-STATE:
 *   • NULL  → defer to the ADMIN_TAKEOVER_ENABLED env var (which itself defaults
 *             OFF — only the literal 'true' enables it). This is the DEFAULT and
 *             keeps prod OFF.
 *   • TRUE  → takeover ENABLED  (DB overrides env).
 *   • FALSE → takeover DISABLED (DB overrides env).
 *
 * The crucial difference from the AI-paywall flag: the env fallback DEFAULTS
 * OFF. With NULL in the DB and ADMIN_TAKEOVER_ENABLED unset, this resolves to
 * `false`. There is no configuration in which an un-touched install has
 * takeover ON.
 *
 * UNCACHED on purpose (same reasoning as the other resolvers): a flip the owner
 * just made — including an EMERGENCY OFF — must take effect on the very next
 * request, so this does NOT route through unstable_cache.
 */
export async function resolveAdminTakeoverEnabled(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_settings')
      .select('admin_takeover_enabled')
      .eq('id', 1)
      .maybeSingle();
    const dbVal = data?.admin_takeover_enabled as boolean | null | undefined;
    if (typeof dbVal === 'boolean') return dbVal;
  } catch {
    // DB unreachable / column absent (pre-migration) → env fallback below.
    // On ANY error we fall through to the env read, which defaults OFF — so a
    // database hiccup can never accidentally ENABLE takeover.
  }
  return process.env.ADMIN_TAKEOVER_ENABLED === 'true';
}

/**
 * Throw unless takeover is enabled. The hard gate every takeover server action
 * calls FIRST. The thrown message is deliberately generic — when the flag is
 * off the surface should read as "not available", not "you lack permission".
 */
export async function assertTakeoverEnabled(): Promise<void> {
  if (!(await resolveAdminTakeoverEnabled())) {
    throw new Error(
      'Account takeover is not enabled on this environment. It is gated OFF pending owner review — see Admin_Account_Access_Model_2026-06-22.md §10.',
    );
  }
}
