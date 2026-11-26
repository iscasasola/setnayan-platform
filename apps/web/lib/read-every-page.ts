/**
 * read-every-page.ts — read past the database's 1,000-row reply ceiling.
 *
 * Supabase (PostgREST) answers at most 1,000 rows per request whatever
 * `.limit()` asks for, so a rollup read in one request undercounts silently
 * once the table outgrows it (A8·D-11: guests per event, save-the-date views,
 * demo-shop scans). This reads page after page, in a stable order the caller
 * supplies, until a short page says the end was reached.
 *
 * Honest by shape:
 *   · any refused page → null (the caller shows "couldn't read", never a part);
 *   · stopping at `maxRows` → `complete: false`, so the caller can say the
 *     numbers are floors instead of printing them as totals.
 */
export const DB_PAGE_ROWS = 1000;

export type EveryPage<T> = { rows: T[]; complete: boolean };

export async function readEveryPage<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows: number,
  pageRows: number = DB_PAGE_ROWS,
): Promise<EveryPage<T> | null> {
  const rows: T[] = [];
  while (rows.length < maxRows) {
    const from = rows.length;
    const to = Math.min(from + pageRows, maxRows) - 1;
    const { data, error } = await page(from, to);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < to - from + 1) return { rows, complete: true };
  }
  return { rows, complete: false };
}
