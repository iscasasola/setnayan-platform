import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { formatSkuPriceLabel, type PaxPricingConfig } from '@/lib/v2-catalog';
import { RecommendationsPanel } from './_panel';
import type {
  ConnectedCouple,
  LeafGroup,
  RecCard,
  SkuOption,
} from './_panel';

// service_code → Studio add-on key, restricted to RECOMMENDABLE add-ons (real,
// buyable, not-free, has a serviceKey — mirrors the Studio hub's isRecommendable
// + the suggest action's RECOMMENDABLE_KEYS). A recommendation whose SKU isn't a
// recommendable add-on (e.g. a free tool, or a SKU with no Studio surface) gets
// no "Suggest to a couple" control — there's nothing the couple could buy in the
// Studio hub from it.
const ADDON_KEY_BY_SERVICE_CODE = new Map<string, string>(
  ADD_ONS.filter(
    (a) => a.status !== 'coming_soon' && a.tier !== 'free' && Boolean(a.serviceKey),
  ).map((a) => [a.serviceKey as string, a.key]),
);

export const metadata = { title: 'Recommend · Vendor' };
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    flagged?: string;
    suggested?: string;
  }>;
};

/**
 * "Recommend to your couples" panel (Phase 3a).
 *
 * A curated, read-mostly list of Setnayan SKUs that AMPLIFY the vendor's own
 * work — keyed to the vendor's own service leaves (tile_ids). The admin map
 * (vendor_service_recommendations) decides which SKUs surface per leaf; the
 * vendor opts into cannibalization-risk ("opt-in") ones and can flag the map
 * for admin review ("not a fit" / "I'd also recommend X"). NO couple-facing
 * output in this phase — this is the vendor's private curation surface.
 *
 * Auth + profile resolution mirror the sibling vendor tabs (services /
 * moodboard-library): own the page off `fetchOwnVendorProfile`, bounce to the
 * dashboard root if the caller doesn't own / belong to a vendor profile. The
 * vendor-dashboard layout already gates hasVendorAccess; this is the per-page
 * belt-and-braces every sibling repeats.
 */
