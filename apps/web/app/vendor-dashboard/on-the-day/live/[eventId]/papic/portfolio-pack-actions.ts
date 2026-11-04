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
import { fetchShopPapicPacks } from '@/lib/vendor-papic-grants';
import { shopPapicPackServiceKey } from '@/lib/vendor-papic-credits';
import { formatCount } from '@/lib/format-number';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { fetchVendorPaysGiftPrice } from '@/lib/setnayan-gift.server';
import { giftUnitPrice, shopGiftPacksFrom, shopGiftServiceKey, SHOP_GIFT_MAX_QUANTITY } from '@/lib/shop-gifts';

/**
 * 🛍 2026-11-04 — THE SHOP BUYS THE COUPLE'S PACKS (owner, "SIX OWNER ANSWERS" (4)). The form names a pack
 * (`pack` = `PAPIC_GUEST_150` · `PAPIC_GUEST_1K` · `PAPIC_GUEST`); its price and credits are READ from the couple
 * catalogue (`fetchShopPapicPacks`), never sent by the client, and the order is keyed
 * `shopPapicPackServiceKey(code)` so the activation hook lands that rung's credits in the shop wallet. The ₱500
 * `vendor_papic_portfolio_pack` is retired and is no longer minted here.
 *
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
 *
 * 🎁 2026-11-04 — THE SAME DOOR BUYS GIFTS (owner, "SUPPLIER GIFTS: BOUGHT IN QUANTITY, KEPT AS STOCK"). `for=gift`
 * mints `vendor_gift__<code>` for `quantity` packs into the shop's GIFT STOCK (`shop_gift_stock_entries`, landed on
 * approval from the `shop_gift_purchases` row written here — `orders` has no quantity). The unit price is the
 * pack's `gift_price_php` for a Verified-and-up shop and its list price for Free ("GIFT PRICES"), both READ here.
 * One export for both on purpose: the server-action budget is at its ceiling (lint-server-action-budget.mjs).
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

  // Re-read the authoritative price + credits from the admin-managed catalog — the
  // client names a pack, never a price. `null` covers missing/inactive/unreadable.
  const admin = createAdminClient();
  const packs = await fetchShopPapicPacks(admin);
  const asked = String(formData.get('pack') ?? '').trim();
  const pack = packs?.find((p) => p.code === asked) ?? null;
  if (!pack) {
    return err('That Papic pack is not on sale right now. Please try again later.');
  }
  // 🎁 A GIFT order: how many, and the price this shop pays for one (read, never sent).
  const forGift = String(formData.get('for') ?? '') === 'gift';
  const quantity = forGift ? Math.trunc(Number(formData.get('quantity') ?? 1)) : 1;
  if (forGift && (!Number.isInteger(quantity) || quantity < 1 || quantity > SHOP_GIFT_MAX_QUANTITY)) {
    return err(`Choose between 1 and ${SHOP_GIFT_MAX_QUANTITY}.`);
  }
  const giftPack = forGift ? shopGiftPacksFrom([pack])[0] ?? null : null;
  if (forGift && !giftPack) return err('That gift is not on sale right now. Please try again later.');
  const giftUnit = giftPack ? giftUnitPrice(giftPack, await fetchVendorPaysGiftPrice(admin, vendorProfileId)) : null;
  const pricePhp = giftUnit ? (giftUnit.centavos * quantity) / 100 : pack.pricePhp;

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
          service_key: forGift ? shopGiftServiceKey(pack.code) : shopPapicPackServiceKey(pack.code),
          // The /pay page's title (lib/payable-by-reference.ts reads
          // orders.description) — the pack's own name.
          description: forGift
            ? `Gifts for your couples — ${quantity} × ${pack.title} (${formatCount(pack.credits * quantity)} credits)`
            : `${pack.title} — ${formatCount(pack.credits)} credits for your shop`,
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
  // Takes the just-minted order back when a later write fails. Same client that minted it — a mixed-client
  // compensation is how a rollback silently stops rolling back. A failed undo leaves an unpaid order with no
  // payment behind it; it is logged so somebody sees it, and the customer is told the order did not start.
  const undoOrder = async (why: string) => {
    const { error: undoErr } = await moneyWriter.from('orders').delete().eq('order_id', orderId);
    if (undoErr) console.error(`[shop-pack] could not take back order ${orderId} after ${why}:`, undoErr.message);
  };

  // 🎁 What this gift order bought — approval reads it to land the credits in the gift stock.
  if (forGift && giftUnit) {
    const { error: gErr } = await moneyWriter.from('shop_gift_purchases').insert({
      order_id: orderId,
      vendor_profile_id: vendorProfileId,
      service_code: pack.code,
      gift_kind: 'papic',
      quantity,
      credits_each: pack.credits,
      unit_price_php: giftUnit.centavos / 100,
      price_basis: giftUnit.basis,
      created_by: user.id,
    });
    if (gErr) {
      await undoOrder('the gift row failed');
      return err('Could not start the order. Please try again.');
    }
  }

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
    await undoOrder('the payment row failed');
    return err('Could not start the payment. Please try again.');
  }

  revalidatePath('/vendor-dashboard/customers');
  if (forGift) revalidatePath('/vendor-dashboard/subscription');
  if (fromEventId) revalidatePath(`/vendor-dashboard/on-the-day/live/${fromEventId}/papic`);
  redirect(payPath(referenceCode));
}
