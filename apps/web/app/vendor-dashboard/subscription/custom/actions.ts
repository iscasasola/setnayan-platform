'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  computeCustomQuote,
  CUSTOM_BASE,
  type CustomComposition,
} from '@/lib/vendor-custom-pricing';
import {
  fetchCustomUnitPrices,
  customPlanServiceKey,
} from '@/lib/vendor-custom-catalog';

/**
 * "Request this plan" — the vendor-facing Custom-tier composer submit
 * (VENDOR_TIERS_AND_BENEFITS.md §11 · PR-B). Apply-then-pay, identical shape to
 * buyExtraSeat / createBranch: upsert a `vendor_custom_plans` row
 * (status pending_payment) + an `orders` row keyed
 * `vendor_custom_plan__{vendor_profile_id}` + a pending `payments` row, so it
 * lands in /admin/payments for the Setnayan team to review and send payment
 * instructions. NOTHING is charged until the vendor pays + admin confirms.
 *
 * The quote is re-computed SERVER-SIDE from the admin-managed catalog prices —
 * the client's shown price is never trusted for the order amount. There is NO
 * discount control here (discount is admin-only · PR-C); the vendor always
 * requests at LIST price.
 */

const CUSTOM = '/vendor-dashboard/subscription/custom';
const SUBSCRIPTION = '/vendor-dashboard/subscription';

function backErr(msg: string): never {
  redirect(`${CUSTOM}?error=${encodeURIComponent(msg)}`);
}

/** 'SN' + 8 uppercase hex — matches the couple checkout / branch / seat format. */
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

function intField(raw: FormDataEntryValue | null, fallback: number): number {
  const n = Math.floor(Number(String(raw ?? '').trim()));
  return Number.isFinite(n) ? n : fallback;
}

function boolField(raw: FormDataEntryValue | null): boolean {
  const v = String(raw ?? '').trim();
  return v === 'true' || v === '1' || v === 'on';
}

/**
 * Clamp a submitted composition to the same bounds the UI enforces, so a
 * hand-crafted POST can't quote below the floor or above the caps. Mirrors the
 * configurator's control ranges.
 */
function parseComposition(formData: FormData): CustomComposition {
  const nationwide = boolField(formData.get('nationwide'));
  const branches = Math.max(1, Math.min(50, intField(formData.get('branches'), 1)));
  const reachKmRaw = intField(formData.get('reachKm'), CUSTOM_BASE.reachKm);
  // Snap reach to a valid +100 km step within [100, 500].
  const reachStepped = Math.round(reachKmRaw / 100) * 100;
  const reachKm = Math.max(
    CUSTOM_BASE.reachKm,
    Math.min(CUSTOM_BASE.reachMaxKm, reachStepped),
  );
  const seats = Math.max(CUSTOM_BASE.seats, Math.min(500, intField(formData.get('seats'), CUSTOM_BASE.seats)));
  const slotsPerCategory = Math.max(
    CUSTOM_BASE.slotsPerCategory,
    Math.min(200, intField(formData.get('slotsPerCategory'), CUSTOM_BASE.slotsPerCategory)),
  );
  const photosRaw = intField(formData.get('photos'), CUSTOM_BASE.photos);
  // Snap photos to a +100 step, floored at the base 300.
  const photos = Math.max(CUSTOM_BASE.photos, Math.round(photosRaw / 100) * 100);
  const tokensRaw = intField(formData.get('tokensPerCycle'), 0);
  // Snap tokens to a +25 step within [0, 500].
  const tokensPerCycle = Math.max(0, Math.min(500, Math.round(tokensRaw / 25) * 25));
  const domain = boolField(formData.get('domain'));

  return {
    branches,
    reachKm,
    nationwide,
    seats,
    slotsPerCategory,
    photos,
    tokensPerCycle,
    domain,
  };
}

export async function requestCustomPlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = profile.vendor_profile_id;

  // Owner + admin of the org only (multi-admin governance). It's a sales path —
  // NOT hard-gated to a tier — but must be a VERIFIED store (same gate as
  // subscribe / buy-tokens: "they can only subscribe when they are verified").
  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) {
    backErr('Only the owner or an admin can request a Custom plan.');
  }

  const { data: vRow } = await supabase
    .from('vendor_profiles')
    .select('verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const verified =
    (vRow as { verification_state?: string | null } | null)?.verification_state === 'verified';
  if (!verified) {
    backErr('Get verified first — Custom plans are for verified stores.');
  }

  const channel = formData.get('channel') === 'gcash' ? 'gcash' : 'bdo';
  const composition = parseComposition(formData);

  // Re-price server-side from the admin-managed catalog (never trust the client
  // amount). No discount on the vendor path (admin-only · PR-C).
  const unitPrices = await fetchCustomUnitPrices(supabase);
  const quote = computeCustomQuote(composition, unitPrices);
  const final28 = quote.final28;
  if (!Number.isFinite(final28) || final28 <= 0) {
    backErr('Could not price this plan. Please try again.');
  }

  const referenceCode = generateReferenceCode();

  // 1) Upsert the composed plan row → pending_payment. Don't mutate an ACTIVE
  //    plan (the effective-caps overlay reads it) — an "Adjust" always creates a
  //    NEW pending row alongside the active one. We reuse the vendor's most
  //    recent NON-active draft/quote/pending row if present, else insert.
  const { data: existing } = await supabase
    .from('vendor_custom_plans')
    .select('custom_plan_id, status')
    .eq('vendor_profile_id', vendorProfileId)
    .in('status', ['draft', 'quoted', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let customPlanId: string | null =
    (existing as { custom_plan_id?: string } | null)?.custom_plan_id ?? null;

  if (customPlanId) {
    const { error: uErr } = await supabase
      .from('vendor_custom_plans')
      .update({
        composition,
        quoted_28d_php: final28,
        status: 'pending_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('custom_plan_id', customPlanId)
      .eq('vendor_profile_id', vendorProfileId);
    if (uErr) backErr('Could not save your plan. Please try again.');
  } else {
    const { data: ins, error: iErr } = await supabase
      .from('vendor_custom_plans')
      .insert({
        vendor_profile_id: vendorProfileId,
        composition,
        quoted_28d_php: final28,
        status: 'pending_payment',
        created_by: user.id,
      })
      .select('custom_plan_id')
      .maybeSingle();
    if (iErr || !ins) backErr('Could not save your plan. Please try again.');
    customPlanId = (ins as { custom_plan_id: string }).custom_plan_id;
  }

  // 2) Apply-then-pay order + pending payment (mirrors buyExtraSeat EXACTLY).
  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({
      event_id: null,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: customPlanServiceKey(vendorProfileId),
      description: 'Custom Plan (28-day)',
      requested_total_php: final28,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    backErr('Could not start your Custom plan request. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: final28,
    channel,
    reference_number: null,
    screenshot_url: null,
    paid_at: new Date().toISOString().slice(0, 10),
  });
  if (pErr) {
    await supabase.from('orders').delete().eq('order_id', orderId);
    backErr('Could not start your Custom plan request. Please try again.');
  }

  revalidatePath(CUSTOM);
  revalidatePath(SUBSCRIPTION);
  redirect(`${CUSTOM}?requested=${encodeURIComponent(referenceCode)}`);
}
