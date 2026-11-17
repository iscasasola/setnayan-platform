'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { paymentRowFor } from '@/lib/order-mint-identity';
import { parseClientRef, orderPaymentProofPolicy } from '@/lib/r2-client-ref';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { notifyAdminsPaymentProofSubmitted } from '@/lib/order-admin-notify';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { CANCELLABLE_ORDER_STATUSES } from '@/lib/event-deletion-gate';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { receivingAccounts } from '@/lib/payment-channels';
import { getMaxPaymentPhp } from '@/lib/max-payment.server';
import { paymentOverCeilingMessage, paymentWithinCeiling } from '@/lib/payment-ceiling';
import { ON_PHONE_READER_NAME } from '@/lib/on-phone-reader';

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

  // ── THE MOST ONE PAYMENT TO SETNAYAN MAY BE (owner 2026-11-17) ────────────
  // No single payment made TO SETNAYAN may exceed `platform_settings.max_payment_php`
  // (₱100,000; exactly ₱100,000 is allowed). The page already shows no code for
  // such a bill — this is the server half, so a stale tab or a hand-made post is
  // refused too. Read the admin setting, never a typed number.
  const maxPaymentPhp = await getMaxPaymentPhp(supabase);
  if (!paymentWithinCeiling(payable.amountPhp, maxPaymentPhp)) {
    back(reference, 'error', paymentOverCeilingMessage(maxPaymentPhp));
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

  // ⛔ NOTHING IS TYPED ANY MORE (owner 2026-11-17: "the don't have to type").
  // The field is gone from the page; a value still posted by a tab opened before
  // it went is kept, because a reference somebody gave us is more to match on.
  const bankReference = normaliseReference(formData.get('reference_last6'));

  // ── A CLAIM WITH NOTHING IN IT IS WORSE THAN NO CLAIM ──────────────────────
  // Both fields were optional on the first cut, and the submit button sits
  // BELOW them: one stray tap wrote a row with no screenshot and no reference,
  // which is unreconcilable — and, because the page hides the form once
  // anything is logged, it also took away the only way to send the real proof.
  // Refuse instead, and say which half is missing.
  //
  // ⚖ THE PICTURE IS THE CLAIM NOW (owner 2026-11-17). With nothing typed, the
  // receipt screenshot is what the admin matches — so it is required on EVERY
  // lane, booking fees included. That supersedes the 2026-08-06 "a booking fee
  // must carry a typed reference": the reference is READ off the picture below
  // and stored on the payment, which is what that ruling wanted to have.
  if (!screenshotUrl) {
    back(
      reference,
      'error',
      'Upload the screenshot of your payment receipt — we read the reference, amount, date and time off it to find your payment.',
    );
  }

  // ⚠ LOWERCASE, AND IT IS LOAD-BEARING. `/admin/settings/payment-methods`
  // measures how much room the receiving account has left this month by
  // matching `channel === 'gcash'` / `'bdo'` EXACTLY; anything else scores the
  // payment as ₱0 against the cap, so the meter reads clear while the account
  // fills up. 'GCash'/'BDO' looked nicer and was silently unreadable.
  //
  // 🔑 AND IT IS AN ACCOUNT ID FROM THE LIST (owner 2026-10-01: the receiving
  // accounts are a list now). Any account Setnayan has — open or since switched
  // off, because somebody may have paid it before the switch — is recorded by
  // its id; anything else is the generic 'bank_transfer', never a free string.
  const channelRaw = String(formData.get('channel') ?? '').trim();
  const channel = receivingAccounts(await fetchPlatformSettings(supabase)).some(
    (a) => a.id === channelRaw,
  )
    ? channelRaw
    : 'bank_transfer';

  const idempotencyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyRaw === 'string' && idempotencyRaw.trim().length > 0
      ? idempotencyRaw.trim().slice(0, 64)
      : null;

  // ── WE READ THEIR PICTURE BEFORE WE ACCEPT IT ─────────────────────────────
  // Owner, 2026-08-28: *"can we assign an AI to verify if that last 6 digits do
  // exist on the photo?"* and then *"if the reference code did not match, please
  // type again or upload a cleaner photo."*
  //
  // 🔁 READ ON THEIR PHONE NOW, NOT BY AN OUTSIDE AI (owner 17 Nov 2026: "can
  // we create our own in app reader so we do not need ai to run?" → "Yes, swap
  // it in"). The in-app reader (lib/on-phone-reader.ts, Tesseract) read the
  // picture on the payer's phone and posted only the TEXT and the four fields
  // they confirmed; the same pure parser decides what that text says here.
  // Nothing is fetched from R2 and nothing is sent anywhere to be read.
  //
  // ⚠ IT MUST NEVER COST SOMEBODY A PAYMENT THEY HAVE ALREADY SENT. A reader
  // that never ran (no JavaScript, or sent before it finished) is NULL, and a
  // reader that failed is a 'failed' read — both fall through and accept. Only
  // a DEFINITE no on a reference typed on an old tab sends them back, ONCE.
  const { phoneReceiptRead, loggedFromPhone } = await import('@/lib/payment-receipt-read');
  const receiptRead = screenshotUrl
    ? phoneReceiptRead({
        form: formData,
        typed: bankReference,
        expectedPhp: payable.amountPhp,
        channel,
      })
    : null;
  const logged = loggedFromPhone(formData, receiptRead);

  // 🔑 WE ASK ONCE, THEN WE GET OUT OF THE WAY. The second submit is accepted
  // whatever the picture says, and the disagreement travels to the admin's queue
  // instead. A person who really paid must always have a way through — and they
  // are the ones who would be trapped, because somebody with a genuinely wrong
  // receipt simply gives up, while somebody with a real payment and an unlucky
  // reader would keep trying forever. The marker is a query parameter and is
  // therefore trivially forgeable, which is correct: forging it means "yes, I am
  // sure", which is exactly the answer we are willing to take.
  const askedAlready = formData.get('rechecked') === '1';
  if (!askedAlready) {
    const { shouldAskBuyerToFix } = await import('@/lib/payment-receipt-read');
    if (shouldAskBuyerToFix(receiptRead)) {
      // ⚠ THE SENTENCE HAS TO SAY "ATTACH IT AGAIN", AND THAT IS NOT PADDING.
      // This redirect re-renders an empty form: the picture they picked lives in
      // the browser's own file input, which does not survive a navigation. A
      // message that only said "check the digits" would get us a corrected
      // reference WITH NO SCREENSHOT — we would have traded their proof for a
      // typo fix, and neither of us would notice until an admin opened a
      // payment with nothing to look at.
      // ⚠ `setup` IS CARRIED BACK, and forgetting it is a silent downgrade:
      // this screen renders a different set of doors during onboarding, so a
      // recheck that dropped it would quietly take away the "remove these
      // extras" choice and the set-up discount framing on the way past.
      const askMsg =
        'We could not find that reference number on your picture. Please check the digits and attach your screenshot again. If you are sure it is right, just send it again.';
      redirect(
        `/pay/${encodeURIComponent(reference)}?recheck=${encodeURIComponent(askMsg)}` +
          (formData.get('setup') === '1' ? '&setup=1' : ''),
      );
    }
  }

  const moneyWriter = createMoneyWriterClient();
  // `.select()` so the new row's id comes back — the receipt read below needs
  // it. ⚠ It does NOT change the duplicate behaviour: on the 23505 retry the
  // insert still fails, `data` is null, and the branch below handles it.
  const { data: inserted, error } = await moneyWriter
    .from('payments')
    .insert(
      paymentRowFor(
        { userId: user.id, verifiedOrderId: payable.orderId },
        {
          // The ORDER's amount, never the form's — see the header.
          amount_php: payable.amountPhp,
          channel,
          // 🔑 WHAT WE READ IS LOGGED FOR THE ADMIN TO MATCH (owner 2026-11-17:
          // "we detect after they sent it and log the data"). A typed value (an
          // old tab) wins; else the reference read off the receipt; else nothing.
          // ⚠ ADVISORY: these are lookup keys beside the admin's own bank
          // record. Nothing here sets a status — `isDecisivePaymentMatch` and
          // the admin's approval stay the only way money is let through.
          // A field the payer corrected wins over what the reader read.
          reference_number: bankReference ?? logged.reference ?? null,
          screenshot_url: screenshotUrl,
          // The date on the receipt (as read, or as the payer corrected it), else today.
          paid_at: logged.paidOn ?? new Date().toISOString().slice(0, 10),
          client_idempotency_key: idempotencyKey,
        },
      ),
    )
    .select('payment_id')
    .maybeSingle();

  // 23505 on (order_id, client_idempotency_key) means their first submit landed
  // and they pressed again — that is success, not a failure.
  const duplicateRetry = (error as { code?: string } | null)?.code === '23505';
  if (error && !duplicateRetry) {
    back(reference, 'error', "We couldn't record that just now. Please try again.");
  }

  // 🧾 RW-46/47 (walk 13 Nov 2026): THE BILL'S PLACEHOLDER GIVES WAY TO THE REAL PAYMENT. Minting the bill wrote a
  // pending row with no reference and no screenshot (so the bill reached /admin/payments — `paymentWasLogged`). Now a
  // real one is logged, the placeholder only doubled the admin's queue ("NO REFERENCE GIVEN" beside the real row) and
  // stayed pending after the real one was approved. It is removed — scoped to THIS order, to pending rows carrying
  // neither a reference nor a screenshot, never the row just written. A failed removal is logged, never fatal: the
  // queue also hides a placeholder beside a logged row.
  if (!error) {
    const newId = (inserted as { payment_id: string } | null)?.payment_id ?? null;
    let sweep = moneyWriter
      .from('payments')
      .delete()
      .eq('order_id', payable.orderId)
      .eq('status', 'pending')
      .is('reference_number', null)
      .is('screenshot_url', null);
    if (newId) sweep = sweep.neq('payment_id', newId);
    const { error: sweepError } = await sweep;
    if (sweepError) console.error('[pay] placeholder payment row was not removed', { orderId: payable.orderId, sweepError });
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

  // File what we read against the row we just made, so the admin sees it too.
  // ⚠ After the response — the buyer has waited for the read once already and
  // must not also wait for the note about it.
  const newPaymentId = (inserted as { payment_id: string } | null)?.payment_id ?? null;
  if (!error && newPaymentId && receiptRead) {
    after(async () => {
      const { recordPaymentReceiptRead } = await import('@/lib/payment-receipt-read.server');
      await recordPaymentReceiptRead(moneyWriter, newPaymentId, { ...receiptRead, model: ON_PHONE_READER_NAME });
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
