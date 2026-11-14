'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setHelpMessageStatus } from '@/app/admin/help/actions';
import { resolveChatFlag } from '@/app/admin/chat-flags/actions';
import {
  applyCorrectionRequest,
  declineCorrectionRequest,
} from '@/app/admin/corrections/actions';
import {
  approveSubscription,
  rejectSubscription,
} from '@/app/admin/subscriptions/actions';
import {
  approvePaymentMethod,
  holdPaymentMethod,
} from '@/app/admin/payment-options/actions';
import { requireAdmin } from '@/lib/admin/require-admin';
import { safeNext } from '@/lib/safe-next';
import { pickedCorrectionReason, pickedReason, redirectRefusal, workBackHref } from '@/lib/admin/supplier-work';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentCore, requestPaymentResubmit } from '@/app/admin/payments/actions';
import { after } from 'next/server';
import { readPaymentLights } from '@/lib/admin/green-payments.server';
import { greenIds } from '@/lib/admin/green-payments';
import { overridePublishReview, rejectAppeal } from '@/app/admin/reviews/actions';
import { markPayoutPaidAction } from '@/app/admin/payouts/actions';
import { approveRequest, rejectRequest } from '@/app/admin/approvals/actions';

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

  const back = safeNext(formData.get('back'), '/admin/work');
  // ➕ "APPROVE ALL N GREEN" (admin slice 4, 2026-11-13) — an intent branch, not
  // a new exported action: the server-action budget sits at its ceiling
  // (scripts/lint-server-action-budget.mjs).
  if (formData.get('intent') === 'approve-green') {
    await approveGreenPayments(formData, userId, back);
    return;
  }
  // ➕ "ASK FOR A CLEARER PHOTO" (admin request cards, owner 2026-11-14) — a payment is never just declined. Runs the
  // desk's own `requestPaymentResubmit` (the couple is emailed and the upload form reopens); the notice is one of the
  // list's own words, never typed. An intent branch, not a new action (the server-action ceiling).
  if (formData.get('intent') === 'resubmit') {
    const notice = pickedReason('proof', formData.get('reason'));
    if (!notice) redirect(workBackHref(back, 'refused', 'Pick what the couple should fix.'));
    const fd = new FormData();
    fd.set('payment_id', String(formData.get('payment_id') ?? ''));
    fd.set('admin_resubmit_notice', notice);
    try {
      await requestPaymentResubmit(fd);
    } catch (e) {
      // A refusal ("already resolved", "not found") is shown on Work in the desk's own words — never a silent redraw.
      redirect(workBackHref(back, 'refused', e instanceof Error ? e.message : 'That could not be done.'));
    }
    revalidatePath('/admin/work');
    revalidatePath('/admin/payments');
    redirect(workBackHref(back, 'asked'));
  }

  const paymentId = formData.get('payment_id');
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
 * Approve every GREEN payment the admin confirmed on the Work row, in one press.
 *
 * SAFETY — the same model as the desk's `batchApprovePayments`, plus its
 * duplicate check:
 *   • the ids came from the confirm list the admin just read; none is trusted —
 *     each is RE-SORTED here with the same rule that drew it green
 *     (`readPaymentLights`: isDecisivePaymentMatch AND no counted duplicate);
 *     a row that is no longer green is skipped, never forced;
 *   • approval runs through `approvePaymentCore`, the single money path, with
 *     no `acknowledgeDuplicate` — a duplicate can never clear in a batch;
 *   • the receipt read is not consulted (an AI may not approve money);
 *   • one bad row never stops the rest, and every outcome is SAID on return.
 */
