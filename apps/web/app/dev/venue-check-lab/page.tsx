/**
 * /dev/venue-check-lab — the Live Watch venue connection check on sample data. No sign-in, no database.
 * DEV-ONLY: production builds 404 this route, the same kill-switch as the other `/dev/*` labs. It draws the
 * REAL screens (`venue-check-runner.tsx`'s Ready · Busy · Done and the setup page's card), and the result
 * frames are judged by the real `judgeVenue`, so what it shows is what ships.
 *
 *   ?f=ready        before a run, with a last result      ?f=ready-none  before the first run
 *   ?f=error        a run that could not start            ?f=busy        mid-run
 *   ?f=full         green                                 ?f=reduced     yellow
 *   ?f=not_enough   red
 *   ?f=card         the setup page's card, checked        ?f=card-none   not checked yet
 *   ?f=card-unread  the last check could not be read
 */
import { notFound } from 'next/navigation';
import { VenueCheckLabFrames } from './frames';

export default async function VenueCheckLabPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { f = 'ready' } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-xl bg-cream px-4 pb-24 pt-6" data-venue-check-lab={f}>
      <VenueCheckLabFrames f={f} />
    </main>
  );
}
