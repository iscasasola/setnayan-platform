'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import {
  BRANCH_LABEL_MAX,
  BRANCH_CITY_MAX,
  BRANCH_ADDRESS_MAX,
  branchServiceKey,
  branchAutoRadiusKm,
  fetchBranchFeePhp,
} from '@/lib/vendor-branches';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { reverseGeocodeNominatim } from '@/lib/geo';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BranchActionState } from './branch-types';

function err(message: string): BranchActionState {
  return { status: 'error', message };
}

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

type BranchManager = {
  supabase: SupabaseClient;
  userId: string;
  vendorProfileId: string;
};

/**
 * Resolve the caller's vendor + assert they may manage branches:
 * authenticated · owner/admin role · Enterprise tier. Hard auth failures
 * redirect (defense in depth — the UI also gates); recoverable states return
 * an error string so the inline form can show it. Returns the manager context
 * or an error result.
 */
async function requireBranchManager(): Promise<
  BranchManager | { error: BranchActionState }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: err('No vendor profile found.') };

  // ⚠ SEC-4b FIX (F2): this was `resolveVendorRole(supabase, user.id)` — the
  // GLOBAL-HIGHEST role across every vendor the user sits on — which is the
  // byte-identical bug fixed in subscription/custom/actions.ts in this PR. An
  // agent/viewer on THIS shop who happens to be owner/admin on some OTHER shop
  // passed the global check. Scope it to the profile actually being acted upon,
  // matching deep-search / ai-addon / booth-addon / photo-challenge / custom.
  //
  // Not exploitable today — `vendor_branches` RLS
  // (`parent_vendor_profile_id IN current_vendor_profile_ids()`) blocks the
  // session-client branch INSERT/SELECT first — but that is a DIFFERENT table's
  // RLS holding this file's gate up, and the money mint below now runs as
  // service_role. The role check has to be right on its own.
  const role = await resolveVendorRoleForProfile(supabase, user.id, profile.vendor_profile_id);
  if (!canManageVendor(role)) {
    return { error: err('Only the owner or an admin can manage branches.') };
  }

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
  // Enterprise-or-higher (Custom runs as Enterprise) — rank-derived so the
  // Custom tier inherits the branch feature without a hard equality edit.
  if (!isTierAtLeast(tier, 'enterprise')) {
    return { error: err('Branches are an Enterprise plan feature.') };
  }

  return { supabase, userId: user.id, vendorProfileId: profile.vendor_profile_id };
}

/**
 * Start the apply-then-pay charge for a branch (reused by create + renew):
 * an `orders` row (event_id NULL = vendor subscription) + a pending `payments`
 * row so it lands in /admin/payments. Returns the reference code, or an error
 * tag so the caller can clean up. The fee is resolved server-side from the
 * admin-managed catalog by the caller (falls back to ₱999) and passed in here.
 */
async function startBranchPayment(
  userId: string,
  vendorProfileId: string,
  branchId: string,
  label: string,
  channel: 'bdo' | 'gcash',
  feePhp: number,
): Promise<{ referenceCode: string } | { error: true }> {
  const referenceCode = generateReferenceCode();

  // ── SEC-4b · service-role mint ─────────────────────────────────────────────
  // `orders` + `payments` INSERT are revoked from `authenticated` (migration
  // 20271008178212), so the money writes go through service_role. That bypasses
  // `orders_owner_write`'s `WITH CHECK (user_id = auth.uid())` — the only thing
  // RLS ever checked here (it never looked at vendor_profile_id at all).
  //
  // AUTHORIZATION IS UNCHANGED and already adequate: every caller of this helper
  // goes through `requireBranchManager()` above, which asserts authenticated →
  // `fetchOwnVendorProfile` (vendorProfileId resolved FROM THE SESSION, never
  // from form input) → owner/admin via canManageVendor → Enterprise-or-higher
  // tier. `renewBranch` additionally re-reads the branch filtered by
  // `parent_vendor_profile_id`. `userId` / `vendorProfileId` are that helper's
  // return values, so `orderRowFor` can only stamp server-derived ids.
  //
  // The helper's `supabase: SupabaseClient` parameter is GONE rather than
  // silently unused: only the two money INSERTs and their rollback are elevated,
  // and every remaining read/write in this module (requireBranchManager,
  // fetchBranchFeePhp, the vendor_branches rows) deliberately keeps the SESSION
  // client so RLS keeps scoping it. Removing the parameter makes it impossible
  // for a later edit to reach for "the client that's already in scope" here.
  const moneyWriter = createMoneyWriterClient();
  const identity = { userId, eventId: null, vendorProfileId };

  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(identity, {
        service_key: branchServiceKey(branchId),
        description: `Additional Branch — ${label}`,
        requested_total_php: feePhp,
        status: 'submitted',
        reference_code: referenceCode,
      }),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) return { error: true };
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId, verifiedOrderId: orderId },
      {
        amount_php: feePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    await moneyWriter.from('orders').delete().eq('order_id', orderId);
    return { error: true };
  }
  return { referenceCode };
}

function parseChannel(raw: FormDataEntryValue | null): 'bdo' | 'gcash' {
  const v = String(raw ?? '').trim();
  return v === 'gcash' ? 'gcash' : 'bdo';
}

/** Parse an optional finite coordinate from a form field. */
function parseCoord(
  raw: FormDataEntryValue | null,
  lo: number,
  hi: number,
): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}

function revalidateBranchSurfaces() {
  revalidatePath('/vendor-dashboard/branches');
  revalidatePath('/vendor-dashboard/shop');
}

