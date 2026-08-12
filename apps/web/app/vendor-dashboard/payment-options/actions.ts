'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  classifyPaymentLink,
  initialLinkModeration,
  isVendorProActive,
  type PaymentMethodType,
} from '@/lib/vendor-payment-methods';
import { decodeQrFromR2 } from '@/lib/vendor-payment-methods.server';
import { parseClientRef, vendorPaymentQrPolicy } from '@/lib/r2-client-ref';

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

  // `moderation_status` is NOT part of `row` and must not be — `authenticated`
  // holds no INSERT privilege on it (migration 20271134376999), so naming it is
  // a hard permission failure rather than a silent ignore. Every row this
  // action inserts therefore lands 'pending_review'.
  //
  // The safe lanes below are still approved instantly, exactly as before — but
  // the approving write happens through the service-role client after the
  // insert, so it is a decision the server makes rather than a claim the
  // browser is trusted to send. A vendor POSTing straight to PostgREST skips
  // this code and lands in the review queue, which is the point.
  let autoApprove = false;

  if (methodType === 'bank') {
    // Bank details were auto-approved before by omitting the column and letting
    // the (then 'approved') DEFAULT fill it. That default is now
    // 'pending_review', so the intent has to be stated rather than inherited.
    autoApprove = true;
    const accountNumber = str(formData.get('account_number'), 64);
    if (!accountNumber) fail('Enter the account number or mobile.');
    row.provider = str(formData.get('provider'), 48);
    row.account_name = str(formData.get('account_name'), 96);
    row.account_number = accountNumber;
  } else if (methodType === 'qr') {
    const qrRef = str(formData.get('qr_r2_key'), 512);
    if (!qrRef) fail('Upload your QR image first.');
    // SEC-1: this ref was stored and fetched with no validation at all. Two
    // consequences: (a) decodeQrFromR2 → displayUrlForStoredAsset passes a
    // non-r2:// value through VERBATIM and then fetch()es it, which is an SSRF;
    // (b) the stored ref is presigned to COUPLES later
    // (lib/vendor-payment-methods.server.ts), so a foreign key parked here gets
    // signed for a third party. Pin it to this vendor's own payment-qr folder.
    if (!parseClientRef(qrRef, vendorPaymentQrPolicy(vendorProfileId))) {
      fail('That QR image reference isn’t valid — re-upload and try again.');
    }
    row.qr_r2_key = qrRef;
    // Server-side decode (anti-swap): store what the QR ACTUALLY encodes, not
    // what the vendor typed. If the image can't be read, keep the vendor's note
    // as a fallback and route the method to admin review.
    const decoded = await decodeQrFromR2(qrRef);
    if (decoded) {
      row.decoded_destination = decoded;
      autoApprove = true;
    } else {
      row.decoded_destination = str(formData.get('decoded_destination'), 256);
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
    autoApprove = mod.status === 'approved'; // allowlisted domain
  }

  const { data: inserted, error } = await supabase
    .from('vendor_payment_methods')
    .insert(row)
    .select('payment_method_id')
    .maybeSingle();
  if (error) fail(error.message);

  // The auto-approve lanes, performed by the server rather than asserted by the
  // client. Best-effort on purpose: if it fails the row stays 'pending_review',
  // which shows it to nobody and puts it in the admin queue — the safe
  // direction. `approved` is reported to the vendor only if the flip landed, so
  // the message can never promise a visibility the row does not have.
  let approved = false;
  if (autoApprove && inserted) {
    const admin = createAdminClient();
    const { error: modErr } = await admin
      .from('vendor_payment_methods')
      .update({ moderation_status: 'approved', updated_at: new Date().toISOString() })
      .eq('payment_method_id', (inserted as { payment_method_id: string }).payment_method_id);
    if (modErr) {
      console.error('[addPaymentMethod] auto-approve failed, left pending:', modErr.message);
    } else {
      approved = true;
    }
  }

  revalidatePath(BASE);
  flash(
    approved
      ? 'Payment option saved — it’s now on your clients’ payment screen.'
      : 'Saved — it shows to clients once our team clears it (quick review).',
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
