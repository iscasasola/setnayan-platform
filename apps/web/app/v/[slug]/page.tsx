import Link from 'next/link';
import { boothCanBrand } from '@/lib/seating-3d';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { Mail, Phone, Globe, MapPin, Star, Sparkles, Heart, BadgeCheck, CalendarCheck, ArrowRight, Send, Play, Video } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  displayServiceLabel,
  formatPhp,
  isCanonicalService,
  resolveVendorDisplayName,
  serviceGroupOf,
  VENDOR_PLACEHOLDER_PHOTO,
  type ServiceGroupKey,
  type VendorCategory,
} from '@/lib/vendors';
import {
  isBookable,
  isPubliclyVisible,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { isTrueNameTier, tierCaps } from '@/lib/vendor-tier-caps';
import { experienceTier, vendorExperienceEnabled, yearsInBusiness } from '@/lib/vendor-experience';
import {
  fetchVendorServices,
  type VendorServiceRow,
  type VendorServiceDiscount,
} from '@/lib/vendor-services';
import {
  fetchCoveragesByIdPublic,
  fetchInclusionsByService,
  fetchDiscountsByServicePublic,
  pickBestDiscount,
  type VendorServiceCoverage,
  type VendorServiceInclusion,
} from '@/lib/vendor-service-public';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import {
  fetchTrustedByVendors,
  type TrustedByVendor,
  type TrustedByRelationship,
} from '@/lib/vendor-trusted-by';
import {
  AnonInquiryComposer,
  type AnonComposerService,
} from './_components/anon-inquiry-composer';
import {
  ServicesGallery,
  type ServiceCard,
  type ServiceGroup,
} from './_components/services-gallery';
import { fetchUserEvents } from '@/lib/events';
import {
  buildVendorVenueEvents,
  fetchViewerVenue,
  type VendorVenueEvent,
} from '@/lib/vendor-venue-events';
import { VenueMatchedEvents } from './_components/venue-matched-events';
import { resolveLivePax } from '@/lib/pax';
import { PackageCard } from '@/app/_components/vendor-packages/package-card';
import { LockPackageModal } from '@/app/_components/vendor-packages/lock-modal';
import type {
  VendorPackageItemRow,
  VendorPackageRow,
  VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { ShareButton } from './_components/share-button';
import { parseVideoLink, type VideoPlatform } from '@/lib/video-embed';
import { fetchVendorIgMediaForPublic } from '@/lib/vendor-instagram-status';
import {
  InquiryComposer,
  type InquiryComposerService,
  type SavedRequirements,
} from './_components/inquiry-composer';
import { fetchRequirementFields, type RequirementField } from '@/lib/requirements-capture';
import { joinVendorWaitlist } from './waitlist-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { getEventPreference } from '@/lib/event-preferences';
import { isSetnayanAiActiveForUser } from '@/lib/setnayan-ai';
import { getEventHostAiSubscription } from '@/lib/setnayan-ai-server';
import {
  resolveSetnayanAiPaywallEnabled,
  resolveSetnayanAiPerUserEnabled,
} from '@/lib/integration-config';
import { NavLinksRow } from '@/app/_components/nav-links';
import { VendorLocationMap } from '@/app/_components/vendor-location-map';
import {
  fetchReviewsForVendorWithCouple,
  fetchReviewStats,
  fetchTrustedReviewStats,
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
  fetchSchemaWithSharedGroups,
} from '@/lib/vendor-service-attributes';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { recordVendorProfileView } from '@/lib/record-vendor-view';

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
  }>;
};

type PublicVendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  portfolio_r2_keys: string[] | null;
  // Featured videos — external URLs the vendor pasted (migration 20270518165113).
  // Optional + `?? []` at read time so a pre-migration DB degrades to no section.
  gallery_video_links?: string[] | null;
  services: string[];
  location_city: string | null;
  hq_address: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
  // PR-B self-preview. `user_id` is the owning vendor account. When the
  // logged-in viewer's id matches, an unverified page is shown to its owner
  // so they can preview before verification lands. Optional/nullable.
  user_id?: string | null;
};

// Iteration 0043 — labels for wedding-type compatibility badges rendered on
// the public vendor profile. Mirror the vendor-dashboard editor labels so
// the badge text matches what the vendor saw when they ticked the box.
const CEREMONY_TYPE_LABELS: Readonly<Record<string, string>> = {
  catholic: 'Catholic',
  civil: 'Civil',
  inc: 'INC',
  christian: 'Christian',
  muslim: 'Muslim',
  cultural: 'Cultural',
  aglipayan: 'Aglipayan (IFI)',
  lds: 'LDS (Latter-day Saints)',
  sda: 'Seventh-day Adventist',
  jw: "Jehovah's Witnesses",
  hindu: 'Hindu',
  sikh: 'Sikh',
  buddhist: 'Buddhist',
  orthodox: 'Orthodox Christian',
  mixed: 'Mixed / interfaith',
};

const VENUE_SETTING_LABELS: Readonly<Record<string, string>> = {
  banquet_hall: 'Banquet hall',
  garden: 'Garden',
  beach: 'Beach',
  destination: 'Destination',
  heritage: 'Heritage',
  outdoor_tent: 'Outdoor tent',
  civil_registrar: 'Civil registrar',
};

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

