'use server';

/**
 * Reusable Locked Bookings — VENDOR-side server actions. Ships DARK behind
 * NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED.
 *
 * The vendor OWNS the template and SETS the new price. A vendor is never forced
 * to re-offer — they can decline (e.g. a retired package). Ownership of a
 * request is enforced by RLS: the authed read on vendor_reuse_requests only
 * returns rows whose vendor_profile_id is in current_vendor_profile_ids(), so a
 * successful read IS the ownership proof handed to the service-role wrapper.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isReusableBookingsEnabled, type ReuseRequestStatus, type ScopeLine } from '@/lib/reusable-bookings';
import { quoteReuseRequest, declineReuseRequest, type ReuseActionResult } from '@/lib/reusable-bookings.server';

const DISABLED: ReuseActionResult = { status: 'disabled' };
const REVALIDATE = '/vendor-dashboard/proposals';

export type VendorReuseRow = {
  requestId: string;
  status: ReuseRequestStatus;
  scope: ScopeLine[];
  quotedTotalPhp: number | null;
  category: string | null;
};

/** List the vendor's live reuse requests (RLS-scoped to the caller's profiles). */
export async function listVendorReuseRequests(): Promise<{ enabled: boolean; rows: VendorReuseRow[] }> {
  if (!isReusableBookingsEnabled()) return { enabled: false, rows: [] };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { enabled: true, rows: [] };
  const { data } = await supabase
    .from('vendor_reuse_requests')
    .select('request_id, status, scope_snapshot, quoted_total_php, category')
    .in('status', ['pending', 'quoted'])
    .order('created_at', { ascending: false })
    .limit(50);
  const rows: VendorReuseRow[] = ((data ?? []) as Array<{
    request_id: string;
    status: ReuseRequestStatus;
    scope_snapshot: ScopeLine[] | null;
    quoted_total_php: number | null;
    category: string | null;
  }>).map((r) => ({
    requestId: r.request_id,
    status: r.status,
    scope: Array.isArray(r.scope_snapshot) ? r.scope_snapshot : [],
    quotedTotalPhp: r.quoted_total_php,
    category: r.category,
  }));
  return { enabled: true, rows };
}

/**
 * Resolve the acting vendor_profile_id that OWNS the given request via an
 * RLS-scoped authed read. Returns null if the caller can't see it (not theirs).
 */
async function ownedRequestVendorProfileId(requestId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('vendor_reuse_requests')
    .select('vendor_profile_id')
    .eq('request_id', requestId)
    .maybeSingle();
  return (data as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;
}

/** VENDOR RE-PRICES — set the new point-in-time price. */
export async function vendorQuoteReuse(formData: FormData): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return DISABLED;
  const requestId = String(formData.get('request_id') ?? '');
  const newTotalPhp = Number(formData.get('new_total_php'));
  if (!requestId) return { status: 'error', reason: 'missing_ids' };
  if (!Number.isFinite(newTotalPhp) || newTotalPhp < 0) return { status: 'error', reason: 'bad_price' };
  const vendorProfileId = await ownedRequestVendorProfileId(requestId);
  if (!vendorProfileId) return { status: 'error', reason: 'not_your_request' };
  const res = await quoteReuseRequest(createAdminClient(), { requestId, vendorProfileId, newTotalPhp });
  revalidatePath(REVALIDATE);
  return res;
}

/** VENDOR DECLINES — never forced to re-offer (retired package, no slot, …). */
export async function vendorDeclineReuse(formData: FormData): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return DISABLED;
  const requestId = String(formData.get('request_id') ?? '');
  const reason = String(formData.get('reason') ?? '') || null;
  if (!requestId) return { status: 'error', reason: 'missing_ids' };
  const vendorProfileId = await ownedRequestVendorProfileId(requestId);
  if (!vendorProfileId) return { status: 'error', reason: 'not_your_request' };
  const res = await declineReuseRequest(createAdminClient(), { requestId, vendorProfileId, reason });
  revalidatePath(REVALIDATE);
  return res;
}

// ── void-returning <form action> adapters (React form actions must be void) ──
export async function vendorQuoteReuseForm(formData: FormData): Promise<void> {
  await vendorQuoteReuse(formData);
}
export async function vendorDeclineReuseForm(formData: FormData): Promise<void> {
  await vendorDeclineReuse(formData);
}
