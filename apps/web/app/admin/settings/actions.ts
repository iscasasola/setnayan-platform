'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deletePublicAsset, uploadPublicAsset } from '@/lib/storage';

/**
 * Admin settings server actions — V2 publisher posture, split flows.
 *
 * 2026-05-29 restructure: the previous one-form-saves-everything pattern
 * (`savePlatformSettings`) is split into two role-aligned actions:
 *
 *   - `saveBusinessIdentity` lives on `/admin/settings` (business name, TIN,
 *     address, email, default VAT rate — values printed on every transaction
 *     receipt).
 *   - `savePaymentInstruments` lives on `/admin/settings/payment-methods`
 *     (BDO + GCash account name / number — the active V2 customer payment
 *     rails that couples reference when transferring for an order).
 *
 * Why split: BDO and GCash account fields are merchant payment configuration
 * and conceptually belong with the active payment-methods surface, not the
 * generic business-identity panel. Owner asked 2026-05-29 evening: "shouldn't
 * this be at payment methods?" — yes. Splitting also lets each surface
 * revalidate the right path on save and surface form-specific success/error
 * messages without conflating the two concerns.
 *
 * `uploadMerchantQr` + `removeMerchantQr` are scoped to QR codes and now
 * revalidate + redirect to the payment-methods surface (their canonical home).
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

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function saveBusinessIdentity(formData: FormData) {
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

export async function savePaymentInstruments(formData: FormData) {
  await requireAdmin();

  // QR URLs are managed via the separate upload/remove actions below — they
  // aren't included in this update, so re-saving text fields doesn't blow
  // away an already-uploaded QR.
  const payload = {
    bdo_account_name: nullIfBlank(formData.get('bdo_account_name')),
    bdo_account_number: nullIfBlank(formData.get('bdo_account_number')),
    gcash_account_name: nullIfBlank(formData.get('gcash_account_name')),
    gcash_number: nullIfBlank(formData.get('gcash_number')),
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update(payload)
    .eq('id', 1);
  if (error) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/admin/settings/payment-methods');
  revalidatePath('/receipts', 'layout');
  redirect('/admin/settings/payment-methods?saved=1');
}

type QrKind = 'bdo' | 'gcash';

function qrColumn(kind: QrKind): 'bdo_qr_url' | 'gcash_qr_url' {
  return kind === 'bdo' ? 'bdo_qr_url' : 'gcash_qr_url';
}

export async function uploadMerchantQr(formData: FormData) {
  await requireAdmin();
  const kindRaw = formData.get('kind');
  if (kindRaw !== 'bdo' && kindRaw !== 'gcash') {
    throw new Error('Invalid QR kind');
  }
  const kind: QrKind = kindRaw;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent('Pick a file first')}`,
    );
  }

  const upload = await uploadPublicAsset({
    pathPrefix: `merchant-qr/${kind}`,
    file,
  });
  if (!upload.ok) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(upload.error)}`,
    );
  }

  const admin = createAdminClient();

  // Read the existing URL so we can clean up the old asset after the row is
  // updated to point at the new one.
  const { data: existing } = await admin
    .from('platform_settings')
    .select(qrColumn(kind))
    .eq('id', 1)
    .maybeSingle();
  const existingUrl: string | null =
    (existing as Record<string, unknown> | null)?.[qrColumn(kind)] as
      | string
      | null
      | undefined ?? null;

  const { error } = await admin
    .from('platform_settings')
    .update({
      [qrColumn(kind)]: upload.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (existingUrl) {
    await deletePublicAsset({ publicUrl: existingUrl });
  }

  revalidatePath('/admin/settings/payment-methods');
  redirect('/admin/settings/payment-methods?qr_uploaded=1');
}

export async function removeMerchantQr(formData: FormData) {
  await requireAdmin();
  const kindRaw = formData.get('kind');
  if (kindRaw !== 'bdo' && kindRaw !== 'gcash') {
    throw new Error('Invalid QR kind');
  }
  const kind: QrKind = kindRaw;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('platform_settings')
    .select(qrColumn(kind))
    .eq('id', 1)
    .maybeSingle();
  const existingUrl: string | null =
    (existing as Record<string, unknown> | null)?.[qrColumn(kind)] as
      | string
      | null
      | undefined ?? null;

  const { error } = await admin
    .from('platform_settings')
    .update({
      [qrColumn(kind)]: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (existingUrl) {
    await deletePublicAsset({ publicUrl: existingUrl });
  }

  revalidatePath('/admin/settings/payment-methods');
  redirect('/admin/settings/payment-methods?qr_removed=1');
}
