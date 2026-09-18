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
import { getTaxonomy } from '@/lib/taxonomy-db';

import { skuAnchorId } from './sku-anchor';

export type AdminRow = {
  /** What the row is called, e.g. `Papic — add 3,000 credits`. */
  label: string;
  /** Where it lives, anchor included. */
  href: string;
  /** The words this row can be found by, lowercased. */
  hay: string;
  /** Shown beside the label so a row never looks like a page. */
  hint: string;
};

/**
 * Catalog + taxonomy rows for the admin search (LAU-18). Every source is
 * independent and degrades on its own — a broken read never takes the whole
 * list down with it. Empty on total failure — never throws.
 */
export async function fetchAdminRows(): Promise<AdminRow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // No service-role key (CI builds run with placeholder env). The search keeps
    // working on pages alone rather than failing the render.
    return [];
  }

  const rows: AdminRow[] = [];

  const priceRes = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, is_active')
    .order('service_code');

  if (priceRes.error) {
    logQueryError('fetchAdminRows (platform_retail_catalog_v2)', priceRes.error);
  } else {
    for (const r of priceRes.data ?? []) {
      const code = String(r.service_code);
      const title = String(r.title ?? code);
      const active = r.is_active === true;
      rows.push({
        label: title,
        href: `/admin/pricing?tab=pricing#${skuAnchorId(code)}`,
        // The code itself is searchable: an admin who knows PAPIC_GUEST_10K
        // should find it by typing that, and underscores become spaces so the
        // words inside a code are reachable too.
        hay: `${title} ${code} ${code.replace(/_/g, ' ')} price prices`.toLowerCase(),
        hint: active ? 'price' : 'price · off sale',
      });
    }
  }

  // Folders + categories (tiles) — the DB-backed read-through with its own
  // constant fallback (`getTaxonomy()`, never throws), so a search for
  // "feast" or "bridal car" lands on the Taxonomy Studio node itself instead
  // of only on the page that edits all of them. A folder has no inspector of
  // its own, so it opens the first category filed under it — same landing the
  // Studio's own "createTaxonomyNode" assistant resolves to.
  try {
    const tax = await getTaxonomy();
    for (const folderId of tax.folderOrder) {
      const label = tax.folderLabel[folderId] ?? folderId;
      const firstTile = (tax.tilesByParent[folderId] ?? [])[0];
      rows.push({
        label,
        href: firstTile ? `/admin/taxonomy?open=${firstTile}` : '/admin/taxonomy',
        hay: `${label} ${folderId.replace(/_/g, ' ')} folder taxonomy`.toLowerCase(),
        hint: 'folder',
      });
    }
    for (const tileId of tax.tileOrder) {
      const label = tax.tileLabel[tileId] ?? tileId;
      rows.push({
        label,
        href: `/admin/taxonomy?open=${tileId}`,
        hay: `${label} ${tileId.replace(/_/g, ' ')} category tile taxonomy`.toLowerCase(),
        hint: tax.hiddenCategories[tileId] === true ? 'category · hidden' : 'category',
      });
    }
  } catch {
    // Taxonomy rows stay out of the index; the catalog rows above still work.
  }

  const [eventTypeRes, faithRes] = await Promise.all([
    admin.from('event_type_vocab').select('event_type, label_en, status').order('event_type'),
    admin.from('faith_vocab').select('faith_key, label_en, status').order('faith_key'),
  ]);

  if (eventTypeRes.error) {
    logQueryError('fetchAdminRows (event_type_vocab)', eventTypeRes.error);
  } else {
    for (const r of eventTypeRes.data ?? []) {
      const key = String(r.event_type);
      const label = String(r.label_en ?? key);
      const active = r.status === 'active';
      rows.push({
        label,
        // The Vocabularies rail has no per-row anchor — landing on the right
        // tab is the honest miss over guessing a scroll position that isn't
        // there (same posture as the tile-inspector deep-link).
        href: '/admin/taxonomy?view=vocab-event',
        hay: `${label} ${key.replace(/_/g, ' ')} event type taxonomy`.toLowerCase(),
        hint: active ? 'event type' : 'event type · off',
      });
    }
  }

  if (faithRes.error) {
    logQueryError('fetchAdminRows (faith_vocab)', faithRes.error);
  } else {
    for (const r of faithRes.data ?? []) {
      const key = String(r.faith_key);
      const label = String(r.label_en ?? key);
      const active = r.status === 'active';
      rows.push({
        label,
        href: '/admin/taxonomy?view=vocab-faith',
        hay: `${label} ${key.replace(/_/g, ' ')} faith religion taxonomy`.toLowerCase(),
        hint: active ? 'faith' : 'faith · off',
      });
    }
  }

  return rows;
}
