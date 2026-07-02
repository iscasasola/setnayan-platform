import Link from 'next/link';
import { Fragment } from 'react';
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
import {
  fetchVendorServices,
  fetchDiscountsByService,
  fetchInclusionsByService,
  fetchBracketsByService,
} from '@/lib/vendor-services';
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
import { tierCaps, canPlotTimeSlots } from '@/lib/vendor-tier-caps';
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
} from '@/lib/vendors';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { labelForVendorCategory } from '@/lib/vendor-category-taxonomy';
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
import { PaymentScheduleEditor } from './payment-schedule-editor';
import { fetchAddonsByService } from '@/lib/vendor-service-addons';
import { AddonsEditor } from './addons-editor';
import {
  createVendorService,
  proposeCategory,
  updateVendorService,
  toggleVendorServiceActive,
  deleteVendorService,
  addServiceTimeSlot,
  deleteServiceTimeSlot,
  setServiceLinks,
} from '../actions';
import {
  fetchVendorCoverages,
  getCoverageTaxonomy,
  resolveCoverageLabels,
} from '@/lib/vendor-coverages';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import { CoveragePanel } from './coverage-panel';
import { PricingBasisEditor, IncludedFlags } from './pricing-basis-editor';
import { ManagerTabs } from './manager-tabs';
import { ShowcaseMediaFields } from './showcase-media-fields';
import { ServiceCardLivePreview } from './service-card-live-preview';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  InclusionsEditor,
  DiscountsEditor,
  PriceBracketsEditor,
  type DiscountDraft,
  type InclusionDraft,
  type BracketDraft,
} from './service-list-editors';

export type ServicesManagerSearch = {
  saved?: string;
  error?: string;
  add?: string;
  requested?: string;
  /** Off-Season Promos nudge — when set to one of the vendor's own
   *  vendor_service_id values, that service's Discount section opens
   *  pre-filled with an `off_peak` discount keyed to the lean months. */
  offpeak?: string;
};

type CategoryRequestRow = {
  request_id: string;
  proposed_label: string;
  status: 'pending' | 'promoted' | 'mapped' | 'kept_private' | 'rejected';
  mapped_to_canonical: string | null;
  resolution_note: string | null;
};

