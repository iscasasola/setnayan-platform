import 'server-only';

/**
 * lib/shop-inspiration.server.ts — 🔗🖼 THE SUPPLIER'S OWN INSPIRATION, AS ITS PAGE SHOWS IT (owner 2026-10-30,
 * DECISION_LOG "A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS …" item 3: "the supplier's approved inspiration
 * photos show on their own page (/v/[slug]) in an Inspiration section, per the approved website-by-plan design").
 *
 * ONE batched read for the whole page (the house rule "one batched read per screen"), PAGED to the end through the
 * house's one paging helper `readAllPages` — PostgREST caps a single request at 1,000 rows and answers the capped set
 * with `error: null`, which would render exactly like "this shop has no more photos" (lib/inspiration-parts-db.ts
 * learned it on 2026-10-30). A read that cannot prove it reached the end is `null`, and the page then draws no
 * Inspiration section — never a partial one presented as the whole.
 *
 * 🛑 WHAT MAY BE SHOWN — every predicate below is load-bearing (`shop-inspiration-read-is-the-public-pool.test.ts`
 * pins each, and the db test replays the same predicates against the real schema):
 *   · `asset_type = 'supplier_gallery'` and `vendor_profile_id = <this shop>` — the shop's own inspiration only;
 *   · `approved_at IS NOT NULL` — Setnayan's admin approved it (a suggestion's pool copy lands PENDING, so it is here
 *     only after that approval);
 *   · `retired_at IS NULL` and `rejected_at IS NULL` — not taken down, not refused;
 * which is the public read policy's own door (`moodboard_library_assets_public_read`) narrowed to one shop.
 * 🔒 Event-linked photos are in the pool only after the event checks ran at the door that filed them
 * (`importEditorialMediaToGallery`: moderation clean · not hidden by the couple · still the couple's recommended
 * supplier; `importSuggestionToGallery`: still booked · not an album photo) AND that same admin approval. The event id
 * itself is never read here (`source_event_id` stays revoked from the public roles — MB11).
 *
 * Read on the service-role client the page already holds, scoped by the shop the page resolved as published.
 */
import { readAllPages } from '@/lib/read-all-pages';
import { logQueryError } from '@/lib/supabase/error-detect';
import { galleryImageUrl } from '@/lib/moodboard-gallery';
import { libraryPartLabel } from '@/lib/moodboard-gallery-upload';
import type { InspirationPartsSnapshot } from '@/lib/inspiration-parts';

/** One approved look on the shop's page. Plain data — crosses to the client. */
export type ShopInspirationLook = {
  id: string;
  url: string;
  /** The part, in the couple's words ("Bridal bouquet"). */
  part: string;
  /** The shop's own service card it belongs to, or null (the shop only). */
  vendorServiceId: string | null;
};

/** The columns read — never `source_event_id`, never `source_suggestion_id`. */
export const SHOP_INSPIRATION_COLUMNS = 'asset_id, asset_subtype, label, storage_path, vendor_service_id';
export const SHOP_INSPIRATION_PAGE = 500;

type Row = { asset_id: string; asset_subtype: string | null; label: string | null; storage_path: string; vendor_service_id: string | null };

/** The smallest slice of the Supabase client this read needs (so a fake can record the predicates). */
export type ShopInspirationQuery = {
  eq(column: string, value: string): ShopInspirationQuery;
  not(column: string, op: 'is', value: null): ShopInspirationQuery;
  is(column: string, value: null): ShopInspirationQuery;
  order(column: string, options: { ascending: boolean }): ShopInspirationQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count?: number | null }>;
};
export type ShopInspirationClient = {
  from(table: 'moodboard_library_assets'): { select(columns: string, options: { count: 'exact' }): ShopInspirationQuery };
};

/** Every approved, live inspiration photo of ONE shop, newest first. `null` = the read failed or could not finish. */
export async function fetchShopInspirationLooks(
  client: ShopInspirationClient,
  vendorProfileId: string,
  parts: InspirationPartsSnapshot,
): Promise<ShopInspirationLook[] | null> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await client
        .from('moodboard_library_assets')
        .select(SHOP_INSPIRATION_COLUMNS, { count: 'exact' })
        .eq('vendor_profile_id', vendorProfileId)
        .eq('asset_type', 'supplier_gallery')
        .not('approved_at', 'is', null)
        .is('retired_at', null)
        .is('rejected_at', null)
        .order('created_at', { ascending: false })
        .order('asset_id', { ascending: true })
        .range(from, to);
      return { rows: data, error: error?.message ?? null, total: count ?? null };
    },
    { pageSize: SHOP_INSPIRATION_PAGE },
  );
  if (read.error || !read.complete) {
    logQueryError(
      'shopInspiration.read',
      { message: read.error ?? 'the read did not reach the end' },
      { vendorProfileId },
      'graceful_degrade',
    );
    return null;
  }
  return (read.rows as Row[]).map((r) => ({
    id: r.asset_id,
    url: galleryImageUrl(r.storage_path),
    part: (r.asset_subtype ? libraryPartLabel(r.asset_subtype, parts) : null) ?? r.label?.trim() ?? 'Inspiration',
    vendorServiceId: r.vendor_service_id ?? null,
  }));
}

/** The looks of each card, in page order — `inspirationLooks` on that card. A look with no card is the shop's only. */
export function looksByCard(looks: readonly ShopInspirationLook[]): Map<string, ShopInspirationLook[]> {
  const out = new Map<string, ShopInspirationLook[]>();
  for (const l of looks) {
    if (!l.vendorServiceId) continue;
    const bucket = out.get(l.vendorServiceId);
    if (bucket) bucket.push(l);
    else out.set(l.vendorServiceId, [l]);
  }
  return out;
}
