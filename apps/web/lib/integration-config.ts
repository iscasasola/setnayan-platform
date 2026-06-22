import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken } from '@/lib/encryption';
import {
  SECRET_INTEGRATIONS,
  ALL_SECRET_COLUMNS,
  type SecretIntegrationDef,
  type OAuthResolveSpec,
} from '@/lib/integrations/registry';

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

// ── Registry-driven "simple secret" integrations (PR2) ──────────────────────
//
// Generic DB-first / env-fallback resolver for any integration in
// SECRET_INTEGRATIONS (lib/integrations/registry.ts) — one encrypted API key, no
// extra config. Mirrors resolveResendConfig exactly: decrypt the registry's
// secretColumn from the deny-by-default platform_integration_secrets singleton,
// fall back to the registry's env var when unset/unreadable. UNCACHED so a key
// the owner just saved takes effect on the next request. Byte-identical to the
// pre-console behavior when the DB column is empty.
export async function resolveIntegrationSecret(
  def: SecretIntegrationDef,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_integration_secrets')
      .select(def.secretColumn)
      .eq('id', 1)
      .maybeSingle();
    const enc = (data as Record<string, unknown> | null)?.[def.secretColumn] as
      | string
      | null
      | undefined;
    if (enc) {
      try {
        return decryptToken(enc);
      } catch {
        // Bad ciphertext or unset/rotated ENCRYPTION_KEY → fall back to env.
      }
    }
  } catch {
    // DB unreachable / column absent (pre-migration) → env fallback below.
  }
  return process.env[def.envFallback] || null;
}

/** OpenAI moderation key (DB-first, env-fallback to OPENAI_API_KEY). */
export async function resolveOpenAiKey(): Promise<string | null> {
  const def = SECRET_INTEGRATIONS.find((i) => i.id === 'openai');
  if (!def) return process.env.OPENAI_API_KEY || null;
  return resolveIntegrationSecret(def);
}

/**
 * Presence map { [secretColumn]: hasStoredKey } for every registry integration.
 * The encrypted values are read here but reduced to BOOLEANS before returning —
 * the ciphertext never leaves this function, so the admin console can show
 * per-integration status without holding any secret in its render tree
 * (defense-in-depth against a future edit leaking the row to a client prop/log).
 * UNCACHED; all-false on any error (DB unreachable / table absent).
 */
export async function getSecretPresenceMap(): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  for (const col of ALL_SECRET_COLUMNS) map[col] = false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_integration_secrets')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (row) {
      for (const col of ALL_SECRET_COLUMNS) map[col] = Boolean(row[col]);
    }
  } catch {
    // leave all-false
  }
  return map;
}

// ── OAuth client config (PR3) ───────────────────────────────────────────────
//
// DB-first / env-fallback resolver for an OAuth integration's client config:
// the encrypted client SECRET from platform_integration_secrets + the non-secret
// client ID/KEY + REDIRECT URI from platform_settings, each falling back to its
// env var. Returns resolved strings ('' when neither DB nor env has a value);
// the provider's get*OAuthConfig() helper applies its own missing-check on top,
// so the public { ready } shape is byte-identical when the DB is empty.
//
// UNCACHED so a value saved from the console takes effect on the next request.
// Column names are NOT user-controlled (they come from the static OAUTH_SPECS
// registry), so the dynamic .select()/access is safe. Both selects pass a
// `string`-typed argument (not a template-literal type) to avoid the PostgREST
// select-string parser error on the untyped admin client.
export interface OAuthClientResolved {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function resolveOAuthClientConfig(
  spec: OAuthResolveSpec,
): Promise<OAuthClientResolved> {
  let clientSecret = '';
  let clientId = '';
  let redirectUri = '';
  try {
    const admin = createAdminClient();
    const secretCol: string = spec.secretColumn;
    const settingsCols: string = `${spec.clientIdColumn}, ${spec.redirectUriColumn}`;
    const [secretRes, settingsRes] = await Promise.all([
      admin
        .from('platform_integration_secrets')
        .select(secretCol)
        .eq('id', 1)
        .maybeSingle(),
      admin.from('platform_settings').select(settingsCols).eq('id', 1).maybeSingle(),
    ]);
    const enc = (secretRes.data as Record<string, unknown> | null)?.[
      spec.secretColumn
    ] as string | null | undefined;
    if (enc) {
      try {
        clientSecret = decryptToken(enc);
      } catch {
        // bad ciphertext / rotated key → env fallback below
      }
    }
    const s = settingsRes.data as Record<string, unknown> | null;
    clientId = ((s?.[spec.clientIdColumn] as string | null) ?? '').trim();
    redirectUri = ((s?.[spec.redirectUriColumn] as string | null) ?? '').trim();
  } catch {
    // DB unreachable / columns absent (pre-migration) → env fallback below.
  }
  return {
    clientId: clientId || process.env[spec.clientIdEnv] || '',
    clientSecret: clientSecret || process.env[spec.secretEnv] || '',
    redirectUri: redirectUri || process.env[spec.redirectUriEnv] || '',
  };
}
