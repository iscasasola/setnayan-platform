/**
 * The PATH a notice's `return_to` revalidates — the address without its `?query` or `#hash`.
 *
 * `revalidatePath` takes a route path, never a query: `/dashboard?seg=people` is not a path, so it revalidated
 * nothing that exists while the action then redirected to that same page. Since Home took the People and Memories
 * sections (2026-11-11), every connection notice lands on `/dashboard?seg=people`, and tapping one from Home is a
 * redirect to the page you are already on. `lib/notification-actions.ts` revalidates this path and redirects to the
 * full address.
 */
export function revalidationPathOf(returnTo: string): string {
  const cut = returnTo.search(/[?#]/);
  const path = cut === -1 ? returnTo : returnTo.slice(0, cut);
  return path.length > 0 ? path : '/';
}
