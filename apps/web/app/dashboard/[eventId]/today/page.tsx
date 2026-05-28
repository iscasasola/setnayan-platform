import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WizardHero } from '../_components/wizard-hero';

/**
 * Today's Focus — first bottom-nav tab (placed BEFORE Home).
 *
 * Owner directive 2026-05-24: extract the Today's Focus wizard surface
 * (originally branded Concierge Active Wizard in V1; V2 cutover
 * 2026-05-28 renamed the brand · iteration 0016 substrate unchanged ·
 * CLAUDE.md 2026-05-23 row 6) from the event-home page into its own
 * first-class /today route. The WizardHero block + IN-FLIGHT TRAY that
 * previously rendered inline at the top of `/dashboard/[eventId]` now
 * lives here. Reachable via the "Today" tab in the BottomNav (Focus
 * icon · first position before Home).
 *
 * Why a focused route: the wizard surface is the host's daily entry point
 * to actionable planning work. Pulling it out of the dense event-home
 * page gives it the visual breathing room it needs AND lets us add
 * surrounding context (countdown · streak · recent completions) here
 * later without ballooning event-home further.
 *
 * Data fetches mirror the minimum set the WizardHero consumes — NOT the
 * full event-home query shape. Three queries:
 *   1. `auth.getUser()` — auth gate (redirect to /login if anonymous)
 *   2. `events` — pull just the 6 fields WizardHero reads (wizard_state,
 *      event_date, ceremony_type, venue_setting, venue_latitude,
 *      venue_longitude). RLS scopes to events the host belongs to.
 *   3. `event_vendors.marketplace_vendor_id` — drives the
 *      excludeMarketplaceVendorIds prop so already-locked vendors
 *      filter out of the wizard's vendor-pick recommendations.
 *
 * Compatibility arrays for the wizard's per-card filtering live in the
 * card components themselves (e.g., ceremony-venue-card reads
 * venue_settings); WizardHero just threads ceremonyType + venueSetting
 * + venue lat/lng forward — those come from the event row above.
 */
export default async function TodaysFocusPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use `maybeSingle()` not `.single()` per the canonical guard pattern
  // (PGRST116 "0 rows" should NOT throw — it should fall through to
  // `notFound()` so the host sees the framework 404 page, not a stack).
  // Mirrors the dashboard layout's events-fetch pattern at layout.tsx:139.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, event_date, ceremony_type, venue_setting, venue_latitude, venue_longitude, wizard_state',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  // marketplaceIds drives the wizard's "don't recommend a vendor I've
  // already locked" filter on vendor-pick cards. Pulled from event_vendors
  // rows where the host linked a marketplace vendor (marketplace_vendor_id
  // is non-null). Off-platform / custom-added vendors don't have a
  // marketplace_vendor_id and don't affect the exclusion set.
  const { data: vendorRows } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId);

  const marketplaceIds = Array.from(
    new Set(
      (vendorRows ?? [])
        .map((v) => v.marketplace_vendor_id)
        .filter((id): id is string => id !== null),
    ),
  );

  // ceremonyType + venueSetting narrowing — mirrors the type-cast pattern
  // event-home uses at lines 1232-1234. The DB column allows nullable +
  // arbitrary string for legacy rows; WizardHero's prop is a narrower
  // union of the 7 canonical ceremony types per iteration 0043.
  const eventCeremonyType =
    (event as { ceremony_type?: string | null }).ceremony_type ?? null;
  const eventVenueSetting =
    (event as { venue_setting?: string | null }).venue_setting ?? null;

  return (
    <section className="space-y-4">
      {/* No headline / breadcrumb — the wizard card body owns the page's
       *  visual hierarchy. Adding a "Today's Focus" h1 here would compete
       *  with the wizard card's own heading + create a stuttering double-
       *  title effect (mirrors why the event-home wizard block has no
       *  outer heading either). The BottomNav tab label is the page's
       *  identity. */}
      <WizardHero
        eventId={eventId}
        wizardState={(event as { wizard_state?: unknown }).wizard_state}
        eventDate={event.event_date}
        ceremonyType={
          eventCeremonyType as Parameters<typeof WizardHero>[0]['ceremonyType']
        }
        venueSetting={eventVenueSetting}
        meaningfulDates={[]}
        excludeMarketplaceVendorIds={marketplaceIds}
      />
    </section>
  );
}
