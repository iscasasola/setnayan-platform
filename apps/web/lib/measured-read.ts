/**
 * measured-read.ts — a read that THROWS on failure, turned into "its value, and whether it happened".
 *
 * The house rule for a page's read fan-out is "empty page > error page": one refused read must not take the whole
 * page down, so each is caught and an empty value stands in. That much is right. It stopped one step short wherever
 * the catch was `.catch(() => [])`: the page then drew the empty value as a FACT — nobody seated, no groups — and a
 * refused read rendered byte-identical to a couple who had done nothing yet.
 *
 * `measuredOr(read, empty)` keeps the first half and adds the second: it never throws, and it says `measured: false`
 * when the value is only the stand-in — so the render can say "we couldn't load this" where it would have said
 * "none". The pattern is `fetchGuestsByEventMeasured` (`lib/guests.ts`), for the reads that throw instead of resolving
 * `{ error }`.
 *
 * Pure and dependency-free. It does NOT log: pass `onRefused` to leave the trail (the stand-in is silent otherwise).
 * 🛡 lib/guest-list-side-reads-are-honest.test.ts.
 */
export type Measured<T> = { value: T; measured: boolean };

export async function measuredOr<T>(read: PromiseLike<T>, empty: T, onRefused?: (error: unknown) => void): Promise<Measured<T>> {
  try {
    return { value: await read, measured: true };
  } catch (error) {
    try {
      onRefused?.(error);
    } catch {
      /* a logger that throws must not undo the degrade */
    }
    return { value: empty, measured: false };
  }
}
