'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken } from '@/lib/encryption';

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
