'use server';

/**
 * Vendor calendar actions — manual blocks, external-client imports, pool
 * capacity, and category↔pool reassignment (the opt-in merge).
 *
 * Model recap (owner lock 2026-06-12, corpus architecture doc § 4):
 *   - manual block = CLOSES the date(s) for one pool, or org-wide when no
 *     pool is chosen (vacation). Couples only ever see "unavailable".
 *   - external client = the vendor's off-app booking; category-pool-scoped,
 *     consumes 1 capacity unit per date, costs 1 token (tier matrix
 *     importCustomerTokenCost) — both writes atomic in the
 *     import_external_client RPC.
 *   - merge = pointing a category at another pool ("same team serves
 *     both"); per-category pools stay the default.
 *
 * Feedback travels via redirect `?notice=` codes — these surfaces are plain
 * server-rendered forms (no client JS).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { asVendorTier, tierCaps } from '@/lib/vendor-tier-caps';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/** Clamp a requested daily capacity to the vendor's tier ceiling + the SQL
 *  CHECK max (50). Shared by updatePoolCapacity + the Named Calendars actions. */
async function clampCapacityToTier(
  supabase: SupabaseClient,
  vendorProfileId: string,
  raw: number,
): Promise<number> {
  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    tier = (data as { tier_state?: string } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }
  const slotsCap = tierCaps(asVendorTier(tier)).slotsPerDay;
  const ceiling = Number.isFinite(slotsCap) ? Math.max(1, slotsCap) : 50;
  return Math.min(Math.min(raw, ceiling), 50);
}

/** Filter host-supplied service ids down to the ones this vendor actually owns
 *  (Named Calendars service-picker is form data — drop forged/stale ids). */
async function ownedServiceIds(
  supabase: SupabaseClient,
  vendorProfileId: string,
  requested: FormDataEntryValue[],
): Promise<string[]> {
  const ids = [
    ...new Set(
      requested
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    ),
  ];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_profile_id', vendorProfileId)
    .in('vendor_service_id', ids);
  return ((data ?? []) as { vendor_service_id: string }[]).map((r) => r.vendor_service_id);
}

/** Redirect to a specific calendar (pool) after a create/edit. */
function backToCalendarPool(month: string, poolId: string, notice: string): never {
  const params = new URLSearchParams();
  if (month) params.set('m', month);
  params.set('pool', poolId);
  params.set('notice', notice);
  redirect(`/vendor-dashboard/calendar?${params.toString()}`);
}

async function requireVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

function backToCalendar(formData: FormData, notice: string): never {
  const month = str(formData, 'return_month');
  const pool = str(formData, 'return_pool');
  const back = str(formData, 'return_to') === 'clients' ? 'clients' : 'calendar';
  const params = new URLSearchParams();
  if (month) params.set('m', month);
  if (pool) params.set('pool', pool);
  params.set('notice', notice);
  redirect(`/vendor-dashboard/${back}?${params.toString()}`);
}

function revalidateScheduleSurfaces() {
  revalidatePath('/vendor-dashboard/calendar');
  revalidatePath('/vendor-dashboard/clients');
}

/** Manual closure block — pool-scoped or org-wide ('org'). */
export async function addManualBlock(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();

  const label = str(formData, 'label') || 'Unavailable';
  const scope = str(formData, 'scope'); // 'org' | pool_id
  const startDate = str(formData, 'start_date');
  const endDate = str(formData, 'end_date') || startDate;
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
    backToCalendar(formData, 'bad_dates');
  }

  let poolId: string | null = null;
  if (scope && scope !== 'org') {
    // The pool must be the vendor's own — RLS would block a foreign insert
    // anyway, but validating here returns a clean notice instead of a throw.
    const { data: pool } = await supabase
      .from('vendor_schedule_pools')
      .select('pool_id')
      .eq('pool_id', scope)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (!pool) backToCalendar(formData, 'bad_pool');
    poolId = scope;
  }

  // Day-grain PH civil time: 00:00 → 23:30 (30-min granularity CHECK; 23:30
  // keeps the ::date overlap on the same civil day — see migration comment).
  const { error } = await supabase.from('vendor_calendar_blocks').insert({
    vendor_profile_id: profile.vendor_profile_id,
    pool_id: poolId,
    blocked_at: `${startDate}T00:00:00+08:00`,
    blocked_until: `${endDate}T23:30:00+08:00`,
    block_label: label.slice(0, 120),
    block_source: 'manual',
    is_private: true,
  });
  if (error) backToCalendar(formData, 'save_failed');

  revalidateScheduleSurfaces();
  backToCalendar(formData, 'block_added');
}

/**
 * Import an off-app client: named external_client block + 1-token burn,
 * atomic in the import_external_client RPC. NOT an app client.
 */
