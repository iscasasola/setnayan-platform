/**
 * read-all-pages.ts — read EVERY row of a PostgREST query, and say whether it
 * got to the end.
 *
 * Moved here unchanged from `lib/verification-docs.ts` (which re-exports it, so
 * its callers and tests are untouched) when the supplier lists needed the same
 * proof: PostgREST caps what one request returns (Supabase's documented default
 * is 1000 rows, and the setting is project configuration no session can read),
 * and a capped read comes back LARGE, NON-EMPTY and `error: null` — a supplier
 * with 1,200 conversations would simply have been shown 1,000, with nothing on
 * screen to say so.
 *
 * 🔑 COMPLETENESS IS PROVED AGAINST THE SERVER'S EXACT COUNT, never inferred
 * from a short page — the full reasoning is the docblock above the re-export in
 * `lib/verification-docs.ts`. Pass `{ count: 'exact' }` on the query and hand
 * the count back as `total`; without it the read reports `complete: false`.
 */
export async function readAllPages(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ rows: unknown[] | null; error: string | null; total?: number | null }>,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<{ rows: unknown[]; error: string | null; complete: boolean }> {
  const pageSize = Math.max(1, opts?.pageSize ?? 500);
  const maxPages = Math.max(1, opts?.maxPages ?? 200);
  const rows: unknown[] = [];
  let total: number | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    // The next window starts at what has ACTUALLY been collected, never at
    // `page * pageSize`. That is what makes a server cap below `pageSize`
    // harmless instead of silent.
    const from = rows.length;
    const { rows: got, error, total: reported } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error, complete: false };
    if (typeof reported === 'number') total = reported;
    const batch = got ?? [];
    rows.push(...batch);
    if (total !== null && rows.length >= total) return { rows, error: null, complete: true };
    // No progress and the count not reached: a cap of zero, or the table moved
    // under us. Either way this is not the end, and saying so is the point.
    if (batch.length === 0) return { rows, error: null, complete: false };
  }

  return { rows, error: null, complete: false };
}

/**
 * How many ids go into one `in.(…)` list. The filter is a URL query string, and
 * measured against production on 2026-09-20 an `in.()` of 700 random UUIDs is
 * refused `400 Bad Request` by the gateway while 600 passes — so a supplier with
 * several hundred customers did not get a slow enrichment read, it got an ERROR
 * and every name/date on the list went blank. 100 ids ≈ 3.7 KB, far inside it.
 * Same number as `kinship-read-core.ts`'s ID_CHUNK, which met the same wall.
 */
export const IN_LIST_CHUNK = 100;

/**
 * Run one `.in(column, ids)` read per chunk of ids and merge the rows. The first
 * chunk that fails fails the whole read (a partial enrichment would silently
 * blank some rows and not others), and the error comes back for the caller to
 * log — nothing here swallows it.
 */
export async function readInChunks<Row>(
  ids: readonly string[],
  readChunk: (
    part: string[],
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  size: number = IN_LIST_CHUNK,
): Promise<{ rows: Row[]; error: { message: string } | null }> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: Row[] = [];
  const step = Math.max(1, Math.floor(size));
  for (let i = 0; i < unique.length; i += step) {
    const { data, error } = await readChunk(unique.slice(i, i + step));
    if (error) return { rows, error };
    rows.push(...((data ?? []) as Row[]));
  }
  return { rows, error: null };
}
