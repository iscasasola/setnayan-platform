import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { fetchMyPurchasesMeasured } from '@/lib/billing';
import { resolveActiveShop } from '@/lib/active-shop';
import { billingShowOf } from '@/lib/billing-sections';
import { fetchSupplierBillingMeasured } from '@/lib/supplier-billing.server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BillingList } from './_components/billing-list';
import { SupplierBillingSections } from './_components/supplier-billing-sections';

export const metadata = { title: 'Billing & receipts' };

/**
 * BILLING & RECEIPTS — every purchase this login made, across all their events and their shop, newest first;
 * each opens its receipt (owner 2026-10-25: the account menu's "Billing & receipts" row). The read and its
 * honesty rules are `lib/billing.ts`; the list is `_components/billing-list.tsx`.
 *
 * A SUPPLIER (a login standing in a shop — `resolveActiveShop`) also gets the shop's own lists — Gifts given ·
 * Payments received · Refunds · Rewards earned — under ONE dropdown (Build 2 #39, prototype v118). Their reads are
 * `lib/supplier-billing.server.ts`; the sections `_components/supplier-billing-sections.tsx`. A login with no shop
 * sees the shipped page, unchanged.
 *
 * 📡 REQUESTS. Couple: 3–4, in up to two round trips (VAT rate · orders · receipts, then event names when there are
 * event orders) — unchanged. Supplier: the same, plus the shop resolve (2, React-cached with the layout's) and the
 * shop's lists (7, ONE `Promise.all`), run beside the purchases read — two round trips end to end, never one per list.
 *
 * Reads on the person's own client under the existing RLS (`orders_owner_read`, `receipts_owner_read`), scoped to
 * `user_id` = them; the shop's lists are read and scoped as `lib/supplier-billing.server.ts` says.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/dashboard/billing'));
  const supabase = await createClient();
  const [vatRatePct, storeShell, sp] = await Promise.all([getEffectiveVatRatePct(supabase), isStoreShellRequest(), searchParams]);
  const [read, supplier] = await Promise.all([
    fetchMyPurchasesMeasured(supabase, user.id, vatRatePct),
    // A refused shop read (it throws) is a login we cannot place in a shop: the shipped page, never a wrong shop's lists.
    resolveActiveShop(supabase, user.id)
      .catch(() => null)
      .then((shop) => (shop ? fetchSupplierBillingMeasured(supabase, shop.vendorProfileId) : null)),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead title="Billing & receipts" className="mb-6" />
      {supplier ? (
        <SupplierBillingSections purchases={read} storeShell={storeShell} supplier={supplier} initial={billingShowOf(sp.show)} />
      ) : (
        <BillingList read={read} storeShell={storeShell} />
      )}
    </div>
  );
}
