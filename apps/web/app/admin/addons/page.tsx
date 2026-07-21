import { redirect } from 'next/navigation';

/**
 * Legacy /admin/addons → Catalog Studio redirect.
 *
 * Was the Add-ons tab's redirect stub (Money split · 2026-07-10). That tab was
 * REMOVED 2026-07-21 — it rendered only retired v1 `service_catalog` rows and
 * its purchase counts + eligibility dots were structurally dead joins. The stub
 * is kept so old bookmarks, the nav registry's stored route and any deep link
 * still land somewhere real instead of 404-ing; it now points at the Pricing
 * tab. The `?sku=` param it used to forward has no target anymore and is
 * dropped. The sibling `pricing-report/` route below this dir is UNCHANGED and
 * still live — it is the only export path for the legacy catalog, and its
 * download button now sits on the Pricing tab.
 */
export const dynamic = 'force-dynamic';

export default async function Redirect() {
  redirect('/admin/pricing');
}
