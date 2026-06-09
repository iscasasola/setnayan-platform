/**
 * Vendors tab — Plan + Budget Accordion (server entry).
 *
 * Design-locked in Vendors_Plan_Budget_Tab_Spec_2026-05-31.md. Replaces the
 * flat StatsStrip + AddVendorForm + VendorCard list with a scroll-driven
 * sticky-header accordion that fuses the couple's PLAN (shortlist + picks per
 * category, grouped into the 10 taxonomy folders) with their BUDGET (Chosen
 * total + projected Range vs target). Same event_vendors data + same server
 * actions (createVendor / updateVendorStatus / deleteVendor + the no-cron
 * review sweep) — a new surface, not a schema change.
 *
 * The page returns bare content; the dashboard [eventId]/layout.tsx provides
 * the tab chrome + outer <main> (matching the old flat-list page's pattern).
 * The old page is preserved at page.flat-list.bak.tsx.txt (not compiled).
 */

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchEventVendors, resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { buildPlanBudgetModel, type VendorEnrichment } from '@/lib/vendors-plan-budget';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { isSetnayanAiActive } from '@/lib/setnayan-ai';
import { isBudgetBuildEnabled } from '@/lib/budget-build';
import type { ChatInquiryStatus } from '@/lib/chat';
import { haversineKm } from '@/lib/distance';
import { R2_BUCKETS, r2PublicUrl } from '@/lib/r2';
import {
  bucketVendorsByGroup,
  PLAN_GROUPS,
  type EventVendorRowInput,
} from '@/lib/wedding-plan-groups';
import { canonicalServicesForFolder } from '@/lib/vendor-counts';
import type { WeddingFolder } from '@/lib/taxonomy';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanBudgetAccordion } from './_components/plan-budget-accordion';
import { ServicesTakeover } from './_components/services-takeover';
import { BuildPins } from './_components/build-pins';
import type { AnchorData } from './_components/build-anchors';
import { BuildSummary } from './_components/build-summary';
import { BuildLocked } from './_components/build-locked';
import { BuildCompare } from './_components/build-compare';
import { type SavedPlanBuild, type PlanBuildSnapshot } from './build-actions';
import { VendorAvailabilityIntersection } from '../_components/vendor-availability-intersection';
import { getCommonAvailableDays, rangeFromPrecision, formatDayKey } from '@/lib/vendor-availability';
import { formatEventDateWithPrecision, type EventDatePrecision } from '@/lib/events';

export const metadata = { title: 'Vendors' };

type Props = {
  params: Promise<{ eventId: string }>;
  // status query param kept for backward-compat with old links; the accordion
  // ignores it (folder-scoped browsing happens in the marketplace, not here).
  searchParams: Promise<{ status?: string }>;
};

type EventBudgetRow = {
  event_date: string | null;
  event_date_precision: string | null;
  estimated_budget_centavos: number | null;
  /** Set when the couple has locked/updated their mood board — feeds the
   *  dependency engine (florals/cake/LED/invites design from it · §4B). */
  mood_board_updated_at: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  ceremony_type: string | null;
  secondary_ceremony_type: string | null;
  venue_setting: string | null;
  // Match-criteria columns — feed the plan-budget model + Build/Lock anchors.
  region: string | null;
  estimated_pax: number | null;
  mood_feel_key: string | null;
  date_mode: string | null;
  date_candidates: string[] | null;
  date_window_start: string | null;
  date_window_end: string | null;
  // Planning mode (owner 2026-06-05) — 'manual' collapses the strip + (Home)
  // turns off Setnayan AI + deadlines. Default 'guided'.
  planning_mode: string | null;
  // Per-event Setnayan AI entitlement — only consulted when the paywall flag
  // is on (lib/setnayan-ai). Optional: absent on rows selected before the col.
  setnayan_ai_active?: boolean | null;
};

