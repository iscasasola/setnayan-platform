'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CANCELLABLE_ORDER_STATUSES } from '@/lib/event-deletion-gate';
import { refuseLimitedHelper } from '@/lib/host-gate';

/**
 * ⛔ `createOrder` — DELETED 2026-07-26 (SEC-4).
 *
 * It read the charge straight off the submitted form:
 *
 *     const requestedRaw = formData.get('requested_total_php');
 *     …
 *     requested_total_php: Math.round(Number(requestedRaw) * 100) / 100
 *
 * No catalog resolve, no `resolveServiceSellability` gate, no floor — so an
 * authenticated member of any event could mint an order for ANY `service_key`
 * at ANY amount (₱1 against a ₱2,999 SKU), pay that amount for real, and hand
 * the admin reconciliation queue a receipt that matches. The correct path,
 * `submitOrderAction` (../checkout/actions.ts), re-resolves the amount
 * server-side from `platform_retail_catalog_v2` and REJECTS a retired SKU
 * BEFORE any charge resolver runs. That order matters: a null resolve falls
 * back to the client price, so filtering inside the resolver would downgrade
 * "charged its real price" into "charged whatever the browser sent".
 *
 * WHY DELETED RATHER THAN REPAIRED — it had zero callers. Its UI entry point
 * `/orders/new` has been a bare `redirect()` since 2026-05-29, the
 * `SelfPurchaseConfirm` component that fed it `self_purchase_action` was
 * orphaned by the same change (deleted here too), and nothing in app / lib /
 * api / tests / scripts imported it. But a `'use server'` export stays
 * POST-able by its action id whether or not any UI references it — this module
 * reaches the client graph through `cancelOrder` — so "no UI"
 * was never "no attack surface". Deleting the export deletes the surface.
 *
 * IF SELF-COMP COMES BACK (spec § 3.1a · vendor "comp for myself"), re-add it
 * on the `submitOrderAction` path, never here. The authority rule survives —
 * pure and tested — in `lib/self-comp-authority.ts` (`decideSelfCompAuthority`:
 * vendor owner/admin AND couple member of the target event), as does the
 * per-quarter `enforce_vendor_self_comp_quota` trigger on `comp_grants`. What
 * must not come back is a SECOND pricing rule.
 *
 * NOT AFFECTED — `app/admin/custom-plans/actions.ts` mints bespoke-amount
 * orders on purpose: it is `assertAdmin()`-gated and writes through
 * service-role. "An admin sets a negotiated price" is a different thing from
 * "the browser sets its own price"; only the second one is this bug.
 *
 * Enforced by `lib/order-price-authority.test.ts`.
 */

export async function cancelOrder(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  const orderId = formData.get('order_id');
  if (typeof eventId !== 'string' || typeof orderId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /*
    🚨 A PAID BILL IS NOT CANCELLABLE — CANCELLING ONE IS A REFUND REQUEST.
    This update used to carry no condition on the status it was LEAVING, so a
    settled order could be walked to 'cancelled' by its own buyer. The RLS guard
    behind it agrees and cannot help: `orders_update_status_guard` is RESTRICTIVE
    with `USING (user_id = auth.uid())` and a WITH CHECK that constrains only the
    NEW value, which admits 'cancelled'. The old status is never consulted.

    Two harms, and the second is the one that bites:
      · the money record for a service somebody paid for silently reads as though
        it was never bought, and
      · until 2026-08-21 it was the way PAST the event-delete gate — cancel the
        bill, then delete the celebration it belonged to. That gate now reads
        payment and receipt rows instead of the status precisely because this
        was reachable, but the underlying action was still wrong.

    🔑 THE PRE-PAYMENT STATES ARE THE ONLY CANCELLABLE ONES, and they are named
    positively rather than by excluding 'paid': a deny-list is a bill you have to
    keep paying, and this enum has eight values. Anything not listed — including
    a value added later — fails closed.

    ⚠ `.select()` AND A ROW-COUNT CHECK. Supabase does not throw; an RLS refusal
    and a no-op update are the same shape (zero rows, no error). Without reading
    back, a refused cancel would redirect to "cancelled=1" and the person would
    be told it worked.
  */
  const { data: cancelled, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .in('status', CANCELLABLE_ORDER_STATUSES)
    .select('order_id');
  if (error) throw new Error(error.message);

  if (!cancelled || cancelled.length === 0) {
    // Nothing was cancelled: the order is already settled, already cancelled, or
    // is not this person's. Say so rather than claiming success.
    revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
    redirect(`/dashboard/${eventId}/orders/${orderId}?cancel=refused`);
  }

  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  redirect(`/dashboard/${eventId}/orders?cancelled=1`);
}

/**
 * ⛔ `logPayment` — DELETED 2026-10-26 (reload audit §3c). It had no caller: every purchase path logs its payment on
 * `/pay/<reference>` (`app/pay/[reference]/actions.ts` › `submitPaymentProof`), which carries the admin alert
 * (`notifyAdminsPaymentProofSubmitted`, held by `lib/you-are-told-when-you-are-paid.test.ts`). A `'use server'` export
 * stays POST-able by its action id whether or not any UI calls it, so the dead door went with its UI.
 */
