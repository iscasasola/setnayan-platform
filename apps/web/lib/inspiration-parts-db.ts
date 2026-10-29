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
 *
 * 📄 READ TO THE END (2026-10-30). Migration `20271296836679_seed_the_starter_inspiration_parts.sql` (PR #7058) took
 * `inspiration_part_services` from ~385 rows to ~2,769. Every reader selected the WHOLE relation in one request,
 * and PostgREST caps one request (Supabase's documented default is 1000 rows) and returns the capped set with
 * `error: null` — so Admin › Categories › Reception › Events Place showed only its 2 OLD parts: the new parts'
 * links were past row 1,000, and a truncated read rendered exactly like "this part links nothing".
 * `readEveryPartRow` / `readInspirationPartTables` below page each relation through `readAllPages`
 * (`lib/read-all-pages.ts`, the house's one paging helper), ordered by a unique key and proved against the
 * server's exact count. A read that cannot prove it reached the end is an ERROR, so every caller takes its
 * EXISTING error path (the seed fallback here, "Couldn't load the parts" in `load-map.ts`, a refused add in
 * `taxonomy-writes.ts`) — never a partial list drawn as the whole one. The client is the structural
 * `PartTablesClient` (same seam as `ReferenceQueryClient` in `lib/verification-docs.ts`), so a fake can record
 * every window: `inspiration-parts-are-read-to-the-end.test.ts`, which also holds the source guard.
 * 🗺 The chains live HERE, as literal `.from('…')`, because the Ugat screens scan reads a screen's tables from
 * literals two imports deep — one more hop of indirection silently dropped these relations from ten screens.
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
import { readAllPages } from './read-all-pages';

export type { InspirationPartsSnapshot } from './inspiration-parts';

/** What one page resolves to. Shaped like postgrest-js. */
export type PartPageResult = { data: unknown[] | null; error: { message: string } | null; count?: number | null };

/** One page query: ordered by a unique key, then cut to a window. */
export type PartPageQuery = {
  order(column: string, options: { ascending: boolean }): PartPageQuery;
  range(from: number, to: number): PromiseLike<PartPageResult>;
};

/** The smallest slice of the Supabase client a paged read needs. */
export type PartTablesClient = {
  from(table: string): { select(columns: string, options: { count: 'exact' }): PartPageQuery };
};

/** One page = the documented server cap. A smaller real cap is still safe: the next window starts at what arrived. */
export const PART_READ_PAGE_SIZE = 1000;

/**
 * The three relations: the columns the readers draw, and ONE page of each — ordered by the relation's UNIQUE key
 * (offset paging over a non-unique order could skip or repeat a row at a page boundary), counted exactly, cut to
 * the window. `inspiration_part_services`' key is its PRIMARY KEY; the view's (slot_key, category_id) is unique by
 * its GROUP BY (`20271291224109`); `inspiration_parts`' is its primary key.
 */
export const PART_RELATIONS = {
  parts: {
    columns: 'slot_key,label_en,kind,home_category_id,sort_order,hidden,status',
    page: (c: PartTablesClient, columns: string, from: number, to: number) =>
      c.from('inspiration_parts').select(columns, { count: 'exact' }).order('slot_key', { ascending: true }).range(from, to),
  },
  categories: {
    columns: 'slot_key,category_id,sort_order',
    page: (c: PartTablesClient, columns: string, from: number, to: number) =>
      c
        .from('inspiration_part_categories_derived')
        .select(columns, { count: 'exact' })
        .order('slot_key', { ascending: true })
        .order('category_id', { ascending: true })
        .range(from, to),
  },
  services: {
    columns: 'slot_key,canonical_service,sort_order',
    page: (c: PartTablesClient, columns: string, from: number, to: number) =>
      c
        .from('inspiration_part_services')
        .select(columns, { count: 'exact' })
        .order('slot_key', { ascending: true })
        .order('canonical_service', { ascending: true })
        .range(from, to),
  },
} as const;

export type PartRelation = keyof typeof PART_RELATIONS;

/**
 * Every row of one relation, paged to the server's exact count. `error` is set when a page failed OR when the read
 * stopped short of the count — the caller must never use `rows` then.
 */
export async function readEveryPartRow<Row>(
  client: PartTablesClient,
  relation: PartRelation,
  opts?: { columns?: string; pageSize?: number },
): Promise<{ rows: Row[]; error: string | null }> {
  const spec = PART_RELATIONS[relation];
  const table = `inspiration parts (${relation})`;
  const read = await readAllPages(
    async (from, to) => {
      const res = await spec.page(client, opts?.columns ?? spec.columns, from, to);
      return { rows: res.data ?? null, error: res.error ? res.error.message : null, total: res.count ?? null };
    },
    { pageSize: opts?.pageSize ?? PART_READ_PAGE_SIZE },
  );
  if (read.error) return { rows: [], error: `${table}: ${read.error}` };
  if (!read.complete) {
    return { rows: [], error: `${table}: the read stopped after ${read.rows.length} rows, before the server's count` };
  }
  return { rows: read.rows as Row[], error: null };
}

/** The three relations `getInspirationParts()` draws its snapshot from, each read to the end. */
export async function readInspirationPartTables(client: PartTablesClient): Promise<{
  parts: InspirationPartRow[];
  categories: InspirationPartCategoryRow[];
  services: InspirationPartServiceRow[];
  error: string | null;
}> {
  const [parts, categories, services] = await Promise.all([
    readEveryPartRow<InspirationPartRow>(client, 'parts'),
    readEveryPartRow<InspirationPartCategoryRow>(client, 'categories'),
    readEveryPartRow<InspirationPartServiceRow>(client, 'services'),
  ]);
  return {
    parts: parts.rows,
    categories: categories.rows,
    services: services.rows,
    error: parts.error ?? categories.error ?? services.error,
  };
}

export const getInspirationParts = cache(async (): Promise<InspirationPartsSnapshot> => {
  try {
    const sb = await createClient();
    // 📄 Every row, paged to the server's exact count (`readInspirationPartTables` above). One un-ranged select of
    // `inspiration_part_services` was capped at 1,000 of ~2,769 rows with `error: null` once PR #7058 seeded the
    // starter parts. A read that stops short is an ERROR here — it takes the fallback, never a partial snapshot.
    const read = await readInspirationPartTables(sb as unknown as PartTablesClient);
    if (read.error || read.parts.length === 0) return fallbackInspirationParts();
    return snapshotFromPartRows(read.parts, read.categories, read.services);
  } catch {
    return fallbackInspirationParts();
  }
});