async function fetchVendor(slug: string): Promise<PublicVendorRow | null> {
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
    'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,portfolio_r2_keys,gallery_video_links,services,location_city,hq_address,hq_latitude,hq_longitude,website,contact_email,contact_phone,public_visibility,compatible_ceremony_types,compatible_venue_settings,is_demo,name_revealed_at,screen_name,tier_state,verification_state,user_id';
  const legacySelect =
    'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,portfolio_r2_keys,services,location_city,hq_address,hq_latitude,hq_longitude,website,contact_email,contact_phone,public_visibility,compatible_ceremony_types,compatible_venue_settings';

  let { data, error } = await admin
    .from('vendor_profiles')
    .select(fullSelect)
    .ilike('business_slug', slug)
    .maybeSingle();
  if (
    error &&
    /(gallery_video_links|is_demo|name_revealed_at|screen_name|tier_state|verification_state|user_id)/i.test(
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

// Named, slug-resolved so the bare-root dispatcher (app/[slug]/page.tsx) can
// reuse the exact same vendor metadata when a bare slug resolves to a vendor.
export async function vendorMetadataBySlug(slug: string) {
  const vendor = await fetchVendor(slug);
  if (!vendor || !isPubliclyVisible(vendor.public_visibility)) {
    return { title: 'Setnayan vendor' };
  }
  // Demo vendors are admin-only. Don't leak their business name in
  // metadata to crawlers / link previews — generic title only. Admins
  // in demo mode still see the real page title on the dashboard tab
  // because the page itself sets `metadata` per render via the
  // surrounding header text.
  if (vendor.is_demo === true) {
    return { title: 'Setnayan vendor' };
  }
  const suffix = vendor.public_visibility === 'coming_soon' ? ' · Coming soon' : '';
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
    // reveal. Pro/Enterprise (isTrueNameTier === true) reveal the real
    // business_name immediately; Free (hidden) + Verified (screen) stay
    // anonymized. `?? null` → isTrueNameTier(null) → free → hidden.
    isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
  });
  const titleText = `${displayLabel} · Setnayan vendor${suffix}`;
  const descText = vendor.tagline ?? `${displayLabel} on Setnayan.`;
  // SEO/GEO Bucket 4 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — extend the
  // base metadata from PR #573 with canonical URL + OpenGraph profile card
  // + Twitter summary_large_image so social shares of a vendor profile
  // render with the vendor's logo + name instead of the layout-default
  // /brand/og-card.webp. Falls back to logo_url when present; layout-level
  // og:image (Bucket 2 PR #607) covers the no-logo case.
  return {
    title: titleText,
    description: descText,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'profile',
      url: canonicalUrl,
      title: titleText,
      description: descText,
      siteName: 'Setnayan',
      locale: 'en_PH',
      ...(vendor.logo_url
        ? {
            images: [
              {
                url: vendor.logo_url,
                /* Hybrid-anonymity (V2.1 amendment #2): alt text uses
                   the resolved display label so social previews don't
                   leak a hidden business_name via crawler-friendly alt. */
                alt: `${displayLabel} logo`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description: descText,
      ...(vendor.logo_url ? { images: [vendor.logo_url] } : {}),
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
    return rows.some((row) => {
      const payload = (row.attribute_payload ?? {}) as Record<string, unknown>;
      return payload.hide_prices_publicly === true;
    });
  } catch (err) {
    console.warn(
      '[v/[slug]] hide_prices_publicly read failed — defaulting to show',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

async function resolvePortfolioUrls(keys: string[] | null): Promise<string[]> {
  if (!keys || keys.length === 0) return [];
  try {
    const resolved = await Promise.all(
      keys.slice(0, 12).map((k) => displayUrlForStoredAsset(k)),
    );
    return resolved.filter((u): u is string => Boolean(u));
  } catch {
    return [];
  }
}

/** Platform glyph for a Featured-videos link-out card. This lucide build ships
 *  no brand marks, so play-style platforms use Play and everything else the
 *  neutral Video glyph — the platform NAME carries the identity in the label. */
function PlatformIcon({ platform }: { platform: VideoPlatform }) {
  const cls = 'h-4 w-4';
  if (platform === 'youtube' || platform === 'vimeo')
    return <Play aria-hidden className={cls} strokeWidth={2} />;
  return <Video aria-hidden className={cls} strokeWidth={2} />;
}

/** Display URLs for one service card's showcase media. */
type ServiceShowcaseMedia = { photos: string[]; videoUrl: string | null };

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
        const photos = photoUrls.filter((u): u is string => Boolean(u));
        if (photos.length > 0 || videoUrl) {
          out.set(s.vendor_service_id, { photos, videoUrl: videoUrl ?? null });
        }
      } catch {
        // Fail-soft — the card simply renders without its media strip.
      }
    }),
  );
  return out;
}

/** faithCol (Title-Case storage key) → couple-facing label, from the single
 *  faith registry ([[lib/faith-registry.ts]]). Unknown values pass through. */
const FAITHCOL_TO_LABEL: ReadonlyMap<string, string> = new Map(
  FAITH_REGISTRY.map((e) => [e.faithCol, e.label]),
);

/**
 * The card's "Serves" line from its coverage row — event types first, faiths
 * after an em-dash. EMPTY faiths = "All faiths" (the column contract: an empty
 * array means all faiths welcomed). No coverage row → null → no line rendered.
 * e.g. "Wedding · Debut — All faiths" / "Wedding — Catholic, Muslim".
 */
function buildServesLine(
  coverage: VendorServiceCoverage | undefined,
  eventTypeLabelByKey: ReadonlyMap<string, string>,
): string | null {
  if (!coverage) return null;
  const types = coverage.event_types
    .map(
      (t) =>
        eventTypeLabelByKey.get(t) ??
        t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .filter((t) => t.length > 0);
  const faiths =
    coverage.faiths.length === 0
      ? 'All faiths'
      : coverage.faiths.map((f) => FAITHCOL_TO_LABEL.get(f) ?? f).join(', ');
  if (types.length === 0) return faiths === 'All faiths' ? null : faiths;
  return `${types.join(' · ')} — ${faiths}`;
}

// Named, slug-resolved so the bare-root dispatcher (app/[slug]/page.tsx) can
// render a vendor when a bare slug resolves to one, without duplicating this
// route. The route's own default export (below) is a thin wrapper.
export async function renderVendorBySlug({
  slug,
  searchParams,
}: {
  slug: string;
  // Permissive index (string values) so the bare-root dispatcher — whose
  // searchParams shape differs — can pass its own through. The body reads only
  // string-valued keys (reviewsPage, wl, utm*, src).
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const search = await searchParams;
  const vendor = await fetchVendor(slug);
  // Hidden + archived vendors 404 from the public surface (don't leak the
  // existence of suspended / closed profiles). Coming-soon + verified render.
  if (!vendor || !isPubliclyVisible(vendor.public_visibility)) notFound();

  // PR brief 2026-05-22 evening — demo vendor gate. A vendor with
  // `is_demo=TRUE` only renders on /v/[slug] when the requesting
  // session is an admin AND demo mode is on. Non-demo vendors are
  // unaffected. Defensive null-coalesce: if Agent 1's `is_demo`
  // column hasn't shipped yet, every vendor reads as non-demo (false),
  // which is the conservative outcome that preserves current behavior.
  const isDemoVendor = vendor.is_demo === true;
  const inDemoMode = await isAdminInDemoMode();
  if (isDemoVendor && !inDemoMode) notFound();

  // PR-B public-visibility verification gate. An UNVERIFIED vendor has no
  // public website — the page 404s so it never surfaces on the public web.
  // Two carve-outs: (1) admins in demo mode (so they can preview demo
  // inventory, which may include unverified rows); (2) the OWNING vendor —
  // when the logged-in viewer's user_id matches vendor.user_id, the vendor
  // can preview their own page before verification lands. The reconcile
  // migration 20270331400000 marked the founder + every paid vendor
  // 'verified', so no real/paid public site is hidden. Defensive: a missing
  // verification_state column reads as not-verified (hidden) — conservative.
  if (vendor.verification_state !== 'verified' && !inDemoMode) {
    const supabase = await createClient();
    const {
      data: { user: viewer },
    } = await supabase.auth.getUser();
    const isOwner =
      viewer != null && vendor.user_id != null && viewer.id === vendor.user_id;
    if (!isOwner) notFound();
  }

  const visibility = parseVisibility(vendor.public_visibility);
  const bookable = isBookable(visibility);
  // 3D Booth Ads · Part C: Pro/Enterprise vendors get a shareable "walk into my
  // booth" 3D showcase at /v/[slug]/booth (same gate that brands a booth). Behind
  // NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE (inlined; kept in lock-step with the route).
  // Include verification_state so the link never appears for a vendor the booth
  // route will notFound() (the profile page skips its verified-gate for owner-
  // preview / demo mode, so a mid-re-verification Pro vendor could see a dead link).
  const canShowBooth =
    process.env.NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE === 'true' &&
    boothCanBrand(vendor.tier_state ?? null) &&
    vendor.verification_state === 'verified';
  const isComingSoon = visibility === 'coming_soon';

  const pageRaw = Number(search.reviewsPage ?? '1');
  const reviewsPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = reviewsPage * REVIEWS_PAGE_SIZE;

  const admin = createAdminClient();
  const [reviewStats, trustedReviewStats, reviews, allServices, vendorPackages, recommendingCouples, finalizedBookingCount, completedEvents, hidePricesPublicly] = await Promise.all([
    fetchReviewStats(admin, vendor.vendor_profile_id),
    // ANTI-FRAUD (2026-07-05, Phase 1 follow-up): the PUBLIC headline average
    // + review count read the TRUSTED (receipt-backed, arm's-length) stat, so
    // fake / self-dealt reviews can't inflate the number couples see. The raw
    // `reviewStats` above still backs the per-star histogram bars + the review
    // LIST pagination (`hasMore`), which stay as-is.
    fetchTrustedReviewStats(admin, vendor.vendor_profile_id),
    fetchReviewsForVendorWithCouple(admin, vendor.vendor_profile_id, { limit, offset: 0 }),
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
    (async (): Promise<number | null> => {
      const { data, error } = await admin
        .from('vendor_public_completed_events_stats')
        .select('public_completed_count')
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .maybeSingle();
      if (error) {
        console.warn('[v/[slug]] vendor_public_completed_events_stats fetch failed', error.message);
        return null;
      }
      return (data as { public_completed_count: number | null } | null)?.public_completed_count ?? null;
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
  const trustedBy = await fetchTrustedByVendors(admin, vendor.vendor_profile_id);

  // Favorites count (owner 2026-07-02: favorites PUBLIC / viewers vendor-only) —
  // distinct couples who follow OR saved this vendor (count_saves_for_vendor
  // combines vendor_follows + guest_saved_vendors). Read via the service-role
  // client server-side (the RPC's EXECUTE grant is authenticated-only, but a
  // public render needs it), then min-N floored in-app (FAVORITES_MIN_DISPLAY)
  // so a tiny count never publishes as vanity or de-anonymizes. Fail-soft → 0.
  const favoritesCount = await (async () => {
    const { data, error } = await admin.rpc('count_saves_for_vendor', {
      p_vendor_profile_id: vendor.vendor_profile_id,
    });
    return !error && typeof data === 'number' ? data : 0;
  })();

  // Spec §5 experience tier — surfaced as a subtle hero badge. We render the
  // tier even for "New to Setnayan" on the profile (honest, not negative).
  const expTier = experienceTier(finalizedBookingCount);

  // Declared + DTI-verified experience (flag + schema gated; soft-probe degrades
  // on 42703 so a pre-migration DB never breaks the profile). Sits alongside the
  // Setnayan-native tier so the card reads credible at launch.
  let declaredExp: { years: number | null; weddings: number | null; verified: boolean } | null = null;
  if (vendorExperienceEnabled()) {
    const { data: exp } = await admin
      .from('vendor_profiles')
      .select('in_business_since_year, weddings_done_approx, experience_verified_at')
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .maybeSingle()
      .then((r) => (r.error ? { data: null } : r));
    const e = exp as
      | { in_business_since_year?: number | null; weddings_done_approx?: number | null; experience_verified_at?: string | null }
      | null;
    const years = yearsInBusiness(e?.in_business_since_year ?? null, new Date().getFullYear());
    const weddings = e?.weddings_done_approx ?? null;
    if (years != null || weddings != null) {
      declaredExp = { years, weddings, verified: !!e?.experience_verified_at };
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
  ] = await Promise.all([
    fetchInclusionsByService(admin, activeServiceIds),
    fetchDiscountsByServicePublic(admin, activeServiceIds),
    fetchCoveragesByIdPublic(admin, coverageIds),
    // Fail-soft by contract (falls back to the hardcoded roster on error).
    getEventTypeVocab(),
    resolveServiceShowcaseMedia(activeServices),
  ]);

  // Pre-format the per-service "Serves" line server-side so the client gallery
  // stays a dumb view (same contract as inclusions/discount labels).
  const eventTypeLabelByKey = new Map(eventTypeVocab.map((t) => [t.key, t.label]));
  const servesByService = new Map<string, string>();
  for (const s of activeServices) {
    if (s.coverage_id === null) continue;
    const line = buildServesLine(coveragesById.get(s.coverage_id), eventTypeLabelByKey);
    if (line) servesByService.set(s.vendor_service_id, line);
  }

  // Linked services per anchor service (owner-locked 2026-06-12 "multi-service
  // inquiry mapping") — the price-included "comes with" set shown as read-only
  // ✓-included chips in the inquiry composer. Best-effort: a missing table /
  // unapplied migration leaves the map empty (composer just omits the chips).
  const linkedByService = new Map<string, string[]>();
  if (activeServices.length > 0) {
    const { data: serviceLinks } = await admin
      .from('vendor_service_links')
      .select('vendor_service_id, linked_canonical_service, linked_label, display_order')
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .order('display_order', { ascending: true });
    for (const link of serviceLinks ?? []) {
      const anchor = (link as { vendor_service_id?: string }).vendor_service_id;
      const canonical =
        (link as { linked_canonical_service?: string | null }).linked_canonical_service ?? null;
      const explicitLabel =
        (link as { linked_label?: string | null }).linked_label ?? null;
      if (!anchor || !canonical) continue;
      const label =
        explicitLabel?.trim() ||
        (isCanonicalService(canonical) ? displayServiceLabel(canonical) : canonical);
      const bucket = linkedByService.get(anchor);
      if (bucket) bucket.push(label);
      else linkedByService.set(anchor, [label]);
    }
  }

  // Build the inquiry-composer model — the FIRST active service is the
  // 'initial' pick; the rest are opt-in "also ask about" options
  // (source='couple_added'). Whether to SHOW it also depends on coupleEventId,
  // resolved further below (after the viewer's events load).
  const serviceLabel = (s: VendorServiceRow): string =>
    (s.title?.trim() ||
      (isCanonicalService(s.category)
        ? VENDOR_CATEGORY_LABEL[s.category as VendorCategory]
        : s.category)) as string;
  const servicePriceLabel = (s: VendorServiceRow): string =>
    !hidePricesPublicly && s.starting_price_php !== null && s.starting_price_php > 0
      ? `from ${formatPhp(s.starting_price_php)}`
      : 'Inquire';
  const composerInitial = activeServices[0] ?? null;
  const composerAlso: InquiryComposerService[] = activeServices.slice(1).map((s) => ({
    vendorServiceId: s.vendor_service_id,
    label: serviceLabel(s),
    priceLabel: servicePriceLabel(s),
  }));

  // Per-category attribute details + portfolio gallery (iteration 0044).
  const [attributeDetails, portfolioUrls, microsite, igMedia] = await Promise.all([
    fetchVendorAttributeDetails(admin, vendor.vendor_profile_id),
    resolvePortfolioUrls(vendor.portfolio_r2_keys),
    // Microsite curation (My Shop → Website editor). Defensive read — an
    // un-curated vendor / not-yet-applied migration degrades to the
    // auto-composed baseline.
    fetchVendorMicrosite(admin, vendor.vendor_profile_id),
    // Synced Instagram posts the vendor chose to show. Best-effort: degrades to
    // [] on any error (pre-migration DB / no connection), so the portfolio never
    // breaks. Feature is inert until Meta is configured — until then this is [].
    fetchVendorIgMediaForPublic(vendor.vendor_profile_id),
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
  const viewerTierCaps = tierCaps(vendor.tier_state ?? null);
  const premiumLayout = viewerTierCaps.customWebsiteName;
  const canPersonalizePage = micrositeCan(vendor.tier_state ?? null).canPersonalize;
  // Section toggles are a Solo control → below Solo, ignore the saved hide/show
  // set and fall back to defaults (all baseline sections visible).
  const pageSections = canPersonalizePage ? microsite.sections : {};

  const showPortfolio = isSectionVisible(pageSections, 'portfolio');
  const showTrustedBy = isSectionVisible(pageSections, 'trusted_by');
  const orderedServices = orderFeaturedFirst(
    vendor.services,
    canPersonalizePage ? microsite.featuredServiceIds : [],
  );
  // Pro hero override — a chosen portfolio photo leads the page as a banner.
  const heroPhotoUrl =
    premiumLayout && microsite.heroPhotoKey
      ? (await resolvePortfolioUrls([microsite.heroPhotoKey]))[0] ?? null
      : null;
  // Solo accent — retint the microsite's accent ramp (undefined = default).
  const accentVars = canPersonalizePage
    ? micrositeAccentVars(microsite.accent)
    : undefined;
  // Pro pinned review — float the chosen review to the top of the loaded set.
  // Best-effort: if it's older than the loaded window it simply isn't surfaced
  // (no extra fetch); a stale/foreign id no-ops.
  const orderedReviews =
    premiumLayout && microsite.pinnedReviewId
      ? [
          ...reviews.filter((r) => r.review_id === microsite.pinnedReviewId),
          ...reviews.filter((r) => r.review_id !== microsite.pinnedReviewId),
        ]
      : reviews;

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
      const bookings = await fetchVendorPoolBookings(admin, vendor.vendor_profile_id);
      const stories = await loadVendorFeaturedStories(bookings.map((b) => b.eventId));
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
     once at the page level so the hero, "Get in touch" copy,
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
  // Flagship cinematic layer: Enterprise-or-higher (Custom runs as Enterprise).
  // Reuses micrositeCan's website-ladder rank (isEnterprise = rank ≥ 3) so the
  // Custom tier inherits the flagship hero + films rack without a hard equality.
  const isEnterprise = micrositeCan(vendor.tier_state ?? null).isEnterprise;
  const cinematicHero = isEnterprise && Boolean(heroPhotoUrl);
  // Featured videos — ONE unified, all-tier video set (owner 2026-07-05: single
  // video system). The retired Enterprise-only "Films" rack (microsite_video_ids)
  // was folded into gallery_video_links (data migration
  // 20270519000000_merge_microsite_videos_into_gallery), so every video now
  // renders here. Each pasted link is classified: YouTube / Vimeo → inline 16:9
  // iframes; Instagram / Facebook / TikTok / other → link-out cards. Unparseable
  // entries are dropped.
  const featuredVideos = (vendor.gallery_video_links ?? [])
    .map((url) => parseVideoLink(url))
    .filter((v): v is NonNullable<ReturnType<typeof parseVideoLink>> => v !== null);
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
    // Phase C: Pro/Enterprise reveal the real business_name day-1.
    isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
  });

  // Resolve viewer state for the FollowGate (iteration 0019 § Gate). Public
  // page so the supabase client may have no user; that's fine — the gate
  // renders a "Sign in to follow" CTA in that case.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let coupleEventId: string | null = null;
  /** The couple's intended event date (ISO YYYY-MM-DD) — drives the Booked-Out
   *  Waitlist CTA when the vendor is unavailable on it. */
  let coupleEventDate: string | null = null;
  /** Existing chat thread for this (coupleEvent, vendor) pair — non-null when
   *  the couple already sent an inquiry (any status except declined). Passed
   *  to the InquiryComposer so it can surface "View thread" instead of opening
   *  a new modal on re-visit. */
  let existingThreadId: string | null = null;
  if (user) {
    const events = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = events[0]?.event_id ?? null;
    coupleEventDate = events[0]?.event_date ?? null;
    if (coupleEventId) {
      const threadResult = await supabase
        .from('chat_threads')
        .select('thread_id, inquiry_status')
        .eq('event_id', coupleEventId)
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .maybeSingle();
      // Only surface "View thread" for non-declined threads — a declined
      // thread has no active conversation to resume.
      const t = threadResult.data as
        | { thread_id: string; inquiry_status: string }
        | null;
      if (t?.thread_id && t.inquiry_status !== 'declined') {
        existingThreadId = t.thread_id;
      }
    }
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

  // Inquiry composer (owner-locked 2026-06-12 "multi-service inquiry mapping") —
  // shown only for a signed-in couple with an active event viewing a bookable
  // vendor that has ≥1 active service.
  const showInquiryComposer =
    bookable && coupleEventId !== null && composerInitial !== null;

  // Compose-first Inquire (owner 2026-07-02) — a bookable vendor with ≥1 service
  // viewed by someone WITHOUT an event yet (signed-out, or signed-in with no
  // event). They compose here, then convert (signup + onboarding) and the
  // dashboard dispatcher replays the inquiry. Same guards as showInquiryComposer
  // minus the coupleEventId requirement.
  const anonComposerServices: AnonComposerService[] =
    bookable && coupleEventId === null && composerInitial !== null
      ? activeServices.map((s) => ({
          vendorServiceId: s.vendor_service_id,
          label: serviceLabel(s),
          priceLabel: servicePriceLabel(s),
          categoryKey: s.category,
        }))
      : [];
  // Signed-in (non-anonymous) but eventless → skip signup, go straight to
  // onboarding. Signed-out / anonymous → route through signup for a real account.
  const signedInNoEvent =
    user !== null && !(user.is_anonymous ?? false) && coupleEventId === null;

  // Pre-quote blindside #2 (Adaptive Pax Pricing Phase 3): startServiceInquiry
  // silently snapshots this live pax onto chat_threads.pax_at_inquiry, but the
  // couple never saw it — a stale estimate could reach the vendor. Resolve it
  // here (only when the composer shows) so the composer can surface a read-only
  // "Headcount for this inquiry: N" pill with an Edit link. Fail-soft: null →
  // the pill simply doesn't render (mirrors the action's `livePax != null` gate).
  const inquiryLivePax =
    showInquiryComposer && coupleEventId
      ? await resolveLivePax(supabase, coupleEventId)
      : null;

  // Phase 1b PR-3 · per-category requirements capture. The initial pick's
  // category IS the canonical_service (vendor_services.category ≈ 1:1 with
  // canonical_service_schemas). Load the leaf's multi_select facets (checkbox
  // groups) + the couple's previously saved template for THIS (event, category)
  // so the pop-up pre-fills. Both fail-soft to empty/null — the pop-up still
  // shows the special-request box and the inquiry still sends. Only the
  // multi_select facets are surfaced (couple-facing requirements), so a leaf
  // with no facet schema simply shows the note box. admin client reads the
  // public schema; the host-scoped client reads the couple's own pref row.
  const requirementCategoryKey =
    showInquiryComposer && composerInitial ? composerInitial.category : null;
  const [requirementsFields, savedRequirements]: [
    RequirementField[],
    SavedRequirements | null,
  ] = requirementCategoryKey && coupleEventId
    ? await Promise.all([
        fetchRequirementFields(admin, requirementCategoryKey),
        getEventPreference(supabase, coupleEventId, requirementCategoryKey).then((p) =>
          p
            ? {
                payload: Object.fromEntries(
                  Object.entries(p.attribute_payload ?? {})
                    .filter(([, v]) => Array.isArray(v))
                    .map(([k, v]) => [k, (v as unknown[]).filter((x): x is string => typeof x === 'string')]),
                ),
                specialRequest: p.special_request ?? '',
                autoSend: p.auto_send ?? false,
              }
            : null,
        ),
      ])
    : [[], null];
  const requirementCategoryLabel = requirementCategoryKey
    ? isCanonicalService(requirementCategoryKey)
      ? displayServiceLabel(requirementCategoryKey)
      : requirementCategoryKey
    : null;

  // Phase 1b PR-5 · AI-gated auto carry-forward. Resolve whether Setnayan AI is
  // active for THIS couple's event so the composer can SKIP the pop-up and
  // auto-send the saved requirements when (AI ON + saved row + auto_send=true).
  // Auto carry-forward is the Setnayan AI value (owner-locked free-vs-AI
  // boundary); the FREE tier keeps save-template + manual pre-fill (PR-3/PR-4).
  // Focused, fail-soft select — `fetchUserEvents` is a shared React-cached query
  // that doesn't carry the gate columns, so we read them directly here keyed by
  // the resolved coupleEventId. A missing column / error → aiActive=false → the
  // pop-up shows (the conservative, unchanged behavior). Only worth the round
  // trip when the composer will actually render for a signed-in couple.
  let aiActive = false;
  if (showInquiryComposer && coupleEventId) {
    const { data: aiEventRow } = await supabase
      .from('events')
      .select('planning_mode, setnayan_ai_active')
      .eq('event_id', coupleEventId)
      .maybeSingle();
    const aiPaywallEnabled = await resolveSetnayanAiPaywallEnabled();
    const aiPerUserEnabled = await resolveSetnayanAiPerUserEnabled();
    // Resolve via the admin client + the event id in scope — the public page has
    // no session, so the host's subscription window can only be read with the
    // service-role client (RLS-bypassed).
    const aiSubscription = aiPerUserEnabled
      ? await getEventHostAiSubscription(admin, coupleEventId)
      : null;
    aiActive = isSetnayanAiActiveForUser(
      aiEventRow as { planning_mode?: string | null; setnayan_ai_active?: boolean | null } | null,
      {
        paywallEnabled: aiPaywallEnabled,
        perUserEnabled: aiPerUserEnabled,
        subscription: aiSubscription,
      },
    );
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
    const { data: covering } = await admin
      .from('vendor_calendar_blocks')
      .select('block_id')
      .eq('vendor_profile_id', vendor.vendor_profile_id)
      .is('pool_id', null)
      .in('block_source', ['manual', 'setnayan_booking'])
      .lte('blocked_at', dayEnd)
      .gte('blocked_until', dayStart)
      .limit(1);
    const isUnavailable = Array.isArray(covering) && covering.length > 0;
    if (isUnavailable) {
      waitlistDate = coupleEventDate;
      // Owner 2026-07: only offer the waitlist when the vendor switched it on;
      // otherwise the date is simply "unavailable" (no CTA).
      const { data: wlp } = await admin
        .from('vendor_profiles')
        .select('waitlist_enabled')
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .maybeSingle();
      waitlistEnabled = Boolean(
        (wlp as { waitlist_enabled?: boolean } | null)?.waitlist_enabled,
      );
      // Has this couple already joined (pending/notified)?
      const { data: existing } = await admin
        .from('vendor_date_waitlist')
        .select('waitlist_id')
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .eq('user_id', user.id)
        .eq('requested_date', coupleEventDate)
        .in('status', ['pending', 'notified'])
        .limit(1);
      alreadyWaitlisted = Array.isArray(existing) && existing.length > 0;
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
    image: vendor.logo_url ?? `${SITE_URL}/icon-512.svg`,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PH',
      ...(vendor.location_city ? { addressLocality: vendor.location_city } : {}),
    },
    areaServed: { '@type': 'Country', name: 'Philippines' },
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
  if (Array.isArray(vendor.services) && vendor.services.length > 0) {
    vendorJsonLd.knowsAbout = vendor.services.map((s: string) =>
      isCanonicalService(s) ? displayServiceLabel(s) : s,
    );
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
  const offerPackages = hidePricesPublicly
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
  if (Array.isArray(vendor.services) && vendor.services.length > 0) {
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
          name: isCanonicalService(s) ? displayServiceLabel(s) : s,
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
        name: 'Wedding vendors',
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
  // entry point (deferred — see PR notes).
  if (!isDemoVendor) {
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
    after(() =>
      recordVendorProfileView({
        vendorProfileId: viewVendorProfileId,
        source: viewSource,
        utm: utmParam,
        eventId: viewEventId,
      }),
    );
  }

  return (
    <main className="min-h-dvh bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vendorJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* v2.1 visual treatment per CLAUDE-CODE-BRIEF-v2.1 § 8 design
              system. Wordmark from @/app/_components/brand-marks is the
              canonical brand mark across /, /vendors, /login, /signup,
              /vendors, and all dashboard chromes after V2 cutover Phase B
              (PRs #560-#564 + #572-#580). Matches the marketplace overlay
              pattern from PR #580. */}
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Return to Dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Plan with Setnayan
            </Link>
          )}
        </div>
      </header>

      <article
        className={`mx-auto w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 ${
          /* Pro/Enterprise maximize the screen width (owner 2026-07-03); Free/Solo
             stay at a comfortable single-column reading width. */
          premiumLayout ? 'max-w-screen-2xl' : 'max-w-3xl'
        }`}
        /* Pro accent (My Shop → Website) retints the accent ramp for THIS
           vendor's content only — scoped to the article so the Setnayan header
           chrome above keeps the site accent. undefined = default champagne. */
        style={accentVars as React.CSSProperties | undefined}
      >
        {isDemoVendor ? <DemoVendorBanner /> : null}
        {/* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30): pass the
            resolved display label so the ComingSoon banner copy + Logo
            initial fallback + alt text all surface the safe placeholder
            while the vendor's name is hidden. */}
        {isComingSoon ? <ComingSoonBanner vendorName={displayLabel} /> : null}
        {/* Hero banner. A Pro vendor's chosen hero photo (My Shop → Website)
            leads the page; otherwise, a vendor with NO portfolio still shows a
            generic placeholder so the page never looks empty (owner directive).
            Vendors with portfolio photos but no chosen hero show them in the
            gallery below (no banner needed). */}
        {cinematicHero && heroPhotoUrl ? (
          /* Enterprise flagship — full cinematic hero with the name overlaid. */
          <div className="relative mb-8 h-80 w-full overflow-hidden rounded-2xl bg-ink sm:h-[26rem]">
            <Image
              src={heroPhotoUrl}
              alt={displayLabel}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              {heroKicker ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cream/80">
                  {heroKicker}
                </p>
              ) : null}
              <h1 className="mt-3 font-serif text-4xl font-normal italic tracking-[-0.02em] text-cream sm:text-6xl">
                {displayLabel}
              </h1>
              {vendor.tagline ? (
                <p className="mt-2 max-w-xl text-base text-cream/85">{vendor.tagline}</p>
              ) : null}
              {bookable ? (
                <a
                  href="#get-in-touch"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cream px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-white"
                >
                  <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Inquire Now
                </a>
              ) : null}
            </div>
          </div>
        ) : heroPhotoUrl ? (
          <div className="relative mb-6 h-44 w-full overflow-hidden rounded-2xl bg-ink/5 sm:h-56 lg:h-64">
            <Image
              src={heroPhotoUrl}
              alt={displayLabel}
              fill
              sizes="(max-width: 1024px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ) : portfolioUrls.length === 0 ? (
          <div className="relative mb-6 h-44 w-full overflow-hidden rounded-2xl bg-ink/5 sm:h-56 lg:h-64">
            <Image
              src={VENDOR_PLACEHOLDER_PHOTO}
              alt={displayLabel}
              fill
              sizes="(max-width: 1024px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ) : null}
        {/* Premium 2-column (Pro/Enterprise): story content left, a sticky
            Inquire rail right. Free/Solo get the clean single column (no grid,
            no rail). Collapses to one column on mobile for every tier. */}
        <div
          className={
            premiumLayout
              ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10'
              : ''
          }
        >
          <div className="min-w-0">
        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row">
          <Logo logoUrl={vendor.logo_url} name={displayLabel} />
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
            {cinematicHero ? null : (
              <>
                <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl">
                  {displayLabel}
                </h1>
                {vendor.tagline ? (
                  <p className="text-base text-ink/70">{vendor.tagline}</p>
                ) : null}
              </>
            )}
            {/* Experience tier badge (Vendor_Quality_Rating_System §5) — a
                subtle violet chip stating how many finalized bookings flowed
                through Setnayan. The profile keeps the honest "New to Setnayan"
                tier (unlike the dense explore card, which suppresses it). Same
                violet tokens as the explore card's experience chip so the badge
                reads identically across surfaces. */}
            <p
              className="inline-flex w-fit items-center gap-1 rounded-full border border-violet-300/50 bg-violet-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-900"
              title={
                finalizedBookingCount && finalizedBookingCount > 0
                  ? `${finalizedBookingCount} finalized event${finalizedBookingCount === 1 ? '' : 's'} through Setnayan.`
                  : 'New to Setnayan — many excellent vendors are.'
              }
            >
              {expTier.longLabel}
            </p>
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
              <p
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-0.5 text-[11px] text-ink/70"
                title={`${formatStarRating(trustedReviewStats.trusted_avg_rating)} average from ${trustedReviewStats.trusted_review_count} review${trustedReviewStats.trusted_review_count === 1 ? '' : 's'} by couples who booked via Setnayan.`}
              >
                <Star aria-hidden className="h-3.5 w-3.5 fill-warn-400 text-warn-500" strokeWidth={1.75} />
                <span className="font-medium text-ink">
                  {formatStarRating(trustedReviewStats.trusted_avg_rating)}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {trustedReviewStats.trusted_review_count} review{trustedReviewStats.trusted_review_count === 1 ? '' : 's'}
                </span>
              </p>
            ) : null}
            {/* Favorites chip (owner 2026-07-02: favorites public / viewers
                vendor-only) — distinct couples who follow or saved this vendor,
                min-N floored (FAVORITES_MIN_DISPLAY) so a tiny count never shows.
                Hidden below the floor — honest empty state (founder-only market
                → usually hidden until saves accrue). */}
            {favoritesCount >= FAVORITES_MIN_DISPLAY ? (
              <p
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-0.5 text-[11px] text-ink/70"
                title={`Saved by ${favoritesCount} couples on Setnayan.`}
              >
                <Heart aria-hidden className="h-3.5 w-3.5 fill-mulberry/70 text-mulberry" strokeWidth={1.75} />
                <span className="font-medium text-ink">{favoritesCount}</span>
                <span>saved</span>
              </p>
            ) : null}
            {declaredExp ? (
              <p
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-0.5 text-[11px] text-ink/70"
                title={
                  declaredExp.verified
                    ? 'Years in business verified against the vendor’s DTI registration.'
                    : 'Self-reported by the vendor.'
                }
              >
                {declaredExp.years != null ? <span className="font-medium text-ink">{declaredExp.years} yrs in business</span> : null}
                {declaredExp.years != null && declaredExp.weddings != null ? <span aria-hidden>·</span> : null}
                {declaredExp.weddings != null ? <span>{declaredExp.weddings}+ weddings</span> : null}
                {declaredExp.verified ? (
                  <BadgeCheck aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
                ) : (
                  <span className="text-ink/40">· self-reported</span>
                )}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              {vendor.location_city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.location_city}
                </span>
              ) : null}
              {/* Contact links surface only for verified (bookable) vendors —
                  coming-soon profiles are read-only previews per 0022 § 2.1c. */}
              {bookable && vendor.contact_email ? (
                <a
                  href={`mailto:${vendor.contact_email}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_email}
                </a>
              ) : null}
              {bookable && vendor.contact_phone ? (
                <a
                  href={`tel:${vendor.contact_phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Phone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_phone}
                </a>
              ) : null}
              {vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Website
                </a>
              ) : null}
            </div>
            {/* Primary actions (2026-07-02): Inquire Now (scrolls to the
                composer) + Share. Retires the old Follow / Save-to-picks row.
                On desktop the sticky Inquire rail carries these too. */}
            {bookable ? (
              <div
                className={`flex flex-wrap items-center gap-2 pt-4 ${
                  premiumLayout ? 'lg:hidden' : ''
                }`}
              >
                <a href="#get-in-touch" className="button-primary inline-flex items-center gap-2">
                  <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Inquire Now
                </a>
                <ShareButton title={displayLabel} className="button-secondary inline-flex items-center gap-2" />
                {canShowBooth ? (
                  <Link
                    href={`/v/${vendor.business_slug ?? slug}/booth`}
                    className="button-secondary inline-flex items-center gap-2"
                  >
                    Walk into my booth
                  </Link>
                ) : null}
              </div>
            ) : null}
            {/* Visual map (2026-06-28). The picture-of-the-map above the
                directions chips — OSM embed with a marker pin, key-free.
                Renders only when coordinates exist; label uses location_city
                so a hidden vendor's business name never leaks. */}
            <VendorLocationMap
              latitude={vendor.hq_latitude}
              longitude={vendor.hq_longitude}
              label={vendor.location_city ?? null}
            />
            {/* Nav deep-links (2026-05-21). Renders Google Maps · Waze ·
                Apple Maps when the vendor has hq_lat/lng. Falls back to
                a single Google Maps text-search when only the address
                is set. Hidden entirely when neither exists. */}
            <NavLinksRow
              latitude={vendor.hq_latitude}
              longitude={vendor.hq_longitude}
              addressFallback={vendor.hq_address ?? vendor.location_city ?? null}
            />
          </div>
        </section>

        {/* About — the vendor's own intro (My Shop → Website editor). Optional
            override; hidden when unset so the page keeps its auto-composed
            baseline. Solo+ only — reverts to baseline on downgrade (data kept). */}
        {canPersonalizePage && microsite.about ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              About
            </h2>
            <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink/75">
              {microsite.about}
            </p>
          </section>
        ) : null}

        {/* Portfolio — ONE unified gallery of the vendor's photos + their own
            pasted video links (all tiers). Photos lead, then videos: YouTube &
            Vimeo mount as responsive inline 16:9 players; Instagram / Facebook /
            TikTok / other links render as click-through cards. Unparseable video
            entries are dropped upstream. Governed by the vendor's Portfolio
            visibility toggle; auto-hidden when there's nothing to show. */}
        {showPortfolio &&
        (portfolioUrls.length > 0 ||
          featuredVideos.length > 0 ||
          igMedia.length > 0) ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Portfolio
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {portfolioUrls.map((url, idx) => (
                <div
                  key={url}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
                >
                  <Image
                    src={url}
                    alt={`${displayLabel} portfolio ${idx + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
              {featuredVideos.map((v, idx) =>
                v.kind === 'iframe' && v.embedUrl ? (
                  // Inline player spans two grid columns so its 16:9 frame reads
                  // as the signature "watch this" moment amid the photo tiles.
                  <div
                    key={`${v.originalUrl}-${idx}`}
                    className="relative col-span-2 aspect-video overflow-hidden rounded-xl bg-ink/5"
                  >
                    <iframe
                      src={v.embedUrl}
                      title={`${displayLabel} — ${v.label} video ${idx + 1}`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                ) : (
                  // Link-out platforms (IG / FB / TikTok / other) get a play-badge
                  // card sized like a photo tile so the grid stays even.
                  <a
                    key={`${v.originalUrl}-${idx}`}
                    href={v.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl border border-ink/10 bg-cream/50 p-4 transition-colors hover:border-terracotta/40"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink/70 transition-colors group-hover:bg-terracotta/10 group-hover:text-terracotta">
                      <PlatformIcon platform={v.platform} />
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        Watch on {v.label}
                      </span>
                      <ArrowRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-ink/40 transition-colors group-hover:text-terracotta"
                        strokeWidth={2}
                      />
                    </span>
                  </a>
                ),
              )}
              {/* Synced Instagram posts (show_on_profile) — images re-hosted in
                  R2 render as photo tiles; videos link out to the IG permalink
                  with a play badge, sized like a photo tile so the grid stays
                  even. Entries without a resolvable URL are dropped. */}
              {igMedia.map((m, idx) =>
                m.mediaType === 'VIDEO' ? (
                  <a
                    key={`ig-${m.id}`}
                    href={m.permalink ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
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
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors group-hover:bg-black/70">
                        <Play aria-hidden className="h-5 w-5" strokeWidth={2} />
                      </span>
                    </span>
                  </a>
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
          <section className="space-y-4 border-b border-ink/10 py-8">
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
                      {story.coupleNames}
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
              Wedding compatibility
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

        {activeServices.length > 0 ? (
          /* Hybrid-anonymity (V2.1 amendment #2): pass displayLabel so
             the services section's section heading + per-service
             cards' "by {vendor}" copy don't leak the hidden name. */
          <ServicesPricingSection
            services={activeServices}
            businessName={displayLabel}
            inclusionsByService={inclusionsByService}
            discountsByService={discountsByService}
            servesByService={servesByService}
            showcaseByService={showcaseByService}
            hidePrices={hidePricesPublicly}
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
            isComingSoon={isComingSoon}
            hidePrices={hidePricesPublicly}
          />
        ) : null}

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
          hasMore={hasMore}
          nextPage={reviewsPage + 1}
          /* Phase C review-display gate (vendor-tier-caps · surface layer).
             showStars: Free hides the star average + per-review star rows.
             showComments: Free + Verified hide review bodies + axis stats +
             vendor replies (Pro/Enterprise show them). Gated here, NOT in the
             review libs, so the vendor dashboard self-view stays ungated. */
          showStars={viewerTierCaps.reviewStarsCounted}
          showComments={viewerTierCaps.reviewCommentsViewable}
          recommendingCouples={recommendingCouples}
          completedEvents={completedEvents}
          venueEvents={venueEvents}
          hasVenueMatch={venueMatchCount > 0}
        />

        {showTrustedBy ? (
          <TrustedBySection vendors={trustedBy} businessName={displayLabel} />
        ) : null}

        <section id="get-in-touch" className="scroll-mt-24 space-y-4 py-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {bookable ? 'Get in touch' : 'Not yet bookable'}
          </h2>
          <p className="max-w-2xl text-sm text-ink/65">
            {/* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30):
                "Get in touch" copy uses displayLabel so a hidden
                vendor surfaces as e.g. "Manila Wedding Photographer"
                instead of leaking the real name through the
                contact-info section. */}
            {bookable ? (
              vendor.contact_email ? (
                showInquiryComposer || anonComposerServices.length > 0 ? (
                  // A composer renders below — don't send them to a "dashboard"
                  // an eventless visitor doesn't have (the contradiction the
                  // review flagged). Speak to the composer instead.
                  <>
                    Send{' '}
                    <span className="font-medium text-ink">{displayLabel}</span> an
                    inquiry below — they&rsquo;ll reply in your Setnayan inbox.
                    Identity stays masked until you choose to share.
                  </>
                ) : (
                  <>
                    Already a Setnayan couple? Start a thread directly with{' '}
                    <span className="font-medium text-ink">{displayLabel}</span> from
                    your dashboard using the contact email above. Identity stays masked
                    until you choose to share.
                  </>
                )
              ) : (
                <>
                  {displayLabel} is on Setnayan but hasn&rsquo;t published a contact
                  email yet. Check back soon.
                </>
              )
            ) : (
              <>
                <span className="font-medium text-ink">{displayLabel}</span> has set
                up their Setnayan profile but is still completing verification. Bookings
                will open as soon as the Setnayan Team finishes their review.
              </>
            )}
          </p>
          {showInquiryComposer && composerInitial ? (
            <InquiryComposer
              vendorProfileId={vendor.vendor_profile_id}
              vendorLabel={displayLabel}
              initial={{
                vendorServiceId: composerInitial.vendor_service_id,
                label: serviceLabel(composerInitial),
                priceLabel: servicePriceLabel(composerInitial),
                categoryKey: composerInitial.category,
              }}
              linked={(linkedByService.get(composerInitial.vendor_service_id) ?? []).map(
                (label) => ({ label }),
              )}
              alsoOptions={composerAlso}
              // Phase 1b PR-3 — per-category requirements capture (core/FREE).
              requirementsFields={requirementsFields}
              savedRequirements={savedRequirements}
              categoryLabel={requirementCategoryLabel}
              // Phase 1b PR-5 — auto carry-forward gate (Setnayan AI value).
              // When AI is ON and the saved row has auto_send=true, the
              // composer skips the pop-up and sends the saved requirements
              // directly. False → unchanged pop-up flow.
              aiActive={aiActive}
              // The exact count startServiceInquiry will snapshot onto this
              // inquiry — surfaced read-only so the couple can fix a stale
              // estimate before it reaches the vendor.
              inquiryPax={inquiryLivePax}
              guestEditHref={
                coupleEventId ? `/dashboard/${coupleEventId}/guests` : null
              }
              // Existing-thread detection: non-null when the couple already
              // has a pending/accepted thread with this vendor. The composer
              // shows "View thread" instead of opening the inquiry modal.
              existingThreadId={existingThreadId}
              existingThreadHref={
                existingThreadId && coupleEventId
                  ? `/dashboard/${coupleEventId}/messages/${existingThreadId}`
                  : null
              }
              // Anon-draft: an anonymous viewer (finished onboarding without an
              // account) gets the "save your plan" prompt up front instead of
              // bouncing on the server `not_secured` guard. Secured users and
              // signed-out visitors are unaffected.
              viewerIsAnonymous={user?.is_anonymous ?? false}
              // Creator Economy PR-C/PR-D — provenance carried from the arrival
              // URL: ?ref_chapter=… (a chapter's Book CTA; server-validated
              // before stamping 'influencer' attribution) and ?src=… (a
              // caller-declared, enum-validated origin: 'editorial' from a
              // /realstories credit chip → 'Editorial Inquiry', 'favorites' from
              // a saved-vendors "Contact" link → 'Favorites'). Absent both, the
              // inquiry stays the NULL/'website' default. startServiceInquiry
              // re-validates the source server-side, so an unknown ?src is inert.
              referringChapterPublicId={
                typeof search.ref_chapter === 'string' && search.ref_chapter
                  ? search.ref_chapter
                  : null
              }
              inquirySource={
                search.src === 'editorial'
                  ? 'editorial'
                  : search.src === 'favorites'
                    ? 'favorites'
                    : null
              }
            />
          ) : null}

          {/* Compose-first Inquire (owner 2026-07-02) — for a visitor without an
              event yet: they write the inquiry now, then convert (signup + event
              onboarding) and the dashboard dispatcher sends it. Replaces the old
              "from your dashboard" dead-end for eventless viewers. */}
          {anonComposerServices.length > 0 ? (
            <AnonInquiryComposer
              vendorProfileId={vendor.vendor_profile_id}
              vendorSlug={vendor.business_slug ?? slug}
              vendorLabel={displayLabel}
              services={anonComposerServices}
              signedInNoEvent={signedInNoEvent}
            />
          ) : null}

          {/* Booked-Out Waitlist CTA — shown only when this couple's intended
              date is unavailable on this vendor (Wave 4 vendor benefit). The
              couple joins; when the date frees up the vendor notifies them by
              email. Additive + privacy-respecting: the couple sees "unavailable",
              never the reason. */}
          {waitlistDate ? (
            <div className="mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-4 sm:p-5">
              <p className="text-sm font-semibold text-ink">
                {displayLabel} is booked on{' '}
                {new Date(`${waitlistDate}T00:00:00+08:00`).toLocaleDateString('en-PH', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                .
              </p>
              {!waitlistEnabled ? (
                <p className="mt-1 text-sm text-ink/70">This date is unavailable.</p>
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
                    <SubmitButton
                      pendingLabel="Joining…"
                      className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
                    >
                      Join the waitlist for this date
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="button-primary">
              Plan with Setnayan
            </Link>
            <Link href="/" className="button-secondary">
              Back to home
            </Link>
          </div>
        </section>
          </div>

          {/* Sticky Inquire rail — Pro/Enterprise, desktop only. Rating + the
              primary Inquire Now / Share CTAs + at-a-glance, following the
              scroll. (Free/Solo use the inline Inquire actions above.) */}
          {premiumLayout && bookable ? (
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4 rounded-2xl border border-ink/10 bg-cream/50 p-5">
                {/* ANTI-FRAUD (2026-07-05): sticky rail rating reads TRUSTED stat. */}
                {viewerTierCaps.reviewStarsCounted &&
                trustedReviewStats.trusted_review_count > 0 &&
                trustedReviewStats.trusted_avg_rating > 0 ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-ink">
                      {formatStarRating(trustedReviewStats.trusted_avg_rating)}
                    </span>
                    <Star aria-hidden className="h-4 w-4 fill-warn-400 text-warn-500" strokeWidth={1.75} />
                    <span className="text-sm text-ink/60">
                      {trustedReviewStats.trusted_review_count} review{trustedReviewStats.trusted_review_count === 1 ? '' : 's'}
                    </span>
                  </div>
                ) : null}

                <a
                  href="#get-in-touch"
                  className="button-primary flex w-full items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Inquire Now
                </a>
                <ShareButton
                  title={displayLabel}
                  className="button-secondary flex w-full items-center justify-center gap-2"
                />
                <p className="text-center text-xs text-ink/50">
                  Starts a masked chat in your Setnayan inbox.
                </p>

                <dl className="space-y-2 border-t border-ink/10 pt-3 text-sm text-ink/70">
                  {vendor.location_city ? (
                    <div className="flex items-center gap-2">
                      <MapPin aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
                      <dd>{vendor.location_city}</dd>
                    </div>
                  ) : null}
                  {finalizedBookingCount && finalizedBookingCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <CalendarCheck aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
                      <dd>
                        {finalizedBookingCount} event{finalizedBookingCount === 1 ? '' : 's'} through
                        Setnayan
                      </dd>
                    </div>
                  ) : null}
                  {declaredExp?.years != null ? (
                    <div className="flex items-center gap-2">
                      <BadgeCheck aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
                      <dd>{declaredExp.years} years in business</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </aside>
          ) : null}
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
            Vendor ID · <span className="font-mono">{vendor.public_id}</span>
          </p>
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
      aria-label="Demo vendor"
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
            Demo vendor
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-warn-900">
            This profile is synthetic — visible only to admins in demo mode.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-warn-900/85">
            Pricing renders publicly here so admins can dogfood how the page
            would feel if the 2026-05-16 hide-prices lock were lifted. Real
            vendors stay private to the apply/register flow.
          </p>
        </div>
      </div>
    </section>
  );
}

function Logo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        <Image
          src={logoUrl}
          alt={name}
          width={96}
          height={96}
          className="h-full w-full object-cover"
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

function ServicesPricingSection({
  services,
  businessName,
  inclusionsByService,
  discountsByService,
  servesByService,
  showcaseByService,
  hidePrices,
}: {
  services: ReadonlyArray<VendorServiceRow>;
  businessName: string;
  inclusionsByService: Map<string, VendorServiceInclusion[]>;
  discountsByService: Map<string, VendorServiceDiscount[]>;
  /** Pre-formatted "Serves" line per service id (coverage event types + faiths). */
  servesByService: Map<string, string>;
  /** Resolved showcase display URLs per service id (photos ≤5 + optional clip). */
  showcaseByService: Map<string, ServiceShowcaseMedia>;
  /** Council #6: vendor opted to hide public prices → strip every peso amount. */
  hidePrices: boolean;
}) {
  const byGroup = new Map<ServiceGroupKey, VendorServiceRow[]>();
  for (const s of services) {
    const key: ServiceGroupKey = isCanonicalService(s.category)
      ? serviceGroupOf(s.category as VendorCategory)
      : 'other';
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(s);
    else byGroup.set(key, [s]);
  }

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
      cards: rows.map((row) =>
        toServiceCard(
          row,
          inclusionsByService.get(row.vendor_service_id),
          discountsByService.get(row.vendor_service_id),
          servesByService.get(row.vendor_service_id),
          showcaseByService.get(row.vendor_service_id),
          hidePrices,
        ),
      ),
    });
  }

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
      <ServicesGallery groups={groups} />
    </section>
  );
}

/** Max inclusions listed before we collapse the rest into "+N more included". */
const SERVICE_CARD_INCLUSION_LIMIT = 3;

/**
 * Format one service row into the serializable card the client gallery renders.
 * Service-card redesign · Phase 4 enriches the card with the best applicable
 * discount, FREE inclusions (with their stated worth), and "not included"
 * expectation flags so couples see the value + the caveats before quoting.
 */
function toServiceCard(
  row: VendorServiceRow,
  inclusions: VendorServiceInclusion[] | undefined,
  discounts: VendorServiceDiscount[] | undefined,
  serves: string | undefined,
  showcase: ServiceShowcaseMedia | undefined,
  /** Council #6: when true the vendor opted to hide public prices — every peso
   *  amount below is suppressed (labels/inclusions still show; only figures go). */
  hidePrices: boolean,
): ServiceCard {
  const label = isCanonicalService(row.category)
    ? VENDOR_CATEGORY_LABEL[row.category as VendorCategory]
    : row.category;
  const priceLabel =
    !hidePrices && row.starting_price_php !== null && row.starting_price_php > 0
      ? `from ${formatPhp(row.starting_price_php)}`
      : 'Inquire';

  // Pricing-basis detail — HOW the "from ₱X" anchor is computed. Per-pax shows
  // the per-guest rate (+ the min floor when set); per-hour shows the base
  // block (+ the extra-hour rate when set). Fixed = nothing extra to explain
  // (the pax brackets stay a vendor-side quoting tool in V1). The anchor line
  // above is untouched.
  const isCrewMeals = row.category === 'crew_meals';
  const perPaxUnit = isCrewMeals ? 'meal' : 'guest';
  let priceDetail: string | null = null;
  if (hidePrices) {
    // Vendor hid prices — no per-pax/per-hour rate breakdown.
    priceDetail = null;
  } else if (
    row.pricing_basis === 'per_pax' &&
    row.per_pax_price_php !== null &&
    row.per_pax_price_php > 0
  ) {
    const minPart =
      row.min_pax !== null && row.min_pax > 0 ? ` · min ${row.min_pax} ${perPaxUnit}s` : '';
    priceDetail = `${formatPhp(row.per_pax_price_php)} / ${perPaxUnit}${minPart}`;
  } else if (
    row.pricing_basis === 'per_hour' &&
    row.hour_base_php !== null &&
    row.hour_base_php > 0
  ) {
    const base =
      row.min_hours !== null && row.min_hours > 0
        ? `${formatPhp(row.hour_base_php)} for ${row.min_hours} hr${row.min_hours === 1 ? '' : 's'}`
        : formatPhp(row.hour_base_php);
    const extra =
      row.extra_hour_php !== null && row.extra_hour_php > 0
        ? ` · +${formatPhp(row.extra_hour_php)}/extra hr`
        : '';
    priceDetail = `${base}${extra}`;
  }

  // Best applicable discount → a single badge (pickBestDiscount ranks by peso
  // savings on the anchor, dropping expired offers). Suppressed when the vendor
  // hid prices — a "Save ₱X" / "N% off" badge reveals the underlying figure.
  const best = hidePrices ? null : pickBestDiscount(discounts, row.starting_price_php);

  // FREE inclusions — "<label> · ₱X free" (worth omitted when the vendor left
  // it blank, OR when the vendor hid prices — keep the inclusion label, drop the
  // peso worth). Trim to a few; the overflow surfaces as "+N more".
  const allInclusions = (inclusions ?? []).map((inc) =>
    !hidePrices && inc.worth_php !== null && inc.worth_php > 0
      ? `${inc.label} · ${formatPhp(inc.worth_php)} free`
      : inc.label,
  );
  const shownInclusions = allInclusions.slice(0, SERVICE_CARD_INCLUSION_LIMIT);
  const inclusionsMore = Math.max(0, allInclusions.length - shownInclusions.length);

  // Crew / meta line (unchanged behaviour).
  const crewParts: string[] = [];
  if (row.crew_size !== null && row.crew_size > 0) {
    crewParts.push(`${row.crew_size} crew on-site`);
  }
  if (row.crew_meal_required && !isCrewMeals) {
    crewParts.push('crew meal required');
  }

  // "Not included" expectation flags — feed the couple's budget + set
  // expectations before the quote (0007 budget line items).
  const notIncluded: string[] = [];
  if (!row.crew_meal_included && !isCrewMeals) notIncluded.push('Crew meal not included');
  if (!row.transport_included) {
    notIncluded.push(
      !hidePrices && row.transport_flat_fee_php !== null && row.transport_flat_fee_php > 0
        ? `Transport: ${formatPhp(row.transport_flat_fee_php)}`
        : 'Transport not included',
    );
  }

  return {
    id: row.vendor_service_id,
    label,
    priceLabel,
    meta: crewParts.length > 0 ? crewParts.join(' · ') : null,
    discountLabel: best?.label ?? null,
    inclusions: shownInclusions,
    inclusionsMore,
    notIncluded,
    priceDetail,
    serves: serves ?? null,
    photos: showcase?.photos ?? [],
    videoUrl: showcase?.videoUrl ?? null,
  };
}

// Min-N floor for the public "saved by N" chip — a count below this stays
// hidden so a tiny number never de-anonymizes or reads as vanity (owner default
// 2026-07-02: favorites public / viewers vendor-only; behavioral-data min-N lock).
const FAVORITES_MIN_DISPLAY = 3;

const TRUSTED_BY_RELATIONSHIP_LABEL: Record<TrustedByRelationship, string> = {
  accredited: 'Accredited',
  sponsored_included: 'Preferred partner',
  sponsored_discounted: 'Preferred partner',
  general: 'Works with',
};

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
}: {
  vendors: ReadonlyArray<TrustedByVendor>;
  businessName: string;
}) {
  if (vendors.length === 0) return null;
  return (
    <section className="space-y-4 border-b border-ink/10 py-8">
      <header className="space-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Trusted by
        </h2>
        <p className="text-sm text-ink/65">
          Fellow vendors who endorsed {businessName} — each one confirmed it.
        </p>
      </header>
      <ul className="flex flex-wrap gap-2">
        {vendors.map((v) => {
          const body = (
            <>
              <BadgeCheck aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
              <span className="font-medium text-ink">{v.displayName}</span>
              <span className="text-ink/45">
                · {TRUSTED_BY_RELATIONSHIP_LABEL[v.relationshipType]}
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
  hasMore,
  nextPage,
  showStars,
  showComments,
  recommendingCouples,
  completedEvents,
  venueEvents,
  hasVenueMatch,
}: {
  slug: string;
  businessName: string;
  reviewStats: ReviewStatsRow;
  /** ANTI-FRAUD (2026-07-05): trusted headline average + count. */
  trustedReviewStats: TrustedReviewStatsRow;
  reviews: ReadonlyArray<ReviewWithCouple>;
  hasMore: boolean;
  nextPage: number;
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
}) {
  return (
    <section className="space-y-6 border-b border-ink/10 py-8">
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
            Recommended by {recommendingCouples} couple{recommendingCouples === 1 ? '' : 's'}
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

      {/* Phase C: Free vendors (showStars=false) hide the star metrics
          entirely — no average, no histogram. The per-card "new" treatment
          on the marketplace already signals these vendors have no shown
          rating; the microsite simply omits the metrics block. */}
      {showStars ? (
        <ReviewHeroMetrics stats={reviewStats} trusted={trustedReviewStats} />
      ) : null}

      {/* Phase C: review bodies/comments are gated separately (showComments).
          When OFF (Free + Verified), the per-review detail (body, axis stats,
          vendor reply) is suppressed — but for Free (showStars also OFF) we
          drop the review list entirely since nothing reviewable would render.
          Verified (showStars ON, showComments OFF) still shows the star rows
          without the comment bodies. */}
      {!showStars && !showComments ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-6">
          <p className="text-sm text-ink/65">
            Reviews unlock when this vendor upgrades their Setnayan plan.
          </p>
          <p className="mt-1 text-xs text-ink/45">
            Bookings through Setnayan generate a review request 24 hours after
            the event.
          </p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-6">
          <p className="text-sm text-ink/65">This vendor still has no review.</p>
          <p className="mt-1 text-xs text-ink/45">
            Bookings through Setnayan generate a review request 24 hours after
            the event.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.review_id}>
              <ReviewRow
                review={r}
                showStars={showStars}
                showComments={showComments}
                vendorName={businessName}
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
            href={`/${slug}?reviewsPage=${nextPage}#reviews`}
            className="button-secondary inline-flex h-10 px-4"
          >
            Show more reviews
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function ReviewHeroMetrics({
  stats,
  trusted,
}: {
  stats: ReviewStatsRow;
  /** ANTI-FRAUD (2026-07-05): headline average + count read the TRUSTED stat. */
  trusted: TrustedReviewStatsRow;
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
        </div>
        <p className="text-xs text-ink/60">
          {trustedCount} review{trustedCount === 1 ? '' : 's'}
        </p>
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
            <span className="text-right font-mono text-[11px] text-ink/55">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewRow({
  review,
  showStars,
  showComments,
  vendorName,
}: {
  review: ReviewWithCouple;
  /** Phase C: hide the overall star row when the tier can't count stars. */
  showStars: boolean;
  /** Phase C: hide the comment body + axis stats + vendor reply. */
  showComments: boolean;
  /** Business name used to label the vendor reply ("Response from [name]"). */
  vendorName: string;
}) {
  const author =
    review.couple_display_name && review.couple_display_name.trim().length > 0
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
      title="This couple booked this vendor through Setnayan — verified by the platform."
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
      title="The vendor invited this couple to Setnayan — a verified booking relationship."
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
          {events.length} event{events.length === 1 ? '' : 's'} delivered through Setnayan
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
async function fetchVendorPackagesWithItems(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<VendorPackageWithItems[]> {
  try {
    const { data: pkgs, error: pkgsErr } = await admin
      .from('vendor_packages')
      .select(
        'package_id, vendor_profile_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active, created_at, updated_at',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (pkgsErr || !pkgs || pkgs.length === 0) return [];

    const packageIds = pkgs.map((p) => p.package_id);
    const { data: items } = await admin
      .from('vendor_package_items')
      .select(
        'item_id, package_id, canonical_service, service_description, is_default_included, replacement_value_centavos, display_order, created_at',
      )
      .in('package_id', packageIds)
      .order('display_order', { ascending: true });

    const itemsByPackage = new Map<string, VendorPackageItemRow[]>();
    for (const row of items ?? []) {
      const list = itemsByPackage.get(row.package_id) ?? [];
      list.push(row as VendorPackageItemRow);
      itemsByPackage.set(row.package_id, list);
    }
    return (pkgs as VendorPackageRow[]).map((p) => ({
      ...p,
      items: itemsByPackage.get(p.package_id) ?? [],
    }));
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
  hidePrices,
}: {
  packages: ReadonlyArray<VendorPackageWithItems>;
  coupleEventId: string | null;
  isComingSoon: boolean;
  /** Council #6: vendor opted to hide public prices → PackageCard shows no peso. */
  hidePrices: boolean;
}) {
  return (
    <section className="space-y-4 border-b border-ink/10 py-8">
      <header>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Packages
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink/70">
          One price, everything bundled. Locking a package locks every
          included planning category to this vendor.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pkg) => {
          let cta: React.ReactNode = null;
          if (isComingSoon) {
            cta = (
              <p className="text-xs text-ink/55">
                Not yet bookable — this vendor is finishing verification.
              </p>
            );
          } else if (coupleEventId) {
            cta = <LockPackageModal eventId={coupleEventId} pkg={pkg} />;
          } else {
            cta = (
              <Link
                href="/login"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-terracotta bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-deep"
              >
                Sign in to customize
              </Link>
            );
          }
          return <PackageCard key={pkg.package_id} pkg={pkg} ctaSlot={cta} hidePrice={hidePrices} />;
        })}
      </div>
    </section>
  );
}
