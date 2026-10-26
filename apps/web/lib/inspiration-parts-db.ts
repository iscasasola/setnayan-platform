/**
 * lib/inspiration-parts-db.ts — the DB read-through for the inspiration parts (PLAN
 * `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 2, step ②; owner-approved 2026-10-26).
 *
 * Reads `inspiration_parts` + `inspiration_part_categories` (migration
 * `20271287668170_inspiration_parts_on_the_taxonomy.sql`) into the one snapshot the couple's "Which part?",
 * the supplier's `Part ▾` and the admin's list are drawn from. The same shape and the same safety as
 * `getTaxonomy()` (`lib/taxonomy-db.ts`): an error, or an empty table, FALLS BACK to the consts the table
 * was seeded from (`fallbackInspirationParts()`), so the screens read exactly what they read before until
 * an admin edits a part. `source` says which path answered.
 *
 * Cached per request via React `cache()` — one read per render tree however many readers ask.
 * Server-only (reads cookies through the Supabase client). Both tables are publicly readable (RLS:
 * anon + authenticated SELECT), so the cookie client sees every row.
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import {
  fallbackInspirationParts,
  snapshotFromPartRows,
  type InspirationPartCategoryRow,
  type InspirationPartRow,
  type InspirationPartsSnapshot,
} from './inspiration-parts';

export type { InspirationPartsSnapshot } from './inspiration-parts';

export const getInspirationParts = cache(async (): Promise<InspirationPartsSnapshot> => {
  try {
    const sb = await createClient();
    const [partsRes, linksRes] = await Promise.all([
      sb.from('inspiration_parts').select('slot_key,label_en,kind,home_category_id,sort_order,hidden,status'),
      sb.from('inspiration_part_categories').select('slot_key,category_id,sort_order'),
    ]);
    const rows = partsRes.data as InspirationPartRow[] | null;
    const links = linksRes.data as InspirationPartCategoryRow[] | null;
    if (partsRes.error || linksRes.error || !rows || !links || rows.length === 0) {
      return fallbackInspirationParts();
    }
    return snapshotFromPartRows(rows, links);
  } catch {
    return fallbackInspirationParts();
  }
});
