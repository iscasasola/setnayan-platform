import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { CohostWelcomeNotice } from './cohost-welcome-notice';

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

  // 🔔 Inventory #19 — a line in the one notice system (the sheet is gone); see cohost-welcome-notice.tsx.
  return <CohostWelcomeNotice notificationId={notice.notification_id} title={notice.title} body={notice.body} />;
}