export default async function VendorRecommendationsPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const vendorProfileId = profile.vendor_profile_id;
  const services = profile.services ?? [];

  // Connected couples the vendor can suggest to = their ACCEPTED chat threads
  // (one per couple/event). Reuse the canonical vendor-inbox query
  // (fetchVendorThreads, used by Clients + Messages) so the label matches every
  // other vendor surface: the couple appears as the event display_name they
  // identified themselves with (personal names stay private). RLS already scopes
  // these threads to this vendor's profile.
  const allThreads = await fetchVendorThreads(supabase, vendorProfileId);
  const connectedCouples: ConnectedCouple[] = allThreads
    .filter((t) => t.inquiry_status === 'accepted')
    .map((t) => ({
      eventId: t.event_id,
      label: t.event?.display_name ?? 'A Setnayan event',
    }));

  // Existing pending suggestions this vendor has already sent, so a (couple,
  // add-on) pair the vendor already suggested renders "Suggested ✓" instead of
  // the picker. Key: "<event_id>::<addon_key>". RLS (vfr_vendor_select) scopes
  // these to this vendor's own rows.
  const { data: sentRows } = await supabase
    .from('vendor_feature_recommendations')
    .select('event_id, addon_key')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'pending');
  const suggestedKeys = new Set(
    ((sentRows ?? []) as { event_id: string; addon_key: string }[]).map(
      (r) => `${r.event_id}::${r.addon_key}`,
    ),
  );

  // 1) The vendor's leaves: services[] (canonical_service codes) → DISTINCT
  //    tile_ids via canonical_service_taxonomy. A vendor advertising
  //    `videography` maps to the `photo_video` tile; recommendations key off
  //    the tile, so two photo/video acts see the same map.
  let tileIds: string[] = [];
  if (services.length > 0) {
    const { data: taxRows } = await supabase
      .from('canonical_service_taxonomy')
      .select('tile_id')
      .in('canonical_service', services);
    tileIds = Array.from(
      new Set(
        ((taxRows ?? []) as { tile_id: string | null }[])
          .map((r) => r.tile_id)
          .filter((t): t is string => typeof t === 'string' && t.length > 0),
      ),
    );
  }

  // No leaves with a tile → nothing to recommend. Render the empty state.
  if (tileIds.length === 0) {
    return (
      <RecommendationsPanel
        groups={[]}
        suggestSkuOptions={[]}
        connectedCouples={connectedCouples}
        suggestedKeys={[...suggestedKeys]}
        savedFlash={!!search.saved}
        flaggedFlash={!!search.flagged}
        suggestedFlash={!!search.suggested}
        errorFlash={search.error ? decodeURIComponent(search.error) : null}
      />
    );
  }

  // 2) Active recommendations for THIS vendor's leaves, joined to SKU
  //    title/price (platform_retail_catalog_v2) + leaf label (service_categories).
  //    Ordered by tile_id, priority so the panel groups + ranks consistently.
  const { data: recRows } = await supabase
    .from('vendor_service_recommendations')
    .select('tile_id, service_code, is_opt_in, priority, rationale')
    .eq('is_active', true)
    .in('tile_id', tileIds)
    .order('tile_id', { ascending: true })
    .order('priority', { ascending: true });
  const recs = (recRows ?? []) as {
    tile_id: string;
    service_code: string;
    is_opt_in: boolean;
    priority: number;
    rationale: string | null;
  }[];

  // 3) This vendor's own opt-in state + open (pending) feedback rows.
  const [optinRes, feedbackRes, catalogRes, leafRes] = await Promise.all([
    supabase
      .from('vendor_recommendation_optins')
      .select('tile_id, service_code, enabled')
      .eq('vendor_profile_id', vendorProfileId),
    supabase
      .from('vendor_recommendation_feedback')
      .select('tile_id, service_code, feedback_type')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'pending'),
    // SKU display fields for every recommended code + every active SKU (the
    // "suggest a service" picker offers any active SKU). One read covers both.
    supabase
      .from('platform_retail_catalog_v2')
      .select(
        'service_code, title, retail_price_php, billing_period, is_active, is_pax_priced, pax_floor, pax_floor_price_php, pax_increment_size, pax_increment_price_php',
      )
      .eq('is_active', true),
    // Leaf labels for the vendor's tiles.
    supabase
      .from('service_categories')
      .select('id, label_en')
      .in('id', tileIds),
  ]);

  type CatalogRow = PaxPricingConfig & {
    service_code: string;
    title: string;
  };
  const catalog = (catalogRes.data ?? []) as CatalogRow[];
  const catalogByCode = new Map(catalog.map((c) => [c.service_code, c]));

  const leafLabelById = new Map(
    ((leafRes.data ?? []) as { id: string; label_en: string }[]).map((l) => [
      l.id,
      l.label_en,
    ]),
  );

  // Opt-in lookup: "<tile_id>::<service_code>" → enabled.
  const optinByKey = new Map<string, boolean>();
  for (const o of (optinRes.data ?? []) as {
    tile_id: string;
    service_code: string;
    enabled: boolean;
  }[]) {
    optinByKey.set(`${o.tile_id}::${o.service_code}`, o.enabled);
  }

  // Pending-feedback lookups so cards/leaves can show "Flagged — pending review".
  // not_a_fit is keyed per (tile, service_code); suggest_add is keyed per tile
  // (the vendor flagged "I'd recommend more under this leaf").
  const pendingNotAFit = new Set<string>();
  const pendingSuggestByTile = new Set<string>();
  for (const f of (feedbackRes.data ?? []) as {
    tile_id: string;
    service_code: string | null;
    feedback_type: string;
  }[]) {
    if (f.feedback_type === 'not_a_fit' && f.service_code) {
      pendingNotAFit.add(`${f.tile_id}::${f.service_code}`);
    } else if (f.feedback_type === 'suggest_add') {
      pendingSuggestByTile.add(f.tile_id);
    }
  }

  // Build the price label for a recommended SKU. Missing catalog row (a rec
  // pointing at an inactive/removed SKU) → show the title only, no price.
  function skuView(serviceCode: string): { title: string; priceLabel: string | null } {
    const row = catalogByCode.get(serviceCode);
    if (!row) return { title: serviceCode, priceLabel: null };
    return {
      title: row.title,
      // No event pax context here → pax-priced SKUs render "from ₱X"; the
      // same helper every other vendor/couple surface uses. Never hand-format.
      priceLabel: formatSkuPriceLabel(row, null),
    };
  }

  // 4) Group recs by leaf (tile_id), splitting each into the active list
  //    (always-on recs + enabled opt-ins) vs pending opt-in offers (opt-in recs
  //    with no enabled optin row yet).
  const byTile = new Map<string, typeof recs>();
  for (const r of recs) {
    const arr = byTile.get(r.tile_id) ?? [];
    arr.push(r);
    byTile.set(r.tile_id, arr);
  }

  const groups: LeafGroup[] = [];
  // Preserve the tile order recs arrived in (already ordered by tile_id).
  const seenTiles: string[] = [];
  for (const r of recs) {
    if (!seenTiles.includes(r.tile_id)) seenTiles.push(r.tile_id);
  }

  for (const tileId of seenTiles) {
    const tileRecs = byTile.get(tileId) ?? [];
    const active: RecCard[] = [];
    const offers: RecCard[] = [];

    for (const r of tileRecs) {
      const { title, priceLabel } = skuView(r.service_code);
      const enabledOptin = optinByKey.get(`${r.tile_id}::${r.service_code}`);
      const card: RecCard = {
        tileId: r.tile_id,
        serviceCode: r.service_code,
        title,
        priceLabel,
        rationale: r.rationale,
        isOptIn: r.is_opt_in,
        // Opt-in is "active" only when the vendor has an enabled optin row.
        optInEnabled: enabledOptin === true,
        flaggedNotAFit: pendingNotAFit.has(`${r.tile_id}::${r.service_code}`),
        // Studio add-on key IF this SKU is a recommendable in-app service — drives
        // the "Suggest to a couple" control. null → no control (free / coming-soon
        // / no Studio surface, so nothing the couple could buy from the hub).
        addonKey: ADDON_KEY_BY_SERVICE_CODE.get(r.service_code) ?? null,
      };
      if (r.is_opt_in && enabledOptin !== true) {
        offers.push(card);
      } else {
        active.push(card);
      }
    }

    groups.push({
      tileId,
      leafLabel: leafLabelById.get(tileId) ?? tileId,
      active,
      offers,
      suggestFlagged: pendingSuggestByTile.has(tileId),
    });
  }

  // 5) "Suggest a service to recommend" picker — any active SKU. Sorted by
  //    title for a scannable dropdown.
  const suggestSkuOptions: SkuOption[] = catalog
    .map((c) => ({
      serviceCode: c.service_code,
      title: c.title,
      priceLabel: formatSkuPriceLabel(c, null),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <RecommendationsPanel
      groups={groups}
      suggestSkuOptions={suggestSkuOptions}
      connectedCouples={connectedCouples}
      suggestedKeys={[...suggestedKeys]}
      savedFlash={!!search.saved}
      flaggedFlash={!!search.flagged}
      suggestedFlash={!!search.suggested}
      errorFlash={search.error ? decodeURIComponent(search.error) : null}
    />
  );
}
