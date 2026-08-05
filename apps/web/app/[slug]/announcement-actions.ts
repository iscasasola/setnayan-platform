'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { fetchLatestBroadcasts } from '@/lib/coordinator-broadcasts-server';

/**
 * The guest's authorized read of the latest day-of announcement.
 *
 * WHY THIS EXISTS RATHER THAN A REALTIME ROW SUBSCRIPTION. The coordinator's
 * announcement was resolved ONCE, server-side, at render — so "phones down, the
 * ceremony is starting" reached only the guests who happened to reload. Every
 * other live surface in the product already fixes that with Supabase Realtime,
 * so the question was only which of the two shipped patterns applies.
 *
 * `postgres_changes` honours RLS, which is what the budget, the chat and the
 * seating plan use. It cannot work here: a wedding guest holds a signed COOKIE,
 * not a Supabase auth session, so to Supabase they are anonymous. Making the
 * rows readable by `anon` would publish every couple's announcements to anyone
 * who could guess an event id.
 *
 * `broadcast` — the photo wall's pattern — has no RLS at all. So the channel
 * carries NO ANNOUNCEMENT TEXT: it carries the fact that one exists. A stranger
 * who subscribed would learn only that this event said something, which is
 * already visible from the page being live at all. The words come from here,
 * where the guest's cookie is checked and the event is pinned to their own.
 *
 * 🔑 The channel is a HINT, never the delivery. If it drops — which venue wifi
 * does constantly — the caller's own timer still asks, so a coordinator's words
 * arrive late rather than never. Same reasoning the wall states for its tiles.
 */
export async function latestAnnouncementForGuest(
  eventId: string,
): Promise<{ body: string; createdAt: string } | null> {
  const session = await readGuestSession();
  // Not this guest's event (or no invitation at all) — say nothing, and say it
  // the same way for both, so the answer leaks no membership either.
  if (!session || session.event_id !== eventId) return null;

  const admin = createAdminClient();
  const items = await fetchLatestBroadcasts(admin, eventId, 1);
  const latest = items[0];
  if (!latest) return null;
  return { body: latest.body, createdAt: latest.createdAt };
}
