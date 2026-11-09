import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { CLIENT_REFUND_SELECT } from '@/lib/client-refunds';
import { SUPPLIER_REFUNDS_ROW_LIMIT as ROW_LIMIT, SupplierRefundsView, type SupplierRefundRow } from './supplier-refunds-view';

export const metadata = { title: 'Supplier refunds · Admin' };
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

  return (
    <SupplierRefundsView
      rows={rows}
      readError={error}
      shopName={shopName}
      eventName={eventName}
      namesUnread={Boolean(shopsRes.error || eventsRes.error)}
    />
  );
}