export default async function VendorsPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // No-cron lazy review-request sweep (PR #47, 2026-05-14). Any vendor still
  // in contracted/deposit_paid 24h after the event flips to delivered + fires
  // a review_request. Idempotent — flipped rows no longer match.
  await sweepRipeReviewRequests(eventId, user.id);

  const [vendors, eventCtx, photoMaps] = await Promise.all([
    fetchEventVendors(supabase, eventId),
    supabase
      .from('events')
      .select(
        'event_date, event_date_precision, estimated_budget_centavos, mood_board_updated_at, venue_latitude, venue_longitude, ceremony_type, secondary_ceremony_type, venue_setting, region, estimated_pax, mood_feel_key, date_mode, date_candidates, date_window_start, date_window_end, planning_mode, setnayan_ai_active',
      )
      .eq('id', eventId)
      .maybeSingle(),
    // Hero photos (CLAUDE.md 2026-05-31 "finish the data wiring" · #8). The
    // card's photo ladder is service_primary_photo_url → manual_vendor_photo_url
    // → marketplace_logo_url → initials, but the page never populated the first
    // two. Resolve them here (mirrors event-home's locked-card avatar pass).
    fetchVendorPhotoMaps(supabase, eventId),
  ]);

  const ev = (eventCtx.data as EventBudgetRow | null) ?? null;
  const eventDate = ev?.event_date ?? null;
  const daysUntilWedding = eventDate
    ? Math.round((new Date(eventDate).getTime() - Date.now()) / 86_400_000)
    : null;

  // ── Card enrichment (CLAUDE.md 2026-05-31 "finish the data wiring") ──────
  // The card UI already renders photo / distance / stars / Verified+Setnayan
  // badges + a resolved (hybrid-anonymity) name — it just never received the
  // data. Join the picked marketplace vendors to vendor_market_stats (reviews
  // + is_setnayan_service + hq coords + logo + city + public_visibility) and
  // vendor_profiles (name_revealed_at + screen_name, which the view lacks) so
  // the name resolves through resolveVendorDisplayName. Off-platform / custom
  // picks (no marketplace_vendor_id) keep initials + the typed name. Every
  // field renders only when present — never fabricated.
  const marketplaceIds = [
    ...new Set(
      vendors
        .map((v) => v.marketplace_vendor_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const marketplaceCardByVendorId = new Map<
    string,
    { name: string | null; logo: string | null; city: string | null }
  >();
  const enrichmentByVendorId = new Map<string, VendorEnrichment>();

  if (marketplaceIds.length > 0) {
    const [statsRes, profRes, threadsRes] = await Promise.all([
      supabase
        .from('vendor_market_stats')
        .select(
          'vendor_profile_id, business_name, logo_url, location_city, hq_latitude, hq_longitude, avg_rating_overall, review_count, is_setnayan_service, public_visibility, services',
        )
        .in('vendor_profile_id', marketplaceIds),
      supabase
        .from('vendor_profiles')
        .select('vendor_profile_id, name_revealed_at, screen_name, tier_state')
        .in('vendor_profile_id', marketplaceIds),
      // Accept-gate state (#1c, CLAUDE.md 2026-06-02) — the chat thread per
      // picked marketplace vendor for THIS event. Surfaces a Waiting / Open /
      // Not-available badge on the accordion card so the couple sees where each
      // auto-inquiry stands. RLS: the couple is an event member → reads its own
      // event's threads.
      supabase
        .from('chat_threads')
        .select('vendor_profile_id, inquiry_status')
        .eq('event_id', eventId)
        .in('vendor_profile_id', marketplaceIds),
    ]);

    type StatsRow = {
      vendor_profile_id: string;
      business_name: string | null;
      logo_url: string | null;
      location_city: string | null;
      hq_latitude: number | null;
      hq_longitude: number | null;
      avg_rating_overall: number | string | null;
      review_count: number | null;
      is_setnayan_service: boolean | null;
      public_visibility: string | null;
      services: string[] | null;
    };
    type ProfRow = {
      vendor_profile_id: string;
      name_revealed_at: string | null;
      screen_name: string | null;
      tier_state: string | null;
    };

    const statsByProfile = new Map<string, StatsRow>();
    for (const s of (statsRes.data as StatsRow[] | null) ?? []) {
      statsByProfile.set(s.vendor_profile_id, s);
    }
    const anonByProfile = new Map<string, ProfRow>();
    for (const p of (profRes.data as ProfRow[] | null) ?? []) {
      anonByProfile.set(p.vendor_profile_id, p);
    }
    const inquiryByProfile = new Map<string, ChatInquiryStatus>();
    for (const t of (threadsRes.data as
      | { vendor_profile_id: string; inquiry_status: ChatInquiryStatus }[]
      | null) ?? []) {
      inquiryByProfile.set(t.vendor_profile_id, t.inquiry_status);
    }

    const venueLat = ev?.venue_latitude ?? null;
    const venueLng = ev?.venue_longitude ?? null;

    for (const v of vendors) {
      const pid = v.marketplace_vendor_id;
      if (!pid) continue;
      const s = statsByProfile.get(pid);
      if (!s) continue;
      const a = anonByProfile.get(pid);

      // Resolved (hybrid-anonymity) name: real business_name once revealed /
      // venue-exempt; the screen name while still hidden. Phase C: Pro/
      // Enterprise (isTrueNameTier) reveal day-1; Free/Verified stay
      // anonymized until name_revealed_at is stamped. `?? null` → free → hidden.
      const resolvedName = resolveVendorDisplayName({
        business_name: s.business_name,
        name_revealed_at: a?.name_revealed_at ?? null,
        isPaidTier: isTrueNameTier(a?.tier_state ?? null),
        primary_canonical_service: s.services?.[0] ?? null,
        location_city: s.location_city,
        services: s.services,
        screen_name: a?.screen_name ?? null,
      });
      marketplaceCardByVendorId.set(v.vendor_id, {
        name: resolvedName,
        logo: s.logo_url,
        city: s.location_city,
      });

      const rating =
        s.avg_rating_overall != null ? Number(s.avg_rating_overall) : null;
      const distanceKm =
        venueLat != null &&
        venueLng != null &&
        s.hq_latitude != null &&
        s.hq_longitude != null
          ? haversineKm(venueLat, venueLng, s.hq_latitude, s.hq_longitude)
          : null;

      enrichmentByVendorId.set(v.vendor_id, {
        rating: rating != null && rating > 0 ? rating : null,
        review_count: s.review_count ?? null,
        is_verified: s.public_visibility === 'verified',
        is_setnayan_service: s.is_setnayan_service === true,
        distance_km: distanceKm,
        inquiry_status: inquiryByProfile.get(pid) ?? null,
        linked_services: photoMaps.linkedByVendorId.get(v.vendor_id),
      });
    }
  }

  // Map the fetched event_vendors rows into the canonical bucketer's input
  // shape, now carrying the resolved marketplace identity (name / logo / city)
  // so the card shows the real vendor instead of initials. null fields are
  // off-platform picks (the card falls back to initials + the typed name).
  const vendorRows: EventVendorRowInput[] = vendors.map((v) => {
    const mk = marketplaceCardByVendorId.get(v.vendor_id);
    return {
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      category: v.category,
      status: v.status,
      total_cost_php: v.total_cost_php,
      deposit_paid_php: v.deposit_paid_php,
      notes: v.notes,
      contact_email: v.contact_email,
      contact_phone: v.contact_phone,
      marketplace_vendor_id: v.marketplace_vendor_id,
      marketplace_business_name: mk?.name ?? null,
      marketplace_logo_url: mk?.logo ?? null,
      marketplace_city: mk?.city ?? null,
      // Hero photo (#8) — vendor's own service photo wins, then a manual
      // contact's uploaded photo; both null for off-platform picks with
      // neither → card falls through to logo → initials. Never fabricated.
      service_primary_photo_url:
        photoMaps.servicePhotoByVendor.get(v.vendor_id) ?? null,
      manual_vendor_photo_url:
        photoMaps.manualPhotoByVendor.get(v.vendor_id) ?? null,
    };
  });

  // 3-line cost (CLAUDE.md 2026-05-31): build the transport + food-allowance
  // maps from the new event_vendors columns so the accordion's rolled_cost_php
  // = Service (total_cost_php) + Transport + Food. Null columns are skipped →
  // the model treats them as ₱0 (total = Service only until entered, never
  // fabricated). Maps key on vendor_id, exactly what enrich() expects.
  const transportByVendorId = new Map<string, number>();
  const crewMealByVendorId = new Map<string, number>();
  for (const v of vendors) {
    if (v.transport_php != null) {
      transportByVendorId.set(v.vendor_id, Number(v.transport_php));
    }
    if (v.food_allowance_php != null) {
      crewMealByVendorId.set(v.vendor_id, Number(v.food_allowance_php));
    }
  }

  // ── Same-date competition (spec §6a) — aggregate-only count of OTHER
  // couples soft-holding the same vendor on the same wedding date. Admin
  // client because RLS blocks couple→couple reads; we only ever surface the
  // COUNT, never identities (RA 10173). Dedup by event. 0 → no chip; never
  // fabricated. eq(event_date) is exact same-day (event_date is a date col);
  // a type mismatch would undercount → no chip, the safe failure.
  const eyeingByVendorId = new Map<string, number>();
  if (eventDate && marketplaceIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: holds } = await admin
        .from('event_vendors')
        .select('marketplace_vendor_id, event_id, events!inner(event_date)')
        .in('marketplace_vendor_id', marketplaceIds)
        .in('status', ['considering', 'contracted'])
        .neq('event_id', eventId)
        .eq('events.event_date', eventDate);
      const otherEventsByProfile = new Map<string, Set<string>>();
      for (const h of (holds ?? []) as Array<{
        marketplace_vendor_id: string | null;
        event_id: string;
      }>) {
        if (!h.marketplace_vendor_id) continue;
        const set =
          otherEventsByProfile.get(h.marketplace_vendor_id) ?? new Set<string>();
        set.add(h.event_id);
        otherEventsByProfile.set(h.marketplace_vendor_id, set);
      }
      for (const v of vendors) {
        if (!v.marketplace_vendor_id) continue;
        const n = otherEventsByProfile.get(v.marketplace_vendor_id)?.size ?? 0;
        if (n > 0) eyeingByVendorId.set(v.vendor_id, n);
      }
    } catch (e) {
      console.error('[vendors] same-date competition count failed:', e);
    }
  }

  // ── Market pool (recap real numbers, 2026-06-02 · owner "no mockups") ────
  // The recap's "Searched / hours saved" was a placeholder formula (spec §6).
  // Replace with the REAL count of marketplace-published vendors (verified +
  // coming_soon — what couples actually browse) across the couple's ACTIVE
  // categories. 0 on any failure → the recap shows 0, never fabricated.
  const marketPoolCount = await fetchActiveCategoryMarketPool(
    vendorRows,
    ev?.ceremony_type ?? null,
    ev?.venue_setting ?? null,
  );

  // Setnayan AI gate (owner 2026-06-05/06-08) — Manual mode = AI OFF: the strip
  // collapses to a slim "you're driving" bar, the accordion drops the
  // per-candidate "% match" pills, AND the "👀 eyeing your date" nudge is
  // suppressed (generic browse). One governing gate: lib/setnayan-ai.
  const aiActive = isSetnayanAiActive(ev);

  // DB-driven category headers (owner 2026-06-09 — "taxonomy applies to all 5
  // menus"): the 10 folder labels/order/slugs come from `service_categories`
  // via getTaxonomy(), so an /admin/taxonomy edit flows to every plan-builder
  // tab. Falls back to the TS constants on any read error (resolver-internal).
  const taxonomy = await getTaxonomy();

  // Build picks (Shortlist "Add to build" / Build "Pin") — plan_group_id →
  // pinned vendor_id. One per category; the model marks the matching pick
  // `isBuildPick` + exposes `buildPickVendorId`. Fails open (no picks) on error.
  const { data: buildPickRows } = await supabase
    .from('event_build_picks')
    .select('plan_group_id, vendor_id')
    .eq('event_id', eventId);
  const buildPicksByGroup = new Map<string, string>(
    ((buildPickRows ?? []) as Array<{ plan_group_id: string; vendor_id: string }>).map((r) => [
      r.plan_group_id,
      r.vendor_id,
    ]),
  );

  const model = buildPlanBudgetModel({
    vendorRows,
    estimatedBudgetCentavos: ev?.estimated_budget_centavos ?? null,
    daysUntilWedding,
    ceremonyType: ev?.ceremony_type ?? null,
    venueSetting: ev?.venue_setting ?? null,
    transportByVendorId,
    crewMealByVendorId,
    // Eyeing is a Setnayan AI nudge — pass an empty map when AI is off.
    eyeingByVendorId: aiActive ? eyeingByVendorId : new Map<string, number>(),
    enrichmentByVendorId,
    marketPoolCount,
    personalizationEnabled: aiActive,
    moodBoardSet: ev?.mood_board_updated_at != null,
    taxonomy,
    buildPicksByGroup,
  });

  // Committed-date label + precision — feed the Build/Lock date anchor + the
  // vendor-availability intersection. (The "Matching you on" strip that also
  // used these was removed from the Shortlist in the 0016 Plan Builder sync —
  // the cover now lives only on the Summary tab; Refine personalization is
  // reachable from Summary's Setnayan-AI row → /details.)
  const matchPrecision =
    (ev?.event_date_precision as EventDatePrecision | null | undefined) ?? 'day';
  const matchFormattedDate = ev?.event_date
    ? formatEventDateWithPrecision(ev.event_date, matchPrecision)
    : null;

  // In-app Setnayan services now nest INSIDE the accordion's category rails
  // (✦ Setnayan cards, float-to-top) + a Design › Digital Services rail + a
  // "Tools & extras" strip — the standalone InAppServicesSection launcher grid
  // was retired (Digital_Services_Cross_Surface_Map_2026-06-03.md §2).
  const services = <PlanBudgetAccordion model={model} eventId={eventId} />;

  // Budget "Build" takeover (flag-gated · BUDGET_BUILD_ENABLED, default OFF).
  // When on, /vendors becomes a full-screen FOCUS MODE takeover with its own
  // 5-tab section nav: Shortlist houses today's Services experience and Build
  // hosts the median-anchored allocation planner (the auto-fit plan + shopping
  // ranges + cushion + peso-pin tilt — the same engine the Budget tab uses).
  // Compare / Summary / Lock fill in across later phases. When off, render
  // exactly as before (zero production change — the alloc query is gated here so
  // it never runs unless the flag is on).
  if (isBudgetBuildEnabled()) {
    const { data: savedBuildRows } = await supabase
      .from('budget_builds')
      .select('build_id, label, title, budget_php, total_php, snapshot')
      .eq('event_id', eventId)
      .order('label');
    const savedBuilds = (savedBuildRows ?? []) as SavedPlanBuild[];

    // Current plan snapshot (PR F) — the couple's live vendor picks per category.
    // Compare shows this as the "Current" column and saves it into a slot.
    const PLAN_LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
    const planPicks = model.folders
      .flatMap((f) => f.children)
      .filter((c) => c.picks.length > 0)
      .map((c) => {
        const lockedPick = c.picks.find((p) => p.raw_status && PLAN_LOCKED.has(p.raw_status));
        const pick = lockedPick ?? c.picks[0]!;
        return {
          groupId: c.groupId as string,
          label: c.label,
          vendorName: pick.vendor_name ?? '(unnamed)',
          costPhp: pick.rolled_cost_php ?? null,
          locked: !!lockedPick,
          vendorId: pick.vendor_id,
          inclusions: pick.linked_services?.map((l) => l.label) ?? [],
        };
      });
    const currentPlan: PlanBuildSnapshot = {
      budgetPhp:
        ev?.estimated_budget_centavos != null
          ? Math.round(ev.estimated_budget_centavos / 100)
          : null,
      totalPhp: planPicks.reduce((s, p) => s + (p.costPhp ?? 0), 0),
      picks: planPicks,
    };
    const { data: flagRows } = await supabase
      .from('budget_category_flags')
      .select('plan_group_id')
      .eq('event_id', eventId);
    const flaggedGroups = ((flagRows ?? []) as Array<{ plan_group_id: string }>).map(
      (r) => r.plan_group_id,
    );
    // Available dates for the locked team — reuse the event-home intersection
    // (fires only at year/month precision with >=1 confirmed vendor). Fails silent
    // → the Lock tab just renders without the dates panel.
    const lockAvailability = await (async () => {
      const eventDate = ev?.event_date ?? null;
      if (!eventDate || (matchPrecision !== 'year' && matchPrecision !== 'month')) return null;
      const range = rangeFromPrecision(eventDate, matchPrecision);
      if (!range) return null;
      try {
        const avail = await getCommonAvailableDays(supabase, eventId, range.start, range.end);
        if (avail.confirmedVendorCount <= 0) return null;
        return {
          availableDays: avail.availableDays.map(formatDayKey),
          confirmedVendorCount: avail.confirmedVendorCount,
          windowLabel: formatEventDateWithPrecision(eventDate, matchPrecision).replace(/^Sometime in /, ''),
          totalDaysInRange: avail.totalDaysInRange,
        };
      } catch {
        return null;
      }
    })();
    // Build-tab anchors (PR D) — Date/Budget/Location with Flag/Pin. State lives
    // on the existing events columns (populated = Pinned, empty = Flagged); no
    // migration. Reuses the already-computed matchFormattedDate + precision.
    const buildAnchors: AnchorData = {
      date: {
        iso: ev?.event_date ?? null,
        label: matchFormattedDate,
        candidateCount: ev?.date_candidates?.length ?? 0,
      },
      budget: {
        php:
          ev?.estimated_budget_centavos != null
            ? Math.round(ev.estimated_budget_centavos / 100)
            : null,
      },
      location: { region: ev?.region ?? null },
    };
    // Build tab (PR E) — anchors (PR D) + per-category Flag/Compute. The
    // Lean/Fits/Stretch planner is retired here (owner: "replace the estimator
    // fully"). Open categories (budgeted, no vendor) can be flagged → Compute
    // auto-fills them; finalized ones are the locked count.
    const buildChildren = model.folders.flatMap((f) => f.children);
    // "Your build" — the items transferred via Shortlist "Add to build"
    // (event_build_picks): the pinned vendor per category, resolved off the model.
    const buildItems = model.folders.flatMap((f) =>
      f.children.flatMap((c) => {
        if (!c.buildPickVendorId) return [];
        const p = c.picks.find((pp) => pp.vendor_id === c.buildPickVendorId);
        if (!p) return [];
        return [
          {
            groupId: c.groupId as string,
            group: c.label,
            folder: f.label,
            vendorId: p.vendor_id,
            name: p.marketplace_business_name ?? p.vendor_name ?? 'Vendor',
            pricePhp: p.rolled_cost_php,
            locked: !!(p.raw_status && PLAN_LOCKED.has(p.raw_status)),
          },
        ];
      }),
    );
    const buildSlot = (
      <BuildPins
        eventId={eventId}
        anchors={buildAnchors}
        buildItems={buildItems}
        budgetPhp={buildAnchors.budget.php}
        categoryFill={{
          openCats: buildChildren
            .filter((c) => c.state === 'empty')
            .map((c) => ({ groupId: c.groupId, label: c.label })),
          lockedCount: buildChildren.filter((c) => c.state === 'finalized').length,
          flaggedGroups,
          aiOn: aiActive,
        }}
      />
    );
    return (
      <ServicesTakeover
        eventId={eventId}
        initialTab="summary"
        summarySlot={<BuildSummary model={model} eventId={eventId} buildsCount={savedBuilds.length} />}
        shortlistSlot={services}
        buildSlot={buildSlot}
        compareSlot={
          <BuildCompare
            eventId={eventId}
            budgetPhp={currentPlan.budgetPhp}
            currentPlan={currentPlan}
            savedBuilds={savedBuilds}
          />
        }
        lockSlot={
          <div className="space-y-4">
            <BuildLocked
              model={model}
              eventId={eventId}
              summary={{
                dateLabel: buildAnchors.date.iso ? buildAnchors.date.label : null,
                budgetPhp: buildAnchors.budget.php,
                region: buildAnchors.location.region,
              }}
            />
            {lockAvailability ? (
              <VendorAvailabilityIntersection eventId={eventId} {...lockAvailability} />
            ) : null}
          </div>
        }
      />
    );
  }

  return services;
}

