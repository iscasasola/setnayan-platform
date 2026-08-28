'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { paymentRowFor } from '@/lib/order-mint-identity';
import { parseClientRef, orderPaymentProofPolicy } from '@/lib/r2-client-ref';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { notifyAdminsPaymentProofSubmitted } from '@/lib/order-admin-notify';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { CANCELLABLE_ORDER_STATUSES } from '@/lib/event-deletion-gate';

/**
 * The one proof submission, for every purchase.
 *
 * # What proves this payment is theirs to log
 *
 * `fetchPayableByReference` re-reads the order on the SESSION client, so
 * `orders_owner_read` decides — a reference that is not the caller's comes back
 * null and this refuses. `paymentRowFor` then binds the row to that proven
 * order id and to the server's user id, which is what RLS used to do before
 * `payments` INSERT was revoked from `authenticated` (migration 20271008178212).
 * The reference in the form is therefore a LOOKUP KEY, never an authorisation.
 *
 * # The amount is a claim, not a control
 *
 * We stamp the order's own amount rather than anything posted, so a tampered
 * form cannot log a ₱5,000 plan as ₱50 — but the real check is the admin
 * matching it against the bank message at /admin/payments. Nothing activates
 * here.
 */

const back = (reference: string, key: string, value: string): never =>
  redirect(`/pay/${encodeURIComponent(reference)}?${key}=${encodeURIComponent(value)}`);

/**
 * Keep what a bank reference can contain — and keep ALL of it.
 *
 * The field asks for the last six digits because that is what a person can read
 * off a receipt without squinting, but somebody who pastes the whole number has
 * given us MORE to match on and throwing it away would be perverse. Six is a
 * minimum, not a maximum.
 *
 * ⚠ No format check and no minimum length, deliberately — the same reasoning
 * `requireBookingFeeReference` already carries: this is the BANK'S id (a GCash
 * reference, an InstaPay invoice, a BDO confirmation number) and those have no
 * common shape, so a regex here would refuse real payments.
 */
function normaliseReference(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, 64);
}

export async function submitPaymentProof(formData: FormData): Promise<void> {
  const referenceRaw = formData.get('reference');
  if (typeof referenceRaw !== 'string' || referenceRaw.trim().length === 0) {
    redirect('/dashboard');
  }
  const reference = referenceRaw.trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));

  const payable = await fetchPayableByReference(supabase, reference);
  if (!payable) {
    // Same answer as "no such reference" — never confirm a stranger's code.
    redirect('/dashboard');
  }
  if (payable.status !== 'awaiting_payment') {
    back(reference, 'error', 'This one is already settled — nothing more to send.');
  }

  // ── The couple's coordinator consent gate, which this page must not be a way
  // round ─────────────────────────────────────────────────────────────────────
  // `orders_owner_read` admits ANY member of the event (migration 20270129279924
  // widened it), so a coordinator the couple invited WITHOUT payment permission
  // can read the couple's order — and would otherwise be able to log a payment
  // claim here that the couple's own order page refuses in as many words. A
  // second door onto the same act has to carry the same lock.
  // Eventless orders (a shop's plan, a per-user purchase) have no couple to ask.
  // ⚠ AND ONLY WHEN THEY ARE PAYING SOMEBODY ELSE'S ORDER. A supplier paying
  // Setnayan on a couple-scoped order — a Papic Challenge sponsorship, a
  // booking fee — owns that order outright; asking the couple's permission
  // would refuse a shop, in the couple's words, on a page where no couple is
  // involved. The gate is about acting ON the couple's behalf, not about the
  // order carrying their event.
  if (payable.eventId && payable.ownerUserId !== user.id) {
    const allowed = await coordinatorMoneyScopeAllowed(
      createMoneyWriterClient(),
      payable.eventId,
      user.id,
      'checkout',
    );
    if (!allowed) {
      back(
        reference,
        'error',
        'The couple has not approved payment handling for your access — ask them to re-invite you with payment permission.',
      );
    }
  }

  // The screenshot is optional, but a ref that is not bound to THIS order's
  // private-bucket prefix is dropped rather than stored: a bare `r2://` prefix
  // check once let a buyer pin any object in any bucket onto their own order,
  // which an admin then opens while reconciling (SEC-1).
  let screenshotUrl: string | null = null;
  const refRaw = formData.get('screenshot_ref');
  if (
    typeof refRaw === 'string' &&
    parseClientRef(refRaw.trim(), orderPaymentProofPolicy(payable.orderId))
  ) {
    screenshotUrl = refRaw.trim();
  }

  const bankReference = normaliseReference(formData.get('reference_last6'));

  // ── A CLAIM WITH NOTHING IN IT IS WORSE THAN NO CLAIM ──────────────────────
  // Both fields were optional on the first cut, and the submit button sits
  // BELOW them: one stray tap wrote a row with no screenshot and no reference,
  // which is unreconcilable — and, because the page hides the form once
  // anything is logged, it also took away the only way to send the real proof.
  // Refuse instead, and say which half is missing.
  if (!screenshotUrl && !bankReference) {
    back(
      reference,
      'error',
      'Add your payment screenshot and the last 6 digits of your reference number — we need at least one of them to find your payment.',
    );
  }

  // ⚖ AND A BOOKING FEE MUST CARRY ONE (owner 2026-08-06). On that lane the
  // reference is REQUIRED, not merely useful: it is money a shop owes Setnayan
  // and the admin reconciles it against a bank message rather than guessing.
  // Note the owner's rule is that a reference is PRESENT — `requireBookingFeeReference`
  // sets no minimum length and no format, and says so — so the last-six field
  // satisfies it without either rule bending.
  if (payable.requiresReference && !bankReference) {
    back(
      reference,
      'error',
      'Add the reference number from your BDO or GCash confirmation — we need it to match your payment.',
    );
  }

  // ⚠ LOWERCASE, AND IT IS LOAD-BEARING. `/admin/settings/payment-methods`
  // measures how much room the receiving account has left this month by
  // matching `channel === 'gcash'` / `'bdo'` EXACTLY; anything else scores the
  // payment as ₱0 against the cap, so the meter reads clear while the account
  // fills up. 'GCash'/'BDO' looked nicer and was silently unreadable.
  const channelRaw = formData.get('channel');
  const channel = channelRaw === 'bdo' ? 'bdo' : channelRaw === 'gcash' ? 'gcash' : 'bank_transfer';

  const idempotencyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyRaw === 'string' && idempotencyRaw.trim().length > 0
      ? idempotencyRaw.trim().slice(0, 64)
      : null;

  const moneyWriter = createMoneyWriterClient();
  const { error } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: payable.orderId },
      {
        // The ORDER's amount, never the form's — see the header.
        amount_php: payable.amountPhp,
        channel,
        reference_number: bankReference,
        screenshot_url: screenshotUrl,
        paid_at: new Date().toISOString().slice(0, 10),
        client_idempotency_key: idempotencyKey,
      },
    ),
  );

  // 23505 on (order_id, client_idempotency_key) means their first submit landed
  // and they pressed again — that is success, not a failure.
  const duplicateRetry = (error as { code?: string } | null)?.code === '23505';
  if (error && !duplicateRetry) {
    back(reference, 'error', "We couldn't record that just now. Please try again.");
  }

  // ── SOMEBODY HAS TO BE TOLD ───────────────────────────────────────────────
  // 🚨 THIS PAGE NOTIFIED NOBODY ON ITS FIRST CUT. The couple-side action it
  // replaces has always alerted the admins who can confirm a payment, and a
  // guard on that action says why: "the moment money moves must notify
  // somebody." Moving the surface without carrying the alert would have left
  // every payment through this page sitting unseen until an admin happened to
  // open the queue — for TEN purchase paths at once.
  //
  // ⚠ Not on the duplicate retry: the FIRST submit already alerted, and a
  // second alert for one payment trains the reader to ignore the alert.
  // ⚠ Before the redirect, which throws — anything after it never runs.
  if (!error) {
    await notifyAdminsPaymentProofSubmitted({
      orderId: payable.orderId,
      eventId: payable.eventId ?? '',
      amountPhp: payable.amountPhp,
      channel,
    });
  }

  revalidatePath(`/pay/${reference}`);
  redirect(`/pay/${encodeURIComponent(reference)}?sent=1`);
}

