'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import {
  computeCustomQuote,
  CUSTOM_BASE,
  type CustomComposition,
  type CustomDiscount,
  type CustomUnitPrices,
} from '@/lib/vendor-custom-pricing';
import { fetchCustomUnitPrices, customPlanServiceKeyForTerm } from '@/lib/vendor-custom-catalog';

export type CustomPlanActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'quoted';
      referenceCode: string;
      final28: number;
      message: string;
    }
  | { status: 'activated'; message: string };

function err(message: string): CustomPlanActionState {
  return { status: 'error', message };
}

/**
 * Admin gate — authenticated + is_internal/is_team_member/account_type='admin'.
 * Mirrors the /admin/pricing action gate (there's no shared export). Throws
 * 'Forbidden' for a non-admin so a stray POST never mutates a plan or order.
 */
async function assertAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

/** 'SN' + 8 uppercase hex — matches the couple + branch/seat checkout format. */
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

function num(raw: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function bool(raw: FormDataEntryValue | null): boolean {
  const v = String(raw ?? '').trim();
  return v === 'true' || v === 'on' || v === '1';
}

/** Rebuild the composition + unit prices + discount from the posted form. */
function parseComposition(formData: FormData): CustomComposition {
  return {
    branches: Math.max(1, Math.floor(num(formData.get('branches'), 1))),
    // Pinned to the included base, NOT read from the form: the +100 km step
     // was dropped 2026-08-27 and nationwide is the only reach upgrade. Reading
     // a form field with no price behind it would be a free dial.
    reachKm: CUSTOM_BASE.reachKm,
    nationwide: bool(formData.get('nationwide')),
    seats: Math.max(0, Math.floor(num(formData.get('seats'), 10))),
    slotsPerCategory: Math.max(0, Math.floor(num(formData.get('slotsPerCategory'), 8))),
    // Pinned to the included base — the +100-photo pack was dropped 2026-08-27.
    photos: CUSTOM_BASE.photos,
    domain: bool(formData.get('domain')),
    // No limit on customers chased per date (owner 2026-08-29: "2500 for no
    // limit"). Read from the form, unlike the two pinned axes above, because
    // this one IS priced — turning it on adds its ₱2,500 line to the same quote.
    pipelineUnlimited: bool(formData.get('pipelineUnlimited')),
    api_access: bool(formData.get('api_access')),
  };
}

/**
 * Per-quote unit-price overrides. The admin may nudge any of the unit prices
 * for THIS quote only — they are NOT persisted (the catalog stays authoritative;
 * edit those at /admin/pricing). We start from the live catalog values (read
 * server-side, defensively) and override only the axes the form carries a valid
 * number for, so a blanked/garbage field falls back to the catalog price.
 */
async function parseUnitPrices(
  formData: FormData,
  catalog: CustomUnitPrices,
): Promise<CustomUnitPrices> {
  const over = (
    field: string,
    fallback: number,
  ): number => {
    const raw = formData.get(field);
    if (raw == null || String(raw).trim() === '') return fallback;
    const n = Number(String(raw).trim());
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    base: over('unit_base', catalog.base),
    branch: over('unit_branch', catalog.branch),
    reachNationwide: over('unit_reachNationwide', catalog.reachNationwide),
    seat: over('unit_seat', catalog.seat),
    slot: over('unit_slot', catalog.slot),
    domain: over('unit_domain', catalog.domain),
    pipelineUnlimited: over('unit_pipelineUnlimited', catalog.pipelineUnlimited),
  };
}

function parseDiscount(formData: FormData): CustomDiscount | null {
  const type = String(formData.get('discount_type') ?? '').trim();
  const value = num(formData.get('discount_value'), 0);
  if (value <= 0) return null;
  if (type === 'percent') return { type: 'percent', value };
  if (type === 'amount') return { type: 'amount', value };
  return null;
}

/**
 * Send (or re-send) a Custom-tier quote to a vendor org: upsert the
 * vendor_custom_plans row with the composed knob set + discount + quoted 28-day
 * total, then open the apply-then-pay order + pending payment so it lands in
 * /admin/payments. Admin-gated. Nothing is charged until the payment is
 * approved (which provisions via the sku-activation hook).
 */
export async function sendCustomQuote(
  _prev: CustomPlanActionState,
  formData: FormData,
): Promise<CustomPlanActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await assertAdmin();

  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '').trim();
  if (!vendorProfileId) return err('Pick a vendor org first.');
  const channelRaw = String(formData.get('channel') ?? '').trim();
  const channel = channelRaw === 'gcash' ? 'gcash' : 'bdo';

  const admin = createAdminClient();

  // Confirm the org exists (admin client bypasses RLS) + grab a label.
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!vendor) return err('Vendor org not found.');
  const businessName =
    (vendor as { business_name?: string | null }).business_name ?? 'Custom plan';

  // Recompute the quote SERVER-SIDE from the catalog (authoritative) + the
  // posted overrides + discount — never trust a client-sent price.
  const catalog = await fetchCustomUnitPrices(admin);
  const composition = parseComposition(formData);
  const unitPrices = await parseUnitPrices(formData, catalog);
  const discount = parseDiscount(formData);
  const quote = computeCustomQuote(composition, unitPrices, discount);
  const final28 = quote.final28;

  // Upsert the plan row (one draft/quoted row per org before activation — we
  // reuse the newest non-active row, else insert). Keep it simple: retire any
  // prior 'quoted'/'pending_payment'/'draft' rows to 'draft' history is overkill;
  // instead update the newest matching row in place, else insert a fresh one.
  const { data: existing } = await admin
    .from('vendor_custom_plans')
    .select('custom_plan_id, status')
    .eq('vendor_profile_id', vendorProfileId)
    .in('status', ['draft', 'quoted', 'pending_payment'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planPatch = {
    composition: composition as unknown as Record<string, unknown>,
    discount_type: discount?.type ?? null,
    discount_value: discount?.value ?? null,
    quoted_28d_php: final28,
    status: 'quoted' as const,
    updated_at: new Date().toISOString(),
  };

  let planId: string | null =
    (existing as { custom_plan_id?: string } | null)?.custom_plan_id ?? null;
  if (planId) {
    const { error: uErr } = await admin
      .from('vendor_custom_plans')
      .update(planPatch)
      .eq('custom_plan_id', planId);
    if (uErr) return err('Could not save the plan. Please try again.');
  } else {
    const { data: inserted, error: iErr } = await admin
      .from('vendor_custom_plans')
      .insert({
        vendor_profile_id: vendorProfileId,
        created_by: user.id,
        ...planPatch,
      })
      .select('custom_plan_id')
      .maybeSingle();
    if (iErr || !inserted) return err('Could not create the plan. Please try again.');
    planId = (inserted as { custom_plan_id: string }).custom_plan_id;
  }

  // Apply-then-pay order + pending payment (mirrors the branch/seat buy flow) so
  // the quote appears in /admin/payments. event_id NULL = vendor subscription.
  const referenceCode = generateReferenceCode();

  // 🔒 THE HQ QUOTE PATH IS 28-DAY ONLY, DELIBERATELY AND EXPLICITLY.
  // It is not an oversight and it must not silently mint a 28-day charge for a
  // yearly request: this surface has no term control, so no yearly request can
  // reach it. The term lives on the ORDER's service_key, and this path always
  // builds the '28d' one — so an admin-composed quote is unambiguously a 28-day
  // purchase, and the activation hook binds it against `quoted_28d_php`
  // untouched. A supplier who wants the year buys it themselves on
  // /vendor-dashboard/subscription/custom, where the choice exists.
  // If HQ ever needs to quote a year, add the control HERE and pass the term to
  // `customPlanServiceKeyForTerm` + `priceForTerm` — both already take it.
  const { data: orderRow, error: oErr } = await createMoneyWriterClient()
    .from('orders')
    .insert({
      event_id: null,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: customPlanServiceKeyForTerm(vendorProfileId, '28d'),
      description: `Custom Tier — ${businessName} (28-day)`,
      requested_total_php: final28,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) return err('Could not open the quote order. Please try again.');
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await createMoneyWriterClient().from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: final28,
    channel,
    reference_number: null,
    screenshot_url: null,
    paid_at: new Date().toISOString().slice(0, 10),
  });
  if (pErr) {
    await createMoneyWriterClient().from('orders').delete().eq('order_id', orderId);
    return err('Could not open the quote payment. Please try again.');
  }

  revalidatePath('/admin/pricing');
  revalidatePath('/admin/payments');
  return {
    status: 'quoted',
    referenceCode,
    final28,
    message: `Quote sent to ${businessName}. It appears in Payments with reference ${referenceCode}; approving that payment provisions the Custom tier. Nothing is charged until then.`,
  };
}

