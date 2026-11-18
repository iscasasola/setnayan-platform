import 'server-only';

/**
 * discover-six-parts-data.ts — the reads behind Discover's two NEW shelves: Service cards (3) and Inspiration (6).
 *
 * Owner 16 Nov (DECISION_LOG "Discover in six parts", approved 41057aae · 45fd9c21 · 448fd3c1 · a85b0260; the drawing
 * `prototypes/discover_six_parts_2026-11-16/`). Discover lives inside the account, so these run for a signed-in
 * viewer only (`front-door.tsx`). Each degrades on its own: a refused read is `unavailable` and the shelf SAYS it
 * could not load — never an empty shelf that reads as "nothing here".
 *
 * Both are VERIFIED-SHOP-ONLY through the one findable fact (`is_findable` — verified AND listed, 15 Nov; no
 * Discover-only copy of it):
 *   · Service cards — the marketplace's own card read (`fetchMarketplaceServiceCards`, findable), drawn with
 *     the shipped `ServiceCardView` from the supplier view's own faces (`readMarketplaceCardFaces`): prices from the
 *     card, never typed, and hidden for a shop that hides them publicly, exactly as on its own page.
 *   · Inspiration — only photos a verified shop ALREADY SHOWS on its own shop (the shop page's own predicates:
 *     approved · not retired · not refused · a Files tag only while its photo is listed — `shownTagFilter`, failing
 *     closed), credited to the shop, with type · venue · month and never a name (`readTagEventLines`, ruling 4 of
 *     2026-11-14). `source_event_id` / `event_file_id` never leave this module.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchMarketplaceServiceCards } from '@/lib/marketplace-service-cards';
import { readMarketplaceCardFaces, type MarketplaceCardFace } from '@/lib/marketplace-service-card-faces';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { shopAddress } from '@/lib/service-card-address';
import { findableShopGate } from '@/lib/findable-shop';
import { galleryImageUrl } from '@/lib/moodboard-gallery';
import { libraryPartLabel } from '@/lib/moodboard-gallery-upload';
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { inspirationPartsInOrder } from '@/lib/inspiration-parts';
import { readTagEventLines, shownTagFilter } from '@/lib/inspiration-tags.server';

export type Shelf<T> = { status: 'ok'; items: T[] } | { status: 'unavailable' };

/* ── 3 · SERVICE CARDS ──────────────────────────────────────────────────────────────────────────────── */

export type DiscoverServiceCard = MarketplaceCardFace & { key: string };

/**
 * The newest service cards of verified shops — the shelf shows `limit`; "See all" opens the supplier view. Each card
 * is the supplier view's own face (`readMarketplaceCardFaces`), so a card is no thinner here than one click later.
 */
export async function loadDiscoverServiceCards(limit = 8): Promise<Shelf<DiscoverServiceCard>> {
  try {
    const admin = createAdminClient();
    const [cards, vocab] = await Promise.all([
      fetchMarketplaceServiceCards(admin, { limit }),
      getEventTypeVocab(),
    ]);
    const faceFor = await readMarketplaceCardFaces(admin, cards, new Map(vocab.map((t) => [t.key, t.label])), new Date());
    return { status: 'ok', items: cards.map((c) => ({ key: c.row.vendor_service_id, ...faceFor(c) })) };
  } catch (error) {
    logQueryError('discover.serviceCards', error, {}, 'graceful_degrade');
    return { status: 'unavailable' };
  }
}

/* ── 6 · INSPIRATION ────────────────────────────────────────────────────────────────────────────────── */

export type DiscoverInspirationPhoto = {
  id: string;
  url: string;
  /** The part, in the couple's words ("Bridal bouquet"). */
  part: string;
  partKey: string | null;
  /** The shop it is credited to, and its own page. */
  shop: string;
  shopHref: string | null;
  /** type · venue · month for a photo from a real event (never a name); null otherwise. */
  line: string | null;
};

export type DiscoverInspirationPart = { key: string; label: string };

type InspirationRow = {
  asset_id: string;
  asset_subtype: string | null;
  label: string | null;
  storage_path: string;
  event_file_id: string | null;
  shop: { business_name: string | null; business_slug: string | null } | null;
};

/**
 * Inspiration photos verified shops already show on their own shops, newest first. `part` narrows to one inspiration
 * part (`inspiration_parts.slot_key`, Parts ▾); an unknown part is ignored, never a 404.
 */
export async function loadDiscoverInspiration(
  limit = 12,
  part: string | null = null,
): Promise<Shelf<DiscoverInspirationPhoto> & { parts: DiscoverInspirationPart[] }> {
  const partsSnapshot = await getInspirationParts().catch(() => null);
  const parts: DiscoverInspirationPart[] = partsSnapshot
    ? inspirationPartsInOrder(partsSnapshot)
        .filter((p) => p.kind === 'part' && !p.hidden)
        .map((p) => ({ key: p.slotKey, label: p.label }))
    : [];
  const narrowTo = part && parts.some((p) => p.key === part) ? part : null;
  try {
    const admin = createAdminClient();
    let q = admin
      .from('moodboard_library_assets')
      // never source_event_id / source_suggestion_id; event_file_id only for the listing gate below
      .select('asset_id, asset_subtype, label, storage_path, event_file_id, shop:vendor_profiles!inner(business_name, business_slug)')
      .eq('asset_type', 'supplier_gallery')
      .not('approved_at', 'is', null)
      .is('retired_at', null)
      .is('rejected_at', null)
      .match(findableShopGate('shop'));
    if (narrowTo) q = q.eq('asset_subtype', narrowTo);
    // Over-read a little: a Files tag whose photo is not listed is dropped below, never shown.
    const { data, error } = await q.order('created_at', { ascending: false }).order('asset_id').limit(limit * 2);
    if (error) {
      logQueryError('discover.inspiration', error, {}, 'graceful_degrade');
      return { status: 'unavailable', parts };
    }
    const rows = (data ?? []) as unknown as InspirationRow[];
    const keep = await shownTagFilter(admin, rows);
    // 🛑 FAIL CLOSED: no listing answer drops every Files tag, never shows them all.
    const shown = rows.filter((r) => (keep ? keep(r) : !r.event_file_id)).slice(0, limit);
    const lines = await readTagEventLines(
      admin,
      shown.filter((r) => r.event_file_id).map((r) => r.asset_id),
    );
    return {
      status: 'ok',
      parts,
      items: shown.map((r) => ({
        id: r.asset_id,
        url: galleryImageUrl(r.storage_path),
        part:
          (r.asset_subtype && partsSnapshot ? libraryPartLabel(r.asset_subtype, partsSnapshot) : null) ??
          r.label?.trim() ??
          'Inspiration',
        partKey: r.asset_subtype,
        shop: r.shop?.business_name?.trim() || 'A Setnayan supplier',
        shopHref: shopAddress(r.shop?.business_slug),
        line: lines.get(r.asset_id)?.line ?? null,
      })),
    };
  } catch (error) {
    logQueryError('discover.inspiration', error, {}, 'graceful_degrade');
    return { status: 'unavailable', parts };
  }
}
