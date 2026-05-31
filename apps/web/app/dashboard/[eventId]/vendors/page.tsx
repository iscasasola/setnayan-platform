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
import { buildPlanBudgetModel, type VendorEnrichment } from '@/lib/vendors-plan-budget';
import { haversineKm } from '@/lib/distance';
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';
import { PlanBudgetAccordion } from './_components/plan-budget-accordion';

export const metadata = { title: 'Vendors' };

type Props = {
  params: Promise<{ eventId: string }>;
  // status query param kept for backward-compat with old links; the accordion
  // ignores it (folder-scoped browsing happens in the marketplace, not here).
  searchParams: Promise<{ status?: string }>;
};

type EventBudgetRow = {
  event_date: string | null;
  estimated_budget_centavos: number | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  ceremony_type: string | null;
  venue_setting: string | null;
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

  const [vendors, eventCtx] = await Promise.all([
    fetchEventVendors(supabase, eventId),
    supabase
      .from('events')
      .select(
        'event_date, estimated_budget_centavos, venue_latitude, venue_longitude, ceremony_type, venue_setting',
      )
      .eq('id', eventId)
      .maybeSingle(),
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
    const [statsRes, profRes] = await Promise.all([
      supabase
        .from('vendor_market_stats')
        .select(
          'vendor_profile_id, business_name, logo_url, location_city, hq_latitude, hq_longitude, avg_rating_overall, review_count, is_setnayan_service, public_visibility, services',
        )
        .in('vendor_profile_id', marketplaceIds),
      supabase
        .from('vendor_profiles')
        .select('vendor_profile_id, name_revealed_at, screen_name')
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
    };

    const statsByProfile = new Map<string, StatsRow>();
    for (const s of (statsRes.data as StatsRow[] | null) ?? []) {
      statsByProfile.set(s.vendor_profile_id, s);
    }
    const anonByProfile = new Map<string, ProfRow>();
    for (const p of (profRes.data as ProfRow[] | null) ?? []) {
      anonByProfile.set(p.vendor_profile_id, p);
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
      // venue-exempt; the screen name while still hidden. Marketplace surfaces
      // have no subscription join, so isPaidTier=false (matches vendor-card).
      const resolvedName = resolveVendorDisplayName({
        business_name: s.business_name,
        name_revealed_at: a?.name_revealed_at ?? null,
        isPaidTier: false,
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

  const model = buildPlanBudgetModel({
    vendorRows,
    estimatedBudgetCentavos: ev?.estimated_budget_centavos ?? null,
    daysUntilWedding,
    ceremonyType: ev?.ceremony_type ?? null,
    venueSetting: ev?.venue_setting ?? null,
    transportByVendorId,
    crewMealByVendorId,
    eyeingByVendorId,
    enrichmentByVendorId,
  });

  return <PlanBudgetAccordion model={model} eventId={eventId} />;
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
