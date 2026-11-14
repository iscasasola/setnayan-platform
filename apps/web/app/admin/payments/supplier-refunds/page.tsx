import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { CLIENT_REFUND_SELECT } from '@/lib/client-refunds';
import {
  SUPPLIER_REFUNDS_ROW_LIMIT as ROW_LIMIT,
  SupplierRefundsView,
  type OurRefundRow,
  type SupplierRefundRow,
  type WaitingRefundRow,
} from './supplier-refunds-view';

export const metadata = { title: 'Refunds · Admin' };
export const dynamic = 'force-dynamic';

/**
 * 💸 REFUNDS SUPPLIERS RECORDED GIVING THEIR CLIENTS — read only (Supplier Build 2 leftover (a); DECISION_LOG 2026-11-08
 * "A RECORDED REFUND LOWERS PAID" listed "an admin list of refunds" as not yet built).
 *
 * A supplier records it on Clients › event › Payment › "Record a refund" (`event_vendor_refunds`, written only by
 * `vendor_record_client_refund`). NO MONEY MOVES through Setnayan — it is the supplier's own record of money they handed
 * back, so this page DECIDES NOTHING: no buttons, no write. Setnayan's OWN refunds of orders stay on /admin/payments.
 *
 * Read behind `requireAdmin()` on the service client, the console's pattern (the table's own RLS also grants console
 * admins SELECT — `event_vendor_refunds_admin_read`, `is_console_admin()`). A refused read is said, never "none yet";
 * the names beside each row are best-effort and fall back to plain words, never a blank.
 */
export default async function AdminSupplierRefundsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('event_vendor_refunds')
    // The one refund column list (`CLIENT_REFUND_SELECT`, dup-rule GUARD 2), plus the two this console reads beside it.
    .select(`${CLIENT_REFUND_SELECT}, vendor_profile_id, removed_at`)
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);
  if (error) logQueryError('AdminSupplierRefunds', error, {}, 'graceful_degrade');
  const rows = error ? null : ((data ?? []) as SupplierRefundRow[]);

  // Who gave it and on which event — two narrow reads, together. Best-effort: the amounts are the point.
  const shopIds = [...new Set((rows ?? []).map((r) => r.vendor_profile_id))];
  const eventIds = [...new Set((rows ?? []).map((r) => r.event_id).filter((e): e is string => Boolean(e)))];
  const [shopsRes, eventsRes] = await Promise.all([
    shopIds.length
      ? admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin.from('events').select('event_id, display_name').in('event_id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (shopsRes.error) logQueryError('AdminSupplierRefunds (shop names)', shopsRes.error);
  if (eventsRes.error) logQueryError('AdminSupplierRefunds (event names)', eventsRes.error);
  const shopName = new Map(
    ((shopsRes.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => [s.vendor_profile_id, s.business_name?.trim() || null]),
  );
  const eventName = new Map(
    ((eventsRes.data ?? []) as { event_id: string; display_name: string | null }[]).map((e) => [e.event_id, e.display_name?.trim() || null]),
  );

  // ── Money › Refunds (admin drawing 2026-11-13): our OWN refunds and the large ones waiting, beside the suppliers'. ──
  const [oursRes, waitingRes] = await Promise.all([
    admin
      .from('order_refunds')
      .select('refund_id, order_id, refund_amount_centavos, reason, refunded_at, proof_url, order:orders(public_id)')
      .order('refunded_at', { ascending: false })
      .limit(ROW_LIMIT),
    admin
      .from('admin_approval_requests')
      .select('approval_id, target_id, payload, rationale, expires_at')
      .eq('action_type', 'approve_large_refund')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50),
  ]);
  if (oursRes.error) logQueryError('AdminRefunds (ours)', oursRes.error);
  if (waitingRes.error) logQueryError('AdminRefunds (waiting)', waitingRes.error);
  const ours: OurRefundRow[] | null = oursRes.error
    ? null
    : ((oursRes.data ?? []) as unknown as Array<{
        refund_id: string;
        order_id: string;
        refund_amount_centavos: number;
        reason: string;
        refunded_at: string;
        proof_url: string | null;
        order: { public_id: string } | null;
      }>).map((r) => ({
        refundId: r.refund_id,
        orderId: r.order_id,
        orderPublicId: r.order?.public_id ?? null,
        amountPhp: Number(r.refund_amount_centavos) / 100,
        reason: r.reason,
        refundedAt: r.refunded_at,
        proofAttached: Boolean(r.proof_url),
      }));
  // The waiting rows name their order by its public id — one narrow read, best-effort (the amount is the point).
  const waitingRaw = waitingRes.error
    ? null
    : ((waitingRes.data ?? []) as Array<{
        approval_id: string;
        target_id: string | null;
        payload: { amount_php?: unknown } | null;
        rationale: string | null;
        expires_at: string | null;
      }>);
  const waitingOrderIds = [...new Set((waitingRaw ?? []).map((w) => w.target_id).filter((t): t is string => Boolean(t)))];
  const waitingOrders = waitingOrderIds.length
    ? await admin.from('orders').select('order_id, public_id').in('order_id', waitingOrderIds)
    : { data: [], error: null };
  if (waitingOrders.error) logQueryError('AdminRefunds (waiting order ids)', waitingOrders.error);
  const publicIdOf = new Map(
    ((waitingOrders.data ?? []) as { order_id: string; public_id: string }[]).map((o) => [o.order_id, o.public_id]),
  );
  const waiting: WaitingRefundRow[] | null = waitingRaw
    ? waitingRaw.map((w) => {
        const amount = Number(w.payload?.amount_php);
        return {
          approvalId: w.approval_id,
          orderPublicId: (w.target_id && publicIdOf.get(w.target_id)) || null,
          amountPhp: Number.isFinite(amount) && amount > 0 ? amount : null,
          reason: w.rationale,
          expiresAt: w.expires_at,
        };
      })
    : null;

  return (
    <SupplierRefundsView
      ours={ours}
      waiting={waiting}
      rows={rows}
      readError={error}
      shopName={shopName}
      eventName={eventName}
      namesUnread={Boolean(shopsRes.error || eventsRes.error)}
    />
  );
}
