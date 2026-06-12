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

  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    tier = (data as { tier_state?: string } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }
  const slotsCap = tierCaps(asVendorTier(tier)).slotsPerDay;
  // Every tier keeps at least the default 1/day pool; structural SQL CHECK
  // caps at 50.
  const ceiling = Number.isFinite(slotsCap) ? Math.max(1, slotsCap) : 50;
  const capacity = Math.min(Math.min(raw, ceiling), 50);

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
