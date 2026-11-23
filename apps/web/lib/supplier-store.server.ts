import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveCoverageLabels } from '@/lib/vendor-coverages';
import { readShopTrackerFacts } from '@/lib/shop-badges.server';
import type { TrackerFacts } from '@/lib/shop-badges';
import { readBadgeRewardTracker, readFiveStarCount, readGiftPoints } from '@/lib/badge-rewards.server';
import type { TrackerRewardInput } from '@/lib/badge-rewards';
import { shopBadgeShelf, type ShelfTile } from '@/lib/shop-badge-shelf';
import { readGraphUnlockFacts } from '@/lib/graph-unlocks.server';
import { graphUnlocks, type GraphUnlocks } from '@/lib/graph-unlocks';
import { fetchVendorSpecializationSubscription } from '@/lib/vendor-specialization-gate.server';
import { freeWidgetsOpen } from '@/lib/vendor-specialization-gate';
import { PAID_STORE_TOOLS, STORE_TOOL_SKUS, readLayout, toolOfSku, toolStatus, type ToolStatus, type PaidStoreTool, type HubOverrides, type StoreLayout, type ToolFacts, type ToolPrice } from '@/lib/supplier-store';
import { nameKey } from '@/lib/hub-tools';

/**
 * 🛍 THE SUPPLIER STORE'S READS (owner 23 Nov 2026 — `lib/supplier-store.ts` holds the words and the states).
 *
 * Every read is honest: a refused read comes back `null` / 'unread' and the screen says "Couldn't load" — never a price,
 * never "not owned", never zero. Money-adjacent reads (orders, the catalog) use the service-role
 * client the buy and the gates use, so the Store and the gate can never disagree about one shop.
 */

