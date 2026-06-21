import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken } from '@/lib/encryption';

// Integration Activation Console — PR1 (email slice).
//
// DB-first / env-fallback resolver for the Resend integration, so the owner can
// set the key from /admin/integrations WITHOUT a Vercel redeploy. Reads the
// encrypted key from the deny-by-default platform_integration_secrets singleton
// via the service-role admin client, decrypts it, and falls back to the
// RESEND_* env vars when no DB value exists (byte-identical to the old behavior
// in lib/email.ts).
//
// UNCACHED on purpose: a key the owner just saved must take effect immediately,
// so this does NOT route through unstable_cache. The DB round-trip is cheap and
// email paths are low-frequency.

export type ResendConfig = { apiKey: string | null; fromAddress: string | null };

export async function resolveResendConfig(): Promise<ResendConfig> {
  let apiKey: string | null = null;
  let fromAddress: string | null = null;

  try {
    const admin = createAdminClient();
    const [secretRes, settingsRes] = await Promise.all([
      admin
        .from('platform_integration_secrets')
        .select('resend_api_key_enc')
        .eq('id', 1)
        .maybeSingle(),
      admin
        .from('platform_settings')
        .select('resend_from_address')
        .eq('id', 1)
        .maybeSingle(),
    ]);
    const enc = secretRes.data?.resend_api_key_enc as string | null | undefined;
    if (enc) {
      try {
        apiKey = decryptToken(enc);
      } catch {
        // Bad ciphertext or unset/rotated ENCRYPTION_KEY → fall back to env.
        apiKey = null;
      }
    }
    fromAddress =
      (settingsRes.data?.resend_from_address as string | null | undefined) ?? null;
  } catch {
    // DB unreachable / table absent (pre-migration) → env fallback below.
  }

  apiKey = apiKey || process.env.RESEND_API_KEY || null;
  fromAddress =
    fromAddress ||
    process.env.RESEND_FROM_ADDRESS ||
    process.env.RESEND_FROM_EMAIL ||
    null;

  return { apiKey, fromAddress };
}

/** True when a Resend key is resolvable (DB or env). */
export async function isResendConfigured(): Promise<boolean> {
  const { apiKey } = await resolveResendConfig();
  return Boolean(apiKey);
}

// ── Setnayan-AI paywall flag ────────────────────────────────────────────────
//
// DB-first / env-fallback resolver for the Setnayan-AI paywall, so the owner can
// flip monetization ON/OFF from /admin/integrations WITHOUT a Vercel env change
// + redeploy.
//
// platform_settings.setnayan_ai_paywall_enabled is TRI-STATE:
//   • NULL  → defer to the SETNAYAN_AI_PAYWALL_ENABLED env var (today's source
//             of truth). Byte-identical to the pre-console behavior.
//   • TRUE  → paywall on  (DB overrides env).
//   • FALSE → paywall off (DB overrides env).
//
// This DELIBERATELY supersedes the 2026-06-16 design's "OR-wins" rule: OR-wins
// is not a clean toggle (it can never turn the paywall OFF from the console once
// the env flag is set to true). DB-first gives a real tri-state on/off toggle
// and matches the email slice's resolver. The ₱3,999 flip is currently PARKED
// (env OFF → AI free) pending the holistic pricing pass (DECISION_LOG 2026-06-22);
// when the owner is ready, this console flips it with no redeploy.
//
// UNCACHED on purpose (same reasoning as resolveResendConfig): a flip the owner
// just made must take effect on the next request, so this does NOT route through
// unstable_cache. The leaf predicate in lib/setnayan-ai.ts stays SYNCHRONOUS —
// callers await this once and thread the resolved boolean in.
export async function resolveSetnayanAiPaywallEnabled(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_settings')
      .select('setnayan_ai_paywall_enabled')
      .eq('id', 1)
      .maybeSingle();
    const dbVal = data?.setnayan_ai_paywall_enabled as boolean | null | undefined;
    if (typeof dbVal === 'boolean') return dbVal;
  } catch {
    // DB unreachable / column absent (pre-migration) → env fallback below.
  }
  return process.env.SETNAYAN_AI_PAYWALL_ENABLED === 'true';
}
