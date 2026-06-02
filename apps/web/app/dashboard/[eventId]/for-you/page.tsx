import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  formatEventDateWithPrecision,
  type EventDatePrecision,
} from '@/lib/events';
import { buildTasteChips } from '@/lib/personalized-menu';
import { PersonalizedMenu } from '../_components/personalized-menu';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'For you' };

/**
 * For you · /dashboard/[eventId]/for-you
 *
 * The couple's full match-criteria view — the curated information from
 * onboarding/event-creation that Setnayan filters + sorts the vendor
 * search by (date · region · ceremony + secondary · reception venue ·
 * guest count · style/feel · budget). Home surfaces the same block; this
 * is its deep-link target (reachable via the More tab).
 *
 * Owner correction 2026-06-02 (CLAUDE.md): "Personalized" = the curated
 * match criteria, NOT the couple's shortlisted vendors (those live on the
 * Vendors tab). Built from production `events` columns only.
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
      'event_id, display_name, event_date, event_date_precision, ceremony_type, secondary_ceremony_type, venue_setting, estimated_pax, estimated_budget_centavos, region, mood_feel_key',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const precision =
    ((event as { event_date_precision?: string | null }).event_date_precision as
      | EventDatePrecision
      | null
      | undefined) ?? 'day';
  const formattedDate = event.event_date
    ? formatEventDateWithPrecision(event.event_date, precision)
    : null;

  const tasteChips = buildTasteChips(event, formattedDate);

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

      <PersonalizedMenu eventId={eventId} variant="full" tasteChips={tasteChips} />
    </section>
  );
}
