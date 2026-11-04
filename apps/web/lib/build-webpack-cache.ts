/**
 * Whether a webpack compile keeps its filesystem cache (`.next/cache/webpack`).
 *
 * A production build does not, unless NEXT_BUILD_WEBPACK_CACHE=1 asks for it.
 * Measured on main 78112195 (2026-11-04, clean build, 4 cores):
 *
 *   - writing the server cache took 2.0 min, and ran before the edge and
 *     client compiles could start;
 *   - it was the build's memory peak: 7.8 GB → 11.4 GB while serialising;
 *   - the cache came to 5.6 GB, and Vercel keeps at most 3 GB of build cache on
 *     an Enhanced machine, so the next build could not reuse it.
 *
 * `next dev` keeps its cache: there it is what makes a restart fast.
 * 🛡 lib/the-build-stays-fast.test.ts and scripts/check-build-budget.mjs hold it.
 */
export function keepWebpackCache(
  dev: boolean,
  env: Record<string, string | undefined>,
): boolean {
  return dev || env.NEXT_BUILD_WEBPACK_CACHE === '1';
}
