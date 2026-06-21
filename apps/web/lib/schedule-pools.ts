/**
 * Schedule pools — the (org, leaf-category) booking-capacity layer.
 *
 * Owner-locked model (2026-06-12, corpus Customer_Vendor_Marketplace_
 * Architecture_2026-06-04.md § 4): every service a vendor files under one
 * category draws from ONE shared schedule pool; a new category = a new,
 * independent pool; merged categories ("same team serves both") map to a
 * single pool. Bundles lock EVERY pool they span — the acquire RPC is
 * all-or-nothing across the array.
 *
 * Doctrine split (white vs locked):
 *   - Inquiries / soft holds ('considering'..'contracted') are WHITE —
 *     unlimited, never consume pool capacity.
 *   - Only BOOKED statuses ('deposit_paid'/'delivered'/'complete') consume.
 *     The acquire fires on that transition (vendors/actions.ts) and the
 *     release fires on the reverse transition / cancellation — via
 *     released_at status-flip, never a DELETE.
 *
 * All capacity math lives in the SECURITY DEFINER RPCs (migration
 * 20261126000000) — app code here only resolves WHICH pools a booking
 * spans and relays the RPC envelopes. Per the 2026-06-04 conflict audit,
 * read-then-write in the app cannot be made race-safe; only the DB can
 * serialize the decrement.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PoolAcquireResult =
  | { status: 'ok'; poolIds: string[]; bookedDate: string }
  | { status: 'full'; poolId: string | null; poolLabel: string | null }
  | { status: 'blocked'; poolId: string | null }
  | { status: 'no_date' }
  | { status: 'no_pools' }
  | { status: 'not_authorized' }
  | { status: 'error'; message: string };

/**
 * Resolve every pool a booked service spans: its own leaf category plus
 * each linked "comes with" category (bundles lock both schedules — owner
 * verbatim 2026-06-12). Merged categories resolve to the same pool_id, so
 * the result is deduped. Degrades to [] on any missing data (unpublished
 * service, off-platform vendor) — callers treat [] as "no pool gate".
 */
export async function resolvePoolIdsForService(
  supabase: SupabaseClient,
  marketplaceVendorId: string,
  serviceId: string,
): Promise<string[]> {
  // Named Calendars rework (owner 2026-06-20, flag-gated): when ON, a service's
  // OWN pool comes from its named-calendar membership (service-level) instead of
  // its category. Bundle "comes with" legs stay CATEGORY-resolved in both modes
  // so a bundle's lock footprint never silently narrows. After the Phase A
  // backfill, a service's calendar pool == its category pool, so flag-on returns
  // the SAME pool_ids as flag-off — the acquire RPC downstream is identical.
  const namedCalendars =
    process.env.NEXT_PUBLIC_NAMED_CALENDARS_ENABLED === 'true';

  const poolIds = new Set<string>();

  const { data: svc } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_service_id', serviceId)
    .maybeSingle();
  const primary = (svc as { category?: string | null } | null)?.category ?? null;

  const resolveCategory = async (categoryKey: string) => {
    const { data } = await supabase.rpc('resolve_schedule_pool', {
      p_vendor_profile_id: marketplaceVendorId,
      p_category_key: categoryKey,
    });
    // NULL = category outside the vendor's catalog (resolver's junk-pool
    // guard) — skip rather than fail.
    if (typeof data === 'string' && data.length > 0) poolIds.add(data);
  };

  // ── The service's OWN pool ──────────────────────────────────────────────
  if (namedCalendars) {
    const { data: membership } = await supabase
      .from('vendor_schedule_calendar_services')
      .select('pool_id')
      .eq('vendor_service_id', serviceId)
      .maybeSingle();
    const calendarPoolId =
      (membership as { pool_id?: string | null } | null)?.pool_id ?? null;
    if (calendarPoolId) {
      poolIds.add(calendarPoolId);
    } else if (primary) {
      // Owner decision 2026-06-20: an unassigned service stays bookable via its
      // category pool — never silently un-gated. Log so mis-seeding is visible.
      await resolveCategory(primary);
      console.warn(
        `[named-calendars] service ${serviceId} has no calendar membership; fell back to its category pool`,
      );
    }
  } else if (primary) {
    await resolveCategory(primary);
  }

  // ── Bundle "comes with" legs (always category-resolved) ─────────────────
  const { data: links } = await supabase
    .from('vendor_service_links')
    .select('linked_canonical_service')
    .eq('vendor_service_id', serviceId);
  const linkedCategories = new Set<string>();
  for (const row of (links ?? []) as { linked_canonical_service: string | null }[]) {
    if (row.linked_canonical_service) linkedCategories.add(row.linked_canonical_service);
  }
  for (const categoryKey of linkedCategories) {
    await resolveCategory(categoryKey);
  }

  return [...poolIds];
}

