import { redirect } from 'next/navigation';

/**
 * Legacy /admin/discount-codes (LIST view) → Studio Studio redirect (Studio
 * Studio slice 3).
 *
 * The voucher LIST now lives at /admin/studio?tab=discount-codes; its body was
 * re-homed byte-identical into
 * app/admin/studio/_surfaces/discount-codes-surface.tsx. This stub forwards the
 * incoming filter + success-banner params onto the studio route so the
 * disableDiscountCode / enableDiscountCode actions and the create/edit sub-route
 * redirects (which still return to /admin/discount-codes?…) surface their banner
 * on the Discount codes tab.
 *
 * ⚠ ONLY the list page is absorbed. The voucher CRUD sub-routes stay STANDALONE
 * and are NOT touched:
 *   • /admin/discount-codes/new         (+ new/loading.tsx)
 *   • /admin/discount-codes/[id]/edit   (+ [id]/edit/loading.tsx)
 *   • _components/ · actions.ts · loading.tsx
 * The re-homed surface links out to those routes; the sidebar item's
 * matchPrefix keeps Discount codes lit while on them.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminDiscountCodesRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'discount-codes');
  for (const key of ['filter', 'created', 'updated', 'disabled', 'enabled']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
