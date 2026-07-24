import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isReusableBookingsEnabled,
  canTransitionReuse,
  sanitizeScopeSnapshot,
  reuseTargetsDistinctEvent,
  isReusableSourceBooking,
  type ReuseRequestStatus,
  type ScopeLine,
} from '@/lib/reusable-bookings';
import { isMarketplaceVendorBookable } from '@/lib/vendor-verification';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Reusable Locked Bookings — the DB-touching wrappers. Composes the pure rules
 * in lib/reusable-bookings.ts with the admin (service-role) client.
 *
 * SHIP-DARK: every entry point returns immediately unless
 * NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED is on. When off the table is never
 * touched, so the couple / vendor surfaces are byte-behaviour-identical.
 *
 * WRITES are service-role (the table has no authenticated write policy) — the
 * CALLER must have already re-derived + ownership-checked the acting user. These
 * functions take the resolved actor identity as arguments and never trust the
 * client. The fee itself is NOT collected here: acceptReuseRequest only mints a
 * fresh `shortlisted` event_vendors row in the TARGET event; the couple then
 * locks it through the UNCHANGED finalizeVendor → collectBookingFeeAtLock path,
 * so "new event = new (vendor,event) ledger row = new fee, counted toward free-5"
 * is enforced structurally, with zero fee code duplicated.
 */

export type ReuseActionResult =
  | { status: 'disabled' }
  | { status: 'ok'; requestId: string }
  | { status: 'ok_accepted'; requestId: string; eventVendorId: string }
  | { status: 'error'; reason: string };

/** Resolve the vendor_profiles.user_id (for notifications). */
async function vendorUserId(admin: SupabaseClient, vendorProfileId: string): Promise<string | null> {
  const { data } = await admin
    .from('vendor_profiles')
    .select('user_id')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  return (data as { user_id?: string | null } | null)?.user_id ?? null;
}

/**
 * Extract the vendor-owned scope for a source booking, price-free + PII-free.
 * Prefers the most recent accepted/sent proposal's line_items; falls back to the
 * booking's host_inclusions. NEVER reads merge_snapshot / rendered_body.
 */
