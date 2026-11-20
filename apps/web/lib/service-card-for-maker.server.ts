import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchCoveragesByIdPublic, fetchInclusionsByService, type VendorServiceCoverage } from '@/lib/vendor-service-public';
import { fetchDiscountsWithOffers } from '@/lib/offers.server';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { buildServesLine } from '@/lib/service-serves-line';
import {
  cardAnchorId,
  toServiceCard,
  withCardReviews,
  withCoupleLooks,
  withInspirationLooks,
  type ServiceShowcaseMedia,
} from '@/lib/service-card-view-model';
import { fetchServiceCardCouplePhotos } from '@/lib/couple-photo-share.server';
import { buildCardReviews } from '@/lib/card-reviews';
import { cardRecordRatingFromTrusted, type CompiledCardRecord } from '@/lib/service-card-record';
import { fetchCardHostReviewStats, fetchReviewsForVendorWithCouple, fetchTrustedReviewStats } from '@/lib/reviews';
import { readCardGuestReviewStats, readGuestReviewsForVendor, type GuestReviewsRead } from '@/lib/guest-reviews';
import { resolveGuestReviewPhotoUrls } from '@/lib/guest-review-photos.server';
import { readOverdueTopUpEventIds } from '@/lib/booking-fee-top-up.server';
import { manilaToday } from '@/lib/std-views';
import { toAlbumViews, type CardAlbum } from '@/lib/card-portfolio-albums';
import { fetchShopInspirationLooks, looksByCard, type ShopInspirationClient } from '@/lib/shop-inspiration.server';
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { listedFilesGate } from '@/lib/inspiration-tags.server';
import { cardWithoutHidden, pairPhotoRefs, withCardHides } from '@/lib/service-card-hides';
import { readCardHides, readCardOwnerView } from '@/lib/service-card-hides.server';
import type { CanvasInitial } from '@/lib/canvas-initial';
import type { MakerGrownCard } from '@/lib/service-card-for-maker';

/**
 * 🃏 THE CARD MAKER'S GROWN CARD — ONE `ServiceCard` for the shop's own saved card (ruling c160a2aa, 2026-11-16).
 *
 * Built with the SAME lib calls, in the same order, that the public shop page's `buildServiceGroups` makes for each
 * card (`app/v/[slug]/page.tsx`) — never a second drawing of the card: `toServiceCard` → `withCoupleLooks` →
 * `withCardReviews` → `eventWork` → `withCardHides` → `withInspirationLooks`. Hidden items are KEPT (the shop curates
 * them here — the one place hiding lives); couples get `cardWithoutHidden` on the shop page.
 *
 * Owner-scoped: the caller has already proved the card is this shop's (`loadCardForEdit`), and every read below names
 * that shop or that card. Media URLs come from `loadCardForEdit` (`initial.mediaDisplayUrls`), never re-signed.
 *
 * 🔑 A refused read is SAID, never drawn as empty (`unread`, shown under the pinned card): the record, the reviews, the
 * guest reviews, the inspiration, the card's events (`eventWork: null` → the grown card says "Couldn't load") and the
 * hides (fail closed: `cardWithoutHidden(card, 'unread')` and no hiding offered). Reads the shop page itself degrades
 * silently (inclusions, discounts, coverage, couple photos — their libs log and return empty) cannot be told apart here
 * either; what's included is overlaid from the live form anyway (`overlayTyped`).
 */

/** The shop page's first reviews window (`REVIEWS_PAGE_SIZE` in `app/v/[slug]/page.tsx`): the hosts' quote a card
 *  shows is the newest one with words inside it, so the maker reads the same window to show the same quote. */
const SHOP_PAGE_FIRST_REVIEWS = 5;
/** The guest reviews the shop page reads (`readGuestReviewsForVendor(…, { limit: 20 })`). */
const SHOP_PAGE_GUEST_REVIEWS = 20;

