import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readStoreBadges, readStoreGraphUnlocks, readStoreLayout, readStoreToolFacts } from '@/lib/supplier-store.server';
import { analyticsGraphs, type StoreLayout, type ToolFacts } from '@/lib/supplier-store';
import type { GraphUnlocks } from '@/lib/graph-unlocks';
import type { ShelfTile } from '@/lib/shop-badge-shelf';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { readPayPlanTemplates } from '@/lib/pay-plan-templates.server';
import type { PlanTemplatesRead } from '@/lib/pay-plan-templates';

export type StoreData = {
  /** The shop's layout of its three rows; null = it could not be read (the defaults are drawn). */
  layout: StoreLayout | null;
  tools: ToolFacts;
  /** null = the badges could not be read. */
  badges: ShelfTile[] | null;
  unlocks: GraphUnlocks;
  /** The graphs on the shop's Analytics, in its order. */
  on: CardKey[];
  /** 🧩 The shop's live saved payment plans — a pay template is installed while the plan it made is one of them. */
  plans: PlanTemplatesRead;
};

/**
 * 🛍 THE STORE'S ONE READ — every shelf's facts in one batch (house rule 16: one batched read per screen). The layout
 * feeds the tool facts; the badge facts feed the graph gates; everything else starts at once.
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

  const layoutRead = readStoreLayout(supabase, id);
  const badgesRead = readStoreBadges(admin, id);
  const [layout, tools, badges, unlocks, plans] = await Promise.all([
    layoutRead,
    layoutRead.then((l) => readStoreToolFacts(supabase, admin, id, services, l)),
    badgesRead,
    readStoreGraphUnlocks(
      admin,
      id,
      badgesRead.then((b) => b.facts),
    ),
    readPayPlanTemplates(supabase, id),
  ]);
  return { layout, tools, badges: badges.tiles, unlocks, on: analyticsGraphs(layout?.graphs ?? null, unlocks), plans };
}
