/**
 * admin-row-index.ts — the things INSIDE a page, so a search can land on a row.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The owner's first sentence was *"take me to the pricing for papic services"*,
 * and the drawn prototype answers it by landing on the Papic ROWS — not on the
 * top of a long catalogue. The scanned route map indexes PAGES; a page's rows
 * come from the database, so they cannot be scanned from the tree.
 *
 * Measured before building: every Papic price is a row in
 * `platform_retail_catalog_v2` (22 of them, 5 on sale), and the word "papic"
 * appears in exactly ONE page's words — Papic storage, which is not the money.
 * No amount of better word-matching finds a row that is not in the index.
 *
 * ⚠ THIS IS NOT `fetchV2CustomerCatalog`, and the difference is deliberate. That
 * reader hides `is_active = false` and name-excludes several SKUs, because it
 * feeds the PUBLIC price page. An admin looking for a price needs the retired
 * ones too — the admin pricing screen shows them itself, in a fold. Reusing the
 * customer reader would silently hide 17 of the 22 Papic rows from the person
 * whose job is to edit them.
 *
 * SERVER ONLY by construction (it uses the service-role client). The palette is
 * a client component and receives the finished rows as plain data — and the
 * anchor helper lives in its own leaf (`sku-anchor.ts`) for the same reason: the
 * row editor is a client component and must not import this file.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

import { skuAnchorId } from './sku-anchor';

export type AdminRow = {
  /** What the row is called, e.g. `Papic — add 3,000 shots`. */
  label: string;
  /** Where it lives, anchor included. */
  href: string;
  /** The words this row can be found by, lowercased. */
  hay: string;
  /** Shown beside the label so a row never looks like a page. */
  hint: string;
};

/** Catalog rows for the admin search. Empty on any failure — never throws. */
export async function fetchAdminRows(): Promise<AdminRow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // No service-role key (CI builds run with placeholder env). The search keeps
    // working on pages alone rather than failing the render.
    return [];
  }

  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, is_active')
    .order('service_code');

  if (error) {
    logQueryError('fetchAdminRows (platform_retail_catalog_v2)', error);
    return [];
  }

  return (data ?? []).map((r) => {
    const code = String(r.service_code);
    const title = String(r.title ?? code);
    const active = r.is_active === true;
    return {
      label: title,
      href: `/admin/pricing?tab=pricing#${skuAnchorId(code)}`,
      // The code itself is searchable: an admin who knows PAPIC_GUEST_10K should
      // find it by typing that, and underscores become spaces so the words
      // inside a code are reachable too.
      hay: `${title} ${code} ${code.replace(/_/g, ' ')} price prices`.toLowerCase(),
      hint: active ? 'price' : 'price · off sale',
    };
  });
}
