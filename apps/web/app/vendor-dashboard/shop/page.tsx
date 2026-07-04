import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  Globe,
  Handshake,
  Heart,
  Images,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchOwnVendorProfile,
  businessProfileChecklist,
  type BusinessProfileItem,
} from '@/lib/vendor-profile';
import {
  VENDOR_DOC_SLOTS,
  countCompleteVendorSlots,
  fetchLatestApplication,
  requiredDocsComplete,
  verificationSubmitMissing,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import { fetchReviewStats, fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import {
  fetchVendorBranches,
  fetchBranchFeePhp,
  branchAutoRadiusKm,
  BRANCH_FEE_PHP,
  type VendorBranchView,
} from '@/lib/vendor-branches';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { tierCaps, asVendorTier, isTierAtLeast } from '@/lib/vendor-tier-caps';
import { ReachMap } from './_components/reach-map';
import { BranchManager, type PayInfo } from '../_components/branch-manager';
import {
  fetchVendorTeam,
  enrichTeamWithUsers,
  VENDOR_TEAM_ROLE_LABEL,
  type VendorTeamMemberRow,
  type VendorTeamMemberWithUser,
} from '@/lib/vendor-team';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { loadVendorRecaps } from '@/lib/recap-vendor';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { CopyButton } from '@/app/_components/copy-button';
import { VendorAvatar, deriveVendorInitials as deriveInitials } from '@/app/_components/vendor-avatar';
import { SubmitButton } from '@/app/_components/submit-button';
import { inviteVendorTeamMember } from '@/app/vendor-dashboard/team/actions';

import {
  VendorServicesManager,
  type ServicesManagerSearch,
} from '@/app/vendor-dashboard/services/_components/services-manager';

import {
  fetchVendorMicrosite,
  fetchVimeoThumb,
  micrositeCan,
  serializeVideoRef,
  videoThumb,
  type VendorMicrosite,
} from '@/lib/vendor-microsite';

import { ManageTiles } from './_components/manage-tiles';
import { ProfileChecklistEditor } from './_components/profile-checklist-editor';
import { VerifySection, type VerifySummary } from './_components/verify-section';
import { readContactStamps } from './inline-docs-actions';
import { WebsiteEditor } from './_components/website-editor';
import type { ProfileFieldData } from './_components/editable-row';
import { ServicesDisclosure } from './_components/services-disclosure';

/**
 * /vendor-dashboard/shop — "My Shop".
 *
 * The storefront home of the vendor doorway. Reworked 2026-07 (owner):
 * everything acts INLINE. Profile / Website / Team / Branch each expand their
 * function in place (ManageTiles + Collapsible) — Profile joined the inline
 * set 2026-07-02 (was the lone navigate-out tile); the QR row card toggles
 * Shortlist ↔ Locked, both rendering a real QR; the metrics strip is a
 * read-only pulse (its detail pages live in the sidebar).
 *
 * DATA — every number is LIVE (owner rule: never fabricate). The whole loader
 * is wrapped so a single query error degrades to zeros rather than crashing.
 */

export const metadata = { title: 'My Shop · Vendor · Setnayan' };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DISPLAY_HOST = SITE_URL.replace(/^https?:\/\//, '');

const nf = new Intl.NumberFormat('en-PH');

/** Start of the current ISO-ish week (Mon 00:00 local), as an ISO string. */
function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type TeamMember = VendorTeamMemberWithUser;

type ShopData = {
  businessName: string;
  initials: string;
  /** Presigned display URL of the uploaded logo (Hero avatar), or null → initials. */
  logoUrl: string | null;
  slug: string | null;
  city: string | null;
  primaryService: string | null;
  tier: string | null;
  isVerified: boolean;
  websiteLive: boolean;
  isProWebsite: boolean;
  canPersonalize: boolean;
  isEnterpriseWebsite: boolean;
  yearsLabel: string | null;
  microsite: VendorMicrosite;
  portfolioPhotos: { key: string; url: string }[];
  reviewOptions: { id: string; label: string }[];
  editorialOptions: { id: string; label: string }[];
  completionPct: number;
  verify: VerifySummary;
  checklist: BusinessProfileItem[];
  profileFields: ProfileFieldData;
  profileViewsWeek: number;
  rating: number;
  reviewCount: number;
  savedByCouples: number;
  storiesTagged: number;
  recapClips: number;
  teamMembers: number;
  /** Sub-line for the Team tile — how many more seats the plan allows. */
  teamSub: string;
  branchLocations: number;
  /** Sub-line for the Branch tile — whether more locations can be added. */
  branchSub: string;
  hqLat: number | null;
  hqLng: number | null;
  /** Tier reach in km (vendor-tier-caps · serviceRadiusKm). 0 = unscoped. */
  reachKm: number;
  branchViews: VendorBranchView[];
  branchFeePhp: number;
  branchAutoRadius: number;
  branchPay: PayInfo;
  recommendedByShops: number;
  team: TeamMember[];
};

async function loadShopData(): Promise<ShopData | 'no-vendor'> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // Signed in but no shop (owned OR via team) — send them to the one-button
  // "Open your shop" gate instead of a dead fallback (owner gap-fix
  // 2026-07-03). Distinct from the error path: the caller's catch keeps the
  // degraded fallback for genuine load failures.
  if (!profile) return 'no-vendor';

  const vendorId = profile.vendor_profile_id;
  const businessName = profile.business_name ?? 'Your shop';

  // Tier — not in the shared profile select; soft-probe it.
  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    tier = (data as { tier_state?: string | null } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }

  const weekStart = startOfWeekIso();

  const [
    verifyApp,
    reviewStats,
    savesRes,
    viewsRes,
    branches,
    team,
    bookings,
    partnershipsRes,
  ] = await Promise.all([
    // Latest verification application — feeds the Get-verified stepper + the
    // Hero "N of 3" pill. Cheap read (no presigns — those stay lazy on Step 1
    // expand). Null when the vendor has never started.
    fetchLatestApplication(supabase, vendorId).catch(() => null),
    fetchReviewStats(supabase, vendorId).catch(() => ({
      avg_rating_overall: 0,
      total_count: 0,
    })),
    supabase
      .rpc('count_saves_for_vendor', { p_vendor_profile_id: vendorId })
      .then((r) => (typeof r.data === 'number' ? r.data : 0), () => 0),
    supabase
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .gte('viewed_at', weekStart)
      .then((r) => r.count ?? 0, () => 0),
    fetchVendorBranches(supabase, vendorId).catch(() => []),
    fetchVendorTeam(supabase, vendorId).catch(() => [] as VendorTeamMemberRow[]),
    fetchVendorPoolBookings(supabase, vendorId).catch(() => []),
    supabase
      .from('vendor_partnerships')
      .select('id', { count: 'exact', head: true })
      .eq('recommended_vendor_id', vendorId)
      .eq('status', 'accepted')
      .eq('is_active', true)
      .then((r) => r.count ?? 0, () => 0),
  ]);

  const eventIds = bookings.map((b) => b.eventId);
  const [stories, recapCount] = await Promise.all([
    loadVendorFeaturedStories(eventIds).catch(() => []),
    loadVendorRecaps(eventIds).then((r) => r.length, () => 0),
  ]);
  const storiesTagged = stories.length;
  // Picker options for the Pro "Featured editorials" control (id = event_id).
  const editorialOptions = stories.map((s) => ({
    id: s.eventId,
    label: [s.coupleNames, [s.city, s.dateLabel].filter(Boolean).join(' · ')]
      .filter(Boolean)
      .join(' — '),
  }));

  const completion = businessProfileChecklist(profile);
  const completionPct =
    completion.total === 0
      ? 0
      : Math.round((completion.done / completion.total) * 100);

  // ── Get-verified summary (owner redesign 2026-07-03) ─────────────────────
  // Everything the always-visible stepper needs, WITHOUT presigning documents
  // (that stays lazy on Step 1 expand). Contact stamps + the VALIDATE send-to
  // settings are soft probes — their columns land in a parallel migration, so
  // pre-migration reads degrade to "waiting" / defaults instead of crashing.
  const verifyUploads = (verifyApp?.doc_uploads ?? {}) as DocUploadMap;
  const contactStamps = verifyApp
    ? await readContactStamps(supabase, verifyApp.application_id)
    : { emailConfirmedAt: null, phoneConfirmedAt: null };
  let validateEmail = 'verify@setnayan.com';
  let validatePhone: string | null = null;
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('vendor_validate_email,vendor_validate_phone')
      .eq('id', 1)
      .maybeSingle();
    const row = data as { vendor_validate_email?: string | null; vendor_validate_phone?: string | null } | null;
    if (row?.vendor_validate_email?.trim()) validateEmail = row.vendor_validate_email.trim();
    validatePhone = row?.vendor_validate_phone?.trim() || null;
  } catch {
    // pre-migration → defaults above
  }
  const meetSlot = verifyUploads.google_meet;
  const meetScheduledAt =
    meetSlot && typeof meetSlot === 'object' && !Array.isArray(meetSlot) && 'scheduled_at' in meetSlot
      ? ((meetSlot as { scheduled_at?: string | null }).scheduled_at ?? null)
      : null;
  const verify: VerifySummary = {
    status: (verifyApp?.status as VerifySummary['status']) ?? null,
    vendorComplete: countCompleteVendorSlots(verifyUploads),
    vendorTotal: VENDOR_DOC_SLOTS.length,
    requiredDocsIn: requiredDocsComplete(verifyUploads),
    emailConfirmedAt: contactStamps.emailConfirmedAt,
    phoneConfirmedAt: contactStamps.phoneConfirmedAt,
    meetScheduledAt,
    decisionReason: (verifyApp?.decision_reason as string | null) ?? null,
    submitMissing: verificationSubmitMissing({
      profileComplete: completion.complete,
      uploads: verifyUploads,
    }),
    validateEmail,
    validatePhone,
  };

  const activeBranches = branches.filter((b) => b.status === 'active').length;

  // Team seat headroom for the Team tile sub-line. Mirrors the seat-cap contract
  // enforced in team/actions.ts: the plan's `agentAccounts` counts only members
  // BEYOND the founding admin (vendor_profiles.user_id), so exclude the founder
  // from the used count. Infinity = unlimited.
  const teamSeatCap = tierCaps(asVendorTier(tier)).agentAccounts;
  const teamSeatsUsed = team.filter((m) => m.user_id !== profile.user_id).length;
  const teamSeatsLeft =
    teamSeatCap === Infinity ? Infinity : Math.max(0, teamSeatCap - teamSeatsUsed);
  const teamSub =
    teamSeatCap === Infinity
      ? 'Unlimited seats'
      : teamSeatCap === 0
        ? 'Upgrade to add'
        : teamSeatsLeft > 0
          ? `Add up to ${teamSeatsLeft}`
          : 'Seats full';
  // Branch headroom: only Enterprise-or-higher may add locations (each is a paid
  // add-on, no hard cap), everyone else upgrades to unlock. Rank-derived so
  // Custom (runs as Enterprise) inherits without a hard equality.
  const branchSub = isTierAtLeast(tier, 'enterprise') ? 'Add locations' : 'Upgrade to add';

  // Branch add/manage data — only Enterprise-or-higher renders the inline
  // manager, so the fee + payout accounts are only fetched for that tier (skips
  // two reads for everyone else).
  let branchFeePhp = BRANCH_FEE_PHP;
  let branchPay: PayInfo = { bdoName: null, bdoNumber: null, gcashName: null, gcashNumber: null };
  if (isTierAtLeast(tier, 'enterprise')) {
    const [fee, settings] = await Promise.all([
      fetchBranchFeePhp(supabase).catch(() => BRANCH_FEE_PHP),
      fetchPlatformSettings(supabase).catch(() => null),
    ]);
    branchFeePhp = fee;
    if (settings) {
      branchPay = {
        bdoName: settings.bdo_account_name ?? null,
        bdoNumber: settings.bdo_account_number ?? null,
        gcashName: settings.gcash_account_name ?? null,
        gcashNumber: settings.gcash_number ?? null,
      };
    }
  }

  // Attach email/display_name (Pattern A — other users' identity needs the
  // admin client). Fail-soft: keep the rows nameless rather than crash.
  let enrichedTeam: TeamMember[];
  try {
    enrichedTeam = await enrichTeamWithUsers(createAdminClient(), team);
  } catch {
    enrichedTeam = team.map((m) => ({ ...m, email: null, display_name: null }));
  }

  // Live field values + editor vocabulary for the inline Business-Profile editor
  // (the My Shop Profile panel). Degrade-safe: a logo-presign or taxonomy hiccup
  // must not blank the whole My Shop page, so failures collapse to neutral
  // defaults (no thumbnail · in-code service labels · no extra leaves) exactly
  // like a vendor who hasn't set those yet.
  let logoDisplayMap: Record<string, string> = {};
  try {
    const logoDisplayUrl = profile.logo_url
      ? await displayUrlForStoredAsset(profile.logo_url)
      : null;
    if (profile.logo_url && logoDisplayUrl) {
      logoDisplayMap = { [profile.logo_url]: logoDisplayUrl };
    }
  } catch {
    logoDisplayMap = {};
  }
  // The Hero avatar shows the uploaded logo when present (owner 2026-07-02),
  // falling back to initials. Same presigned URL the Profile row's thumbnail uses.
  const logoUrl = profile.logo_url ? (logoDisplayMap[profile.logo_url] ?? null) : null;
  const { serviceLabels, extraServiceLeaves } = await fetchVendorServicePickerVocab();
  const profileFields: ProfileFieldData = {
    business_name: profile.business_name ?? '',
    business_owner_name: profile.business_owner_name ?? '',
    hq_address: profile.hq_address ?? '',
    hq_latitude: profile.hq_latitude ?? null,
    hq_longitude: profile.hq_longitude ?? null,
    contact_phone: profile.contact_phone ?? '',
    contact_email: profile.contact_email ?? '',
    in_business_since_year: profile.in_business_since_year
      ? String(profile.in_business_since_year)
      : '',
    logo_url: profile.logo_url ?? null,
    logoDisplayMap,
    services: (profile.services ?? []) as string[],
    serviceLabels,
    extraServiceLeaves,
    vendorProfileId: vendorId,
  };

  // Microsite customization (My Shop → Website editor). Soft/defensive read —
  // decoupled from the shared profile select so a not-yet-applied migration
  // never blanks My Shop.
  const microsite = await fetchVendorMicrosite(supabase, vendorId);
  const isProWebsite = tierCaps(asVendorTier(tier)).customWebsiteName;
  const canPersonalize = micrositeCan(tier).canPersonalize;
  const isEnterpriseWebsite = micrositeCan(tier).isEnterprise;
  const yearsLabel = profile.in_business_since_year
    ? `${Math.max(0, new Date().getFullYear() - profile.in_business_since_year)} yrs in business`
    : null;

  // Portfolio thumbnails for the Pro hero-photo picker. Best-effort — a presign
  // hiccup just drops that option, never crashes the page.
  const portfolioPhotos = (
    await Promise.all(
      ((profile.portfolio_r2_keys ?? []) as string[]).map(async (key) => {
        try {
          const url = await displayUrlForStoredAsset(key);
          return url ? { key, url } : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((p): p is { key: string; url: string } => p !== null);

  // Review options for the Pro pinned-review picker. Best-effort — a fetch
  // hiccup just yields an empty picker ("no reviews yet"), never a crash.
  let reviewOptions: { id: string; label: string }[] = [];
  try {
    const rows = await fetchReviewsForVendorWithCouple(supabase, vendorId, {
      limit: 20,
      offset: 0,
    });
    reviewOptions = rows.map((r) => {
      const name = r.couple_display_name ?? 'A couple';
      const snippet = r.body
        ? `“${r.body.slice(0, 60)}${r.body.length > 60 ? '…' : ''}”`
        : `${r.rating_overall}★`;
      return { id: r.review_id, label: `${name} · ${snippet}` };
    });
  } catch {
    reviewOptions = [];
  }

  return {
    businessName,
    initials: deriveInitials(businessName),
    logoUrl,
    slug: profile.business_slug ?? null,
    city: profile.location_city ?? null,
    primaryService: profile.services?.[0] ? titleCase(profile.services[0]) : null,
    tier,
    isVerified: profile.public_visibility === 'verified',
    websiteLive:
      Boolean(profile.business_slug) &&
      isPubliclyVisible(profile.public_visibility),
    isProWebsite,
    canPersonalize,
    isEnterpriseWebsite,
    yearsLabel,
    microsite,
    portfolioPhotos,
    reviewOptions,
    editorialOptions,
    completionPct,
    verify,
    checklist: completion.items,
    profileFields,
    profileViewsWeek: viewsRes,
    rating: Number(reviewStats.avg_rating_overall) || 0,
    reviewCount: Number(reviewStats.total_count) || 0,
    savedByCouples: savesRes,
    storiesTagged,
    recapClips: recapCount,
    teamMembers: team.length,
    teamSub,
    branchLocations: 1 + activeBranches,
    branchSub,
    hqLat: profile.hq_latitude ?? null,
    hqLng: profile.hq_longitude ?? null,
    reachKm: tierCaps(asVendorTier(tier)).serviceRadiusKm,
    branchViews: branches,
    branchFeePhp,
    branchAutoRadius: branchAutoRadiusKm(),
    branchPay,
    recommendedByShops: partnershipsRes,
    team: enrichedTeam,
  };
}

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  solo: 'Solo',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function tierLabel(tier: string | null): string {
  if (!tier) return 'Free';
  return TIER_LABEL[tier] ?? titleCase(tier);
}

export default async function VendorShopPage({
  searchParams,
}: {
  searchParams: Promise<ServicesManagerSearch>;
}) {
  let data: ShopData | 'no-vendor' | null;
  try {
    data = await loadShopData();
  } catch (err) {
    // Re-throw Next's control-flow errors (redirect/notFound) so the /login
    // redirect inside the loader still navigates.
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard/shop] loader failed', err);
    data = null;
  }

  // Signed in without a shop → the one-button "Open your shop" gate.
  if (data === 'no-vendor') redirect('/open-shop');

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My Shop</h1>
          <p className="max-w-prose text-base text-ink/65">
            Everything that defines your shop and your reach.
          </p>
        </header>
        <div>
          <p className="text-sm text-ink/70">
            Set up your business profile first — once it&rsquo;s created, your
            storefront, reach, and reputation all live here.
          </p>
          <Link
            href="/vendor-dashboard/profile"
            className="button-primary mt-4 inline-flex items-center gap-2"
          >
            Go to my profile
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    );
  }

  // Canonical vendor URL is the bare-root alias (www.setnayan.com/{slug}); the
  // /v/{slug} route still resolves but the editor surfaces the clean address.
  const publicPath = data.slug ? `/${data.slug}` : null;
  const sp = await searchParams;

  // Films editor cards — resolve each stored ref to a poster. YouTube posters
  // are deterministic; Vimeo needs a cached oEmbed lookup (fetched server-side
  // here, degrading to null → the editor's poster-less fallback tile). Only the
  // Enterprise editor renders the grid, so skip the work otherwise.
  const videoCards = data.isEnterpriseWebsite
    ? await Promise.all(
        data.microsite.videos.map(async (ref) => ({
          stored: serializeVideoRef(ref),
          provider: ref.provider,
          thumb:
            videoThumb(ref) ??
            (ref.provider === 'vimeo'
              ? await fetchVimeoThumb(ref.id, ref.hash)
              : null),
        })),
      )
    : [];

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <HeroCard data={data} publicPath={publicPath} />

      {/* ── HOW YOU'RE DOING — read-only pulse (detail pages live in the sidebar).
          Sits above "Manage your shop" (owner 2026-07-02): see your numbers first,
          then act on them. */}
      <section className="space-y-3">
        {/* Heading kept for the a11y outline but visually removed (owner
            2026-07-02: "remove the How you're doing text"). */}
        <h2 className="sr-only">How you&rsquo;re doing</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            icon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.profileViewsWeek)}
            label="Profile views"
            sub="this week"
          />
          <StatTile
            icon={<Star className="h-4 w-4" strokeWidth={1.75} />}
            value={data.reviewCount > 0 ? data.rating.toFixed(1) : '—'}
            label="Reviews"
            sub={`${nf.format(data.reviewCount)} review${data.reviewCount === 1 ? '' : 's'}`}
          />
          <StatTile
            icon={<Heart className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.savedByCouples)}
            label="Saved"
            sub="couples saved you"
          />
          <StatTile
            icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.storiesTagged)}
            label="Stories"
            sub="editorials tagged"
          />
          <StatTile
            icon={<Images className="h-4 w-4" strokeWidth={1.75} />}
            value={data.recapClips > 0 ? nf.format(data.recapClips) : '—'}
            label="Recap"
            sub="day-of clips"
          />
          <StatTile
            icon={<Handshake className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.recommendedByShops)}
            label="Recommend"
            sub={`${data.recommendedByShops === 1 ? 'shop recommends' : 'shops recommend'} you`}
          />
        </div>
      </section>

      <ManageTiles
        completionPct={data.completionPct}
        verifyLabel={
          data.completionPct >= 100
            ? 'All fields in'
            : `${data.checklist.filter((i) => !i.ok).length} field${data.checklist.filter((i) => !i.ok).length === 1 ? '' : 's'} left`
        }
        teamLabel={nf.format(data.teamMembers)}
        teamSub={data.teamSub}
        branchLabel={nf.format(data.branchLocations)}
        branchSub={data.branchSub}
        profilePanel={
          <ProfileChecklistEditor
            items={data.checklist}
            data={data.profileFields}
            isVerified={data.isVerified}
          />
        }
        websitePanel={
          <WebsiteEditor
            publicPath={publicPath}
            displayHost={DISPLAY_HOST}
            websiteLive={data.websiteLive}
            isPro={data.isProWebsite}
            canPersonalize={data.canPersonalize}
            isEnterprise={data.isEnterpriseWebsite}
            about={data.microsite.about}
            sections={data.microsite.sections}
            featuredServiceIds={data.microsite.featuredServiceIds}
            services={data.profileFields.services}
            serviceLabels={data.profileFields.serviceLabels}
            isVerified={data.isVerified}
            yearsLabel={data.yearsLabel}
            slug={data.slug}
            heroPhotoKey={data.microsite.heroPhotoKey}
            accent={data.microsite.accent}
            portfolioPhotos={data.portfolioPhotos}
            reviews={data.reviewOptions}
            pinnedReviewId={data.microsite.pinnedReviewId}
            editorials={data.editorialOptions}
            featuredEditorialIds={data.microsite.featuredEditorialIds}
            videos={videoCards}
          />
        }
        teamPanel={<TeamPanel members={data.team} />}
        branchPanel={
          <BranchPanel
            city={data.city}
            branchLocations={data.branchLocations}
            tier={data.tier}
            hqLat={data.hqLat}
            hqLng={data.hqLng}
            reachKm={data.reachKm}
            branches={data.branchViews}
            branchFeePhp={data.branchFeePhp}
            branchAutoRadius={data.branchAutoRadius}
            branchPay={data.branchPay}
          />
        }
      />

      {/* ── GET VERIFIED — the verification journey, promoted to its own
          always-visible stage (owner redesign 2026-07-03). SEQUENCED (owner
          flow): a teaser until the profile is 100% complete → the documents
          reveal (auto-open) → upload + send VALIDATE → Submit → "we'll contact
          you for final confirmation" (the Meet). Hero pill deep-links here. */}
      <VerifySection
        businessName={data.businessName}
        vendorProfileId={data.profileFields.vendorProfileId}
        isVerified={data.isVerified}
        profileComplete={data.completionPct >= 100}
        profileFieldsLeft={data.checklist.filter((i) => !i.ok).length}
        verify={data.verify}
      />

      {/* ── YOUR SERVICES — the full Services manager, fully consolidated onto
          My Shop (owner 2026-07-02: "My Services" retired everywhere). The
          standalone /vendor-dashboard/services route now redirects here; the
          guided-wizard child route still renders separately. Deep-links open it. */}
      <ServicesDisclosure
        defaultOpen={Boolean(
          sp.offpeak || sp.add || sp.saved || sp.error || sp.requested,
        )}
      >
        <VendorServicesManager search={sp} basePath="/vendor-dashboard/shop" />
      </ServicesDisclosure>
    </section>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */
