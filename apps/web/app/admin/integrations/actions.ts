'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSecretIntegration,
  getOAuthIntegration,
  MAYA_INTEGRATION,
} from '@/lib/integrations/registry';
import {
  writeIntegrationSecretColumns,
  clearIntegrationSecretColumns,
  CONSOLE_SAVE_NOTE,
} from '@/lib/integrations/write';

// Integration Activation Console — PR1 (email slice) · server actions.
//
// Writes are service-role (createAdminClient) — platform_integration_secrets is
// deny-by-default (no RLS policies), and the API key is AES-256-GCM-encrypted
// before it ever touches the DB. requireAdmin mirrors the team-member-aware gate
// used across /admin (NOT the SQL is_admin() helper, which only checks
// account_type='admin' and would lock out team-member admins).
//
// 2026-07-25: the encrypt + upsert + rotation-stamp body moved to
// lib/integrations/write.ts so the Secrets & Rotation board's inline paste boxes
// share this exact write layer instead of growing a second copy of it. These
// actions keep the console's own concerns: the allowlist lookup, the non-secret
// config columns on platform_settings, and where to redirect afterwards.

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

export async function saveResendConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // From-address — non-secret config on platform_settings.
  const fromRaw = formData.get('resend_from_address');
  const fromAddress = typeof fromRaw === 'string' ? fromRaw.trim() : '';
  await admin
    .from('platform_settings')
    .update({ resend_from_address: fromAddress || null })
    .eq('id', 1);

  // API key — secret. Encrypt + store ONLY if a new value was entered; a blank
  // field means "keep the existing key" (so the masked display never round-trips
  // the stored secret back through the form).
  const keyRaw = formData.get('resend_api_key');
  if (typeof keyRaw === 'string' && keyRaw.trim()) {
    const res = await writeIntegrationSecretColumns(
      { resend_api_key_enc: keyRaw.trim() },
      CONSOLE_SAVE_NOTE,
    );
    // Before the shared writer, a missing ENCRYPTION_KEY threw here and the
    // owner got a 500. Now it comes back as a status — say so rather than
    // redirecting to "Saved." with nothing stored.
    if (!res.ok) redirect('/admin/integrations?error=secret_write');
  }

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

export async function setAiPaywall(formData: FormData): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // Tri-state, NON-secret feature flag → world-readable platform_settings (NOT
  // the secrets table). 'env' clears the column (NULL) so the resolver defers to
  // SETNAYAN_AI_PAYWALL_ENABLED; 'on'/'off' override env. resolveSetnayanAi-
  // PaywallEnabled() reads this DB-first and takes effect on the next request.
  const mode = formData.get('mode');
  const value = mode === 'on' ? true : mode === 'off' ? false : null;
  await admin
    .from('platform_settings')
    .update({ setnayan_ai_paywall_enabled: value })
    .eq('id', 1);

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

// ── Registry-driven "simple secret" integrations (PR2) ──────────────────────
//
// Generic save/clear for any integration in SECRET_INTEGRATIONS. The form posts
// `integration_id`; we resolve it against the registry (the column ALLOWLIST) so
// an arbitrary id can never write a non-registered column. The key is encrypted
// before storage and never echoed back (blank field = keep current).

