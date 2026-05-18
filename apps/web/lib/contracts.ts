/**
 * Vendor contracts — dual e-signature.
 *
 * Owner lock 2026-05-18: Contract Intelligence (iteration 0032) retired.
 * Replaced by a free, built-in PDF upload + dual signature flow. Vendor
 * uploads a contract PDF, picks the event/couple, sends it for signature,
 * then both vendor and customer sign with canvas-captured signatures.
 *
 * Notary integration explicitly excluded — Philippine Notarial Law (2004)
 * restricts a notary's commission to their RTC city/province, so an
 * in-house notary covers ≈10% of cross-city vendor-couple contracts.
 * Couples who want notarization take the signed PDF to their own local
 * notary; Setnayan stays out of that flow in V1.
 *
 * Tables / RLS / fully-signed trigger in
 * `supabase/migrations/20260518200000_vendor_contracts_dual_esign_retire_0032.sql`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ContractStatus =
  | 'draft'
  | 'sent_for_signature'
  | 'fully_signed'
  | 'cancelled';

export type SignerRole = 'vendor' | 'customer';

/** Max upload size — 25 MB. Matches CHECK on vendor_contracts.file_size_bytes. */
export const CONTRACT_MAX_BYTES = 25 * 1024 * 1024;

/** Max signature image — 200 KB. Canvas PNGs are well under this. */
export const SIGNATURE_MAX_BYTES = 200 * 1024;

/** Canonical row shape returned by selects. */
export type VendorContractRow = {
  contract_id: string;
  public_id: string;
  vendor_profile_id: string;
  event_id: string;
  order_id: string | null;
  uploaded_by_user_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: ContractStatus;
  sent_for_signature_at: string | null;
  fully_signed_at: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractSignatureRow = {
  signature_id: string;
  contract_id: string;
  signer_user_id: string;
  signer_role: SignerRole;
  signer_full_name: string;
  signature_image_url: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

/**
 * Lookup all contracts a vendor has authored. Ordered most-recent first.
 * Returns the canonical row shape (no joined event details).
 */
export async function fetchVendorContracts(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorContractRow[]> {
  const { data, error } = await supabase
    .from('vendor_contracts')
    .select('*')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[contracts] fetchVendorContracts:', error.message);
    return [];
  }
  return (data ?? []) as VendorContractRow[];
}

/**
 * Lookup contracts targeted at a couple's event. RLS automatically filters
 * out 'draft' contracts (those stay private to the vendor until sent).
 */
export async function fetchEventContracts(
  supabase: SupabaseClient,
  eventId: string,
): Promise<VendorContractRow[]> {
  const { data, error } = await supabase
    .from('vendor_contracts')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[contracts] fetchEventContracts:', error.message);
    return [];
  }
  return (data ?? []) as VendorContractRow[];
}

/** Lookup a single contract by ID. Caller-controlled access via RLS. */
export async function fetchContract(
  supabase: SupabaseClient,
  contractId: string,
): Promise<VendorContractRow | null> {
  const { data, error } = await supabase
    .from('vendor_contracts')
    .select('*')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (error) {
    console.error('[contracts] fetchContract:', error.message);
    return null;
  }
  return (data as VendorContractRow | null) ?? null;
}

/** Signatures attached to a contract. Empty array if none / not authorised. */
export async function fetchContractSignatures(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractSignatureRow[]> {
  const { data, error } = await supabase
    .from('vendor_contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: true });
  if (error) {
    console.error('[contracts] fetchContractSignatures:', error.message);
    return [];
  }
  return (data ?? []) as ContractSignatureRow[];
}

/** Look up a single signature by (contract, role). Returns null if none. */
export function findSignatureByRole(
  signatures: ContractSignatureRow[],
  role: SignerRole,
): ContractSignatureRow | null {
  return signatures.find((s) => s.signer_role === role) ?? null;
}

/** Human-friendly status label for UI. */
export function statusLabel(status: ContractStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent_for_signature':
      return 'Awaiting signatures';
    case 'fully_signed':
      return 'Fully signed';
    case 'cancelled':
      return 'Cancelled';
  }
}

/** Pretty file-size formatter — "1.2 MB" / "320 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Validate uploaded file is a PDF under the size cap. */
export function validateContractFile(file: {
  size: number;
  type: string;
  name: string;
}): { ok: true } | { ok: false; reason: string } {
  if (file.size <= 0) {
    return { ok: false, reason: 'File appears to be empty.' };
  }
  if (file.size > CONTRACT_MAX_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the 25 MB limit (${formatFileSize(file.size)}).`,
    };
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, reason: 'Only PDF files are accepted.' };
  }
  return { ok: true };
}

/**
 * Validate a base64-encoded signature data URL coming from the canvas
 * component. Expected shape: "data:image/png;base64,XXXXX". Returns the
 * raw base64 payload if valid, or { ok: false, reason }.
 */
export function parseSignatureDataUrl(
  dataUrl: string,
): { ok: true; base64: string } | { ok: false; reason: string } {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return { ok: false, reason: 'Signature must be a PNG image.' };
  }
  const base64 = dataUrl.slice('data:image/png;base64,'.length);
  if (base64.length === 0) {
    return { ok: false, reason: 'Signature image is empty.' };
  }
  // Quick size check before decoding — base64 inflates by ~4/3.
  const approxBytes = Math.ceil((base64.length * 3) / 4);
  if (approxBytes > SIGNATURE_MAX_BYTES) {
    return { ok: false, reason: 'Signature image too large.' };
  }
  return { ok: true, base64 };
}