async function scopeForSourceBooking(
  admin: SupabaseClient,
  args: { sourceEventVendorId: string; sourceEventId: string; vendorProfileId: string },
): Promise<ScopeLine[]> {
  const { data: prop } = await admin
    .from('vendor_proposals')
    .select('line_items, status, created_at')
    .eq('event_id', args.sourceEventId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .in('status', ['accepted', 'sent', 'viewed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lineItems = (prop as { line_items?: unknown } | null)?.line_items;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    return sanitizeScopeSnapshot(lineItems as Array<Record<string, unknown>>);
  }
  const { data: ev } = await admin
    .from('event_vendors')
    .select('host_inclusions')
    .eq('vendor_id', args.sourceEventVendorId)
    .maybeSingle();
  const inclusions = (ev as { host_inclusions?: unknown } | null)?.host_inclusions;
  if (Array.isArray(inclusions)) return sanitizeScopeSnapshot(inclusions as string[]);
  return [];
}

/**
 * COUPLE INITIATES — create a reuse request for a past booking, targeting a NEW
 * event. Guards: caller owns both the source booking and the target event
 * (couple), source is a committed marketplace lock, vendor is still bookable,
 * and the target ≠ source event (the new-lock-new-fee root). Snapshots the
 * vendor-owned scope only. Idempotent-ish: the one-live partial unique index
 * collapses a duplicate active request into a soft error.
 */
export async function createReuseRequest(
  admin: SupabaseClient,
  args: { userId: string; sourceEventVendorId: string; targetEventId: string },
): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return { status: 'disabled' };

  // Resolve + verify the source booking (service-role read; the CALLER already
  // proved the user owns the source event via the authed client).
  const { data: src } = await admin
    .from('event_vendors')
    .select('vendor_id, event_id, status, marketplace_vendor_id, category, vendor_name')
    .eq('vendor_id', args.sourceEventVendorId)
    .maybeSingle();
  if (!src) return { status: 'error', reason: 'source_not_found' };
  const source = src as {
    vendor_id: string;
    event_id: string;
    status: string | null;
    marketplace_vendor_id: string | null;
    category: string | null;
    vendor_name: string | null;
  };

  if (!isReusableSourceBooking({ status: source.status, marketplaceVendorId: source.marketplace_vendor_id })) {
    return { status: 'error', reason: 'source_not_reusable' };
  }
  if (!reuseTargetsDistinctEvent(source.event_id, args.targetEventId)) {
    return { status: 'error', reason: 'same_event' };
  }

  const vendorProfileId = source.marketplace_vendor_id!;

  // The vendor must still be bookable (verified) — a retired/unverified vendor
  // can't be re-offered. (The vendor can also decline later.)
  if (!(await isMarketplaceVendorBookable(admin, vendorProfileId))) {
    return { status: 'error', reason: 'vendor_not_bookable' };
  }

  // Don't allow reuse into a target event where this vendor is ALREADY booked —
  // that would collide with the existing (vendor, event) charge.
  const { data: dup } = await admin
    .from('event_vendors')
    .select('vendor_id, status')
    .eq('event_id', args.targetEventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .is('archived_at', null)
    .maybeSingle();
  if (dup && ['contracted', 'deposit_paid', 'delivered', 'complete'].includes((dup as { status: string }).status)) {
    return { status: 'error', reason: 'already_booked_in_target' };
  }

  const scope = await scopeForSourceBooking(admin, {
    sourceEventVendorId: source.vendor_id,
    sourceEventId: source.event_id,
    vendorProfileId,
  });

  const { data: inserted, error } = await admin
    .from('vendor_reuse_requests')
    .insert({
      source_event_vendor_id: source.vendor_id,
      source_event_id: source.event_id,
      vendor_profile_id: vendorProfileId,
      target_event_id: args.targetEventId,
      requested_by_user_id: args.userId,
      category: source.category,
      vendor_name: source.vendor_name,
      scope_snapshot: scope,
      status: 'pending',
    })
    .select('request_id')
    .maybeSingle();
  if (error || !inserted) {
    // 23505 = the one-live unique index → a live request already exists.
    if (error?.code === '23505') return { status: 'error', reason: 'already_requested' };
    return { status: 'error', reason: error?.message ?? 'insert_failed' };
  }
  const requestId = (inserted as { request_id: string }).request_id;

  const vUser = await vendorUserId(admin, vendorProfileId);
  if (vUser) {
    await emitNotification({
      userId: vUser,
      type: 'vendor_inquiry_received',
      title: 'A past client wants to book you again',
      body: 'They asked to re-book your service for a new event. Open it to re-quote or decline.',
      relatedUrl: '/vendor-dashboard/proposals',
    });
  }
  return { status: 'ok', requestId };
}

/** Shared: load a live request + assert the transition is legal for the actor. */
async function loadForTransition(
  admin: SupabaseClient,
  requestId: string,
  to: ReuseRequestStatus,
  actor: 'couple' | 'vendor',
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; result: ReuseActionResult }
> {
  const { data } = await admin
    .from('vendor_reuse_requests')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (!data) return { ok: false, result: { status: 'error', reason: 'not_found' } };
  const row = data as Record<string, unknown>;
  if (!canTransitionReuse(row.status as ReuseRequestStatus, to, actor)) {
    return { ok: false, result: { status: 'error', reason: `illegal_transition_${row.status}_to_${to}` } };
  }
  return { ok: true, row };
}

/**
 * VENDOR RE-PRICES — set the new point-in-time price. Caller must have proved
 * the acting user owns `vendorProfileId`.
 */
export async function quoteReuseRequest(
  admin: SupabaseClient,
  args: { requestId: string; vendorProfileId: string; newTotalPhp: number },
): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return { status: 'disabled' };
  if (!(args.newTotalPhp >= 0)) return { status: 'error', reason: 'bad_price' };
  const loaded = await loadForTransition(admin, args.requestId, 'quoted', 'vendor');
  if (!loaded.ok) return loaded.result;
  if (loaded.row.vendor_profile_id !== args.vendorProfileId) {
    return { status: 'error', reason: 'not_your_request' };
  }
  const { error } = await admin
    .from('vendor_reuse_requests')
    .update({ status: 'quoted', quoted_total_php: args.newTotalPhp, quoted_at: new Date().toISOString() })
    .eq('request_id', args.requestId)
    .eq('status', 'pending'); // single-winner guard
  if (error) return { status: 'error', reason: error.message };

  const targetEventId = loaded.row.target_event_id as string;
  const requester = loaded.row.requested_by_user_id as string;
  await emitNotification({
    userId: requester,
    type: 'order_quoted',
    title: 'Your re-booking has a new quote',
    body: 'The vendor re-priced your re-booking. Review and accept to lock it in.',
    relatedUrl: `/dashboard/${targetEventId}/vendors`,
  });
  return { status: 'ok', requestId: args.requestId };
}

/**
 * VENDOR DECLINES — a vendor is never forced to re-offer (retired package, no
 * availability, …). Legal from pending OR quoted.
 */
export async function declineReuseRequest(
  admin: SupabaseClient,
  args: { requestId: string; vendorProfileId: string; reason?: string | null },
): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return { status: 'disabled' };
  const loaded = await loadForTransition(admin, args.requestId, 'declined', 'vendor');
  if (!loaded.ok) return loaded.result;
  if (loaded.row.vendor_profile_id !== args.vendorProfileId) {
    return { status: 'error', reason: 'not_your_request' };
  }
  const { error } = await admin
    .from('vendor_reuse_requests')
    .update({
      status: 'declined',
      decline_reason: (args.reason ?? '').slice(0, 500) || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('request_id', args.requestId)
    .in('status', ['pending', 'quoted']); // single-winner guard
  if (error) return { status: 'error', reason: error.message };

  const targetEventId = loaded.row.target_event_id as string;
  const requester = loaded.row.requested_by_user_id as string;
  await emitNotification({
    userId: requester,
    type: 'inquiry_declined',
    title: 'A re-booking request was declined',
    body: 'The vendor can’t re-offer this booking right now.',
    relatedUrl: `/dashboard/${targetEventId}/vendors`,
  });
  return { status: 'ok', requestId: args.requestId };
}

/** COUPLE CANCELS — withdraw a live request before it resolves. */
export async function cancelReuseRequest(
  admin: SupabaseClient,
  args: { requestId: string; targetEventIds: string[] },
): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return { status: 'disabled' };
  const loaded = await loadForTransition(admin, args.requestId, 'cancelled', 'couple');
  if (!loaded.ok) return loaded.result;
  if (!args.targetEventIds.includes(loaded.row.target_event_id as string)) {
    return { status: 'error', reason: 'not_your_request' };
  }
  const { error } = await admin
    .from('vendor_reuse_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('request_id', args.requestId)
    .in('status', ['pending', 'quoted']);
  if (error) return { status: 'error', reason: error.message };
  return { status: 'ok', requestId: args.requestId };
}

/**
 * COUPLE ACCEPTS — mint a fresh `shortlisted` priced event_vendors row in the
 * TARGET event at the vendor's re-quoted price, then the couple locks it via the
 * unchanged finalizeVendor path (which fires collectBookingFeeAtLock for the new
 * (vendor, target-event) pair → a NEW fee, counted toward free-5). We NEVER copy
 * any charge / ledger / fee-paid state — the new event has its own from scratch.
 *
 * Caller must have proved the user is a couple member of the target event.
 */
export async function acceptReuseRequest(
  admin: SupabaseClient,
  args: { requestId: string; targetEventIds: string[] },
): Promise<ReuseActionResult> {
  if (!isReusableBookingsEnabled()) return { status: 'disabled' };
  const loaded = await loadForTransition(admin, args.requestId, 'accepted', 'couple');
  if (!loaded.ok) return loaded.result;
  const row = loaded.row as {
    target_event_id: string;
    source_event_id: string | null;
    vendor_profile_id: string;
    category: string | null;
    vendor_name: string | null;
    quoted_total_php: number | null;
  };
  if (!args.targetEventIds.includes(row.target_event_id)) {
    return { status: 'error', reason: 'not_your_request' };
  }
  if (row.quoted_total_php == null) return { status: 'error', reason: 'no_quote' };
  // Belt: never let accept collapse into the source event.
  if (!reuseTargetsDistinctEvent(row.source_event_id, row.target_event_id)) {
    return { status: 'error', reason: 'same_event' };
  }

  // Re-price guard against a stale target: if the vendor got booked into the
  // target event in the meantime, don't mint a duplicate lock.
  const { data: existing } = await admin
    .from('event_vendors')
    .select('vendor_id, status')
    .eq('event_id', row.target_event_id)
    .eq('marketplace_vendor_id', row.vendor_profile_id)
    .is('archived_at', null)
    .maybeSingle();

  let eventVendorId: string;
  if (existing) {
    // Reuse the existing shortlist row (still unlocked) — set the re-quoted price.
    const ex = existing as { vendor_id: string; status: string };
    if (['contracted', 'deposit_paid', 'delivered', 'complete'].includes(ex.status)) {
      return { status: 'error', reason: 'already_booked_in_target' };
    }
    eventVendorId = ex.vendor_id;
    await admin
      .from('event_vendors')
      .update({
        total_cost_php: row.quoted_total_php,
        status: 'shortlisted',
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_id', eventVendorId);
  } else {
    const { data: minted, error: insErr } = await admin
      .from('event_vendors')
      .insert({
        event_id: row.target_event_id,
        marketplace_vendor_id: row.vendor_profile_id,
        linked_vendor_profile_id: row.vendor_profile_id,
        category: (row.category ?? 'misc') as string,
        vendor_name: row.vendor_name ?? 'Vendor',
        status: 'shortlisted',
        total_cost_php: row.quoted_total_php,
        source: 'reuse_accept',
      })
      .select('vendor_id')
      .maybeSingle();
    if (insErr || !minted) return { status: 'error', reason: insErr?.message ?? 'mint_failed' };
    eventVendorId = (minted as { vendor_id: string }).vendor_id;
  }

  const { error: updErr } = await admin
    .from('vendor_reuse_requests')
    .update({
      status: 'accepted',
      resolved_event_vendor_id: eventVendorId,
      resolved_at: new Date().toISOString(),
    })
    .eq('request_id', args.requestId)
    .eq('status', 'quoted');
  if (updErr) return { status: 'error', reason: updErr.message };

  return { status: 'ok_accepted', requestId: args.requestId, eventVendorId };
}
