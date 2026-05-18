'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { r2Upload, R2_BUCKETS } from '@/lib/r2';
import {
  parseSignatureDataUrl,
  validateContractFile,
} from '@/lib/contracts';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function ensureVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, user, profile };
}

async function clientHeaders() {
  const h = await headers();
  const ipAddress =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;
  return { ipAddress, userAgent };
}

function safeFileName(name: string): string {
  // Strip path traversals + collapse to a safe filename, max 80 chars.
  const base = name.split(/[\\/]/).pop() ?? 'contract.pdf';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'contract.pdf';
}

// ----------------------------------------------------------------------------
// uploadVendorContract — vendor creates a draft contract row.
// FormData fields:
//   - file (File): the PDF
//   - event_id (UUID): which event/couple this is for
//   - title (string, 1..200)
//   - description (optional, ≤2000)
//   - order_id (optional UUID): link to a specific order
// ----------------------------------------------------------------------------

export async function uploadVendorContract(formData: FormData) {
  const { supabase, user, profile } = await ensureVendor();

  const file = formData.get('file');
  const eventId = String(formData.get('event_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const orderId = String(formData.get('order_id') ?? '').trim() || null;

  if (!(file instanceof File)) {
    throw new Error('No contract file uploaded.');
  }
  if (!eventId) {
    throw new Error('Pick an event/couple this contract is for.');
  }
  if (title.length < 1 || title.length > 200) {
    throw new Error('Title must be 1–200 characters.');
  }
  if (description && description.length > 2000) {
    throw new Error('Description must be 2000 characters or fewer.');
  }

  const validation = validateContractFile(file);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  // Verify vendor has a chat thread with this event (proves a relationship
  // exists). Without this, any vendor could upload contracts at any event.
  const { data: threadCheck } = await supabase
    .from('chat_threads')
    .select('thread_id')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!threadCheck) {
    throw new Error(
      'You can only upload contracts for events you are in conversation with. Start a thread with the couple first.',
    );
  }

  // Push the PDF to R2. Key path: <vendor_profile_id>/<contract_id placeholder>/<filename>
  // We don't have the contract_id yet, so use a timestamp + random shard
  // and store the resulting URL on the row we insert next.
  const buffer = Buffer.from(await file.arrayBuffer());
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const key = `${profile.vendor_profile_id}/${stamp}_${random}/${safeFileName(file.name)}`;

  let fileUrl: string;
  try {
    fileUrl = await r2Upload({
      bucket: R2_BUCKETS.vendorContracts,
      key,
      body: buffer,
      contentType: 'application/pdf',
    });
  } catch (e) {
    console.error('[contracts] r2Upload failed:', e);
    throw new Error('Could not upload the file. Try again.');
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_contracts')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      event_id: eventId,
      order_id: orderId,
      uploaded_by_user_id: user.id,
      title,
      description,
      file_url: fileUrl,
      file_name: file.name.slice(0, 200),
      file_size_bytes: file.size,
      mime_type: 'application/pdf',
      status: 'draft',
    })
    .select('contract_id')
    .single();

  if (error || !data) {
    console.error('[contracts] insert vendor_contract failed:', error?.message);
    throw new Error(error?.message ?? 'Could not save the contract.');
  }

  revalidatePath('/vendor-dashboard/contracts');
  return redirect(`/vendor-dashboard/contracts/${data.contract_id}`);
}

// ----------------------------------------------------------------------------
// sendContractForSignature — flips a draft to 'sent_for_signature' so the
// customer side becomes visible. Idempotent (no-ops if already sent).
// ----------------------------------------------------------------------------

