import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { loadRequestTree } from '@/lib/service-requests.server';
import { TellUsWhatYouDoView, type TellUsSearch } from '../_components/tell-us-view';

export const metadata = { title: 'Tell us what you do · Supplier' };

/**
 * /vendor-dashboard/services/requests/new — "Can't find yours? Tell us what you do"
 * (owner rulings 2026-11-13, ruling 1).
 *
 * Three steps, one per screen, each a way back:
 *   1 · Pick a group      — the same grouped list couples browse (`getCoverageTaxonomy`).
 *   2 · Pick a category   — each row already says where they land: "<category> › Others".
 *   3 · Name your service — 2–80 characters + an optional note, posted to the SHIPPED
 *       `proposeCategory` with the category as `tile_id`.
 *
 * The search comes first and lives in the shared Add-a-service picker (the maker); this page is
 * the door at the end of it, so step 1 carries a way back to the search.
 */
export default async function TellUsWhatYouDoPage({ searchParams }: { searchParams: Promise<TellUsSearch> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const tree = await loadRequestTree();
  return <TellUsWhatYouDoView tree={tree} sp={sp} />;
}
