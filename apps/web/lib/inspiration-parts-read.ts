/**
 * inspiration-parts-read.ts — read EVERY row of the three inspiration-part relations, or say it could not.
 *
 * 🐛 WHY THIS EXISTS (2026-10-30). Migration `20271296836679_seed_the_starter_inspiration_parts.sql` (PR #7058)
 * took `inspiration_part_services` from ~385 rows to ~2,769. Every reader selected the WHOLE relation in one
 * request, and PostgREST caps one request (Supabase's documented default is 1000 rows) and returns the capped
 * set with `error: null`. So the admin opened Reception › Events Place and saw only the 2 OLD parts under
 * "Parts for Events Place" — the new parts' links were simply past row 1,000. A truncated read rendered exactly
 * like "this part links nothing": the house's named disease, a failure that looks like emptiness.
 *
 * 🔑 The paging is `readAllPages` (`lib/read-all-pages.ts`) — the ONE helper the supplier lists already use,
 * never a second one. Completeness is proved against the server's exact count (`{ count: 'exact' }`), never
 * inferred from a short page; a read that cannot prove it reached the end comes back with an `error`, so every
 * caller takes its EXISTING error path (the seed fallback, "Couldn't load the parts", a refused write) instead
 * of drawing a partial list as if it were the whole one.
 *
 * Pure (no `server-only`, no client construction) so a fake client can record the table, the count option,
 * the order and every range window — `inspiration-parts-read.test.ts`. The callers cast their Supabase client
 * to `PartTablesClient`, the same seam as `ReferenceQueryClient` in `lib/verification-docs.ts`.
 * The guard that keeps every reader on this path: `inspiration-parts-are-read-to-the-end.test.ts`.
 */
import { readAllPages } from './read-all-pages';
import type { InspirationPartCategoryRow, InspirationPartRow, InspirationPartServiceRow } from './inspiration-parts';

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
 * The three relations, the columns the readers draw, and the UNIQUE key each is ordered by — offset paging
 * over a non-unique order could skip or repeat a row at a page boundary. `inspiration_part_services`' key is its
 * PRIMARY KEY; the view's (slot_key, category_id) is unique by its GROUP BY (`20271291224109`).
 */
export const PART_RELATIONS = {
  parts: {
    table: 'inspiration_parts',
    columns: 'slot_key,label_en,kind,home_category_id,sort_order,hidden,status',
    key: ['slot_key'],
  },
  categories: {
    table: 'inspiration_part_categories_derived',
    columns: 'slot_key,category_id,sort_order',
    key: ['slot_key', 'category_id'],
  },
  services: {
    table: 'inspiration_part_services',
    columns: 'slot_key,canonical_service,sort_order',
    key: ['slot_key', 'canonical_service'],
  },
} as const;

export type PartRelation = keyof typeof PART_RELATIONS;

/**
 * Every row of one relation, ordered by its unique key, paged to the server's exact count. `error` is set when a
 * page failed OR when the read stopped short of the count — the caller must never use `rows` then.
 */
export async function readEveryPartRow<Row>(
  client: PartTablesClient,
  relation: PartRelation,
  opts?: { columns?: string; pageSize?: number },
): Promise<{ rows: Row[]; error: string | null }> {
  const spec = PART_RELATIONS[relation];
  const read = await readAllPages(
    async (from, to) => {
      let q = client.from(spec.table).select(opts?.columns ?? spec.columns, { count: 'exact' });
      for (const col of spec.key) q = q.order(col, { ascending: true });
      const res = await q.range(from, to);
      return { rows: res.data ?? null, error: res.error ? res.error.message : null, total: res.count ?? null };
    },
    { pageSize: opts?.pageSize ?? PART_READ_PAGE_SIZE },
  );
  if (read.error) return { rows: [], error: `${spec.table}: ${read.error}` };
  if (!read.complete) {
    return { rows: [], error: `${spec.table}: the read stopped after ${read.rows.length} rows, before the server's count` };
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
