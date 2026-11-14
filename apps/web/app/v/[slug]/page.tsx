import Link from 'next/link';
import { OWN_LINK_SRC } from '@/lib/supplier-qr-codes';
import { readOverdueTopUpEventIds, readPageRefsFromEvents } from '@/lib/booking-fee-top-up.server';
import { manilaToday } from '@/lib/std-views';
import { logoFrameStyle, readLogoFrame, type LogoFrame } from '@/lib/open-shop-logo';
import { blockClosesDay, NOT_AVAILABLE_COLUMNS, notAvailableShapeOf, notAvailableWindowFilter } from '@/lib/not-available';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { onSetnayanSinceLine } from '@/lib/in-business-since';
import { eventsByKind } from '@/lib/shop-events-by-kind';
import { ShopSinceLine } from './_components/shop-since-line';
import { CheckADateLink } from './_components/check-a-date-link';
import { fetchVendorSongs, isMusicToolCategory } from '@/lib/songs';
import { SignInHereLink } from '@/app/_components/auth/sign-in-here-link';
import { boothTierCanBrand } from '@/lib/booth-branding-tier-gate';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { MapPin, Star, Sparkles, Heart, BadgeCheck, CalendarCheck, ArrowRight, Send, Play, MessageCircle, Store } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { DemoOnlyMarker, DEMO_ONLY_LABEL, SampleMarker } from '@/app/_components/sample-marker';
import { fetchDiscountsWithOffers } from '@/lib/offers.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveRenamedPath } from '@/lib/slug-forwarding';
import { createClient } from '@/lib/supabase/server';
import {
  SERVICE_GROUPS,
  displayServiceLabel,
  resolveVendorDisplayName,
  serviceGroupOf,
  VENDOR_PLACEHOLDER_PHOTO,
  type ServiceGroupKey,
} from '@/lib/vendors';
import { formatPhpRounded } from '@/lib/php';
import {
  isBookable,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { isTrueNameTier, tierCaps } from '@/lib/vendor-tier-caps';
import { vendorSeoPlanForVendor, effectiveSeoTier } from '@/lib/vendor-seo-tier';
import { isVendorSeoTierGateEnabled } from '@/lib/vendor-seo-tier-flag';
import { experienceTier, vendorExperienceEnabled, yearsInBusiness } from '@/lib/vendor-experience';
import {
  fetchVendorServices,
  type VendorServiceRow,
  type VendorServiceDiscount,
} from '@/lib/vendor-services';
import {
  fetchCoveragesByIdPublic,
  fetchInclusionsByService,
  type VendorServiceInclusion,
} from '@/lib/vendor-service-public';
import { getEventTypeVocab } from '@/lib/event-types-db';
import {
  toServiceCard,
  withCardReviews,
  withCoupleLooks,
  type CardReviews,
  type CoupleLook,
  type ServiceShowcaseMedia,
} from '@/lib/service-card-view-model';
import { fetchServiceCardCouplePhotos } from '@/lib/couple-photo-share.server';
import { buildServesLine } from '@/lib/service-serves-line';
import {
  fetchTrustedByVendors,
  TRUSTED_BY_UNREADABLE,
  type TrustedByVendor,
  type TrustedByRelationship,
} from '@/lib/vendor-trusted-by';
import { PARTNERSHIP_PUBLIC_LABEL, PARTNERSHIP_PUBLIC_HINT } from '@/lib/vendor-partnership-kinds';
import {
  ServicesGallery,
  type ServiceCard,
  type ServiceGroup,
} from './_components/services-gallery';
import { fetchUserEvents } from '@/lib/events';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { eventVendorCategoryForCardKind } from '@/lib/event-vendor-category';
import type { CoarseCategorySource } from '@/lib/vendor-branch-category';
import { resolveAddShopToEvent } from './_components/add-shop-to-event-data';
import { InquireSheet, type InquireEvent, type InquireService } from './_components/inquire-sheet';
import { inquireServiceList } from '@/lib/shop-inquire';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { ReportPageButton } from '@/app/_components/report-page-button';
import {
  buildVendorVenueEvents,
  fetchViewerVenue,
  type VendorVenueEvent,
} from '@/lib/vendor-venue-events';
import { VenueMatchedEvents } from './_components/venue-matched-events';
import { resolveLivePax } from '@/lib/pax';
import { PackageCard } from '@/app/_components/vendor-packages/package-card';
import { coupleBundleGift, packageGiftOf, PACKAGE_GIFT_SETNAYAN, type PackageGift } from '@/lib/package-gift';
import { fetchShopGiftPacks } from '@/lib/shop-gifts.server';
import type { ShopGiftPack } from '@/lib/shop-gifts';
import { LockPackageModal } from '@/app/_components/vendor-packages/lock-modal';
import { BOOKINGS_OPEN_SOON } from '@/lib/bookings-open';
import { areBookingsOpen } from '@/lib/bookings-open.server';
import type {
  VendorPackageItemOptionRow,
  VendorPackageItemRow,
  VendorPackageRow,
  VendorPackageWithItems,
} from '@/lib/vendor-packages';
import {
  PACKAGE_ITEM_OPTION_SELECT,
  VENDOR_PACKAGE_SELECT,
  VENDOR_PACKAGE_ITEM_SELECT,
} from '@/lib/vendor-packages';
import { packageCreditEnabled } from '@/lib/package-credit-flag';
import { ShareButton } from './_components/share-button';
import { arrivalParams, shopBackDoor, shopTopBack, withShopArrival } from '@/lib/shop-back';
import { BackButton } from '@/app/_components/back-button';
import {
  SHOP_ARTICLE_WIDTH,
  SHOP_CALLING_CARD_CLASS,
  SHOP_CALM_COLUMN_CLASS,
  SHOP_CARD_COLUMN_CLASS,
  SHOP_CARD_SECTION_CLASS,
  SHOP_COLUMNS_CLASS,
  SHOP_MAIN_INQUIRE_CLASS,
} from './_components/shop-columns';
import { verifiedMedianEnabled } from '@/lib/verified-median-flag';
import { fetchVendorVerifiedMedian } from '@/lib/verified-median-read';
import { VerifiedPriceCard } from './_components/verified-price-card';
import { parseVideoLink } from '@/lib/video-embed';
import { videoTitlesOf } from '@/lib/video-link-titles';
import { fetchVendorIgMediaForPublic } from '@/lib/vendor-instagram-status';
import { serviceDetailsEnabled } from '@/lib/service-details-flag';
import type { ServiceInquireMode } from './_components/service-details-sheet';
import type { PackageAskTarget } from '@/app/_components/vendor-packages/lock-modal';
import { joinVendorWaitlist } from './waitlist-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { DirectionsMenu } from '@/app/_components/nav-links';
import { ShopReachLine, ShopReachMap } from './_components/shop-reach';
import { ShopBranchesLine } from './_components/shop-branches-line';
import { ShopAddresses } from './_components/shop-addresses';
import { PinnedReviewCard } from './_components/pinned-review-card';
import {
  GuestReviewsGroup,
  GuestStarsLine,
  ReviewForLine,
  ReviewGroupHead,
  type ReviewCardLink,
} from './_components/review-groups';
import { readCardGuestReviewStats, readGuestReviewsForVendor, type GuestReviewsRead } from '@/lib/guest-reviews';
import { buildCardReviews } from '@/lib/card-reviews';
import { cardWithoutHidden, pairPhotoRefs, withCardHides, type CardHidesRead } from '@/lib/service-card-hides';
import { readCardHides, viewerRunsShop } from '@/lib/service-card-hides.server';
import { resolveGuestReviewPhotoUrls } from '@/lib/guest-review-photos.server';
import { ownWebAddress, pinnedQuote, shopReach } from '@/lib/shop-page-plan';
import { fetchPublicVendorBranches } from '@/lib/vendor-branches';
import type { CardRecordRating } from '@/app/_components/card-record-section';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { readShopWork } from '@/lib/card-portfolio-albums.server';
import { cardAlbums, eventPhotosOf, toAlbumViews, type AlbumView } from '@/lib/card-portfolio-albums';
import { servicesFromCards } from '@/lib/photos-by-service';
import { PhotosByServiceRow } from './_components/photos-by-service';
import {
  cardRecordHasSomethingToSay,
  cardRecordRatingFromTrusted,
  fetchServiceCardRecords,
  type CompiledCardRecord,
} from '@/lib/service-card-record';
import {
  fetchReviewsForVendorWithCouple,
  fetchReviewForVendorWithCouple,
  pinReviewFirst,
  fetchReviewStats,
  fetchTrustedReviewStats,
  fetchCardHostReviewStats,
  fetchVendorCompletedEvents,
  formatStarRating,
  formatTrackRecordMonth,
  formatEventTypeLabel,
  REVIEW_AXIS_LABEL,
  type ReviewAxis,
  type ReviewWithCouple,
  type ReviewStatsRow,
  type TrustedReviewStatsRow,
  type VendorCompletedEventRow,
} from '@/lib/reviews';
import { countVendorRecommendingCouples } from '@/lib/vendor-recommendations';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import {
  loadVendorFeaturedStories,
  type VendorFeaturedStory,
} from '@/lib/realstories-vendor';
import {
  loadFeaturedChaptersCreditingVendor,
  type StorytellerTileItem,
} from '@/lib/storytellers';
import { StorytellerTile } from '@/app/_components/storyteller-tile';
import {
  fetchVendorMicrosite,
  isSectionVisible,
  micrositeAccentVars,
  micrositeCan,
  orderFeaturedFirst,
} from '@/lib/vendor-microsite';
import {
  DEMO_MODE_COOKIE_NAME,
  isAdminProfile,
} from '@/lib/demo-mode';
import {
  fetchVendorServiceAttributes,
  payloadHidesPricesPublicly,
  fetchSchemaWithSharedGroups,
} from '@/lib/vendor-service-attributes';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { recordVendorProfileView } from '@/lib/record-vendor-view';
import { ShopViewBeacon } from './_components/shop-view-beacon';
import { wearShopPageTags } from '@/lib/shop-page-cache';
import { onTheCachedHub } from '@/lib/hub-request';
import { PortfolioPhotoTiles } from './_components/portfolio-photo-tiles';
// 🔗🖼 The shop's approved inspiration — its own section and inside each card (owner 2026-10-30, "connected four ways").
import { fetchShopInspirationLooks, looksByCard, type ShopInspirationClient, type ShopInspirationLook } from '@/lib/shop-inspiration.server';
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { cardAnchorId, withInspirationLooks } from '@/lib/service-card-view-model';
import { ShopInspirationSection, type InspirationTile } from './_components/shop-inspiration-section';
import { shopPageGate } from '@/lib/own-shop-preview';
import { TeamPreviewBanner } from './_components/team-preview-banner';
import { NotYetVerifiedNotice } from './_components/not-yet-verified-notice';
import { shopTakesMessages } from '@/lib/findable-shop';
import { ImageBadge } from '@/app/_components/image-badge';
import { badgeImageOf } from '@/lib/shop-badge-row';
import { shopBadges, verifiedBadge, type ShopBadge } from '@/lib/shop-badges';
import { AWARD_LABELS, fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
// The compatibility-badge labels — DERIVED, never re-typed here. See the note
// at their former hand-typed definitions further down this file.
import {
  COMPATIBLE_CEREMONY_TYPE_LABEL as CEREMONY_TYPE_LABELS,
  COMPATIBLE_VENUE_SETTING_LABEL as VENUE_SETTING_LABELS,
} from '@/lib/vendor-compatibility';
import { envFlagEnabled } from '@/lib/env-flag';
import { formatCount } from '@/lib/format-number';
import { ShopSectionBar, type ShopSectionTab } from './_components/shop-section-bar';
import { ShopHero, SealCaption, shopMotion } from './_components/shop-hero';
import { OpenDatesPeek, nextSaturdays, type PeekDay } from './_components/open-dates-peek';
import { ShopCanDoPanel } from './_components/shop-can-do-panel';
import { SaveVendorButton } from '@/app/(shell)/explore/_components/save-vendor-button';
import { readCheckADate } from '@/lib/check-a-date.server';

export const dynamic = 'force-dynamic';

const REVIEWS_PAGE_SIZE = 5;

type Props = {
  params: Promise<{ slug: string }>;
  // utm_* keys (+ a bare `utm`) are captured opaquely for the funnel's VIEWS
  // stage attribution — see the recordVendorProfileView() after() call below.
  searchParams: Promise<{
    reviewsPage?: string;
    wl?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm?: string;
    src?: string;
    // Creator Economy PR-C — a chapter Book CTA referral (chapter public_id).
    // Server-validated in startServiceInquiry before any attribution stamp.
    ref_chapter?: string;
    /**
     * Deep link to ONE service's details sheet — a `vendor_services.public_id`
     * (S89…), never the internal uuid. Matched client-side against the cards
     * this page actually rendered, so an unknown / stale / forged value simply
     * opens nothing. Inert unless `serviceDetailsEnabled()`.
     */
    service?: string;
  }>;
};

// E1 (2026-09-11) — exported so the OG-card route (app/api/og/v/[slug]/
// route.tsx) can reuse the EXACT same row shape `vendorMetadataBySlug` reads
// from, rather than hand-typing a second copy that silently drifts from this
// one (the class of bug lib/site-media-ref.ts's own docblock warns about).
export type PublicVendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  /** The logo's align + zoom (owner 2026-11-06, A2) — absent on the legacy read, then drawn centred. */
  logo_focal_x?: number | null;
  logo_focal_y?: number | null;
  logo_zoom?: number | null;
  portfolio_r2_keys: string[] | null;
  // Featured videos — external URLs the vendor pasted (migration 20270518165113).
  // Optional + `?? []` at read time so a pre-migration DB degrades to no section.
  gallery_video_links?: string[] | null;
  // Each link's optional title, keyed by the link (migration 20271334860034) — said under its player.
  gallery_video_titles?: unknown;
  services: string[];
  location_city: string | null;
  hq_address: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  /** The shop's own declared furthest distance — clamped to the plan on read (`effectiveOuterRadiusKm`). Optional:
   *  the legacy select omits it, which reads as undeclared (the plan's ring). */
  outer_radius_km?: number | null;
  website: string | null;
  // 🚪 NO contact_email / contact_phone, ON PURPOSE (2026-09-10). This page is
  // public and signed-out-readable; a field it never fetches can never be
  // printed, serialized into a client prop or put in structured data by a later
  // edit. The shop keeps both in My Shop. See `lib/no-door-out-of-the-app.test.ts`.
  public_visibility: VendorPublicVisibility;
  compatible_ceremony_types: string[] | null;
  compatible_venue_settings: string[] | null;
  // PR brief 2026-05-22 evening — marketplace simulation workstream.
  // `is_demo` is added to `vendors` by Agent 1's PR. Defensive: nullable
  // + treated as FALSE when null so this PR keeps building if Agent 1's
  // column hasn't been merged yet. The actual `is_demo IS NOT TRUE` filter
  // on visibility lives below (see `isDemoVendor`).
  is_demo?: boolean | null;
  // V2.1 brief amendment #2 (locked 2026-05-30 · CLAUDE.md row
  // "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d) + memory rule
  // [[project_setnayan_vendor_hybrid_anonymity]]). NULL = the vendor's
  // business_name is hidden in the microsite hero, page title, and
  // LocalBusiness JSON-LD name field; surfaces render the anonymized
  // taxonomy + city placeholder via `resolveVendorDisplayName` in
  // lib/vendors.ts. Non-NULL = name globally revealed (DB trigger
  // `reveal_vendor_name_on_chat` stamps on first vendor chat reply ·
  // PR #662 / migration 20260530010000). Pro + Enterprise vendors are
  // also revealed via the app-layer `isPaidTier` flag but no
  // subscription join exists here yet; placeholder still only renders
  // while name_revealed_at IS NULL so once any Pro+ vendor sends a
  // reply the real name surfaces unchanged.
  name_revealed_at?: string | null;
  // CLAUDE.md 2026-05-30 refinement row · screen_name. Bark-format
  // stored anonymized name like "Manila Wedding Photographer #4218".
  // Generated at signup by `generate_screen_name_for_vendor()` (migration
  // `20260714000000`) for Free + Verified non-venue vendors · venue-
  // exempt vendors (services overlap with religious_venue / venue) get
  // NULL screen_name on purpose since they always show real
  // business_name regardless. When present, `resolveVendorDisplayName`
  // returns this as the placeholder instead of computing the legacy
  // "service · city" string.
  screen_name?: string | null;
  // Phase C tier gates (vendor-tier-caps). `tier_state` is a NOT NULL
  // DEFAULT 'free' enum on vendor_profiles (free | verified | pro |
  // enterprise) but absent from FULL_VENDOR_PROFILE_SELECT, so it's
  // explicitly added to `fullSelect`. Drives the day-1 name reveal
  // (isTrueNameTier → pro/enterprise) and the review-display gate
  // (tierCaps.reviewStarsCounted / reviewCommentsViewable). Optional +
  // `?? null` everywhere so a missing column degrades to free (safe:
  // name stays hidden, reviews stay gated).
  tier_state?: string | null;
  // Subscription expiry for the tier above. Read on this PUBLIC page because
  // tier lapse is LOGIN-DRIVEN (`sweep_vendor_tier_expiry` fires from the
  // vendor dashboard layout) and nobody is logged in here — so a vendor whose
  // subscription ended months ago still carries a paid `tier_state` in this
  // row. Anything gating a paid entitlement off `tier_state` on a public
  // surface MUST pair it with this column. NULL = never expires (admin comp).
  tier_expires_at?: string | null;
  // PR-B public-visibility verification gate. `verification_state` is a
  // public.vendor_verification_state enum on vendor_profiles with FIVE values
  // (unverified | pending_review | verified | demoted | rejected, NOT NULL
  // DEFAULT 'unverified'). The gate is intentionally allow-listed to the
  // single 'verified' value: every other state (including pending_review,
  // demoted, rejected) has NO public website — the page 404s for everyone
  // EXCEPT the owning vendor (self-preview, matched on `user_id`) and admins
  // in demo mode. Optional + `!== 'verified'` everywhere so a missing column
  // degrades to hidden (safe).
  verification_state?: string | null;
  // Q4/Q5/Q7 (owner 2026-09-11) — the Verified BADGE's own deadline, read
  // alongside verification_state. Feeds hasVerifiedBadge (lib/verified-
  // badge.ts) wherever this row's badge is decided; never the public-
  // visibility gate above, which Q5 keeps on the raw state on purpose.
  next_renewal_due_at?: string | null;
  // PR-B self-preview. `user_id` is the owning vendor account. When the
  // logged-in viewer's id matches, an unverified page is shown to its owner
  // so they can preview before verification lands. Optional/nullable.
  user_id?: string | null;
  /** 🏪 Show my page before verification (migration 20271303245624). Absent on the legacy select. */
  self_published_at?: string | null;
  /**
   * 🔎 DECISION_LOG 2026-11-07 — the find lock and the freeze columns, read so a shop Setnayan has not decided yet
   * opens by its own link (`ownLinkOpensUnverified`, lib/findable-shop.ts). Absent = not read = the page stays shut.
   */
  find_locked_at?: string | null;
  fraud_suspended_at?: string | null;
  fraud_banned_at?: string | null;
  fraud_tombstoned?: boolean | null;
};

// Iteration 0043 — labels for wedding-type compatibility badges rendered on
// the public vendor profile.
//
// ⚠ THESE WERE HAND-TYPED COPIES AND BOTH HAD DRIFTED (fixed 2026-08-05, in the
// PR that finally gave vendors a form to set these columns). The old comment
// here said "mirror the vendor-dashboard editor labels" — a mirror nothing
// enforced, so:
//   · the venue map never gained `restaurant` (added 2026-08-05), and
//   · the ceremony map was missing `chinese`, `jewish` and `born_again` —
//     three of the eighteen values the server has accepted since the faith
//     worldwide expansion.
// The fallbacks are silent: a missing key prints the raw database word, so a
// couple would have read "born_again" on a public page. Nothing errors, nothing
// logs, and until this PR no vendor could tick the affected boxes, so nobody
// ever saw it — the defect was waiting for the writer to exist.
//
// They are now DERIVED (imported at the top of this file as
// CEREMONY_TYPE_LABELS / VENUE_SETTING_LABELS) from the same vocabulary the
// vendor's own picker renders, so a badge cannot say something different from
// the box that was ticked. Guarded by `vendor-compatibility.test.ts`.

/**
 * Resolve whether the current request belongs to an admin session that
 * has demo mode turned on. Cheap (single auth + single users select),
 * but only called once per /v/[slug] render — wrapped to keep the
 * page body readable.
 *
 * Returns `false` for unauthenticated visitors AND for authenticated
 * non-admins, even if the demo-mode cookie is present. The cookie is
 * never the source of truth on its own — admin status is.
 */
async function isAdminInDemoMode(): Promise<boolean> {
  // ⚡ A stranger's cached copy (lib/shop-view.ts): the middleware sends nobody there who carries the demo cookie.
  if (onTheCachedHub()) return false;
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value !== '1') return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return isAdminProfile(profile);
}

/**
 * Is the signed-in viewer this shop's OWNER (`vendor_profiles.user_id`) or one of its HELPERS (a
 * `vendor_team_members` seat)? Asked only when the page is not public (lib/own-shop-preview.ts). Fails CLOSED: no
 * session, a degraded row with no `user_id`, or a refused seat read all answer "a stranger" — here an absence
 * DENIES, and the worst case is the not-found page the viewer got before this existed.
 */
async function viewerIsShopTeam(vendor: Pick<PublicVendorRow, 'vendor_profile_id' | 'user_id'>): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (typeof vendor.user_id === 'string' && vendor.user_id === user.id) return true;
  // The session's own client: `vendor_team_members_member_read` admits a member to their own team's rows.
  const { data, error } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id')
    .eq('vendor_profile_id', vendor.vendor_profile_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    logQueryError('renderVendorBySlug.viewerIsShopTeam', error, { vendorProfileId: vendor.vendor_profile_id }, 'graceful_degrade');
    return false;
  }
  return data != null;
}

// E1 (2026-09-11) — exported for the same reason as `PublicVendorRow` above:
// the OG-card route needs the identical hide-if-hidden / hide-if-demo read
// `vendorMetadataBySlug` uses, including its full-select-then-legacy-select
// fallback (a second hand-rolled query would silently fall out of sync with
// this one the next time a column is added or renamed here).
export async function fetchVendor(slug: string): Promise<PublicVendorRow | null> {
  const admin = createAdminClient();
  // The `is_demo` column ships in a parallel PR (marketplace simulation
  // workstream, Agent 1). If that PR hasn't landed yet on `main`,
  // requesting the column returns a PostgREST error. We try with the
  // column first and fall back to the legacy select — keeps this PR
  // mergeable in either order. Once both PRs are on main the fallback
  // path is dormant.
  /* V2.1 brief amendment #2 (2026-05-30): bundle `name_revealed_at`
     into the FULL select so the microsite resolves hybrid-anonymity
     in a single fetch. The column ships pre-pilot via PR #662 /
     migration 20260530010000 · the existing legacy fallback already
     handles pre-`is_demo` deploys, and the new column lands in the
     same migration window so any failure mode that surfaces an
     "undefined column name_revealed_at" message routes through the
     same legacy path with a NULL default (= hidden, which is the
     conservative behavior). */
  // CLAUDE.md 2026-05-30 refinement row · screen_name added to the full
  // select. Generated at signup by `generate_screen_name_for_vendor()`
  // (migration `20260714000000`) + persists forever once stamped. When
  // present, `resolveVendorDisplayName` surfaces this Bark-format
  // stable identifier ("Manila Wedding Photographer #4218") instead of
  // computing the legacy "service · city" placeholder on every render.
  // The fallback regex below extends to detect `screen_name` undefined-
  // column errors too · routes through the legacy select path with
  // screen_name silently null (resolver falls back to computed
  // placeholder).
  const fullSelect =
    'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,logo_focal_x,logo_focal_y,logo_zoom,portfolio_r2_keys,gallery_video_links,gallery_video_titles,services,location_city,hq_address,hq_latitude,hq_longitude,website,public_visibility,compatible_ceremony_types,compatible_venue_settings,is_demo,name_revealed_at,screen_name,tier_state,tier_expires_at,verification_state,next_renewal_due_at,user_id,find_locked_at,fraud_suspended_at,fraud_banned_at,fraud_tombstoned,outer_radius_km,self_published_at,created_at';
  const legacySelect =
    'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,portfolio_r2_keys,services,location_city,hq_address,hq_latitude,hq_longitude,website,public_visibility,compatible_ceremony_types,compatible_venue_settings,created_at';

  let { data, error } = await admin
    .from('vendor_profiles')
    .select(fullSelect)
    .ilike('business_slug', slug)
    .maybeSingle();
  if (
    error &&
    /(gallery_video_links|gallery_video_titles|is_demo|name_revealed_at|screen_name|tier_state|tier_expires_at|verification_state|next_renewal_due_at|user_id|outer_radius_km|self_published_at|find_locked_at|fraud_suspended_at|fraud_banned_at|fraud_tombstoned)/i.test(
      error.message,
    )
  ) {
    ({ data } = await admin
      .from('vendor_profiles')
      .select(legacySelect)
      .ilike('business_slug', slug)
      .maybeSingle());
  }
  return (data ?? null) as PublicVendorRow | null;
}

/**
 * 🪤 `logo_url` DOES NOT ALWAYS HOLD A URL. It holds `r2://bucket/key` for
 * anything uploaded through the shop editor, and a browser cannot fetch that —
 * it renders a broken-image glyph, throws nothing, logs nothing.
 *
 * This page was the LAST and highest-value entry on the debt list in
 * `scripts/lint-stored-asset-refs.mjs`, and it stayed there until the owner
 * approved his own shop, opened the public address, and saw his logo missing at
 * the top of it. The resolver was already imported in this file and already used
 * for portfolio photos and showcase videos, ~1200 lines above the logo — the
 * pattern was applied to every asset on the page except the one in the header.
 *
 * Swallows presign failures on purpose: a logo is decoration, and `<Logo>` falls
 * back to the vendor's initials. Taking a whole public shop page down because an
 * R2 signature could not be minted would be a worse outcome than no picture.
 */
