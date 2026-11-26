import { eventRowOnce } from '@/lib/event-row-once';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/server';
import { readLatestVenueCheck } from '@/lib/venue-check-read.server';
import { PageMasthead } from '@/app/_components/page-masthead';
import { VenueCheckRunner } from './_components/venue-check-runner';

export const metadata = { title: 'Venue connection check' };

/**
 * Live Watch › venue connection check (owner 5 Nov 2026: "it should"). Opened on a phone at the venue
 * from the setup page's footer. The test, the verdict and the cleanup are in lib/venue-check.ts,
 * lib/venue-probe-run.ts and ./actions.ts.
 */
export default async function VenueCheckPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await eventRowOnce(supabase, eventId, 'event_id', () =>
      supabase.from('events').select('event_id').eq('event_id', eventId).maybeSingle());
  const setupHref = `/dashboard/${eventId}/studio/panood/setup`;
  // A7-20 (drawing final-check-area-7 § 2b): a REFUSED read says so and offers Try again — never the 404 "this page does
  // not exist" for an event that exists. Only an answered miss (no row, no error) is still the 404. The words and the
  // neutral Try again are the ones Spaces ships for its refused read.
  if (eventError) {
    return (
      <section className="mx-auto max-w-xl space-y-6">
        <Link
          href={setupHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to Live Watch setup
        </Link>
        <PageMasthead title={metadata.title} />
        <div className="space-y-3" role="alert" data-venue-check-refused="">
          <p className="text-sm text-ink/70">Couldn&rsquo;t load this event just now. Nothing was changed.</p>
          <ActionButton
            tone="neutral"
            icon={<RotateCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Try again"
            href={`/dashboard/${eventId}/studio/panood/setup/venue-check`}
          />
        </div>
      </section>
    );
  }
  if (!event) notFound();

  const last = await readLatestVenueCheck(supabase, eventId);

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <Link
        href={setupHref}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Live Watch setup
      </Link>
      <PageMasthead title={metadata.title} />
      <VenueCheckRunner eventId={eventId} setupHref={setupHref} last={last} />
    </section>
  );
}