export async function loadMakerGrownCard(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  args: {
    vendorProfileId: string;
    serviceId: string;
    initial: CanvasInitial;
    /** The edit page's `readOneCardRecord` result: undefined = the record flag is off · null = refused. */
    records: { record: CompiledCardRecord | null } | null | undefined;
    /** The edit page's `cardPortfolioAlbums` result: undefined = the flag is off · null = refused. */
    albums: CardAlbum[] | null | undefined;
  },
): Promise<MakerGrownCard> {
  const { vendorProfileId, serviceId, initial } = args;
  const ids = [serviceId];
  const unread: string[] = [];

  const row = await fetchVendorServices(supabase, vendorProfileId)
    .then((rows) => rows.find((r) => r.vendor_service_id === serviceId) ?? null)
    .catch(() => null);
  if (!row) return { status: 'unread' };

  const unlisted = await readOverdueTopUpEventIds(vendorProfileId, manilaToday()).catch(() => new Set<string>());
  const [
    inclusions,
    discounts,
    coverages,
    vocab,
    couplePhotos,
    hides,
    hostStats,
    guestStats,
    hostReviews,
    guestReviews,
    trusted,
    looks,
    ownerView,
  ] = await Promise.all([
    fetchInclusionsByService(admin, ids),
    fetchDiscountsWithOffers(admin, ids),
    row.coverage_id == null
      ? Promise.resolve(new Map<number, VendorServiceCoverage>())
      : fetchCoveragesByIdPublic(admin, [row.coverage_id]),
    getEventTypeVocab(),
    fetchServiceCardCouplePhotos(admin, ids),
    readCardHides(admin, ids),
    fetchCardHostReviewStats(admin, vendorProfileId).catch(() => null),
    readCardGuestReviewStats(admin, vendorProfileId).catch(() => null),
    fetchReviewsForVendorWithCouple(admin, vendorProfileId, {
      limit: SHOP_PAGE_FIRST_REVIEWS,
      offset: 0,
      excludeEventIds: [...unlisted],
    }).catch(() => null),
    readGuestReviewsForVendor(admin, vendorProfileId, { limit: SHOP_PAGE_GUEST_REVIEWS }).catch(
      (): GuestReviewsRead => ({ state: 'refused' }),
    ),
    fetchTrustedReviewStats(admin, vendorProfileId).catch(() => null),
    getInspirationParts()
      .then((parts) =>
        fetchShopInspirationLooks(admin as unknown as ShopInspirationClient, vendorProfileId, parts, listedFilesGate(admin)),
      )
      .catch(() => null),
    readCardOwnerView(vendorProfileId).catch(() => ({ status: 'not_owner' as const })),
  ]);

  // The showcase exactly as the shop page resolves it: the first five photos, paired with the refs a hide is keyed on.
  const urls = initial.mediaDisplayUrls;
  const { photos, photoRefs } = pairPhotoRefs(
    initial.showcasePhotoR2Keys.slice(0, 5),
    initial.showcasePhotoR2Keys.slice(0, 5).map((k) => urls[k]),
  );
  const clipUrl = initial.showcaseVideoR2Key ? (urls[initial.showcaseVideoR2Key] ?? null) : null;
  const showcase: ServiceShowcaseMedia | undefined =
    photos.length > 0 || clipUrl
      ? { photos, videoUrl: clipUrl, photoRefs, videoRef: clipUrl ? initial.showcaseVideoR2Key : null }
      : undefined;
  const coverUrl = initial.coverPhotoR2Key ? (urls[initial.coverPhotoR2Key] ?? null) : null;

  const vocabLabels = new Map(vocab.map((t) => [t.key, t.label]));
  const serves = row.coverage_id == null ? undefined : (buildServesLine(coverages.get(row.coverage_id), vocabLabels) ?? undefined);

  if (args.records === null) unread.push('record');
  const record = args.records?.record ?? null;

  let card = withCoupleLooks(
    toServiceCard(
      row,
      inclusions.get(serviceId),
      discounts.get(serviceId),
      serves,
      showcase,
      false,
      null,
      new Date(),
      record,
      cardRecordRatingFromTrusted(trusted),
      true,
      coverUrl,
    ),
    couplePhotos.get(serviceId),
  );

  // ⭐ The card's reviews, from the same readers the shop page feeds `buildCardReviews`.
  if (hostStats === null || hostReviews === null) unread.push('reviews from hosts');
  if (guestStats === null || guestReviews.state === 'refused') unread.push('reviews from guests');
  const guestRows = guestReviews.state === 'rows' ? guestReviews.rows : [];
  const guestPhotoUrls = guestRows.length > 0 ? await resolveGuestReviewPhotoUrls(guestRows).catch(() => new Map<string, string>()) : new Map<string, string>();
  card = withCardReviews(
    card,
    buildCardReviews({
      serviceIds: ids,
      hostStats,
      guestStats,
      hostReviews: hostReviews ?? [],
      guestRows,
      guestPhotoUrls,
      readAllHref: '#guest-reviews',
    }).get(serviceId),
  );

  // 🃏📸 The events this card was booked on — only while the record flag is on; a refused read is `null` ("Couldn't load").
  if (args.albums !== undefined) {
    if (args.albums === null) unread.push('events');
    card = { ...card, eventWork: args.albums ? toAlbumViews(args.albums) : null };
  }

  // 🃏 Hide per card: the refs the supplier's tap names + what is hidden now.
  const hidden = hides.status === 'ok' ? (hides.byCard.get(serviceId) ?? []) : [];
  card = withCardHides(card, showcase, hides.status === 'ok' ? hidden : undefined);

  // 🔗🖼 The card's own inspiration looks; unread → none drawn, and said.
  if (looks === null) unread.push('inspiration');
  else card = withInspirationLooks(card, looksByCard(looks).get(serviceId) ?? [], cardAnchorId(row.public_id, serviceId));

  // A FAILED hides read is not "nothing hidden": nobody can say what is hidden, so the card is drawn without its
  // hideable items (as couples get it on that read) and hiding is not offered until it can be read.
  if (hides.status === 'error') {
    unread.push('what’s hidden on this card');
    return { status: 'ok', card: cardWithoutHidden(card, 'unread'), hidden: [], curate: false, opens: null, unread };
  }

  // Not the shop's to curate (never expected here — `loadCardForEdit` proved it): the card as couples get it.
  if (ownerView.status !== 'owner') {
    return { status: 'ok', card: cardWithoutHidden(card, hidden), hidden: [], curate: false, opens: null, unread };
  }
  const opens = ownerView.opens ? (ownerView.opens[serviceId] ?? 0) : null;
  return { status: 'ok', card, hidden, curate: true, opens, unread };
}