/**
 * Reverse-geocode a dropped pin to a city + address line for the branch form.
 * Plain server action called directly from the client (args, not FormData) so
 * the "detect city automatically" chip updates as the vendor moves the pin.
 * Best-effort: returns nulls on a geocode miss and the vendor can type the city.
 * Gated to a branch manager so it isn't an open geocoding proxy.
 */
export async function detectBranchLocation(
  lat: number,
  lng: number,
): Promise<{ city: string; address: string }> {
  const ctx = await requireBranchManager();
  if ('error' in ctx) return { city: '', address: '' };
  const r = await reverseGeocodeNominatim(lat, lng);
  return { city: r?.city ?? '', address: r?.displayName ?? '' };
}

export async function createBranch(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const ctx = await requireBranchManager();
  if ('error' in ctx) return ctx.error;
  const { supabase, userId, vendorProfileId } = ctx;

  const label = String(formData.get('branch_label') ?? '').trim();
  const city = String(formData.get('branch_city') ?? '').trim();
  const address = String(formData.get('branch_address') ?? '')
    .trim()
    .slice(0, BRANCH_ADDRESS_MAX);
  const lat = parseCoord(formData.get('branch_latitude'), -90, 90);
  const lng = parseCoord(formData.get('branch_longitude'), -180, 180);
  const channelRaw = String(formData.get('channel') ?? '').trim();

  if (!label || label.length > BRANCH_LABEL_MAX) {
    return err('Enter a branch name (1–120 characters).');
  }
  if (!city || city.length > BRANCH_CITY_MAX) {
    return err('Drop a pin on the map (or type the branch city).');
  }
  if (channelRaw !== 'bdo' && channelRaw !== 'gcash') {
    return err('Choose how you will pay (BDO or GCash).');
  }
  const channel = channelRaw as 'bdo' | 'gcash';
  // Coords are stored as a pair or not at all (a lone axis is meaningless).
  const hasCoords = lat !== null && lng !== null;

  // 1) Branch row — starts INACTIVE; activates when the admin approves the fee.
  //    Range is automatic (inherits the Enterprise tier reach).
  const { data: branchRow, error: bErr } = await supabase
    .from('vendor_branches')
    .insert({
      parent_vendor_profile_id: vendorProfileId,
      branch_label: label,
      branch_city: city,
      branch_radius_km: branchAutoRadiusKm(),
      branch_latitude: hasCoords ? lat : null,
      branch_longitude: hasCoords ? lng : null,
      branch_address: address || null,
      branch_subscription_active: false,
    })
    .select('branch_id')
    .maybeSingle();
  if (bErr || !branchRow) return err('Could not create the branch. Please try again.');
  const branchId = (branchRow as { branch_id: string }).branch_id;

  // 2) Apply-then-pay charge. Price comes from the admin-managed catalog
  //    (falls back to the ₱999 literal if the SKU row is missing).
  const feePhp = await fetchBranchFeePhp(supabase);
  const res = await startBranchPayment(
    userId,
    vendorProfileId,
    branchId,
    label,
    channel,
    feePhp,
  );
  if ('error' in res) {
    // Roll back the branch so we don't leave an orphan with no order.
    await supabase.from('vendor_branches').delete().eq('branch_id', branchId);
    return err('Could not start the branch payment. Please try again.');
  }

  revalidateBranchSurfaces();
  return {
    status: 'success',
    kind: 'created',
    referenceCode: res.referenceCode,
    message: `Branch added. Pay ₱${feePhp.toLocaleString('en-PH')} with reference ${res.referenceCode} — it activates once our team confirms your payment (within 24 hours).`,
  };
}

/**
 * Renew an expired (or pending) branch — a fresh apply-then-pay charge for the
 * SAME branch. On admin approval the activation hook re-activates it with a new
 * 28-day window. No new branch row; reuses the existing one.
 */
export async function renewBranch(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const ctx = await requireBranchManager();
  if ('error' in ctx) return ctx.error;
  const { supabase, userId, vendorProfileId } = ctx;

  const branchId = String(formData.get('branch_id') ?? '').trim();
  if (!branchId) return err('Missing branch.');
  const channel = parseChannel(formData.get('channel'));

  const { data: branch } = await supabase
    .from('vendor_branches')
    .select('branch_id,branch_label,cancelled_at')
    .eq('branch_id', branchId)
    .eq('parent_vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!branch) return err('Branch not found.');
  if ((branch as { cancelled_at: string | null }).cancelled_at) {
    return err('This branch is cancelled — add a new branch instead.');
  }
  const label = (branch as { branch_label: string }).branch_label;

  const feePhp = await fetchBranchFeePhp(supabase);
  const res = await startBranchPayment(
    userId,
    vendorProfileId,
    branchId,
    label,
    channel,
    feePhp,
  );
  if ('error' in res) return err('Could not start the renewal payment. Please try again.');

  revalidateBranchSurfaces();
  return {
    status: 'success',
    kind: 'renewed',
    referenceCode: res.referenceCode,
    message: `Renewal started. Pay ₱${feePhp.toLocaleString('en-PH')} with reference ${res.referenceCode} — the branch reactivates for another 28 days once our team confirms.`,
  };
}

export async function cancelBranch(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const ctx = await requireBranchManager();
  if ('error' in ctx) return ctx.error;
  const { supabase, vendorProfileId } = ctx;

  const branchId = String(formData.get('branch_id') ?? '').trim();
  if (!branchId) return err('Missing branch.');

  const { error: uErr } = await supabase
    .from('vendor_branches')
    .update({ cancelled_at: new Date().toISOString(), branch_subscription_active: false })
    .eq('branch_id', branchId)
    .eq('parent_vendor_profile_id', vendorProfileId);
  if (uErr) return err('Could not cancel the branch.');

  revalidateBranchSurfaces();
  return { status: 'success', kind: 'cancelled', message: 'Branch cancelled.' };
}
