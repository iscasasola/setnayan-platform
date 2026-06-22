'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken } from '@/lib/encryption';
import {
  getSecretIntegration,
  getOAuthIntegration,
} from '@/lib/integrations/registry';

// Integration Activation Console — PR1 (email slice) · server actions.
//
// Writes are service-role (createAdminClient) — platform_integration_secrets is
// deny-by-default (no RLS policies), and the API key is AES-256-GCM-encrypted
// before it ever touches the DB. requireAdmin mirrors the team-member-aware gate
// used across /admin (NOT the SQL is_admin() helper, which only checks
// account_type='admin' and would lock out team-member admins).

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
    const enc = encryptToken(keyRaw.trim());
    await admin
      .from('platform_integration_secrets')
      .update({ resend_api_key_enc: enc, updated_at: new Date().toISOString() })
      .eq('id', 1);
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
    const admin = createAdminClient();
    const enc = encryptToken(secretRaw.trim());
    await admin
      .from('platform_integration_secrets')
      .update({ [def.secretColumn]: enc, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

export async function clearIntegrationSecret(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('integration_id');
  const def = typeof id === 'string' ? getSecretIntegration(id) : undefined;
  if (!def) throw new Error('Unknown integration');

  const admin = createAdminClient();
  await admin
    .from('platform_integration_secrets')
    .update({ [def.secretColumn]: null, updated_at: new Date().toISOString() })
    .eq('id', 1);

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
    const enc = encryptToken(secretRaw.trim());
    await admin
      .from('platform_integration_secrets')
      .update({ [def.secretColumn]: enc, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?saved=1');
}

export async function clearOAuthSecret(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('oauth_id');
  const def = typeof id === 'string' ? getOAuthIntegration(id) : undefined;
  if (!def) throw new Error('Unknown integration');

  const admin = createAdminClient();
  await admin
    .from('platform_integration_secrets')
    .update({ [def.secretColumn]: null, updated_at: new Date().toISOString() })
    .eq('id', 1);

  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?cleared=1');
}

export async function clearResendKey(): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from('platform_integration_secrets')
    .update({
      resend_api_key_enc: null,
      last_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  revalidatePath('/admin/integrations');
  redirect('/admin/integrations?cleared=1');
}
