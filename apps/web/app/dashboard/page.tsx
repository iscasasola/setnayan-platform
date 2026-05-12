import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents, formatEventDate, type EventWithRole } from '@/lib/events';

export const metadata = {
  title: 'Your events',
};

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already redirects to /login if no user; this is for type narrowing.
  if (!user) redirect('/login');

  const events = await fetchUserEvents(supabase, user.id, 'couple');
  const active = events.filter((e) => !e.archived);
  const archived = events.filter((e) => e.archived);

  // Auto-jump rule (per spec): exactly 1 active event → straight into it.
  if (active.length === 1 && active[0]) {
    redirect(`/dashboard/${active[0].event_id}`);
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle();
  const greeting = profile?.display_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Setnayan · dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {active.length === 0 ? `Welcome, ${greeting}.` : `Hi ${greeting}.`}
        </h1>
        <p className="text-base text-ink/60">
          {active.length === 0
            ? "Let's set up your first event."
            : 'Which event are you working on?'}
        </p>
      </header>

      {active.length === 0 ? <EmptyState /> : <EventList events={active} />}

      {archived.length > 0 ? (
        <details className="mt-10 rounded-lg border border-ink/10 bg-cream p-4 text-sm text-ink/70">
          <summary className="cursor-pointer font-medium">
            Archived events ({archived.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {archived.map((event) => (
              <li key={event.event_id}>
                <Link
                  href={`/dashboard/${event.event_id}`}
                  className="text-ink/80 underline-offset-4 hover:underline"
                >
                  {event.display_name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
      <p className="mb-4 text-ink/70">
        You haven&rsquo;t created or joined an event yet.
      </p>
      <Link className="button-primary" href="/dashboard/create-event">
        + Create event
      </Link>
    </div>
  );
}

function EventList({ events }: { events: EventWithRole[] }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.event_id}>
            <Link
              href={`/dashboard/${event.event_id}`}
              className="group flex items-start justify-between gap-4 rounded-lg border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
            >
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-base font-medium text-ink">
                  {event.is_primary ? (
                    <span aria-hidden className="text-terracotta">
                      ★
                    </span>
                  ) : null}
                  <span>{event.display_name}</span>
                </p>
                <p className="text-sm text-ink/60">
                  {[
                    formatEventDate(event.event_date),
                    event.venue_name,
                    event.event_type !== 'wedding' ? event.event_type : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">
                  {event.public_id}
                </p>
              </div>
              <span
                aria-hidden
                className="text-2xl text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-terracotta"
              >
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="pt-4">
        <Link className="button-secondary" href="/dashboard/create-event">
          + Create another event
        </Link>
      </div>
    </div>
  );
}
