import { redirect } from 'next/navigation';

// The catalog mode on /vendors (iteration 0022 marketplace redesign) absorbs
// what this page used to render — the full 192-category taxonomy grouped by
// mega-column, now with per-category vendor counts. Permanent redirect keeps
// any inbound link / bookmark / sitemap entry working.
export const dynamic = 'force-dynamic';

export default function VendorCategoriesRedirect(): never {
  redirect('/explore');
}