function HeroCard({
  data,
  publicPath,
}: {
  data: ShopData;
  publicPath: string | null;
}) {
  const subline = [tierLabel(data.tier), data.primaryService, data.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
      <VendorAvatar
        logoUrl={data.logoUrl}
        initials={data.initials}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold tracking-wide"
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--m-ink)' }}>
            {data.businessName}
          </h2>
          {data.isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                color: 'var(--m-sage-deep)',
              }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Verified
            </span>
          ) : data.verify.status === 'pending_review' || data.verify.status === 'in_review' ? (
            <a
              href="#get-verified"
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'var(--m-paper)', color: 'var(--m-slate)' }}
            >
              Verification in review
            </a>
          ) : (
            // The passive "Unverified" chip became the GOAL (owner redesign
            // 2026-07-03): a live step count that deep-links to the
            // Get-verified section below. Before the profile is complete the
            // pill points at the prerequisite instead (owner flow: profile
            // first → then the documents appear).
            <a
              href="#get-verified"
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:bg-[color:var(--m-orange-3)]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
              Get verified ·{' '}
              {(data.verify.requiredDocsIn ? 1 : 0) +
                (data.verify.emailConfirmedAt && data.verify.phoneConfirmedAt ? 1 : 0)}{' '}
              of 2
            </a>
          )}
        </div>
        {subline ? (
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            {subline}
          </p>
        ) : null}
        {publicPath ? (
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="inline-flex items-center gap-1.5 font-mono text-xs"
              style={{ color: 'var(--m-orange-2)' }}
            >
              <Globe aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">
                {DISPLAY_HOST}
                {publicPath}
              </span>
            </p>
            <CopyButton
              value={`${DISPLAY_HOST}${publicPath}`}
              label="Copy link"
              copiedLabel="Copied"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[color:var(--m-orange-2)] hover:bg-[color:var(--m-orange-3)]"
            />
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            No public address yet — set one in Profile.
          </p>
        )}
      </div>

      <CompletenessRing pct={data.completionPct} />

      {publicPath ? (
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          View as couple
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </a>
      ) : (
        <Link
          href="/vendor-dashboard/profile"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          Finish profile
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      )}
    </div>
  );
}

function CompletenessRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--m-orange) ${clamped * 3.6}deg, var(--m-orange-3) 0deg)`,
        }}
        role="img"
        aria-label={`Profile ${clamped}% complete`}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: '3.75rem', height: '3.75rem', background: 'var(--m-orange-4)' }}
        >
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: 'var(--m-ink)' }}
          >
            {clamped}%
          </span>
        </div>
      </div>
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: 'var(--m-orange-2)' }}
      >
        Complete
      </span>
    </div>
  );
}

/* ─── Read-only metric tile ─────────────────────────────────────────────── */
function StatTile({
  icon,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="inline-flex items-center justify-center gap-1.5 text-xs"
        style={{ color: 'var(--m-slate-3)' }}
      >
        <span aria-hidden style={{ color: 'var(--m-orange-2)' }}>
          {icon}
        </span>
        {label}
      </span>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </div>
  );
}

/* ─── Inline panels (rendered server-side, hosted by ManageTiles) ───────── */

function TeamPanel({ members }: { members: TeamMember[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink/55">Any admin can manage the team.</p>

      <ul className="space-y-2">
        {members.length === 0 ? (
          <li className="text-sm text-ink/60">No team members yet.</li>
        ) : (
          members.map((m) => (
            <li
              key={m.vendor_team_member_id}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
              >
                {deriveInitials(m.display_name ?? m.email ?? 'SN')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.display_name ?? m.email ?? 'Member'}
                </p>
                <p className="text-xs text-ink/55">
                  {VENDOR_TEAM_ROLE_LABEL[m.role]}
                  {m.team_label ? ` · ${m.team_label}` : ''}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>

      <form
        action={inviteVendorTeamMember}
        className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      >
        <input type="hidden" name="returnTo" value="shop" />
        <input
          name="email"
          type="email"
          required
          placeholder="colleague@example.com"
          className="input-field"
          aria-label="Team member email"
        />
        <select
          name="role"
          defaultValue="viewer"
          className="input-field cursor-pointer"
          aria-label="Role"
        >
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
          <option value="viewer">Viewer</option>
        </select>
        <SubmitButton className="button-primary" pendingLabel="Adding…">
          Add
        </SubmitButton>
      </form>
    </div>
  );
}

function BranchPanel({
  city,
  branchLocations,
  tier,
  hqLat,
  hqLng,
  reachKm,
  branches,
  branchFeePhp,
  branchAutoRadius,
  branchPay,
}: {
  city: string | null;
  branchLocations: number;
  tier: string | null;
  hqLat: number | null;
  hqLng: number | null;
  reachKm: number;
  branches: VendorBranchView[];
  branchFeePhp: number;
  branchAutoRadius: number;
  branchPay: PayInfo;
}) {
  const isEnterprise = isTierAtLeast(tier, 'enterprise');
  const hasCoords = hqLat !== null && hqLng !== null;
  const hasRing = Number.isFinite(reachKm) && reachKm > 0;
  const from = city ?? 'your headquarters';
  // Where the branch pin map opens: the vendor's HQ, or Metro Manila as a
  // sensible national fallback when the HQ hasn't been geocoded yet.
  const branchMapCenter =
    hqLat !== null && hqLng !== null
      ? { lat: hqLat, lng: hqLng }
      : { lat: 14.5995, lng: 120.9842 };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          aria-hidden
        >
          <Building2 className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {city ?? 'Headquarters'}
          </p>
          <p className="text-xs text-ink/55">
            {branchLocations === 1
              ? 'Headquarters'
              : `1 of ${branchLocations} locations`}
          </p>
        </div>
      </div>

      {/* ── Coverage reach — the radius couples' Services search gates on. */}
      {hasCoords ? (
        <div className="space-y-2">
          <ReachMap lat={hqLat} lng={hqLng} radiusKm={reachKm} />
          <p className="text-xs text-ink/55">
            {hasRing ? (
              <>
                You cover about{' '}
                <span className="font-medium text-ink">{reachKm} km</span> from{' '}
                {from}. Couples searching farther still find you under
                {' '}&ldquo;Show farther,&rdquo; flagged &ldquo;travel fee
                likely.&rdquo;
              </>
            ) : (
              <>
                Your shop isn&rsquo;t shown in couples&rsquo; searches yet.
                Upgrade to appear on the map and set your coverage radius.
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          Add your HQ address in Profile above to see how far you cover on a map.
        </p>
      )}

      {isEnterprise ? (
        <BranchManager
          branches={branches}
          feePhp={branchFeePhp}
          autoRadiusKm={branchAutoRadius}
          initialCenter={branchMapCenter}
          pay={branchPay}
        />
      ) : (
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          Extra branches are an Enterprise feature — each gets its own team and
          calendar.
        </p>
      )}
    </div>
  );
}
