'use server';

import { redirect } from 'next/navigation';
import { payPath } from '@/lib/pay-path';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import {
  computeCustomQuote,
  CUSTOM_BASE,
  priceForTerm,
  type CustomComposition,
  type CustomPlanTerm,
} from '@/lib/vendor-custom-pricing';
import {
  fetchCustomUnitPrices,
  customPlanServiceKeyForTerm,
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
  // 🔒 REACH IS PINNED TO THE INCLUDED BASE AND IS NOT READ FROM THE FORM.
  // The +100 km step was dropped 2026-08-27 (owner) — nationwide is the only
  // reach upgrade. Continuing to accept a posted `reachKm` would let a crafted
  // POST widen a shop's service radius for FREE, because nothing prices it any
  // more. The one remaining reach lever is the `nationwide` flag above, which
  // still costs `reachNationwide`.
  const reachKm = CUSTOM_BASE.reachKm;
  const seats = Math.max(CUSTOM_BASE.seats, Math.min(500, intField(formData.get('seats'), CUSTOM_BASE.seats)));
  const slotsPerCategory = Math.max(
    CUSTOM_BASE.slotsPerCategory,
    Math.min(200, intField(formData.get('slotsPerCategory'), CUSTOM_BASE.slotsPerCategory)),
  );
  // 🔒 Same for portfolio photos: the +100 pack was dropped 2026-08-27, so a
  // posted `photos` would be an unpriced capability upgrade. Pinned to base.
  const photos = CUSTOM_BASE.photos;
  const domain = boolField(formData.get('domain'));

  return {
    branches,
    reachKm,
    nationwide,
    seats,
    slotsPerCategory,
    photos,
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
  //
  // ⚠ SEC-4b FIX: this was `resolveVendorRole(supabase, user.id)` — the
  // GLOBAL-HIGHEST role across every vendor the user sits on — while every
  // sibling add-on action uses the PROFILE-scoped variant, each carrying a
  // comment explaining why: an agent/viewer on THIS shop who happens to be
  // owner/admin on some OTHER shop passed the global check. The blast radius
  // used to be capped by `orders_owner_write` + the fact that vendorProfileId
  // comes from `fetchOwnVendorProfile`; with the row now minted through
  // service_role this is the file's ONLY role gate, so it is brought in line
  // with deep-search / ai-addon / booth-addon / photo-challenge.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
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

  // 🔒 THE TERM IS THE ONLY NEW THING THE FORM CARRIES, AND IT IS A CHOICE, NOT
  // A PRICE. Anything unrecognised falls to '28d' — the cheaper term — so a
  // tampered or truncated POST can never buy a year's entitlement.
  // The AMOUNT is still re-derived server-side from our own recomputed
  // `final28`, never read from the request, so the figure the page quoted and
  // the figure we charge are the same number by construction.
  const term: CustomPlanTerm =
    String(formData.get('term') ?? '').trim() === 'annual' ? 'annual' : '28d';
  const chargePhp = priceForTerm(final28, term);
  if (!Number.isFinite(chargePhp) || chargePhp <= 0) {
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
  //
  // ── SEC-4b · service-role mint ─────────────────────────────────────────────
  // `orders` + `payments` INSERT are revoked from `authenticated` (migration
  // 20271008178212). service_role bypasses `orders_owner_write`'s
  // `WITH CHECK (user_id = auth.uid())` — RLS's only check here; it never tied
  // the order to vendorProfileId or to the vendor_custom_plans row above.
  //
  // AUTHORIZATION: authenticated → `fetchOwnVendorProfile` (server-resolved id)
  // → `resolveVendorRoleForProfile` + canManageVendor (PROFILE-scoped as of this
  // PR — see the note at the role gate) → `verification_state === 'verified'`.
  // The amount is recomputed server-side from `fetchCustomUnitPrices` +
  // `computeCustomQuote` with a `> 0` sanity check, and `parseComposition`
  // clamps every knob, so the form carries the COMPOSITION and never a peso
  // figure. The `vendor_custom_plans` write above stays on the SESSION client so
  // RLS keeps scoping it — only the money rows are elevated.
  const moneyWriter = createMoneyWriterClient();

  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId: null, vendorProfileId },
        {
          service_key: customPlanServiceKeyForTerm(vendorProfileId, term),
          description: term === 'annual' ? 'Custom Plan (1 year)' : 'Custom Plan (28-day)',
          requested_total_php: chargePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    backErr('Could not start your Custom plan request. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: orderId },
      {
        amount_php: chargePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    // Same client that minted it — a mixed-client compensation is how a
    // rollback silently stops rolling back.
    await moneyWriter.from('orders').delete().eq('order_id', orderId);
    backErr('Could not start your Custom plan request. Please try again.');
  }

  revalidatePath(CUSTOM);
  revalidatePath(SUBSCRIPTION);
  redirect(payPath(referenceCode));
}
