import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { MICROSITE_COLUMNS, micrositeFromRow } from '@/lib/vendor-microsite';
import { pageSavedFrom, type PageSaved } from '@/lib/supplier-page-draft';
import type { CollectionsInput } from '@/lib/supplier-collections';
import { portfolioPhotoCap } from '@/lib/vendor-tier-caps';
import { allowanceForCap, readPortfolioAllowance } from '@/lib/portfolio-allowance.server';
import { fetchShopWalletBalance } from '@/lib/shop-wallet.server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { isInstagramConnectConfigured } from '@/lib/vendor-instagram';
import {
  fetchVendorIgConnection,
  fetchVendorIgMediaForOwner,
  type VendorIgConnectionStatus,
  type VendorIgMediaRow,
} from '@/lib/vendor-instagram-status';
import { moodboardLibraryAccessForProfile } from '@/lib/moodboard-library-access';
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { visiblePortfolioPhotos } from '@/lib/vendor-papic-portfolio-album';
import { fetchVendorPoolBookings, type PoolBookingEntry } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { fetchShopInspirationLooks, type ShopInspirationClient } from '@/lib/shop-inspiration.server';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { videoTitlesOf } from '@/lib/video-link-titles';
import {
  ALBUM_OPEN_MAX,
  eventAlbums,
  inspirationAlbums,
  serviceAlbums,
  type PortfolioGroups,
} from '@/lib/portfolio-groups';

/**
 * YOUR COLLECTIONS — one count per store, read where each already lives (simpler supplier dashboard step 5;
 * `lib/supplier-collections.ts` names every store and why it is or is not switchable).
 *
 * 🔑 COUNTS, NOT ROWS. Every store is asked for the least that answers "how many, and from how many events": a head
 * count where the number is the answer, the one id column where "from N events" is. Nothing is presigned but the page
 * gallery (its uploader draws thumbnails) — opening a collection is that collection's own screen.
 *
 * 🔑 EACH READ FAILS ON ITS OWN, INTO "NOT READ". A refused count is `null` in `CollectionsInput`, which the row
 * prints as "Could not be read just now" — never "Nothing yet", which would be a claim about the supplier.
 *
 * The page's published curation is read in the same select as the plan, so the "show on my page" switch is compared
 * against the page AS PUBLISHED — the same `PageSaved` Your page prunes its draft against (`pageSavedFrom`).
 */
export type CollectionsData = {
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  portfolioRefs: string[];
  portfolioDisplayMap: Record<string, string>;
  portfolioMax: number;
  /** The shop's own allowance could not be read — the widget says so instead of "first 50 free". */
  portfolioAllowanceUnread: boolean;
  /** 💳 The shop wallet the portfolio spends past its free room. `null` = unread — never 0. */
  walletBalance: number | null;
  galleryVideoLinks: string[];
  /** 🎬 Each video link's title, keyed by the link (`lib/video-link-titles.ts`). null = the row was unread — the editor
   *  then offers no Title field, so a save can never wipe titles it could not see. */
  videoTitles: Record<string, string> | null;
  igConfigured: boolean;
  igConnection: VendorIgConnectionStatus | null;
  igMedia: VendorIgMediaRow[];
  igUnavailable: boolean;
  /**
   * 🖼 THE ALBUMS OPEN IN PLACE (owner 8 Nov, spec §10 #24: "each album can expand"): up to 9 display URLs per
   * collection that can show its photos here (the page gallery, the service cards, Instagram), plus how many it holds
   * — the grid's last tile says "+N". A collection not listed opens its own screen (albums by event, own shots,
   * delivered, the mood board). A URL that could not be presigned is left out, never drawn broken.
   */
  previews: Partial<Record<'page' | 'cards' | 'instagram', { urls: string[]; total: number }>>;
  /**
   * 🖼 THE THREE GROUPS + the stories (Build 2 §10 #35 + the parity item "stories couples published"): every album a
   * store that already exists (`lib/portfolio-groups.ts`). Each album opens into the body (§10 #40).
   */
  groups: PortfolioGroups;
  /** 🌱 The shop's trades supply an inspiration part — Portfolio draws "Add to the inspiration library" (moved from Shop). */
  libraryOpen: boolean;
};

/** How many photos an opened album shows before its "+N" tile (spec §10 #24: "first 9"). */
export const ALBUM_PREVIEW = 9;

/** The Instagram media read is capped (`fetchVendorIgMediaForOwner`); at the cap the count says "N+". */
const IG_LIMIT = 30;

