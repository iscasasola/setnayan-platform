'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { BROADCASTS_UNREADABLE, fetchLatestBroadcasts } from '@/lib/coordinator-broadcasts-server';
import { notRemembered, rememberedLiveRead } from '@/lib/live-day-cache';
import type { CoordinatorBroadcastItem } from '@/lib/coordinator-broadcasts';

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

  // 🧯 ONE READ PER EVENT, NOT PER PHONE (2026-10-18, live-day polling). Every guest's phone asks this every 45 s,
  // and ALL of them ask the instant the coordinator's ping arrives. The latest announcement is the same for every
  // guest of the event, so it is remembered per event for a few seconds (lib/live-day-cache.ts); the guest's own
  // cookie check above stays per request. The writer (day-of-broadcast.ts) clears the event's tag BEFORE it pings,
  // so the asks a ping sets off read the new words, never the remembered old ones.
  const items = await rememberedLiveRead<CoordinatorBroadcastItem[] | typeof BROADCASTS_UNREADABLE>(`announcement-v1:${eventId}`, eventId, async () => {
    const latest = await fetchLatestBroadcasts(createAdminClient(), eventId, 1);
    // A refused read is answered to this phone only — never handed to the others as the event's answer.
    return latest === BROADCASTS_UNREADABLE ? notRemembered(latest) : latest;
  });
  // A refused read is a dropped hint, not a "nothing was said" — the caller's
  // own poll timer asks again next cycle (see the docstring above), so there
  // is nothing more to do here than decline to report a false absence.
  if (items === BROADCASTS_UNREADABLE) return null;
  const latest = items[0];
  if (!latest) return null;
  return { body: latest.body, createdAt: latest.createdAt };
}
