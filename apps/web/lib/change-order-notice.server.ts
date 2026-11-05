import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { ChangeOrderForNotice } from '@/lib/change-order-notice';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The change order a person JUST raised, read back off the table so the notice
 * can name the figure the ROW holds rather than the one the form sent.
 *
 * The raise actions insert without `RETURNING` (and are left that way — adding
 * one makes the insert depend on the SELECT policy too), so there is no id in
 * hand. The newest `proposed` row by THIS user on THIS booking is that row.
 *
 * `null` = could not be read (logged). The caller then sends the notice without
 * a figure; it never falls back to the typed amount.
 */
export async function readChangeOrderJustRaised(
  admin: Admin,
  args: { eventVendorId: string; raisedByUserId: string },
): Promise<ChangeOrderForNotice | null> {
  const { data, error } = await admin
    .from('vendor_change_orders')
    .select('title, delta_amount_php')
    .eq('event_vendor_id', args.eventVendorId)
    .eq('proposed_by_user_id', args.raisedByUserId)
    .eq('status', 'proposed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(
      `[change-order-notice] could not read back the change order just raised, event_vendor_id=${args.eventVendorId}:`,
      error.message,
    );
    return null;
  }
  return (data as ChangeOrderForNotice | null) ?? null;
}
