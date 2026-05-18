'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { r2Upload, R2_BUCKETS } from '@/lib/r2';
import { parseSignatureDataUrl } from '@/lib/contracts';

/**
 * signContractAsCustomer — customer adds their signature to a contract
 * the vendor has sent. Mirror of `signContractAsVendor` in
 * apps/web/app/vendor-dashboard/contracts/actions.ts with the role flipped
 * and event-membership instead of vendor-ownership verification.
 *
 * After both signatures land the BEFORE INSERT trigger
 * `vendor_contract_check_fully_signed` flips the contract to 'fully_signed'.
 */
export async function signContractAsCustomer(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const eventId = String(formData.get('event_id') ?? '').trim();
  const contractId = String(formData.get('contract_id') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const signatureDataUrl = String(formData.get('signature_data_url') ?? '');

  if (!eventId) throw new Error('Missing event id.');
  if (!contractId) throw new Error('Missing contract id.');
  if (fullName.length < 1 || fullName.length > 200) {
    throw new Error('Full name is required.');
  }

  const parsed = parseSignatureDataUrl(signatureDataUrl);
  if (!parsed.ok) throw new Error(parsed.reason);

  // Verify this user is a couple/coordinator member of the event the
  // contract belongs to, and the contract is open for signature.
  const { data: contract } = await supabase
    .from('vendor_contracts')
    .select('contract_id, event_id, vendor_profile_id, status')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (!contract) throw new Error('Contract not found.');
  if (contract.event_id !== eventId) {
    throw new Error('Contract does not belong to this event.');
  }
  if (contract.status !== 'sent_for_signature') {
    throw new Error(
      contract.status === 'fully_signed'
        ? 'This contract has already been fully signed.'
        : 'This contract is not open for signature.',
    );
  }

  const { data: member } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member || (member.member_type !== 'couple' && member.member_type !== 'coordinator')) {
    throw new Error('You are not authorised to sign contracts for this event.');
  }

  // Push the signature PNG to R2. Keyed under the vendor's contract folder
  // so all evidentiary artefacts for the same contract live together.
  const buffer = Buffer.from(parsed.base64, 'base64');
  if (buffer.byteLength > 200 * 1024) {
    throw new Error('Signature image too large.');
  }
  const key = `${contract.vendor_profile_id}/${contractId}/signatures/customer.png`;
  let imageUrl: string;
  try {
    imageUrl = await r2Upload({
      bucket: R2_BUCKETS.vendorContracts,
      key,
      body: buffer,
      contentType: 'image/png',
    });
  } catch (e) {
    console.error('[contracts] customer signature upload failed:', e);
    throw new Error('Could not save the signature. Try again.');
  }

  const h = await headers();
  const ipAddress =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;

  const admin = createAdminClient();
  const { error } = await admin.from('vendor_contract_signatures').insert({
    contract_id: contractId,
    signer_user_id: user.id,
    signer_role: 'customer',
    signer_full_name: fullName,
    signature_image_url: imageUrl,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already signed this contract.');
    }
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/contracts/${contractId}`);
  revalidatePath(`/dashboard/${eventId}/contracts`);
}
