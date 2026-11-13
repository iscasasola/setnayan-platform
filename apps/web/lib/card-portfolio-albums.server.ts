import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { signStoredRef } from '@/lib/supplier-file-sign.server';
import {
  cardAlbums,
  shopWorkAlbums,
  type AlbumEvent,
  type BookedPair,
  type BookedVia,
  type CardAlbum,
  type CardRef,
  type ListedFileRow,
  type PageNoticeRow,
  type WorkAlbum,
} from '@/lib/card-portfolio-albums';

/**
 * 🃏📸 ONE ALBUM, TWO PLACES — the server read (`cardPortfolioAlbums`, the ONE new read the approved drawing names).
 * Pure rules: `lib/card-portfolio-albums.ts`.
 *
 * `admin` is the service-role client: `card_portfolio_booked_events` returns couples' event ids and is granted to
 * service_role only. Every caller has already proved the cards are the shop's OWN (the edit sheet, Their work) or are
 * live cards of a published shop (the couple's grown card). Nothing here draws an id, a name or a date.
 *
 * 🔑 A refused read is `null` — "Couldn't load · Retry" — never an empty portfolio (an empty portfolio is a claim).
 */
export type ShopWork = { albums: WorkAlbum[]; cards: Map<string, CardRef> };

type PairRow = { vendor_service_id: string; event_id: string; delivered: boolean | null; via: string };

export async function readShopWork(
  admin: SupabaseClient,
  args: { vendorProfileId: string; serviceIds?: readonly string[]; now?: Date },
): Promise<ShopWork | null> {
  const { vendorProfileId } = args;
  const cardsRes = await admin
    .from('vendor_services')
    .select('vendor_service_id, title, category, is_active')
    .eq('vendor_profile_id', vendorProfileId);
  if (cardsRes.error) {
    logQueryError('readShopWork.cards', cardsRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const cards = new Map<string, CardRef>();
  for (const c of (cardsRes.data ?? []) as { vendor_service_id: string; title: string | null; category: string; is_active: boolean | null }[]) {
    cards.set(c.vendor_service_id, { id: c.vendor_service_id, title: c.title, category: c.category, isActive: c.is_active === true });
  }
  // Only this shop's own cards are ever asked about.
  const ask = (args.serviceIds ?? [...cards.keys()]).filter((id) => cards.has(id));
  if (ask.length === 0) return { albums: [], cards };

  const pairsRes = await admin.rpc('card_portfolio_booked_events', { p_service_ids: ask });
  if (pairsRes.error) {
    logQueryError('readShopWork.pairs', pairsRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const pairs: BookedPair[] = ((pairsRes.data ?? []) as PairRow[]).map((r) => ({
    serviceId: r.vendor_service_id,
    eventId: r.event_id,
    delivered: r.delivered === true,
    via: (['booking', 'lock', 'quote'].includes(r.via) ? r.via : 'booking') as BookedVia,
  }));
  const eventIds = [...new Set(pairs.map((p) => p.eventId))];
  if (eventIds.length === 0) return { albums: [], cards };

  const [eventsRes, noticesRes, listedRes] = await Promise.all([
    admin.from('events').select('event_id, event_type, event_date, venue_name, landing_page_visibility').in('event_id', eventIds),
    admin
      .from('supplier_page_photo_notices')
      .select('photo_id, event_id, page_ref, noticed_at, public_from, published_at, removed_at, vendor_papic_portfolio_photos(hidden_at)')
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', eventIds)
      .not('published_at', 'is', null)
      .is('removed_at', null),
    admin
      .from('event_supplier_photos_listed')
      .select('file_id, event_id, vendor_service_id, media_id, kind, decided_at')
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', eventIds)
      .eq('kind', 'photo'),
  ]);
  const err = eventsRes.error ?? noticesRes.error ?? listedRes.error;
  if (err) {
    logQueryError('readShopWork.albums', err, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const listed = (listedRes.data ?? []) as { file_id: string; event_id: string; vendor_service_id: string | null; media_id: string; decided_at: string | null }[];
  const mediaIds = [...new Set(listed.map((f) => f.media_id).filter(Boolean))];
  const mediaRes = mediaIds.length
    ? await admin.from('supplier_media').select('media_id, r2_ref, created_at').eq('vendor_profile_id', vendorProfileId).in('media_id', mediaIds)
    : { data: [], error: null };
  if (mediaRes.error) {
    logQueryError('readShopWork.media', mediaRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const media = new Map(((mediaRes.data ?? []) as { media_id: string; r2_ref: string; created_at: string }[]).map((m) => [m.media_id, m]));

  const events = new Map<string, AlbumEvent>();
  for (const e of (eventsRes.data ?? []) as {
    event_id: string;
    event_type: string | null;
    event_date: string | null;
    venue_name: string | null;
    landing_page_visibility: string | null;
  }[]) {
    events.set(e.event_id, {
      eventId: e.event_id,
      eventType: e.event_type,
      eventDate: e.event_date,
      venueName: e.venue_name,
      isPrivate: e.landing_page_visibility === 'private',
    });
  }
  const notices: PageNoticeRow[] = await Promise.all(
    ((noticesRes.data ?? []) as {
      photo_id: string;
      event_id: string;
      page_ref: string;
      noticed_at: string;
      public_from: string;
      published_at: string | null;
      removed_at: string | null;
      vendor_papic_portfolio_photos: { hidden_at: string | null } | { hidden_at: string | null }[] | null;
    }[]).map(async (n) => {
      const album = Array.isArray(n.vendor_papic_portfolio_photos) ? n.vendor_papic_portfolio_photos[0] : n.vendor_papic_portfolio_photos;
      return {
        photoId: n.photo_id,
        eventId: n.event_id,
        url: await displayUrlForStoredAsset(n.page_ref).catch(() => null),
        noticedAt: n.noticed_at,
        publicFrom: n.public_from,
        publishedAt: n.published_at,
        removedAt: n.removed_at,
        // No album row read back = treat as hidden: never show a photo whose takedown state is unknown.
        albumHiddenAt: album ? album.hidden_at : 'unknown',
      };
    }),
  );
  const files: ListedFileRow[] = await Promise.all(
    listed.map(async (f) => {
      const m = media.get(f.media_id);
      return {
        fileId: f.file_id,
        eventId: f.event_id,
        serviceId: f.vendor_service_id,
        url: m ? await signStoredRef(m.r2_ref, vendorProfileId) : null,
        at: f.decided_at ?? m?.created_at ?? '',
      };
    }),
  );
  return { albums: shopWorkAlbums({ pairs, events, notices, files, now: args.now ?? new Date() }), cards };
}

/** `cardPortfolioAlbums(serviceId)` — one card's albums, the same objects Their work holds. null = unread. */
export async function cardPortfolioAlbums(
  admin: SupabaseClient,
  args: { vendorProfileId: string; serviceId: string },
): Promise<CardAlbum[] | null> {
  const work = await readShopWork(admin, { vendorProfileId: args.vendorProfileId, serviceIds: [args.serviceId] });
  return work ? cardAlbums(work.albums, args.serviceId) : null;
}
