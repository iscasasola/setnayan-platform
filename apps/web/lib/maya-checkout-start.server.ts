import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { siteOrigin } from '@/lib/site-origin';
import { MAX_PAYMENT_PHP_DEFAULT } from '@/lib/max-payment';
import { paymentWithinCeiling } from '@/lib/payment-ceiling';
import { createMayaCheckout, readMayaGate, recordMayaCheckout } from '@/lib/maya-checkout.server';

/**
 * "Pay with card or Maya" — the press under the BDO QR on /pay/[reference].
 *
 * Reached as `intent=maya_checkout` on the page's existing form action
 * (`submitPaymentProof`), so the rail adds no server action (BUILD_RULES §3:
 * server actions do not grow). Every check the proof form makes is made here
 * too, in the same words, before Maya is asked for anything:
 *
 *   · signed in, and the reference is THEIRS (`fetchPayableByReference` on the
 *     session client — RLS decides; a stranger's code is "not found");
 *   · the bill is still waiting for payment;
 *   · a coordinator acting on the couple's order has payment permission;
 *   · the rail is ON (switch + both keys) — re-asked, never trusted from the page;
 *   · the bill is within the one-payment ceiling (owner 2026-11-17, ₱100,000).
 *
 * Then: create the checkout at the ORDER's own amount (never anything posted),
 * record it, and send the payer to Maya's hosted page. Nothing is paid or
 * approved here — that waits for Maya's API (lib/maya-settle.ts).
 */
export async function startMayaCheckout(formData: FormData): Promise<never> {
  const raw = formData.get('reference');
  const reference = typeof raw === 'string' ? raw.trim() : '';
  if (!reference) redirect('/dashboard');
  const back: (message: string) => never = (message) =>
    redirect(`/pay/${encodeURIComponent(reference)}?error=${encodeURIComponent(message)}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));

  const payable = await fetchPayableByReference(supabase, reference, user.id);
  if (!payable) redirect('/dashboard');
  if (payable.status !== 'awaiting_payment') back('This one is already settled — nothing more to send.');

  if (payable.eventId && payable.ownerUserId !== user.id) {
    const allowed = await coordinatorMoneyScopeAllowed(createMoneyWriterClient(), payable.eventId, user.id, 'checkout');
    if (!allowed) {
      back('The couple has not approved payment handling for your access — ask them to re-invite you with payment permission.');
    }
  }

  const { state, config } = await readMayaGate();
  if (!state.open) back('Card and Maya payments are off right now. Please use the QR.');
  // ⚖ Owner 2026-11-17: no single payment to Setnayan above ₱100,000. `max_payment_php` (the admin setting, #7926)
  // is not on main yet, so this reads the ruled value; swap to `getMaxPaymentPhp` when #7926 lands.
  if (!paymentWithinCeiling(payable.amountPhp, MAX_PAYMENT_PHP_DEFAULT)) {
    back('This bill is above the most we take in one payment. Please message us.');
  }

  const created = await createMayaCheckout(config, {
    amountPhp: payable.amountPhp,
    reference: payable.reference,
    description: payable.title,
    origin: siteOrigin(),
  });
  if (!created.ok) back('We couldn’t open Maya just now. Nothing was charged — try again or use the QR.');

  // The payer must be able to come back to this order from Maya's side; if we
  // could not record the checkout we do not send them.
  const recorded = await recordMayaCheckout({
    checkoutId: created.checkoutId,
    orderId: payable.orderId,
    // Whoever pressed — the same identity a proof upload stamps on its row
    // (`paymentRowFor({ userId: user.id, … })` in app/pay/[reference]/actions.ts).
    userId: user.id,
    reference: payable.reference,
    amountPhp: payable.amountPhp,
    environment: created.environment,
  });
  if (!recorded) back('We couldn’t open Maya just now. Nothing was charged — try again or use the QR.');

  redirect(created.redirectUrl);
}
