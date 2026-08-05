'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentCore } from '@/app/admin/payments/actions';
import { overridePublishReview } from '@/app/admin/reviews/actions';
import { markPayoutPaidAction } from '@/app/admin/payouts/actions';
import { applyApplicationDecision } from '@/app/admin/verify/actions';
import { approveRequest } from '@/app/admin/approvals/actions';

/**
 * Settle a queue item FROM THE WORK LIST, without leaving it.
 *
 * Owner, 2026-08-03: *"a faster way to respond to quick actions needed instead
 * of them making jump to a new page."*
 *
 * 🔑 WHY THIS EXISTS RATHER THAN REUSING `approvePayment`. That action ends in
 * `redirect('/admin/payments?…')` — correct for the payments page, and exactly
 * the page-jump the owner asked to remove when the same decision is taken from
 * the list. It already had a non-redirecting half (`approvePaymentCore`, which
 * RETURNS its outcome so the batch path can loop); this calls that half and
 * revalidates in place. **The money logic is not duplicated** — one core, two
 * entry points, so the list can never drift from the page.
 *
 * ⚠ ONLY "FACT" QUEUES REACH HERE. A payment either arrived or it did not, so
 * one click is honest. Judgement queues (disputes, fraud, user reports, erasure
 * requests) deliberately have no action here at all — see JUDGEMENT_QUEUES in
 * lib/admin/queue-peek.ts. And a queue that needs DETAILS (payouts wants the
 * method and the reference of a transfer the admin made by hand) is not a
 * button either; it gets a form, which is a later slice.
 *
 * requireAdmin() runs here and again inside the core — the layout is not an
 * auth boundary in front of a service-role client, and the core is now exported
 * so it must not assume its caller checked.
 */
/**
 * Returns void because a `<form action=…>` must. A refusal is surfaced by
 * bouncing back to the work list with the reason in the query string — the
 * admin stays exactly where they were, with the row still there and an
 * explanation, rather than being thrown onto another page to find out why.
 */
export async function approvePaymentFromWorkList(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();

  const paymentId = formData.get('payment_id');
  const back = typeof formData.get('back') === 'string' ? String(formData.get('back')) : '/admin/work';
  if (typeof paymentId !== 'string' || paymentId.length === 0) {
    redirect(`${back}${back.includes('?') ? '&' : '?'}settle=missing`);
  }

  const outcome = await approvePaymentCore({
    admin: createAdminClient(),
    userId,
    paymentId,
    // No notes and no order promotion from the list: both are deliberate
    // decisions that belong on the payments page, where the admin can see the
    // whole order. The list settles the simple case and nothing more.
    adminNotes: null,
    // 🚨 THIS WAS `false` AND THAT WAS A TRAP (fixed 2026-08-05 after an audit).
    // The reasoning was "promotion is a deliberate decision that belongs on the
    // payments page" — which assumed the admin could go and finish it there.
    // THEY CANNOT: the payments page only offers Approve while the payment is
    // still `pending`, and this call has already moved it to `matched`. So the
    // button reported success, the row vanished, the order never became paid,
    // no receipt went out, the SKU never switched on, and NO SCREEN IN THE
    // ADMIN COULD RESCUE IT. A couple would be told their payment was matched
    // and then nothing would happen.
    //
    // 🔑 One click is only honest if it finishes the thing it claims to. The
    // shortfall guard inside the core is what makes `true` safe: if the matched
    // payments do not cover the gross, it returns { ok: false, shortfall } and
    // provisions NOTHING — and the refusal below bounces the admin back to this
    // list with the reason, instead of half-completing in silence.
    promoteOrder: true,
  });

  if (!outcome.ok) {
    // A shortfall is the real "this is not the simple case" signal — the amount
    // does not cover the order. Bounce back to the SAME list view with the
    // reason, so the admin knows to open the payment rather than wondering why
    // the row did not clear.
    redirect(
      `${back}${back.includes('?') ? '&' : '?'}settle=shortfall&why=${encodeURIComponent(outcome.message)}`,
    );
  }

  // Refresh the list and the surfaces that count it, so the row disappears and
  // every badge agrees. Cheap: both are already dynamic.
  revalidatePath('/admin/work');
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
}


