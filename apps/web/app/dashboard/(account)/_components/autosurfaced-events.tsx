import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { leaveAutoSurfacedEvent } from '@/lib/account-autosurface-actions';

/**
 * "You were added" — events auto-surfaced (#7b) into this account. Renders
 * NOTHING until FEATURE_ACCOUNT_AUTOSURFACE is enabled (no `auto_surfaced` rows
 * exist while the flag is off, so `surfaced` is always empty in prod today). Each
 * row carries a one-tap Leave — the opt-out (gap G5); the other "no" path is
 * declining the RSVP, handled DB-side.
 */
export async function AutoSurfacedEvents({ userId }: { userId: string }) {
  const supabase = await createClient();
  const guestEvents = await fetchUserEvents(supabase, userId, 'guest').catch(() => []);
  const surfaced = guestEvents.filter((e) => e.auto_surfaced);
  if (surfaced.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-ink">You were added</h2>
        <span className="text-xs text-ink/40">{surfaced.length}</span>
      </div>
      <ul className="space-y-2">
        {surfaced.map((event) => (
          <li
            key={event.event_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white/70 px-4 py-3"
          >
            <Link href={`/dashboard/${event.event_id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{event.display_name}</p>
              <p className="text-xs text-ink/50">A couple added you to their event.</p>
            </Link>
            <form action={leaveAutoSurfacedEvent}>
              <input type="hidden" name="event_id" value={event.event_id} />
              <button
                type="submit"
                className="shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:border-danger-300 hover:bg-danger-50 hover:text-danger-700"
              >
                Leave
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