async function approveGreenPayments(formData: FormData, userId: string, back: string): Promise<never> {
  const sep = back.includes('?') ? '&' : '?';
  const ids = Array.from(
    new Set(
      formData.getAll('batch_payment_ids').filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  );
  if (ids.length === 0) redirect(`${back}${sep}settle=missing`);

  const admin = createAdminClient();
  const read = await readPaymentLights(admin, { paymentIds: ids });
  if (!read.ok) {
    redirect(
      `${back}${sep}settle=refused&why=${encodeURIComponent('Couldn’t re-check the payments, so none were approved. Try again.')}`,
    );
  }
  const stillGreen = new Set(greenIds(read.rows));

  let approved = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    if (!stillGreen.has(id)) {
      skipped += 1;
      continue;
    }
    try {
      const outcome = await approvePaymentCore({ admin, userId, paymentId: id, adminNotes: null, promoteOrder: true });
      if (outcome.ok) approved += 1;
      else failed += 1;
    } catch (e) {
      console.error('approveGreenPayments row failed (non-fatal to batch):', id, e);
      failed += 1;
    }
  }

  revalidatePath('/admin/work');
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/payouts');
  after(() => revalidatePath('/dashboard', 'layout'));

  const parts = [`${approved} approved`];
  if (skipped > 0) parts.push(`${skipped} no longer green — left for you to open`);
  if (failed > 0) parts.push(`${failed} could not be approved — open them one by one`);
  redirect(
    `${back}${sep}settle=${skipped > 0 || failed > 0 ? 'batch-partial' : 'batch'}&why=${encodeURIComponent(parts.join(' · '))}`,
  );
}


/* VERIFY moved to `app/admin/verify/actions.ts` → `settleVerificationFromWorkList` (admin supplier slice,
   2026-10-28): beside the decision engine it calls, so that engine could stop being an exported route (it had no
   admin gate of its own). It also gained "Needs a fix" with a reason from the list. */

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
  // ➕ "I DON'T" (admin request cards, owner 2026-11-14) — the page's own `rejectRequest`, with a reason from the list
  // the colleague reads. An intent branch, not a new action (the server-action ceiling).
  if (formData.get('intent') === 'reject') {
    const back = safeNext(formData.get('back'), '/admin/work');
    const reason = pickedReason('approval', formData.get('reason'));
    if (!reason) redirect(workBackHref(back, 'refused', 'Pick the reason your colleague will see.'));
    const fd = new FormData();
    fd.set('approval_id', String(formData.get('approval_id') ?? ''));
    fd.set('reason', reason);
    try {
      await rejectRequest(fd);
    } catch (e) {
      redirect(workBackHref(back, 'refused', e instanceof Error ? e.message : 'That could not be done.'));
    }
    revalidatePath('/admin/work');
    revalidatePath('/admin/approvals');
    redirect(workBackHref(back, 'declined-request'));
  }
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

  const back = safeNext(formData.get('back'), '/admin/work');

  // ➕ ADMIN REQUEST CARDS (owner 2026-11-14): "Publish" and "Keep it held" each take a reason from a list, never
  // typed. Keep-it-held is the page's own `rejectAppeal` — an intent branch, not a new action (the ceiling).
  const keep = formData.get('intent') === 'keep';
  const picked = pickedReason(keep ? 'held' : 'publish', formData.get('reason'));
  if (!picked) redirect(workBackHref(back, 'refused', 'Pick the reason for the record.'));
  if (keep) {
    await settleViaRedirectingAction(() => rejectAppeal(formData), ['/admin/work', '/admin/reviews'], back, 'kept');
    return;
  }

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

/**
 * Settle a help ticket FROM THE LIST.
 *
 * 🔑 NO REDIRECT TO SWALLOW. `setHelpMessageStatus` does not redirect — unlike
 * the review and payout paths, whose page actions end in one — so this needs no
 * catch-the-digest dance. A real failure ("Invalid status") is a plain Error and
 * travels untouched: a refusal can never read as success.
 */
export async function settleHelpFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  const back = safeNext(formData.get('back'), '/admin/work');
  await setHelpMessageStatus(formData);
  revalidatePath('/admin/work');
  revalidatePath('/admin/help');
  redirect(`${back}${back.includes('?') ? '&' : '?'}settle=saved`);
}

/**
 * Resolve a chat contact-flag FROM THE LIST.
 *
 * ⚠ The drawer deliberately shows the categories and the hit count, never the
 * message body — the page's own kept sentence promises a reviewer is not
 * reading somebody's private conversation, and settling from a list must not
 * quietly break that promise.
 */
export async function settleChatFlagFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  const back = safeNext(formData.get('back'), '/admin/work');
  await resolveChatFlag(formData);
  revalidatePath('/admin/work');
  revalidatePath('/admin/chat-flags');
  redirect(`${back}${back.includes('?') ? '&' : '?'}settle=saved`);
}

