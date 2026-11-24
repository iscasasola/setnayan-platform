import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readStoreBadges } from '@/lib/supplier-store.server';
import { ToolPage, ToolPin } from '@/app/vendor-dashboard/_components/tool-page';
import { BadgesList } from '../_components/badges-list';

export const metadata = { title: 'Badges · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 🏅 SHOP › BADGES — every badge, its seven steps and what is left (owner 23 Nov 2026; drawing
 * `supplier_store_graphs_badges_2026-11-23` v10, F10). Built on the Shop's own shelf (`shopBadgeShelf`, the reward
 * engine's counts) — nothing re-counted here. Per badge: its ring, what it counts, "7 clients to Ruby", where the shop
 * stands, the ladder Bronze → Black Diamond (reached · next · still far) with each step's number, and the next gift
 * (`rewardLineFor`). Setnayan Verified: earned once, its Papic 150 gift once (2026-11-04 ruling).
 * Honest: a count that could not be read says so — never zero, never "locked".
 */
export default async function ShopBadgesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const { tiles } = await readStoreBadges(createAdminClient(), profile.vendor_profile_id as string);
  return (
    <ToolPage name="badges">
      <ToolPin route="/vendor-dashboard/shop/badges" title="Badges" sub="Every badge, its seven steps and what is left." />
      <BadgesList tiles={tiles} />
    </ToolPage>
  );
}