/**
 * Real count of marketplace-published vendors (verified + coming_soon) across
 * the couple's ACTIVE categories — powers the recap "Searched" stat + the
 * hoursSaved basis (2026-06-02 · owner "no mockups" · spec §6 resolved via the
 * Time & Money Saved model). Re-buckets the picks to find which folders are
 * active, unions their canonical services, counts distinct published vendors
 * overlapping that set. Admin client (the marketplace is anonymous-read). 0 on
 * any failure / no active categories → the recap shows 0, never a fabricated
 * figure.
 *
 * NOTE: counts the browseable pool (verified + coming_soon) — what a couple
 * actually sees in the marketplace today — NOT verified-only (which is ~0
 * pre-launch). The owner picked "verified-vendor market pool"; using the full
 * published pool keeps the number real AND meaningful. Flip the visibility
 * filter to verified-only once the verified roster is populated.
 */
async function fetchActiveCategoryMarketPool(
  vendorRows: ReadonlyArray<EventVendorRowInput>,
  ceremonyType: string | null,
  venueSetting: string | null,
): Promise<number> {
  try {
    const bucketed = bucketVendorsByGroup(vendorRows, ceremonyType, venueSetting);
    const activeFolders = new Set<WeddingFolder>();
    for (const g of PLAN_GROUPS) {
      if ((bucketed.get(g.id)?.length ?? 0) > 0) {
        activeFolders.add(g.catalogFolder);
      }
    }
    const canonical = new Set<string>();
    for (const f of activeFolders) {
      for (const c of canonicalServicesForFolder(f)) canonical.add(c);
    }
    if (canonical.size === 0) return 0;
    const admin = createAdminClient();
    const { count, error } = await admin
      .from('vendor_market_stats')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .in('public_visibility', ['verified', 'coming_soon'])
      .not('business_name', 'is', null)
      .neq('business_name', '')
      .overlaps('services', [...canonical]);
    if (error || count == null) return 0;
    return count;
  } catch (e) {
    console.error('[vendors] market-pool count failed:', e);
    return 0;
  }
}