/** Shared: run a page action that ends in `redirect()` without the page jump. */
async function settleViaRedirectingAction(
  run: () => Promise<void>,
  paths: string[],
  back: string,
  outcome: string,
): Promise<void> {
  // Next signals a redirect by THROWING. 🔑 ONLY a redirect is swallowed — a
  // real failure ("Reason is required") is a plain Error with no digest and is
  // rethrown untouched, so a refusal can never be mistaken for success.
  try {
    await run();
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) throw e;
    // 🚨 A PAGE ACTION ALSO REFUSES BY REDIRECTING — `fail()` in corrections sends `?error=<why>` (that address is
    // taken; that shop no longer exists). Swallowing EVERY redirect announced those refusals as "Approved" while
    // nothing changed (found 2026-10-28, admin supplier slice). A redirect that carries `error=` is a refusal: it
    // goes back to the SAME list with the page's own words.
    const refusal = redirectRefusal(digest);
    if (refusal !== null) redirect(workBackHref(back, 'refused', refusal));
  }
  for (const p of paths) revalidatePath(p);
  redirect(workBackHref(back, outcome));
}

const backOf = (fd: FormData) =>
  safeNext(fd.get('back'), '/admin/work');

/** Apply or decline a shop's request to fix a locked detail, from the list. */
export async function settleCorrectionFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  const decision = formData.get('decision');
  // The action is chosen by the admin's answer — never defaulted. An unknown
  // value must refuse rather than silently pick the kinder one.
  if (decision !== 'apply' && decision !== 'decline') {
    throw new Error('Choose apply or decline.');
  }
  // 🔑 A DECLINE WITHOUT A REASON FROM THE LIST IS REFUSED (admin supplier slice, owner 2026-10-28: "Decline with a
  // reason"). The shop is told why; a bare "declined" tells them nothing they can act on. The admin stays on Work.
  if (decision === 'decline' && !pickedCorrectionReason(formData.get('reason'))) {
    redirect(workBackHref(backOf(formData), 'refused', 'Pick the reason the shop will see.'));
  }
  await settleViaRedirectingAction(
    () =>
      decision === 'apply'
        ? applyCorrectionRequest(formData)
        : declineCorrectionRequest(formData),
    ['/admin/work', '/admin/corrections'],
    backOf(formData),
    decision === 'apply' ? 'approved' : 'declined',
  );
}

/** Approve or reject a vendor plan purchase, from the list. */
export async function settleSubscriptionFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  const decision = formData.get('decision');
  if (decision !== 'approve' && decision !== 'reject') {
    throw new Error('Choose approve or reject.');
  }
  // ➕ A declined plan payment tells the shop WHY, in the list's own words (admin request cards, owner 2026-11-14) —
  // without one the page action would send its default "Payment not received", which may not be true.
  if (decision === 'reject') {
    const reason = pickedReason('plan', formData.get('reason'));
    if (!reason) redirect(workBackHref(backOf(formData), 'refused', 'Pick the reason the shop will see.'));
    formData.set('reason', reason);
  }
  await settleViaRedirectingAction(
    () =>
      decision === 'approve' ? approveSubscription(formData) : rejectSubscription(formData),
    ['/admin/work', '/admin/subscriptions'],
    backOf(formData),
    'saved',
  );
}

/**
 * Approve or hold a payout destination, from the list.
 *
 * ⚠ REMOVE IS DELIBERATELY NOT REACHABLE HERE. It is irreversible and belongs
 * on the page with its own confirmation, not on a list built for speed.
 */
export async function settlePaymentOptionFromWorkList(formData: FormData): Promise<void> {
  await requireAdmin();
  const decision = formData.get('decision');
  if (decision !== 'approve' && decision !== 'hold') {
    throw new Error('Choose approve or hold.');
  }
  await settleViaRedirectingAction(
    () =>
      decision === 'approve' ? approvePaymentMethod(formData) : holdPaymentMethod(formData),
    ['/admin/work', '/admin/payment-options'],
    backOf(formData),
    'saved',
  );
}