/** The shop's layout of its three Store rows (`vendor_profiles.store_layout`); null = the row could not be read. */
export async function readStoreLayout(client: SupabaseClient, vendorProfileId: string): Promise<StoreLayout | null> {
  const { data, error } = await client.from('vendor_profiles').select('store_layout').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error || !data) {
    if (error) logQueryError('readStoreLayout', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return readLayout((data as { store_layout?: unknown }).store_layout);
}

/** The shop's service labels (Scanner + suggested tools are decided from them). Empty on a refused read: order only. */
async function readCategoryLabels(client: SupabaseClient, vendorProfileId: string): Promise<string[]> {
  try {
    const [cov, labels] = await Promise.all([
      client.from('vendor_coverages').select('canonical_service').eq('vendor_profile_id', vendorProfileId),
      resolveCoverageLabels(),
    ]);
    if (cov.error) {
      logQueryError('readStoreCategoryLabels', cov.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return [];
    }
    return ((cov.data ?? []) as { canonical_service: string | null }[])
      .map((c) => (c.canonical_service ? labels.leafLabel(c.canonical_service) : null))
      .filter((l): l is string => !!l);
  } catch (err) {
    logQueryError('readStoreCategoryLabels', err, { vendor_profile_id: vendorProfileId });
    return [];
  }
}

/**
 * An admin's saved hub tools per category (`category_hub_settings` = saved, `category_hub_tool_switches` = what is on),
 * keyed by the category's name the table's own way. A refused read falls back to the seed alone — tags only order and
 * suggest, they never lock a tool, so the seed is a safe answer.
 */
export async function readHubOverrides(admin: SupabaseClient): Promise<HubOverrides> {
  try {
    const [set, sw] = await Promise.all([
      admin.from('category_hub_settings').select('category_id'),
      admin.from('category_hub_tool_switches').select('category_id, tool_key'),
    ]);
    if (set.error || sw.error) {
      logQueryError('readHubOverrides', set.error ?? sw.error, {}, 'graceful_degrade');
      return new Map();
    }
    const ids = ((set.data ?? []) as { category_id: string }[]).map((r) => r.category_id);
    if (ids.length === 0) return new Map();
    const cats = await admin.from('service_categories').select('id, label_en').in('id', ids);
    if (cats.error) {
      logQueryError('readHubOverrides.categories', cats.error, {}, 'graceful_degrade');
      return new Map();
    }
    const on = new Map<string, string[]>(ids.map((id) => [id, []]));
    for (const r of (sw.data ?? []) as { category_id: string; tool_key: string }[]) on.get(r.category_id)?.push(r.tool_key);
    return new Map(((cats.data ?? []) as { id: string; label_en: string | null }[]).filter((c) => c.label_en).map((c) => [nameKey(c.label_en!), on.get(c.id) ?? []]));
  } catch (err) {
    logQueryError('readHubOverrides', err, {});
    return new Map();
  }
}

/** Each paid tool's catalog price (peso, or null when the row has none usable); null = the catalog was refused. */
export async function readStoreToolPrices(admin: SupabaseClient): Promise<Partial<Record<PaidStoreTool, ToolPrice>> | null> {
  const { data, error } = await admin.from('vendor_billing_catalog').select('sku_code, price_php, is_active').in('sku_code', STORE_TOOL_SKUS as string[]);
  if (error) {
    logQueryError('readStoreToolPrices', error, {}, 'graceful_degrade');
    return null;
  }
  const out: Partial<Record<PaidStoreTool, ToolPrice>> = Object.fromEntries(PAID_STORE_TOOLS.map((k) => [k, null]));
  for (const r of (data ?? []) as { sku_code: string; price_php: number | string | null; is_active: boolean | null }[]) {
    const k = toolOfSku(r.sku_code);
    const n = Number(r.price_php);
    if (k) out[k] = r.is_active === true && Number.isFinite(n) && n > 0 ? n : null;
  }
  return out;
}

/** Bought (paid / fulfilled) and in-review (submitted) paid tools; null = refused. */
async function readToolOrders(admin: SupabaseClient, vendorProfileId: string): Promise<{ owned: Set<PaidStoreTool>; pending: Set<PaidStoreTool> } | null> {
  const { data, error } = await admin
    .from('orders')
    .select('service_key, status')
    .eq('vendor_profile_id', vendorProfileId)
    .in('service_key', STORE_TOOL_SKUS as string[])
    .in('status', ['submitted', 'paid', 'fulfilled']);
  if (error) {
    logQueryError('readStoreToolOrders', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const owned = new Set<PaidStoreTool>();
  const pending = new Set<PaidStoreTool>();
  for (const r of (data ?? []) as { service_key: string; status: string }[]) {
    const k = toolOfSku(r.service_key);
    if (!k) continue;
    (r.status === 'submitted' ? pending : owned).add(k);
  }
  return { owned, pending };
}

/**
 * SUBSCRIBED — is the shop on Plus, Pro or Ultra now? The subscription half of a paid widget (owner a02673ac), the SQL
 * `vendor_pro_tools_included` (service role). null = unread.
 */
async function readSubscribed(admin: SupabaseClient, vendorProfileId: string): Promise<boolean | null> {
  return admin.rpc('vendor_pro_tools_included', { p_vendor_profile_id: vendorProfileId, p_event_id: null }).then(
    ({ data, error }) => {
      if (error) {
        logQueryError('readStoreSubscribed', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
        return null;
      }
      return data === true;
    },
    () => null,
  );
}

/**
 * Do the free widgets open — Verified up? THE rule the day-of gate uses (`freeWidgetsOpen`), on the same row read
 * (`fetchVendorSpecializationSubscription`). An unreadable verification that the tier alone cannot settle = null.
 */
async function readFreeOpen(admin: SupabaseClient, vendorProfileId: string): Promise<boolean | null> {
  const sub = await fetchVendorSpecializationSubscription(admin, vendorProfileId);
  if (freeWidgetsOpen(sub, sub.verified)) return true;
  return sub.verified === null ? null : false;
}

/** Everything a tool row needs — one batch. */
export async function readStoreToolFacts(
  client: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
  services: readonly string[],
  layout: StoreLayout | null,
): Promise<ToolFacts> {
  const [freeOpen, orders, subscribed, prices, categoryLabels, hubOverrides] = await Promise.all([
    readFreeOpen(admin, vendorProfileId),
    readToolOrders(admin, vendorProfileId),
    readSubscribed(admin, vendorProfileId),
    readStoreToolPrices(admin),
    readCategoryLabels(client, vendorProfileId),
    readHubOverrides(admin),
  ]);
  return {
    freeOpen,
    owned: orders ? orders.owned : null,
    pending: orders ? orders.pending : null,
    subscribed,
    prices,
    picked: layout?.tools ?? null,
    toolsOff: layout?.toolsOff ?? [],
    categoryLabels,
    services,
    hubOverrides,
  };
}

/**
 * 🧰 One paid widget's Toolkit status for a page outside the Toolkit (the 3D booth and the photo challenge on a client's
 * event): the SAME `toolStatus` the Toolkit draws, from the same reads — owned, subscribed, in review, the catalog price.
 * `owned` = open (bought AND subscribed); `resubscribe` = owned, off-plan; `buy` carries the price and `needsPlan`.
 */
export async function readPaidWidgetStatus(admin: SupabaseClient, vendorProfileId: string, tool: PaidStoreTool): Promise<ToolStatus> {
  const [orders, subscribed, prices] = await Promise.all([
    readToolOrders(admin, vendorProfileId),
    readSubscribed(admin, vendorProfileId),
    readStoreToolPrices(admin),
  ]);
  return toolStatus(tool, {
    freeOpen: null,
    owned: orders ? orders.owned : null,
    pending: orders ? orders.pending : null,
    subscribed,
    prices,
    picked: null,
    toolsOff: [],
    categoryLabels: [],
    services: [],
  });
}

const FACTS_UNREAD = Symbol('badge facts unread');

/**
 * The badge tiles — the Shop's own shelf, read the Shop page's way (the tracker's facts, the reward engine beside them).
 * null = nothing could be read ("Couldn't load your badges"). Also hands back the tracker facts for the graph gates.
 */
export async function readStoreBadges(admin: SupabaseClient, vendorProfileId: string): Promise<{ tiles: ShelfTile[] | null; facts: TrackerFacts | null }> {
  const factsRead: Promise<TrackerFacts | null> = readShopTrackerFacts(vendorProfileId).catch((err: unknown) => {
    logQueryError('readStoreBadges.facts', err, { vendor_profile_id: vendorProfileId });
    return null;
  });
  const rewardsRead: Promise<TrackerRewardInput | null> = readBadgeRewardTracker(
    admin,
    vendorProfileId,
    factsRead.then((f) => (f ? f : Promise.reject(FACTS_UNREAD))),
  ).catch((err: unknown) => {
    if (err !== FACTS_UNREAD) logQueryError('readStoreBadges.rewards', err, { vendor_profile_id: vendorProfileId });
    return null;
  });
  const [facts, rewards] = await Promise.all([factsRead, rewardsRead]);
  const tiles =
    !facts && !rewards
      ? null
      : shopBadgeShelf({
          counts: rewards?.facts ?? null,
          verified: facts ? facts.verified : (rewards?.facts.verified ?? null),
          granted: rewards?.granted ?? null,
          names: rewards?.names,
        });
  return { tiles, facts };
}

/** Which badge graphs this shop sees — the Analytics section's own rule and reads (one-analytics-section.tsx). */
export async function readStoreGraphUnlocks(admin: SupabaseClient, vendorProfileId: string, facts: Promise<TrackerFacts | null>): Promise<GraphUnlocks> {
  const [unlock, fiveStars, giftPoints, f] = await Promise.all([
    readGraphUnlockFacts(admin, vendorProfileId).catch(() => null),
    readFiveStarCount(admin, vendorProfileId).catch(() => null),
    readGiftPoints(admin, vendorProfileId).catch(() => null),
    facts,
  ]);
  return graphUnlocks({
    kept: unlock ? unlock.kept : null,
    earned: unlock ? unlock.earned : null,
    counts: { completed_bookings: f ? f.completedEvents : null, five_star_reviews: fiveStars, gifts_given: giftPoints },
  });
}
