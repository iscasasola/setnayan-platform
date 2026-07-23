'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createBookingFeeCheckout } from '@/lib/paymongo';
import {
  bookingFeeInclusiveCentavos,
  type BookingFeeMethod,
} from '@/lib/booking-fee-checkout';

/**
 * Start a PayMongo checkout for a proposal's pending booking-fee charge. The
 * vendor picks the method in our UI (so we can quote the INCLUSIVE per-method
 * price — GCash = fee, card = fee + ₱15 — a single price, never a surcharge line),
 * then we create a method-scoped checkout and redirect to PayMongo. On success the
 * webhook (PR-4a) settles the charge; the vendor re-sends the (still-draft)
 * proposal, which now clears the gate. Inert until PayMongo is configured.
 */
export async function startBookingFeeCheckout(formData: FormData) {
  const chargeId = String(formData.get('charge_id') ?? '');
  const publicId = String(formData.get('public_id') ?? '');
  const method: BookingFeeMethod =
    String(formData.get('method') ?? '') === 'card' ? 'card' : 'gcash';
  if (!chargeId || !publicId) redirect('/vendor-dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read the pending charge under the vendor's own RLS (own charges only, PR-3).
  const { data: charge } = await supabase
    .from('booking_fee_charges')
    .select('charge_id, public_id, vendor_profile_id, amount_charged_centavos, status')
    .eq('charge_id', chargeId)
    .eq('status', 'pending')
    .maybeSingle();
  // Already paid / not pending / not yours → nothing to pay.
  if (!charge) redirect(`/proposals/${publicId}?notice=fee_gone`);

  const inclusive = bookingFeeInclusiveCentavos(
    Number(charge.amount_charged_centavos) || 0,
    method,
  );

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = host ? `${proto}://${host}` : '';

  const checkout = await createBookingFeeCheckout({
    chargeId: charge.charge_id as string,
    vendorProfileId: charge.vendor_profile_id as string,
    amountCentavos: inclusive,
    referenceNumber: charge.public_id as string,
    methods: [method],
    successUrl: `${origin}/proposals/${publicId}?notice=fee_paid`,
    cancelUrl: `${origin}/proposals/${publicId}?notice=fee_cancelled`,
    idempotencyKey: `${chargeId}-${method}`,
  });
  if (!checkout) redirect(`/proposals/${publicId}?notice=fee_checkout_failed`);

  // External redirect to the PayMongo hosted checkout.
  redirect(checkout.checkoutUrl);
}
