'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { r2Upload, R2_BUCKETS } from '@/lib/r2';
import { validateContractFile } from '@/lib/contracts';

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

  // Push the PDF to R2. Key path: <vendor_profile_id>/<timestamp>_<rand>/<filename>
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
// publishContractToCouple — flips a draft to 'sent_for_signature' which
// under the upload-only scope (owner lock later 2026-05-18) we treat as
// "visible to couple". The DB column name is kept for forward
// compatibility with the original dual-sig schema; no signing happens.
// Idempotent (no-ops if already published or cancelled).
// ----------------------------------------------------------------------------

export async function publishContractToCouple(formData: FormData) {
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
    throw new Error('Cancelled contracts cannot be re-published.');
  }
  if (row.status !== 'draft') return; // already visible — idempotent

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
// cancelContract — vendor pulls back a contract. Cancelled contracts no
// longer appear on the couple's view but stay in the DB for audit.
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