export async function VendorServicesManager({
  search,
  basePath = '/vendor-dashboard/services',
}: {
  search: ServicesManagerSearch;
  basePath?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const services = await fetchVendorServices(supabase, profile.vendor_profile_id);

  const serviceIdList = services.map((s) => s.vendor_service_id);

  // ── Coverage-first rework: first-class coverages + the LIVE taxonomy tree ──
  // (parent → branch → leaf, read from the admin taxonomy so admin edits flow
  // through with no deploy). Each read fails soft to empty so the page renders.
  const [vendorCoverages, coverageTree, coverageLabels, eventVocab] =
    await Promise.all([
      fetchVendorCoverages(supabase, profile.vendor_profile_id).catch(() => []),
      getCoverageTaxonomy().catch(() => []),
      resolveCoverageLabels().catch(() => null),
      getEventTypeVocab().catch(() => []),
    ]);
  const serviceCountByCoverage = services.reduce<Record<number, number>>(
    (m, s) => {
      if (s.coverage_id != null) m[s.coverage_id] = (m[s.coverage_id] ?? 0) + 1;
      return m;
    },
    {},
  );
  const coverageItems = vendorCoverages.map((c) => {
    const pathLabel = coverageLabels
      ? coverageLabels.pathLabel(c.canonical_service)
      : c.canonical_service;
    // "Parent › Branch › Leaf" → grouping key + pill label for Your coverage.
    const segments = pathLabel.split(' › ');
    return {
      id: c.id,
      canonicalService: c.canonical_service,
      pathLabel,
      parentLabel: segments[0] ?? pathLabel,
      leafLabel: segments[segments.length - 1] ?? pathLabel,
      eventTypes: c.event_types,
      faiths: c.faiths ?? [],
      serviceCount: serviceCountByCoverage[c.id] ?? 0,
    };
  });
  const eventTypeOptions = eventVocab.map((e) => ({ key: e.key, label: e.label }));
  const faithOptions = FAITH_REGISTRY.map((f) => ({ key: f.faithCol, label: f.label }));
  // Distinct tier-1 parent folders the vendor's coverages touch (for the "Parents
  // N of M" counter). Maps each covered leaf → its parent folder via the live tree.
  const leafToParentFolder = new Map<string, string>();
  for (const p of coverageTree)
    for (const b of p.branches)
      for (const l of b.leaves) leafToParentFolder.set(l.canonicalService, p.folderId);
  const coveredParentCount = new Set(
    vendorCoverages
      .map((c) => leafToParentFolder.get(c.canonical_service))
      .filter((f): f is string => Boolean(f)),
  ).size;
  const coverageLabelById = new Map(coverageItems.map((c) => [c.id, c.pathLabel]));
  // Group the service list by coverage (in the coverage panel's order; unassigned
  // cards last). A stable sort keeps each group's created_at order; the render
  // below emits a group header when the coverage changes.
  const coverageOrder = new Map(coverageItems.map((c, idx) => [c.id, idx]));
  const listedServices = [...services].sort((a, b) => {
    const ra = a.coverage_id != null ? coverageOrder.get(a.coverage_id) ?? 9998 : 9999;
    const rb = b.coverage_id != null ? coverageOrder.get(b.coverage_id) ?? 9998 : 9999;
    return ra - rb;
  });
  const addonsByService = await fetchAddonsByService(supabase, serviceIdList);
  // Child-table lists (multi-discount + free inclusions + Fixed pax brackets ·
  // migration 20270502342558), grouped by service for the off-peak nudge, row
  // badge, and the Phase 3b list editors on each form. Batched into one round-trip.
  const [discountsByService, inclusionsByService, bracketsByService] =
    await Promise.all([
      fetchDiscountsByService(supabase, serviceIdList),
      fetchInclusionsByService(supabase, serviceIdList),
      fetchBracketsByService(supabase, serviceIdList),
    ]);

  // Presigned display URLs for existing showcase media (Phase 3c) so the edit
  // forms render thumbnails of what's already uploaded. Only refs that exist;
  // resolved in parallel; fail-soft per ref (a signing hiccup degrades to a
  // filename chip in FileUpload, never a broken page).
  const showcaseRefs = Array.from(
    new Set(
      services.flatMap((s) => [
        ...(s.primary_photo_r2_key ? [s.primary_photo_r2_key] : []),
        ...(s.showcase_video_r2_key ? [s.showcase_video_r2_key] : []),
        ...(s.showcase_photo_r2_keys ?? []),
      ]),
    ),
  );
  const showcaseDisplayUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(
        showcaseRefs.map(async (ref) => {
          try {
            const url = await displayUrlForStoredAsset(ref);
            return url ? ([ref, url] as const) : null;
          } catch {
            return null;
          }
        }),
      )
    ).filter((e): e is readonly [string, string] => e !== null),
  );

  // Four independent per-vendor reads batched into ONE round-trip instead of the
  // former serial chain (2026-07-01 perf):
  //   • linked-services-on-card  • tier/verification soft-probe
  //   • time-bound slots         • payment schedules
  // Each keeps its graceful-degrade contract (empty / null on error).
  const [linkRowsRes, tierProbeRes, slotsByService, scheduleRowsByService] =
    await Promise.all([
      serviceIdList.length > 0
        ? supabase
            .from('vendor_service_links')
            .select('vendor_service_id, linked_canonical_service')
            .in('vendor_service_id', serviceIdList)
            .then((r) => r, () => ({ data: null }))
        : Promise.resolve({ data: [] }),
      // Vendor-scoped fields not in the shared profile select:
      //   tier_state · verification_state · name_revealed_at · screen_name.
      // A missing column / RLS hiccup degrades to null (→ free / hidden).
      supabase
        .from('vendor_profiles')
        .select('tier_state, verification_state, name_revealed_at, screen_name')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle()
        .then((r) => r, () => ({ data: null })),
      fetchVendorTimeSlotsByService(supabase, profile.vendor_profile_id),
      // Payment schedules (Vendor Transaction Lifecycle Phase 2 · PR-A).
      fetchOwnSchedulesByService(supabase, serviceIdList),
    ]);

  // Linked-services-on-card (locked spec): which OTHER categories each service
  // "comes with". Pre-checks the "Comes with" picker on each edit form. The
  // option set is the vendor's own distinct categories — a vendor can only
  // advertise coverage they actually offer (enforced again in setServiceLinks).
  const linkedByServiceId = new Map<string, Set<string>>();
  for (const r of (linkRowsRes.data ?? []) as {
    vendor_service_id: string;
    linked_canonical_service: string;
  }[]) {
    const set = linkedByServiceId.get(r.vendor_service_id) ?? new Set<string>();
    set.add(r.linked_canonical_service);
    linkedByServiceId.set(r.vendor_service_id, set);
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

  const tierRow = tierProbeRes.data as {
    tier_state?: string | null;
    verification_state?: string | null;
    name_revealed_at?: string | null;
    screen_name?: string | null;
  } | null;
  const tier: string | null = tierRow?.tier_state ?? null;
  const caps = tierCaps(tier);

  // #2 daily booking capacity: the tier caps the max bookings/day a vendor can
  // declare per service (FREE 0 / VERIFIED 1 / PRO 3 / ENTERPRISE 8). Only show
  // the capacity input when the tier allows bookings at all (slotsCap > 0).
  const slotsCap = caps.slotsPerDay;
  const slotsCapForUi = Number.isFinite(slotsCap) ? slotsCap : 99;
  // #3 time-bound slots: ENTERPRISE-only plotting (keyed on the enterprise tier).
  const canPlotSlots = canPlotTimeSlots(tier);
  const branches =
    tier === 'enterprise'
      ? (await fetchVendorBranches(supabase, profile.vendor_profile_id)).filter(
          (b) => b.status !== 'cancelled',
        )
      : [];
  const showBranchPicker = branches.length > 0;
  const branchLabelById = new Map(branches.map((b) => [b.branch_id, b.branch_label]));

  // (The standalone "Explore card preview" section — and its review/badge/
  // display-name reads — was REMOVED per the owner's v20 prototype ("remove
  // explore preview … when we create a service card, we want to see the exact
  // card"). The WYSIWYG preview moves INTO the card form as a follow-up slice.)

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
  const hasLiveOffPeak = services.some((s) => {
    if (!s.is_active) return false;
    return (discountsByService.get(s.vendor_service_id) ?? []).some(
      (d) =>
        d.discount_type === 'off_peak' &&
        d.expires_at !== null &&
        new Date(d.expires_at).getTime() > now.getTime(),
    );
  });
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
      : `${basePath}?add=${cat}#add-${cat}`;
  const specialistTools = specialistToolsForCategories(distinctCategories);

  // v20 tab landing: category-request confirmations land on Tools; any
  // service-targeted param (open add form, off-peak prefill) or an existing
  // service list lands on Service cards; a brand-new vendor starts on Coverage
  // (coverage-first — pick what you serve, then build cards inside it).
  const defaultTab = search.requested
    ? 2
    : addCategory !== null || offPeakPrefillId !== null || services.length > 0
      ? 1
      : 0;

  return (
    <div className="space-y-6">
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

      {/* v20 prototype structure (owner-locked): ONE card, three tabs —
          Coverage · Service cards · Tools. Tier banner + the standalone
          Explore-preview section were REMOVED per the prototype. */}
      <ManagerTabs
        defaultTab={defaultTab}
        tabs={[
          {
            label: 'Coverage',
            panel: (
              <CoveragePanel
                tree={coverageTree}
                coverages={coverageItems}
                eventTypeOptions={eventTypeOptions}
                faithOptions={faithOptions}
                parentUsage={{ used: coveredParentCount, cap: caps.parentCategories }}
              />
            ),
          },
          {
            label: 'Service cards',
            panel: (
              <>
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
            href={`${basePath}?offpeak=${offPeakTargetId}#svc-${offPeakTargetId}`}
            className="button-primary shrink-0 whitespace-nowrap text-center"
          >
            Set up off-season offer
          </Link>
        </div>
      ) : null}

      {/* ── YOUR SERVICE CARDS ──────────────────────────────────────────── */}
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
              basePath={basePath}
              vendorProfileId={profile.vendor_profile_id}
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
            {listedServices.map((svc, i) => {
              const prevCov = i > 0 ? listedServices[i - 1]?.coverage_id ?? null : null;
              const showCovHeader = i === 0 || prevCov !== (svc.coverage_id ?? null);
              const covHeaderLabel =
                svc.coverage_id && coverageLabelById.has(svc.coverage_id)
                  ? (coverageLabelById.get(svc.coverage_id) as string)
                  : 'Unassigned';
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
              // Multi-discount (Phase 3b · migration 20270502342558). The row
              // badge shows the FIRST discount + a "+N" when there are more; the
              // full list is edited in the DiscountsEditor below.
              const svcDiscountList =
                discountsByService.get(svc.vendor_service_id) ?? [];
              const svcDiscount = svcDiscountList[0] ?? null;
              const svcInclusions =
                inclusionsByService.get(svc.vendor_service_id) ?? [];
              const svcBrackets =
                bracketsByService.get(svc.vendor_service_id) ?? [];
              return (
                <Fragment key={svc.vendor_service_id}>
                  {showCovHeader ? (
                    <li className="px-1 pb-1 pt-3 first:pt-1">
                      <p
                        className="font-mono text-[11px] font-medium uppercase tracking-[0.15em]"
                        style={{ color: 'var(--m-slate-3)' }}
                      >
                        {covHeaderLabel}
                      </p>
                    </li>
                  ) : null}
                <li
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
                        {svc.coverage_id && coverageLabelById.has(svc.coverage_id)
                          ? ` · ${coverageLabelById.get(svc.coverage_id)}`
                          : ''}
                        {svc.is_active ? '' : ' · hidden'}
                      </p>
                    </div>
                    {svcDiscount ? (
                      <DiscountBadge
                        type={svcDiscount.discount_type}
                        value={svcDiscount.rate}
                        unit={svcDiscount.unit}
                        expiresAt={svcDiscount.expires_at}
                        extraCount={svcDiscountList.length - 1}
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
                        {/* v20: the live card preview — mirrors this form as you type. */}
                        <ServiceCardLivePreview
                          leafPathLabel={
                            (svc.coverage_id != null
                              ? coverageLabelById.get(svc.coverage_id)
                              : null) ?? displayServiceLabel(svc.category)
                          }
                          addonsFromPhp={(() => {
                            const prices = (addonsByService.get(svc.vendor_service_id) ?? [])
                              .map((a) => a.from_price_php)
                              .filter((p): p is number => p != null && p > 0);
                            return prices.length ? Math.min(...prices) : null;
                          })()}
                          initialCoverUrl={
                            svc.primary_photo_r2_key
                              ? showcaseDisplayUrls[svc.primary_photo_r2_key] ?? null
                              : null
                          }
                        />
                        <Field
                          label="Cover photo"
                          htmlFor={`cover-${svc.vendor_service_id}`}
                          help="The first thing couples see on this card. Required to publish."
                        >
                          {/* No watermark — matches the wizard's cover upload
                              (covers are unwatermarked today; showcase photos
                              are watermarked). Flagged for owner alignment. */}
                          <FileUpload
                            bucket="media"
                            pathPrefix={`vendors/${profile.vendor_profile_id}/services`}
                            name="primary_photo_r2_key"
                            maxSizeMB={5}
                            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                            variant="square"
                            currentValue={svc.primary_photo_r2_key}
                            initialDisplayUrls={showcaseDisplayUrls}
                          />
                        </Field>
                        {coverageItems.length > 0 ? (
                          <Field
                            label="Coverage"
                            htmlFor={`cov-${svc.vendor_service_id}`}
                            help="Which of your coverages this card belongs to."
                          >
                            <select
                              id={`cov-${svc.vendor_service_id}`}
                              name="coverage_id"
                              defaultValue={svc.coverage_id ?? ''}
                              className="input-field cursor-pointer"
                            >
                              <option value="">— not assigned —</option>
                              {coverageItems.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.pathLabel}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : null}
                        <PricingBasisEditor
                          idPrefix={svc.vendor_service_id}
                          defaults={{
                            pricing_basis: svc.pricing_basis,
                            starting_price_php: svc.starting_price_php,
                            base_pax: svc.base_pax,
                            added_pax_price_php: svc.added_pax_price_php,
                            per_pax_price_php: svc.per_pax_price_php,
                            min_pax: svc.min_pax,
                            hour_base_php: svc.hour_base_php,
                            min_hours: svc.min_hours,
                            extra_hour_php: svc.extra_hour_php,
                          }}
                          fixedExtra={
                            <PriceBracketsEditor initial={bracketsToDrafts(svcBrackets)} />
                          }
                        />
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
                        <IncludedFlags
                          idPrefix={svc.vendor_service_id}
                          defaults={{
                            crew_meal_included: svc.crew_meal_included,
                            transport_included: svc.transport_included,
                            transport_flat_fee_php: svc.transport_flat_fee_php,
                          }}
                        />
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
                        {/* Multi-discount list (Phase 3b). Preserves the
                            Off-Season nudge: when arrived via ?offpeak and the
                            service has no discounts yet, seed one off_peak row. */}
                        <DiscountsEditor
                          initial={discountsToDrafts(svcDiscountList)}
                          seedOffPeak={
                            offPeakPrefillId === svc.vendor_service_id &&
                            svcDiscountList.length === 0
                          }
                          seedExpiry={suggestedExpiry?.slice(0, 10)}
                          seedConditions={suggestedConditions || undefined}
                        />
                        <InclusionsEditor initial={inclusionsToDrafts(svcInclusions)} />
                        <ShowcaseMediaFields
                          vendorProfileId={profile.vendor_profile_id}
                          videoCurrent={svc.showcase_video_r2_key}
                          photosCurrent={svc.showcase_photo_r2_keys}
                          displayUrls={showcaseDisplayUrls}
                        />
                        <ExclusivePerkField
                          idPrefix={svc.vendor_service_id}
                          perkDefault={svc.exclusive_perk_text ?? undefined}
                        />
                        <div className="flex items-center justify-between">
                          {/* Trigger only — the delete ConfirmForm is a SIBLING
                              of this update form (below) and this button reaches
                              it via the HTML form attribute. Nesting the
                              ConfirmForm here (its own <form>) was invalid HTML:
                              the browser hoisted its $ACTION_ID_ input into THIS
                              form, so a no-JS / pre-hydration "Save changes"
                              dispatched deleteVendorService instead of update. */}
                          <button
                            type="submit"
                            form={`svc-delete-${svc.vendor_service_id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
                            style={{ borderColor: 'var(--m-line)', color: 'var(--m-blush-deep)' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Delete
                          </button>
                          <SubmitButton className="button-primary" pendingLabel="Saving…">
                            Save changes
                          </SubmitButton>
                        </div>
                      </form>

                      {/* Delete confirm — MUST stay a sibling of the update form
                          (never nested); triggered by the footer button above. */}
                      <ConfirmForm
                        formId={`svc-delete-${svc.vendor_service_id}`}
                        className="hidden"
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
                      </ConfirmForm>

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
                      <AddonsEditor
                        serviceId={svc.vendor_service_id}
                        initial={(addonsByService.get(svc.vendor_service_id) ?? []).map((a) => ({
                          label: a.label,
                          price: a.from_price_php != null ? String(a.from_price_php) : '',
                        }))}
                      />
                    </div>
                  </details>
                </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </section>
              </>
            ),
          },
          {
            label: 'Tools',
            panel: (
              <>
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
              </>
            ),
          },
        ]}
      />
    </div>
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
  basePath,
  vendorProfileId,
}: {
  addCategory: VendorCategory;
  labelFor: (cat: VendorCategory) => string;
  slotsCap: number;
  slotsCapForUi: number;
  showBranchPicker: boolean;
  branches: { branch_id: string; branch_label: string }[];
  basePath: string;
  vendorProfileId: string;
}) {
  return (
    <form action={createVendorService} className="space-y-4">
      <input type="hidden" name="category" value={addCategory} />
      {/* v20: the live card preview — mirrors this form as you type. */}
      <ServiceCardLivePreview leafPathLabel={labelFor(addCategory)} />
      <Field
        label="Cover photo"
        htmlFor={`new-cover-${addCategory}`}
        help="The first thing couples see on this card. Required to publish."
      >
        {/* No watermark — matches the wizard's cover upload. */}
        <FileUpload
          bucket="media"
          pathPrefix={`vendors/${vendorProfileId}/services`}
          name="primary_photo_r2_key"
          maxSizeMB={5}
          acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
          variant="square"
        />
      </Field>
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
      <PricingBasisEditor
        idPrefix={`new-${addCategory}`}
        defaults={{
          pricing_basis: 'fixed',
          starting_price_php: null,
          base_pax: null,
          added_pax_price_php: null,
          per_pax_price_php: null,
          min_pax: null,
          hour_base_php: null,
          min_hours: null,
          extra_hour_php: null,
        }}
        fixedExtra={<PriceBracketsEditor initial={[]} />}
      />
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
      <IncludedFlags
        idPrefix={`new-${addCategory}`}
        defaults={{ crew_meal_included: false, transport_included: false, transport_flat_fee_php: null }}
      />
      <LastMinuteFields idPrefix={`new-${addCategory}`} />
      {showBranchPicker ? (
        <BranchSelect id={`new-branch-${addCategory}`} branches={branches} defaultValue="" />
      ) : null}
      <DiscountsEditor initial={[]} />
      <InclusionsEditor initial={[]} />
      <ShowcaseMediaFields vendorProfileId={vendorProfileId} />
      <ExclusivePerkField idPrefix={`new-${addCategory}`} />
      <div className="flex items-center justify-between">
        <Link href={basePath} className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
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

// ── Child-list DB rows → editor drafts (Phase 3b) ────────────────────────────
// The fetched rows carry ISO/number values; the editors take string-typed draft
// rows. These map one to the other (dates → YYYY-MM-DD for <input type="date">).
function discountsToDrafts(
  rows: import('@/lib/vendor-services').VendorServiceDiscount[],
): DiscountDraft[] {
  return rows.map((d) => ({
    discount_type: d.discount_type,
    rate: String(d.rate),
    unit: d.unit,
    expires_at: d.expires_at ? d.expires_at.slice(0, 10) : '',
    conditions_md: d.conditions_md ?? '',
  }));
}
function inclusionsToDrafts(
  rows: import('@/lib/vendor-services').VendorServiceInclusion[],
): InclusionDraft[] {
  return rows.map((n) => ({
    label: n.label,
    worth: n.worth_php != null ? String(n.worth_php) : '',
  }));
}
function bracketsToDrafts(
  rows: import('@/lib/vendor-services').VendorServicePriceBracket[],
): BracketDraft[] {
  return rows.map((b) => ({
    min_pax: b.min_pax != null ? String(b.min_pax) : '',
    max_pax: b.max_pax != null ? String(b.max_pax) : '',
    price: String(b.price_php),
  }));
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

/**
 * Inline discount badge shown on the service row for the FIRST (best-ordered)
 * discount, with a "+N" suffix when the service carries more (multi-discount ·
 * Phase 3b). Renders the first row's value with its unit (% or ₱).
 */
function DiscountBadge({
  type,
  value,
  unit,
  expiresAt,
  extraCount = 0,
}: {
  type: string;
  value: number | null;
  unit?: 'pct' | 'php';
  expiresAt: string | null;
  extraCount?: number;
}) {
  const label = DISCOUNT_TYPE_LABELS[type] ?? type;
  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  if (expired) return null;
  const valueLabel =
    value != null ? (unit === 'php' ? ` · ₱${value}` : ` · ${value}%`) : '';
  return (
    <span
      className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] sm:inline-flex"
      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
    >
      <Tag className="h-3 w-3" strokeWidth={2} />
      {label}
      {valueLabel}
      {extraCount > 0 ? ` +${extraCount}` : ''}
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
