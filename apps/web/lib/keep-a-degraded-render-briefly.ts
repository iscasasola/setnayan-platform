import { unstable_cache } from 'next/cache';

/**
 * keep-a-degraded-render-briefly.ts — A PAGE BUILT AROUND A REFUSED READ IS
 * NEVER KEPT AS LONG AS A HEALTHY ONE (2026-10-20, fewer-reads).
 *
 * An ISR page keeps whatever its render produced for its `revalidate`. When a
 * fail-soft read inside it was REFUSED (the database did not answer), the
 * render still succeeds — the page drops a credit or an embed rather than
 * break — and Next would keep that degraded page exactly as long as a healthy
 * one. With a day-long `revalidate` that is a day of "no credits" that nobody
 * chose, byte-identical to there being none.
 *
 * Calling this during such a render shortens THIS render's lifetime only: Next
 * lowers a prerender's `revalidate` to the smallest one any `unstable_cache`
 * read asks for during it (next/dist/server/web/spec-extension/unstable-cache.js,
 * "We update the store's revalidate property…"). A healthy render never calls
 * it and keeps the page's full `revalidate`.
 *
 * ⚠ IT NEVER FAILS THE RENDER. Outside a prerender (a dynamic request, a test)
 * it is a harmless cached `true`, and any error is swallowed: the degraded page
 * must still render, which is the rule the fail-soft reads were written under.
 */
export async function keepThisRenderBriefly(seconds: number): Promise<void> {
  try {
    await unstable_cache(async () => true, ['keep-a-degraded-render-briefly', String(seconds)], {
      revalidate: seconds,
    })();
  } catch {
    /* the page still renders; it is merely kept for its normal revalidate */
  }
}