/**
 * Resolve the schedule pool for a vendor CATEGORY (no specific service).
 *
 * Used by the PACKAGE-booking path: lockPackage cascade-creates one
 * event_vendors row per package item, each carrying a `category` but NO
 * `service_id` (items map canonical_service → category, not to a vendor_service
 * row). Those rows therefore can't go through resolvePoolIdsForService — and
 * historically that meant the white→BOOKED capacity gate in updateVendorStatus
 * (which requires service_id) silently skipped them, so a packaged booking
 * consumed no capacity and could overbook a full date. A booked package must
 * consume capacity like any other booking (owner "bundles lock every pool they
 * span", 2026-06-20), so the deposit transition resolves by category instead.
 *
 * Flag-agnostic: category→pool is the same in both calendar modes
 * (resolve_schedule_pool is the shared category resolver; named-calendar
 * membership keys on service_id, which a package row doesn't have). Returns []
 * when the category has no pool (resolver's junk-pool guard) — degrade open,
 * same as any unpooled / off-platform booking.
 */
export async function resolvePoolIdsForCategory(
  supabase: SupabaseClient,
  marketplaceVendorId: string,
  category: string | null | undefined,
): Promise<string[]> {
  if (!category) return [];
  const { data } = await supabase.rpc('resolve_schedule_pool', {
    p_vendor_profile_id: marketplaceVendorId,
    p_category_key: category,
  });
  return typeof data === 'string' && data.length > 0 ? [data] : [];
}

/**
 * Multi-pool all-or-nothing atomic acquire. Relays the RPC envelope; any
 * transport error surfaces as { status:'error' } so the caller can decide
 * whether to degrade open or block.
 */
export async function acquireSchedulePools(
  supabase: SupabaseClient,
  eventId: string,
  eventVendorId: string,
  poolIds: string[],
): Promise<PoolAcquireResult> {
  if (poolIds.length === 0) return { status: 'no_pools' };
  const { data, error } = await supabase.rpc('acquire_schedule_pools', {
    p_event_id: eventId,
    p_event_vendor_id: eventVendorId,
    p_pool_ids: poolIds,
  });
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as {
    status?: string;
    pool_ids?: string[];
    booked_date?: string;
    pool_id?: string;
    pool_label?: string;
  };
  switch (env.status) {
    case 'ok':
      return {
        status: 'ok',
        poolIds: env.pool_ids ?? poolIds,
        bookedDate: env.booked_date ?? '',
      };
    case 'full':
      return {
        status: 'full',
        poolId: env.pool_id ?? null,
        poolLabel: env.pool_label ?? null,
      };
    case 'blocked':
      return { status: 'blocked', poolId: env.pool_id ?? null };
    case 'no_date':
      return { status: 'no_date' };
    case 'no_pools':
      return { status: 'no_pools' };
    case 'not_authorized':
      return { status: 'not_authorized' };
    default:
      return { status: 'error', message: `unexpected acquire status: ${env.status ?? 'none'}` };
  }
}

export type PoolReleaseReason =
  | 'host_cancelled'
  | 'vendor_cancelled'
  | 'force_majeure'
  | 'status_downgrade'
  | 'admin';

/**
 * Status-flip release of every live reservation for a booking row.
 * Best-effort by design: a failed release must never roll back the
 * user-visible action that triggered it (cancel/downgrade succeeded) —
 * callers log and continue. Returns the number released, or null on error.
 */
export async function releaseSchedulePools(
  supabase: SupabaseClient,
  eventVendorId: string,
  reason: PoolReleaseReason,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('release_schedule_pools', {
    p_event_vendor_id: eventVendorId,
    p_reason: reason,
  });
  if (error) return null;
  const env = (data ?? {}) as { status?: string; released?: number };
  return env.status === 'ok' ? (env.released ?? 0) : null;
}