export async function importExternalClient(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();

  const poolId = str(formData, 'pool_id');
  const clientName = str(formData, 'client_name');
  const startDate = str(formData, 'start_date');
  const endDate = str(formData, 'end_date') || startDate;
  if (!poolId) backToCalendar(formData, 'bad_pool');
  if (!clientName) backToCalendar(formData, 'bad_name');
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
    backToCalendar(formData, 'bad_dates');
  }

  const { data, error } = await supabase.rpc('import_external_client', {
    p_vendor_profile_id: profile.vendor_profile_id,
    p_pool_id: poolId,
    p_client_name: clientName,
    p_client_contact: str(formData, 'client_contact') || null,
    p_client_note: str(formData, 'client_note') || null,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) {
    // The RPC RAISES on insufficient token balance and rolls the block back.
    backToCalendar(
      formData,
      error.message.includes('INSUFFICIENT') ? 'no_tokens' : 'save_failed',
    );
  }
  const status = (data as { status?: string; reason?: string } | null)?.status;
  if (status !== 'ok') {
    backToCalendar(formData, 'save_failed');
  }

  revalidateScheduleSurfaces();
  backToCalendar(formData, 'client_imported');
}

/** Remove a vendor-authored block (manual / external client). Booking-sourced
 *  blocks are platform state and can't be removed here. */
export async function removeBlock(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const blockId = str(formData, 'block_id');
  if (!blockId) backToCalendar(formData, 'save_failed');

  const { error } = await supabase
    .from('vendor_calendar_blocks')
    .delete()
    .eq('block_id', blockId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .in('block_source', ['manual', 'external_client']);
  if (error) backToCalendar(formData, 'save_failed');

  revalidateScheduleSurfaces();
  backToCalendar(formData, 'block_removed');
}

/** Pool daily capacity — clamped to the tier's slotsPerDay ceiling (the
 *  pool grain inherits the #2 daily-capacity tier convention). */
export async function updatePoolCapacity(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const poolId = str(formData, 'pool_id');
  const raw = Number(str(formData, 'capacity'));
  if (!poolId || !Number.isInteger(raw) || raw < 1) {
    backToCalendar(formData, 'bad_capacity');
  }

  const capacity = await clampCapacityToTier(supabase, profile.vendor_profile_id, raw);

  const { error } = await supabase
    .from('vendor_schedule_pools')
    .update({ daily_booking_capacity: capacity, updated_at: new Date().toISOString() })
    .eq('pool_id', poolId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) backToCalendar(formData, 'save_failed');

  revalidateScheduleSurfaces();
  backToCalendar(formData, capacity === raw ? 'capacity_saved' : 'capacity_clamped');
}

/**
 * The opt-in MERGE / un-merge: point a category at another of the vendor's
 * pools ('new' spins up a fresh independent pool). Pools left with no
 * categories deactivate (history kept — bookings/blocks reference them).
 */
export async function reassignCategoryPool(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const categoryKey = str(formData, 'category_key');
  const target = str(formData, 'target_pool'); // pool_id | 'new'
  if (!categoryKey || !target) backToCalendar(formData, 'save_failed');

  const { data: mapping } = await supabase
    .from('vendor_schedule_pool_categories')
    .select('pool_id')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('category_key', categoryKey)
    .maybeSingle();
  const fromPool = (mapping as { pool_id?: string } | null)?.pool_id ?? null;

  let targetPoolId: string;
  if (target === 'new') {
    const { data: created, error: createErr } = await supabase
      .from('vendor_schedule_pools')
      .insert({
        vendor_profile_id: profile.vendor_profile_id,
        pool_label: categoryKey,
      })
      .select('pool_id')
      .single();
    if (createErr || !created) backToCalendar(formData, 'save_failed');
    targetPoolId = (created as { pool_id: string }).pool_id;
  } else {
    const { data: pool } = await supabase
      .from('vendor_schedule_pools')
      .select('pool_id')
      .eq('pool_id', target)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!pool) backToCalendar(formData, 'bad_pool');
    targetPoolId = target;
  }
  if (fromPool === targetPoolId) backToCalendar(formData, 'pool_saved');

  const { error } = await supabase
    .from('vendor_schedule_pool_categories')
    .upsert(
      {
        vendor_profile_id: profile.vendor_profile_id,
        category_key: categoryKey,
        pool_id: targetPoolId,
      },
      { onConflict: 'vendor_profile_id,category_key' },
    );
  if (error) backToCalendar(formData, 'save_failed');

  // Deactivate (never delete — booking history) pools with no categories left.
  if (fromPool) {
    const { count } = await supabase
      .from('vendor_schedule_pool_categories')
      .select('category_key', { count: 'exact', head: true })
      .eq('pool_id', fromPool);
    if ((count ?? 0) === 0) {
      await supabase
        .from('vendor_schedule_pools')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('pool_id', fromPool)
        .eq('vendor_profile_id', profile.vendor_profile_id);
    }
  }

  revalidateScheduleSurfaces();
  backToCalendar(formData, 'pool_saved');
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Named Calendars (owner 2026-06-20, flag NEXT_PUBLIC_NAMED_CALENDARS_ENABLED) */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Create a vendor-NAMED calendar: a vendor_schedule_pools row the vendor names
 * + sets the limit on, with an explicit set of services assigned to it
 * (vendor_schedule_calendar_services). A "calendar" IS a pool — capacity + the
 * acquire RPC are unchanged; this only changes how a pool is created + how its
 * membership is expressed (service-level instead of category). Assigning a
 * service here MOVES it off any prior calendar (PK is vendor_service_id).
 */
export async function createCalendar(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const name = str(formData, 'calendar_name');
  if (!name) backToCalendar(formData, 'bad_name');
  const raw = Number(str(formData, 'capacity'));
  if (!Number.isInteger(raw) || raw < 1) backToCalendar(formData, 'bad_capacity');
  const capacity = await clampCapacityToTier(supabase, profile.vendor_profile_id, raw);
  const services = await ownedServiceIds(
    supabase,
    profile.vendor_profile_id,
    formData.getAll('service_ids'),
  );

  const { data: created, error } = await supabase
    .from('vendor_schedule_pools')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      calendar_name: name.slice(0, 80),
      pool_label: name.slice(0, 80), // legacy-label fallback
      is_vendor_created: true,
      daily_booking_capacity: capacity,
    })
    .select('pool_id')
    .single();
  if (error || !created) backToCalendar(formData, 'save_failed');
  const poolId = (created as { pool_id: string }).pool_id;

  if (services.length > 0) {
    const { error: memErr } = await supabase
      .from('vendor_schedule_calendar_services')
      .upsert(
        services.map((sid) => ({
          vendor_service_id: sid,
          pool_id: poolId,
          vendor_profile_id: profile.vendor_profile_id,
        })),
        { onConflict: 'vendor_service_id' },
      );
    if (memErr) backToCalendar(formData, 'save_failed');
  }

  revalidateScheduleSurfaces();
  backToCalendarPool(str(formData, 'return_month'), poolId, 'calendar_created');
}