export async function sendContractForSignature(formData: FormData) {
  const { profile } = await ensureVendor();
  const contractId = String(formData.get('contract_id') ?? '').trim();
  if (!contractId) throw new Error('Missing contract id.');

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('vendor_contracts')
    .select('vendor_profile_id, status')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (!row || row.vendor_profile_id !== profile.vendor_profile_id) {
    throw new Error('Contract not found.');
  }
  if (row.status === 'cancelled') {
    throw new Error('Cancelled contracts cannot be sent.');
  }
  if (row.status === 'fully_signed') {
    throw new Error('Contract is already fully signed.');
  }

  const { error } = await admin
    .from('vendor_contracts')
    .update({
      status: 'sent_for_signature',
      sent_for_signature_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('contract_id', contractId)
    .eq('status', 'draft');

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/vendor-dashboard/contracts/${contractId}`);
  revalidatePath('/vendor-dashboard/contracts');
}

// ----------------------------------------------------------------------------
// signContractAsVendor — vendor's own signature on a sent contract. Customer
// side has the mirror action in apps/web/app/dashboard/[eventId]/contracts/actions.ts.
// ----------------------------------------------------------------------------

export async function signContractAsVendor(formData: FormData) {
  const { supabase, user, profile } = await ensureVendor();

  const contractId = String(formData.get('contract_id') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const signatureDataUrl = String(formData.get('signature_data_url') ?? '');

  if (!contractId) throw new Error('Missing contract id.');
  if (fullName.length < 1 || fullName.length > 200) {
    throw new Error('Full name is required.');
  }

  const parsed = parseSignatureDataUrl(signatureDataUrl);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }

  // Confirm the contract is owned by this vendor + is currently sendable.
  const { data: row } = await supabase
    .from('vendor_contracts')
    .select('contract_id, status, vendor_profile_id')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (!row || row.vendor_profile_id !== profile.vendor_profile_id) {
    throw new Error('Contract not found.');
  }
  if (row.status !== 'sent_for_signature') {
    throw new Error('Send the contract for signature first.');
  }

  // Push the signature PNG to R2.
  const buffer = Buffer.from(parsed.base64, 'base64');
  if (buffer.byteLength > 200 * 1024) {
    throw new Error('Signature image too large.');
  }
  const key = `${profile.vendor_profile_id}/${contractId}/signatures/vendor.png`;
  let imageUrl: string;
  try {
    imageUrl = await r2Upload({
      bucket: R2_BUCKETS.vendorContracts,
      key,
      body: buffer,
      contentType: 'image/png',
    });
  } catch (e) {
    console.error('[contracts] signature upload failed:', e);
    throw new Error('Could not save the signature. Try again.');
  }

  const { ipAddress, userAgent } = await clientHeaders();
  const admin = createAdminClient();
  const { error } = await admin.from('vendor_contract_signatures').insert({
    contract_id: contractId,
    signer_user_id: user.id,
    signer_role: 'vendor',
    signer_full_name: fullName,
    signature_image_url: imageUrl,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    // 23505 = unique violation — vendor already signed this one.
    if (error.code === '23505') {
      throw new Error('You have already signed this contract.');
    }
    throw new Error(error.message);
  }

  revalidatePath(`/vendor-dashboard/contracts/${contractId}`);
  revalidatePath('/vendor-dashboard/contracts');
}

// ----------------------------------------------------------------------------
// cancelContract — vendor pulls back a draft / sent-for-signature contract.
// fully_signed contracts cannot be cancelled (terminal state for audit).
// ----------------------------------------------------------------------------

export async function cancelContract(formData: FormData) {
  const { user, profile } = await ensureVendor();
  const contractId = String(formData.get('contract_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500) || null;
  if (!contractId) throw new Error('Missing contract id.');

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('vendor_contracts')
    .select('vendor_profile_id, status')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (!row || row.vendor_profile_id !== profile.vendor_profile_id) {
    throw new Error('Contract not found.');
  }
  if (row.status === 'fully_signed') {
    throw new Error('Fully signed contracts cannot be cancelled.');
  }
  if (row.status === 'cancelled') return; // idempotent

  const { error } = await admin
    .from('vendor_contracts')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by_user_id: user.id,
      cancelled_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('contract_id', contractId);

  if (error) throw new Error(error.message);

  revalidatePath(`/vendor-dashboard/contracts/${contractId}`);
  revalidatePath('/vendor-dashboard/contracts');
}
