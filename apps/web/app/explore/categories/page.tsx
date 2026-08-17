import { redirect } from 'next/navigation';

// The catalog mode on /vendors (iteration 0022 marketplace redesign) absorbs
// what this page used to render — the full 192-category taxonomy grouped by
// mega-column, now with per-category vendor counts. Permanent redirect keeps
// any inbound link / bookmark / sitemap entry working.
/*
  ⚠ THIS ROUTE IS DELIBERATELY OUTSIDE `app/(shell)/` (2026-08-15), even though
  its siblings moved in. It renders nothing — it is a bare `redirect('/explore')`
  — so wrapping it in the shared shell would mount the whole chrome and run a
  session read for a response that is only a `Location` header. Its own
  force-dynamic stays because it is no longer inheriting one from a group layout.
*/
export const dynamic = 'force-dynamic';

export default function VendorCategoriesRedirect(): never {
  redirect('/explore');
}
