'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server actions for the vendor's tax-documents surface.
 *
 * Vendors can:
 *   - Mark a filing as downloaded (records download timestamp the first
 *     time they fetch the PDF; the admin queue uses this to see who
 *     hasn't picked theirs up before the BIR deadline).
 *   - Mark a filing as `filed_manually` (vendor's own record-keeping —
 *     "I credited this 2307 against my income tax return").
 *
 * Both actions verify the vendor owns the filing through their
 * `vendor_profiles.user_id`. The underlying table has RLS read-only for
 * the vendor, so we go through the admin client for the write — with
 * an in-code ownership check first.
 */

async function assertOwnsFiling(
  filing_id: string,
): Promise<{ user_id: string; vendor_profile_id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Filing → vendor_profiles → users(id) ownership chain.
  const admin = createAdminClient();
  const { data: filing } = await admin
    .from('vendor_2307_filings')
    .select('vendor_profile_id')
    .eq('filing_id', filing_id)
    .maybeSingle();
  if (!filing) return null;
  const { data: profile } = await admin
    .from('vendor_profiles')
    .select('user_id')
    .eq('vendor_profile_id', filing.vendor_profile_id)
    .maybeSingle();
  if (!profile || profile.user_id !== user.id) return null;
  return { user_id: user.id, vendor_profile_id: filing.vendor_profile_id };
}

export async function recordDownload(filing_id: string): Promise<void> {
  const owner = await assertOwnsFiling(filing_id);
  if (!owner) return;
  const admin = createAdminClient();
  await admin
    .from('vendor_2307_filings')
    .update({
      downloaded_by_vendor_at: new Date().toISOString(),
      // Only flip to 'downloaded' if currently 'generated' — don't
      // overwrite a more-progressed status like 'filed_manually'.
      status: 'downloaded',
      updated_at: new Date().toISOString(),
    })
    .eq('filing_id', filing_id)
    .in('status', ['generated', 'queued']);
  revalidatePath('/vendor-dashboard/tax-documents');
}

export async function markFiledManually(filing_id: string): Promise<void> {
  const owner = await assertOwnsFiling(filing_id);
  if (!owner) return;
  const admin = createAdminClient();
  await admin
    .from('vendor_2307_filings')
    .update({
      status: 'filed_manually',
      filed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('filing_id', filing_id);
  revalidatePath('/vendor-dashboard/tax-documents');
}

export async function unmarkFiledManually(filing_id: string): Promise<void> {
  const owner = await assertOwnsFiling(filing_id);
  if (!owner) return;
  const admin = createAdminClient();
  await admin
    .from('vendor_2307_filings')
    .update({
      status: 'downloaded',
      filed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('filing_id', filing_id);
  revalidatePath('/vendor-dashboard/tax-documents');
}

// Form-action wrappers — the React `form action` prop wants a function
// that takes `FormData`, but our underlying helpers want a string id.
// Splitting like this keeps the unit-testable surface clean while still
// letting the JSX call these directly.

export async function markFiledForm(formData: FormData): Promise<void> {
  const id = String(formData.get('filing_id') ?? '');
  if (id) await markFiledManually(id);
}

export async function unmarkFiledForm(formData: FormData): Promise<void> {
  const id = String(formData.get('filing_id') ?? '');
  if (id) await unmarkFiledManually(id);
}
