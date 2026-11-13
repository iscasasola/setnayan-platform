import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { loadMyRequests, loadRequestTree } from '@/lib/service-requests.server';
import { YourRequestsView } from './_components/your-requests-view';

export const metadata = { title: 'Your requests · Supplier' };

/**
 * /vendor-dashboard/services/requests — "Your requests" (owner rulings 2026-11-13, ruling 4).
 *
 * What the shop asked us to add and what we did with it: Waiting first, then Decided, in the
 * owner's words (Waiting · Added as a new service · Moved to "…" · Kept just for your shop · Not
 * added). A row opens its detail. Extends the shipped inline list under the old "Tell us what you
 * do" form (services-manager.tsx) into a page of its own.
 *
 * 🔑 A refused read says so — "Couldn't load your requests" — and never draws "No requests yet".
 */
export default async function YourRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const [mine, tree] = await Promise.all([loadMyRequests(supabase, profile.vendor_profile_id), loadRequestTree()]);
  return <YourRequestsView mine={mine} tree={tree} />;
}
