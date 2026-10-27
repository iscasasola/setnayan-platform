import 'server-only';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  GUEST_SESSION_COOKIE_NAME,
  guestSessionTokenStillCurrent,
  readGuestSession,
  verifyGuestSessionToken,
} from '@/lib/guest-session';
import { BROADCASTS_UNREADABLE, fetchLatestBroadcasts } from '@/lib/coordinator-broadcasts-server';
import { notRemembered, rememberedLiveRead } from '@/lib/live-day-cache';
import { isAuthCookieName } from '@/lib/hub-view-key';
import type { CoordinatorBroadcastItem } from '@/lib/coordinator-broadcasts';

/**
 * THE COORDINATOR'S WORDS, READ FOR A GUEST — one answer per event, one gate per phone (EV1, 2026-10-28).
 *
 * The announcement used to be read by `[slug]/layout.tsx` at render (guests only), then kept fresh on the phone by a
 * Supabase Realtime channel per guest plus a 45 s server-action pull. Owner, 2026-10-28 (DECISION_LOG "NO EVENT HUB MAY
 * CRASH"): *guests never hold a live connection*. And a layout that reads the guest's cookie makes EVERY page under it
 * render per request — the Event Hub included. So the card now asks `GET /{slug}/announcement` (route.ts beside the
 * page), which answers from here.
 *
 * 🧯 ONE READ PER EVENT. The latest announcement is the same for every guest of the event, so it is remembered per
 * event for a few seconds (`rememberedLiveRead`, lib/live-day-cache.ts); the coordinator's send clears it at once
 * (`revalidateTag(liveDayTag(eventId))`, day-of-broadcast.ts). A refused read is answered to THIS phone only.
 *
 * 🔒 THE GATE IS UNCHANGED: guests of THIS event only — *"an announcement is for the people in the room; 'the ceremony
 * is running late' is not for whoever was forwarded the URL."* (day-of-announcement.test.ts). It asks what
 * `readGuestSession` asked, at a fraction of the cost:
 *   · the pass cookie's SIGNATURE, for this event, unexpired (`verifyGuestSessionToken`);
 *   · its QR token still the guest's CURRENT one — answered from a per-event set of seals of every current pass
 *     (remembered like the words), so a rotated QR or a removed guest is refused within one window; a pass not in the
 *     set is asked of the database directly (`guestSessionTokenStillCurrent`, the chokepoint's own question, which
 *     fails OPEN on an outage exactly as before) — the set is only ever a fast YES;
 *   · somebody SIGNED IN goes through `readGuestSession` itself, so "the account outranks the pass" still decides.
 */

export type LatestAnnouncement = { body: string; createdAt: string };

/** The event's latest announcement (null: none) — remembered per event; throws on a refused read. */
export async function latestAnnouncementFor(eventId: string): Promise<LatestAnnouncement | null> {
  const items = await rememberedLiveRead<CoordinatorBroadcastItem[] | typeof BROADCASTS_UNREADABLE>(
    `announcement-v1:${eventId}`,
    eventId,
    async () => {
      const latest = await fetchLatestBroadcasts(createAdminClient(), eventId, 1);
      // A refused read is answered to this phone only — never handed to the others as the event's answer.
      return latest === BROADCASTS_UNREADABLE ? notRemembered(latest) : latest;
    },
  );
  if (items === BROADCASTS_UNREADABLE) throw new Error('announcement unreadable');
  const latest = items[0];
  if (!latest?.body?.trim()) return null;
  return { body: latest.body.trim(), createdAt: latest.createdAt };
}

async function sealOf(guestId: string, qrToken: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${guestId}|${qrToken}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Seals (never the tokens) of every current pass of the event — remembered per event; a failed read is not. */
async function currentPassSeals(eventId: string): Promise<ReadonlySet<string>> {
  const seals = await rememberedLiveRead<string[]>(`pass-seals-v1:${eventId}`, eventId, async () => {
    const { data, error } = await createAdminClient()
      .from('guests')
      .select('guest_id, qr_token')
      .eq('event_id', eventId)
      .is('deleted_at', null);
    if (error) return notRemembered<string[]>([]);
    const rows = (data ?? []) as Array<{ guest_id: string; qr_token: string | null }>;
    return Promise.all(rows.filter((r) => r.qr_token).map((r) => sealOf(r.guest_id, r.qr_token!)));
  });
  return new Set(seals);
}

/** Does THIS request hold a current guest pass for THIS event? (The announcement's gate — see the docblock.) */
export async function holdsThisEventsCurrentPass(eventId: string): Promise<boolean> {
  const jar = await cookies();
  if (jar.getAll().some((c) => isAuthCookieName(c.name))) {
    const session = await readGuestSession({ eventId });
    return session?.event_id === eventId;
  }
  const token = jar.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const verified = await verifyGuestSessionToken(token);
  if (!verified || verified.payload.event_id !== eventId || verified.expiresAtSeconds <= Date.now() / 1000) return false;
  const { guest_id, qr_token } = verified.payload;
  if ((await currentPassSeals(eventId)).has(await sealOf(guest_id, qr_token))) return true;
  return guestSessionTokenStillCurrent(guest_id, qr_token);
}
