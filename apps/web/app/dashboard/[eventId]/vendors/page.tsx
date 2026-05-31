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
import { fetchEventVendors } from '@/lib/vendors';
import { buildPlanBudgetModel } from '@/lib/vendors-plan-budget';
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

  // Map the fetched event_vendors rows into the canonical bucketer's input
  // shape. fetchEventVendors selects the base columns; the marketplace-join
  // fields (logo / compat arrays / service photo) aren't selected here yet —
  // they light up the card's photo / distance / reviews in a follow-up that
  // extends the fetch. Until then the card falls back to initials + name +
  // price (no fabrication).
  const vendorRows: EventVendorRowInput[] = vendors.map((v) => ({
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
  }));

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

  const model = buildPlanBudgetModel({
    vendorRows,
    estimatedBudgetCentavos: ev?.estimated_budget_centavos ?? null,
    daysUntilWedding,
    ceremonyType: ev?.ceremony_type ?? null,
    venueSetting: ev?.venue_setting ?? null,
    transportByVendorId,
    crewMealByVendorId,
    // eyeingByVendorId (same-date soft-hold count) is threaded in a later
    // stage; omitted now → no eyeing chip renders (aggregate-only).
  });

  // Full-bleed: cancel the shared dashboard <main> padding (px-4 py-6 /
  // sm:px-6 / lg:px-8) so the accordion sits edge-to-edge directly under the
  // sticky chrome bar. This makes the cover screen full-width AND lets the
  // accordion measure the true chrome height (its top edge = chrome bottom at
  // scroll-top). The -my-6 also removes the top gap so the budget bar docks
  // flush beneath the chrome. CLAUDE.md 2026-05-31 (cover + sticky-stack fix).
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <PlanBudgetAccordion model={model} eventId={eventId} />
    </div>
  );
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
