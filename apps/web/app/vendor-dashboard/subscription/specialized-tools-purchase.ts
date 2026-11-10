import 'server-only';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { payPath } from '@/lib/pay-path';
import { railForNewOrder } from '@/lib/rail-for-new-order';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import {
  SPECIALIZED_TOOLS_ANNUAL_SKU_CODE,
  SPECIALIZED_TOOLS_DENY_MESSAGE,
  SPECIALIZED_TOOLS_SKU_CODE,
  SPECIALIZED_TOOLS_SKU_CODES,
  specializedToolsPurchaseEligibility,
} from '@/lib/specialized-tools-access';

/**
 * 🧰 BUY THE SPECIALIZED TOOLS UNLOCK (Build 4, owner 2026-11-09).
 *
 * ₱499 / 4 weeks or ₱4,990 / year — read from `vendor_billing_catalog`, never typed here. Opens every
 * paid specialized tool: Papic challenge, the branded 3D plan booth, every future Setnayan tool.
 *
 * WHO MAY BUY: a VERIFIED shop on Verified or Solo (`specializedToolsPurchaseEligibility`). Pro and
 * Ultra are refused — their plan already includes it. The approval hook re-asserts the same floor
 * (`activateSpecializedToolsOrder` in lib/sku-activation.ts), so the two can never disagree.
 *
 * Apply-then-pay, the shape of `photo-challenge-actions.ts` (the add-on this replaces): a 'submitted'
 * order + a pending payment that lands in /admin/payments; approval stamps
 * `vendor_specialized_tools_access.unlock_expires_at`. The form sends only the cycle and the pay
 * channel — never a price, never an event, never a shop. There is no free path: the free experience
 * is the first-booked-event trial, which the database claims on its own.
 *
 * ⛔ NOT A "use server" FILE, ON PURPOSE. Every exported server action is one Vercel route, and the budget
 * (`scripts/lint-server-action-budget.mjs`) sits at its ceiling. The Upgrade button belongs to the Build 3
 * Specialized tools row; the PR that draws it adds the one-line `'use server'` wrapper (or folds this into an
 * existing dispatcher) and takes the route-count decision there, with a `vercel build` count in hand.
 */

export type SpecializedToolsActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

function err(message: string): SpecializedToolsActionState {
  return { status: 'error', message };
}

/** 'SN' + 8 uppercase hex — the reference format every supplier add-on uses. */
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

/** The cycle from the form: 'year' → the yearly row; anything else → 4 weeks. */
function skuForCycle(raw: FormDataEntryValue | null): string {
  return String(raw ?? '').trim() === 'year'
    ? SPECIALIZED_TOOLS_ANNUAL_SKU_CODE
    : SPECIALIZED_TOOLS_SKU_CODE;
}

export async function buySpecializedTools(
  _prev: SpecializedToolsActionState,
  formData: FormData,
): Promise<SpecializedToolsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No supplier profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Profile-scoped role: an agent or viewer on this shop cannot buy for it.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can unlock Specialized tools.');
  }

  const admin = createAdminClient();

  // ── The gate, BEFORE pricing. Read with the admin client: a read the shop's own session could
  // refuse would degrade toward selling to somebody who may not buy.
  const { data: gateRow } = await admin
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const gate = gateRow as
    | { tier_state?: string | null; tier_expires_at?: string | null; verification_state?: string | null }
    | null;
  const eligibility = specializedToolsPurchaseEligibility({
    tier: gate?.tier_state ?? null,
    tierExpiresAt: gate?.tier_expires_at ?? null,
    verification: gate?.verification_state ?? null,
  });
  if (!eligibility.ok) return err(SPECIALIZED_TOOLS_DENY_MESSAGE[eligibility.reason]);

  // ── One order in review at a time, across BOTH cycles (two quick submits must not mint two).
  const { data: pendingOrder } = await admin
    .from('orders')
    .select('order_id')
    .eq('vendor_profile_id', vendorProfileId)
    .in('service_key', SPECIALIZED_TOOLS_SKU_CODES as string[])
    .eq('status', 'submitted')
    .limit(1)
    .maybeSingle();
  if (pendingOrder) {
    return err(
      'You already have a Specialized tools order in review — it turns on once our team confirms your payment.',
    );
  }

  // ── The authoritative price + is_active, from the admin-managed row. No row, or a retired one,
  // refuses the sale: there is no price typed in code to fall back to.
  const sku = skuForCycle(formData.get('cycle'));
  const { data: skuRow } = await admin
    .from('vendor_billing_catalog')
    .select('price_php, is_active, title')
    .eq('sku_code', sku)
    .maybeSingle();
  const row = skuRow as { price_php?: number | string | null; is_active?: boolean | null; title?: string | null } | null;
  const pricePhp = row ? Number(row.price_php) : Number.NaN;
  if (!row || row.is_active !== true || !Number.isFinite(pricePhp) || pricePhp <= 0) {
    return err('Specialized tools is not available right now. You have not been charged.');
  }

  // ── The rail kill switch: never mint an order nobody can pay into.
  const channel = await railForNewOrder(supabase, formData.get('channel'));
  if (!channel) return err(PAYMENTS_PAUSED_MESSAGE);
  const referenceCode = generateReferenceCode();

  // ── Service-role mint (orders/payments INSERT are revoked from `authenticated`). Every identity on
  // the order comes from the session.
  const { data: orderRow, error: oErr } = await createMoneyWriterClient()
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId: null, vendorProfileId },
        {
          service_key: sku,
          description: row.title ?? 'Specialized tools',
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Specialized tools order. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await createMoneyWriterClient().from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: orderId },
      {
        amount_php: pricePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    // Same client that minted it, so the rollback really rolls back. A rollback that fails leaves a
    // 'submitted' order with no payment — say so loudly, the admin queue is where it will surface.
    const { error: rbErr } = await createMoneyWriterClient().from('orders').delete().eq('order_id', orderId);
    if (rbErr) {
      console.error('[supabase-error] specialized-tools-purchase: order rollback failed', orderId, rbErr);
    }
    return err('Could not start the Specialized tools payment. Please try again.');
  }

  revalidatePath('/vendor-dashboard/subscription');
  // The buyer goes where they can actually pay (the account, the QR with the amount, the screenshot).
  redirect(payPath(referenceCode));
}
