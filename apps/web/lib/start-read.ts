/**
 * start-read.ts — begin a read NOW, await it where its answer is needed.
 *
 * A server page that writes `const x = await readX()` on one line and
 * `const y = await readY()` on the next pays one full database trip per line,
 * even when neither read needs the other's answer. `startRead(readX())` sends
 * the request immediately and hands back the promise; the page then awaits it
 * at the SAME place it always did, so every graceful-degrade branch, every
 * `if (error)` and every fallback reads exactly as before — only the waiting
 * overlaps.
 *
 * 🔒 WHY THE `catch` IS HERE. A started read that rejects while the page is
 * still awaiting something ELSE has no handler attached yet, and Node reports
 * it as an unhandled rejection. The no-op `catch` marks it handled; the
 * ORIGINAL promise is returned, so the place that awaits it still sees the
 * rejection and handles it exactly as it did when the read was started there.
 *
 * Accepts any thenable — a Supabase query builder runs its request the moment
 * `Promise.resolve` calls its `then`.
 */
export function startRead<T>(read: PromiseLike<T>): Promise<T> {
  const started = Promise.resolve(read);
  started.catch(() => {});
  return started;
}
