/**
 * lib/settled-read.ts — start a page's independent reads together, and still meet each one's failure where the page
 * used to.
 *
 * `Promise.all` is only a drop-in for reads that cannot reject (a Supabase query builder hands back `{ data, error }`,
 * it never throws). A read that CAN throw changes two things under `Promise.all`: the page sees whichever rejection
 * lands FIRST IN TIME rather than the first in the order the page was written, and every line between the batch and the
 * read's old `await` — a `logQueryError`, a redirect, an earlier read's own throw — is skipped.
 *
 * So: batch with `Promise.allSettled`, and call `settledValue(r)` at the line that used to say `await read()`. A
 * failure then surfaces exactly where it did before, after everything that ran before it.
 */
export function settledValue<T>(result: PromiseSettledResult<T>): T {
  if (result.status === 'fulfilled') return result.value;
  throw result.reason;
}