/**
 * Explicit admin "Mark active" override — provisions the Custom tier WITHOUT
 * waiting on the payment approval (comp / off-platform-settled orgs). Sets the
 * vendor tier_state='custom' + flips the plan row to 'active', demoting any
 * other active plan first so the one-active unique index never conflicts. This
 * is the same end-state the payment-approval sku-activation hook reaches; kept
 * as a separate lever because some Custom deals are comped or settled outside
 * the apply-then-pay rails.
 */
export async function activateCustomPlan(
  _prev: CustomPlanActionState,
  formData: FormData,
): Promise<CustomPlanActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await assertAdmin();

  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '').trim();
  const planId = String(formData.get('custom_plan_id') ?? '').trim();
  if (!vendorProfileId || !planId) return err('Missing plan to activate.');

  const admin = createAdminClient();

  // Demote any OTHER active plan for the org (one-active unique index guard).
  await admin
    .from('vendor_custom_plans')
    .update({ status: 'lapsed', updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'active')
    .neq('custom_plan_id', planId);

  const { error: planErr } = await admin
    .from('vendor_custom_plans')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('custom_plan_id', planId)
    .eq('vendor_profile_id', vendorProfileId);
  if (planErr) return err('Could not activate the plan.');

  const { error: tierErr } = await admin
    .from('vendor_profiles')
    .update({ tier_state: 'custom' })
    .eq('vendor_profile_id', vendorProfileId);
  if (tierErr) return err('Could not set the vendor tier.');

  revalidatePath('/admin/pricing');
  return {
    status: 'activated',
    message: 'Custom tier is now active for this vendor. The composed ceilings are live.',
  };
}
