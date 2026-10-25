import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { fetchMyPurchasesMeasured } from '@/lib/billing';
import { isStoreShellRequest } from '@/lib/request-platform';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BillingList } from './_components/billing-list';

export const metadata = { title: 'Billing & receipts' };

/**
 * BILLING & RECEIPTS — every purchase this login made, across all their events and their shop, newest first;
 * each opens its receipt (owner 2026-10-25: the account menu's "Billing & receipts" row). The read and its
 * honesty rules are `lib/billing.ts`; the list is `_components/billing-list.tsx`.
 *
 * A server component end to end — no client JS ships for this page. It reads on the person's own client under
 * the existing RLS (`orders_owner_read`, `receipts_owner_read`), scoped to `user_id` = them.
 */
export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/dashboard/billing'));
  const supabase = await createClient();
  const [vatRatePct, storeShell] = await Promise.all([getEffectiveVatRatePct(supabase), isStoreShellRequest()]);
  const read = await fetchMyPurchasesMeasured(supabase, user.id, vatRatePct);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead title="Billing & receipts" className="mb-6" />
      <BillingList read={read} storeShell={storeShell} />
    </div>
  );
}
