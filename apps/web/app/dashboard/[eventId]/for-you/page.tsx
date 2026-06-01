import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  formatEventDateWithPrecision,
  type EventDatePrecision,
} from '@/lib/events';
import {
  buildTasteChips,
  mapServices,
  type VendorRowSource,
} from '@/lib/personalized-menu';
import { PersonalizedMenu } from '../_components/personalized-menu';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'For you' };

/**
 * For you · /dashboard/[eventId]/for-you
 *
 * The full personalized menu — the couple's wedding shape (taste chips
 * from the event row) + every service they've added (event_vendors with
 * status pills). The lean event-home renders a preview of this; this is
 * the "See all" destination + the "For you" bottom-nav tab target.
 *
 * Owner directive 2026-06-02 (CLAUDE.md) — lean home + 4-tab nav
 * (Home · For you · Activity · More). Built from production data only;
 * onboarding "taste" (feel/dietary/style) fills in when onboarding ships.
 *
 * Guard mirrors /today/page.tsx (maybeSingle → notFound).
 */
export default async function ForYouPage({
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

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_date, event_date_precision, ceremony_type, venue_setting, estimated_pax, estimated_budget_centavos',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const { data: vendorRows } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, status, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  const precision =
    ((event as { event_date_precision?: string | null }).event_date_precision as
      | EventDatePrecision
      | null
      | undefined) ?? 'day';
  const formattedDate = event.event_date
    ? formatEventDateWithPrecision(event.event_date, precision)
    : null;

  const tasteChips = buildTasteChips(event, formattedDate);
  const services = mapServices(eventId, (vendorRows ?? []) as VendorRowSource[]);

  const eventName =
    (event as { display_name?: string | null }).display_name?.trim() || 'Your wedding';

  return (
    <section className="space-y-4">
      <header className="space-y-1.5">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          For you
        </p>
        <h1
          className="m-display-tight text-2xl uppercase sm:text-3xl"
          style={{ letterSpacing: '-0.005em', color: 'var(--m-ink)' }}
        >
          {eventName.toUpperCase()}
        </h1>
      </header>

      <PersonalizedMenu
        eventId={eventId}
        variant="full"
        tasteChips={tasteChips}
        services={services}
      />
    </section>
  );
}