async function resolveDisplayUrl(value: string | null | undefined): Promise<string | null> {
  try {
    return await displayUrlForStoredAsset(value);
  } catch {
    return null;
  }
}

// Named, slug-resolved so the bare-root dispatcher (app/[slug]/page.tsx) can
// reuse the exact same vendor metadata when a bare slug resolves to a vendor.
export async function vendorMetadataBySlug(slug: string) {
  const vendor = await fetchVendor(slug);
  // A page a stranger cannot open (lib/own-shop-preview.ts — not live, a demo shop, closed) gets the generic title
  // and is never indexed, even when its own team is the one rendering it: the team preview must not leak the name
  // to a crawler or a link preview, and must not be indexed if a crawler ever carries a team member's cookie.
  if (!vendor || shopPageGate(vendor, { isTeam: false, adminDemoMode: false, bookingsOpen: await areBookingsOpen() }).open !== 'public') {
    return { title: 'Setnayan supplier', robots: { index: false, follow: false } };
  }
  // 🧪 A demo shop's page is PUBLIC now (owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS") but it is NEVER
  // indexed: a search engine must not list a demo as a supplier (plan § 6(a) — "noindex stays"). The sitemap keeps
  // leaving it out too (`app/sitemap-vendors.xml/route.ts`). Its title says "(DEMO ONLY)" so a link preview does as well.
  const isDemoShop = vendor.is_demo === true;
  const suffix = vendor.public_visibility === 'coming_soon' ? ' · Coming soon' : '';
  // 🔎 A shop Setnayan has not verified yet opens by its own link (DECISION_LOG 2026-11-07, ruling 3) — but it is
  // not put in front of a search engine: being found is what its first inquiry ends, and an index cannot be told.
  const notYetVerified = vendor.verification_state !== 'verified';
  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  // Bare root is the canonical vendor URL now (setnayan.com/{slug}); /v/{slug}
  // still resolves but points here.
  const canonicalUrl = `${siteUrl}/${vendor.business_slug ?? slug}`;
  /* V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity in
     metadata. Page title + description + OG card all consume the
     resolved display label so search engines + social previews
     extract the safe placeholder (e.g., "Manila Wedding Photographer
     · Manila") while the vendor's name is hidden, and the real
     business_name once revealed. */
  const displayLabel = resolveVendorDisplayName({
    business_name: vendor.business_name,
    name_revealed_at: vendor.name_revealed_at ?? null,
    primary_canonical_service: vendor.services?.[0] ?? null,
    location_city: vendor.location_city,
    // CLAUDE.md 2026-05-30 refinement row: pass services + screen_name
    // so the venue exception (services overlap with religious_venue /
    // venue) applies AND the stored Bark-format screen_name surfaces
    // when present (e.g., "Manila Wedding Photographer #4218") instead
    // of the legacy computed "service · city" placeholder. Both
    // optional · null-safe · vendor type from generateMetadata loads
    // them post-this-PR (see microsite vendor query below).
    services: vendor.services ?? null,
    screen_name: vendor.screen_name ?? null,
    // Phase C: thread the vendor's real tier_state into the day-1 name
    // reveal. Open-it-up lock (2026-07-22): a VERIFIED vendor's name is never
    // gated — revealed on any tier. Pro/Enterprise (isTrueNameTier) also reveal.
    isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
    is_verified: vendor.verification_state === 'verified',
  });
  const titleText = `${displayLabel}${isDemoShop ? ` ${DEMO_ONLY_LABEL}` : ''} · Setnayan supplier${suffix}`;
  const descText = vendor.tagline ?? `${displayLabel} on Setnayan.`;
  // E1 (2026-09-11) — "a shop's link preview never breaks". This USED to
  // resolve `vendor.logo_url` straight into a presigned R2 URL
  // (X-Amz-Expires=86400): a share sent today was a broken image tomorrow,
  // and a shop with no logo got no og:image at all (the layout-default brand
  // card took over, or — worse on some crawlers — nothing). Both cards now
  // point at the PERMANENT `/api/og/v/[slug]` address instead: it renders a
  // fresh PNG on every crawl (no expiry to outrun) and degrades to the same
  // wordmark-only card when there's no logo, so a share is never broken and
  // never bare. See `app/api/og/v/[slug]/route.tsx` / `lib/social/vendor-card.tsx`.
  const ogImageUrl = `${siteUrl}/api/og/v/${vendor.business_slug ?? slug}`;
  const ogImage = {
    url: ogImageUrl,
    width: 1200,
    height: 630,
    /* Hybrid-anonymity (V2.1 amendment #2): alt text uses the resolved
       display label so social previews don't leak a hidden business_name
       via crawler-friendly alt. */
    alt: displayLabel,
  };
  return {
    title: titleText,
    description: descText,
    // Two rules, two lines — each is its own ruling and its own guard (demo: 2026-11-06; not yet verified: 2026-11-07).
    ...(isDemoShop ? { robots: { index: false, follow: false } } : {}),
    ...(notYetVerified ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'profile',
      url: canonicalUrl,
      title: titleText,
      description: descText,
      siteName: 'Setnayan',
      locale: 'en_PH',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description: descText,
      images: [ogImageUrl],
    },
  };
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return vendorMetadataBySlug(slug);
}

// ---------------------------------------------------------------------------
// Iteration 0044 — per-category attribute display + portfolio gallery.
// Surfaces the vendor's filled vendor_service_attributes (the "details &
// customization" they declared per category) + their portfolio images on the
// public profile. Best-effort: the table / column may be unapplied in a given
// deploy env, so both fetchers swallow errors and degrade to empty.
// ---------------------------------------------------------------------------

type AttrDetailGroup = {
  canonicalService: string;
  displayName: string;
  /** Non-boolean fields rendered as label → value. */
  facts: Array<{ label: string; value: string }>;
  /** True booleans rendered as capability chips. */
  flags: string[];
};

// pricing_signal shared-group keys — redundant with the Packages section + the
// marketplace price filter, so they're omitted from the Details list.
const DETAIL_SKIP_KEYS = new Set<string>([
  'starting_price_centavos',
  'typical_range_min_centavos',
  'typical_range_max_centavos',
  'price_model',
  'show_prices_publicly',
  // Opt-in-to-hide privacy toggle (Option A) — a control, never a Detail fact.
  'hide_prices_publicly',
]);

function humanizeAttrLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeAttrToken(token: string): string {
  if (/^https?:\/\//i.test(token)) return token;
  return token.replace(/_/g, ' ');
}

function formatAttrFactValue(
  key: string,
  raw: unknown,
): string | null {
  if (Array.isArray(raw)) {
    const parts = raw
      .map((v) => humanizeAttrToken(String(v)))
      .filter((v) => v.length > 0);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof raw === 'number') {
    return /centavos/i.test(key)
      ? `₱${Math.round(raw / 100).toLocaleString('en-PH')}`
      : String(raw);
  }
  if (typeof raw === 'string') {
    return raw.trim().length > 0 ? humanizeAttrToken(raw) : null;
  }
  return null;
}

async function fetchVendorAttributeDetails(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<AttrDetailGroup[]> {
  try {
    const rows = await fetchVendorServiceAttributes(admin, vendorProfileId);
    const groups: AttrDetailGroup[] = [];
    for (const row of rows) {
      const payload = (row.attribute_payload ?? {}) as Record<string, unknown>;
      if (Object.keys(payload).length === 0) continue;
      const schema = await fetchSchemaWithSharedGroups(admin, row.canonical_service);
      if (!schema) continue;
      const facts: Array<{ label: string; value: string }> = [];
      const flags: string[] = [];
      for (const [key, def] of Object.entries(schema.fields)) {
        if (DETAIL_SKIP_KEYS.has(key) || key.endsWith('_urls')) continue;
        const raw = payload[key];
        if (raw === null || raw === undefined) continue;
        const label = def.label ?? humanizeAttrLabel(key);
        if (def.type === 'boolean') {
          if (raw === true) flags.push(label);
          continue;
        }
        const value = formatAttrFactValue(key, raw);
        if (value) facts.push({ label, value });
      }
      if (facts.length > 0 || flags.length > 0) {
        groups.push({
          canonicalService: row.canonical_service,
          displayName:
            schema.display_name_en || displayServiceLabel(row.canonical_service),
          facts,
          flags,
        });
      }
    }
    return groups;
  } catch {
    return [];
  }
}

/**
 * Public "hide my prices" preference (Social_Share_Settings_Council_Verdict
 * 2026-07-16 #6, Option A). Reads the opt-in-to-hide `hide_prices_publicly`
 * key from the vendor's pricing_signal attribute payload(s). A vendor is a
 * single business, so hiding is treated business-wide: TRUE if the vendor
 * checked it on ANY of their service pricing sections. Default (absent /
 * false) === show, which is today's public behavior for every existing
 * vendor — so nothing is blacked out. Fails OPEN (returns false → show) on
 * any read error so a transient failure can never mass-hide prices.
 */
async function fetchVendorHidesPricesPublicly(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<boolean> {
  try {
    const rows = await fetchVendorServiceAttributes(admin, vendorProfileId);
    // The predicate itself lives in lib/vendor-service-attributes now — the
    // marketplace grid reads the same rule in batch, and two copies of "does
    // this shop hide its prices" is exactly how a shop that opted out ends up
    // with its prices on the marketplace anyway.
    return rows.some((row) => payloadHidesPricesPublicly(row.attribute_payload));
  } catch (err) {
    console.warn(
      '[v/[slug]] hide_prices_publicly read failed — defaulting to show',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

async function resolvePortfolioUrls(keys: string[] | null): Promise<string[]> {
  return (await resolvePortfolioPhotos(keys)).map((p) => p.url);
}

/** 👁 The portfolio's photos WITH their stored keys — a tap opens one and counts its view (Lane E item 11). */
async function resolvePortfolioPhotos(keys: string[] | null): Promise<{ key: string; url: string }[]> {
  if (!keys || keys.length === 0) return [];
  try {
    const shown = keys.slice(0, 12);
    const resolved = await Promise.all(shown.map((k) => displayUrlForStoredAsset(k)));
    return shown.flatMap((key, i) => (resolved[i] ? [{ key, url: resolved[i]! }] : []));
  } catch {
    return [];
  }
}

/** Display URLs for one service card's showcase media. */

/**
 * Showcase media per active service (couple-side serves payoff, 2026-07-03) —
 * presign the ≤5 gallery photos + the optional ≤30s clip for every card, all
 * refs in parallel + fail-soft PER SERVICE, so one bad ref (or a dev env with
 * no R2 credentials) never blocks the profile. Cover (`primary_photo_r2_key`)
 * is intentionally untouched — it keeps its existing behavior.
 */
async function resolveServiceShowcaseMedia(
  services: ReadonlyArray<VendorServiceRow>,
): Promise<Map<string, ServiceShowcaseMedia>> {
  const out = new Map<string, ServiceShowcaseMedia>();
  await Promise.all(
    services.map(async (s) => {
      const photoKeys = (s.showcase_photo_r2_keys ?? []).slice(0, 5);
      if (photoKeys.length === 0 && !s.showcase_video_r2_key) return;
      try {
        const [photoUrls, videoUrl] = await Promise.all([
          Promise.all(photoKeys.map((k) => displayUrlForStoredAsset(k))),
          displayUrlForStoredAsset(s.showcase_video_r2_key),
        ]);
        // 🃏 The refs ride along, paired with the URLs that resolved — a hide per card is keyed on the ref.
        const { photos, photoRefs } = pairPhotoRefs(photoKeys, photoUrls);
        if (photos.length > 0 || videoUrl) {
          out.set(s.vendor_service_id, {
            photos,
            videoUrl: videoUrl ?? null,
            photoRefs,
            videoRef: videoUrl ? (s.showcase_video_r2_key ?? null) : null,
          });
        }
      } catch {
        // Fail-soft — the card simply renders without its media strip.
      }
    }),
  );
  return out;
}

/**
 * SUP-12 · THE COVER PHOTO A SUPPLIER ALREADY UPLOADED.
 *
 * ── MEASURED ON THE LIVE SHOP, 2026-09-15 ──────────────────────────────────
 * The one published shop's "Live Band" card carries a real
 * `primary_photo_r2_key` in the database and the public page drew NO picture.
 * Its sibling "Host / MC" has none, so the pair is the honest test: one card
 * must gain a photo and the other must carry on without one.
 *
 * 🔑 NOTHING NEW IS BUILT HERE, and that is the whole row. The fallback itself
 * shipped on 2026-09-11 inside `toServiceCard` (C2) — "no showcase photos →
 * fall back to the card's own cover so the grid never draws a card with nothing
 * to look at" — and it takes the cover as an ALREADY-RESOLVED display URL,
 * because that function is pure and cannot sign a ref. Its docblock names the
 * two callers that do not pass it and says this page is one of them. So the
 * card was wired, the fallback was tested, and this page simply stopped one
 * argument short.
 *
 * Kept as a SIBLING of `resolveServiceShowcaseMedia` rather than folded into it:
 * that function's contract is the showcase strip, its own comment says the cover
 * is "intentionally untouched", and `ServiceShowcaseMedia` is a shared type with
 * other callers. Widening it here would change what they mean by showcase.
 *
 * Fail-soft per service, in parallel, exactly as the showcase resolver is: a dev
 * environment with no R2 credentials, or one bad ref, costs that card its
 * picture and never the profile.
 */
async function resolveServiceCoverUrls(
  services: ReadonlyArray<VendorServiceRow>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    services.map(async (s) => {
      if (!s.primary_photo_r2_key) return;
      try {
        const url = await displayUrlForStoredAsset(s.primary_photo_r2_key);
        if (url) out.set(s.vendor_service_id, url);
      } catch {
        // The card renders without its cover — never without the page.
      }
    }),
  );
  return out;
}

/**
 * SUP-14 · the LIVE taxonomy's tile for each distinct card kind on this page.
 *
 * Same shape the inquiry action already uses — `(await getTaxonomy()).map[kind]?.tile`
 * inside a try/catch — so a kind an admin adds tomorrow resolves with no deploy,
 * and a taxonomy that cannot be read degrades to the branch/`misc` rungs rather
 * than to a group key that does not exist.
 *
 * ONE read for the whole page, keyed by DISTINCT kind: a shop with six cards in
 * two trades asks twice, not six times.
 */
async function resolveTileByCardKind(
  services: ReadonlyArray<VendorServiceRow>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const kinds = Array.from(
    new Set(services.map((s) => (s.category ?? '').trim()).filter(Boolean)),
  );
  if (kinds.length === 0) return out;
  try {
    const taxonomy = await getTaxonomy();
    for (const kind of kinds) {
      const tile = taxonomy.map[kind]?.tile;
      if (tile) out.set(kind, tile);
    }
  } catch {
    // Empty map — the translator's later rungs still land every card.
  }
  return out;
}

// Named, slug-resolved so the bare-root dispatcher (app/[slug]/page.tsx) can
// render a vendor when a bare slug resolves to one, without duplicating this
// route. The route's own default export (below) is a thin wrapper.
export async function renderVendorBySlug({
  slug,
  searchParams,
  cachedCopy = false,
}: {
  slug: string;
  /**
   * ⚡ A stranger's copy for the cache (`app/v/[slug]/cached/page.tsx`, lib/shop-view.ts): the copy wears the shop's
   * tag, and the view is counted by the beacon in the browser rather than `after()` (rendered once, opened many times).
   * Everything the page DRAWS is the same — the request readers below already answer for a stranger there.
   */
  cachedCopy?: boolean;
  // Permissive index (string values) so the bare-root dispatcher — whose
  // searchParams shape differs — can pass its own through. The body reads only
  // string-valued keys (reviewsPage, wl, utm*, src).
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const search = await searchParams;
  // ONE read of the service-details flag for this render — it gates the card
  // doorway, the sheet, the per-service composer context (and the extra reads
  // that context needs) and the lock modal's "ask instead" action.
  const detailsEnabled = serviceDetailsEnabled();
  const openServicePublicId =
    detailsEnabled && typeof search.service === 'string' && search.service.trim()
      ? search.service.trim()
      : null;
  const vendor = await fetchVendor(slug);

  // 🔁 A CORRECTED SHOP ADDRESS FORWARDS HERE TOO.
  //
  // The admin correction form promises "links and QR codes already printed keep
  // working", and the BARE ROOT honours that — the dispatcher forwards before it
  // reaches this renderer. This route does not go through that dispatcher: a
  // review QR, an older share or an indexed result on the LEGACY `/v/{slug}`
  // form arrived here and hard-404'd, so the promise held for one of the two
  // addresses the same shop has been published under.
  //
  // Only on the genuine miss (`!vendor`) — a hidden or archived shop must keep
  // 404ing rather than disclose that it exists, so the visibility check below is
  // deliberately NOT part of this branch.
  if (!vendor) {
    const movedTo = await resolveRenamedPath(createAdminClient(), slug, ['vendor']);
    if (movedTo) redirect(movedTo);
  }

  if (!vendor) notFound();
  // ⚡ Filed under the shop's tag BEFORE any gate can 404 it — a hidden shop's copy clears when a save opens it.
  if (cachedCopy) await wearShopPageTags({ vendorProfileId: vendor.vendor_profile_id });

  // 🔒 WHO MAY OPEN THIS PAGE — ONE rule, `shopPageGate` (lib/own-shop-preview.ts). PUBLIC when the shop is live
  // (`isShopLive`: listed AND documents approved) — a demo shop included since 2026-11-06, marked "(DEMO ONLY)"; an admin in demo mode needs only the listing
  // (demo inventory dogfooding, unchanged). Otherwise the shop's OWNER and HELPERS see it with the team banner, and
  // everyone else gets the not-found page — which never says whether a shop exists. Archived (closed) shops are
  // shut for everyone.
  //
  // ⚠ THIS USED TO BE THREE 404s IN A ROW, and the owner carve-out sat under the last one: a `hidden` shop (every
  // shop not yet approved) and a demo shop 404'd for their own owner, and helpers were never let in. Owner, 23 Oct:
  // "why can't i see setnaprod's website?" — SetnaProd is a demo shop (DECISION_LOG 2026-09-29 "LANE 2 §2C" (1)).
  // The membership read runs ONLY when the page is not public, so a stranger's view costs no extra query.
  const isDemoVendor = vendor.is_demo === true;
  const inDemoMode = await isAdminInDemoMode();
  // 🏪 While bookings are closed a shop that chose Show my page opens before it is verified (`selfPublishedLive`).
  const gateBookingsOpen = await areBookingsOpen();
  const publicGate = shopPageGate(vendor, { isTeam: false, adminDemoMode: inDemoMode, bookingsOpen: gateBookingsOpen });
  const gate =
    publicGate.open === 'public'
      ? publicGate
      : shopPageGate(vendor, { isTeam: await viewerIsShopTeam(vendor), adminDemoMode: inDemoMode, bookingsOpen: gateBookingsOpen });
  if (gate.open === 'nobody') notFound();
  /** Non-null = the owner or a helper is looking at a page couples cannot see yet; the banner says why. */
  const teamPreview = gate.open === 'team' ? gate.reason : null;

  const visibility = parseVisibility(vendor.public_visibility);
  const bookable = isBookable(visibility);
  // 💬 DECISION_LOG 2026-11-07 rulings (1)+(4): a couple may MESSAGE a shop Setnayan has not decided yet — found in a
  // list or opened by its own link/QR — but not BOOK it. `canMessage` opens the Inquire doors only; every booking
  // door (packages Lock, Check a date, the booth, the waitlist, package asks) stays on `bookable`, verified-only.
  // The first message is the first inquiry, and the chat_messages trigger stamps the find lock.
  const canMessage = shopTakesMessages(vendor, bookable);
  // D2 (2026-09-11): a downgrade must REVERT the paid look — computed ONCE
  // here and threaded into every tier gate below (tierCaps, micrositeCan,
  // isTrueNameTier, boothTierCanBrand). Tier lapse is LOGIN-DRIVEN
  // (`sweep_vendor_tier_expiry` fires from the vendor dashboard layout) and
  // nobody is logged in on this public render, so a vendor whose
  // subscription ended months ago still carries a paid `tier_state` in this
  // row — reading it alone would hand the paid look out forever.
  // `effectiveSeoTier` already collapses a lapsed paid tier to 'free' (see
  // its own docblock); `vendorSeoPlanForVendor` below already used it for
  // the SEO plan, this just extends the SAME collapse to the page's own
  // rendered look instead of leaving the four gates reading the raw column.
  const effectiveTierState = effectiveSeoTier({
    tier_state: vendor.tier_state ?? null,
    tier_expires_at: vendor.tier_expires_at ?? null,
  });
  // 3D Booth Ads · Part C: vendors on a booth-brandable tier get a shareable
  // "walk into my booth" 3D showcase at /v/[slug]/booth (same gate that brands a
  // booth — Pro/Enterprise today, every tier once the 2026-07-25 tiered add-on
  // model is live, since 3D Plan Ads becomes buyable on Free/Solo). Behind
  // NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE (inlined; kept in lock-step with the route).
  // Include verification_state so the link never appears for a vendor the booth
  // route will notFound() (the profile page skips its verified-gate for owner-
  // preview / demo mode, so a mid-re-verification Pro vendor could see a dead link).
  const canShowBooth =
    envFlagEnabled(process.env.NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE) &&
    boothTierCanBrand(effectiveTierState) &&
    vendor.verification_state === 'verified';
  const isComingSoon = visibility === 'coming_soon';
  // Resolved ONCE for the whole render — the header logo and the JSON-LD
  // `image` below both consume it. See resolveDisplayUrl: the stored value is
  // an `r2://` reference, not something an <img> can load.
  const logoDisplayUrl = await resolveDisplayUrl(vendor.logo_url);

  const pageRaw = Number(search.reviewsPage ?? '1');
  const reviewsPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = reviewsPage * REVIEWS_PAGE_SIZE;

  const admin = createAdminClient();
  // 💸 UNLISTED AND UNCOUNTED (owner 2026-11-12): events whose booking-fee top-up is past its event day and unsettled.
  // Their review, the photos put on this page from them and their featured story are left out until it is settled
  // (the stars are uncounted in SQL). Empty with the fee lock off, and on a refused read.
  const unlistedEvents = await readOverdueTopUpEventIds(vendor.vendor_profile_id, manilaToday());
  const unlistedPageRefs = await readPageRefsFromEvents(vendor.vendor_profile_id, unlistedEvents);
  // ⭐ FROM GUESTS (owner, 6 Nov) — the guests' own reviews, read beside everything below. Three states: a refused read
  // is SAID under the hosts' list, never turned into "no guest reviews". It never feeds the overall (option A).
  const guestReviewsPromise: Promise<GuestReviewsRead> = readGuestReviewsForVendor(admin, vendor.vendor_profile_id, {
    limit: 20,
  }).catch((): GuestReviewsRead => ({ state: 'refused' }));
  // ⭐ EACH CARD'S OWN NUMBERS (prototype 6 Nov § 4 / § 9) — the hosts' (the shop's trusted filter, per card) and the
  // guests' own. A refused read is `null`: that kind of line is simply not drawn on any card, never "0 reviews".
  const cardHostStatsPromise = fetchCardHostReviewStats(admin, vendor.vendor_profile_id).catch(() => null);
  const cardGuestStatsPromise = readCardGuestReviewStats(admin, vendor.vendor_profile_id).catch(() => null);
  const [reviewStats, trustedReviewStats, reviews, allServices, vendorPackages, recommendingCouples, finalizedBookingRead, completedEvents, hidePricesPublicly] = await Promise.all([
    fetchReviewStats(admin, vendor.vendor_profile_id),
    // ANTI-FRAUD (2026-07-05, Phase 1 follow-up): the PUBLIC headline average
    // + review count read the TRUSTED (receipt-backed, arm's-length) stat, so
    // fake / self-dealt reviews can't inflate the number couples see. The raw
    // `reviewStats` above still backs the per-star histogram bars + the review
    // LIST pagination (`hasMore`), which stay as-is.
    fetchTrustedReviewStats(admin, vendor.vendor_profile_id),
    fetchReviewsForVendorWithCouple(admin, vendor.vendor_profile_id, { limit, offset: 0, excludeEventIds: [...unlistedEvents] }),
    fetchVendorServices(admin, vendor.vendor_profile_id),
    // Vendor packages (owner directive 2026-05-22) — bundled multi-category
    // wedding offerings. Public-read via RLS when is_active=TRUE. The fetch
    // is best-effort: if the table doesn't exist yet in a deploy environment
    // (migration unapplied), the catch returns [] and the page renders
    // without the Packages section.
    fetchVendorPackagesWithItems(admin, vendor.vendor_profile_id),
    // "Recommended by N couples" trust signal (Event Lifecycle Menu §6.3).
    // Distinct events with a completion-gated recommendation; 0 → not rendered.
    countVendorRecommendingCouples(admin, vendor.vendor_profile_id),
    // Experience tier badge (Vendor_Quality_Rating_System §5) — VETTED
    // completed events through Setnayan. ANTI-FRAUD (2026-07-05, Phase 1
    // follow-up): reads `vendor_public_completed_events_stats.public_completed_count`
    // (self-dealing EXCLUDED) instead of the raw
    // `vendor_activity_stats.finalized_booking_count`, so a vendor can't inflate
    // the Experience tier by self-creating "delivered" events. Best-effort:
    // missing view / unapplied migration → 0 → "New to Setnayan". Never blocks.
    // ⚠ `null` USED TO MEAN TWO THINGS HERE: "this vendor is genuinely new"
    // and "we could not find out". Both fell through `experienceTier(null)` to
    // the tier **"New to Setnayan"**, which the hero states as a fact — so a
    // refused read publicly demoted an Elite supplier with 200 finalised events
    // to NEW, on their own shop page, in front of couples deciding whether to
    // hire them. That is not a missing number; it is a claim about somebody's
    // business, and it is the kind a stranger reads.
    (async (): Promise<{ count: number | null; measured: boolean }> => {
      const { data, error } = await admin
        .from('vendor_public_completed_events_stats')
        .select('public_completed_count')
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .maybeSingle();
      if (error) {
        console.warn('[v/[slug]] vendor_public_completed_events_stats fetch failed', error.message);
        return { count: null, measured: false };
      }
      // No row is a real answer: this vendor has no completed events yet.
      return {
        count: (data as { public_completed_count: number | null } | null)?.public_completed_count ?? null,
        measured: true,
      };
    })(),
    // Receipt-backed dated track record (Wave 5) — one row per delivered/
    // complete LINKED booking, with the same owner/team/internal/self-comp
    // exclusions as the public completed-events count. Best-effort: a missing
    // view (stale deploy) returns [] and the Track Record section is omitted.
    fetchVendorCompletedEvents(admin, vendor.vendor_profile_id, { limit: 60 }),
    // Public "hide my prices" preference (Option A · council #6). Gates every
    // peso figure on this page when the vendor opted in; default false = show.
    fetchVendorHidesPricesPublicly(admin, vendor.vendor_profile_id),
  ]);

  // "Trusted by" — vendors who endorsed this one via the vendor↔vendor
  // mutual-accept handshake (accepted + active vendor_partnerships pointing at
  // this vendor). Founder-only marketplace → [] today; the section hides itself.
  // A REFUSED read is not the same [] — say we couldn't check instead of
  // silently reading as "nobody endorsed this shop" (S41, reads-are-honest).
  const trustedByRead = await fetchTrustedByVendors(admin, vendor.vendor_profile_id);
  const trustedByUnreadable = trustedByRead === TRUSTED_BY_UNREADABLE;
  const trustedBy = trustedByUnreadable ? [] : trustedByRead;

  // Verified "typical price" (dark behind NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED).
  // The median of this vendor's OWN locked-booking declared prices. Read ONLY
  // when the flag is on AND the vendor isn't hiding prices publicly. Returns the
  // vendor's own rounded typical price — no cross-vendor comparison (comp-law).
  const verifiedTypicalPrice =
    verifiedMedianEnabled() && !hidePricesPublicly
      ? await fetchVendorVerifiedMedian(vendor.vendor_profile_id)
      : null;

  // Favorites count (owner 2026-07-02: favorites PUBLIC / viewers vendor-only) —
  // distinct couples who follow OR saved this vendor (count_saves_for_vendor
  // combines vendor_follows + guest_saved_vendors), then min-N floored in-app
  // (FAVORITES_MIN_DISPLAY) so a tiny count never publishes as vanity or
  // de-anonymizes.
  //
  // 🔴 THIS RENDERED ZERO ON EVERY PUBLIC SHOP PAGE FROM THE DAY IT SHIPPED
  // UNTIL 2026-08-15, and the badge therefore never drew. The comment that used
  // to sit here said the service-role client covers it because *"the RPC's
  // EXECUTE grant is authenticated-only, but a public render needs it"* — true
  // about the GRANT, and silent about the OWNER/ADMIN GATE inside the function
  // body, which service role does not satisfy either. **Service role bypasses
  // RLS, not a hand-written `RAISE EXCEPTION` in a SECURITY DEFINER function.**
  // Every call raised P0001 `forbidden`, and the fail-soft below turned that
  // refusal into the number 0 — indistinguishable from "nobody saved them".
  // Migration `20271141980127` admits the trusted server to that gate (owner
  // and admin unchanged; `anon` still refused). See it for why that grants the
  // server nothing it could not already do.
  //
  // The fail-soft stays: a transient blip must hide the badge, never break a
  // public shop page. But it is now the LAST resort rather than the only path.
  const favoritesCount = await (async () => {
    const { data, error } = await admin.rpc('count_saves_for_vendor', {
      p_vendor_profile_id: vendor.vendor_profile_id,
    });
    if (error) {
      // The fail-soft (hide the badge) stays — see the comment above — but a
      // refused call should not vanish the way the pre-20271141980127 P0001s did.
      logQueryError('app/v/[slug]/page.tsx: count_saves_for_vendor', error, {
        vendor_profile_id: vendor.vendor_profile_id,
      });
    }
    return !error && typeof data === 'number' ? data : 0;
  })();

  // Spec §5 experience tier — surfaced as a subtle hero badge. We render the
  // tier even for "New to Setnayan" on the profile (honest, not negative).
  const finalizedBookingCount = finalizedBookingRead.count;
  const bookingCountMeasured = finalizedBookingRead.measured;
  const expTier = experienceTier(finalizedBookingCount);
  // 🏅 The pills (lib/shop-badges.ts). Verified has its own gate below (the route's strict `verification_state`), so it
  // is left out here; the ★ pill keeps the Free-tier star gate it always had. Awards fail soft to none (the shipped
  // `fetchVendorCurrentAwards` contract).
  const spotlightAwards = await fetchVendorCurrentAwards(admin, vendor.vendor_profile_id).catch(() => []);
  const pagePills = shopBadges({
    verified: false,
    completedEvents: bookingCountMeasured ? (finalizedBookingCount ?? 0) : null,
    trusted: trustedReviewStats,
    inBusinessSinceYear: null,
    awards: [...new Set(spotlightAwards)].map((a) => AWARD_LABELS[a]),
    nowYear: new Date().getFullYear(),
  });
  const performancePills = pagePills.filter((b) => b.kind === 'milestone' || b.kind === 'award');
  const ratingPill = pagePills.find((b) => b.kind === 'rating') ?? null;

  // Declared + DTI-verified experience (flag + schema gated; soft-probe degrades
  // on 42703 so a pre-migration DB never breaks the profile). Sits alongside the
  // Setnayan-native tier so the card reads credible at launch.
  /* Platform tenure. Deliberately NOT inside the `vendorExperienceEnabled()`
     probe below: that is flag-gated, and a line hidden behind a switch whose
     production value nobody can read is how a feature ships dark. `created_at`
     arrives with the page's own select, so this costs no extra query. */
  /* 🗓 "On Setnayan since Oct 2026" (owner 2026-10-29 "Since is two lines"; supplier website by plan 2026-10-30) —
     the one phrasing `lib/in-business-since.ts` owns, the same words Your details shows the shop. It replaces the
     older "On the marketplace since …" sentence on this page and keeps that line's two rules: ungated, and an
     unreadable stamp says nothing rather than a date. */
  const onSetnayanSince = onSetnayanSinceLine((vendor as { created_at?: string | null }).created_at ?? null);

  let declaredExp: {
    years: number | null;
    sinceYear: number | null;
    weddings: number | null;
    verified: boolean;
  } | null = null;
  if (vendorExperienceEnabled()) {
    // ⚠ THIS SWALLOW IS DELIBERATE AND STAYS — the `.then` soft-probe exists so a
    // pre-migration database answering 42703 (undefined column) degrades instead of
    // breaking a PUBLIC shop page. That is the right trade and it is not changed.
    // 🔑 BUT A DELIBERATE SWALLOW STILL HAS TO BE VISIBLE. Every refusal — not only
    // a missing column — erased the shop's TRACK RECORD silently: years in business
    // and weddings done both fell to null, so a verified supplier read as having
    // none, on the page whose whole job is to establish that it has some. The error
    // is captured INSIDE the probe, so the fallback behaves exactly as before and
    // the reason reaches the logs.
    let expProbeError: { message?: string; code?: string } | null = null;
    const { data: exp } = await admin
      .from('vendor_profiles')
      .select('in_business_since_year, weddings_done_approx, experience_verified_at')
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .maybeSingle()
      .then((r) => {
        if (r.error) {
          expProbeError = r.error;
          return { data: null };
        }
        return r;
      });
    if (expProbeError) {
      logQueryError('PublicVendorPage.experienceProbe', expProbeError, { slug }, 'graceful_degrade');
    }
    const e = exp as
      | { in_business_since_year?: number | null; weddings_done_approx?: number | null; experience_verified_at?: string | null }
      | null;
    const nowYear = new Date().getFullYear();
    const years = yearsInBusiness(e?.in_business_since_year ?? null, nowYear);
    const rawSince = e?.in_business_since_year ?? null;
    // The year itself for "In business since 2019" — never a future or pre-1900 year (the yearsInBusiness bounds);
    // a first-year shop keeps its year ("since 2026") even though it has no "N yrs" to show.
    const sinceYear = rawSince != null && rawSince >= 1900 && rawSince <= nowYear ? rawSince : null;
    const weddings = e?.weddings_done_approx ?? null;
    if (years != null || sinceYear != null || weddings != null) {
      declaredExp = { years, sinceYear, weddings, verified: !!e?.experience_verified_at };
    }
  }

  const hasMore = reviewStats.total_count > reviews.length;
  const activeServices = allServices.filter((s) => s.is_active);

  // Service-card enrichment (redesign · Phase 4) — FREE inclusions + the
  // multi-discount set for the active services, surfaced to couples on the
  // profile's Services & pricing gallery. Both fetchers fail-soft to empty maps
  // (missing table / unapplied migration → the cards render without them). The
  // vendor is already resolved as published + these ids are all active, so the
  // read is correctly scoped even under the server-role admin client.
  const activeServiceIds = activeServices.map((s) => s.vendor_service_id);
  // 🔗🖼 ONE batched, paged read of the shop's approved inspiration — started here so it runs beside the card batch
  // below. `null` = it could not be read to the end: no Inspiration section and no looks strip (never a partial one).
  const shopInspirationRead: Promise<ShopInspirationLook[] | null> = getInspirationParts()
    .then((parts) => fetchShopInspirationLooks(admin as unknown as ShopInspirationClient, vendor.vendor_profile_id, parts))
    .catch(() => null);
  // Coverage ids behind the active cards — drive the "Serves" line (event
  // types + faiths). Legacy services (coverage_id null) simply show no line.
  const coverageIds = Array.from(
    new Set(
      activeServices
        .map((s) => s.coverage_id)
        .filter((id): id is number => id !== null),
    ),
  );
  const [
    inclusionsByService,
    discountsByService,
    coveragesById,
    eventTypeVocab,
    showcaseByService,
    coverUrlByService,
    tileByCardKind,
    couplePhotosByService,
    cardHidesByService,
  ] = await Promise.all([
    fetchInclusionsByService(admin, activeServiceIds),
    // 🏷 the cards' own rows + the shop's running offers (Build 6 Lane D) — couples see the single best of both.
    fetchDiscountsWithOffers(admin, activeServiceIds),
    fetchCoveragesByIdPublic(admin, coverageIds),
    // Fail-soft by contract (falls back to the hardcoded roster on error).
    getEventTypeVocab(),
    resolveServiceShowcaseMedia(activeServices),
    resolveServiceCoverUrls(activeServices),
    resolveTileByCardKind(activeServices),
    // 📸 Couples' own photos the shop APPROVED, per card — the one public door (approved only), in the same batch.
    fetchServiceCardCouplePhotos(admin, activeServiceIds),
    // 🃏 What the shop hid on each card (hide per card never deletes) — only read where the grown card is drawn.
    detailsEnabled ? readCardHides(admin, activeServiceIds) : Promise.resolve<CardHidesRead>({ status: 'ok', byCard: new Map() }),
  ]);
  // ③0-c — the coarse category each category files its cards under is the LIVE column
  // (`service_categories.coarse_category`); same cached snapshot the tile lookup above read.
  const coarseSource = await getTaxonomy();

  // CARD RECORD (owner-locked 2026-07-28) — each card's compiled history:
  // booked count, event-type mix, anonymized ledger, milestone medals. ONE RPC
  // for the WHOLE gallery: `service_card_records` is batched precisely because
  // this page is force-dynamic, so a per-card reader would have meant one
  // round-trip per card on every uncached public request.
  //
  // Read through `admin` (service-role). The RPC is deliberately NOT granted to
  // anon — no browser calls it, and withholding anon EXECUTE also closes the
  // id-enumeration path to draft and paused cards. It returns only
  // de-identified aggregates (no name, id, exact date, venue, price or exact
  // pax), with a minimum-N floor and a completed-month ledger boundary applied
  // in SQL, so nothing here can under-suppress by forgetting a rule.
  //
  // Flag-gated so OFF costs not one extra query — the map stays empty, every
  // card's `record` is null, and the gallery renders byte-identically to today.
  const cardRecordByService = cardRecordEnabled()
    ? await fetchServiceCardRecords(admin, activeServiceIds)
    : new Map<string, CompiledCardRecord>();
  // 🃏📸 ONE ALBUM, TWO PLACES (DECISION_LOG 2026-10-08, frame 77) — each live card's albums from the events it was
  // booked on, read ONCE for the shop (the same albums the supplier's Their work holds). Rides the same flag: OFF → not
  // read, no card carries `albums`, the grown card is as before. A refused read → every card says "Couldn't load".
  // No ids reach the page: `toAlbumViews` without an href is labels and photo URLs only.
  // 📸 …and the same read gives each card its event photos for PHOTOS BY SERVICE (owner 2026-11-14): one entry per
  // photo, captioned kind · month, keyed to an opaque per-page event number — never the event id.
  const shopWork = cardRecordEnabled()
    ? await readShopWork(admin, { vendorProfileId: vendor.vendor_profile_id, serviceIds: activeServiceIds }).catch(() => null)
    : undefined;
  const albumsByService: Map<string, AlbumView[] | null> | null =
    shopWork === undefined
      ? null
      : new Map(activeServiceIds.map((id) => [id, shopWork ? toAlbumViews(cardAlbums(shopWork.albums, id)) : null]));
  const eventPhotosByService = shopWork === undefined ? null : eventPhotosOf(shopWork, activeServiceIds);

  // Pre-format the per-service "Serves" line server-side so the client gallery
  // stays a dumb view (same contract as inclusions/discount labels).
  const eventTypeLabelByKey = new Map(eventTypeVocab.map((t) => [t.key, t.label]));
  // "N events ›" + its by-kind sheet (owner 2026-10-30, item 114) — the Track record's OWN rows (receipt-backed, per
  // kind) plus the shop's own wedding count. No new read: both already arrived above. 60 = that read's limit.
  const shopEventsByKind = eventsByKind({
    completed: completedEvents,
    completedCapped: completedEvents.length >= 60,
    declaredWeddings: declaredExp?.weddings ?? null,
    labelFor: (key) => eventTypeLabelByKey.get(key) ?? formatEventTypeLabel(key || null),
  });
  const servesByService = new Map<string, string>();
  for (const s of activeServices) {
    if (s.coverage_id === null) continue;
    const line = buildServesLine(coveragesById.get(s.coverage_id), eventTypeLabelByKey);
    if (line) servesByService.set(s.vendor_service_id, line);
  }

  // A card's name and price line, shared by the inspiration tiles and the Inquire pop-up. A hidden or missing price
  // reads "Price on request" — never "Inquire", which is the ONE button's word (owner 13 Nov 2026, "Yes, only one").
  const serviceLabel = (s: VendorServiceRow): string =>
    s.title?.trim() || displayServiceLabel(s.category);
  const servicePriceLabel = (s: VendorServiceRow): string =>
    !hidePricesPublicly && s.starting_price_php !== null && s.starting_price_php > 0
      ? `from ${formatPhpRounded(s.starting_price_php)}`
      : 'Price on request';

  // 🔗🖼 THE FOUR-WAY LINK, ON THE PAGE. A look shows when it has no card (the shop's own) or its card is LIVE here —
  // the approved design's `liveLooks` (a Free shop's hidden cards keep their looks hidden too, open question 3 taken
  // as drawn). Each live card carries its looks; the section's tiles link to the card's anchor.
  const shopInspiration = await shopInspirationRead;
  const liveCardById = new Map(activeServices.map((s) => [s.vendor_service_id, s]));
  const shownLooks = (shopInspiration ?? []).filter((l) => !l.vendorServiceId || liveCardById.has(l.vendorServiceId));
  const inspirationByService = shopInspiration === null ? null : looksByCard(shownLooks);
  const inspirationTiles: InspirationTile[] = shownLooks.map((l) => {
    const s = l.vendorServiceId ? liveCardById.get(l.vendorServiceId) : undefined;
    return {
      id: l.id,
      url: l.url,
      part: l.part,
      card: s
        ? { label: serviceLabel(s), priceLabel: servicePriceLabel(s), anchorId: cardAnchorId(s.public_id, s.vendor_service_id) }
        : null,
    };
  });

  // Per-category attribute details + portfolio gallery (iteration 0044).
  const [attributeDetails, portfolioPhotos, microsite, igMedia, repertoire] = await Promise.all([
    fetchVendorAttributeDetails(admin, vendor.vendor_profile_id),
    resolvePortfolioPhotos((vendor.portfolio_r2_keys ?? []).filter((k: string) => !unlistedPageRefs.has(k))),
    // Microsite curation (My Shop → Website editor). Defensive read — an
    // un-curated vendor / not-yet-applied migration degrades to the
    // auto-composed baseline.
    fetchVendorMicrosite(admin, vendor.vendor_profile_id),
    // Synced Instagram posts the vendor chose to show. Best-effort: degrades to
    // [] on any error (pre-migration DB / no connection), so the portfolio never
    // breaks. Feature is inert until Meta is configured — until then this is [].
    fetchVendorIgMediaForPublic(vendor.vendor_profile_id),
    /*
      What this band can play, and a link to them playing it. Owner 2026-08-18:
      *"bands/musicians can pick the song they can do. and they can link videos
      of them performing that song via youtube link."*

      🔑 NOTHING PUBLIC READ THE REPERTOIRE BEFORE THIS. It existed only to match
      requests on the day. So a band's set list — the single most useful thing a
      couple comparing bands can look at — was invisible to them, and storing a
      video with no viewer would have been a gate with no handle.
    */
    fetchVendorSongs(admin, vendor.vendor_profile_id),
  ]);
  // ── Tier-gated website features · downgrade REVERTS (owner 2026-07-03) ──────
  // Every premium customization is gated on the vendor's CURRENT tier, mirroring
  // the caps the My-Shop editor uses. On a downgrade OR a lapsed subscription the
  // stored data is KEPT (never deleted) but stops rendering — so the page cleanly
  // drops to the tier's baseline look, and a re-upgrade restores everything
  // instantly (no redo). Solo+ (`canPersonalizePage`) unlocks About · accent ·
  // featured-service order · section toggles; Pro+ (`premiumLayout`) unlocks the
  // hero photo · pinned review · editorials · the 2-column layout. The custom URL
  // is deliberately NOT reverted (it's a shared permalink — dropping it would 404
  // links already handed out); routing keeps resolving it.
  const viewerTierCaps = tierCaps(effectiveTierState);
  // Pro page parts read `premiumPage` (Pro+). Until 2026-11-04 they rode `customWebsiteName`, which then moved down to
  // Solo (owner, "website applies to solo as well") — the address moved, the Pro page did not.
  const premiumLayout = viewerTierCaps.premiumPage;
  // 💳 The CONTENT a supplier picks in the My Shop editor renders when the
  // editor let them save it — the one flag-aware question
  // (lib/vendor-feature-gate.ts). While VENDOR_TIER_FEATURE_GATE is off every
  // shop may save About · accent · sections · featured services · hero photo ·
  // pinned review, so every shop's picks render; a save the page then ignored
  // would be a success that changed nothing. On: exactly the tier rule, so a
  // downgrade still reverts. The 2-column LAYOUT (`premiumLayout`) and the
  // Enterprise cinematic hero are plan looks, not picks — untouched.
  const canPersonalizePage = !vendorPaywallApplies(
    micrositeCan(effectiveTierState).canPersonalize,
  );
  const proPicksRender = !vendorPaywallApplies(premiumLayout);
  // Section toggles are a Solo control → below Solo, ignore the saved hide/show
  // set and fall back to defaults (all baseline sections visible).
  const pageSections = canPersonalizePage ? microsite.sections : {};

  const portfolioUrls = portfolioPhotos.map((p) => p.url);
  const showPortfolio = isSectionVisible(pageSections, 'portfolio');
  const showTrustedBy = isSectionVisible(pageSections, 'trusted_by');
  const orderedServices = orderFeaturedFirst(
    vendor.services,
    canPersonalizePage ? microsite.featuredServiceIds : [],
  );
  // Pro hero override — a chosen portfolio photo leads the page as a banner.
  const heroPhotoUrl =
    proPicksRender && microsite.heroPhotoKey
      ? unlistedPageRefs.has(microsite.heroPhotoKey)
        ? null
        : ((await resolvePortfolioUrls([microsite.heroPhotoKey]))[0] ?? null)
      : null;
  // Solo accent — retint the microsite's accent ramp (undefined = default).
  const accentVars = canPersonalizePage
    ? micrositeAccentVars(microsite.accent)
    : undefined;
  // Pro pinned review — the chosen review leads the list.
  // 🔴 S43 · 4: this used to say "if it's older than the loaded window it simply
  // isn't surfaced (no extra fetch)". The window is the newest 5, so pinning any
  // older review — the whole point of pinning — changed nothing on the page the
  // supplier was paying to customise. When the pin is outside the window it is
  // now fetched on its own, scoped to THIS vendor (a stale/foreign id still
  // no-ops). A refused read is logged and the list renders unpinned.
  const pinnedReviewId = proPicksRender ? microsite.pinnedReviewId : null;
  let pinnedOutsideWindow: (typeof reviews)[number] | null = null;
  if (pinnedReviewId && !reviews.some((r) => r.review_id === pinnedReviewId)) {
    try {
      pinnedOutsideWindow = await fetchReviewForVendorWithCouple(
        admin,
        vendor.vendor_profile_id,
        pinnedReviewId,
      );
      // 💸 A pinned review from an unlisted event (overdue top-up) is not shown either.
      if (pinnedOutsideWindow?.event_id && unlistedEvents.has(pinnedOutsideWindow.event_id)) pinnedOutsideWindow = null;
    } catch (err) {
      logQueryError(
        'PublicVendorPage.pinnedReview',
        err,
        { slug },
        'graceful_degrade',
      );
    }
  }
  const orderedReviews = pinReviewFirst(reviews, pinnedReviewId, pinnedOutsideWindow);
  // 🃏 "For <card> · see the card" (prototype § 5) — only a LIVE card on this page can be linked; a review whose card
  // is retired, or from before a review knew its card, shows no "For" line. Nothing is guessed.
  const reviewCardsById = new Map<string, ReviewCardLink>(
    activeServices.map((s) => [
      s.vendor_service_id,
      {
        title: serviceLabel(s),
        anchorId: cardAnchorId(s.public_id, s.vendor_service_id),
        photoUrl: coverUrlByService.get(s.vendor_service_id) ?? null,
      },
    ]),
  );
  const guestReviews = await guestReviewsPromise;
  const guestReviewPhotoUrls =
    guestReviews.state === 'rows' ? await resolveGuestReviewPhotoUrls(guestReviews.rows) : new Map<string, string>();
  const [cardHostStats, cardGuestStats] = await Promise.all([cardHostStatsPromise, cardGuestStatsPromise]);
  const reviewsByService: Map<string, CardReviews> = buildCardReviews({
    serviceIds: activeServices.map((s) => s.vendor_service_id),
    hostStats: cardHostStats,
    guestStats: cardGuestStats,
    hostReviews: orderedReviews,
    guestRows: guestReviews.state === 'rows' ? guestReviews.rows : [],
    guestPhotoUrls: guestReviewPhotoUrls,
    // "read all" lands on this page's own "From guests" group (coordinator, 6 Nov).
    readAllHref: '#guest-reviews',
  });

  // ── SUPPLIER WEBSITE BY PLAN (owner-approved 2026-10-30) — the card column's plan pieces ─────────────────────────
  // Reach: the plan's ring (lib/vendor-tier-caps.ts serviceRadiusKm) clamping the shop's own outer ring — the SAME
  // number couples' search and the supplier's Where you work map draw; an unverified shop reaches 0 km and says why.
  const reach = shopReach({
    verified: vendor.verification_state === 'verified',
    tier: effectiveTierState,
    declaredOuterKm: vendor.outer_radius_km ?? null,
  });
  // Solo+ — their own web address pointing at this page (approved Q4 = A; Solo since owner 2026-11-04). Read only when
  // the plan shows it (`customWebsiteName`); a refused read shows the Setnayan address alone, which is still true.
  let ownAddress: string | null = null;
  if (viewerTierCaps.customWebsiteName) {
    const { data: domainRow, error: domainError } = await admin
      .from('custom_domains')
      .select('domain, verified_at')
      .eq('owner_type', 'vendor')
      .eq('owner_id', vendor.vendor_profile_id)
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (domainError) logQueryError('PublicVendorPage.customDomain', domainError, { slug }, 'graceful_degrade');
    const d = domainRow as { domain?: string | null; verified_at?: string | null } | null;
    ownAddress = ownWebAddress({ planAllows: true, domain: d?.domain, verifiedAt: d?.verified_at });
  }
  const setnayanAddress = `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com')
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '')}/${vendor.business_slug ?? slug}`;
  // Pro+ — the pinned review's first words in the card column (it still leads the Reviews list too). Only when the
  // plan shows review words at all (`reviewCommentsViewable`) and the pin resolved to a review with words.
  const pinnedLead =
    pinnedReviewId && viewerTierCaps.reviewCommentsViewable && orderedReviews[0]?.review_id === pinnedReviewId
      ? orderedReviews[0]
      : null;
  const pinnedLeadQuote = pinnedLead ? pinnedQuote(pinnedLead.body) : null;

  // "Featured in these stories" — BOTH voices crediting this vendor (PR-D ·
  // Storytellers council verdict 2026-07-16 + Simplicity Canon rule 2: being
  // credited in a story is ALWAYS FREE, any tier — the former Pro-gate
  // (`premiumLayout`) on this section is RETIRED; Pro keeps its other perks):
  //   • EDITORIALS — the vendor's own booked weddings the couple has
  //     PUBLISHED + consented to showcase. Featured-first ordering stays a
  //     personalization pick where available.
  //   • CHAPTERS — the owner-FEATURED, published creator chapters whose
  //     shoppable substrate credits this vendor (joins over the featured set,
  //     so it has nothing to show before the owner's first Feature click).
  // Best-effort + auto-hidden when BOTH are empty: the section renders
  // nothing until there's something to show.
  const showEditorials = isSectionVisible(pageSections, 'editorials');
  let featuredEditorials: VendorFeaturedStory[] = [];
  if (showEditorials) {
    try {
      // ⛔ THE PUBLIC SHOP PAGE MUST NEVER USE fetchVendorRoomEvents. This is read by
      // strangers. The room read admits an AGREED-but-unpaid booking, and publishing
      // those here would tell the world about weddings the couple has not paid a
      // downpayment on. A public claim needs the pool row, not the handshake.
      const bookings = await fetchVendorPoolBookings(admin, vendor.vendor_profile_id);
      const stories = await loadVendorFeaturedStories(
        bookings.map((b) => b.eventId).filter((id) => !unlistedEvents.has(id)),
      );
      const byId = new Map(stories.map((s) => [s.eventId, s]));
      featuredEditorials = orderFeaturedFirst(
        stories.map((s) => s.eventId),
        microsite.featuredEditorialIds,
      )
        .map((id) => byId.get(id))
        .filter((s): s is VendorFeaturedStory => Boolean(s))
        .slice(0, 3);
    } catch {
      featuredEditorials = [];
    }
  }
  let featuredChapterCredits: StorytellerTileItem[] = [];
  if (showEditorials) {
    featuredChapterCredits = await loadFeaturedChaptersCreditingVendor({
      businessSlug: vendor.business_slug,
      publicId: vendor.public_id,
    });
  }

  /* V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity. Resolves
     once at the page level so the hero, "Inquire" copy,
     LocalBusiness JSON-LD's `name` field, BreadcrumbList's leaf
     label, and the FollowGate vendorName all surface the same
     display label. Real business_name when the column says revealed,
     OR when the vendor is a true-name tier (Pro/Enterprise) per the
     Phase C tier gates below; Free + Verified stay anonymized until
     name_revealed_at is stamped on first reply. */
  // viewerTierCaps + premiumLayout + canPersonalizePage are computed above (the
  // downgrade-revert block); `viewerTierCaps` also drives the day-1 name reveal +
  // the review-display gate (stars / comments) further down the page.
  // Enterprise "Flagship" cinematic layer (tier ladder 2026-07-03) — a full,
  // name-overlaid hero. Only when the vendor is Enterprise AND has chosen a hero
  // photo (else it falls back to the standard banner + identity block).
  // Reuses micrositeCan's website-ladder rank (isEnterprise = rank ≥ 3).
  // 🌄 THE VERIFIED LOOK (owner 2026-11-13, DECISION_LOG "THE SHOP WEBSITE HAS TWO LOOKS" + "THREE PUBLIC PAGES
  // APPROVED"): EVERY verified shop — Verified · Solo · Pro · Ultra alike — wears the full-bleed hero with its name on
  // the photo, the overlapping calling card and the motion. Was: Ultra (Enterprise) with a chosen hero photo only. The
  // name stays `cinematicHero` because every guard that keeps the name, the badges and Inquire from doubling reads it.
  // An unverified shop is the calm sibling: no hero, one column. Reach, branches and the own address stay per plan.
  const cinematicHero = vendor.verification_state === 'verified';
  // The photo: the shop's chosen hero (Pro picks), else its first portfolio photo, else the shared placeholder.
  const heroImage = heroPhotoUrl ?? (showPortfolio ? (portfolioUrls[0] ?? null) : null);
  // Featured videos — ONE unified, all-tier video set (owner 2026-07-05: single
  // video system). The retired Enterprise-only "Films" rack (microsite_video_ids)
  // was folded into gallery_video_links (data migration
  // 20270519000000_merge_microsite_videos_into_gallery), so every video now
  // renders here. Each pasted link is classified: YouTube / Vimeo → inline 16:9
  // iframes (embedded, never a link out — kept); Instagram / Facebook / TikTok /
  // other → `kind: 'link'`, dropped here (owner ruling 2026-09-11 Q3: "Never
  // show links" — a click-through card to an outside platform is exactly the
  // door out Q3 closes). The vendor's pasted value stays saved in
  // gallery_video_links; only the public render narrows to what actually plays
  // in-page. Unparseable entries are dropped too.
  // 🎬 Each video carries the title its supplier gave it (Portfolio › Video links), keyed by the link as stored.
  const videoTitles = videoTitlesOf(vendor.gallery_video_titles);
  const featuredVideos = (vendor.gallery_video_links ?? [])
    .map((url) => {
      const v = parseVideoLink(url);
      return v ? { ...v, title: videoTitles[url] ?? null } : null;
    })
    .filter((v): v is NonNullable<ReturnType<typeof parseVideoLink>> & { title: string | null } => v !== null)
    .filter((v) => v.kind === 'iframe');
  const heroKicker = [
    vendor.services[0] ? displayServiceLabel(vendor.services[0]) : null,
    vendor.location_city,
  ]
    .filter(Boolean)
    .join(' · ');
  const displayLabel = resolveVendorDisplayName({
    business_name: vendor.business_name,
    name_revealed_at: vendor.name_revealed_at ?? null,
    primary_canonical_service: vendor.services?.[0] ?? null,
    location_city: vendor.location_city,
    // CLAUDE.md 2026-05-30 refinement row · pass services + screen_name
    // (Bark-format stored anonymized name from `vendor_profiles.screen_name`
    // per migration `20260714000000`). Venue exception fires when services
    // overlap with ['religious_venue', 'venue'] → real business_name.
    // Stored screen_name surfaces when present instead of the legacy
    // computed taxonomy-and-city placeholder.
    services: vendor.services ?? null,
    screen_name: vendor.screen_name ?? null,
    // Phase C: Pro/Enterprise reveal the real business_name day-1. Open-it-up
    // lock: a VERIFIED vendor's name is never gated (revealed on any tier).
    isPaidTier: isTrueNameTier(effectiveTierState),
    is_verified: vendor.verification_state === 'verified',
  });

  // The shop's OTHER locations, as a customer may see them (owner-ruled
  // 2026-08-28: yes, customers should see a supplier's branches — and a branch
  // must be PAID FOR to be one of them).
  //
  // Until this, a shop with five paid branches looked identical to a shop with
  // none: the branch library was a private label on My Shop and nothing about
  // it reached the marketplace, this page, search or the map.
  //
  // 🔒 Read with the SERVICE-ROLE client already in scope, scoped to the shop
  // this page is rendering — `vendor_branches` has no `anon` policy, and the
  // fix for that is not a blanket public read on a table that also holds every
  // unpaid and cancelled branch with its street address and coordinates. Only
  // the name and the city come back, and only for branches whose fee is paid
  // and whose 28-day window is live.
  // A read that fails shows NO branch line and no "Also here" list — never a guessed city — and says so in the logs
  // (owner 2026-11-13, "Show the branches as needed": the line exists only when the shop really has branches).
  const publicBranches = await fetchPublicVendorBranches(
    admin,
    vendor.vendor_profile_id,
  ).catch((err: unknown) => {
    console.error('[supabase-error] v/[slug] · public branches read failed — no branch line shown', err);
    return [];
  });

  // Resolve viewer state for the FollowGate (iteration 0019 § Gate). Public
  // page so the supabase client may have no user; that's fine — the gate
  // renders a "Sign in to follow" CTA in that case.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  /** The shop's own account is looking at its own page. Fails CLOSED: the
   *  fallback select carries no `user_id`, so a degraded read is a stranger. */
  const viewerOwnsShop =
    user !== null && typeof vendor.user_id === 'string' && vendor.user_id === user.id;
  /** 🃏 The viewer runs this shop (owner or owner/admin team — who RLS lets hide): only THEY are sent the items hidden
   *  on a card, to curate. Everyone else's cards are stripped on the server (`cardWithoutHidden`). Fails closed. */
  const viewerCuratesCards =
    detailsEnabled && !cachedCopy && user !== null && !isDemoVendor && (await viewerRunsShop(vendor.vendor_profile_id));
  let coupleEventId: string | null = null;
  /** `?event=` once CHECKED against the viewer's own events — the event this visit came for (lib/shop-back.ts).
   *  Never the `events[0]` fallback: only an event the link named can be "where you came from". */
  let arrivalEventId: string | null = null;
  /** The couple's intended event date (ISO YYYY-MM-DD) — drives the Booked-Out
   *  Waitlist CTA when the vendor is unavailable on it. */
  let coupleEventDate: string | null = null;
  /** Existing chat thread for this (coupleEvent, vendor) pair — non-null when
   *  the couple already sent an inquiry (any status except declined). Passed
   *  to the InquiryComposer so it can surface "View thread" instead of opening
   *  a new modal on re-visit. */
  if (user) {
    const events = await fetchUserEvents(supabase, user.id, 'couple');
    /*
      ── D1 · THE CELEBRATION THE COUPLE CHOSE, NOT THE ONE A RULE PICKED ──
      This was `events[0]`, and the couple was never asked.

      ⚠ `events[0]` IS NOT ARBITRARY, and an earlier version of this comment said
      it was. `fetchUserEvents` has no `.order()` on the QUERY, but it sorts the
      rows in JS before returning: `is_primary` first, then soonest
      `event_date`, dateless last. So `events[0]` is "your primary celebration,
      otherwise the soonest one" — a real rule, just an invisible one that the
      couple never chose and is never shown.

      🔑 WHERE IT *IS* GENUINELY UNDECIDED: that sort returns 0 for a tie, and
      `Array.prototype.sort` is stable, so tied rows keep the order the unordered
      query happened to return. Nothing enforces a single primary — a real
      account holding TWO events flagged `is_primary = true` was measured on
      2026-09-08 (see `saveVendorToPicks`), and for that couple which event won
      was arbitrary per request. Same for two celebrations on one date, or two
      with no date.

      Either way the couple is not asked, and this one line scopes the
      packages' Lock, the waitlist, and the inquiry that eventually puts
      this shop on somebody's list. A couple planning a wedding AND their
      parents' anniversary could not tell, and were not told, which celebration
      their question attached to.

      `?event=` is the picker's answer (add-shop-to-event-data.ts). It is a
      claim from a URL, so it is CHECKED — against `events` itself, the list of
      this user's own ORGANISER memberships that was just read. That list IS the
      authority, so the check cannot disagree with it and costs no second round
      trip; `saveVendorToPicks` needs `userHostsEvent` for the same question only
      because it never fetched the list. An id that is not yours, or is not real,
      falls through to the existing behaviour rather than erroring: a mistyped
      link must not break a shop page.

      🔑 THE FALLBACK STAYS, DELIBERATELY. A couple with exactly one celebration
      must never be made to choose, and everyone who has only one keeps today's
      behaviour byte for byte. The picker earns its place only where the
      invisible rule was deciding something the couple should.
    */
    const requestedEventId = String(search.event ?? '').trim();
    const chosen =
      requestedEventId && events.some((e) => e.event_id === requestedEventId)
        ? events.find((e) => e.event_id === requestedEventId)
        : undefined;
    coupleEventId = chosen?.event_id ?? events[0]?.event_id ?? null;
    arrivalEventId = chosen?.event_id ?? null;
    coupleEventDate = chosen?.event_date ?? events[0]?.event_date ?? null;
  }

  // Past-events gallery (owner 2026-07-18) — SAFE LAYER: the vendor's completed
  // events, venue-aware. When the viewer is a couple, read their venue and sort
  // the vendor's past events so the ones at the SAME venue come first (else most
  // recent). Facts only (venue · month · type); no couple names/photos, private
  // events excluded — the couple-identified photo layer is a consent-gated
  // follow-up. Reuses the anti-fraud-clean `completedEvents` already fetched.
  const viewerVenue = coupleEventId ? await fetchViewerVenue(admin, coupleEventId) : null;
  const venueEvents = await buildVendorVenueEvents(admin, completedEvents, viewerVenue, {
    limit: 12,
  });
  const venueMatchCount = venueEvents.filter((e) => e.atViewerVenue).length;

  /* 🧭 WHERE THIS VISIT CAME FROM (owner 2026-11-07, "back to suppliers … went to a wrong shell"). Read once; the
     back door at the foot of Inquire and every screen this page opens carry it (lib/shop-back.ts). */
  const shopArrival = { src: arrivalParams(search).src, eventId: arrivalEventId };
  const shopBack = shopBackDoor(shopArrival);
  /*
    💬 THE INQUIRE POP-UP (owner 2026-11-07: "inquire for your event is it should have been a pop up to first ask what
    service/s are they interested to then connect them to which event the user has and it will add them to those
    categories automatically and send inquire"). Every Inquire on this page opens it — services → which event (or a new
    one) → the ONE send, `startServiceInquiry`. Its event list is the shipped picker's (`resolveAddShopToEvent`, cached),
    read for anyone signed in. 13 Nov 2026: the inline composers are gone, and so are the reads only they used (linked
    services, the thread lookup, requirement facets, live pax for the composer, the AI-mode row, event types).
  */
  const viewerSignedIn = user !== null && !(user.is_anonymous ?? false);
  /* ‹ THE TOP-LEFT BACK (2026-11-12, DECISION_LOG "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"): where the arrival
     came from, returned to in place; cold, Discover signed out and Home signed in (lib/shop-back.ts `shopTopBack`). */
  const shopTop = shopTopBack(shopArrival, viewerSignedIn);
  const inquireEventState = canMessage && viewerSignedIn ? await resolveAddShopToEvent(slug) : null;
  const inquireEvents: InquireEvent[] =
    inquireEventState?.signedIn === true
      ? inquireEventState.options.map((o) => ({
          eventId: o.eventId,
          label: o.dateISO
            ? `${o.title} · ${new Date(`${o.dateISO}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}`
            : o.title,
        }))
      : [];
  // 📋 EVERY SERVICE THE SHOP PROVIDES (owner 2026-11-07, "Yes, list all"): the active cards as before, then each
  // service picked at sign-up (`vendor_profiles.services`) that has no card — named by the ONE taxonomy resolver
  // (`cardKindLabeller`, Admin › Categories), "Price on request". Inquire is never a dead end for a shop with no card.
  // Read only when the pop-up is mounted and the shop lists services — a shop with none never asks for a name.
  const inquireProvidedKeys = canMessage ? (vendor.services ?? []) : [];
  const inquireKindLabel = inquireProvidedKeys.length > 0 ? await cardKindLabeller() : (key: string) => key;
  const inquireServices: InquireService[] = inquireServiceList(
    activeServices.map((s) => ({
      serviceId: s.vendor_service_id,
      label: serviceLabel(s),
      // The price line, or nothing — `servicePriceLabel` says "Price on request" for a hidden price; the pop-up shows only real figures.
      price: !hidePricesPublicly && s.starting_price_php !== null && s.starting_price_php > 0 ? servicePriceLabel(s) : '',
      category: s.category ?? null,
    })),
    inquireProvidedKeys,
    inquireKindLabel,
    // A kind whose priced card is not live yet says so, never "Price on request" (Build 5 F4) — unless the shop hides
    // its prices, when no card's price would show either.
    hidePricesPublicly
      ? []
      : allServices.filter((s) => !s.is_active && s.starting_price_php !== null && s.starting_price_php > 0).map((s) => s.category ?? ''),
  );
  // Creator Economy PR-C/PR-D — provenance from the arrival URL, read ONCE for the pop-up.
  // startServiceInquiry re-validates both server-side, so an unknown ?src is inert.
  // 💳 THE OWN LINK VS THE SHOP PAGE (owner 2026-11-13: "their personal QR code" is free · "their website, we charge
  // them"; walk F-W1-58). Every link the supplier hands out carries `?src=own` (`ownPageUrl`) → 'website', their own
  // client, an import. An arrival with NO tag found the shop on Setnayan → 'shop_page', SOURCED. It used to be null,
  // which is an import: a booking made wholly in the app read "This client did not come from Setnayan".
  const arrivalInquirySource =
    search.src === OWN_LINK_SRC
      ? 'website'
      : search.src === 'editorial'
        ? 'editorial'
        : search.src === 'favorites'
          ? 'favorites'
          : search.src === 'explore'
            ? 'explore'
            : search.src === 'search'
              ? 'search'
              : 'shop_page';
  const arrivalChapter =
    typeof search.ref_chapter === 'string' && search.ref_chapter ? search.ref_chapter : null;
  // Head count for the package configurator's per-head option upgrades
  // ("+₱150/head"). SERVER-resolved, and the SAME number `lockPackage` resolves
  // for itself — quoting a per-head upgrade at anything else is a display total
  // that drifts from the charge. Only fetched when a package can actually be
  // configured: flag on, signed-in host with an event, packages to show.
  const packageLivePax =
    packageCreditEnabled() && coupleEventId && vendorPackages.length > 0
      ? ((await resolveLivePax(supabase, coupleEventId)) ?? 0)
      : 0;

  // ── "Ask the vendor about this build instead" — the lock modal's secondary
  //    action (same flag).
  //
  // A package is NOT a `vendor_service`, but `startServiceInquiry` files a
  // thread against one and records it in `thread_service_interests`. The ONLY
  // honest mapping is the package's OWN anchor — `primary_canonical_service` —
  // matched against the vendor's active services.
  //
  // 🚫 NO `activeServices[0]` FALLBACK. An earlier cut fell back to the
  // vendor's first active service, which would file a hotel's wedding package
  // under, say, their "styling" card: a wrong interest seed the vendor reads as
  // the couple's stated intent, and one that then feeds the shortlist and the
  // build. A wrong signal is worse than a missing one.
  //
  // NO ANCHOR MATCH ⇒ NO TARGET, and the secondary action simply does not
  // render for that package. `startServiceInquiry` hard-requires a real,
  // vendor-owned, active `initialServiceId` (it rejects at both the empty-input
  // guard and the `ownedById` ownership check), and none of its three shipped
  // interest sources — 'initial' / 'linked' / 'couple_added' — describes "a
  // package", nor does `thread_service_interests` carry a package dimension. So
  // rather than widen a shipped action's invariants for this edge, the doorway
  // is omitted: the couple can still ask through the page's one Inquire pop-up,
  // and nothing is mis-filed. Revisit if packages ever gain their own interest
  // kind.
  // 🚪 BOOKINGS CLOSED (owner 2026-11-02, `lib/bookings-open.ts`): every package still shows its price and
  // inclusions; only the Book button gives way to a quiet "Bookings open soon". Inquiries stay open.
  const bookingsOpen = vendorPackages.length > 0 ? await areBookingsOpen() : true;
  const packageAskTargets = new Map<string, PackageAskTarget>();
  if (detailsEnabled && bookable && coupleEventId) {
    for (const pkg of vendorPackages) {
      const match = activeServices.find(
        (s) => s.category === pkg.primary_canonical_service,
      );
      if (!match) continue;
      packageAskTargets.set(pkg.package_id, {
        vendorProfileId: vendor.vendor_profile_id,
        // Hybrid-anonymity: the placeholder label, never the raw business name.
        vendorLabel: displayLabel,
        vendorServiceId: match.vendor_service_id,
        categoryKey: match.category,
      });
    }
  }

  // ── Booked-Out Waitlist (Wave 4 vendor benefit) ──────────────────────────
  // When a signed-in couple's intended date is unavailable on this vendor, offer
  // a "join the waitlist" CTA. "Unavailable" = a business-wide closure (pool_id
  // IS NULL) OR a Setnayan booking covers the date — couples only ever see
  // "unavailable", never the label/reason (privacy lock). Pool-scoped manual
  // blocks gate specific services, not the whole vendor, so they don't trigger
  // the vendor-level CTA here. Reads run on the admin client (couples have no
  // SELECT on vendor_calendar_blocks). Strict YYYY-MM-DD + future-dated only —
  // year/month-mode event dates and past dates never show the CTA.
  const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const phToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  let waitlistDate: string | null = null;
  let waitlistEnabled = false;
  let alreadyWaitlisted = false;
  /** The shop has CHOSEN this couple for the date and is holding it for them. */
  let waitlistPicked = false;
  if (
    user &&
    bookable &&
    coupleEventDate &&
    DATE_ONLY_RE.test(coupleEventDate) &&
    coupleEventDate >= phToday
  ) {
    // PH civil-day bounds for the intended date (blocks store +08:00).
    const dayStart = `${coupleEventDate}T00:00:00+08:00`;
    const dayEnd = `${coupleEventDate}T23:30:00+08:00`;
    const { data: covering, error: coveringError } = await admin
      .from('vendor_calendar_blocks')
      // Every block that can touch the day — a one-off overlapping it or a REPEAT that began before it — and the
      // ONE rule decides (`lib/not-available.ts`: all-day only; a morning Mass leaves the date open).
      .select(`block_id, blocked_at, blocked_until, ${NOT_AVAILABLE_COLUMNS}`)
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .is('pool_id', null)
      .in('block_source', ['manual', 'setnayan_booking'])
      .lte('blocked_at', dayEnd)
      .or(notAvailableWindowFilter(dayStart))
      .limit(50);
    // ⚠ 🚨 A BLOCKED DATE READS AS AVAILABLE. These are the supplier's calendar blocks
    // ⚠ covering the date a couple is looking at. `?? []`/null on a refused read means
    // ⚠ no block is found, so the page shows the date as open — and a couple enquires
    // ⚠ about a day the supplier has closed. Same direction as the admin payments
    // ⚠ meter, where a falsely-zero inflow read as HEADROOM: absence becomes capacity.
    if (coveringError) {
      logQueryError('PublicVendorPage.covering', coveringError, { slug }, 'graceful_degrade');
    }
    const isUnavailable =
      Array.isArray(covering) &&
      (covering as { blocked_at: string; blocked_until: string }[]).some((b) => blockClosesDay(notAvailableShapeOf(b), coupleEventDate));
    if (isUnavailable) {
      waitlistDate = coupleEventDate;
      // Owner 2026-07: only offer the waitlist when the vendor switched it on;
      // otherwise the date is simply "unavailable" (no CTA).
      const { data: wlp, error: wlpError } = await admin
        .from('vendor_profiles')
        .select('waitlist_enabled')
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .maybeSingle();
      // ⚠ waitlist_enabled. Refused, the waitlist reads as switched off and a couple loses
      // ⚠ the only route left on a full date — a silent loss of an option, not a message.
      if (wlpError) {
        logQueryError('PublicVendorPage.wlp', wlpError, { slug }, 'graceful_degrade');
      }
      waitlistEnabled = Boolean(
        (wlp as { waitlist_enabled?: boolean } | null)?.waitlist_enabled,
      );
      // Has this couple already joined (pending/notified)?
      const { data: existing, error: existingError } = await admin
        .from('vendor_date_waitlist')
        // 🔴 `accepted_at` IS READ NOW, AND IT WAS THE MISSING HALF. This
        // selected `waitlist_id` alone and filtered on `status`, so a couple the
        // shop had CHOSEN was shown the identical "we'll email you the moment it
        // opens up" as one still waiting. `pickWaitlistCouple` writes
        // `accepted_at` and leaves `status` alone, so nothing in this query
        // could ever have moved.
        .select('waitlist_id, accepted_at')
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .eq('user_id', user.id)
        .eq('requested_date', coupleEventDate)
        .in('status', ['pending', 'notified'])
        .limit(1);
      // ⚠ whether this couple is ALREADY on the waitlist. Refused, they are offered 'join'
      // ⚠ again and can end up on it twice.
      if (existingError) {
        logQueryError('PublicVendorPage.existing', existingError, { slug }, 'graceful_degrade');
      }
      alreadyWaitlisted = Array.isArray(existing) && existing.length > 0;
      waitlistPicked =
        Array.isArray(existing) &&
        existing.some((r) => (r as { accepted_at?: string | null }).accepted_at != null);
    }
  }
  const waitlistNotice = typeof search?.wl === 'string' ? search.wl : null;

  // GEO Phase G4 (2026-05-28) — LocalBusiness JSON-LD lets AI answer engines
  // (ChatGPT-User · OAI-SearchBot · PerplexityBot · ClaudeBot — allowlisted
  // via robots.txt per CLAUDE.md 2026-05-14 SEO playbook) extract the
  // vendor's name, city, services, aggregate rating, and active packages
  // directly when responding to "find me a wedding photographer in Manila"
  // style queries. The schema mirrors only what's visibly on the page —
  // honest-state rule per [[feedback_setnayan_no_dev_text_post_launch]] +
  // no aggregateRating block when total_count is 0, no makesOffer entries
  // for inactive packages. RA 10173: address is city-level only (no street
  // number leaked to crawlers).
  const SITE_URL = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');

  // External-visibility ladder (Vendor_Monetization_Model_LOCKED_2026-07-25 § 8)
  // — FLAG-DARK. The IDENTITY graph below + the BreadcrumbList are "basic
  // indexability", free for every tier and never gated. Only the two paid
  // enrichments read the plan: `entityGraph` (knowsAbout · Solo+) and
  // `offerGraph` (hasOfferCatalog · makesOffer · priceRange · Pro+). With
  // NEXT_PUBLIC_VENDOR_SEO_TIER_GATE unset, the plan is the legacy all-true one
  // → this page's JSON-LD is byte-identical to today.
  //
  // The whole ROW goes in, not just `tier_state`: this is a PUBLIC render, so
  // nobody is logged in and the login-driven `sweep_vendor_tier_expiry` has not
  // run. `vendorSeoPlanForVendor` checks `tier_expires_at` itself and collapses
  // a lapsed paid tier to free. It also treats an ABSENT `tier_state` (the
  // legacy-select fallback below) as UNKNOWN rather than free, so a schema skew
  // cannot silently de-enrich a currently paying vendor.
  const seoPlan = vendorSeoPlanForVendor(
    { tier_state: vendor.tier_state, tier_expires_at: vendor.tier_expires_at },
    isVendorSeoTierGateEnabled(),
  );

  const vendorJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': `${SITE_URL}/${slug}#business`,
    /* V2.1 brief amendment #2 (2026-05-30): emit the hybrid-anonymity
       display label so AI engines + Google extract the safe
       placeholder ("Manila Wedding Photographer · Manila") while the
       business_name is hidden — not the real name. Once revealed,
       the real business_name surfaces unchanged. */
    name: displayLabel,
    url: `${SITE_URL}/${slug}`,
    description: vendor.tagline ?? `${displayLabel} on Setnayan.`,
    // E1 (2026-09-11) — same permanent card as the OG/Twitter images above,
    // not the raw (expiring) presigned logo URL. See
    // `vendorMetadataBySlug`'s `ogImageUrl` for the full rationale.
    image: `${SITE_URL}/api/og/v/${vendor.business_slug ?? slug}`,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PH',
      ...(vendor.location_city ? { addressLocality: vendor.location_city } : {}),
    },
    // C6 (2026-08-30): a shop with a declared city serves that city, not the
    // whole country — otherwise local search ("photographer in Cebu") can't
    // tell a Cebu shop from a Manila shop. Falls back to country-wide only
    // when the vendor hasn't set location_city.
    areaServed: vendor.location_city
      ? { '@type': 'City', name: vendor.location_city }
      : { '@type': 'Country', name: 'Philippines' },
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
    },
  };

  // Vendor services — surface canonical_service strings as `knowsAbout`
  // entries so AI engines can match the vendor against category queries.
  // Maps the enum key to its human-readable label when recognized.
  // GEO enrichment → Solo+ (seoPlan.entityGraph); always on while the gate is
  // dark.
  if (seoPlan.entityGraph && Array.isArray(vendor.services) && vendor.services.length > 0) {
    vendorJsonLd.knowsAbout = vendor.services.map((s: string) => displayServiceLabel(s));
  }

  // Aggregate rating ONLY when real reviews exist. Never invent ratings.
  // Phase C review-display gate (vendor-tier-caps): Free vendors
  // (reviewStarsCounted=false) hide the star rating, so the schema.org
  // aggregateRating is omitted too — no crawler-leak of tier-hidden stars.
  // ANTI-FRAUD (2026-07-05): the public aggregateRating is emitted from the
  // TRUSTED stat (receipt-backed, arm's-length) so a crawler never sees a
  // fake-inflated star average.
  if (
    viewerTierCaps.reviewStarsCounted &&
    trustedReviewStats.trusted_review_count > 0 &&
    trustedReviewStats.trusted_avg_rating > 0
  ) {
    vendorJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(trustedReviewStats.trusted_avg_rating.toFixed(2)),
      reviewCount: trustedReviewStats.trusted_review_count,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // makesOffer — one Offer per vendor_package with a price. Pesos as the
  // major currency unit per schema.org (NOT centavos). Skips packages
  // missing a price so AI engines don't see ₱0 phantom offers.
  // Council #6: when the vendor opted to hide prices, the structured data must
  // not leak a peso figure the visible page hides — so makesOffer + priceRange
  // are omitted entirely (the OfferCatalog of service NAMES below stays, as it
  // carries no prices).
  // AEO offer graph → Pro+ (seoPlan.offerGraph). Stacks with — never overrides —
  // the two existing suppressions: the vendor's own hide-prices choice and the
  // "no ₱0 phantom offers" price filter.
  const offerPackages = hidePricesPublicly || !seoPlan.offerGraph
    ? []
    : vendorPackages.filter(
        (pkg) => typeof pkg.total_price_centavos === 'number' && pkg.total_price_centavos > 0,
      );
  if (offerPackages.length > 0) {
    vendorJsonLd.makesOffer = offerPackages.map((pkg) => ({
      '@type': 'Offer',
      name: pkg.package_name,
      ...(pkg.description ? { description: pkg.description } : {}),
      price: String(Math.round(pkg.total_price_centavos / 100)),
      priceCurrency: 'PHP',
    }));

    // priceRange — a one-glance cost band derived from the vendor's OWN
    // published package prices (never invented). Lets AI answer engines
    // place the vendor in a budget tier ("affordable", "premium") without
    // parsing every makesOffer entry, the way Google/Yelp surface "₱₱" bands.
    // Single-package vendors collapse to one figure (min === max → "₱X").
    const pkgPesos = offerPackages.map((pkg) =>
      Math.round(pkg.total_price_centavos / 100),
    );
    const minPeso = Math.min(...pkgPesos);
    const maxPeso = Math.max(...pkgPesos);
    const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
    vendorJsonLd.priceRange =
      minPeso === maxPeso ? peso(minPeso) : `${peso(minPeso)}–${peso(maxPeso)}`;
  }

  // SEO/GEO Bucket 4 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — explicit
  // OfferCatalog wrapping the vendor's canonical_service entries. Mirrors
  // the lighter `knowsAbout` array (kept above for AI-engine entity
  // extraction) but uses Schema.org's marketplace-native structure:
  // OfferCatalog → Offer → Service, each linked back to the vendor as
  // provider. Lets Google + AI engines answer "does {vendor} do X?" with
  // structured precision instead of fuzzy string match.
  // AEO offer graph → Pro+ (seoPlan.offerGraph). The lighter `knowsAbout` array
  // above still carries the same service names at Solo, so a Solo vendor stays
  // matchable — Pro buys the OfferCatalog's structured precision, not the facts.
  if (seoPlan.offerGraph && Array.isArray(vendor.services) && vendor.services.length > 0) {
    vendorJsonLd.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      /* Hybrid-anonymity (V2.1 amendment #2): the OfferCatalog's
         own `name` field uses the display label so a hidden vendor
         doesn't leak its real business_name through the structured
         data tree. */
      name: `${displayLabel} services`,
      itemListElement: vendor.services.map((s: string, i: number) => ({
        '@type': 'Offer',
        position: i + 1,
        itemOffered: {
          '@type': 'Service',
          name: displayServiceLabel(s),
          provider: { '@id': `${SITE_URL}/${slug}#business` },
        },
      })),
    };
  }

  // SEO/GEO Bucket 4 — BreadcrumbList JSON-LD. 3-level trail
  // (Home → Wedding vendors → {vendor name}). Google surfaces breadcrumb
  // trails in SERP under the result title, lifting CTR. The 4th level
  // (category) is intentionally omitted — vendor.services[0] is the
  // closest proxy but adds parsing complexity and risks misrepresenting
  // multi-category vendors. 3 levels is the canonical breadcrumb depth
  // for marketplace listings (Yelp, Amazon, Etsy all ship 3-level for
  // seller pages).
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        // D2 (2026-09-11): was 'Wedding vendors' — event-neutral, matching
        // the app-wide "Setnayan vendor" term (vendorMetadataBySlug's own
        // page-title suffix) rather than assuming every shop is wedding-only.
        name: 'Suppliers',
        item: `${SITE_URL}/explore`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        /* Hybrid-anonymity (V2.1 amendment #2): breadcrumb leaf label
           uses the display label so SERP breadcrumbs surface the safe
           placeholder while the name is hidden. */
        name: displayLabel,
        item: `${SITE_URL}/${slug}`,
      },
    ],
  };

  // ── Wave 6 Quote-to-Booking Funnel · VIEWS stage capture ─────────────────
  // Fire-and-forget AFTER the response flushes (Next 15 after() · cron-free) so
  // it never blocks this render. Best-effort: a dropped view never errors the
  // page. The viewer is de-identified inside recordVendorProfileView (stored as
  // sha256(salt || id), never the raw id). Skip demo vendors — their views are
  // admin-only browsing, not real funnel signal. `source='profile_direct'`
  // marks a /v/[slug] view; the explore-card impression source is a separate
  // entry point (deferred — see PR notes). A team preview is not a couple's visit either — the
  // shop's own people opening a page nobody else can see must not count as one (lib/own-shop-preview.ts).
  if (!isDemoVendor && teamPreview === null) {
    const utmParam =
      search.utm ??
      (search.utm_source || search.utm_medium || search.utm_campaign
        ? [
            search.utm_source ? `utm_source=${search.utm_source}` : null,
            search.utm_medium ? `utm_medium=${search.utm_medium}` : null,
            search.utm_campaign ? `utm_campaign=${search.utm_campaign}` : null,
          ]
            .filter(Boolean)
            .join('&')
        : null);
    const viewSource = search.src ?? 'profile_direct';
    const viewVendorProfileId = vendor.vendor_profile_id;
    const viewEventId = coupleEventId;
    // ⚡ The cached copy counts its views in the browser (`ShopViewBeacon`, rendered below) — this render runs once
    // for many opens. Same action, same row; the campaign tags are read off the address there.
    if (!cachedCopy) {
      after(() =>
        recordVendorProfileView({
          vendorProfileId: viewVendorProfileId,
          source: viewSource,
          utm: utmParam,
          eventId: viewEventId,
        }),
      );
    }
  }
  const countViewInBrowser = cachedCopy && !isDemoVendor && teamPreview === null;

  // 🧺 THE UNVERIFIED SHOP'S "N MORE" (prototype `.more`): services on plan hold, counted — never drawn. A refused read
  // is `null` and the line is not drawn (never "0 more" from a failure). Unverified only.
  let heldServiceCount: number | null = null;
  if (!cinematicHero) {
    const { count, error: heldError } = await admin
      .from('vendor_services')
      .select('vendor_service_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .eq('plan_hold', 'held');
    if (heldError) {
      logQueryError('PublicVendorPage.heldServices', heldError, { slug }, 'graceful_degrade');
    } else {
      heldServiceCount = count ?? null;
    }
  }

  // 📅 "THEIR REAL CALENDAR" — the peek in the calling card. Verified + bookable only (owner 13 Nov "date check only for
  // verified"), from the one read behind /v/[slug]/dates, so the two can never disagree. Anything but `ok` draws no
  // days: a failed read never paints a closed day open.
  const checkDateHref = withShopArrival(`/v/${vendor.business_slug ?? slug}/dates`, shopArrival);
  let peekDays: PeekDay[] = [];
  if (cinematicHero && bookable) {
    const dates = await readCheckADate(vendor.business_slug ?? slug).catch(() => null);
    if (dates && dates.kind === 'ok') {
      peekDays = nextSaturdays(dates.today, { from: dates.from, to: dates.to }, dates.notBookable);
    }
  }

  // 🧭 The section bar's tabs — only sections that render. Verified: About · Services · Portfolio · Reviews.
  // Unverified: Services · Reviews · Where. NO Inquire tab (owner 13 Nov, "Yes, only one"): the bar carries the ONE
  // Inquire as its button instead, so it stays in reach on a phone (`inquire` prop below).
  // The service cards' inputs, ONCE: the Services section draws them and 📸 photos by service (owner 2026-11-14)
  // gathers the same cards by their service for the Portfolio's "Photos by service" row.
  const servicesProps: ServicesPricingProps = {
            /* 📈 Each grown-card open counts for "Which card sells" — never on a demo shop or the team's own preview
       (the same rule as the portfolio photo views above; the database also refuses the shop's own people). */
    countOpensFor: !isDemoVendor && teamPreview === null ? vendor.vendor_profile_id : null,
    services: activeServices,
    businessName: displayLabel,
    inclusionsByService: inclusionsByService,
    discountsByService: discountsByService,
    servesByService: servesByService,
    showcaseByService: showcaseByService,
    coverUrlByService: coverUrlByService,
    tileByCardKind: tileByCardKind,
    coarseSource: coarseSource,
    hidePrices: hidePricesPublicly,
    coupleEventDate: coupleEventDate,
    cardRecordByService: cardRecordByService,
    albumsByService: albumsByService,
    eventPhotosByService: eventPhotosByService,
    couplePhotosByService: couplePhotosByService,
    cardHides: cardHidesByService,
    viewerCuratesCards: viewerCuratesCards,
    ownerCheckFor: viewerCuratesCards ? vendor.vendor_profile_id : null,
    /* 👁 A signed-in viewer reads the NON-public couple photos they may see AFTER the page — never in this HTML. */
    viewerSignedIn: user !== null,
    /* Reuses the SAME trusted aggregate the hero stars read — the only
       source the anti-fraud lock permits for a public rating number —
       so the record block can never disagree with the top of the page,
       and costs no extra query. Vendor-level by nature: reviews carry
       no service dimension, which is why the badge says "shop rating". */
    cardRecordRating: cardRecordRatingFromTrusted(trustedReviewStats),
    /* The details sheet (flag-dark). OFF ⇒ every card renders as the
       static div it does today and no sheet is mounted. */
    detailsEnabled: detailsEnabled,
    /* Whether the sheet's "Choose this service" can reach the Inquire
       pop-up — decided here because only the server knows. */
    inquireMode: canMessage ? 'anchor' : 'none',
    openServicePublicId: openServicePublicId,
    inspirationByService: inspirationByService,
    reviewsByService: reviewsByService,

  };
  const photoServiceViews = activeServices.length > 0 ? servicesFromCards(buildServiceGroups(servicesProps).flatMap((g) => g.cards)) : [];
  const hasPhotosByService = showPortfolio && photoServiceViews.some((v) => v.photos > 0);
  const hasPortfolioSection =
    (showPortfolio && (portfolioUrls.length > 0 || featuredVideos.length > 0 || igMedia.length > 0)) ||
    (showEditorials && (featuredEditorials.length > 0 || featuredChapterCredits.length > 0)) ||
    inspirationTiles.length > 0 ||
    hasPhotosByService;
  const shopSectionTabs: ShopSectionTab[] = cinematicHero
    ? [
        { id: 'shop-about', label: 'About' },
        { id: 'shop-services', label: 'Services' },
        ...(hasPortfolioSection ? [{ id: 'shop-portfolio', label: 'Portfolio' }] : []),
        { id: 'shop-reviews', label: 'Reviews' },
      ]
    : [
        { id: 'shop-services', label: 'Services' },
        { id: 'shop-reviews', label: 'Reviews' },
        { id: 'shop-where', label: 'Where' },
      ];

  // 🏅 THE BADGE ROW, drawn ONCE in source and placed by the look: on the hero photo for a verified shop (the seal
  // stamps down, the circles pop — prototype motion 3), in the calm header for an unverified one. Same circles, same
  // gates, same `title`s as before — only where it sits changed (owner-approved 13 Nov 2026).
  const shopBadgesRow = (
      <div data-shop-hero-badges="" className="flex flex-wrap items-center gap-2">
      {vendor.verification_state === 'verified' ? (
        <>
          {/* ✍ `drawn`: its ring and ✓ are strokes the verified look's CSS draws after the stamp (motion 3). */}
          <HeroBadge
            badge={verifiedBadge()}
            title="Setnayan reviewed this shop’s business documents before it went public."
            drawn
          />
          <SealCaption />
        </>
      ) : null}
      {/* 🏅 THE PERFORMANCE BADGES (circles since 12 Nov; pills from 2026-10-28) — the milestone medal from the SAME
          public completed-events count the experience chip states (`finalizedBookingCount`, measured only),
          in its step's material, and this month's Spotlight Awards. `lib/shop-badges.ts` decides; nothing is stored, so a voided
          booking un-earns the medal on the next render. The QR on a supplier's card/tarp lands here, so a
          scan always shows today's badges. */}
      {performancePills.map((b) => (
        <HeroBadge key={b.key} badge={b} title={b.label} />
      ))}
      {/* Experience tier badge (Vendor_Quality_Rating_System §5) — a
          subtle violet chip stating how many finalized bookings flowed
          through Setnayan. The profile keeps the honest "New to Setnayan"
          tier (unlike the dense explore card, which suppresses it). Same
          violet tokens as the explore card's experience chip so the badge
          reads identically across surfaces. */}
      {/* Suppressed when the count was not measured — the same thing the
          dense explore card already does with this chip, so there is
          precedent for its absence and none for guessing. "New to
          Setnayan" is honest for a vendor who IS new and defamatory for
          one who is not, and the two were indistinguishable. */}
      {bookingCountMeasured ? (
        <p
          className="inline-flex w-fit items-center gap-1 rounded-full border border-violet-300/50 bg-violet-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-900"
          title={
            finalizedBookingCount && finalizedBookingCount > 0
              ? `${formatCount(finalizedBookingCount)} finalized event${finalizedBookingCount === 1 ? '' : 's'} through Setnayan.`
              : 'New to Setnayan — many excellent suppliers are.'
          }
        >
          {expTier.longLabel}
        </p>
      ) : null}
      {/* Rating trust chip (2026-07-02 vendor-website redesign) — surfaces
          the star average + review count up in the hero beside the
          experience badge, so the two headline trust signals cluster at the
          top (per the approved profile mockup; rating previously lived only
          in the Reviews section far below). Respects the Free-tier star gate
          (viewerTierCaps.reviewStarsCounted) and hides when there are no
          reviews yet — an honest empty state, never a fake 0.0. */}
      {/* ANTI-FRAUD (2026-07-05): headline stars + count read the TRUSTED
          (receipt-backed, arm's-length) stat, not the raw review totals. */}
      {viewerTierCaps.reviewStarsCounted &&
      trustedReviewStats.trusted_review_count > 0 &&
      trustedReviewStats.trusted_avg_rating > 0 ? (
        <HeroBadge
          badge={ratingPill!}
          title={`${formatStarRating(trustedReviewStats.trusted_avg_rating)} average from ${formatCount(trustedReviewStats.trusted_review_count)} review${trustedReviewStats.trusted_review_count === 1 ? '' : 's'} by couples who booked via Setnayan.`}
        />
      ) : null}
      {/* Favorites chip (owner 2026-07-02: favorites public / viewers
          vendor-only) — distinct couples who follow or saved this vendor,
          min-N floored (FAVORITES_MIN_DISPLAY) so a tiny count never shows.
          Hidden below the floor — honest empty state (founder-only market
          → usually hidden until saves accrue). */}
      {favoritesCount >= FAVORITES_MIN_DISPLAY ? (
        <p
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-0.5 text-[11px] text-ink/70"
          title={`Saved by ${formatCount(favoritesCount)} couples on Setnayan.`}
        >
          <Heart aria-hidden className="h-3.5 w-3.5 fill-mulberry/70 text-mulberry" strokeWidth={1.75} />
          <span className="font-medium text-ink">{formatCount(favoritesCount)}</span>
          <span>saved</span>
        </p>
      ) : null}
      </div>
  );

  return (
    <main
      id="shop-top"
      className={`min-h-dvh bg-page ${canMessage ? 'pb-24 md:pb-0' : ''} ${cinematicHero ? shopMotion.verified : ''}`}
    >
      {countViewInBrowser ? <ShopViewBeacon vendorProfileId={vendor.vendor_profile_id} /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vendorJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <header className="border-b border-ink/5">
        <div className={`mx-auto flex w-full ${SHOP_ARTICLE_WIDTH} items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8`}>
          {/* v2.1 visual treatment per CLAUDE-CODE-BRIEF-v2.1 § 8 design
              system. Wordmark from @/app/_components/brand-marks is the
              canonical brand mark across /, /vendors, /login, /signup,
              /vendors, and all dashboard chromes after V2 cutover Phase B
              (PRs #560-#564 + #572-#580). Matches the marketplace overlay
              pattern from PR #580. */}
          <div className="flex items-center gap-3">
            {/* ‹ ONE WAY BACK, AT THE TOP LEFT, FOR EVERYONE (2026-11-12, DECISION_LOG "DISCOVER WITH SUPPLIERS —
                PROTOTYPE APPROVED"; owner: "when we enter a shop, event or anything, we should be able to go back to
                home"). The shipped BackButton, returning in place; the page itself is not redrawn. */}
            <BackButton href={shopTop.href} label={shopTop.label} className="mb-0" inPlace />
            <Link href="/" className="flex items-center text-ink">
              <Wordmark size={22} />
            </Link>
          </div>
          {/* 🚫 "PLAN WITH SETNAYAN" IS RETIRED ON SHOP PAGES (owner 2026-11-07). It sent a person who came to ask THIS
              shop to /signup, away from the shop. Inquire is the one ask; signed out, it opens the sign-in sheet first. */}
          {user ? (
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Return to Dashboard
            </Link>
          ) : null}
        </div>
      </header>
      {teamPreview ? <TeamPreviewBanner reason={teamPreview} /> : null}
      {/* 🌄 THE VERIFIED SHOP'S HERO — full-bleed, the name on the photo, the seal and badge circles on it; no buttons on
          the photo (the calling card below carries Inquire). Every verified plan alike (owner-approved 13 Nov 2026). */}
      {cinematicHero ? (
        <ShopHero
          name={displayLabel}
          kicker={heroKicker}
          tagline={vendor.tagline ?? null}
          photoUrl={heroImage ?? VENDOR_PLACEHOLDER_PHOTO}
          photoIsMarked={heroImage !== null}
          badges={shopBadgesRow}
        />
      ) : null}

      <article
        className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${cinematicHero ? 'pb-12 sm:pb-16' : `py-8 sm:py-12 ${shopMotion.calm}`} ${
          /* 🖥 EVERY PLAN MAXIMIZES THE SCREEN (supplier website by plan, owner-approved 2026-10-30; owner
             2026-10-29 "always maximize the screen"). Was: Pro+ only (2026-07-03), Free/Solo at max-w-3xl. */
          SHOP_ARTICLE_WIDTH
        }`}
        /* Pro accent (My Shop → Website) retints the accent ramp for THIS
           vendor's content only — scoped to the article so the Setnayan header
           chrome above keeps the site accent. undefined = default champagne. */
        style={accentVars as React.CSSProperties | undefined}
      >
        {/* Admin-in-demo-mode only (the cookie now only forces a demo shop's prices public). Every OTHER viewer of a
            demo shop sees the "(DEMO ONLY)" marker beside its name instead — below, in the name block. */}
        {isDemoVendor && inDemoMode && teamPreview === null ? <DemoVendorBanner /> : null}
        {/* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30): pass the
            resolved display label so the ComingSoon banner copy + Logo
            initial fallback + alt text all surface the safe placeholder
            while the vendor's name is hidden. */}
        {isComingSoon ? <ComingSoonBanner vendorName={displayLabel} /> : null}
        {/* 🔎 DECISION_LOG 2026-11-07 ruling (4): a couple opening a shop Setnayan has not verified yet is told so, in-app —
            since 13 Nov a soft card at the top of the calm column (prototype `.notice`), its ⓘ carrying the words. */}
        {teamPreview === null && !isDemoVendor && vendor.verification_state !== 'verified' ? (
          <div className={SHOP_CALM_COLUMN_CLASS}>
            <NotYetVerifiedNotice />
          </div>
        ) : null}
        {/* 🃏 THE CARD COLUMN BESIDE THE PAGE — every plan, tablet and up (supplier website by plan, owner-approved
            2026-10-30; the "universal" calling card 2026-09-10 §C). The shop's card (name, badges, facts, actions,
            map, addresses) is a sticky column — 300 px on a tablet, 360 px on a computer — and everything else reads
            beside it, full width. It replaces the Pro-only sticky Inquire rail: every fact and button that rail
            repeated (rating, Inquire, Share, city, events, years) is in the card itself, so on every plan the card
            stays on screen as the page scrolls. A phone keeps the one column. */}
        {/* 🎴 Verified: the calling card overlaps the hero and stays pinned beside the body on a computer. Unverified: one
            calm column, the profile-like sibling (owner 13 Nov: "a free unverified looks like a user profile page"). */}
        <div
          data-shop-columns=""
          className={cinematicHero ? SHOP_COLUMNS_CLASS : SHOP_CALM_COLUMN_CLASS}
        >
          <div
            data-shop-card-column=""
            className={cinematicHero ? `${SHOP_CARD_COLUMN_CLASS} ${SHOP_CALLING_CARD_CLASS} ${shopMotion.card}` : 'min-w-0'}
          >
        <section className={SHOP_CARD_SECTION_CLASS}>
          <Logo logoUrl={logoDisplayUrl} name={displayLabel} frame={readLogoFrame(vendor)} />
          <div className="min-w-0 space-y-2">
            {/* v2.1 visual treatment per CLAUDE-CODE-BRIEF-v2.1 § 8 design
                system + /tmp/setnayan-keynote-template/components/vendor-
                microsite.jsx hero typography. Italic-serif headline matches
                the homepage + /vendors + /vendors marketplace headline
                rhythm (PR #580 lineage). Cream + ink + terracotta tokens
                unchanged. Business name stays the visual anchor — v2.1
                publisher posture means real vendor names are always visible
                (CLAUDE.md 2026-05-28 tenth row § 1 explicitly retires the
                Path B lead-broker anonymization from CLAUDE.md seventh row).

                V2.1 brief amendment #2 (CLAUDE.md 2026-05-30 row
                "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d)) re-introduces
                a hybrid mechanic for Free + Verified vendors ONLY:
                business_name is hidden until the vendor sends their
                first chat reply (DB trigger reveal_vendor_name_on_chat
                stamps `name_revealed_at` on first reply · PR #662 /
                migration 20260530010000). The render below now
                consumes `displayLabel` from the page-level
                resolveVendorDisplayName call so the hero surfaces the
                taxonomy + city placeholder during the hidden window
                and the real business_name once revealed. */}
            {/* Name + tagline live on the cinematic hero for Enterprise — avoid
                duplicating them here in that case. */}
            {/* On the verified look the <h1> is on the hero photo; the card names the shop again quietly, as a label. */}
            {cinematicHero ? <p className="text-[1.02rem] font-semibold leading-snug text-ink">{displayLabel}</p> : null}
            {cinematicHero ? null : (
              <>
                <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl md:text-4xl lg:text-5xl">
                  {displayLabel}
                </h1>
                {vendor.tagline ? (
                  <p className="text-base text-ink/70">{vendor.tagline}</p>
                ) : null}
              </>
            )}
            {/* 🧪 (DEMO ONLY) — owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS": a demo shop shows with the
                rest *"but has a marking of (DEMO ONLY)"*. The one marker (app/_components/sample-marker.tsx). Outside the
                cinematic branch, so a flagship's page says it too. */}
            {isDemoVendor ? <DemoOnlyMarker /> : null}
            {/* "✓ Verified" — Fable E1 (FABLE_Public_Marketplace_Spec § 3.5).
                Gated on the SAME column this route's own 404-gate uses at :769 —
                `verification_state` — and deliberately NOT on `public_visibility`.
                Those are two different facts (migration 20271013500000 exists
                because an RLS policy conflated them), and app/explore/compare/
                page.tsx keys its own ✓ Verified pill on the visibility one; do
                not "make them consistent" — that changes a second surface's
                meaning.

                Honest by construction: every shop a stranger can reach is
                already `verification_state = 'verified'` (the :769 gate 404s
                every other state), so this asserts only what the gate already
                guarantees. On the two renders that survive that gate — an admin
                in demo mode, and a vendor previewing their own shop before
                approval — an unverified row shows NO chip and no counter-claim.

                FAILED READ vs GENUINE "not verified": a failed read cannot
                produce this chip. If the full select errors, fetchVendor falls
                back to `legacySelect`, which omits the column ⇒ the field is
                undefined ⇒ the strict `=== 'verified'` is false AND the :769
                gate 404s the page. Failure is a 404; "not verified" is a page
                with no chip. The two are visibly different, and neither states
                an unmeasured fact.

                The `title` is load-bearing. This page already renders three
                narrower "verified" claims below (the DTI-years BadgeCheck, and
                the reviews block's Verified wedding / Verified booking pills);
                a bare word here would be read as covering prices, reviews and
                availability too. Say what admin review actually does — document
                review — and nothing more. Never "Verified by Setnayan". */}
            {/* 🏅 THE HERO BADGES SIT IN ONE ROW, DRAWN AS THE CIRCULAR IMAGE BADGES (owner, 12 Nov 2026: *"Circles +
                spacing"*, on a screenshot where the long pills touched the (DEMO ONLY) ⓘ and each other). The same
                drawing as Discover's shop card (`badgeImageOf` → `ImageBadge`, #7493). The row's gap is what keeps them
                apart — before, they were inline in a block, so React's collapsed whitespace left 0 px between them. */}
            {cinematicHero ? null : shopBadgesRow}
            {/*
              🗓 THE "SINCE" FACT LINE (supplier website by plan, owner-approved 2026-10-30) — "In business since 2019 ✓ ·
              120+ events › · On Setnayan since Oct 2026". Replaces the "N yrs in business · N+ weddings" pill and the
              "On the marketplace since" line that sat here; every fact they carried is still on it (✓ DTI-verified, or the
              year alone; the declared count inside the events sheet). The two tenures stay told apart by their
              words — "In business since" is the credential, "On Setnayan since" is only how long they have been here —
              and the joined-here half is NEVER hidden to flatter a new shop: its absence would be a tell.
            */}
            <ShopSinceLine
              sinceYear={declaredExp?.sinceYear ?? null}
              sinceVerified={declaredExp?.verified ?? false}
              events={shopEventsByKind}
              onSetnayanSince={onSetnayanSince}
              shopName={displayLabel}
            />
            {/* "Featured in N stories →" — Fable E2 (spec § 3.5). A POINTER to
                the "Featured in these stories" section further down that ALREADY
                SHIPS; it builds nothing new. The gate below is byte-identical to
                that section's own gate, so the chip can never be a fake door —
                and `showEditorials` is the first term on purpose, because a
                vendor on a personalisable tier can hide that section from their
                own page editor.

                FAILED READ vs GENUINE ZERO: both loaders swallow their errors to
                `[]` (the editorial try/catch above; loadFeaturedChaptersCrediting-
                Vendor's `if (error) return []`), so at the data layer a failure
                and a true zero are the same value. The mitigation is structural:
                the count is derived from the SAME two arrays the section maps
                over, so on a failed read the chip AND the section disappear
                together and the page states nothing it did not measure. A
                separate count query for the chip is therefore FORBIDDEN — it
                would be the one number able to say "Featured in 3 stories" over
                a section that renders nothing.

                The count is exact, not approximate: both arrays are already
                truncated before this point (editorials .slice(0, 3); chapters
                .slice(0, 6) inside the loader), so the number equals the tiles
                the reader will actually find at the anchor. */}
            {showEditorials &&
            (featuredEditorials.length > 0 || featuredChapterCredits.length > 0) ? (
              <a
                href="#featured-stories"
                className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1 text-[11px] font-medium text-link hover:underline"
              >
                Featured in {formatCount(featuredEditorials.length + featuredChapterCredits.length)}{' '}
                {featuredEditorials.length + featuredChapterCredits.length === 1
                  ? 'story'
                  : 'stories'}
                <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </a>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              {/* 📍 The city line carries the plan's reach (2026-10-23 · 2026-10-29): "Serves up to 20 km around
                  Tagaytay", or "… · distance search opens once verified" before Setnayan has verified the shop. */}
              {/* The calm (unverified) page says its reach under Where, beside its pin. */}
              {cinematicHero ? <ShopReachLine reach={reach} city={vendor.location_city ?? null} /> : null}
              {/*
                🚪 NO DOOR OUT OF THE APP (owner 2026-09-10, verbatim: "our goal is
                to let them integrate their event with the vendor they find. not
                to let them communicate outside the app").

                This row used to print the shop's email as a `mailto:` and its
                phone as a `tel:` — to ANYONE, signed out included — one scroll
                above an Inquire section saying the reply comes in the Setnayan
                inbox. A couple who found a shop here and emailed it booked
                off-platform: no booking fee, no in-app record, no lock, no price
                freeze, no protection for either side.

                What stands in their place says HOW you reach this shop — here —
                so the row never reads as two items that silently went missing.
                It is deliberately a STATEMENT, not a second link: the way in is
                the Inquire button a few centimetres below (or the hero's, or the
                desktop rail's), and a second control to the same anchor that close
                is the duplicate the owner already ruled out on 2026-08-06
                (`one-inquire-button.test.ts`).
                `lib/no-door-out-of-the-app.test.ts` fails if a contact scheme or
                a contact field comes back to any couple-facing or public surface.
              */}
              {canMessage ? (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Replies in your Setnayan inbox
                </span>
              ) : null}
              {/* Owner ruling 2026-09-11 (DECISION_LOG "SEVEN SUPPLIER-SIDE
                  QUESTIONS" Q3): "Never show links" — no tappable website or
                  social link on the shop page, before or after booking. The
                  shop's own `website` value stays SAVED (never deleted, still
                  readable in My Shop) — this page just never renders it as a
                  door out. `lib/no-door-out-of-the-app.test.ts` fails if a
                  website href reaches any couple-facing or public surface. */}
            </div>
            {/* 🏬 "Also in Lipa · Batangas City" — the shop's other paid, live branches, under the reach line (owner
                2026-11-13, "Show the branches as needed"). Nothing at all when it has none. */}
            <ShopBranchesLine
              cities={publicBranches.map((b) => b.branchCity)}
              hqCity={vendor.location_city ?? null}
            />
            {/* The shop previewing itself learns WHY its email and phone are not
                here, instead of reading their absence as a broken page. Only the
                owning account ever renders this line; the values stay in My Shop
                (and this page no longer fetches them at all). */}
            {viewerOwnsShop ? (
              <p className="max-w-2xl text-xs text-ink/60">
                Only you see this note: your email and phone are not shown to couples.
                They message you here on Setnayan, and every reply, quote and booking
                stays with their event.
              </p>
            ) : null}
            {/* Primary actions (2026-07-02): Inquire (scrolls to the
                composer) + Share. Retires the old Follow / Save-to-picks row.
                On desktop the sticky Inquire rail carries these too.

                🔑 The cinematic hero ALREADY carries its own Inquire, so this
                one is dropped when that hero renders — otherwise an Enterprise
                shop with a hero photo showed TWO identical Inquire buttons a
                few centimetres apart (owner spotted it 2026-08-06). The block
                just above suppresses only the name + tagline for the same
                reason, and the button was missed. Share is NOT dropped: the
                hero has no Share, so removing the whole row would leave an
                Enterprise shop with no way to share it at all. */}
            {/* 📅 THEIR REAL CALENDAR — the open-dates peek. Verified + bookable only (owner 13 Nov "date check only for
                verified"); nothing at all when the dates could not be read. */}
            {cinematicHero && bookable ? <OpenDatesPeek days={peekDays} checkHref={checkDateHref} /> : null}
            {canMessage ? (
              <div
                className="flex flex-wrap items-center gap-2 pt-4"
              >
                {/* ✅ THE ONE INQUIRE (owner 2026-11-13: "Yes, one main button" · "Yes, only one"): filled, in the card, on
                    every look — and the ONLY Inquire on the page (no tab, no foot section, no hero button). It opens the
                    pop-up. On a phone the card scrolls away, so this same button floats at the bottom-right to stay in
                    reach (one element, never a second copy); on a tablet+ the card itself is pinned beside the page. */}
                <a href="#get-in-touch" className={SHOP_MAIN_INQUIRE_CLASS} data-shop-main-inquire="">
                  <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Inquire
                </a>
                {/* ➕ ADD TO YOUR EVENT — beside it, quieter: puts the shop on the couple's event list, no message. The
                    shipped Save action (`saveVendorToPicks`), which asks which event when there are two or more ahead. */}
                <SaveVendorButton
                  vendorProfileId={vendor.vendor_profile_id}
                  initiallySaved={false}
                  variant="profile"
                  label="Add to your event"
                  className="button-secondary inline-flex items-center gap-2"
                  events={
                    inquireEventState?.signedIn && inquireEventState.options.length >= 2
                      ? inquireEventState.options.map(({ eventId, title, kindWord, dateISO }) => ({ eventId, title, kindWord, dateISO }))
                      : []
                  }
                />
                {/* ORDER (prototype public_pages_three_2026-11-13, owner 13 Nov): Inquire (filled) · Add to your event,
                    then Check a date · Share. */}
                {/* 📅 CHECK A DATE beside Inquire · Share (supplier website by plan, owner-approved 2026-10-30) — the
                    approved public landing `/v/[slug]/dates` (DECISION_LOG 2026-10-28 "CHECK A DATE — APPROVED"):
                    Available · Not bookable, nothing about other couples' asks. A BOOKING door, so it keeps `bookable`
                    (verified only) while the row itself opens on `canMessage` — an unverified shop takes messages,
                    never a date check or a booking (DECISION_LOG 2026-11-07). */}
                {bookable ? (
                  <CheckADateLink
                    href={withShopArrival(`/v/${vendor.business_slug ?? slug}/dates`, shopArrival)}
                    className="button-secondary inline-flex items-center gap-2"
                  />
                ) : null}
                <ShareButton title={displayLabel} className="button-secondary inline-flex items-center gap-2" />
                {bookable && canShowBooth ? (
                  <Link
                    href={withShopArrival(`/v/${vendor.business_slug ?? slug}/booth`, shopArrival)}
                    className="button-secondary inline-flex items-center gap-2"
                  >
                    Walk into my booth
                  </Link>
                ) : null}
              </div>
            ) : null}
            {/* Visual map (2026-06-28). The picture-of-the-map above the
                Directions dropdown — OSM embed with a marker pin, key-free.
                Renders only when coordinates exist; label uses location_city
                so a hidden vendor's business name never leaks. */}
            {cinematicHero ? (
              <ShopReachMap
                reach={reach}
                latitude={vendor.hq_latitude}
                longitude={vendor.hq_longitude}
                city={vendor.location_city ?? null}
              />
            ) : null}
            {/* Nav deep-links (2026-05-21). Google Maps · Waze · Apple Maps
                when the vendor has hq_lat/lng — ONE "Directions ▾" dropdown
                since 2026-10-22, the Event Hub's own `DirectionsMenu` (three
                chips before; "any set of choices is a dropdown"). Falls back
                to a single Google Maps text-search when only the address is
                set. Hidden entirely when neither exists. */}
            {cinematicHero ? (
              <DirectionsMenu
                latitude={vendor.hq_latitude}
                longitude={vendor.hq_longitude}
                query={vendor.hq_address ?? vendor.location_city ?? null}
              />
            ) : null}
            {/* Other locations (2026-08-29). The shop's paid, live branches —
                name and city only. The map above stays the headquarters pin:
                one pin is what this embed draws, and a second address without
                a second pin is clearer than a pin that moves. Nothing here is
                added to the JSON-LD or the sitemap: those are claims Google
                republishes, and a branch that lapses would leave one standing
                after it stopped being true. */}
            {publicBranches.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  Also here
                </p>
                <ul className="space-y-1 text-sm text-ink/70">
                  {publicBranches.map((b) => (
                    <li key={b.branchId} className="flex items-start gap-1.5">
                      <MapPin
                        aria-hidden
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                      />
                      <span>
                        <span className="text-ink">{b.branchLabel}</span>
                        {b.branchCity ? (
                          <span className="text-ink/60"> · {b.branchCity}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {/* 🌐 The page's addresses — Setnayan's on every plan; Solo, Pro + Ultra also their own domain → this page. */}
            {/* 🌐 The web address is the verified look's (owner 13 Nov): the unverified page prints none — its
                setnayan.com/<slug> would give away the name the page is still hiding. */}
            {cinematicHero ? <ShopAddresses setnayanAddress={setnayanAddress} ownAddress={ownAddress} /> : null}
            {/* ⭐ Pro + Ultra — the pinned best review's first words, beside the facts. */}
            {pinnedLead && pinnedLeadQuote ? (
              <PinnedReviewCard
                quote={pinnedLeadQuote}
                stars={viewerTierCaps.reviewStarsCounted ? pinnedLead.rating_overall : null}
                author={pinnedLead.couple_display_name?.trim() || 'Verified couple'}
                when={new Date(pinnedLead.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
              />
            ) : null}
          </div>
        </section>
          </div>
          <div data-shop-body-column="" className="min-w-0">
        {/* 🧭 THE SECTION BAR (owner 2026-11-13, "simpler to view around the website") — sticky, one tap per section,
            the current one underlined, ↑ Top at its right edge. The tabs are the sections that render (shopSectionTabs). */}
        <ShopSectionBar tabs={shopSectionTabs} motionRootId={cinematicHero ? 'shop-top' : undefined} />
        {/* ── ABOUT: their words, what their own website can't do, the details, trusted by. */}
        <div id="shop-about" data-shop-section="" className="scroll-mt-14">
        {/* About — the vendor's own intro (My Shop → Website editor). Optional
            override; hidden when unset so the page keeps its auto-composed
            baseline. Solo+ only — reverts to baseline on downgrade (data kept). */}
        {canPersonalizePage && microsite.about ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              About
            </h2>
            <p
              className={
                cinematicHero
                  ? 'max-w-3xl whitespace-pre-line font-serif text-[1.75rem] italic leading-[1.18] tracking-[-0.005em] text-ink lg:text-[2.3rem]'
                  : 'max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink/75'
              }
            >
              {microsite.about}
            </p>
          </section>
        ) : null}

        {cinematicHero && bookable ? (
          <ShopCanDoPanel
            checkHref={checkDateHref}
            hasPackages={vendorPackages.length > 0}
          />
        ) : null}

        {/*
          SONGS THEY PLAY — the band's set list, and a link to them playing it.

          Owner 2026-08-18: *"we have a song bank of all music. bands/musicians
          can pick the song they can do. and they can link videos of them
          performing that song via youtube link."*

          🔑 THIS IS THE FIRST PUBLIC READER OF A BAND'S REPERTOIRE. It existed
          only to match requests on the day, so the one thing a couple comparing
          bands most wants — what can you actually play? — was invisible to them.

          Rendered only when the band has songs: an empty section would tell a
          couple this band plays nothing, which is a claim we cannot make about a
          list the band simply has not filled in yet.
        */}
        {repertoire.length > 0 && isMusicToolCategory(vendor.services) ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Songs they play
            </h2>
            <p className="max-w-2xl text-sm text-ink/60">
              {repertoire.length} {repertoire.length === 1 ? 'song' : 'songs'} in their set
              list. They can usually learn a request too — ask.
            </p>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {repertoire.map((song) => (
                <li key={song.song_id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-sm text-ink/85">{song.title}</span>
                    {song.artist ? (
                      <span className="text-sm text-ink/45"> · {song.artist}</span>
                    ) : null}
                  </span>
                  {song.performance_url ? (
                    <a
                      href={song.performance_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-link underline underline-offset-2"
                    >
                      Watch them play it
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {vendor.services.length > 0 ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Services offered
            </h2>
            <ul className="flex flex-wrap gap-2">
              {orderedServices.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-terracotta/10 px-3 py-1 text-sm text-terracotta-700"
                >
                  {displayServiceLabel(s)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {attributeDetails.length > 0 ? (
          <section className="space-y-6 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Details
            </h2>
            <div className="space-y-6">
              {attributeDetails.map((group) => (
                <div key={group.canonicalService} className="space-y-3">
                  <h3 className="text-sm font-medium text-ink">{group.displayName}</h3>
                  {group.flags.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {group.flags.map((flag) => (
                        <li
                          key={flag}
                          className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/70"
                        >
                          {flag}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {group.facts.length > 0 ? (
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                      {group.facts.map((fact) => (
                        <div key={fact.label} className="flex flex-col">
                          <dt className="text-xs uppercase tracking-wide text-ink/45">
                            {fact.label}
                          </dt>
                          <dd className="text-sm text-ink/80">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {(vendor.compatible_ceremony_types && vendor.compatible_ceremony_types.length > 0) ||
        (vendor.compatible_venue_settings && vendor.compatible_venue_settings.length > 0) ? (
          <section className="space-y-4 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              {/* D2 (2026-09-11): event-neutral — this shop page is not only
                  for weddings, and a debut/christening host reading "Wedding
                  compatibility" over a real answer about their own event is a
                  small but real instance of the same lie row 3838 rules out. */}
              Event compatibility
            </h2>
            {vendor.compatible_ceremony_types && vendor.compatible_ceremony_types.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                  Ceremonies
                </p>
                <ul className="flex flex-wrap gap-2">
                  {vendor.compatible_ceremony_types.map((ct) => (
                    <li
                      key={ct}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75"
                    >
                      {CEREMONY_TYPE_LABELS[ct] ?? ct}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vendor.compatible_venue_settings && vendor.compatible_venue_settings.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                  Venues
                </p>
                <ul className="flex flex-wrap gap-2">
                  {vendor.compatible_venue_settings.map((v) => (
                    <li
                      key={v}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75"
                    >
                      {VENUE_SETTING_LABELS[v] ?? v.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {showTrustedBy ? (
          <TrustedBySection
            vendors={trustedBy}
            businessName={displayLabel}
            unreadable={trustedByUnreadable}
          />
        ) : null}
        </div>

        {/* ── SERVICES: the cards, the typical price, the packages (Lock lives on each package card, nowhere else). */}
        <div id="shop-services" data-shop-section="" className="scroll-mt-14">
        {activeServices.length > 0 ? (
          /* Hybrid-anonymity (V2.1 amendment #2): pass displayLabel so
             the services section's section heading + per-service
             cards' "by {vendor}" copy don't leak the hidden name. */
          <ServicesPricingSection {...servicesProps} />
        ) : null}

        {/* 🧺 THE ONE LIVE CARD, THEN WHAT WAITS (prototype `.more`). The count is a READ — services on plan hold
            (`vendor_services.plan_hold = 'held'`, lib/service-plan-hold.ts) — never a number drawn here; a refused read
            says nothing at all rather than "0 more". Unverified only: a verified shop's cards are its plan's. */}
        {!cinematicHero && heldServiceCount !== null && heldServiceCount > 0 ? (
          <p
            data-shop-held-services=""
            className="mb-8 flex items-center gap-2.5 rounded-3xl border border-dashed border-ink/15 px-4 py-3.5 text-sm text-ink/75"
          >
            <Store aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
            <span>
              <b className="font-semibold text-ink">
                {formatCount(activeServices.length)} {activeServices.length === 1 ? 'service is' : 'services are'} live
              </b>{' '}
              while Setnayan checks this shop. {formatCount(heldServiceCount)} more{' '}
              {heldServiceCount === 1 ? 'is' : 'are'} on hold for now.
            </span>
          </p>
        ) : null}

        {/* Verified "typical price" (dark) — the vendor's OWN median of their
            locked-booking prices, shown as a self-referential guide. Renders
            only when the flag is on, the median is established (≥ min sample),
            and the vendor isn't hiding prices. No cross-vendor comparison. */}
        {verifiedTypicalPrice?.result.status === 'established' &&
        verifiedTypicalPrice.typicalPricePhp != null ? (
          <VerifiedPriceCard
            typicalPricePhp={verifiedTypicalPrice.typicalPricePhp}
            sampleN={verifiedTypicalPrice.result.sampleN}
          />
        ) : null}

        {/* Vendor packages (owner directive 2026-05-22) — bundled multi-
            category offerings. Hotels sell their "wedding package" SKU
            here; locking one cascade-locks every included planning-card
            category. Public read; the LockPackageModal CTA only renders
            for signed-in hosts with an active event. */}
        {vendorPackages.length > 0 ? (
          <VendorPackagesSection
            packages={vendorPackages}
            coupleEventId={coupleEventId}
            /* 🔒 An unverified shop's page is public now (DECISION_LOG 2026-11-07), so "not bookable" is what keeps
               the Lock button off it — the same quiet "Not yet bookable" line, never a Lock that the
               `event_vendors_require_verified_before_lock` trigger would refuse a step later. */
            isComingSoon={isComingSoon || !bookable}
            bookingsOpen={bookingsOpen}
            hidePrices={hidePricesPublicly}
            paxCount={packageLivePax}
            /* Flag-dark secondary action: send the configured build to the
               vendor as a question instead of locking it. Empty ⇒ the modal is
               byte-identical to today. */
            askTargets={packageAskTargets}
            shopName={displayLabel}
          />
        ) : null}
        </div>

        {/* ── PORTFOLIO: the photos and films, the stories that credit them, the looks. */}
        <div id="shop-portfolio" data-shop-section="" className="scroll-mt-14">
        {/* Portfolio — ONE unified gallery of the vendor's photos + their own
            pasted video links (all tiers). Photos lead, then videos: YouTube &
            Vimeo mount as responsive inline 16:9 players. Instagram / Facebook /
            TikTok / other pasted links are dropped upstream (`featuredVideos`
            is pre-filtered to `kind === 'iframe'`) — owner ruling 2026-09-11 Q3:
            "Never show links", so no click-through card to an outside platform
            renders here, embedded or not. Unparseable video entries are also
            dropped upstream. Governed by the vendor's Portfolio visibility
            toggle; auto-hidden when there's nothing to show. */}
        {(showPortfolio &&
        (portfolioUrls.length > 0 ||
          featuredVideos.length > 0 ||
          igMedia.length > 0)) || hasPhotosByService ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Portfolio
            </h2>
            {/* 📸 Ⓑ PHOTOS BY SERVICE (owner 2026-11-14, prototype "The way in"): one tile per service with a photo, each
                opening that service's photos from every card — the same photos, by reference. */}
            {hasPhotosByService ? (
              <PhotosByServiceRow views={photoServiceViews} ownerShopId={viewerCuratesCards ? vendor.vendor_profile_id : null} />
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {/* 👁 Each photo opens full size on a tap, and that open is ONE view of that photo (Lane E item 11) — the
                  shop's own people and admins never count (the RPC refuses them; a team preview counts nothing). */}
              <PortfolioPhotoTiles
                vendorProfileId={vendor.vendor_profile_id}
                photos={portfolioPhotos}
                label={displayLabel}
                count={!isDemoVendor && teamPreview === null}
              />
              {featuredVideos.map((v, idx) =>
                v.embedUrl ? (
                  // Inline player spans two grid columns so its 16:9 frame reads
                  // as the signature "watch this" moment amid the photo tiles.
                  // `featuredVideos` is pre-filtered to `kind === 'iframe'`, so
                  // every entry reaching this map plays in-page — never a link
                  // out (owner ruling 2026-09-11 Q3).
                  <figure key={`${v.originalUrl}-${idx}`} className="col-span-2 space-y-1.5" data-featured-video="">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-ink/5">
                      <iframe
                        src={v.embedUrl}
                        title={v.title ? `${displayLabel} — ${v.title}` : `${displayLabel} — ${v.label} video ${idx + 1}`}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="absolute inset-0 h-full w-full border-0"
                      />
                    </div>
                    {/* The title the supplier gave it (Portfolio › Video links); no title → no caption, never a filler. */}
                    {v.title ? (
                      <figcaption className="px-1 text-[13.5px] font-medium text-ink" data-featured-video-title="">
                        {v.title}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : null,
              )}
              {/* Synced Instagram posts (show_on_profile) — images re-hosted in
                  R2 render as photo tiles; a video post shows the SAME re-hosted
                  thumbnail with a play badge (still a truthful "this was a
                  video"), sized like a photo tile so the grid stays even — but
                  never links out to the IG permalink (owner ruling 2026-09-11
                  Q3: "Never show links"). Entries without a resolvable URL are
                  dropped. */}
              {igMedia.map((m, idx) =>
                m.mediaType === 'VIDEO' ? (
                  <div
                    key={`ig-${m.id}`}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
                  >
                    {m.displayUrl ? (
                      <Image
                        src={m.displayUrl}
                        alt={`${displayLabel} Instagram video ${idx + 1}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-cream/50 text-ink/40">
                        <Play aria-hidden className="h-6 w-6" strokeWidth={2} />
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
                        <Play aria-hidden className="h-5 w-5" strokeWidth={2} />
                      </span>
                    </span>
                  </div>
                ) : m.displayUrl ? (
                  <div
                    key={`ig-${m.id}`}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
                  >
                    <Image
                      src={m.displayUrl}
                      alt={`${displayLabel} Instagram post ${idx + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ) : null,
              )}
            </div>
          </section>
        ) : null}

        {/* Films rack RETIRED 2026-07-05 — unified into the all-tier "Featured
            videos" gallery above (owner: single video system). Vendors' existing
            films were migrated into gallery_video_links. */}

        {/* "Featured in these stories" — both voices crediting this vendor
            (PR-D · Simplicity Canon rule 2: credit is FREE for every visible
            vendor, any tier — the old Pro-gate is retired). Editorials keep
            their editorial grammar; chapters render in the Storyteller tile
            grammar. Auto-hidden until either voice has something to show. */}
        {showEditorials &&
        (featuredEditorials.length > 0 || featuredChapterCredits.length > 0) ? (
          <section id="featured-stories" className="scroll-mt-24 space-y-4 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Featured in these stories
            </h2>
            {featuredEditorials.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {featuredEditorials.map((story, idx) => (
                <a
                  key={story.eventId}
                  href={`/${story.slug}`}
                  className={`group flex flex-col justify-between rounded-2xl border border-ink/10 bg-cream/50 p-5 transition-colors hover:border-terracotta/40 ${
                    idx === 0 ? 'sm:col-span-3 sm:flex-row sm:items-end sm:gap-6' : ''
                  }`}
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                      {idx === 0 ? 'Featured story' : 'Real Story'}
                    </p>
                    <p
                      className={`mt-1 font-serif italic text-ink ${
                        idx === 0 ? 'text-2xl' : 'text-lg'
                      }`}
                    >
                      {story.hostNames}
                    </p>
                    <p className="mt-1 text-sm text-ink/60">
                      {[story.city, story.dateLabel].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="mt-3 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-terracotta group-hover:underline sm:mt-0">
                    Read their story
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </span>
                </a>
              ))}
            </div>
            ) : null}
            {/* Storyteller chapters crediting this vendor — their own tile
                grammar (byline + badge + view count), never the editorial's. */}
            {featuredChapterCredits.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featuredChapterCredits.map((chapter) => (
                  <StorytellerTile key={chapter.publicId} item={chapter} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 🔗🖼 INSPIRATION (owner 2026-10-30; the approved website-by-plan design places it after Packages). Renders
            nothing with no shown looks, and nothing when the read failed (`shownLooks` is then empty). */}
        <ShopInspirationSection tiles={inspirationTiles} shopName={displayLabel} />
        </div>

        {/* ── REVIEWS. */}
        <div id="shop-reviews" data-shop-section="" className="scroll-mt-14">
        {/* Hybrid-anonymity (V2.1 amendment #2): pass displayLabel so
            the reviews section heading + per-review attribution
            ("review of {vendor}") render the placeholder while
            hidden, and the real business_name once revealed. */}
        <ReviewsSection
          slug={slug}
          businessName={displayLabel}
          reviewStats={reviewStats}
          trustedReviewStats={trustedReviewStats}
          reviews={orderedReviews}
          reviewCardsById={reviewCardsById}
          guestReviews={guestReviews}
          guestReviewPhotoUrls={guestReviewPhotoUrls}
          hasMore={hasMore}
          moreHref={withShopArrival(`/${slug}?reviewsPage=${reviewsPage + 1}#reviews`, shopArrival)}
          /* ⛔ THE PHASE-C REVIEW-DISPLAY GATE IS RETIRED (owner ruling
             re-confirmed 2026-08-09): reviews are never hidden or unlocked by
             what a vendor pays. Both caps are now true on every tier, so these
             stay wired only to keep the component's shape — and because
             `reviews-are-never-tiered.test.ts` pins them true, a Free shop can
             never silently lose its stars or its written reviews again. */
          showStars={viewerTierCaps.reviewStarsCounted}
          showComments={viewerTierCaps.reviewCommentsViewable}
          recommendingCouples={recommendingCouples}
          completedEvents={completedEvents}
          venueEvents={venueEvents}
          hasVenueMatch={venueMatchCount > 0}
          sampleShop={isDemoVendor}
        />
        </div>

        {/* 📍 WHERE — the unverified shop's map has its own section (prototype: Services · Reviews · Where · Inquire), a
            pin only: no reach ring before verification, the reach line says "distance search opens once verified". */}
        {cinematicHero ? null : (
          <div id="shop-where" data-shop-section="" className="scroll-mt-14">
            <section className="space-y-3 border-b border-ink/10 py-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Where</h2>
              <p className="text-sm text-ink/70">
                <ShopReachLine reach={reach} city={vendor.location_city ?? null} />
              </p>
              <ShopReachMap
                reach={reach}
                latitude={vendor.hq_latitude}
                longitude={vendor.hq_longitude}
                city={vendor.location_city ?? null}
              />
              <DirectionsMenu
                latitude={vendor.hq_latitude}
                longitude={vendor.hq_longitude}
                query={vendor.hq_address ?? vendor.location_city ?? null}
              />
            </section>
          </div>
        )}

        {/* ✅ ONE INQUIRE (owner 13 Nov 2026, verbatim "Yes, only one"): no Inquire section, no form, no tab at the foot
            of the page. The calling card's Inquire — and a service card's "Inquire about this" (same action, card picked)
            — open the ONE pop-up (`InquireSheet`, the ONE send `startServiceInquiry`). It is mounted for every shop that
            takes messages (`canMessage`): an unverified shop can be messaged, never booked (DECISION_LOG 2026-11-07).
            `#get-in-touch` stays as the target old links carry (Compare, shared links); arriving on it opens the pop-up.
            What stays here is not an ask: the waitlist for a booked date, and the cold "See more suppliers" door. */}
        <div id="get-in-touch" className="scroll-mt-24">
          {/* Booked-Out Waitlist CTA — shown only when this couple's intended
              date is unavailable on this vendor (Wave 4 vendor benefit). The
              couple joins; when the date frees up the vendor notifies them by
              email. Additive + privacy-respecting: the couple sees "unavailable",
              never the reason. */}
          {waitlistDate ? (
            <div className="mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-4 sm:p-5">
              <p className="text-sm font-semibold text-ink">
                {displayLabel} is booked on{' '}
                {new Date(`${waitlistDate}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila',
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                .
              </p>
              {!waitlistEnabled ? (
                <p className="mt-1 text-sm text-ink/70">This date is unavailable.</p>
              ) : waitlistPicked ? (
                /*
                  THE PICKED STATE. Before 2026-08-29 this branch did not exist:
                  a couple the shop had chosen read the same "we'll email you the
                  moment it opens up" as one still waiting, because the query
                  above never looked at `accepted_at`.

                  ⏳ IT SAYS THE DATE IS BEING HELD, NOT THAT IT IS THEIRS. The
                  shop can pick more than one couple (`max_waitlist_acceptances`)
                  and nothing here books anything — promising more than that
                  would be a promise the product cannot keep.
                */
                <p className="mt-1 text-sm font-semibold text-ink">
                  {displayLabel} has kept this date for you. Message them to book it — they
                  can hold it for only so long.
                </p>
              ) : alreadyWaitlisted || waitlistNotice === 'joined' ? (
                <p className="mt-1 text-sm text-ink/70">
                  You&rsquo;re on the waitlist for this date — we&rsquo;ll email you the moment it
                  opens up.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-ink/70">
                    Join the waitlist for this date and we&rsquo;ll email you if it frees up.
                  </p>
                  {waitlistNotice === 'error' ? (
                    <p className="mt-2 text-sm text-warn-900">
                      That didn&rsquo;t save — please try again.
                    </p>
                  ) : null}
                  <form action={joinVendorWaitlist} className="mt-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input
                      type="hidden"
                      name="vendor_profile_id"
                      value={vendor.vendor_profile_id}
                    />
                    <input type="hidden" name="requested_date" value={waitlistDate} />
                    {/* Where this visit came from, so the page the join returns to keeps its back door. */}
                    {shopArrival.src ? <input type="hidden" name="src" value={shopArrival.src} /> : null}
                    {shopArrival.eventId ? <input type="hidden" name="event" value={shopArrival.eventId} /> : null}
                    <SubmitButton
                      pendingLabel="Joining…"
                      className="rounded-lg bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-800"
                    >
                      Join the waitlist for this date
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          ) : null}

          {canMessage ? (
            <InquireSheet
              shop={{ vendorProfileId: vendor.vendor_profile_id, slug: vendor.business_slug ?? slug, name: displayLabel }}
              services={inquireServices}
              signedIn={viewerSignedIn}
              events={inquireEvents}
              inquirySource={arrivalInquirySource}
              referringChapterPublicId={arrivalChapter}
            />
          ) : null}

          <div className="flex flex-wrap gap-3 py-8">
            {/* 🧭 BACK GOES WHERE YOU CAME FROM (owner 2026-11-07: "back to suppliers? it went to a wrong shell"). This
                was a fixed `/explore` for every arrival — Discover, an event's Suppliers, a saved supplier. The door
                is now `shopBackDoor` (lib/shop-back.ts); with no arrival it says "See more suppliers", never "Back".
                2026-11-12 ("DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED": "The low button stays for cold arrivals"):
                with an arrival the top-left ‹ IS the way back, so this foot door is drawn only cold — never two
                "Back"s on one page. */}
            {!shopBack.back ? (
              <Link href={shopBack.href} className="button-secondary" data-shop-back="cold">
                {shopBack.label}
              </Link>
            ) : null}
          </div>
        </div>
          </div>

        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-6 text-xs text-ink/50">
          {/* Setnayan brand mark — visible on every vendor site, every tier
              (owner 2026-07-03), incl. Enterprise custom domains. */}
          <p>
            Powered by{' '}
            <span className="font-semibold tracking-wide text-ink/70">SETNAYAN</span>{' '}
            <span className="italic">· Set na &lsquo;yan</span>
          </p>
          <p>
            Supplier ID · <span className="font-mono">{vendor.public_id}</span>
          </p>
          {/*
            🔴 A COUPLE HAD NO WAY TO REPORT A SHOP — CTRL-B3 build 9, 2026-09-22.
            `PublicPageActions` carries Share + Report on the celebration page
            and `/u/*`, but is never mounted under `app/v/`, and the report
            vocabulary had no vendor value at all. So the marketplace — the one
            public surface where strangers meet strangers and money changes
            hands — was the only one with no route.

            🔑 THE BUTTON IS MOUNTED DIRECTLY, NOT THROUGH `PublicPageActions`,
            because that component hardcodes `targetType="event"`. Threading a
            new prop through it would put a second meaning into a shared
            component for one caller; the button already takes the type.

            ⚠ BOTH ENDS. A report with no desk is a tray badge reaching nobody —
            `/admin/user-reports` now names this target type, and
            `a-couple-can-report-a-shop.test.ts` asserts the filing path and the
            desk together.

            🔴 A <div>, NEVER A <p>. `ReportPageButton`'s root is a <div> (and its
            sheet is more <div>s and an <h2>). Inside a <p> the browser's parser
            closes the <p> early, so the server HTML no longer matches the tree
            React hydrates — React error #418 on EVERY load of every shop page,
            light and dark (live walk 2026-11-01, /setnaprod and /v/setnaprod).
            Held by `no-block-inside-a-paragraph.test.ts`.
          */}
          <div className="pt-1">
            <ReportPageButton
              targetType="vendor"
              targetId={vendor.vendor_profile_id}
              label="Report this shop"
              className="inline-flex min-h-[44px] items-center text-ink/45 hover:text-ink/70"
            />
          </div>
        </footer>
      </article>
    </main>
  );
}

export default async function PublicVendorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  return renderVendorBySlug({ slug, searchParams });
}

function ComingSoonBanner({ vendorName }: { vendorName: string }) {
  return (
    <section
      aria-label="Coming soon"
      data-coming-soon
      className="mb-8 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.04] p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        Coming soon
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
        {vendorName} is verifying their Setnayan account.
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/65">
        Their profile is a read-only preview while the Setnayan Team completes
        verification. Bookings open as soon as that&rsquo;s done.
      </p>
    </section>
  );
}

/**
 * Visible only to admins in demo mode — the gate above this banner
 * 404s for non-admins, so when this banner renders the viewer already
 * has admin grants AND the demo cookie set. Marks the profile as
 * synthetic so the admin doesn't mistake it for a real onboarded
 * vendor. Brand-voice copy per `feedback_setnayan_no_dev_text_post_launch`.
 */
function DemoVendorBanner() {
  return (
    <section
      aria-label="Demo supplier"
      className="mb-8 rounded-2xl border border-warn-300/70 bg-warn-50 p-5"
    >
      <div className="flex items-start gap-3">
        <Sparkles
          aria-hidden
          className="mt-0.5 h-4 w-4 text-warn-700"
          strokeWidth={1.75}
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-warn-700">
            Demo supplier
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-warn-900">
            Demo mode is on — this demo shop&rsquo;s prices show to you.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-warn-900/85">
            Everyone can open this demo shop; it is marked (DEMO ONLY) and can&rsquo;t be booked. With demo mode on,
            its prices show here so you can see how the page feels with them. Real suppliers&rsquo; prices are unchanged.
          </p>
        </div>
      </div>
    </section>
  );
}

function Logo({ logoUrl, name, frame }: { logoUrl: string | null; name: string; frame?: LogoFrame }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        <Image
          src={logoUrl}
          alt={name}
          width={96}
          height={96}
          className="h-full w-full object-cover"
          style={logoFrameStyle(frame)}
        />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}

type ServicesPricingProps = {
  /** 🃏 A signed-in viewer → the gallery asks once whether they run this shop (hide per card · 👁 · opens). */
  ownerCheckFor: string | null;
  /** 🃏 What the shop hid on each card (`vendor_service_card_hides`), or `error` when that read failed. */
  cardHides: CardHidesRead;
  /** 🃏 The viewer runs the shop (checked on the server) — the only viewer sent the hidden items. */
  viewerCuratesCards: boolean;
  /** 📈 The shop whose card opens count (Build 6 Lane I, "Which card sells") — null for a demo shop or a team preview. */
  countOpensFor: string | null;
  services: ReadonlyArray<VendorServiceRow>;
  businessName: string;
  inclusionsByService: Map<string, VendorServiceInclusion[]>;
  discountsByService: Map<string, VendorServiceDiscount[]>;
  /** Pre-formatted "Serves" line per service id (coverage event types + faiths). */
  servesByService: Map<string, string>;
  /** Resolved showcase display URLs per service id (photos ≤5 + optional clip). */
  showcaseByService: Map<string, ServiceShowcaseMedia>;
  /** SUP-12 — each card's cover, already a display URL. Empty map ⇒ every card
   *  renders exactly as it did before, which is what the two other callers of
   *  `toServiceCard` still do. */
  coverUrlByService: Map<string, string>;
  /** SUP-14 — the LIVE taxonomy's tile for each card kind, resolved server-side.
   *  Empty ⇒ `eventVendorCategoryForCardKind` falls to its branch/`misc` rungs,
   *  which is the same degradation the inquiry action already accepts. */
  tileByCardKind: Map<string, string>;
  /** ③0-c — the live coarse category per category (`getTaxonomy()`), for the group heading. */
  coarseSource: CoarseCategorySource;
  /** Council #6: vendor opted to hide public prices → strip every peso amount. */
  hidePrices: boolean;
  /** The viewing couple's event date (ISO YYYY-MM-DD), when a signed-in couple
   *  with an event is looking. Drives the early-booking LADDER: their date picks
   *  the tier and the badge names it ("Booked 6+ months ahead · −10%"). null =
   *  anonymous / no event → the badge advertises the ladder as "up to" instead
   *  (owner-locked 2026-07-27). DISPLAY ONLY — nothing here is charged. */
  coupleEventDate: string | null;
  /** Compiled Card Record per service id. EMPTY when NEXT_PUBLIC_CARD_RECORD_
   *  ENABLED is off (the reader is not even called), so every card's record is
   *  null and the gallery renders exactly as it does today. */
  cardRecordByService: Map<string, CompiledCardRecord>;
  /** 🃏📸 Each card's albums (flag on) — null = the flag is off, so no card carries any. */
  albumsByService: Map<string, AlbumView[] | null> | null;
  /** 📸 Each card's event photos for photos by service (flag on) — null = the flag is off. */
  eventPhotosByService: Map<string, { url: string; caption: string; event: string }[] | null> | null;
  /** 📸 Couples' approved photos per service id (`fetchServiceCardCouplePhotos`). Empty ⇒ cards as before. */
  couplePhotosByService: Map<string, CoupleLook[]>;
  /** A signed-in viewer → the gallery asks, after the page, for the non-public couple photos they are inside. */
  viewerSignedIn: boolean;
  /** Shop-wide trusted rating rendered inside the record block. Vendor-level by
   *  nature — reviews attach to the profile, not to a service. null → no stars. */
  cardRecordRating: CardRecordRating | null;
  /** `serviceDetailsEnabled()`. OFF ⇒ every card is the static div it is today
   *  and the details sheet is never mounted. */
  detailsEnabled: boolean;
  /** How the sheet's "Inquire about this" behaves — see ServiceInquireMode. */
  inquireMode: ServiceInquireMode;
  /** `?service=<public id>` — opens that card's sheet on arrival. */
  openServicePublicId: string | null;
  /** 🔗🖼 Each live card's approved inspiration looks (`looksByCard`). `null` = unread → cards are drawn as before. */
  inspirationByService: Map<string, ShopInspirationLook[]> | null;
  /** ⭐ Each live card's own reviews (`buildCardReviews`) — absent for a card with none. */
  reviewsByService: ReadonlyMap<string, CardReviews>;
};

/** The shop page's service cards, in their coverage groups — built ONCE per input, read by the gallery and by
 *  📸 photos by service (owner 2026-11-14), so the two can never draw a different card. */
function buildServiceGroups({
  services,
  businessName,
  inclusionsByService,
  discountsByService,
  servesByService,
  showcaseByService,
  coverUrlByService,
  tileByCardKind,
  coarseSource,
  hidePrices,
  coupleEventDate,
  cardRecordByService,
  albumsByService,
  eventPhotosByService,
  couplePhotosByService,
  viewerSignedIn,
  cardRecordRating,
  detailsEnabled,
  inquireMode,
  openServicePublicId,
  inspirationByService,
  reviewsByService,
  countOpensFor,
  cardHides,
  viewerCuratesCards,
  ownerCheckFor,
}: ServicesPricingProps): ServiceGroup[] {
  /*
    ── SUP-14 · A CARD SITS UNDER ITS REAL TRADE ────────────────────────────
    Measured on the live shop 2026-09-15: the one published supplier's two
    cards both sat under a heading reading "OTHER", while the SAME page listed
    "Services offered: Live Band · Host / MC" two sections above. The page had
    the trade and did not use it.

    🔑 THIS CODE WAS NOT MIS-FILING THEM — IT WAS FAILING SAFE. There are two
    vocabularies here. `vendor_services.category` is plain TEXT holding a
    coverage LEAF (`live_band`) or a tier-2 TILE id (`host_mc`);
    `serviceGroupOf` speaks the coarse `VENDOR_CATEGORIES` (`band_dj`,
    `host_emcee`). They overlap only by accident — measured:
    `isCanonicalService('live_band')` is false and `serviceGroupOf('live_band')`
    returns UNDEFINED, which is not a key any SERVICE_GROUPS entry has. So the
    old ternary's `: 'other'` was the thing stopping both cards from
    DISAPPEARING off the page entirely, which is why this row's own wording
    warns about that.

    🔑 AND THE TRANSLATOR ALREADY EXISTS. `eventVendorCategoryForCardKind` was
    built on 2026-09-09 for this exact mismatch, is pure, and is asserted
    against the live enum by a db test. Nothing new is mapped here: it reads the
    leaf map and the branch map that already exist, and its last rung returns
    `misc` — a real coarse category — so every card still lands somewhere. That
    is what keeps "no card disappears" true rather than hoped for.

    Measured through to the heading: live_band → band_dj → "Media &
    entertainment", host_mc → host_emcee → the same, photographer → unchanged,
    and anything unknown or blank → misc → "Other".
  */
  const byGroup = new Map<ServiceGroupKey, VendorServiceRow[]>();
  for (const s of services) {
    const coarse = eventVendorCategoryForCardKind(
      s.category,
      tileByCardKind.get(s.category ?? '') ?? null,
      coarseSource,
    );
    const key: ServiceGroupKey = serviceGroupOf(coarse);
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(s);
    else byGroup.set(key, [s]);
  }

  // ONE clock for every card on this render — the lead-time ladder must not be
  // able to resolve two different tiers within a single page.
  const now = new Date();

  // Build serializable coverage groups for the client gallery, preserving the
  // canonical SERVICE_GROUPS order + which groups render (behaviour-identical to
  // the old static loop). All label/price/meta formatting stays server-side.
  const groups: ServiceGroup[] = [];
  for (const group of SERVICE_GROUPS) {
    const rows = byGroup.get(group.key);
    if (!rows || rows.length === 0) continue;
    groups.push({
      key: group.key,
      label: group.label,
      cards: rows.map((row) => withCoupleLooks(
        toServiceCard(
          row,
          inclusionsByService.get(row.vendor_service_id),
          discountsByService.get(row.vendor_service_id),
          servesByService.get(row.vendor_service_id),
          showcaseByService.get(row.vendor_service_id),
          hidePrices,
          coupleEventDate,
          now,
          cardRecordByService.get(row.vendor_service_id) ?? null,
          cardRecordRating,
          detailsEnabled,
          // SUP-12 — the argument this call stopped one short of. `toServiceCard`
          // only reaches for it when the card has NO showcase photos, so a card
          // with a real gallery never loses it to the cover.
          coverUrlByService.get(row.vendor_service_id) ?? null,
        ),
        couplePhotosByService.get(row.vendor_service_id),
      ))
        .map((card) => withCardReviews(card, reviewsByService.get(card.id)))
        // 🃏📸 The card's event photos ride along only while the flag is on (`eventWork` absent otherwise).
        .map((card) => (albumsByService ? { ...card, eventWork: albumsByService.get(card.id) ?? null } : card))
        .map((card) => (eventPhotosByService ? { ...card, eventPhotos: eventPhotosByService.get(card.id) ?? null } : card))
        // 🃏 Hide per card: the refs the supplier's tap names + what is hidden. Only where the grown card exists.
        .map((card) =>
          detailsEnabled
            ? withCardHides(card, showcaseByService.get(card.id), cardHides.status === 'ok' ? cardHides.byCard.get(card.id) : undefined)
            : card,
        ),
    });
  }

  // 🔗🖼 Each card carries its own looks — the strip inside the card (the approved design's `.looks`), and the anchor
  // the Inspiration section's tiles open. Unread (`null`) → every card is exactly as before.
  if (inspirationByService) {
    const publicIdOf = new Map(services.map((s) => [s.vendor_service_id, s.public_id]));
    for (const g of groups) {
      g.cards = g.cards.map((c) =>
        withInspirationLooks(c, inspirationByService.get(c.id) ?? [], cardAnchorId(publicIdOf.get(c.id), c.id)),
      );
    }
  }

  // 🃏 HIDDEN ITEMS ARE DROPPED HERE, ON THE SERVER — last, once every hideable item (photos, clip, event lines,
  // inspiration looks) is on the card. A couple's browser never receives what the shop hid. A FAILED hides read
  // is not "nothing hidden": nobody can say which items are hidden, so none are sent and the card says so — for the
  // shop too ("show nothing extra"). Only the shop, on a good read, keeps them, greyed, to curate.
  if (detailsEnabled && (cardHides.status === 'error' || !viewerCuratesCards)) {
    for (const g of groups) {
      g.cards = g.cards.map((c) =>
        cardWithoutHidden(c, cardHides.status === 'error' ? 'unread' : (cardHides.byCard.get(c.id) ?? [])),
      );
    }
  }

  return groups;
}

function ServicesPricingSection(props: ServicesPricingProps) {
  const groups = buildServiceGroups(props);
  const { businessName, viewerSignedIn, detailsEnabled, inquireMode, openServicePublicId, countOpensFor, ownerCheckFor } = props;
  return (
    <section className="space-y-6 border-b border-ink/10 py-8">
      <header className="space-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Services &amp; pricing
        </h2>
        <p className="text-sm text-ink/65">
          Starting prices set by {businessName}. Final quotes happen in chat.
        </p>
      </header>
      <ServicesGallery
        groups={groups}
        viewerSignedIn={viewerSignedIn}
        detailsEnabled={detailsEnabled}
        inquireMode={inquireMode}
        openServicePublicId={openServicePublicId}
        shopName={businessName}
        countOpensFor={countOpensFor}
        ownerCheckFor={ownerCheckFor}
      />
    </section>
  );
}

/**
 * Format one service row into the serializable card the client gallery renders.
 * Service-card redesign · Phase 4 enriches the card with the best applicable
 * discount, FREE inclusions (with their stated worth), and "not included"
 * expectation flags so couples see the value + the caveats before quoting.
 */
// Min-N floor for the public "saved by N" chip — a count below this stays
// hidden so a tiny number never de-anonymizes or reads as vanity (owner default
// 2026-07-02: favorites public / viewers vendor-only; behavioral-data min-N lock).
const FAVORITES_MIN_DISPLAY = 3;

// The couple-facing words now live in lib/vendor-partnership-kinds.ts, shared
// with Explore and the vendor's own screen.
//
// ⚠ Both bundle kinds used to render here as "Preferred partner" — one phrase
// for two different offers, and it threw away the only part a couple cares
// about. Being told a florist is INCLUDED in their coordinator's package at no
// extra cost is the most useful thing on that row; "Preferred partner" is a
// shrug. It also read as paid placement to at least one reviewer, which it has
// never been.

/**
 * "Trusted by" — vendors who endorsed this one through the vendor↔vendor
 * mutual-accept handshake (both sides agreed: the other vendor proposed, this
 * vendor accepted). Hidden when empty — founder-only marketplace means no peer
 * endorsements yet, an honest empty state rather than a blank shell. Names run
 * through the shared hybrid-anonymity resolver; still-hidden endorsers show a
 * placeholder and are not linked (their slug would leak the withheld name).
 */
function TrustedBySection({
  vendors,
  businessName,
  unreadable,
}: {
  vendors: ReadonlyArray<TrustedByVendor>;
  businessName: string;
  /** true = the vendor_profiles half of the read was refused; `vendors` is []
   *  because nothing was read, not because nobody endorsed this shop. */
  unreadable: boolean;
}) {
  if (unreadable) {
    return (
      <section className="space-y-1.5 border-b border-ink/10 py-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Trusted by
        </h2>
        <p className="text-sm text-ink/65">
          We couldn&rsquo;t load {businessName}&rsquo;s supplier endorsements right now.
        </p>
      </section>
    );
  }
  if (vendors.length === 0) return null;
  return (
    <section className="space-y-4 border-b border-ink/10 py-8">
      <header className="space-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Trusted by
        </h2>
        <p className="text-sm text-ink/65">
          Fellow suppliers who endorsed {businessName} — each one confirmed it.
        </p>
      </header>
      <ul className="flex flex-wrap gap-2">
        {vendors.map((v) => {
          const body = (
            <>
              <BadgeCheck aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
              <span className="font-medium text-ink">{v.displayName}</span>
              <span className="text-ink/45" title={PARTNERSHIP_PUBLIC_HINT[v.relationshipType]}>
                · {PARTNERSHIP_PUBLIC_LABEL[v.relationshipType]}
              </span>
            </>
          );
          return (
            <li key={v.vendorProfileId}>
              {v.href ? (
                <a
                  href={v.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1 text-[12px] text-ink/70 transition-colors hover:border-success-300/60 hover:text-ink"
                >
                  {body}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1 text-[12px] text-ink/70">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewsSection({
  slug,
  businessName,
  reviewStats,
  trustedReviewStats,
  reviews,
  reviewCardsById,
  guestReviews,
  guestReviewPhotoUrls,
  hasMore,
  moreHref,
  showStars,
  showComments,
  recommendingCouples,
  completedEvents,
  venueEvents,
  hasVenueMatch,
  sampleShop = false,
}: {
  slug: string;
  businessName: string;
  reviewStats: ReviewStatsRow;
  /** ANTI-FRAUD (2026-07-05): trusted headline average + count. */
  trustedReviewStats: TrustedReviewStatsRow;
  reviews: ReadonlyArray<ReviewWithCouple>;
  /** The live cards a host review can name ("For <card>"). */
  reviewCardsById: ReadonlyMap<string, ReviewCardLink>;
  /** ⭐ From guests — its own group; never feeds the overall. */
  guestReviews: GuestReviewsRead;
  /** The guests' own shots, through the blur gate. */
  guestReviewPhotoUrls: ReadonlyMap<string, string>;
  hasMore: boolean;
  /** The next page of reviews — this page again, carrying where the visit came from. */
  moreHref: string;
  /** Phase C: Free hides the star average + per-review star rows. */
  showStars: boolean;
  /** Phase C: Free + Verified hide review bodies + axis stats + replies. */
  showComments: boolean;
  /** "Recommended by N couples" (Event Lifecycle Menu §6.3) — 0 hides it. */
  recommendingCouples: number;
  /** Receipt-backed dated track record (Wave 5) — [] hides the section. */
  completedEvents: ReadonlyArray<VendorCompletedEventRow>;
  /** Venue-aware past-events gallery (safe layer, owner 2026-07-18). */
  venueEvents: VendorVenueEvent[];
  /** True when ≥1 venueEvents is at the viewing couple's venue. */
  hasVenueMatch: boolean;
  /** 🏪 A demo shop (`is_demo`) — its reviews are SAMPLES and each one says so (DECISION_LOG 2026-11-10 🏪). */
  sampleShop?: boolean;
}) {
  return (
    <section id="reviews" className="space-y-6 border-b border-ink/10 py-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Reviews
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            From verified couples who&rsquo;ve booked {businessName} via Setnayan.
          </p>
        </div>
        {recommendingCouples > 0 ? (
          <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-mulberry/10 px-3 py-1 text-xs font-medium text-mulberry sm:self-end">
            <Heart aria-hidden className="h-3.5 w-3.5 fill-mulberry/80" strokeWidth={2} />
            Recommended by {formatCount(recommendingCouples)} couple{recommendingCouples === 1 ? '' : 's'}
          </p>
        ) : null}
      </header>

      {/* Receipt-backed track record (Wave 5). A dated list of events this
          vendor delivered THROUGH Setnayan — same owner/team/internal/self-comp
          exclusions as the public completed-events count, so it can't be
          padded. Renders for every viewer tier; omitted only when empty. */}
      {venueEvents.length > 0 ? (
        <VenueMatchedEvents events={venueEvents} hasMatch={hasVenueMatch} />
      ) : completedEvents.length > 0 ? (
        <TrackRecord events={completedEvents} />
      ) : null}

      {showStars ? (
        <ReviewHeroMetrics stats={reviewStats} trusted={trustedReviewStats} guestReviews={guestReviews} />
      ) : null}

      <ReviewGroupHead>From the hosts</ReviewGroupHead>

      {/* ⛔ THE "UPGRADE TO UNLOCK REVIEWS" PANEL IS GONE (2026-08-09).
          It rendered whenever both caps were off — i.e. on every Free vendor —
          and told couples, on that vendor's own page, "Reviews unlock when this
          vendor upgrades their Setnayan plan." A shop's reputation is not a
          thing it can buy; the owner's merit-first lock says reviews are never
          tiered, and both caps are now true on every tier, so this branch could
          only ever be dead code carrying a false promise. Removed rather than
          left unreachable — an unreachable branch with wrong copy is one
          refactor away from being reachable again. */}
      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-6">
          <p className="text-sm text-ink/65">This supplier still has no review.</p>
          {/* 🔴 Was "a review request 24 hours after the event" — a promise
              nothing kept, on every shop page. See CTRL-B3 build 11 and the
              sibling fix in vendor-marketplace-info.tsx. No duration is named:
              a sentence with no number cannot drift from the code's. */}
          <p className="mt-1 text-xs text-ink/45">
            A review opens once the supplier confirms they delivered and the
            couple confirms they received it.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.review_id}>
              <ReviewRow
                review={r}
                card={r.service_id ? (reviewCardsById.get(r.service_id) ?? null) : null}
                showStars={showStars}
                showComments={showComments}
                vendorName={businessName}
                sample={sampleShop}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Hide the "Show more" pager when the whole review list is suppressed
          (Free tier) — there's nothing more to page through. */}
      {hasMore && (showStars || showComments) ? (
        <div className="pt-2">
          <Link
            href={moreHref}
            className="button-secondary inline-flex h-10 px-4"
          >
            Show more reviews
          </Link>
        </div>
      ) : null}

      {/* ⭐ FROM GUESTS (owner, 6 Nov) — their own group, after the hosts'. No guest reviews → no group at all. */}
      <GuestReviewsGroup read={guestReviews} photoUrlByCapture={guestReviewPhotoUrls} vendorName={businessName} />
    </section>
  );
}

function ReviewHeroMetrics({
  stats,
  trusted,
  guestReviews,
}: {
  stats: ReviewStatsRow;
  /** ANTI-FRAUD (2026-07-05): headline average + count read the TRUSTED stat. */
  trusted: TrustedReviewStatsRow;
  /** The guests' own line, UNDER the overall — it never moves it (owner, 6 Nov · option A). */
  guestReviews: GuestReviewsRead;
}) {
  // Headline number + count are the TRUSTED (receipt-backed, arm's-length)
  // aggregate so fake / self-dealt reviews can't inflate the public rating.
  const hero = trusted.trusted_avg_rating;
  const trustedCount = trusted.trusted_review_count;
  // The per-star histogram bars stay on the raw counts (proportional shape of
  // whatever reviews exist); only the aggregate number/stars/count migrate.
  const totals: Array<{ star: 5 | 4 | 3 | 2 | 1; count: number }> = [
    { star: 5, count: stats.count_5_star },
    { star: 4, count: stats.count_4_star },
    { star: 3, count: stats.count_3_star },
    { star: 2, count: stats.count_2_star },
    { star: 1, count: stats.count_1_star },
  ];
  const max = Math.max(1, ...totals.map((t) => t.count));

  return (
    <div className="grid gap-6 rounded-2xl border border-ink/10 bg-cream p-5 sm:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          <Star
            className={`h-6 w-6 ${hero > 0 ? 'fill-warn-400 text-warn-500' : 'text-ink/25'}`}
            strokeWidth={1.5}
          />
          <span className="text-3xl font-semibold text-ink">
            {hero > 0 ? formatStarRating(hero) : '—'}
          </span>
          <span className="text-sm font-semibold text-ink">overall</span>
        </div>
        <p className="text-xs text-ink/60">
          {formatCount(trustedCount)} review{trustedCount === 1 ? '' : 's'} across all their services
        </p>
        <GuestStarsLine read={guestReviews} />
      </div>
      <ul className="space-y-1.5 text-xs">
        {totals.map(({ star, count }) => (
          <li key={star} className="grid grid-cols-[28px_1fr_40px] items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-ink/65">
              {star}
              <Star className="h-3 w-3 fill-warn-400 text-warn-500" strokeWidth={1.5} />
            </span>
            <span className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <span
                className="block h-full bg-warn-400"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-[11px] text-ink/55">{formatCount(count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewRow({
  review,
  card,
  showStars,
  showComments,
  vendorName,
  sample = false,
}: {
  review: ReviewWithCouple;
  /** The card this review is for — null when it names none (or the card is no longer live). */
  card: ReviewCardLink | null;
  /** Phase C: hide the overall star row when the tier can't count stars. */
  showStars: boolean;
  /** Phase C: hide the comment body + axis stats + vendor reply. */
  showComments: boolean;
  /** Business name used to label the vendor reply ("Response from [name]"). */
  vendorName: string;
  /** 🏪 The shop is a demo — this review is a SAMPLE: never "Verified couple", and it wears the sample chip. */
  sample?: boolean;
}) {
  const author = sample
    ? 'Sample couple'
    : review.couple_display_name && review.couple_display_name.trim().length > 0
      ? review.couple_display_name
      : 'Verified couple';
  const dateLabel = new Date(review.created_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className="rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Phase C: star row hidden for tiers that don't count stars. */}
          {showStars ? <StarRow value={review.rating_overall} /> : null}
          <span className="text-sm font-medium text-ink">{author}</span>
          {sample ? <SampleMarker>Sample review</SampleMarker> : null}
          {/* Receipt-backed provenance (Wave 5 + import polish). PLATFORM-DERIVED
              — couples can't set it. "Verified booking" when the relationship
              came via the vendor's invite QR (import); "Verified wedding" when
              the couple booked on-platform themselves; nothing for off-platform
              bookings with no linked profile. */}
          {review.via_vendor_import ? (
            <VerifiedBookingPill />
          ) : review.booked_through_setnayan ? (
            <VerifiedWeddingPill />
          ) : null}
        </div>
        <time className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
          {dateLabel}
        </time>
      </header>
      <ReviewForLine card={card} />
      {/* Phase C: comment body + per-axis stats stay gated behind showComments
          (Free + Verified hidden, Pro/Enterprise shown). */}
      {showComments ? (
        <>
          {review.body ? (
            <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{review.body}</p>
          ) : null}
          <dl className="mt-3 grid gap-2 text-[11px] text-ink/55 sm:grid-cols-4">
            <AxisStat axis="communication" value={review.rating_communication} />
            <AxisStat axis="quality" value={review.rating_quality} />
            <AxisStat axis="value" value={review.rating_value} />
            <AxisStat axis="on_time" value={review.rating_on_time} />
          </dl>
        </>
      ) : null}
      {/* Right-of-reply (owner 2026-06-29): a vendor's ONE public reply renders
          for EVERY viewer regardless of tier — a Free/Verified vendor's reply is
          no longer hidden behind the showComments gate. The reply is its own
          right, independent of the comment-body tier cap. */}
      {review.vendor_reply ? (
        <VendorReplyBlock review={review} vendorName={vendorName} />
      ) : null}
    </article>
  );
}

/**
 * Receipt-backed provenance pills. Both surface only when a review's source
 * booking is linked to this vendor's marketplace profile (provenance is
 * platform-derived; couples can never set it).
 *
 * "Verified wedding" — the couple found + booked this vendor through Setnayan
 * themselves: a real on-platform engagement, not a drive-by review.
 */
function VerifiedWeddingPill() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-mulberry/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-mulberry"
      title="This couple booked this supplier through Setnayan — verified by the platform."
    >
      <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
      Verified wedding
    </span>
  );
}

/**
 * "Verified booking" — the vendor brought this couple onto Setnayan via their
 * invite QR (event_vendors.source = 'vendor_invite'). Still a verified,
 * platform-confirmed relationship — just sourced from the vendor's own client
 * rather than on-platform discovery.
 */
function VerifiedBookingPill() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-terracotta-700"
      title="The supplier invited this couple to Setnayan — a verified booking relationship."
    >
      <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
      Verified booking
    </span>
  );
}

/**
 * Receipt-backed dated track record. A list of `{event type · month-year}`
 * entries for events this vendor delivered THROUGH Setnayan. Sourced from the
 * `vendor_completed_events` view, which applies the same owner/team/internal/
 * self-comp exclusions as the public completed-events count — so the list can
 * never be padded by the vendor's own bookings.
 */
function TrackRecord({ events }: { events: ReadonlyArray<VendorCompletedEventRow> }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarCheck aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          Track record
        </h3>
        <span className="text-xs text-ink/45">
          {formatCount(events.length)} event{events.length === 1 ? '' : 's'} delivered through Setnayan
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {events.map((ev) => {
          const month = formatTrackRecordMonth(ev);
          return (
            <li
              key={ev.vendor_id}
              className="flex items-center justify-between gap-3 rounded-md bg-ink/[0.03] px-3 py-1.5 text-sm"
            >
              <span className="text-ink/80">{formatEventTypeLabel(ev.event_type)}</span>
              {month ? (
                <time className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/45">
                  {month}
                </time>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AxisStat({ axis, value }: { axis: ReviewAxis; value: number }) {
  return (
    <div className="rounded-md bg-ink/[0.03] px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
        {REVIEW_AXIS_LABEL[axis]}
      </dt>
      <dd className="flex items-center gap-1 text-ink/80">
        <Star className="h-3 w-3 fill-warn-400 text-warn-500" strokeWidth={1.5} />
        <span className="font-mono text-[11px]">{value.toFixed(0)}</span>
      </dd>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`h-4 w-4 ${
            n <= value ? 'fill-warn-400 text-warn-500' : 'text-ink/25'
          }`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function VendorReplyBlock({
  review,
  vendorName,
}: {
  review: ReviewWithCouple;
  vendorName: string;
}) {
  const repliedAt = review.vendor_reply_at
    ? new Date(review.vendor_reply_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  return (
    <div className="mt-3 rounded-md border-l-4 border-terracotta/40 bg-terracotta/[0.06] p-3 pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
        Response from {vendorName}
        {repliedAt ? ` · ${repliedAt}` : null}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{review.vendor_reply}</p>
    </div>
  );
}

/**
 * Fetch vendor packages with their items in one round-trip per package.
 * Best-effort: errors (table missing in stale deploy environment) return
 * an empty array so /v/[slug] keeps rendering without the Packages
 * section. Migrations applied → real data flows.
 */
/**
 * 🎁 A bundle as this page draws it: the package, its lines, and its GIFT (the bundle maker's Gift row, owner
 * 2026-11-07) — the stored value plus, for a shop pack, the live catalogue pack it names (so the couple's line says
 * the catalogue's own count, never a typed one).
 */
type ShopPagePackage = VendorPackageWithItems & { gift: PackageGift; giftPack: ShopGiftPack | null };

/** The gift columns, read in the SAME query as the package (one request). Display only — the money path never reads them. */
const VENDOR_PACKAGE_GIFT_COLUMNS = 'includes_setnayan_gift, gift_pack_code';

async function fetchVendorPackagesWithItems(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<ShopPagePackage[]> {
  try {
    const { data: pkgs, error: pkgsErr } = await admin
      .from('vendor_packages')
      .select(`${VENDOR_PACKAGE_SELECT}, ${VENDOR_PACKAGE_GIFT_COLUMNS}`)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (pkgsErr) {
      // Same posture as the itemsError guard a few lines down: an empty list
      // OMITS the Packages section (an honest absence), so keep the reason
      // logged rather than let a refused read look like "no packages".
      logQueryError('PublicVendorPage.packages', pkgsErr, { vendorProfileId }, 'graceful_degrade');
    }
    if (pkgsErr || !pkgs || pkgs.length === 0) return [];

    const packageIds = pkgs.map((p) => p.package_id);
    // `is_required` drives the "Always included" lock in the customize modal. It
    // was missing here, so on this page every required line rendered as a normal
    // unticking checkbox — the server still refused the removal, but the UI said
    // otherwise.
    //
    // ONE QUERY. This used to be two — a flag-gated branch that appended
    // `PACKAGE_ITEM_BRANCHING_SELECT` here and only here, because the shared
    // constant deliberately withheld those five columns from `lockPackage`'s own
    // select. That asymmetry WAS the ₱0 bug: this page could render a priced
    // follow-up / pick-N / hour stepper that the lock path could not see, so it
    // committed none of them. The columns now live in the shared constant, both
    // money callers read them, and there is nothing left to append or to gate.
    //
    // (The split was also structural, not stylistic: postgrest-js parses the
    // select string in the TYPE system, so a union of two literals makes that
    // parser bail and erases the row type. One literal, one query, no union.)
    const { data: items, error: itemsError } = await admin
      .from('vendor_package_items')
      .select(VENDOR_PACKAGE_ITEM_SELECT)
      .in('package_id', packageIds)
      .order('display_order', { ascending: true });
    // ⚠ 🚨 A PACKAGE RENDERS WITH NO ITEMS. This is a PUBLIC page and these are what a
    // ⚠ couple is buying. A refused read empties the package rather than failing it, so
    // ⚠ the shop appears to be selling nothing — and nothing on screen looks wrong.
    if (itemsError) {
      logQueryError('PublicVendorPage.items', itemsError, { vendorProfileId }, 'graceful_degrade');
      // FAIL THE FETCH, don't empty the package. The function already returns []
      // from its own catch, and the section is gated on `length > 0` — so an
      // empty list OMITS the section, which is an honest absence. A package
      // rendered with no items is not an absence, it is a false statement about
      // what this vendor sells, on a public page, to somebody deciding what to
      // buy. Between "we are showing you nothing" and "we are showing you the
      // wrong thing", only the second is a lie.
      // 🔑 The warning above this block was already written, and only logged.
      // A comment describing a failure mode is not a guard against it.
      return [];
    }

    // CHOICE lines. A line is a choice iff it has options, so this join is what
    // makes them visible at all — without it the couple saw an inclusion with
    // no way to pick, and the vendor's alternatives may as well not exist.
    const itemIds = (items ?? []).map((i) => i.item_id);
    const { data: options, error: optionsError } = itemIds.length
      ? await admin
          .from('vendor_package_item_options')
          .select(PACKAGE_ITEM_OPTION_SELECT)
          .in('item_id', itemIds)
          .eq('is_available', true)
          .order('display_order', { ascending: true })
      : { data: [] as VendorPackageItemOptionRow[] , error: null };
    // 🔴 THE FILE STATES THIS EXACT HARM TWO LINES ABOVE, AND THEN LET A REFUSED
    // READ REPRODUCE IT. "A line is a choice iff it has options… without it the
    // couple saw an inclusion with no way to pick, and the vendor's alternatives may
    // as well not exist." A refused read empties `options` and does precisely that,
    // on a PUBLIC page, to a couple deciding what to buy.
    // 🔑 A comment describing a failure mode is not a guard against it.
    if (optionsError) {
      logQueryError('PublicVendorPage.packageItemOptions', optionsError, { vendorProfileId }, 'graceful_degrade');
      // Same rule, one level down. "A line is a choice iff it has options" — so
      // a refused options read turns every choice into a fixed inclusion, and
      // the couple never learns they could have picked. That is the same
      // misrepresentation of the offer, so it gets the same answer.
      return [];
    }

    const optionsByItem = new Map<string, VendorPackageItemOptionRow[]>();
    for (const row of (options ?? []) as VendorPackageItemOptionRow[]) {
      const list = optionsByItem.get(row.item_id) ?? [];
      list.push(row);
      optionsByItem.set(row.item_id, list);
    }

    const itemsByPackage = new Map<string, VendorPackageItemRow[]>();
    for (const row of items ?? []) {
      const list = itemsByPackage.get(row.package_id) ?? [];
      list.push({
        ...(row as VendorPackageItemRow),
        options: optionsByItem.get(row.item_id) ?? [],
      });
      itemsByPackage.set(row.package_id, list);
    }
    // 🎁 A shop pack's live catalogue row — read only when a bundle names one (most never do). A refused read drops the
    // pack line (logged inside) rather than printing a count nobody read: `coupleBundleGift` says nothing for it.
    const rows = pkgs as unknown as Array<VendorPackageRow & { includes_setnayan_gift?: boolean | null; gift_pack_code?: string | null }>;
    const gifts = new Map(rows.map((p) => [p.package_id, packageGiftOf({ includes_setnayan_gift: p.includes_setnayan_gift === true, gift_pack_code: p.gift_pack_code ?? null })]));
    const wantsPack = [...gifts.values()].some((g) => g && g !== PACKAGE_GIFT_SETNAYAN);
    const packs = wantsPack ? await fetchShopGiftPacks(admin) : null;
    return rows.map((p) => {
      const gift = gifts.get(p.package_id) ?? '';
      return {
        ...p,
        items: itemsByPackage.get(p.package_id) ?? [],
        gift,
        giftPack: packs?.find((x) => x.code === gift) ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Vendor packages section on /v/[slug] (owner directive 2026-05-22).
 *
 * Renders one PackageCard per active package. The CTA slot wires either:
 *   • LockPackageModal — signed-in host on a bookable verified vendor
 *   • A signed-in "couple_event_id missing" hint — sign-in works, no event
 *   • A coming_soon "not yet bookable" sub-line — informational only
 *   • A signed-out "sign in to customize" link
 */
function VendorPackagesSection({
  packages,
  coupleEventId,
  isComingSoon,
  bookingsOpen,
  hidePrices,
  paxCount,
  askTargets,
  shopName,
}: {
  packages: ReadonlyArray<ShopPagePackage>;
  /** The name this page shows for the shop — the gift line says "Gift from <it>", as a quote does. */
  shopName: string | null;
  coupleEventId: string | null;
  isComingSoon: boolean;
  /** 🚪 FALSE while bookings are closed (owner 2026-11-02) — no Book button on any package. */
  bookingsOpen: boolean;
  /** Council #6: vendor opted to hide public prices → PackageCard shows no peso. */
  hidePrices: boolean;
  /** Server-resolved head count, so a per-head upgrade quotes at what it charges. */
  paxCount: number;
  /**
   * package_id → the "ask instead" inquiry target, when the service-details
   * flag is on and the vendor has an active service to file the thread under.
   * Empty (the flag-off default) ⇒ the lock modal shows only its Lock CTA.
   */
  askTargets: ReadonlyMap<string, PackageAskTarget>;
}) {
  return (
    <section className="space-y-4 border-b border-ink/10 py-8">
      <header>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Packages
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink/70">
          One price, everything bundled. Booking a package books every
          included planning category with this supplier.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pkg) => {
          let cta: React.ReactNode = null;
          if (!bookingsOpen) {
            cta = <p className="text-xs text-ink/55">{BOOKINGS_OPEN_SOON}</p>;
          } else if (isComingSoon) {
            cta = (
              <p className="text-xs text-ink/55">
                Not yet bookable — this supplier is finishing verification.
              </p>
            );
          } else if (coupleEventId) {
            cta = (
              <LockPackageModal
                eventId={coupleEventId}
                pkg={pkg}
                paxCount={paxCount}
                ask={askTargets.get(pkg.package_id) ?? null}
              />
            );
          } else {
            cta = (
              /*
                THE SHOP YOU WERE READING (Redesign Session 6, "the seam").
                This was a <Link href="/login"> — pressing it replaced the shop
                with a login screen, and signing in then dropped the person on
                their account board, not back on the package they were about to
                customize. It is the exact journey the seam exists to fix, and
                the one the owner named. Now the sign-in opens OVER the shop and
                closes onto it, still scrolled to this package.
              */
              <SignInHereLink
                href="/login"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep" // no-card-ok: a pressable link (Sign in to customize), not a box
              >
                Sign in to customize
              </SignInHereLink>
            );
          }
          return (
            <PackageCard
              key={pkg.package_id}
              pkg={pkg}
              ctaSlot={cta}
              ctaBesidePrice
              hidePrice={hidePrices}
              gift={coupleBundleGift(pkg.gift, pkg.giftPack ? [pkg.giftPack] : null, shopName)}
            />
          );
        })}
      </div>
    </section>
  );
}

/** One hero badge: the circular image badge, with what it means said on hover (the shop page's load-bearing title). */
function HeroBadge({ badge, title, drawn = false }: { badge: ShopBadge; title: string; drawn?: boolean }) {
  return (
    <span className="inline-flex leading-[0]" title={title} data-shop-badge={badge.key}>
      <ImageBadge {...badgeImageOf(badge)} uid={`shop-${badge.key}`} size={48} label={badge.label} drawn={drawn} />
    </span>
  );
}
