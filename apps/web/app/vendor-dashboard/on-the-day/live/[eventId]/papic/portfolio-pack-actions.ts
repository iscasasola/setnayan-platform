'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { payPath } from '@/lib/pay-path';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { fetchVendorPapicPackPricePhp } from '@/lib/vendor-papic-grants';
import { VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE } from '@/lib/vendor-papic-credits';

/**
 * Buy ONE Papic credit pack for a booked event — apply-then-pay, the same
 * shape every vendor add-on order uses (mirrors booth-addon-actions.ts /
 * photo-challenge-actions.ts). The activation hook that grants the credits
 * already shipped in G2 (`grantVendorPapicPortfolioPack`, lib/sku-activation.ts)
 * — this action's whole job is minting the order + payment row correctly so
 * that hook has something to approve.
 *
 * No tier or verification gate (G2's PR body, and the activation hook's own
 * comment): the owner priced this for the import case — a supplier who paid
 * no booking fee — which is any booked supplier, on any tier.
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

function parseChannel(raw: FormDataEntryValue | null): 'bdo' | 'gcash' {
  return String(raw ?? '').trim() === 'gcash' ? 'gcash' : 'bdo';
}

export async function buyVendorPapicPortfolioPack(
  _prev: BuyVendorPapicPortfolioPackState,
  formData: FormData,
): Promise<BuyVendorPapicPortfolioPackState> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) return err('Missing event.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No vendor profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scoped to THIS vendor profile, not the caller's global-highest role — same
  // reasoning as booth-addon-actions.ts.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can buy Papic credits.');
  }

  // ── AUTHORIZATION: is this shop actually booked on this event? ────────────
  // `orders` INSERT runs on the service-role money-writer client (SEC-4b), so
  // nothing downstream re-checks booking the way vendor_papic_portfolio_photos'
  // own RLS insert policy does — this IS the check for the order.
  const booked = (await fetchVendorRoomEvents(supabase, vendorProfileId)).some(
    (b) => b.eventId === eventId,
  );
  if (!booked) {
    return err('You are not booked on this event.');
  }

  // ── Feature-availability gate (defence in depth) ───────────────────────────
  // The whole vendor Papic lane — camera, album, this pack — lives behind the
  // same admin control. If it is off there is nowhere for the credits to be
  // spent; never take money for them.
  if (!(await isVendorPapicCaptureEnabled())) {
    return err('Papic is switched off right now, so credits can’t be spent — you won’t be charged.');
  }

  // Re-read the authoritative price from the admin-managed catalog — the
  // client never sends a price. `null` covers missing/inactive/unreadable.
  const admin = createAdminClient();
  const pricePhp = await fetchVendorPapicPackPricePhp(admin);
  if (pricePhp == null) {
    return err('The Papic credit pack is temporarily unavailable. Please try again later.');
  }

  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();
  const moneyWriter = createMoneyWriterClient();

  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId, vendorProfileId },
        {
          service_key: VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
          description: 'Papic credit pack — for your private portfolio',
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

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}/papic`);
  redirect(payPath(referenceCode));
}