/**
 * Resolve each pick's hero photo (CLAUDE.md 2026-05-31 "finish the data
 * wiring" · #8). Two sources, in card-ladder priority:
 *   1. vendor_services.primary_photo_r2_key — the vendor's own service photo
 *      (marketplace picks, linked by event_vendors.service_id).
 *   2. event_manual_vendors.photo_r2_key — a photo the host uploaded for an
 *      off-platform contact (linked by event_vendors.manual_vendor_id).
 * Returns vendor_id → public URL maps for the page to thread into the row
 * shape. Everything degrades to empty (card keeps logo → initials) — never
 * throws, never fabricates a photo.
 *
 * WHY a separate event_vendors read instead of extending fetchEventVendors:
 * the shared helper has many callers, and manual_vendor_id may be absent on a
 * pre-migration DB (event-home does the same defensive select). Keeping the
 * id-map local contains the blast radius to this page + the fallback.
 *
 * Client split mirrors event-home: vendor_services via the admin client (RLS
 * doesn't expose arbitrary service photo keys to couples), event_manual_vendors
 * via the RLS client (the couple owns its own event's manual rows).
 */
async function fetchVendorPhotoMaps(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{
  servicePhotoByVendor: Map<string, string>;
  manualPhotoByVendor: Map<string, string>;
  /** vendor_id → linked-services-on-card labels for its picked service. */
  linkedByVendorId: Map<string, { label: string }[]>;
}> {
  const servicePhotoByVendor = new Map<string, string>();
  const manualPhotoByVendor = new Map<string, string>();
  const linkedByVendorId = new Map<string, { label: string }[]>();

  // 1. vendor_id → service_id / manual_vendor_id. Falls back to a service_id-
  //    only select when manual_vendor_id isn't migrated yet.
  type IdRow = {
    vendor_id: string;
    service_id: string | null;
    manual_vendor_id?: string | null;
  };
  let idRows: IdRow[] = [];
  const full = await supabase
    .from('event_vendors')
    .select('vendor_id, service_id, manual_vendor_id')
    .eq('event_id', eventId);
  if (!full.error) {
    idRows = (full.data ?? []) as IdRow[];
  } else if (/manual_vendor_id/i.test(full.error.message)) {
    const reduced = await supabase
      .from('event_vendors')
      .select('vendor_id, service_id')
      .eq('event_id', eventId);
    idRows = (reduced.data ?? []) as IdRow[];
  } else {
    // Any other error → no photos; the plan still renders.
    return { servicePhotoByVendor, manualPhotoByVendor, linkedByVendorId };
  }

  const serviceIdByVendor = new Map<string, string>();
  const manualIdByVendor = new Map<string, string>();
  for (const r of idRows) {
    if (r.service_id) serviceIdByVendor.set(r.vendor_id, r.service_id);
    if (r.manual_vendor_id) manualIdByVendor.set(r.vendor_id, r.manual_vendor_id);
  }
  const serviceIds = Array.from(new Set(serviceIdByVendor.values()));
  const manualIds = Array.from(new Set(manualIdByVendor.values()));
  if (serviceIds.length === 0 && manualIds.length === 0) {
    return { servicePhotoByVendor, manualPhotoByVendor, linkedByVendorId };
  }

  // 2. Batch-fetch the r2 keys (one round trip per table, only when needed).
  type SvcRow = { vendor_service_id: string; primary_photo_r2_key: string | null };
  type ManRow = { manual_vendor_id: string; photo_r2_key: string | null };
  type LinkRow = { vendor_service_id: string; linked_label: string | null; linked_canonical_service: string; display_order: number };
  const admin = createAdminClient();
  const [svcRes, manRes, linkRes] = await Promise.all([
    serviceIds.length > 0
      ? admin
          .from('vendor_services')
          .select('vendor_service_id, primary_photo_r2_key')
          .in('vendor_service_id', serviceIds)
      : Promise.resolve({ data: [] as SvcRow[] }),
    manualIds.length > 0
      ? supabase
          .from('event_manual_vendors')
          .select('manual_vendor_id, photo_r2_key')
          .in('manual_vendor_id', manualIds)
      : Promise.resolve({ data: [] as ManRow[] }),
    // Linked-services-on-card: the categories each picked service "comes with".
    serviceIds.length > 0
      ? admin
          .from('vendor_service_links')
          .select('vendor_service_id, linked_label, linked_canonical_service, display_order')
          .in('vendor_service_id', serviceIds)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: [] as LinkRow[] }),
  ]);

  // service_id → ordered linked labels → resolve to vendor_id.
  const linksByServiceId = new Map<string, { label: string }[]>();
  for (const row of (linkRes.data ?? []) as LinkRow[]) {
    const label = row.linked_label ?? row.linked_canonical_service;
    const arr = linksByServiceId.get(row.vendor_service_id) ?? [];
    arr.push({ label });
    linksByServiceId.set(row.vendor_service_id, arr);
  }
  for (const [vendorId, serviceId] of serviceIdByVendor) {
    const links = linksByServiceId.get(serviceId);
    if (links && links.length > 0) linkedByVendorId.set(vendorId, links);
  }

  // 3. r2 key → public URL, keyed first by the source id, then resolved to
  //    vendor_id (what the row map consumes). NULL keys skip (no photo yet).
  const svcUrlByServiceId = new Map<string, string>();
  for (const row of (svcRes.data ?? []) as SvcRow[]) {
    if (row.primary_photo_r2_key) {
      svcUrlByServiceId.set(
        row.vendor_service_id,
        r2PublicUrl(R2_BUCKETS.media, row.primary_photo_r2_key),
      );
    }
  }
  const manualUrlByManualId = new Map<string, string>();
  for (const row of (manRes.data ?? []) as ManRow[]) {
    if (row.photo_r2_key) {
      manualUrlByManualId.set(
        row.manual_vendor_id,
        r2PublicUrl(R2_BUCKETS.media, row.photo_r2_key),
      );
    }
  }
  for (const [vendorId, serviceId] of serviceIdByVendor) {
    const url = svcUrlByServiceId.get(serviceId);
    if (url) servicePhotoByVendor.set(vendorId, url);
  }
  for (const [vendorId, manualId] of manualIdByVendor) {
    const url = manualUrlByManualId.get(manualId);
    if (url) manualPhotoByVendor.set(vendorId, url);
  }

  return { servicePhotoByVendor, manualPhotoByVendor, linkedByVendorId };
}

