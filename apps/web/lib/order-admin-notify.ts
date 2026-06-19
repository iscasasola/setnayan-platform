import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Notification Foundation · Phase B (2026-06-19) — admin-side ORDER confirmation.
 *
 * When a couple submits an order (apply-then-pay), the row lands in the
 * /admin/payments reconciliation queue but, until now, no admin was notified —
 * the queue only refreshed if an admin happened to be looking at it. This
 * fans out an in-app notification to every admin/internal/team user so the
 * 24-hr reconciliation SLA actually starts on submit, not on the next time
 * someone opens the queue.
 *
 * Mirrors lib/token-purchase-notify.ts (notifyAdminsTokenPurchasePending) +
 * lib/subscription-purchase-notify.ts (notifyAdminsSubscriptionPending): the
 * same admin OR-filter (is_internal / is_team_member / account_type='admin'),
 * the same fail-soft try/catch, and — following those helpers' precedent — the
 * same `vendor_token_purchase_pending` type for the "money awaiting admin
 * confirmation" register. The TITLE carries the real meaning (a couple order,
 * not a token pack) so the tray reads correctly regardless of the type label;
 * the deep-link points at /admin/payments where the order sits.
 *
 * Best-effort: a failed notification never rolls back the order. We log and
 * continue.
 */

const peso = (n: number) =>
  '₱' + new Intl.NumberFormat('en-PH').format(Math.round(n));

export async function notifyAdminsOrderAwaitingReconciliation(args: {
  orderId: string;
  description: string;
  amountPhp: number;
  referenceCode: string;
}): Promise<void> {
  const { orderId, description, amountPhp, referenceCode } = args;
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    const label = description.trim().slice(0, 80) || 'A new order';

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'vendor_token_purchase_pending',
          title: `New order awaiting reconciliation · ${peso(amountPhp)}`,
          body: `${label} — ${peso(
            amountPhp,
          )} is awaiting payment confirmation. Reconcile once it lands. Ref ${referenceCode}.`,
          relatedUrl: '/admin/payments',
        }),
      ),
    );
  } catch (e) {
    console.error('[orders] admin awaiting-reconciliation notify failed:', e);
    void orderId;
  }
}