/**
 * VERIFY — stamp a vendor as verified, from the list.
 *
 * ⚠ THIS IS THE BADGE COUPLES TRUST, so it reuses the SAME decision engine the
 * verify page uses (`applyApplicationDecision`) rather than writing a status.
 * That engine is what also sets `verified`, `last_verified_at` and moves the
 * documents — a hand-written UPDATE here would set the flag and skip the rest.
 *
 * `approveApplication` (the page's action) redirects on success; this calls the
 * engine directly and revalidates, so the admin stays on the list. One engine,
 * two entry points.
 *
 * No `reason` from the list: an approval needs none, and the page is where a
 * rejection with its reason belongs.
 */
export async function approveVerificationFromWorkList(formData: FormData): Promise<void> {
  // The verify module carries its OWN `AdminUser = { user_id }`, while the
  // shared requireAdmin() returns `{ userId }`. Two names for one thing; the
  // typechecker caught the mismatch rather than a `user_id: undefined` reaching
  // an audit column.
  const { userId } = await requireAdmin();
  const applicationId = formData.get('application_id');
  const back = typeof formData.get('back') === 'string' ? String(formData.get('back')) : '/admin/work';
  if (typeof applicationId !== 'string' || applicationId.length === 0) {
    redirect(`${back}${back.includes('?') ? '&' : '?'}settle=missing`);
  }

  const result = await applyApplicationDecision({
    actor: { user_id: userId },
    applicationId,
    decision: 'approved',
    reason: null,
  });

  if (!result.ok) {
    redirect(
      `${back}${back.includes('?') ? '&' : '?'}settle=refused&why=${encodeURIComponent(result.error)}`,
    );
  }

  revalidatePath('/admin/work');
  revalidatePath('/admin');
  revalidatePath('/admin/verify');
  revalidatePath('/admin/vendors');
  revalidatePath('/explore');
}

/**
 * APPROVALS — co-sign a colleague's request, from the list.
 *
 * 🔑 THE LABEL IS "I AGREE", NOT "APPROVE". This is the SECOND signature on a
 * decision someone else already made; the admin is agreeing to their colleague's
 * call, not making one. A button saying "Approve" invites reading it as the
 * whole decision, which is exactly what a two-admin gate exists to prevent.
 *
 * Delegates straight to the page's own `approveRequest` — it does NOT redirect
 * (it only revalidates), so unlike payments and verify there is no core to
 * extract. Its claim-then-decide guard already handles two admins racing.
 */
export async function agreeToRequestFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  await approveRequest(formData);
  revalidatePath('/admin/work');
  revalidatePath('/admin/approvals');
}

/**
 * REVIEWS — publish over a contested review, with the reason it requires.
 *
 * 🔑 NOT A ONE-CLICK BUTTON, AND THE CODE IS WHY. `overridePublishReview` throws
 * *"Override reason is required (1–4000 chars)"*. Publishing over a couple's
 * review moves a vendor's public star rating and is on the record — the record
 * needs the why. A one-click version would have to invent one.
 *
 * Delegates to the page's own action, reason and all, so the two entry points
 * cannot diverge on what an override means.
 */
export async function publishReviewFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();

  const back =
    typeof formData.get('back') === 'string' ? String(formData.get('back')) : '/admin/work';

  // The page's own action ends in redirect('/admin/reviews?override=1') — right
  // for that page, and the exact page-jump the owner asked to remove when the
  // same decision is taken from the list. Next signals a redirect by THROWING,
  // so a success arrives here as a thrown value carrying a NEXT_REDIRECT digest.
  //
  // 🔑 ONLY A REDIRECT IS SWALLOWED. A real failure — "Override reason is
  // required", "not allowed for owner_self" — is a plain Error with no digest
  // and is rethrown untouched, so a refusal can never be mistaken for success.
  try {
    await overridePublishReview(formData);
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) throw e;
    revalidatePath('/admin/work');
    revalidatePath('/admin/reviews');
    redirect(`${back}${back.includes('?') ? '&' : '?'}settle=published`);
  }

  revalidatePath('/admin/work');
  revalidatePath('/admin/reviews');
  redirect(`${back}${back.includes('?') ? '&' : '?'}settle=published`);
}

/**
 * PAYOUTS — record a transfer the admin already made by hand.
 *
 * 🔑 ALSO NOT A BUTTON. `markPayoutPaidAction` needs the METHOD and the
 * REFERENCE; without them the record cannot be matched to a bank statement
 * later, and an unmatchable money record is worse than no record. The drawer
 * renders a method picker and a reference field, still without leaving the list.
 *
 * ⚠ NOTHING HERE MOVES MONEY. The transfer already happened outside Setnayan;
 * this only writes down that it did.
 */
export async function recordPayoutFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  await markPayoutPaidAction(formData);
  revalidatePath('/admin/work');
}
