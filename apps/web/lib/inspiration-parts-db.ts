/**
 * lib/inspiration-parts-db.ts — the DB read-through for the inspiration parts (PLAN
 * `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 2, step ②; owner-approved 2026-10-26).
 *
 * Reads `inspiration_parts` (migration `20271287668170_inspiration_parts_on_the_taxonomy.sql`), its services
 * `inspiration_part_services` and the categories DERIVED from them, `inspiration_part_categories_derived` (③a,
 * `20271291224109_inspiration_part_services.sql`), into the one snapshot the couple's "Which part?",
 * the supplier's `Part ▾` and the admin's list are drawn from. The same shape and the same safety as
 * `getTaxonomy()` (`lib/taxonomy-db.ts`): an error, or an empty table, FALLS BACK to the consts the table
 * was seeded from (`fallbackInspirationParts()`), so the screens read exactly what they read before until
 * an admin edits a part. `source` says which path answered.
 *
 * Cached per request via React `cache()` — one read per render tree however many readers ask.
 * Server-only (reads cookies through the Supabase client). The three are readable by any SIGNED-IN account
 * (RLS: authenticated SELECT; anon holds no grant), so a signed-out read errors and answers the fallback — as
 * since step ①.
 *
 * ⚠ `inspiration_part_categories` is NOT read any more: until ③c drops it, a trigger double-writes it from the
 * same derivation, only so a revert of the app keeps working.
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import {
  fallbackInspirationParts,
  snapshotFromPartRows,
  type InspirationPartCategoryRow,
  type InspirationPartRow,
  type InspirationPartServiceRow,
  type InspirationPartsSnapshot,
} from './inspiration-parts';

export type { InspirationPartsSnapshot } from './inspiration-parts';

export const getInspirationParts = cache(async (): Promise<InspirationPartsSnapshot> => {
  try {
    const sb = await createClient();
    const [partsRes, linksRes, servicesRes] = await Promise.all([
      sb.from('inspiration_parts').select('slot_key,label_en,kind,home_category_id,sort_order,hidden,status'),
      sb.from('inspiration_part_categories_derived').select('slot_key,category_id,sort_order'),
      sb.from('inspiration_part_services').select('slot_key,canonical_service,sort_order'),
    ]);
    const rows = partsRes.data as InspirationPartRow[] | null;
    const links = linksRes.data as InspirationPartCategoryRow[] | null;
    const services = servicesRes.data as InspirationPartServiceRow[] | null;
    if (partsRes.error || linksRes.error || servicesRes.error || !rows || !links || !services || rows.length === 0) {
      return fallbackInspirationParts();
    }
    return snapshotFromPartRows(rows, links, services);
  } catch {
    return fallbackInspirationParts();
  }
});
