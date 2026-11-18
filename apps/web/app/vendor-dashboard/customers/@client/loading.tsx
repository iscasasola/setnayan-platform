/**
 * The `client` slot on the Clients address draws nothing (`page.tsx` beside this, EB-246), so its loading state draws
 * nothing too. Without this file the slot borrowed `app/vendor-dashboard/loading.tsx`, which paints a page title this
 * route never draws (held by `the-skeleton-promises-only-what-the-page-draws.test.ts`).
 */
export default function NoPickedClientLoading() {
  return null;
}
