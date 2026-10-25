import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { markNotificationRead } from '@/lib/notification-actions';

/**
 * cohost-welcome.tsx — "You are now a co-host for {user name}'s {event name}
 * {event type} event. You have access to the following: … (CONFIRM)".
 *
 * Owner 2026-09-28: when a joined guest is made a co-host "they will get a
 * notification … (CONFIRM)". The database writes that notice the moment the
 * seat goes live (`activate_guest_seats`, migration 20271251336140). This
 * panel is its CONFIRM step: it shows on ANY page of this event for as long as
 * the notice is unread — so a new co-host who opens the event from their Events
 * page, not the bell, still meets it once — and CONFIRM marks it read.
 *
 * CONFIRM acknowledges; it is not a yes/no. The access is already theirs.
 * Server-rendered, no script: it works in a viewer that runs no JavaScript.
 * A refused read renders nothing — the access is real either way; only the
 * announcement is skipped.
 */
/**
 * The one read, cache()d per render — so the event layout can START it beside
 * its other reads (`cohostWelcomeNotice(eventId, user.id)` in its read block)
 * instead of this component asking only after the whole rail has rendered: one
 * database trip less in front of every event page's first paint. Same read,
 * same failure (a refusal → nothing shown), same answer.
 */
export const cohostWelcomeNotice = cache(async (eventId: string, userId: string) => {
  const supabase = await createClient();
  return supabase
    .from('notifications')
    .select('notification_id, title, body')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('type', 'cohost_added')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
});

export async function CohostWelcome({ eventId, userId }: { eventId: string; userId: string }) {
  const { data, error } = await cohostWelcomeNotice(eventId, userId);
  if (error) {
    logQueryError('CohostWelcome', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;
  const notice = data as { notification_id: string; title: string; body: string | null };

  return (
    // role="dialog" WITHOUT aria-modal: server-rendered, no script, so it cannot
    // trap focus — and a modal that promises to and does not is worse than an
    // honest dialog (modal-a11y-adoption.test.ts).
    <div
      role="dialog"
      aria-labelledby="cohost-welcome-title"
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 tab:items-center tab:p-6"
      data-cohost-welcome
    >
      {/* THE ONE BACKDROP, script-free (owner 2026-10-25: dark + blurred, held still, a tap on the dark closes it).
          The same house look as <OverlayBackdrop>, which needs a client handler this server panel cannot pass — so
          the dark is a submit button for the Confirm form below: closing this panel IS confirming it. */}
      <button
        type="submit"
        form={`cohost-welcome-${notice.notification_id}`}
        aria-label="Confirm"
        data-overlay-backdrop=""
        className="sn-popup-dark sn-fade fixed inset-0 block min-h-0 w-full cursor-default touch-none overscroll-none p-0"
      />
      <div className="relative w-full max-w-md rounded-t-2xl bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl tab:rounded-2xl tab:p-6">
        <p className="sn-eye text-[color:var(--sn-gold-700)]">Welcome</p>
        <h2 id="cohost-welcome-title" className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {notice.title}
        </h2>
        {notice.body ? <p className="mt-2 text-sm leading-relaxed text-ink/70">{notice.body}</p> : null}
        <form id={`cohost-welcome-${notice.notification_id}`} action={markNotificationRead} className="mt-5">
          <input type="hidden" name="notification_id" value={notice.notification_id} />
          <input type="hidden" name="return_to" value={`/dashboard/${eventId}`} />
          <button type="submit" className="button-primary h-11 w-full">
            Confirm
          </button>
        </form>
      </div>
    </div>
  );
}
