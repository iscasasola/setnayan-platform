/**
 * Vendor contracts — upload-only (hosting + visibility, no signing).
 *
 * Owner scope shrink 2026-05-18 (later same day): the dual e-signature
 * flow specified in CLAUDE.md row 414 is dropped. Setnayan's role on
 * vendor contracts becomes **document storage + visibility** between the
 * vendor and the couple — not contract facilitation. Couples and vendors
 * handle signing externally (email, in-person, separate e-sig tool);
 * Setnayan just keeps the PDF accessible to both sides.
 *
 * The underlying schema in
 * `supabase/migrations/20260518200000_vendor_contracts_dual_esign_retire_0032.sql`
 * still has signature columns / signature table / fully-signed trigger
 * for forward compatibility. We just don't write to or read from them.
 * The `sent_for_signature` status is repurposed as "active / visible to
 * couple" in the UI. The `fully_signed` state is never reached because
 * no signatures are ever inserted.
 *
 * Notary integration was explicitly excluded by owner (PH Notarial Law
 * 2004 restricts a notary's commission to their RTC city/province).
 * Couples who want notarization take the PDF to their own local notary.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Status values the UI surfaces. We keep the underlying DB enum
 * (`draft | sent_for_signature | fully_signed | cancelled`) for forward
 * compatibility but only ever read/write three states:
 *   - 'draft' — vendor uploaded, only vendor can see it
 *   - 'sent_for_signature' — visible to the couple (we label it "Active")
 *   - 'cancelled' — vendor pulled it back
 */
export type ContractStatus =
  | 'draft'
  | 'sent_for_signature'
  | 'fully_signed'
  | 'cancelled';

/** Max upload size — 25 MB. Matches CHECK on vendor_contracts.file_size_bytes. */
export const CONTRACT_MAX_BYTES = 25 * 1024 * 1024;

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
 * out 'draft' contracts (those stay private to the vendor until published).
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

/** Human-friendly status label for UI. */
export function statusLabel(status: ContractStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft (only you see this)';
    case 'sent_for_signature':
      return 'Visible to couple';
    case 'fully_signed':
      // Unreachable under upload-only scope; preserved for type-safety.
      return 'Visible to couple';
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
