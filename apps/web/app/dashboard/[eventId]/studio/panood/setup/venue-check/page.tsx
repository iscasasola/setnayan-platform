import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase.from('events').select('event_id').eq('event_id', eventId).maybeSingle();
  if (!event) notFound();

  const setupHref = `/dashboard/${eventId}/studio/panood/setup`;
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