/**
 * removeSetupExtras — the ONE other thing this page can do.
 *
 * ⚖ OWNER, 2026-08-28: *"No option to pay later. then need to go back to uncheck
 * their papic and setnayan AI purchase."*
 *
 * 🔑 "GO BACK AND UNCHECK" IS A CANCEL, NOT A REWIND. By the time anybody sees
 * this page the event EXISTS — it is committed before the bill is minted, which
 * is where the reference number comes from. Walking them back into the wizard
 * would mean re-running a commit that has already happened, and the likeliest
 * outcome of that is a second celebration. So the honest implementation of "go
 * back and uncheck" is: cancel the bill for the extras, and finish.
 *
 * ⚖ REMOVING THE EXTRAS NEVER REMOVES THE CELEBRATION. The event and its free
 * shots are live either way. A payment screen must not be the thing that decides
 * whether somebody's birthday exists.
 *
 * 🔒 IT IS THE SAME RULE AS THE DASHBOARD'S OWN CANCEL, DELIBERATELY. Only the
 * pre-payment statuses may be cancelled, named positively — a settled bill is
 * not cancellable, because cancelling one is a refund request and this is not
 * the door for that. The row is scoped to the caller's own `user_id` AND read
 * back, because Supabase does not throw: an RLS refusal and a no-op update are
 * the same shape, so without the read-back a refused cancel would redirect to a
 * success message.
 */
export async function removeSetupExtras(formData: FormData) {
  const orderId = formData.get('order_id');
  const reference = formData.get('reference');
  const eventId = formData.get('event_id');
  if (typeof orderId !== 'string' || typeof reference !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: cancelled, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .in('status', CANCELLABLE_ORDER_STATUSES)
    .select('order_id');
  if (error) throw new Error(error.message);

  if (!cancelled || cancelled.length === 0) {
    // Already settled, already cancelled, or not theirs. Say so rather than
    // claiming it worked and sending them away.
    revalidatePath(`/pay/${reference}`);
    redirect(`/pay/${encodeURIComponent(reference)}?setup=1&error=${encodeURIComponent(
      'We could not remove those — the payment may already be recorded. Nothing was changed.',
    )}`);
  }

  revalidatePath(`/pay/${reference}`);
  // Straight into the celebration that already exists. Never back into the
  // wizard: the commit has happened and re-entering it risks a second event.
  redirect(typeof eventId === 'string' && eventId ? `/dashboard/${eventId}` : '/dashboard');
}
