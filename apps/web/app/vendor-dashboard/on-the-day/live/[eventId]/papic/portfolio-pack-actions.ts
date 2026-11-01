'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { payPath } from '@/lib/pay-path';
import { railForNewOrder } from '@/lib/rail-for-new-order';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { fetchVendorPapicPackPricePhp } from '@/lib/vendor-papic-grants';
import {
  VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
  VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
} from '@/lib/vendor-papic-credits';
import { formatCount } from '@/lib/format-number';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';

/**
 * Buy ONE Papic credit pack INTO THE SHOP WALLET — apply-then-pay, the same
 * shape every vendor add-on order uses (mirrors booth-addon-actions.ts /
 * photo-challenge-actions.ts). The activation hook (`grantVendorPapicPortfolioPack`,
 * lib/sku-activation.ts) writes the credits to `shop_papic_wallet_entries` on
 * admin approval; this action's whole job is minting the order + payment row
 * correctly so that hook has something to approve.
 *
 * 🔁 A SHOP PURCHASE SINCE 2026-10-23 (owner, option A — one shop wallet). It
 * used to require a booked `event_id` and landed the credits in that ONE
 * event. The order now carries the shop only (`eventId: null`), so there is no
 * "booked on this event" check and no event fee lock to consult: the wallet is
 * spendable on the portfolio or on any event the shop is booked on. An
 * `event_id` posted by an older form is used only to refresh that page.
 *
 * ⚠ SAME NAME ON PURPOSE. The server-action budget is at its ceiling, and the
 * prototype names this export as the anchor; reusing it keeps every guard
 * that lists this file (order-price authority, every-buy-button, closed-rail)
 * pointed at the one place a pack is minted.
 *
 * No tier or verification gate: any shop with an open rail may buy — but only
 * while the owner's Papic switch is on (owner 2026-10-25: "No. Papic needs to
 * be on."). Off ⇒ refused here, not just hidden in the sheet.
 */

export type BuyVendorPapicPortfolioPackState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ordered'; referenceCode: string; amountPhp: number };

function err(message: string): BuyVendorPapicPortfolioPackState {
  return { status: 'error', message };
}

/** 'SN' + 8 uppercase hex — matches every other order's reference format. */
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


export async function buyVendorPapicPortfolioPack(
  _prev: BuyVendorPapicPortfolioPackState,
  formData: FormData,
): Promise<BuyVendorPapicPortfolioPackState> {
  // Only used to refresh the page the form sat on — never to scope the order.
  const fromEventId = String(formData.get('event_id') ?? '').trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No supplier profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scoped to THIS vendor profile, not the caller's global-highest role — same
  // reasoning as booth-addon-actions.ts.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can buy Papic credits.');
  }

  if (!(await isVendorPapicCaptureEnabled())) {
    return err('Papic credit packs are not on sale right now.');
  }

  // Re-read the authoritative price from the admin-managed catalog — the
  // client never sends a price. `null` covers missing/inactive/unreadable.
  const admin = createAdminClient();
  const pricePhp = await fetchVendorPapicPackPricePhp(admin);
  if (pricePhp == null) {
    return err('The Papic credit pack is temporarily unavailable. Please try again later.');
  }

  // The rail kill switch (lib/rail-for-new-order.ts): never mint an order
  // nobody can pay into. A free grant needs no rail; only a paid mint gets here.
  const channel = await railForNewOrder(supabase, formData.get('channel'));
  if (!channel) return err(PAYMENTS_PAUSED_MESSAGE);
  const referenceCode = generateReferenceCode();
  const moneyWriter = createMoneyWriterClient();

  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId: null, vendorProfileId },
        {
          service_key: VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
          // The /pay page's title (lib/payable-by-reference.ts reads
          // orders.description) — the prototype's pay-page words.
          description: `Papic credit pack — ${formatCount(VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS)} credits for your shop`,
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the order. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await moneyWriter.from('payments').insert(
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
    // Same client that minted it — a mixed-client compensation is how a
    // rollback silently stops rolling back.
    await moneyWriter.from('orders').delete().eq('order_id', orderId);
    return err('Could not start the payment. Please try again.');
  }

  revalidatePath('/vendor-dashboard/customers');
  if (fromEventId) revalidatePath(`/vendor-dashboard/on-the-day/live/${fromEventId}/papic`);
  redirect(payPath(referenceCode));
}
