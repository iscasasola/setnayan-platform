import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CatalogueRow } from '@/lib/feature-pages/price';

/**
 * Both catalogues, every row, ONE read per request — for the /features hub
 * and the per-feature pages.
 *
 * ALL rows, active and not, for the same reason `/llms.txt` reads them all:
 * the Setnayan AI ladder's B/C/D rows are `is_active = false` by design. The
 * active filter is applied per feature in `resolveFeaturePrice`, where the one
 * exception is declared — never here, where it would be invisible.
 *
 * `null` = unreadable (no service key in a CI build, or a DB error). Every
 * price then renders "See pricing" and no Offer is emitted. Never a fallback
 * figure: see `lib/feature-pages/price.ts`.
 */
export const readFeatureCatalogue = cache(async (): Promise<readonly CatalogueRow[] | null> => {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }
  const [retail, supplier] = await Promise.all([
    admin.from('platform_retail_catalog_v2').select('service_code, retail_price_php, billing_period, is_active'),
    admin.from('vendor_billing_catalog').select('sku_code, price_php, offering_type, is_active'),
  ]);
  if (retail.error || supplier.error || !retail.data || !supplier.data) {
    if (retail.error) console.error('[supabase-error] features: platform_retail_catalog_v2', retail.error);
    if (supplier.error) console.error('[supabase-error] features: vendor_billing_catalog', supplier.error);
    return null;
  }
  return [
    ...retail.data.map((r) => ({
      catalogue: 'retail' as const,
      code: String(r.service_code),
      php: Number(r.retail_price_php),
      period: (r.billing_period as string | null) ?? null,
      active: Boolean(r.is_active),
    })),
    ...supplier.data.map((r) => ({
      catalogue: 'supplier' as const,
      code: String(r.sku_code),
      php: Number(r.price_php),
      period: (r.offering_type as string | null) ?? null,
      active: Boolean(r.is_active),
    })),
  ];
});