export async function saveIntegrationSecret(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('integration_id');
  const def = typeof id === 'string' ? getSecretIntegration(id) : undefined;
  if (!def) throw new Error('Unknown integration');

  const secretRaw = formData.get('secret');
  if (typeof secretRaw === 'string' && secretRaw.trim()) {
    const res = await writeIntegrationSecretColumns(
      { [def.secretColumn]: secretRaw.trim() },
      CONSOLE_SAVE_NOTE,
    );
    if (!res.ok) redirect('/admin/integrations?error=secret_write');
  }

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

export async function clearIntegrationSecret(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('integration_id');
  const def = typeof id === 'string' ? getSecretIntegration(id) : undefined;
  if (!def) throw new Error('Unknown integration');

  await clearIntegrationSecretColumns([def.secretColumn]);

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?cleared=1');
}

// ── Credentialed integration config (PR3b · OAuth clients + PR4a · social) ──
//
// Save a credentialed integration's config from the console: the encrypted
// SECRET (platform_integration_secrets) + non-secret config fields
// (platform_settings). Both the integration id and every config column are
// validated against the CREDENTIAL_INTEGRATIONS allowlist (OAuth clients +
// social-publish credentials), so a form value can never write an unregistered
// column. The secret is only written when a new value is entered (blank = keep
// current); config fields write their value or NULL (blank = clear → resolver
// falls back to env). Per-field `validate` (url / numeric) rejects a malformed
// value before persisting — these flow into live OAuth redirects + Graph URLs.

export async function saveOAuthConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('oauth_id');
  const def = typeof id === 'string' ? getOAuthIntegration(id) : undefined;
  if (!def) throw new Error('Unknown integration');
  const admin = createAdminClient();

  // Non-secret config → platform_settings. Columns come ONLY from the registry.
  const patch: Record<string, string | null> = {};
  for (const field of def.configFields) {
    const raw = formData.get(field.column);
    const val = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    if (val && field.validate === 'url') {
      let ok = false;
      try {
        const u = new URL(val);
        ok = u.protocol === 'https:' || u.protocol === 'http:';
      } catch {
        ok = false;
      }
      if (!ok) redirect('/admin/integrations?error=invalid_config');
    }
    if (val && field.validate === 'numeric' && !/^\d+$/.test(val)) {
      redirect('/admin/integrations?error=invalid_config');
    }
    patch[field.column] = val;
  }
  await admin.from('platform_settings').update(patch).eq('id', 1);

  // Client secret → encrypted, only if a new value was entered.
  const secretRaw = formData.get('client_secret');
  if (typeof secretRaw === 'string' && secretRaw.trim()) {
    const res = await writeIntegrationSecretColumns(
      { [def.secretColumn]: secretRaw.trim() },
      CONSOLE_SAVE_NOTE,
    );
    if (!res.ok) redirect('/admin/integrations?error=secret_write');
  }

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

export async function clearOAuthSecret(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('oauth_id');
  const def = typeof id === 'string' ? getOAuthIntegration(id) : undefined;
  if (!def) throw new Error('Unknown integration');

  await clearIntegrationSecretColumns([def.secretColumn]);

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?cleared=1');
}

export async function clearResendKey(): Promise<void> {
  await requireAdmin();
  // `last_verified_at` clears with it — see COMPANION_NULL_ON_CLEAR.
  await clearIntegrationSecretColumns(['resend_api_key_enc']);
  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?cleared=1');
}

// ── Maya / PayMaya (PR4c) — bespoke 2-secret integration ────────────────────
//
// Maya needs TWO secrets (public + secret key form one Basic-auth pair) + one
// config (checkout endpoint), so it can't use the single-secret saveOAuthConfig.
// Each key is encrypted + written only when a non-blank value is entered (blank =
// keep current); the endpoint is non-secret config (blank = clear → env fallback).

export async function saveMayaConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // Non-secret config → platform_settings. Written UNCONDITIONALLY each save
  // (blank = NULL = env fallback) — same prefill-keep contract as the OAuth /
  // Resend config fields: the card prefills the field with the resolved value, so
  // a normal re-save preserves it; only a deliberately-blanked field clears it.
  const endpointRaw = formData.get('maya_checkout_endpoint');
  const endpoint =
    typeof endpointRaw === 'string' && endpointRaw.trim() ? endpointRaw.trim() : null;
  if (endpoint) {
    let ok = false;
    try {
      const u = new URL(endpoint);
      ok = u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      ok = false;
    }
    if (!ok) redirect('/admin/integrations?error=invalid_config');
  }
  await admin
    .from('platform_settings')
    .update({ [MAYA_INTEGRATION.endpointColumn]: endpoint })
    .eq('id', 1);

  // Secrets → write only the keys that were entered. Both Maya columns map to
  // the same registry id, so the shared writer stamps the rotation clock once.
  const secretPatch: Record<string, string> = {};
  const pubRaw = formData.get('maya_public_api_key');
  if (typeof pubRaw === 'string' && pubRaw.trim()) {
    secretPatch[MAYA_INTEGRATION.publicKeyColumn] = pubRaw.trim();
  }
  const secRaw = formData.get('maya_secret_api_key');
  if (typeof secRaw === 'string' && secRaw.trim()) {
    secretPatch[MAYA_INTEGRATION.secretKeyColumn] = secRaw.trim();
  }
  const res = await writeIntegrationSecretColumns(secretPatch, CONSOLE_SAVE_NOTE);
  if (!res.ok) redirect('/admin/integrations?error=secret_write');

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

export async function clearMayaSecrets(): Promise<void> {
  await requireAdmin();
  await clearIntegrationSecretColumns([
    MAYA_INTEGRATION.publicKeyColumn,
    MAYA_INTEGRATION.secretKeyColumn,
  ]);
  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?cleared=1');
}
