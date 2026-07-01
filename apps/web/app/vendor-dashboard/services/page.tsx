import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Gift,
  Layers,
  Plus,
  Snowflake,
  Tag,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import {
  fetchVendorPoolBookings,
  fetchVendorBlocks,
} from '@/lib/vendor-schedule';
import {
  deriveLeanMonths,
  formatLeanMonths,
  suggestPromoExpiry,
} from '@/lib/vendor-lean-months';
import {
  tierCaps,
  asVendorTier,
  canPlotTimeSlots,
  isTrueNameTier,
  TIER_LABEL,
  type VendorTier,
} from '@/lib/vendor-tier-caps';
import {
  fetchVendorTimeSlotsByService,
  formatSlotTime,
  SLOT_CAPACITY_MAX,
  SLOT_LABEL_MAX,
  type VendorServiceTimeSlot,
} from '@/lib/vendor-time-slots';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  SERVICE_GROUPS,
  type VendorCategory,
  displayServiceLabel,
  formatPhp,
  resolveVendorDisplayName,
  isVendorNameRevealed,
} from '@/lib/vendors';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { labelForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { fetchReviewStats, fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import { countVendorRecommendingCouples } from '@/lib/vendor-recommendations';
import { r2PublicUrl, R2_BUCKETS } from '@/lib/r2';
import { displayLogoUrl } from '@/lib/uploads';
import {
  iconForVendorCategory,
  specialistToolsForCategories,
} from '@/lib/vendor-service-tools';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { Field } from '@/app/_components/forms/field';
import {
  fetchOwnSchedulesByService,
  rowToDraft,
} from '@/lib/vendor-service-payment-schedules';
import { PaymentScheduleEditor } from './_components/payment-schedule-editor';
import { ExploreCardPreview } from './_components/explore-card-preview';
import {
  createVendorService,
  proposeCategory,
  updateVendorService,
  toggleVendorServiceActive,
  deleteVendorService,
  addServiceTimeSlot,
  deleteServiceTimeSlot,
  setServiceLinks,
} from './actions';

export const metadata = { title: 'My Services · Vendor · Setnayan' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    add?: string;
    requested?: string;
    /** Off-Season Promos nudge — when set to one of the vendor's own
     *  vendor_service_id values, that service's Discount section opens
     *  pre-filled with an `off_peak` discount keyed to the lean months. */
    offpeak?: string;
  }>;
};

type CategoryRequestRow = {
  request_id: string;
  proposed_label: string;
  status: 'pending' | 'promoted' | 'mapped' | 'kept_private' | 'rejected';
  mapped_to_canonical: string | null;
  resolution_note: string | null;
};

export default async function VendorServicesPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const services = await fetchVendorServices(supabase, profile.vendor_profile_id);

  // Linked-services-on-card (locked spec): which OTHER categories each service
  // "comes with". Pre-checks the "Comes with" picker on each edit form. The
  // option set is the vendor's own distinct categories — a vendor can only
  // advertise coverage they actually offer (enforced again in setServiceLinks).
  const linkedByServiceId = new Map<string, Set<string>>();
  const serviceIdList = services.map((s) => s.vendor_service_id);
  if (serviceIdList.length > 0) {
    const { data: linkRows } = await supabase
      .from('vendor_service_links')
      .select('vendor_service_id, linked_canonical_service')
      .in('vendor_service_id', serviceIdList);
    for (const r of (linkRows ?? []) as {
      vendor_service_id: string;
      linked_canonical_service: string;
    }[]) {
      const set = linkedByServiceId.get(r.vendor_service_id) ?? new Set<string>();
      set.add(r.linked_canonical_service);
      linkedByServiceId.set(r.vendor_service_id, set);
    }
  }
  const distinctCategories = Array.from(new Set(services.map((s) => s.category)));

  // #1 multi-service-per-leaf: a category can now hold several listings, so we
  // track a COUNT per category (not just presence) to show on the picker.
  const serviceCountByCategory = services.reduce<Record<string, number>>(
    (m, s) => {
      m[s.category] = (m[s.category] ?? 0) + 1;
      return m;
    },
    {},
  );

  // Soft-probe the vendor-scoped fields not in the shared profile select:
  //   tier_state           — tier banner + caps + card price + name reveal
  //   verification_state   — the card's "Verified" trust badge
  //   name_revealed_at     — hybrid-anonymity name reveal on the card
  //   screen_name          — the stored anonymized label for the card
  // A missing column / RLS hiccup degrades to null (→ free / hidden), never
  // crashing the page.
  let tier: string | null = null;
  let verificationState: string | null = null;
  let nameRevealedAt: string | null = null;
  let screenName: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state, verification_state, name_revealed_at, screen_name')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const row = data as {
      tier_state?: string | null;
      verification_state?: string | null;
      name_revealed_at?: string | null;
      screen_name?: string | null;
    } | null;
    tier = row?.tier_state ?? null;
    verificationState = row?.verification_state ?? null;
    nameRevealedAt = row?.name_revealed_at ?? null;
    screenName = row?.screen_name ?? null;
  } catch {
    tier = null;
  }
  const tierKey: VendorTier = asVendorTier(tier);
  const caps = tierCaps(tier);

  // #2 daily booking capacity: the tier caps the max bookings/day a vendor can
  // declare per service (FREE 0 / VERIFIED 1 / PRO 3 / ENTERPRISE 8). Only show
  // the capacity input when the tier allows bookings at all (slotsCap > 0).
  const slotsCap = caps.slotsPerDay;
  const slotsCapForUi = Number.isFinite(slotsCap) ? slotsCap : 99;
  // #3 time-bound slots: ENTERPRISE-only plotting (keyed on the enterprise tier).
  const canPlotSlots = canPlotTimeSlots(tier);
  const slotsByService = await fetchVendorTimeSlotsByService(
    supabase,
    profile.vendor_profile_id,
  );
  // Payment schedules (Vendor Transaction Lifecycle Phase 2 · PR-A).
  const scheduleRowsByService = await fetchOwnSchedulesByService(
    supabase,
    serviceIdList,
  );
  const branches =
    tier === 'enterprise'
      ? (await fetchVendorBranches(supabase, profile.vendor_profile_id)).filter(
          (b) => b.status !== 'cancelled',
        )
      : [];
  const showBranchPicker = branches.length > 0;
  const branchLabelById = new Map(branches.map((b) => [b.branch_id, b.branch_label]));

  // ── Explore service-card preview data (all LIVE) ────────────────────────
  // Rating + review count, distinct couples who recommended the vendor, and one
  // representative review quote — the same reads the marketplace + the vendor's
  // Reviews page use. Fail-soft to empty on any read error.
  const [reviewStats, recommendedByCount, reviewList, coverLogoUrl] =
    await Promise.all([
      fetchReviewStats(supabase, profile.vendor_profile_id).catch(() => null),
      countVendorRecommendingCouples(supabase, profile.vendor_profile_id).catch(
        () => 0,
      ),
      fetchReviewsForVendorWithCouple(supabase, profile.vendor_profile_id, {
        limit: 5,
      }).catch(() => []),
      displayLogoUrl(profile).catch(() => null),
    ]);
  const rating = reviewStats?.avg_rating_overall ?? 0;
  const reviewCount = reviewStats?.total_count ?? 0;
  const reviewQuote =
    reviewList.find((r) => (r.body ?? '').trim().length > 0)?.body?.trim() ?? null;

  // Cover photo — the vendor's own hero service photo (lowest-created active
  // service with a primary photo), falling back to their logo, then the bundled
  // placeholder inside the preview. Soft-probe the column so a pre-migration DB
  // degrades to the logo path.
  let coverPhotoUrl: string | null = null;
  try {
    const { data: photoRows } = await supabase
      .from('vendor_services')
      .select('primary_photo_r2_key, is_active, created_at')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('created_at', { ascending: true });
    const withPhoto = (photoRows ?? []).find(
      (r) =>
        (r as { primary_photo_r2_key?: string | null }).primary_photo_r2_key,
    ) as { primary_photo_r2_key?: string | null } | undefined;
    coverPhotoUrl = withPhoto?.primary_photo_r2_key
      ? r2PublicUrl(R2_BUCKETS.media, withPhoto.primary_photo_r2_key)
      : null;
  } catch {
    coverPhotoUrl = null;
  }

  // Lowest active starting price → the card's "from ₱X" line.
  const activePrices = services
    .filter((s) => s.is_active && s.starting_price_php != null)
    .map((s) => s.starting_price_php as number);
  const cardStartingPrice = activePrices.length > 0 ? Math.min(...activePrices) : null;

  // Card badges the vendor genuinely holds — VERIFIED (verification_state) and
  // NEW (joined within 90 days). Peer-relative badges (Top Pick / Most Booked)
  // need the whole verified pool and aren't computed on this single-vendor
  // surface — the card renders the badges the vendor actually has.
  const cardBadges: Array<'verified' | 'new'> = [];
  const isVerified =
    verificationState === 'verified' || profile.public_visibility === 'verified';
  if (isVerified) {
    cardBadges.push('verified');
    const joinedMs = Date.parse(profile.created_at);
    if (
      Number.isFinite(joinedMs) &&
      Date.now() - joinedMs <= 90 * 24 * 60 * 60 * 1000
    ) {
      cardBadges.push('new');
    }
  }

  // Tier-resolved display name (hybrid-anonymity) — Free/Verified pre-reply show
  // the anonymized "<Category> · <City>" label; Pro/Enterprise + venue-exempt +
  // post-reply show the real business name.
  const primaryService = profile.services?.[0] ?? distinctCategories[0] ?? null;
  const isPaidTier = isTrueNameTier(tier);
  const cardDisplayName = resolveVendorDisplayName({
    business_name: profile.business_name,
    name_revealed_at: nameRevealedAt,
    primary_canonical_service: primaryService,
    location_city: profile.location_city,
    services: profile.services,
    screen_name: screenName,
    isPaidTier,
  });
  const cardNameRevealed = isVendorNameRevealed({
    name_revealed_at: nameRevealedAt,
    isPaidTier,
    services: profile.services,
  });
  // The service label on the card — prefer the vendor's own listed service.
  const cardServiceLabel = distinctCategories[0]
    ? displayServiceLabel(distinctCategories[0])
    : primaryService
      ? displayServiceLabel(primaryService)
      : null;

  // ── Category requests (own rows only) ───────────────────────────────────
  const { data: requestRows } = await supabase
    .from('taxonomy_category_requests')
    .select('request_id, proposed_label, status, mapped_to_canonical, resolution_note')
    .eq('proposed_by_vendor_id', profile.vendor_profile_id)
    .order('created_at', { ascending: false });
  const myRequests = (requestRows ?? []) as CategoryRequestRow[];

  // If ?add=<category> is in the URL, the "Add service" form for that category
  // is the expanded one. #1: a category can hold multiple listings.
  const addCategory =
    typeof search.add === 'string' &&
    (VENDOR_CATEGORIES as readonly string[]).includes(search.add)
      ? (search.add as VendorCategory)
      : null;

  // Guided "create a service" wizard (LIVE by default). The "Add a service"
  // / "Add coverage" links open it; kill-switch falls back to the inline form.
  const wizardEnabled = process.env.NEXT_PUBLIC_SERVICE_WIZARD_ENABLED !== 'false';

  // Live admin-taxonomy DISPLAY labels for the category picker.
  let tax: Awaited<ReturnType<typeof getTaxonomy>> | null = null;
  try {
    tax = await getTaxonomy();
  } catch {
    tax = null;
  }
  const labelFor = (cat: VendorCategory): string =>
    tax ? labelForVendorCategory(cat, tax) : VENDOR_CATEGORY_LABEL[cat];

  // ── Off-Season Promos nudge (Wave 5 "Soon" vendor benefit) ──────────────
  const now = new Date();
  const hasLiveOffPeak = services.some(
    (s) =>
      s.is_active &&
      s.discount_type === 'off_peak' &&
      s.discount_expires_at !== null &&
      new Date(s.discount_expires_at).getTime() > now.getTime(),
  );
  const offPeakCandidate =
    services.find((s) => s.is_active) ?? services[0] ?? null;
  const offPeakPrefillId =
    typeof search.offpeak === 'string' &&
    services.some((s) => s.vendor_service_id === search.offpeak)
      ? search.offpeak
      : null;

  let leanMonthsLabel = '';
  let suggestedExpiry: string | null = null;
  let suggestedConditions = '';
  let showOffSeasonNudge = false;
  if ((!hasLiveOffPeak && offPeakCandidate) || offPeakPrefillId) {
    try {
      const [bookings, blocks] = await Promise.all([
        fetchVendorPoolBookings(supabase, profile.vendor_profile_id),
        fetchVendorBlocks(supabase, profile.vendor_profile_id),
      ]);
      const lean = await deriveLeanMonths(
        bookings.map((b) => ({ date: b.bookedDate })),
        blocks.map((b) => ({ date: b.startDate })),
        { client: supabase, regionHint: profile.location_city },
      );
      leanMonthsLabel = formatLeanMonths(lean.months);
      suggestedExpiry = suggestPromoExpiry(lean.months, now);
      suggestedConditions = leanMonthsLabel
        ? `Off-season rate for ${leanMonthsLabel} bookings.`
        : 'Off-season rate for our lighter months.';
      showOffSeasonNudge =
        !hasLiveOffPeak && offPeakCandidate !== null && leanMonthsLabel.length > 0;
    } catch {
      showOffSeasonNudge = false;
    }
  }
  const offPeakTargetId = offPeakCandidate?.vendor_service_id ?? null;

  // "Add a service" / "Add coverage" → a category chooser. The guided wizard
  // needs a category (route /services/new/[category]); when the wizard is off,
  // each category opens the inline ?add= form on this page instead.
  const categoryHref = (cat: VendorCategory): string =>
    wizardEnabled
      ? `/vendor-dashboard/services/new/${cat}`
      : `/vendor-dashboard/services?add=${cat}#add-${cat}`;
  const specialistTools = specialistToolsForCategories(distinctCategories);

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {search.error ? (
        <p
          role="alert"
          className="rounded-md border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--m-blush-deep)', background: 'var(--m-blush)', color: 'var(--m-ink)' }}
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.saved ? (
        <p
          role="status"
          className="rounded-md border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--m-sage)', background: 'var(--m-sage)', color: 'var(--m-ink)' }}
        >
          Services updated.
        </p>
      ) : null}
      {search.requested ? (
        <p
          role="status"
          className="rounded-md border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--m-sage)', background: 'var(--m-sage)', color: 'var(--m-ink)' }}
        >
          Thanks — we&rsquo;ll review your service request and get back to you.
          There&rsquo;s always a place for what you do.
        </p>
      ) : null}

      {/* ── 1 · TIER BANNER ─────────────────────────────────────────────── */}
      <TierBanner tier={tierKey} />

      {/* Off-Season Promos nudge (Wave 5). */}
      {showOffSeasonNudge && offPeakTargetId ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <Snowflake aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                Your {leanMonthsLabel} look light — launch an off-season offer
              </p>
              <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                Couples shopping these months will see your deal first. We&rsquo;ll
                pre-fill an off-peak discount — you set the amount.
              </p>
            </div>
          </div>
          <Link
            href={`/vendor-dashboard/services?offpeak=${offPeakTargetId}#svc-${offPeakTargetId}`}
            className="button-primary shrink-0 whitespace-nowrap text-center"
          >
            Set up off-season offer
          </Link>
        </div>
      ) : null}

      {/* ── 2 · EXPLORE SERVICE-CARD PREVIEW ────────────────────────────── */}
      <section className="space-y-3">
        <SectionEyebrow>Your service card on Explore · preview</SectionEyebrow>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <ExploreCardPreview
            coverUrl={coverPhotoUrl ?? coverLogoUrl}
            displayName={cardDisplayName}
            nameRevealed={cardNameRevealed}
            businessName={profile.business_name}
            serviceLabel={cardServiceLabel}
            badges={cardBadges}
            rating={rating}
            reviewCount={reviewCount}
            startingPricePhp={cardStartingPrice}
            locationCity={profile.location_city}
            coverageRadiusKm={caps.serviceRadiusKm}
            recommendedByCount={recommendedByCount}
            reviewQuote={reviewQuote}
          />
          <div
            className="max-w-md rounded-xl border p-4 text-xs leading-relaxed lg:mt-1"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)', color: 'var(--m-slate)' }}
          >
            <p className="mb-1.5 font-semibold" style={{ color: 'var(--m-ink)' }}>
              This is exactly what couples see.
            </p>
            <p>
              Cover photo, badges, service by your name, rating, starting price,
              coverage, and a review quote come straight from your live profile —
              nothing here is a mock-up.
            </p>
            {cardNameRevealed ? null : (
              <p className="mt-2">
                Your business name stays hidden until you reply to a couple&rsquo;s
                first message
                {isPaidTier ? '' : ' — or you upgrade to a paid tier, which reveals it day one'}.
                Until then couples see the anonymized label above.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 3 · SERVICE COVERAGE ────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionEyebrow>Service coverage</SectionEyebrow>
        <div className="flex flex-wrap items-center gap-2">
          {distinctCategories.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
              No coverage yet — add a service to appear in that category&rsquo;s search.
            </p>
          ) : (
            distinctCategories.map((cat) => {
              const Icon = iconForVendorCategory(cat);
              const count = serviceCountByCategory[cat] ?? 0;
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: 'var(--m-line)',
                    background: 'var(--m-paper)',
                    color: 'var(--m-ink)',
                  }}
                >
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
                  {displayServiceLabel(cat)}
                  {count > 1 ? (
                    <span
                      className="rounded-full px-1.5 text-[11px] font-medium"
                      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
                    >
                      {count}
                    </span>
                  ) : null}
                </span>
              );
            })
          )}
          <Link
            href="#add-service-picker"
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--m-orange-3)', color: 'var(--m-orange-2)' }}
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add coverage
          </Link>
        </div>
      </section>

      {/* ── 4 · YOUR SERVICES ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionEyebrow>Your services</SectionEyebrow>
          <Link
            href="#add-service-picker"
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--m-orange-2)' }}
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add a service
          </Link>
        </div>

        {/* Category chooser — opens the guided wizard for the chosen category
            (or the inline ?add= form when the wizard is off). Both "Add a
            service" and "Add coverage" jump here. */}
        <details
          id="add-service-picker"
          className="scroll-mt-24 rounded-2xl border"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          open={addCategory !== null}
        >
          <summary
            className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium"
            style={{ color: 'var(--m-ink)' }}
          >
            <span className="inline-flex items-center gap-2">
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} style={{ color: 'var(--m-orange-2)' }} />
              Add a service or coverage
            </span>
            <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
          </summary>
          <div className="space-y-4 border-t px-4 pb-4 pt-4" style={{ borderColor: 'var(--m-line)' }}>
            <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
              Pick a category — a category can hold more than one listing, so
              you can add another even where you already have coverage.
            </p>
            {SERVICE_GROUPS.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((cat) => {
                    const Icon = iconForVendorCategory(cat);
                    const count = serviceCountByCategory[cat] ?? 0;
                    return (
                      <Link
                        key={cat}
                        href={categoryHref(cat)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors"
                        style={{
                          borderColor: count > 0 ? 'var(--m-orange-3)' : 'var(--m-line)',
                          background: 'var(--m-paper)',
                          color: count > 0 ? 'var(--m-orange-2)' : 'var(--m-ink)',
                        }}
                      >
                        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
                        {labelFor(cat)}
                        {count > 0 ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{count} added</span>
                        ) : (
                          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} style={{ color: 'var(--m-slate-4)' }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* Inline add form when deep-linked via ?add=<category> (wizard-off
            fallback path). */}
        {addCategory ? (
          <div
            className="space-y-3 rounded-2xl border p-5"
            id={`add-${addCategory}`}
            style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-paper)' }}
          >
            <h3 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              Add: {labelFor(addCategory)}
            </h3>
            <AddServiceForm
              addCategory={addCategory}
              labelFor={labelFor}
              slotsCap={slotsCap}
              slotsCapForUi={slotsCapForUi}
              showBranchPicker={showBranchPicker}
              branches={branches}
            />
          </div>
        ) : null}

        {services.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed p-8 text-center"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          >
            <Layers
              aria-hidden
              className="mx-auto mb-2 h-6 w-6"
              strokeWidth={1.5}
              style={{ color: 'var(--m-slate-4)' }}
            />
            <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              No services yet.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs" style={{ color: 'var(--m-slate-2)' }}>
              Add your first service so couples can find and book you.
            </p>
            <Link href="#add-service-picker" className="button-primary mt-3 inline-flex">
              Add a service
            </Link>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {services.map((svc) => {
              const Icon = iconForVendorCategory(svc.category);
              const priceLabel = svc.starting_price_php
                ? `from ${formatPhp(svc.starting_price_php)}`
                : 'quote on request';
              const paxLabel =
                svc.added_pax_price_php && svc.added_pax_price_php > 0
                  ? `+${formatPhp(svc.added_pax_price_php)}/guest`
                  : 'flat';
              const branchLabel =
                svc.branch_id && branchLabelById.has(svc.branch_id)
                  ? (branchLabelById.get(svc.branch_id) as string)
                  : 'You';
              const hasSlots =
                (slotsByService.get(svc.vendor_service_id)?.length ?? 0) > 0;
              return (
                <li
                  key={svc.vendor_service_id}
                  id={`svc-${svc.vendor_service_id}`}
                  className="scroll-mt-24 overflow-hidden rounded-2xl border"
                  style={{
                    borderColor:
                      offPeakPrefillId === svc.vendor_service_id
                        ? 'var(--m-orange-3)'
                        : 'var(--m-line)',
                    background: 'var(--m-paper)',
                    opacity: svc.is_active ? 1 : 0.7,
                  }}
                >
                  {/* Row header — icon · name · price · flat/pax · assigned · toggle */}
                  <div className="flex items-center gap-3 p-4">
                    <span
                      aria-hidden
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate)' }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                        {svc.title?.trim() || displayServiceLabel(svc.category)}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
                        {priceLabel} · {paxLabel} · assigned to {branchLabel}
                        {svc.is_active ? '' : ' · hidden'}
                      </p>
                    </div>
                    {svc.discount_type ? (
                      <DiscountBadge
                        type={svc.discount_type}
                        value={svc.discount_value}
                        expiresAt={svc.discount_expires_at}
                      />
                    ) : null}
                    {/* on/off toggle (is_active) */}
                    <form action={toggleVendorServiceActive}>
                      <input type="hidden" name="vendor_service_id" value={svc.vendor_service_id} />
                      <input type="hidden" name="is_active" value={svc.is_active ? 'false' : 'true'} />
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={svc.is_active}
                        aria-label={svc.is_active ? 'Hide service from Explore' : 'Show service on Explore'}
                        title={svc.is_active ? 'Live — tap to hide' : 'Hidden — tap to show'}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{
                          background: svc.is_active ? 'var(--m-ink)' : 'var(--m-paper-2)',
                          color: svc.is_active ? 'var(--m-paper)' : 'var(--m-slate-2)',
                        }}
                      >
                        {svc.is_active ? (
                          <Eye className="h-4 w-4" strokeWidth={1.75} />
                        ) : (
                          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Collapsible full editor — preserves every existing control
                      (price · crew · pax · capacity · last-minute · branch ·
                      discount · exclusive perk · comes-with links · time slots ·
                      payment schedule · delete) without cluttering the row. */}
                  <details
                    className="border-t"
                    style={{ borderColor: 'var(--m-line)' }}
                    open={offPeakPrefillId === svc.vendor_service_id}
                  >
                    <summary
                      className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-2.5 text-xs font-medium"
                      style={{ color: 'var(--m-slate)' }}
                    >
                      <span>Edit details</span>
                      <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </summary>
                    <div className="space-y-3 border-t px-4 pb-4 pt-4" style={{ borderColor: 'var(--m-line)' }}>
                      <form action={updateVendorService} className="space-y-3">
                        <input type="hidden" name="vendor_service_id" value={svc.vendor_service_id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Starting price (PHP)" htmlFor={`price-${svc.vendor_service_id}`}>
                            <input
                              id={`price-${svc.vendor_service_id}`}
                              name="starting_price_php"
                              type="number"
                              min={0}
                              step={1}
                              defaultValue={svc.starting_price_php ?? ''}
                              placeholder="e.g. 25000"
                              className="input-field"
                            />
                          </Field>
                          <Field label="Crew size" htmlFor={`crew-${svc.vendor_service_id}`}>
                            <input
                              id={`crew-${svc.vendor_service_id}`}
                              name="crew_size"
                              type="number"
                              min={0}
                              step={1}
                              defaultValue={svc.crew_size ?? ''}
                              placeholder="e.g. 4"
                              className="input-field"
                            />
                          </Field>
                        </div>
                        <Field
                          label="Additional cost per added guest (PHP)"
                          htmlFor={`addpax-${svc.vendor_service_id}`}
                        >
                          <input
                            id={`addpax-${svc.vendor_service_id}`}
                            name="added_pax_price_php"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={svc.added_pax_price_php ?? ''}
                            placeholder="Optional — blank = no extra charge"
                            className="input-field"
                          />
                        </Field>
                        {slotsCap > 0 ? (
                          <Field
                            label={`Bookings per day (max ${slotsCapForUi})`}
                            htmlFor={`cap-${svc.vendor_service_id}`}
                            help={
                              hasSlots
                                ? 'Disabled — time slots below set capacity per window instead.'
                                : undefined
                            }
                          >
                            <input
                              id={`cap-${svc.vendor_service_id}`}
                              name="daily_capacity"
                              type="number"
                              min={1}
                              max={slotsCapForUi}
                              step={1}
                              defaultValue={svc.daily_capacity ?? ''}
                              placeholder="e.g. 2"
                              disabled={hasSlots}
                              className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </Field>
                        ) : null}
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--m-slate)' }}>
                          <input
                            type="checkbox"
                            name="crew_meal_required"
                            defaultChecked={svc.crew_meal_required}
                            className="h-4 w-4 cursor-pointer accent-[var(--m-ink)]"
                          />
                          <span>Crew meal required (feeds couple&rsquo;s budget)</span>
                        </label>
                        <LastMinuteFields
                          idPrefix={svc.vendor_service_id}
                          leadDefault={svc.recommended_lead_time_months}
                          endDefault={svc.last_minute_end_months}
                          surchargeDefault={svc.last_minute_surcharge_pct}
                        />
                        {showBranchPicker ? (
                          <BranchSelect
                            id={`branch-${svc.vendor_service_id}`}
                            branches={branches}
                            defaultValue={svc.branch_id ?? ''}
                          />
                        ) : null}
                        {(() => {
                          const isPrefillTarget =
                            offPeakPrefillId === svc.vendor_service_id && !svc.discount_type;
                          return (
                            <DiscountFields
                              idPrefix={svc.vendor_service_id}
                              typeDefault={
                                svc.discount_type ?? (isPrefillTarget ? 'off_peak' : undefined)
                              }
                              valueDefault={svc.discount_value ?? undefined}
                              expiresDefault={
                                svc.discount_expires_at ??
                                (isPrefillTarget && suggestedExpiry ? suggestedExpiry : undefined)
                              }
                              conditionsDefault={
                                svc.discount_conditions_md ??
                                (isPrefillTarget ? suggestedConditions : undefined)
                              }
                              forceOpen={isPrefillTarget}
                            />
                          );
                        })()}
                        <ExclusivePerkField
                          idPrefix={svc.vendor_service_id}
                          perkDefault={svc.exclusive_perk_text ?? undefined}
                        />
                        <div className="flex items-center justify-between">
                          <ConfirmForm
                            action={deleteVendorService}
                            title="Delete this service?"
                            confirmLabel="Delete service"
                            message={`Deleting "${
                              svc.title?.trim() || displayServiceLabel(svc.category)
                            }" removes it from your listings, along with any "comes with" bundle links${
                              hasSlots ? ' and all its time slots' : ''
                            }. This can't be undone.`}
                          >
                            <input type="hidden" name="vendor_service_id" value={svc.vendor_service_id} />
                            <button
                              type="submit"
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
                              style={{ borderColor: 'var(--m-line)', color: 'var(--m-blush-deep)' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Delete
                            </button>
                          </ConfirmForm>
                          <SubmitButton className="button-primary" pendingLabel="Saving…">
                            Save changes
                          </SubmitButton>
                        </div>
                      </form>

                      {/* Comes-with links — own action, sibling of the form. */}
                      {distinctCategories.filter((c) => c !== svc.category).length > 0 ? (
                        <form
                          action={setServiceLinks}
                          className="rounded-lg border p-3"
                          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
                        >
                          <input type="hidden" name="vendor_service_id" value={svc.vendor_service_id} />
                          <p className="text-xs font-medium" style={{ color: 'var(--m-ink)' }}>
                            Comes with
                          </p>
                          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
                            Other categories this service bundles in — the couple&rsquo;s
                            card shows &ldquo;comes with&rdquo; these, included in your price.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                            {distinctCategories
                              .filter((c) => c !== svc.category)
                              .map((cat) => (
                                <label
                                  key={cat}
                                  className="flex items-center gap-1.5 text-xs"
                                  style={{ color: 'var(--m-slate)' }}
                                >
                                  <input
                                    type="checkbox"
                                    name="linked"
                                    value={cat}
                                    defaultChecked={linkedByServiceId
                                      .get(svc.vendor_service_id)
                                      ?.has(cat)}
                                    className="h-3.5 w-3.5 cursor-pointer accent-[var(--m-ink)]"
                                  />
                                  <span>{displayServiceLabel(cat)}</span>
                                </label>
                              ))}
                          </div>
                          <div className="mt-2 flex justify-end">
                            <SubmitButton
                              className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-[11px] font-medium"
                              pendingLabel="Saving…"
                            >
                              Save links
                            </SubmitButton>
                          </div>
                        </form>
                      ) : null}

                      <SlotEditor
                        serviceId={svc.vendor_service_id}
                        slots={slotsByService.get(svc.vendor_service_id) ?? []}
                        canPlot={canPlotSlots}
                      />
                      <PaymentScheduleEditor
                        serviceId={svc.vendor_service_id}
                        initial={(scheduleRowsByService.get(svc.vendor_service_id) ?? []).map(
                          rowToDraft,
                        )}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── 5 · SPECIALIST TOOLS ────────────────────────────────────────── */}
      {specialistTools.length > 0 ? (
        <section className="space-y-3">
          <SectionEyebrow>Specialist tools · shown only for your service categories</SectionEyebrow>
          <div className="grid gap-3 sm:grid-cols-2">
            {specialistTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.key}
                  href={tool.href}
                  className="group flex items-start gap-3 rounded-2xl border p-4 transition-colors"
                  style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                      {tool.title}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-2)' }}>
                      {tool.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Request a new category — the "Add coverage" on-ramp for services not in
          the directory (spec 0023 §3.2c). */}
      <section
        className="space-y-4 rounded-2xl border p-5"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            Don&rsquo;t see your service?
          </h2>
          <p className="max-w-prose text-sm" style={{ color: 'var(--m-slate)' }}>
            Tell us what you do — we&rsquo;ll review it and add it to the directory.
          </p>
        </div>
        <form action={proposeCategory} className="grid gap-3 sm:grid-cols-[2fr_3fr_auto] sm:items-end">
          <Field label="Service name" htmlFor="propose-label">
            <input
              id="propose-label"
              name="proposed_label"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Table Linen Rental"
              className="input-field"
            />
          </Field>
          <Field label="What is it? (optional)" htmlFor="propose-note">
            <input
              id="propose-note"
              name="proposed_note"
              maxLength={400}
              placeholder="A sentence so we can place it right."
              className="input-field"
            />
          </Field>
          <SubmitButton className="button-primary" pendingLabel="Sending…">
            Request
          </SubmitButton>
        </form>
        {myRequests.length > 0 ? (
          <ul className="divide-y rounded-xl border" style={{ borderColor: 'var(--m-line)' }}>
            {myRequests.map((r) => (
              <li key={r.request_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                  {r.proposed_label}
                </span>
                <RequestStatusBadge status={r.status} mapped={r.mapped_to_canonical} />
                {r.resolution_note ? (
                  <span className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                    {r.resolution_note}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}

/** Small mono eyebrow header used to label each prototype section. */
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
      style={{ color: 'var(--m-slate-3)' }}
    >
      {children}
    </h2>
  );
}

/**
 * ── 1 · Amber tier banner ──────────────────────────────────────────────────
 * Reads the tier's caps from TIER_CAPS (via tierCaps) so every number is the
 * live capability grid, never hardcoded. Formats each axis into the prototype's
 * one-line summary.
 */
function TierBanner({ tier }: { tier: VendorTier }) {
  const caps = tierCaps(tier);
  const cat = (n: number) => (Number.isFinite(n) ? String(n) : 'all');
  const seats = caps.agentAccounts === 0 ? '0' : Number.isFinite(caps.agentAccounts) ? String(caps.agentAccounts) : 'unlimited';
  const boost = Number.isFinite(caps.serviceRadiusKm) ? `${caps.serviceRadiusKm} km` : 'nationwide';
  const answering = Number.isFinite(caps.inAppCustomersPerWeek)
    ? `${caps.inAppCustomersPerWeek}/week`
    : 'unlimited';
  const bookings = caps.slotsPerDay === 0 ? 'none' : Number.isFinite(caps.slotsPerDay) ? `${caps.slotsPerDay}/day` : 'unlimited';
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4"
      style={{ background: 'var(--m-orange-4)', borderColor: 'var(--m-orange-3)' }}
    >
      <span
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]"
        style={{ background: 'var(--m-paper)', color: 'var(--m-orange-2)', border: '1px solid var(--m-orange-3)' }}
      >
        Your tier · {TIER_LABEL[tier]}
      </span>
      <p className="text-sm" style={{ color: 'var(--m-ink)' }}>
        <TierStat>categories {cat(caps.parentCategories)}</TierStat>
        <TierStat>team seats {seats}</TierStat>
        <TierStat>branches {tier === 'enterprise' ? 'Yes' : 'No'}</TierStat>
        <TierStat>boost {boost}</TierStat>
        <TierStat>answering {answering}</TierStat>
        <TierStat last>bookings/day {bookings}</TierStat>
      </p>
    </div>
  );
}

function TierStat({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <span className="font-medium">{children}</span>
      {last ? null : <span style={{ color: 'var(--m-orange-2)' }}> · </span>}
    </>
  );
}

function RequestStatusBadge({
  status,
  mapped,
}: {
  status: CategoryRequestRow['status'];
  mapped: string | null;
}) {
  const map: Record<CategoryRequestRow['status'], { label: string; bg: string; fg: string }> = {
    pending: { label: 'Pending review', bg: 'var(--m-orange-4)', fg: 'var(--m-orange-2)' },
    promoted: { label: 'Added to directory', bg: 'var(--m-sage)', fg: 'var(--m-sage-deep)' },
    mapped: {
      label: mapped ? `Use "${mapped}"` : 'Mapped to an existing category',
      bg: 'var(--m-paper-2)',
      fg: 'var(--m-slate)',
    },
    kept_private: { label: 'Kept for your listing', bg: 'var(--m-paper-2)', fg: 'var(--m-slate-2)' },
    rejected: { label: 'Not added', bg: 'var(--m-blush)', fg: 'var(--m-blush-deep)' },
  };
  const { label, bg, fg } = map[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

/**
 * The inline "Add: <Category>" form (wizard-off fallback). Identical fields to
 * the pre-reskin add form; kept intact so a deep-linked ?add= still works.
 */
function AddServiceForm({
  addCategory,
  labelFor,
  slotsCap,
  slotsCapForUi,
  showBranchPicker,
  branches,
}: {
  addCategory: VendorCategory;
  labelFor: (cat: VendorCategory) => string;
  slotsCap: number;
  slotsCapForUi: number;
  showBranchPicker: boolean;
  branches: { branch_id: string; branch_label: string }[];
}) {
  return (
    <form action={createVendorService} className="space-y-4">
      <input type="hidden" name="category" value={addCategory} />
      <Field
        label="Service name (optional)"
        htmlFor={`new-title-${addCategory}`}
        help="Name this listing so couples can tell your offerings apart — e.g. 'Classic Booth' vs '360 Booth'."
      >
        <input
          id={`new-title-${addCategory}`}
          name="title"
          type="text"
          maxLength={80}
          placeholder={labelFor(addCategory)}
          className="input-field"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starting price (PHP)"
          htmlFor={`new-price-${addCategory}`}
          help="Whole pesos. Leave blank for 'quote on request'."
        >
          <input
            id={`new-price-${addCategory}`}
            name="starting_price_php"
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 25000"
            className="input-field"
          />
        </Field>
        <Field label="Crew size" htmlFor={`new-crew-${addCategory}`} help="How many people you bring on the day.">
          <input
            id={`new-crew-${addCategory}`}
            name="crew_size"
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 4"
            className="input-field"
          />
        </Field>
      </div>
      <Field
        label="Additional cost per added guest (PHP)"
        htmlFor={`new-addpax-${addCategory}`}
        help="Optional. Charged per guest above the count you quote. Leave blank for no extra charge for added guests."
      >
        <input
          id={`new-addpax-${addCategory}`}
          name="added_pax_price_php"
          type="number"
          min={0}
          step={1}
          placeholder="e.g. 350"
          className="input-field"
        />
      </Field>
      {slotsCap > 0 ? (
        <Field
          label="Bookings per day (optional)"
          htmlFor={`new-cap-${addCategory}`}
          help={`How many of this you can serve in a day — e.g. 2 photobooths → 2. Your plan allows up to ${slotsCapForUi}.`}
        >
          <input
            id={`new-cap-${addCategory}`}
            name="daily_capacity"
            type="number"
            min={1}
            max={slotsCapForUi}
            step={1}
            placeholder={`e.g. ${Math.min(2, slotsCapForUi)}`}
            className="input-field"
          />
        </Field>
      ) : null}
      <label
        className="flex items-start gap-3 rounded-xl border p-3"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <input
          type="checkbox"
          name="crew_meal_required"
          className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--m-ink)]"
        />
        <span>
          <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Crew meal required
          </span>
          <span className="block text-xs" style={{ color: 'var(--m-slate-2)' }}>
            Feeds the couple&rsquo;s budget automatically.
          </span>
        </span>
      </label>
      <LastMinuteFields idPrefix={`new-${addCategory}`} />
      {showBranchPicker ? (
        <BranchSelect id={`new-branch-${addCategory}`} branches={branches} defaultValue="" />
      ) : null}
      <DiscountFields idPrefix={`new-${addCategory}`} />
      <ExclusivePerkField idPrefix={`new-${addCategory}`} />
      <div className="flex items-center justify-between">
        <Link href="/vendor-dashboard/services" className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Cancel
        </Link>
        <SubmitButton className="button-primary" pendingLabel="Adding…">
          Add service
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Last-minute booking fields (Setnayan AI §4). Unchanged behaviour; restyled to
 * the editorial palette.
 */
function LastMinuteFields({
  idPrefix,
  leadDefault,
  endDefault,
  surchargeDefault,
}: {
  idPrefix: string;
  leadDefault?: number | null;
  endDefault?: number | null;
  surchargeDefault?: number | null;
}) {
  return (
    <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        Last-minute bookings
      </p>
      <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
        Setnayan AI surfaces you to couples close to their date. Set your
        comfortable lead time, how late you&rsquo;ll still take a rush booking,
        and an optional surcharge for it.
      </p>
      <Field
        label="Recommended lead time (months)"
        htmlFor={`${idPrefix}-lm-lead`}
        help="Book-by-here, no rush. Fractional OK — 0.5 ≈ 2 weeks. Blank = no lead time, always bookable."
      >
        <input
          id={`${idPrefix}-lm-lead`}
          name="recommended_lead_time_months"
          type="number"
          min={0}
          step="0.5"
          placeholder="e.g. 3"
          defaultValue={leadDefault ?? ''}
          className="input-field"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Accept until (months before)"
          htmlFor={`${idPrefix}-lm-end`}
          help="Latest you&rsquo;ll accept. Blank = up to the night before."
        >
          <input
            id={`${idPrefix}-lm-end`}
            name="last_minute_end_months"
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 1"
            defaultValue={endDefault ?? ''}
            className="input-field"
          />
        </Field>
        <Field label="Late surcharge (%)" htmlFor={`${idPrefix}-lm-pct`} help="Optional, 0–100. Blank = same price.">
          <input
            id={`${idPrefix}-lm-pct`}
            name="last_minute_surcharge_pct"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="e.g. 15"
            defaultValue={surchargeDefault ?? ''}
            className="input-field"
          />
        </Field>
      </div>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Make sure you can honor bookings all the way up to your &ldquo;accept
        until&rdquo; point.
      </p>
    </div>
  );
}

/**
 * Branch-scoped grouping picker (Branches V1.x) — Enterprise-with-branches only.
 */
function BranchSelect({
  id,
  branches,
  defaultValue,
}: {
  id: string;
  branches: { branch_id: string; branch_label: string }[];
  defaultValue: string;
}) {
  return (
    <Field label="Branch" htmlFor={id} help="Which location offers this service.">
      <select id={id} name="branch_id" defaultValue={defaultValue} className="input-field cursor-pointer">
        <option value="">Main (no branch)</option>
        {branches.map((b) => (
          <option key={b.branch_id} value={b.branch_id}>
            {b.branch_label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ── Discount type labels ─────────────────────────────────────────────────────
const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  early_booking: 'Early Booking',
  off_peak: 'Off-Peak',
  bundle: 'Package Bundle',
  promo: 'Limited-Time Promo',
  returning: 'Returning Couple',
};

const DISCOUNT_TYPE_HELPS: Record<string, string> = {
  early_booking: '% or flat off for bookings placed well before the event date.',
  off_peak: 'Lower rate for non-peak months (specify in Conditions).',
  bundle: 'Reduced price when ≥2 services from your profile are purchased by the same couple.',
  promo: 'Expiry-gated discount — requires an end date.',
  returning: 'Loyalty rate for couples who have completed a prior booking with you.',
};

/** Collapsible "Discount" section for the service editor. */
function DiscountFields({
  idPrefix,
  typeDefault,
  valueDefault,
  expiresDefault,
  conditionsDefault,
  forceOpen = false,
}: {
  idPrefix: string;
  typeDefault?: string;
  valueDefault?: number;
  expiresDefault?: string;
  conditionsDefault?: string;
  forceOpen?: boolean;
}) {
  const hasDiscount = Boolean(typeDefault) || forceOpen;
  let expiresDateVal = '';
  if (expiresDefault) {
    try {
      expiresDateVal = expiresDefault.slice(0, 10);
    } catch {
      expiresDateVal = '';
    }
  }
  return (
    <details className="rounded-xl border" style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }} open={hasDiscount}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          <Tag aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
          Discount
          {hasDiscount ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              Active
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
      </summary>
      <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: 'var(--m-line)' }}>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Optional. When set, the discount type and value appear on your service card.
          Leave the type as &ldquo;None&rdquo; to remove any active discount.
        </p>
        <Field
          label="Discount type"
          htmlFor={`${idPrefix}-disc-type`}
          help={typeDefault ? DISCOUNT_TYPE_HELPS[typeDefault] : undefined}
        >
          <select
            id={`${idPrefix}-disc-type`}
            name="discount_type"
            defaultValue={typeDefault ?? ''}
            className="input-field cursor-pointer"
          >
            <option value="">None — no discount</option>
            {Object.entries(DISCOUNT_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Discount amount"
          htmlFor={`${idPrefix}-disc-val`}
          help="Positive number. Use a whole number for % (e.g. 10 = 10%) or PHP flat (e.g. 5000)."
        >
          <input
            id={`${idPrefix}-disc-val`}
            name="discount_value"
            type="number"
            min={0.01}
            step="any"
            placeholder="e.g. 10 or 5000"
            defaultValue={valueDefault ?? ''}
            className="input-field"
          />
        </Field>
        <Field label="Promo expiry date (required for Limited-Time Promo)" htmlFor={`${idPrefix}-disc-exp`}>
          <input
            id={`${idPrefix}-disc-exp`}
            name="discount_expires_at"
            type="date"
            defaultValue={expiresDateVal}
            className="input-field"
          />
        </Field>
        <Field
          label="Conditions (optional)"
          htmlFor={`${idPrefix}-disc-cond`}
          help="Markdown supported. E.g. 'Valid for bookings ≥ 6 months before the event.'"
        >
          <textarea
            id={`${idPrefix}-disc-cond`}
            name="discount_conditions_md"
            rows={3}
            maxLength={1000}
            placeholder="Describe any conditions, inclusions, or fine print…"
            defaultValue={conditionsDefault ?? ''}
            className="input-field resize-none"
          />
        </Field>
      </div>
    </details>
  );
}

/** "Setnayan Exclusive" perk field. Required to publish; optional for drafts. */
function ExclusivePerkField({
  idPrefix,
  perkDefault,
}: {
  idPrefix: string;
  perkDefault?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)' }}>
      <div className="flex items-center gap-2">
        <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-orange-2)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          Setnayan Exclusive
        </p>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ background: 'var(--m-paper)', color: 'var(--m-orange-2)' }}
        >
          Required to publish
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
        A hidden perk you offer exclusively to couples who book through Setnayan.
        It&rsquo;s revealed in-chat only after the vendor accepts the inquiry.
        It&rsquo;s contractually binding once revealed — so make it meaningful.
      </p>
      <Field
        label="Exclusive perk"
        htmlFor={`${idPrefix}-excl-perk`}
        help="Cannot be blank if you want to publish (activate) this service."
      >
        <input
          id={`${idPrefix}-excl-perk`}
          name="exclusive_perk_text"
          type="text"
          maxLength={500}
          placeholder="e.g. Free 1-hour extension · Complimentary styling session · Waived travel fee within 30 km"
          defaultValue={perkDefault ?? ''}
          className="input-field"
        />
      </Field>
    </div>
  );
}

/** Inline discount badge shown on the service row when a discount is active. */
function DiscountBadge({
  type,
  value,
  expiresAt,
}: {
  type: string;
  value: number | null;
  expiresAt: string | null;
}) {
  const label = DISCOUNT_TYPE_LABELS[type] ?? type;
  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  if (expired) return null;
  return (
    <span
      className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] sm:inline-flex"
      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
    >
      <Tag className="h-3 w-3" strokeWidth={2} />
      {label}
      {value != null ? ` · ${value}` : ''}
    </span>
  );
}

/**
 * Time-bound slot sub-editor (tier #3, Enterprise). Restyled to the editorial
 * palette; behaviour unchanged.
 */
function SlotEditor({
  serviceId,
  slots,
  canPlot,
}: {
  serviceId: string;
  slots: VendorServiceTimeSlot[];
  canPlot: boolean;
}) {
  if (slots.length === 0 && !canPlot) return null;
  return (
    <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}>
      <div className="flex items-center gap-1.5">
        <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Time slots (Enterprise)
        </p>
      </div>
      <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
        Named per-day windows, each with its own capacity. When you set slots,
        couples pick one at booking and they override &ldquo;Bookings per
        day&rdquo; for this service.
      </p>

      {slots.length > 0 ? (
        <ul className="divide-y rounded-lg border" style={{ borderColor: 'var(--m-line)' }}>
          {slots.map((slot) => (
            <li key={slot.slot_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                  {slot.slot_label}
                </span>{' '}
                <span style={{ color: 'var(--m-slate-2)' }}>
                  {formatSlotTime(slot.start_time)}–{formatSlotTime(slot.end_time)}
                  {' · '}up to {slot.slot_capacity}/day
                </span>
              </span>
              <form action={deleteServiceTimeSlot}>
                <input type="hidden" name="slot_id" value={slot.slot_id} />
                <button
                  type="submit"
                  aria-label={`Remove time slot ${slot.slot_label}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ background: 'var(--m-paper-2)', color: 'var(--m-blush-deep)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {canPlot ? (
        <form
          action={addServiceTimeSlot}
          className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <input type="hidden" name="vendor_service_id" value={serviceId} />
          <Field label="Label" htmlFor={`slot-label-${serviceId}`}>
            <input
              id={`slot-label-${serviceId}`}
              name="slot_label"
              type="text"
              required
              maxLength={SLOT_LABEL_MAX}
              placeholder="e.g. AM Ceremony"
              className="input-field"
            />
          </Field>
          <Field label="Start" htmlFor={`slot-start-${serviceId}`}>
            <input id={`slot-start-${serviceId}`} name="start_time" type="time" required step={1800} className="input-field" />
          </Field>
          <Field label="End" htmlFor={`slot-end-${serviceId}`}>
            <input id={`slot-end-${serviceId}`} name="end_time" type="time" required step={1800} className="input-field" />
          </Field>
          <Field label="Capacity" htmlFor={`slot-cap-${serviceId}`}>
            <input
              id={`slot-cap-${serviceId}`}
              name="slot_capacity"
              type="number"
              min={1}
              max={SLOT_CAPACITY_MAX}
              step={1}
              defaultValue={1}
              className="input-field"
            />
          </Field>
          <SubmitButton
            className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium"
            pendingLabel="Adding…"
          >
            Add slot
          </SubmitButton>
        </form>
      ) : (
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Time slots are an Enterprise feature — these existing slots stay active
          and you can remove them anytime.
        </p>
      )}
    </div>
  );
}
