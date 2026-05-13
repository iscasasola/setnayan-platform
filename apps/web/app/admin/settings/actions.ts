'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function savePlatformSettings(formData: FormData) {
  await requireAdmin();

  const vatRaw = formData.get('default_vat_rate_pct');
  const vatRate = typeof vatRaw === 'string' ? Number(vatRaw) : 12;
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return redirect(
      `/admin/settings?error=${encodeURIComponent('VAT rate must be 0–100')}`,
    );
  }

  const payload = {
    business_name:
      (typeof formData.get('business_name') === 'string'
        ? (formData.get('business_name') as string).trim()
        : '') || 'Setnayan',
    business_tin: nullIfBlank(formData.get('business_tin')),
    business_address: nullIfBlank(formData.get('business_address')),
    business_email: nullIfBlank(formData.get('business_email')),
    bdo_account_name: nullIfBlank(formData.get('bdo_account_name')),
    bdo_account_number: nullIfBlank(formData.get('bdo_account_number')),
    bdo_qr_url: nullIfBlank(formData.get('bdo_qr_url')),
    gcash_account_name: nullIfBlank(formData.get('gcash_account_name')),
    gcash_number: nullIfBlank(formData.get('gcash_number')),
    gcash_qr_url: nullIfBlank(formData.get('gcash_qr_url')),
    default_vat_rate_pct: Math.round(vatRate * 100) / 100,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update(payload)
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/receipts', 'layout');
  redirect('/admin/settings?saved=1');
}
