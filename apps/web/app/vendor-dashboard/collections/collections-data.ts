import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { MICROSITE_COLUMNS, micrositeFromRow } from '@/lib/vendor-microsite';
import { pageSavedFrom, type PageSaved } from '@/lib/supplier-page-draft';
import type { CollectionsInput } from '@/lib/supplier-collections';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { isInstagramConnectConfigured } from '@/lib/vendor-instagram';
import {
  fetchVendorIgConnection,
  fetchVendorIgMediaForOwner,
  type VendorIgConnectionStatus,
  type VendorIgMediaRow,
} from '@/lib/vendor-instagram-status';
import { moodboardLibraryAccessForProfile } from '@/lib/moodboard-library-access';

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
  galleryVideoLinks: string[];
  igConfigured: boolean;
  igConnection: VendorIgConnectionStatus | null;
  igMedia: VendorIgMediaRow[];
  igUnavailable: boolean;
};

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
      .select(`tier_state, ${MICROSITE_COLUMNS}`)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    if (error) logQueryError('VendorCollections.ownRow', error, { vendorId }, 'graceful_degrade');
    return (data as Record<string, unknown> | null) ?? null;
  })().catch(() => null);

  const cardsRead = (async () => {
    const { data, error } = await supabase
      .from('vendor_services')
      .select('primary_photo_r2_key, showcase_photo_r2_keys, showcase_video_r2_key')
      .eq('vendor_profile_id', vendorId);
    if (error) {
      logQueryError('VendorCollections.cards', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as {
      primary_photo_r2_key: string | null;
      showcase_photo_r2_keys: string[] | null;
      showcase_video_r2_key: string | null;
    }[];
    return {
      cards: rows.length,
      photos: rows.reduce((a, r) => a + (r.primary_photo_r2_key ? 1 : 0) + (r.showcase_photo_r2_keys?.length ?? 0), 0),
      videos: rows.filter((r) => r.showcase_video_r2_key).length,
    };
  })().catch(() => null);

  // The private album — its own RLS lets the supplier read it; taken-down photos are not theirs to count.
  const albumsRead = (async () => {
    const { data, error } = await supabase
      .from('vendor_papic_portfolio_photos')
      .select('event_id')
      .eq('vendor_profile_id', vendorId)
      .is('hidden_at', null);
    if (error) {
      logQueryError('VendorCollections.albums', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as { event_id: string }[];
    return { photos: rows.length, events: new Set(rows.map((r) => r.event_id)).size };
  })().catch(() => null);

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
  })().catch(() => null);

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
  })().catch(() => null);

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

  const access = moodboardLibraryAccessForProfile(profile);
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
  })().catch(() => null);

  const thumbsRead = Promise.all(
    portfolioRefs.map(async (key) => {
      try {
        const url = await displayUrlForStoredAsset(key);
        return url ? ([key, url] as const) : null;
      } catch {
        return null;
      }
    }),
  ).then((xs) => Object.fromEntries(xs.filter((x): x is readonly [string, string] => x !== null)));

  const [own, cards, albums, ownShots, delivered, ig, moodboard, portfolioDisplayMap] = await Promise.all([
    ownRead,
    cardsRead,
    albumsRead,
    ownRead2,
    deliveredRead,
    igRead,
    moodRead,
    thumbsRead,
  ]);

  const saved = pageSavedFrom(micrositeFromRow(own), (profile.services ?? []) as string[], portfolioRefs);
  const portfolioCap = tierCaps(asVendorTier((own?.tier_state as string | null | undefined) ?? null)).portfolioPhotos;

  return {
    vendorId,
    saved,
    input: {
      page: { photos: portfolioRefs.length, videos: galleryVideoLinks.length, shown: saved.sections.portfolio },
      cards,
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
    portfolioMax: Number.isFinite(portfolioCap) ? portfolioCap : 999,
    galleryVideoLinks,
    igConfigured,
    igConnection: ig.connection,
    igMedia: ig.media,
    igUnavailable: ig.unavailable,
  };
}
