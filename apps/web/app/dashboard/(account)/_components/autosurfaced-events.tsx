import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { eventBoardHref } from '@/lib/event-board';
import { leaveAutoSurfacedEvent } from '@/lib/account-autosurface-actions';

/**
 * "You were added" — events auto-surfaced (#7b) into this account. Renders
 * NOTHING until FEATURE_ACCOUNT_AUTOSURFACE is enabled (no `auto_surfaced` rows
 * exist while the flag is off, so `surfaced` is always empty in prod today). Each
 * row carries a one-tap Leave — the opt-out (gap G5); the other "no" path is
 * declining the RSVP, handled DB-side.
 *
 * 🚨 THE ROW USED TO LINK TO `/dashboard/[eventId]`, WHICH IS A 404 FOR EVERY
 * PERSON IT IS SHOWN TO. Every row here is a `member_type = 'guest'` membership,
 * and that layout admits `'couple'` only — so "a couple added you to their
 * event" opened onto a not-found page. Identical to the harm Session 8 found on
 * an Alaala card 2026-08-12 and deliberately did not propagate. It has never
 * fired in prod (the flag is off, and no `auto_surfaced` row exists), so nothing
 * visible changes today — but the trap is removed rather than left armed for
 * whoever flips the flag. The destination now comes from the one helper that
 * knows what a member_type can open (lib/event-board.ts), and a guest whose host
 * has opened no public page gets NO link instead of a broken one.
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
        {surfaced.map((event) => {
          const href = eventBoardHref(event);
          const body = (
            <>
              <p className="truncate text-sm font-medium text-ink">{event.display_name}</p>
              <p className="text-xs text-ink/50">
                {href
                  ? 'A couple added you to their event.'
                  : 'A couple added you to their event. They haven’t opened their page yet.'}
              </p>
            </>
          );
          return (
          <li
            key={event.event_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white/70 px-4 py-3"
          >
            {href ? (
              <Link href={href} className="min-w-0 flex-1">
                {body}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{body}</div>
            )}
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
          );
        })}
      </ul>
    </section>
  );
}
