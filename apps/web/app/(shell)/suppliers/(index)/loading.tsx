/**
 * /suppliers (the index) commits the press at once: the shell is already on
 * screen, so this paints nothing (`the-press-commits-now.test.ts`).
 *
 * ⚠ WHY IT LIVES IN `(index)/`. A `loading.tsx` wraps its WHOLE subtree, so one
 * at `suppliers/` would make every landing and shop page below stream — and a
 * streamed page that calls `notFound()` commits HTTP 200 first: the soft-404.
 * The `(index)` group scopes this boundary to the index alone, which never 404s.
 */
export default function Loading() {
  return null;
}
