'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  classifyPaymentLink,
  initialLinkModeration,
  isVendorProActive,
  type PaymentMethodType,
} from '@/lib/vendor-payment-methods';
import { decodeQrFromR2 } from '@/lib/vendor-payment-methods.server';

const BASE = '/vendor-dashboard/payment-options';

function flash(msg: string): never {
  redirect(`${BASE}?msg=${encodeURIComponent(msg)}`);
}
function fail(msg: string): never {
  redirect(`${BASE}?error=${encodeURIComponent(msg)}`);
}

function str(raw: FormDataEntryValue | null, max = 200): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t.slice(0, max) : null;
}

async function requireVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, userId: user.id, vendorProfileId: profile.vendor_profile_id };
}

export async function addPaymentMethod(formData: FormData) {
  const { supabase, userId, vendorProfileId } = await requireVendor();

  const methodType = str(formData.get('method_type')) as PaymentMethodType | null;
  if (methodType !== 'bank' && methodType !== 'qr' && methodType !== 'link') {
    fail('Pick a payment option type.');
  }

  const row: Record<string, unknown> = {
    vendor_profile_id: vendorProfileId,
    method_type: methodType,
    label: str(formData.get('label'), 80) ?? '',
    note: str(formData.get('note'), 200),
    is_shown: true,
  };

  if (methodType === 'bank') {
    const accountNumber = str(formData.get('account_number'), 64);
    if (!accountNumber) fail('Enter the account number or mobile.');
    row.provider = str(formData.get('provider'), 48);
    row.account_name = str(formData.get('account_name'), 96);
    row.account_number = accountNumber;
  } else if (methodType === 'qr') {
    const qrRef = str(formData.get('qr_r2_key'), 512);
    if (!qrRef) fail('Upload your QR image first.');
    row.qr_r2_key = qrRef;
    // Server-side decode (anti-swap): store what the QR ACTUALLY encodes, not
    // what the vendor typed. If the image can't be read, keep the vendor's note
    // as a fallback and route the method to admin review.
    const decoded = await decodeQrFromR2(qrRef);
    if (decoded) {
      row.decoded_destination = decoded;
    } else {
      row.decoded_destination = str(formData.get('decoded_destination'), 256);
      row.moderation_status = 'pending_review';
    }
  } else {
    // link — Pro/Enterprise only
    const pro = await isVendorProActive(supabase, userId);
    if (!pro) fail('Payment links are a Pro & Enterprise feature — upgrade to add one.');
    const url = str(formData.get('link_url'), 512);
    if (!url) fail('Enter your payment link.');
    const cls = classifyPaymentLink(url);
    if (!cls.ok) fail(cls.reason ?? 'That link can’t be used.');
    const mod = initialLinkModeration(url);
    row.link_url = url;
    row.link_domain = mod.domain;
    row.moderation_status = mod.status; // 'approved' (allowlist) or 'pending_review'
  }

  const { error } = await supabase.from('vendor_payment_methods').insert(row);
  if (error) fail(error.message);

  revalidatePath(BASE);
  flash(
    row.moderation_status === 'pending_review'
      ? 'Saved — it shows to clients once our team clears it (quick review).'
      : 'Payment option saved — it’s now on your clients’ payment screen.',
  );
}

export async function deletePaymentMethod(formData: FormData) {
  const { supabase, vendorProfileId } = await requireVendor();
  const id = str(formData.get('payment_method_id'), 64);
  if (!id) fail('Missing payment option.');
  const { error } = await supabase
    .from('vendor_payment_methods')
    .delete()
    .eq('payment_method_id', id)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) fail(error.message);
  revalidatePath(BASE);
  flash('Payment option removed.');
}

export async function setPrimaryPaymentMethod(formData: FormData) {
  const { supabase, vendorProfileId } = await requireVendor();
  const id = str(formData.get('payment_method_id'), 64);
  if (!id) fail('Missing payment option.');
  const nowIso = new Date().toISOString();
  // Clear the current primary first; the partial unique index guarantees one.
  await supabase
    .from('vendor_payment_methods')
    .update({ is_primary: false, updated_at: nowIso })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_primary', true);
  const { error } = await supabase
    .from('vendor_payment_methods')
    .update({ is_primary: true, updated_at: nowIso })
    .eq('payment_method_id', id)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) fail(error.message);
  revalidatePath(BASE);
  flash('Primary payment option updated.');
}

export async function togglePaymentMethodShown(formData: FormData) {
  const { supabase, vendorProfileId } = await requireVendor();
  const id = str(formData.get('payment_method_id'), 64);
  const currentlyShown = str(formData.get('is_shown')) === 'true';
  if (!id) fail('Missing payment option.');
  const { error } = await supabase
    .from('vendor_payment_methods')
    .update({ is_shown: !currentlyShown, updated_at: new Date().toISOString() })
    .eq('payment_method_id', id)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) fail(error.message);
  revalidatePath(BASE);
  flash(!currentlyShown ? 'Now showing to clients.' : 'Hidden from clients.');
}