/**
 * No-cron review-request sweep (lifted verbatim from the old flat-list page —
 * it was a module-local helper there, not a shared import). Any vendor still
 * in contracted/deposit_paid 24h past the event date flips to delivered + a
 * review_request notification fires. Race-guarded + idempotent.
 */
async function sweepRipeReviewRequests(
  eventId: string,
  coupleUserId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: ripe } = await admin
      .from('event_vendors')
      .select('vendor_id, vendor_name, events!inner(event_date)')
      .eq('event_id', eventId)
      .in('status', ['contracted', 'deposit_paid'])
      .lt('events.event_date', cutoffIso);
    const rows = (ripe ?? []) as Array<{
      vendor_id: string;
      vendor_name: string | null;
    }>;
    for (const v of rows) {
      const { data: updated, error: updErr } = await admin
        .from('event_vendors')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('vendor_id', v.vendor_id)
        .in('status', ['contracted', 'deposit_paid'])
        .select('vendor_id');
      if (updErr || !updated || updated.length === 0) continue;
      await emitNotification({
        userId: coupleUserId,
        type: 'review_request',
        title: `How was ${v.vendor_name ?? 'your vendor'}?`,
        body: 'Their service is marked delivered. Take a minute to leave a public review.',
        relatedUrl: `/dashboard/${eventId}/vendors/${v.vendor_id}/review`,
      });
    }
  } catch (e) {
    console.error('[reviews] ripe-review sweep failed:', e);
  }
}
