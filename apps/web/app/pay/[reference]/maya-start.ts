import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { siteOrigin } from '@/lib/site-origin';
import { getMaxPaymentPhp } from '@/lib/max-payment.server';
import { paymentWithinCeiling } from '@/lib/payment-ceiling';
import { createMayaCheckout, isInternalUser, readMayaGate, recordMayaCheckout } from '@/lib/maya-checkout.server';
import { noteMayaBusy } from '@/lib/maya-busy.server';
import { cookies } from 'next/headers';
import { MAYA_BUSY_COOKIE, MAYA_BUSY_COOKIE_SECONDS, mayaEnvironment } from '@/lib/maya-checkout';
import { settleMaya } from '@/app/admin/payments/maya';

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
  // Off, or a key missing: the page is the BDO page (the safety route) — send them back to it, no error.
  if (!state.open) redirect(`/pay/${encodeURIComponent(reference)}?step=2`);
  // 🔒 Sandbox keys: only an internal account may open a (test) Maya checkout — the same rule the page draws by.
  if (mayaEnvironment(config.checkoutEndpoint) === 'sandbox' && !(await isInternalUser(user.id))) {
    redirect(`/pay/${encodeURIComponent(reference)}?step=2`);
  }
  // ⚖ Owner 2026-11-17: no single payment to Setnayan above the admin's `max_payment_php` (₱100,000 ruled).
  if (!paymentWithinCeiling(payable.amountPhp, await getMaxPaymentPhp(supabase))) {
    back('This bill is above the most we take in one payment. Please message us.');
  }

  // 🔒 NEVER PAY TWICE (ship review 21 Nov, item 5). A payer who already went to Maya for this order may have paid
  // and closed the tab before coming back. Ask Maya about that checkout BEFORE opening a new one: paid → the Paid
  // page; still in progress → "Checking your payment…"; anything else is a fresh try.
  const prior = await settleMaya({ reference: payable.reference });
  if (prior.outcome === 'approved' || prior.outcome === 'already' || prior.outcome === 'queued') {
    redirect(`/pay/${encodeURIComponent(reference)}`);
  }
  if (prior.outcome === 'pending') redirect(`/pay/${encodeURIComponent(reference)}?maya=success`);

  // Maya would not open (refused, too slow, an odd answer) → the BDO QR at once, one calm line, ONE admin notice.
  const busy = async (why: string): Promise<never> => {
    await noteMayaBusy(why, payable.orderId);
    // Only this cookie makes `?maya=busy` show the BDO QR (a typed address changes nothing).
    (await cookies()).set(MAYA_BUSY_COOKIE, payable.orderId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/pay',
      maxAge: MAYA_BUSY_COOKIE_SECONDS,
    });
    redirect(`/pay/${encodeURIComponent(reference)}?maya=busy&step=2`);
  };

  const created = await createMayaCheckout(config, {
    amountPhp: payable.amountPhp,
    reference: payable.reference,
    description: payable.title,
    origin: siteOrigin(),
  });
  if (!created.ok) return busy(`create checkout: ${created.reason}`);

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
  if (!recorded) return busy('the checkout could not be recorded');

  redirect(created.redirectUrl);
}
