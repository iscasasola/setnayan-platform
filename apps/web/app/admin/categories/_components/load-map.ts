/**
 * load-map.ts — the reads the four-level map adds on top of `loadCategories` (🌳 ③b): the parts and the
 * services they link, the services' Order ▾ place, and the service cards (PLAN § 7.8). Server only
 * (service-role admin client).
 *
 * 🔑 A REFUSED READ IS SAID, NEVER SHOWN AS EMPTY (`load.ts`'s rule). The parts read failing sets
 * `partsRead = false` and the Parts column says "Couldn't load the parts"; the cards read failing sets
 * `cardsRead = false` — never "No service card yet." to an admin whose shops exist. Parts are read from
 * the TABLES here, not through `getInspirationParts()`, whose contract is to fall back to the seed on an
 * error: an admin editing the tables must see the tables.
 *
 * Real data only (owner rule for this build: no sample cards in the product). Demo shops' cards
 * (`is_demo`) are left out of the counts and the column, exactly as the prototype's "live card on prod"
 * count was taken.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readEveryPartRow, type PartTablesClient } from '@/lib/inspiration-parts-db';
import type { CategoriesData } from './load';
import type { MapCard, MapData, MapPart, MapService } from './four-level-model';

type Admin = ReturnType<typeof createAdminClient>;

/** The only public shop state (lib/vendor-visibility.ts PUBLIC_SURFACE_VISIBILITIES). */
const PUBLIC = 'verified';

export async function loadMapData(admin: Admin, cats: CategoriesData): Promise<MapData> {
  /*
    📄 The parts and their links are read to the END (`lib/inspiration-parts-db.ts`). One un-ranged select of
    `inspiration_part_services` was capped by PostgREST at 1,000 of ~2,769 rows with `error: null` (PR #7058's
    seed), and Reception › Events Place showed only its 2 old parts. A read that stops short is an error here,
    so the Parts column says "Couldn't load the parts" instead of drawing the first thousand links as all of them.
  */
  const pagedDb = admin as unknown as PartTablesClient;
  const [partsRes, linksRes, orderRes, cardsRes] = await Promise.all([
    readEveryPartRow<{
      slot_key: string;
      label_en: string;
      kind: string;
      home_category_id: string | null;
      sort_order: number;
      hidden: boolean;
      status: string;
    }>(pagedDb, 'parts'),
    readEveryPartRow<{ slot_key: string; canonical_service: string; sort_order: number }>(pagedDb, 'services'),
    admin.from('canonical_service_taxonomy').select('canonical_service, sort_order'),
    admin
      .from('vendor_services')
      .select('vendor_service_id, title, starting_price_php, is_active, category, vendor_profile_id, primary_photo_r2_key')
      .eq('is_demo', false)
      .limit(5000),
  ]);
  if (partsRes.error) logQueryError('CategoriesMap (inspiration_parts)', { message: partsRes.error });
  if (linksRes.error) logQueryError('CategoriesMap (inspiration_part_services)', { message: linksRes.error });
  if (cardsRes.error) logQueryError('CategoriesMap (vendor_services)', cardsRes.error);
  // The Order ▾ column (20271292221070) — a failure only loses the custom order, never the services.
  if (orderRes.error) logQueryError('CategoriesMap (service order)', orderRes.error);

  // ── services, in Order ▾ then A–Z ──────────────────────────────────────────
  const order = new Map(((orderRes.data ?? []) as Array<{ canonical_service: string; sort_order: number | null }>).map((r) => [r.canonical_service, r.sort_order ?? 0]));
  const cardRows = (cardsRes.data ?? []) as Array<{
    vendor_service_id: string;
    title: string | null;
    starting_price_php: number | null;
    is_active: boolean | null;
    category: string | null;
    vendor_profile_id: string;
    primary_photo_r2_key: string | null;
  }>;
  const cardCount = new Map<string, number>();
  for (const r of cardRows) if (r.category) cardCount.set(r.category, (cardCount.get(r.category) ?? 0) + 1);
  const services: MapService[] = [...cats.services]
    .sort((a, b) => (order.get(a.canonical) ?? 0) - (order.get(b.canonical) ?? 0) || a.en.localeCompare(b.en))
    .map((s) => ({ key: s.canonical, label: s.en, tileId: s.tileId, hidden: s.hidden, cards: cardCount.get(s.canonical) ?? 0 }));

  // ── parts ───────────────────────────────────────────────────────────────────
  const partsRead = !partsRes.error && !linksRes.error;
  const linkRows = [...linksRes.rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.canonical_service.localeCompare(b.canonical_service),
  );
  const linksBy = new Map<string, string[]>();
  for (const l of linkRows) linksBy.set(l.slot_key, [...(linksBy.get(l.slot_key) ?? []), l.canonical_service]);
  const parts: MapPart[] = partsRes.rows
    // Palette (kind = 'system', no home) is nobody's portfolio — kept out of the columns, as the prototype does.
    .filter((p) => p.kind === 'part' && p.status !== 'retired' && p.home_category_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.slot_key.localeCompare(b.slot_key))
    .map((p) => ({ key: p.slot_key, label: p.label_en, home: p.home_category_id!, services: linksBy.get(p.slot_key) ?? [], hidden: p.hidden }));

  // ── cards ───────────────────────────────────────────────────────────────────
  let cardsRead = !cardsRes.error;
  const shopIds = [...new Set(cardRows.map((r) => r.vendor_profile_id))];
  const shops = new Map<string, { name: string; public: boolean }>();
  if (shopIds.length > 0) {
    const shopRes = await admin.from('vendor_profiles').select('vendor_profile_id, business_name, public_visibility').in('vendor_profile_id', shopIds);
    if (shopRes.error) {
      logQueryError('CategoriesMap (vendor_profiles)', shopRes.error);
      cardsRead = false;
    }
    for (const v of (shopRes.data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null; public_visibility: string | null }>) {
      shops.set(v.vendor_profile_id, { name: v.business_name ?? 'A shop', public: v.public_visibility === PUBLIC });
    }
  }
  const cards: MapCard[] = cardRows
    .filter((r) => r.category)
    .map((r) => ({
      id: r.vendor_service_id,
      title: r.title?.trim() || 'Untitled card',
      price: r.starting_price_php,
      active: r.is_active === true,
      service: r.category!,
      shopId: r.vendor_profile_id,
      shopName: shops.get(r.vendor_profile_id)?.name ?? 'A shop',
      shopPublic: shops.get(r.vendor_profile_id)?.public ?? false,
      photoUrl: publicUrlForStoredAsset(r.primary_photo_r2_key),
    }));

  return {
    groups: cats.groups.map((g) => ({ id: g.id, label: g.label, iconName: g.iconName, hidden: cats.tax.hiddenCategories[g.id] === true })),
    categories: cats.categories.map((c) => ({
      id: c.id,
      groupId: c.groupId,
      label: c.label,
      hidden: c.hidden,
      iconName: c.iconName,
      coarse: cats.tax.tileCoarseCategory[c.id] ?? null,
    })),
    services,
    parts,
    cards,
    partsRead,
    cardsRead,
  };
}
