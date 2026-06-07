'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * /admin/token-bands — edit the region → burn-band map (owner-locked
 * "admin-editable" requirement of the token economy, 2026-06-05). Each region
 * maps to a band (1/2/3) and a token cost charged when a vendor answers an
 * inquiry for a wedding in that region (₱100/token → 1/2/3 = ₱100/200/300).
 * Table + seed live in migration 20260908000000.
 */

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

export async function updateBand(formData: FormData) {
  await requireAdmin();
  const regionSlug = formData.get('region_slug');
  const bandRaw = formData.get('band');
  const tokensRaw = formData.get('tokens');

  if (typeof regionSlug !== 'string' || regionSlug.length === 0) {
    throw new Error('Missing region');
  }
  const band = Number(bandRaw);
  const tokens = Number(tokensRaw);
  if (!Number.isInteger(band) || band < 1 || band > 3) {
    throw new Error('Band must be 1, 2, or 3');
  }
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > 99) {
    throw new Error('Tokens must be a positive whole number (1–99)');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('token_burn_bands')
    .update({ band, tokens, updated_at: new Date().toISOString() })
    .eq('region_slug', regionSlug);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/token-bands');
}
