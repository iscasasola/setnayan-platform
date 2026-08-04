'use server';

/**
 * Reusable Locked Bookings — COUPLE-side server actions. Ships DARK behind
 * NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED: every action short-circuits when the
 * flag is off, so nothing changes on the couple's vendor surface today.
 *
 * These re-derive the acting user from the session, resolve the couple's own
 * event ids (RLS-independent gate), and then hand the resolved identity to the
 * service-role wrappers in lib/reusable-bookings.server.ts. The fee is NOT
 * touched here — acceptance mints a `shortlisted` event_vendors row in the
 * TARGET event, which the couple then LOCKS through the unchanged finalizeVendor
 * → collectBookingFeeAtLock path (new event = new (vendor,event) ledger = new
 * fee, counted toward free-5).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isReusableBookingsEnabled, type ReuseRequestStatus, type ScopeLine } from '@/lib/reusable-bookings';
import {
  createReuseRequest,
  acceptReuseRequest,
  cancelReuseRequest,
  type ReuseActionResult,
} from '@/lib/reusable-bookings.server';

const DISABLED: ReuseActionResult = { status: 'disabled' };
const NOT_SIGNED_IN: ReuseActionResult = { status: 'error', reason: 'not_signed_in' };

/** The couple's own event ids (couple membership only). */
async function coupleEventIds(): Promise<{ userId: string; eventIds: string[] } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;
  const { data } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', user.id)
    .eq('member_type', 'couple');
  const eventIds = ((data ?? []) as Array<{ event_id: string }>).map((r) => r.event_id);
  return { userId: user.id, eventIds };
}

export type ReuseSource = {
  sourceEventVendorId: string;
  sourceEventId: string;
  sourceEventLabel: string;
  vendorName: string;
  category: string | null;
};
export type ReuseTarget = { eventId: string; label: string };
export type ReuseRequestRow = {
  requestId: string;
  vendorName: string | null;
  targetEventId: string;
  targetEventLabel: string;
  status: ReuseRequestStatus;
  quotedTotalPhp: number | null;
  scope: ScopeLine[];
  resolvedEventVendorId: string | null;
};

/**
 * Powers the couple-side "book them again" launcher: the reusable past bookings
 * (committed marketplace locks across all the couple's events), the events they
 * can target, and any live/recent reuse requests. Empty (disabled) when the flag
 * is off.
 */
export async function listReusableBookings(): Promise<{
  enabled: boolean;
  sources: ReuseSource[];
  targets: ReuseTarget[];
  requests: ReuseRequestRow[];
}> {
  if (!isReusableBookingsEnabled()) return { enabled: false, sources: [], targets: [], requests: [] };
  const ctx = await coupleEventIds();
  if (!ctx || ctx.eventIds.length === 0) return { enabled: true, sources: [], targets: [], requests: [] };
  const supabase = await createClient();

  const { data: evs } = await supabase
    .from('events')
    .select('event_id, display_name, event_type, event_date, archived')
    .in('event_id', ctx.eventIds);
  const eventLabel = new Map<string, string>();
  const targets: ReuseTarget[] = [];
  for (const e of (evs ?? []) as Array<{
    event_id: string;
    display_name: string | null;
    event_type: string | null;
    event_date: string | null;
    archived: boolean | null;
  }>) {
    const label = e.display_name?.trim() || e.event_type || 'Event';
    eventLabel.set(e.event_id, label);
    if (!e.archived) targets.push({ eventId: e.event_id, label });
  }

  const { data: bookings } = await supabase
    .from('event_vendors')
    .select('vendor_id, event_id, vendor_name, category, status, marketplace_vendor_id, archived_at')
    .in('event_id', ctx.eventIds)
    .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
    .is('archived_at', null);
  const sources: ReuseSource[] = ((bookings ?? []) as Array<{
    vendor_id: string;
    event_id: string;
    vendor_name: string | null;
    category: string | null;
    marketplace_vendor_id: string | null;
  }>)
    .filter((b) => !!b.marketplace_vendor_id)
    .map((b) => ({
      sourceEventVendorId: b.vendor_id,
      sourceEventId: b.event_id,
      sourceEventLabel: eventLabel.get(b.event_id) ?? 'Event',
      vendorName: b.vendor_name ?? 'Vendor',
      category: b.category,
    }));

  const { data: reqs } = await supabase
    .from('vendor_reuse_requests')
    .select('request_id, vendor_name, target_event_id, status, quoted_total_php, scope_snapshot, resolved_event_vendor_id')
    .in('target_event_id', ctx.eventIds)
    .order('created_at', { ascending: false })
    .limit(50);
  const requests: ReuseRequestRow[] = ((reqs ?? []) as Array<{
    request_id: string;
    vendor_name: string | null;
    target_event_id: string;
    status: ReuseRequestStatus;
    quoted_total_php: number | null;
    scope_snapshot: ScopeLine[] | null;
    resolved_event_vendor_id: string | null;
  }>).map((r) => ({
    requestId: r.request_id,
    vendorName: r.vendor_name,
    targetEventId: r.target_event_id,
    targetEventLabel: eventLabel.get(r.target_event_id) ?? 'Event',
    status: r.status,
    quotedTotalPhp: r.quoted_total_php,
    scope: Array.isArray(r.scope_snapshot) ? r.scope_snapshot : [],
    resolvedEventVendorId: r.resolved_event_vendor_id,
  }));

  return { enabled: true, sources, targets, requests };
}