export async function loadCollectionsData(
  supabase: SupabaseClient,
  profile: VendorProfileRow,
  userId: string,
): Promise<CollectionsData> {
  const vendorId = profile.vendor_profile_id;
  const portfolioRefs = (profile.portfolio_r2_keys ?? []) as string[];
  const galleryVideoLinks = (profile.gallery_video_links ?? []) as string[];

  const ownRead = (async () => {
    const { data, error } = await supabase
      .from('vendor_profiles')
      // `gallery_video_titles` rides this one row read (Video links' titles, migration 20271334860034) — no new request.
      .select(`tier_state, gallery_video_titles, ${MICROSITE_COLUMNS}`)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    if (error) logQueryError('VendorCollections.ownRow', error, { vendorId }, 'graceful_degrade');
    return (data as Record<string, unknown> | null) ?? null;
  })().catch((err) => {
    logQueryError('VendorCollections.ownRow', err, { vendorId });
    return null;
  });

  const cardsRead = (async () => {
    const { data, error } = await supabase
      .from('vendor_services')
      .select('vendor_service_id, title, primary_photo_r2_key, showcase_photo_r2_keys, showcase_video_r2_key')
      .eq('vendor_profile_id', vendorId)
      .order('created_at', { ascending: false });
    if (error) {
      logQueryError('VendorCollections.cards', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as {
      vendor_service_id: string;
      title: string | null;
      primary_photo_r2_key: string | null;
      showcase_photo_r2_keys: string[] | null;
      showcase_video_r2_key: string | null;
    }[];
    const keys = rows.flatMap((r) => [r.primary_photo_r2_key, ...(r.showcase_photo_r2_keys ?? [])]).filter((k): k is string => Boolean(k));
    return {
      cards: rows.length,
      photos: rows.reduce((a, r) => a + (r.primary_photo_r2_key ? 1 : 0) + (r.showcase_photo_r2_keys?.length ?? 0), 0),
      videos: rows.filter((r) => r.showcase_video_r2_key).length,
      previewKeys: keys.slice(0, ALBUM_PREVIEW),
      // 🖼 Your services (§10 #35): one album per card, its own photos.
      perCard: rows.map((r) => {
        const own = [r.primary_photo_r2_key, ...(r.showcase_photo_r2_keys ?? [])].filter((k): k is string => Boolean(k));
        return { id: r.vendor_service_id, title: r.title, keys: own.slice(0, ALBUM_OPEN_MAX), total: own.length };
      }),
    };
  })().catch((err) => {
    logQueryError('VendorCollections.cards', err, { vendorId });
    return null;
  });

  // The private album — its own RLS lets the supplier read it; taken-down photos are not theirs to count.
  const albumsRead = (async () => {
    const { data, error } = await supabase
      .from('vendor_papic_portfolio_photos')
      .select('photo_id, event_id, r2_object_key, credits_spent, created_at, hidden_at, nsfw_checked')
      .eq('vendor_profile_id', vendorId)
      .is('hidden_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      logQueryError('VendorCollections.albums', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as Array<Parameters<typeof visiblePortfolioPhotos>[0][number]>;
    // 🖼 All your events (§10 #35): the screened photos only — an unscreened or taken-down one is never drawn.
    return { photos: rows.length, events: new Set(rows.map((r) => r.event_id)).size, shown: visiblePortfolioPhotos(rows) };
  })().catch((err) => {
    logQueryError('VendorCollections.albums', err, { vendorId });
    return null;
  });

  // Their own shots — the rules of `lib/vendor-own-captures.ts`: screened, and not taken down by the couple.
  const ownRead2 = (async () => {
    const { count, error } = await supabase
      .from('vendor_papic_captures')
      .select('capture_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .eq('nsfw_checked', true)
      .is('hidden_at', null);
    if (error || count === null) {
      if (error) logQueryError('VendorCollections.ownCaptures', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    return { items: count };
  })().catch((err) => {
    logQueryError('VendorCollections.ownCaptures', err, { vendorId });
    return null;
  });

  const deliveredRead = (async () => {
    const { data, error } = await supabase
      .from('booking_handovers')
      .select('event_id')
      .eq('vendor_profile_id', vendorId);
    if (error) {
      logQueryError('VendorCollections.handovers', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as { event_id: string }[];
    return { couples: new Set(rows.map((r) => r.event_id)).size, items: rows.length };
  })().catch((err) => {
    logQueryError('VendorCollections.handovers', err, { vendorId });
    return null;
  });

  const igConfigured = isInstagramConnectConfigured();
  const igRead = (async () => {
    if (!igConfigured) return { connection: null, media: [] as VendorIgMediaRow[], unavailable: false };
    try {
      const connection = await fetchVendorIgConnection(vendorId);
      const media = connection ? await fetchVendorIgMediaForOwner(vendorId, IG_LIMIT) : [];
      return { connection, media, unavailable: false };
    } catch (err) {
      logQueryError('VendorCollections.instagram', err, { vendorId });
      return { connection: null, media: [] as VendorIgMediaRow[], unavailable: true };
    }
  })();

  const parts = await getInspirationParts();
  const access = moodboardLibraryAccessForProfile(profile, parts);
  const moodRead = (async () => {
    if (!access.allowed) return { allowed: false, looks: 0, declined: 0 };
    const { data, error } = await createAdminClient()
      .from('moodboard_library_assets')
      .select('approved_at, rejected_at, retired_at')
      .eq('uploaded_by', userId);
    if (error) {
      logQueryError('VendorCollections.moodboard', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as { approved_at: string | null; rejected_at: string | null; retired_at: string | null }[];
    const live = rows.filter((r) => !r.retired_at);
    return { allowed: true, looks: live.length, declined: live.filter((r) => r.rejected_at).length };
  })().catch((err) => {
    logQueryError('VendorCollections.moodboard', err, { vendorId });
    return null;
  });

  // 🗓 The shop's bookings — ONE read for two answers: the event albums' titles and the stories' events (the same pool
  // read Share your work uses, for the same reason: a story is only ever one of this shop's own booked events).
  const poolRead: Promise<PoolBookingEntry[] | null> = fetchVendorPoolBookings(supabase, vendorId).catch((err) => {
    logQueryError('VendorCollections.bookings', err, { vendorId }, 'graceful_degrade');
    return null;
  });
  // 📣 Stories couples published with this shop credited (the parity item) — chained on the pool read.
  const storiesRead = poolRead.then(async (pool) => {
    if (pool === null) return null;
    try {
      return await loadVendorFeaturedStories(pool.map((b) => b.eventId));
    } catch (err) {
      logQueryError('VendorCollections.stories', err, { vendorId }, 'graceful_degrade');
      return null;
    }
  });
  // 🌱 Inspiration you curated — the approved looks its page shows, only for a shop that supplies looks.
  const looksRead = access.allowed
    ? fetchShopInspirationLooks(createAdminClient() as unknown as ShopInspirationClient, vendorId, parts).catch((err) => {
          logQueryError('VendorCollections.looks', err, { vendorId }, 'graceful_degrade');
          return null;
        })
    : Promise.resolve('off' as const);
  // The flag only decides whether an album links to its own page; unread → no link (the album still shows), logged.
  const papicRead = isVendorPapicCaptureEnabled().catch((err) => {
    logQueryError('VendorCollections.papicFlag', err, { vendorId }, 'graceful_degrade');
    return false;
  });
  // The event albums' photos, signed on the media bucket (the album page's own signer), at most one panel's worth each.
  const albumUrlsRead = albumsRead.then(async (a) => {
    if (!a) return null;
    const perEvent = new Map<string, number>();
    const signed = await Promise.all(
      a.shown.map(async (p) => {
        const n = perEvent.get(p.eventId) ?? 0;
        perEvent.set(p.eventId, n + 1);
        if (n >= ALBUM_OPEN_MAX) return { eventId: p.eventId, url: null, createdAt: p.importedAt ?? '' };
        const { key } = parseR2Ref(p.r2Key);
        // An unsigned photo still counts toward the album; an album with none to show says so (`AlbumGrid`).
        const url = await r2SignedGet({ bucket: R2_BUCKETS.media, key, expiresIn: 3600 }).catch((err) => {
          logQueryError('VendorCollections.albumSign', err, { vendorId, eventId: p.eventId }, 'graceful_degrade');
          return null;
        });
        return { eventId: p.eventId, url, createdAt: p.importedAt ?? '' };
      }),
    );
    return signed;
  });
  // Each card's own photos, signed the way the page gallery is.
  const cardAlbumsRead = cardsRead.then(async (c) => {
    if (!c) return null;
    return Promise.all(
      c.perCard.map(async (card) => ({
        id: card.id,
        title: card.title,
        total: card.total,
        urls: (
          await Promise.all(
            card.keys.map((key) =>
              displayUrlForStoredAsset(key).catch((err) => {
                logQueryError('VendorCollections.cardAlbum', err, { vendorId, key });
                return null;
              }),
            ),
          )
        ).filter((u): u is string => Boolean(u)),
      })),
    );
  });

  const thumbsRead = Promise.all(
    portfolioRefs.map(async (key) => {
      try {
        const url = await displayUrlForStoredAsset(key);
        return url ? ([key, url] as const) : null;
      } catch (err) {
        logQueryError('VendorCollections.portfolioThumb', err, { vendorId, key });
        return null;
      }
    }),
  ).then((xs) => Object.fromEntries(xs.filter((x): x is readonly [string, string] => x !== null)));

  // Started with the rest, read at the cap below (its own select — `readPortfolioAllowance`).
  const allowanceRead = readPortfolioAllowance(supabase, vendorId);
  // 💳 The shop wallet the portfolio spends past its free room (owner 2026-10-23). Unread → null, never 0.
  const walletRead = fetchShopWalletBalance(supabase, vendorId);
  // The service cards' first photos, presigned beside the rest (chained on the cards read only).
  const cardThumbsRead = cardsRead.then(async (c) => {
    if (!c) return [] as string[];
    const urls = await Promise.all(
      c.previewKeys.map((key) =>
        displayUrlForStoredAsset(key).catch((err) => {
          logQueryError('VendorCollections.cardThumb', err, { vendorId, key });
          return null;
        }),
      ),
    );
    return urls.filter((u): u is string => Boolean(u));
  });
  const [own, cards, albumsFull, ownShots, delivered, ig, moodboard, portfolioDisplayMap, cardThumbs, pool, stories, looks, papicOn, albumUrls, cardAlbums] =
    await Promise.all([
      ownRead,
      cardsRead,
      albumsRead,
      ownRead2,
      deliveredRead,
      igRead,
      moodRead,
      thumbsRead,
      cardThumbsRead,
      poolRead,
      storiesRead,
      looksRead,
      papicRead,
      albumUrlsRead,
      cardAlbumsRead,
    ]);
  const albums = albumsFull ? { photos: albumsFull.photos, events: albumsFull.events } : null;
  const thisYear = Number(new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 4));

  const saved = pageSavedFrom(micrositeFromRow(own), (profile.services ?? []) as string[], portfolioRefs);
  // 🎁 The shop's own allowance (a personal invite's 100, kept after the gift) lifts the base — `portfolioPhotoCap`.
  const [allowance, walletBalance] = await Promise.all([allowanceRead, walletRead]);
  const portfolioCap = portfolioPhotoCap(
    (own?.tier_state as string | null | undefined) ?? null,
    allowanceForCap(allowance),
  );

  return {
    vendorId,
    saved,
    input: {
      page: { photos: portfolioRefs.length, videos: galleryVideoLinks.length, shown: saved.sections.portfolio },
      cards: cards ? { cards: cards.cards, photos: cards.photos, videos: cards.videos } : null,
      albums,
      own: ownShots,
      delivered,
      instagram: ig.unavailable
        ? null
        : {
            configured: igConfigured,
            connected: ig.connection?.status === 'connected',
            posts: ig.media.length,
            shown: ig.media.filter((m) => m.showOnProfile).length,
            postsAtLeast: ig.media.length >= IG_LIMIT,
          },
      moodboard,
    },
    portfolioRefs,
    portfolioDisplayMap,
    portfolioMax: portfolioCap,
    portfolioAllowanceUnread: !allowance.ok,
    walletBalance,
    galleryVideoLinks,
    videoTitles: own ? videoTitlesOf(own.gallery_video_titles) : null,
    igConfigured,
    igConnection: ig.connection,
    igMedia: ig.media,
    igUnavailable: ig.unavailable,
    libraryOpen: access.allowed,
    groups: {
      events:
        albumUrls === null
          ? null
          : eventAlbums(albumUrls, pool ?? [], {
              thisYear,
              // The album's own screen (Put on my page, import) opens only while the Papic flag is on.
              albumHref: papicOn ? (id) => `/vendor-dashboard/on-the-day/live/${id}/papic#portfolio` : null,
            }),
      services: cardAlbums === null ? null : serviceAlbums(cardAlbums),
      inspiration: looks === 'off' ? 'off' : looks === null ? null : inspirationAlbums(looks),
      stories:
        stories === null
          ? null
          : stories.map((st) => ({
              eventId: st.eventId,
              slug: st.slug,
              hostNames: st.hostNames,
              line: [st.city, st.dateLabel].filter(Boolean).join(' · '),
            })),
    },
    previews: {
      page: { urls: portfolioRefs.map((k) => portfolioDisplayMap[k]).filter((u): u is string => Boolean(u)).slice(0, ALBUM_PREVIEW), total: portfolioRefs.length },
      ...(cards ? { cards: { urls: cardThumbs, total: cards.photos } } : {}),
      ...(ig.unavailable
        ? {}
        : { instagram: { urls: ig.media.map((m) => m.displayUrl).filter((u): u is string => Boolean(u)).slice(0, ALBUM_PREVIEW), total: ig.media.length } }),
    },
  };
}
