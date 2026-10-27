import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { readEventsYouRun } from '@/lib/events-you-run.server';
import { EventsYouRunScreen } from '../_components/events-you-run-screen';

/**
 * /vendor-dashboard/events — 🗂 **Events you run**, the fifth tab (owner "approved", 2026-10-28; DECISION_LOG
 * "COORDINATORS GET A DOOR INTO THE EVENTS THEY RUN"; prototype `coordinator_door_2026-10-28` frame B).
 *
 * Every event this person runs, LIVE, as the hosts' coordinator — upcoming first, a status line each, Open › into the
 * couple's own event dashboard (which admits them through its shipped check; nothing here grants anything). The tab
 * is drawn only while this list has a row (`runsEvents` in the layout), so this page is normally reached through it;
 * a bookmark after the access ended lands on a plain "nothing to run" with the way back to Today — never an error.
 */
export const dynamic = 'force-dynamic';

export default async function EventsYouRunPage() {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) redirect('/login');
  const { events, measured } = await readEventsYouRun(supabase, user.id);
  return (
    <div className="mx-auto w-full max-w-6xl tab:max-w-3xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <EventsYouRunScreen events={events} measured={measured} />
      {events.length === 0 ? (
        <Link
          href="/vendor-dashboard"
          className="home-row min-h-11 border-t-0 text-[15px] text-ink"
          data-events-you-run-back=""
        >
          <span>Back to Today</span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}