/** COUPLE INITIATES — request to re-book a past vendor into a new event. */
export async function requestVendorReuse(formData: FormData): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return DISABLED;
  const sourceEventVendorId = String(formData.get('source_event_vendor_id') ?? '');
  const targetEventId = String(formData.get('target_event_id') ?? '');
  if (!sourceEventVendorId || !targetEventId) return { status: 'error', reason: 'missing_ids' };

  const ctx = await coupleEventIds();
  if (!ctx) return NOT_SIGNED_IN;
  if (!ctx.eventIds.includes(targetEventId)) return { status: 'error', reason: 'not_your_target_event' };

  // Ownership of the SOURCE booking's event is enforced via the admin read in
  // the wrapper cross-checked against the couple's event ids here.
  const admin = createAdminClient();
  const { data: src } = await admin
    .from('event_vendors')
    .select('event_id')
    .eq('vendor_id', sourceEventVendorId)
    .maybeSingle();
  const srcEventId = (src as { event_id?: string } | null)?.event_id;
  if (!srcEventId || !ctx.eventIds.includes(srcEventId)) {
    return { status: 'error', reason: 'not_your_source_booking' };
  }

  const res = await createReuseRequest(admin, {
    userId: ctx.userId,
    sourceEventVendorId,
    targetEventId,
  });
  revalidatePath(`/dashboard/${targetEventId}/vendors`);
  return res;
}

/** COUPLE ACCEPTS — mint the shortlisted priced pick in the target event. */
export async function acceptVendorReuse(formData: FormData): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return DISABLED;
  const requestId = String(formData.get('request_id') ?? '');
  if (!requestId) return { status: 'error', reason: 'missing_ids' };
  const ctx = await coupleEventIds();
  if (!ctx) return NOT_SIGNED_IN;
  const res = await acceptReuseRequest(createAdminClient(), { requestId, targetEventIds: ctx.eventIds });
  if (res.status === 'ok_accepted') revalidatePath(`/dashboard`);
  return res;
}

/** COUPLE CANCELS — withdraw a live request. */
export async function cancelVendorReuse(formData: FormData): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return DISABLED;
  const requestId = String(formData.get('request_id') ?? '');
  if (!requestId) return { status: 'error', reason: 'missing_ids' };
  const ctx = await coupleEventIds();
  if (!ctx) return NOT_SIGNED_IN;
  return cancelReuseRequest(createAdminClient(), { requestId, targetEventIds: ctx.eventIds });
}

// ── void-returning <form action> adapters (React form actions must be void) ──
export async function requestVendorReuseForm(formData: FormData): Promise<void> {
  await requestVendorReuse(formData);
}
export async function acceptVendorReuseForm(formData: FormData): Promise<void> {
  await acceptVendorReuse(formData);
}
export async function cancelVendorReuseForm(formData: FormData): Promise<void> {
  await cancelVendorReuse(formData);
}