/**
 * Edit a named calendar: rename, re-set its daily limit, and reconcile which
 * services it covers. Unchecking a service removes its membership row → it
 * falls back to its category pool (owner decision: an unassigned service stays
 * bookable, never silently un-gated). Checking a service moves it here.
 */
export async function editCalendar(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const poolId = str(formData, 'pool_id');
  const name = str(formData, 'calendar_name');
  if (!poolId) backToCalendar(formData, 'bad_pool');
  if (!name) backToCalendar(formData, 'bad_name');
  const raw = Number(str(formData, 'capacity'));
  if (!Number.isInteger(raw) || raw < 1) backToCalendar(formData, 'bad_capacity');
  const capacity = await clampCapacityToTier(supabase, profile.vendor_profile_id, raw);

  // Ownership check — a clean notice instead of an RLS throw.
  const { data: pool } = await supabase
    .from('vendor_schedule_pools')
    .select('pool_id')
    .eq('pool_id', poolId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!pool) backToCalendar(formData, 'bad_pool');

  const { error: upErr } = await supabase
    .from('vendor_schedule_pools')
    .update({
      calendar_name: name.slice(0, 80),
      daily_booking_capacity: capacity,
      updated_at: new Date().toISOString(),
    })
    .eq('pool_id', poolId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (upErr) backToCalendar(formData, 'save_failed');

  // Reconcile membership via a set-diff (positive .in only — no fragile negation).
  const desired = await ownedServiceIds(
    supabase,
    profile.vendor_profile_id,
    formData.getAll('service_ids'),
  );
  const { data: currentRows } = await supabase
    .from('vendor_schedule_calendar_services')
    .select('vendor_service_id')
    .eq('pool_id', poolId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const current = ((currentRows ?? []) as { vendor_service_id: string }[]).map(
    (r) => r.vendor_service_id,
  );
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);
  const toAdd = desired.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !desiredSet.has(id));

  if (toAdd.length > 0) {
    const { error: addErr } = await supabase
      .from('vendor_schedule_calendar_services')
      .upsert(
        toAdd.map((sid) => ({
          vendor_service_id: sid,
          pool_id: poolId,
          vendor_profile_id: profile.vendor_profile_id,
        })),
        { onConflict: 'vendor_service_id' },
      );
    if (addErr) backToCalendar(formData, 'save_failed');
  }
  if (toRemove.length > 0) {
    await supabase
      .from('vendor_schedule_calendar_services')
      .delete()
      .eq('pool_id', poolId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .in('vendor_service_id', toRemove);
  }

  revalidateScheduleSurfaces();
  backToCalendarPool(str(formData, 'return_month'), poolId, 'calendar_saved');
}
