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
export async function CohostWelcome({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id, title, body')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('type', 'cohost_added')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('CohostWelcome', error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;
  const notice = data as { notification_id: string; title: string; body: string | null };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cohost-welcome-title"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      data-cohost-welcome
    >
      <div className="w-full max-w-md rounded-t-2xl bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl sm:rounded-2xl sm:p-6">
        <p className="sn-eye text-[color:var(--sn-gold-700)]">Welcome</p>
        <h2 id="cohost-welcome-title" className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {notice.title}
        </h2>
        {notice.body ? <p className="mt-2 text-sm leading-relaxed text-ink/70">{notice.body}</p> : null}
        <form action={markNotificationRead} className="mt-5">
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
