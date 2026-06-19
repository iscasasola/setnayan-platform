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
