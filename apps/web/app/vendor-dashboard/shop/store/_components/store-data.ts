import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readStoreBadges, readStoreGraphUnlocks, readStorePicks, readStoreToolFacts, type StorePicks } from '@/lib/supplier-store.server';
import { analyticsGraphs, type ToolFacts } from '@/lib/supplier-store';
import type { GraphUnlocks } from '@/lib/graph-unlocks';
import type { ShelfTile } from '@/lib/shop-badge-shelf';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';

export type StoreData = {
  /** null = the shop's picks could not be read (every "yours / on / following" is then said as unread). */
  picks: StorePicks | null;
  tools: ToolFacts;
  /** null = the badges could not be read. */
  badges: ShelfTile[] | null;
  unlocks: GraphUnlocks;
  /** The graphs on the shop's Analytics, in its order. */
  on: CardKey[];
};

/**
 * 🛍 THE STORE'S ONE READ — every shelf's facts in one batch (house rule 16: one batched read per screen). The picks
 * feed the tool facts; the badge facts feed the graph gates; everything else starts at once.
 */
export async function loadStore(): Promise<StoreData> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const id = profile.vendor_profile_id as string;
  const admin = createAdminClient();
  const services = (profile.services ?? []) as string[];

  const picksRead = readStorePicks(supabase, id);
  const badgesRead = readStoreBadges(admin, id);
  const [picks, tools, badges, unlocks] = await Promise.all([
    picksRead,
    picksRead.then((p) => readStoreToolFacts(supabase, admin, id, services, p?.tools ?? null)),
    badgesRead,
    readStoreGraphUnlocks(
      admin,
      id,
      badgesRead.then((b) => b.facts),
    ),
  ]);
  return { picks, tools, badges: badges.tiles, unlocks, on: analyticsGraphs(picks?.graphs ?? null, unlocks) };
}
