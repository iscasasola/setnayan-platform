'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  BRANCH_FEE_PHP,
  BRANCH_LABEL_MAX,
  BRANCH_CITY_MAX,
  BRANCH_RADIUS_MIN_KM,
  BRANCH_RADIUS_MAX_KM,
  branchServiceKey,
} from '@/lib/vendor-branches';
import type { SupabaseClient } from '@supabase/supabase-js';

/** 'SN' + 8 uppercase hex — matches the couple checkout reference format. */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function fail(message: string): never {
  redirect(`/vendor-dashboard/branches?error=${encodeURIComponent(message)}`);
}

/**
 * Resolve the caller's vendor + assert they may manage branches:
 * authenticated · owner/admin role · Enterprise tier. Returns the
 * vendor_profile_id + the authed client. Server-side guard — the UI also gates,
 * but this is the load-bearing check.
 */
async function requireBranchManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) fail('No vendor profile found.');

  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) fail('Only the owner or an admin can manage branches.');

  // Soft-probe tier_state (not in FULL_VENDOR_PROFILE_SELECT). Branches are
  // Enterprise-only (owner-locked 2026-06-05).
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
  if (tier !== 'enterprise') fail('Branches are an Enterprise plan feature.');

  return { supabase, userId: user.id, vendorProfileId: profile.vendor_profile_id };
}

/**
 * Start a ₱999 apply-then-pay charge for a branch (reused by create + renew):
 * an `orders` row (event_id NULL = vendor subscription) + a pending `payments`
 * row so it lands in /admin/payments. Returns the reference code, or an error
 * tag so the caller can clean up. Price is passed explicitly (no catalog SKU).
 */
async function startBranchPayment(
  supabase: SupabaseClient,
  userId: string,
  vendorProfileId: string,
  branchId: string,
  label: string,
  channel: 'bdo' | 'gcash',
): Promise<{ referenceCode: string } | { error: true }> {
  const referenceCode = generateReferenceCode();
  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({
      event_id: null,
      user_id: userId,
      vendor_profile_id: vendorProfileId,
      service_key: branchServiceKey(branchId),
      description: `Additional Branch — ${label}`,
      requested_total_php: BRANCH_FEE_PHP,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) return { error: true };
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: userId,
    amount_php: BRANCH_FEE_PHP,
    channel,
    reference_number: null,
    screenshot_url: null,
    paid_at: new Date().toISOString().slice(0, 10),
  });
  if (pErr) {
    await supabase.from('orders').delete().eq('order_id', orderId);
    return { error: true };
  }
  return { referenceCode };
}

function parseChannel(raw: FormDataEntryValue | null): 'bdo' | 'gcash' {
  const v = String(raw ?? '').trim();
  return v === 'gcash' ? 'gcash' : 'bdo';
}

export async function createBranch(formData: FormData) {
  const { supabase, userId, vendorProfileId } = await requireBranchManager();

  const label = String(formData.get('branch_label') ?? '').trim();
  const city = String(formData.get('branch_city') ?? '').trim();
  const radiusRaw = Number(formData.get('branch_radius_km'));
  const channelRaw = String(formData.get('channel') ?? '').trim();

  if (!label || label.length > BRANCH_LABEL_MAX) fail('Enter a branch name (1–120 characters).');
  if (!city || city.length > BRANCH_CITY_MAX) fail('Enter the branch city (1–120 characters).');
  if (
    !Number.isFinite(radiusRaw) ||
    radiusRaw < BRANCH_RADIUS_MIN_KM ||
    radiusRaw > BRANCH_RADIUS_MAX_KM
  ) {
    fail(`Service radius must be ${BRANCH_RADIUS_MIN_KM}–${BRANCH_RADIUS_MAX_KM} km.`);
  }
  if (channelRaw !== 'bdo' && channelRaw !== 'gcash') fail('Choose how you will pay (BDO or GCash).');
  const channel = channelRaw as 'bdo' | 'gcash';

  // 1) Branch row — starts INACTIVE; activates when the admin approves the fee.
  const { data: branchRow, error: bErr } = await supabase
    .from('vendor_branches')
    .insert({
      parent_vendor_profile_id: vendorProfileId,
      branch_label: label,
      branch_city: city,
      branch_radius_km: Math.round(radiusRaw),
      branch_subscription_active: false,
    })
    .select('branch_id')
    .maybeSingle();
  if (bErr || !branchRow) fail('Could not create the branch. Please try again.');
  const branchId = (branchRow as { branch_id: string }).branch_id;

  // 2) Apply-then-pay charge.
  const res = await startBranchPayment(supabase, userId, vendorProfileId, branchId, label, channel);
  if ('error' in res) {
    // Roll back the branch so we don't leave an orphan with no order.
    await supabase.from('vendor_branches').delete().eq('branch_id', branchId);
    fail('Could not start the branch payment. Please try again.');
  }

  revalidatePath('/vendor-dashboard/branches');
  redirect(`/vendor-dashboard/branches?created=${encodeURIComponent(res.referenceCode)}`);
}

/**
 * Renew an expired (or pending) branch — a fresh ₱999 apply-then-pay charge for
 * the SAME branch. On admin approval the activation hook re-activates it with a
 * new 28-day window. No new branch row; reuses the existing one.
 */
export async function renewBranch(formData: FormData) {
  const { supabase, userId, vendorProfileId } = await requireBranchManager();
  const branchId = String(formData.get('branch_id') ?? '').trim();
  if (!branchId) fail('Missing branch.');
  const channel = parseChannel(formData.get('channel'));

  // Confirm the branch belongs to this vendor + isn't cancelled.
  const { data: branch } = await supabase
    .from('vendor_branches')
    .select('branch_id,branch_label,cancelled_at')
    .eq('branch_id', branchId)
    .eq('parent_vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!branch) fail('Branch not found.');
  if ((branch as { cancelled_at: string | null }).cancelled_at) {
    fail('This branch is cancelled — add a new branch instead.');
  }
  const label = (branch as { branch_label: string }).branch_label;

  const res = await startBranchPayment(supabase, userId, vendorProfileId, branchId, label, channel);
  if ('error' in res) fail('Could not start the renewal payment. Please try again.');

  revalidatePath('/vendor-dashboard/branches');
  redirect(`/vendor-dashboard/branches?renewed=${encodeURIComponent(res.referenceCode)}`);
}

export async function cancelBranch(formData: FormData) {
  const { supabase, vendorProfileId } = await requireBranchManager();
  const branchId = String(formData.get('branch_id') ?? '').trim();
  if (!branchId) fail('Missing branch.');

  const { error } = await supabase
    .from('vendor_branches')
    .update({ cancelled_at: new Date().toISOString(), branch_subscription_active: false })
    .eq('branch_id', branchId)
    .eq('parent_vendor_profile_id', vendorProfileId);
  if (error) fail('Could not cancel the branch.');

  revalidatePath('/vendor-dashboard/branches');
  redirect('/vendor-dashboard/branches?cancelled=1');
}
