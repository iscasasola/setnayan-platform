import { cache } from 'react';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import PublicInvitationPage, { generateMetadata as liveMetadata } from '../../page';
import { loadEventShell } from '../../_lib/loaders';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestSessionTokenStillCurrent, resolveGuestSessionSecret } from '@/lib/guest-session';
import { hubPassMac, parseHubViewKey, sameMac } from '@/lib/hub-view-key';
import { holdCachedHubViewer, type CachedHubViewer } from '@/lib/hub-request';
import { liveDayTag } from '@/lib/live-day-cache';

/**
 * /{slug} — THE EVENT HUB, SERVED FROM THE CACHE (EV1 · owner 2026-10-28: *"Our priority is not crash any event hub
 * most specially during their event"*).
 *
 * Never addressed directly: the middleware rewrites a guest's or a stranger's `/{slug}` here, with the key it read off
 * the request (`lib/hub-view-key.ts` — the event's stamp, the viewer, the device facts, the tab), and refuses this path
 * from outside. The page itself is the live page's own function (`../../page.tsx`), unchanged; what differs is that NOTHING
 * below reads the request — the viewer is decided from the key and held for the render (`lib/hub-request.ts`) — so
 * Next renders each key once and serves it from the cache:
 *   · until the event's stamp moves (a write to any table the guest page shows → a new key);
 *   · or an announcement clears the event's live-day tag (`revalidateTag(liveDayTag(eventId))`);
 *   · or `revalidate` seconds pass (the clock-driven parts: the day's phase, the run of show).
 * A guest's OWN write gives them a fresh copy at once (`HUB_BUST_COOKIE`, set by the middleware on their write).
 *
 * 🔒 A guest's copy is drawn for them only after their seal is checked against their CURRENT QR token — a rotated QR,
 * a removed guest or another event's pass draws the stranger's page, exactly as the live render would have.
 */

/** The backstop — the live render's own 2026-05-22 window (owner-accepted for guests); the stamp is the freshness rule. */
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): Array<{ slug: string; key: string }> {
  return [];
}

type Props = { params: Promise<{ slug: string; key: string }> };

type Resolved = { viewer: CachedHubViewer; eventId: string | null; tab: string | null };

/** The key → the viewer this copy is for. `null` = not a key we made / not an event (404). Throws on a failed read. */
const resolve = cache(async (slug: string, rawKey: string): Promise<Resolved | null> => {
  const key = parseHubViewKey(rawKey);
  if (!key) return null;
  let event: Awaited<ReturnType<typeof loadEventShell>>;
  try {
    event = await loadEventShell(slug);
  } catch {
    // ⏱ The event did not answer (a stalled database). Draw nobody's page and let the page's OWN read of the same
    // (`cache()`d, so equally failed) event say its honest words through its bounded wait — never a bare 500 from here,
    // and never a stranger's page under a guest's key: the page throws before it draws anything for anyone.
    return { viewer: { pass: null, ua: null }, eventId: null, tab: key.tab };
  }
  if (!event?.event_id) return null;
  let pass: CachedHubViewer['pass'] = null;
  if (key.viewer.kind === 'guest') {
    const { data, error } = await createAdminClient()
      .from('guests')
      .select('qr_token')
      .eq('guest_id', key.viewer.guestId)
      .eq('event_id', event.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    // A read that did not complete is never drawn as "a stranger" into the cache — the render fails, nothing is kept,
    // and the next open asks again (a stale copy, if any, keeps being served meanwhile).
    if (error) throw new Error(`cached hub: the guest's pass could not be checked (${error.code ?? ''})`);
    const qr = (data as { qr_token?: string | null } | null)?.qr_token ?? null;
    const secret = resolveGuestSessionSecret();
    if (qr && secret.ok && sameMac(key.viewer.mac, await hubPassMac(secret.material, key.viewer.guestId, qr))) {
      // The chokepoint's own question, so this copy is drawn under exactly the rule the live render applies.
      if (await guestSessionTokenStillCurrent(key.viewer.guestId, qr)) {
        pass = { guest_id: key.viewer.guestId, event_id: event.event_id, qr_token: qr };
      }
    }
  }
  return { viewer: { pass, ua: pass ? key.ua : null }, eventId: event.event_id, tab: key.tab };
});

/** Files this copy under the event's live-day tag, so an announcement (or any live-day writer) clears it. */
async function wearTheEventsTag(eventId: string): Promise<void> {
  await unstable_cache(async () => true, ['hub-view-tag', eventId], { tags: [liveDayTag(eventId)] })();
}

export async function generateMetadata({ params }: Props) {
  const { slug, key } = await params;
  const r = await resolve(slug, key);
  if (!r) notFound();
  holdCachedHubViewer(r.viewer);
  return liveMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(r.tab ? { tab: r.tab } : {}) });
}

export default async function CachedEventHub({ params }: Props) {
  const { slug, key } = await params;
  const r = await resolve(slug, key);
  if (!r) notFound();
  holdCachedHubViewer(r.viewer);
  if (r.eventId) await wearTheEventsTag(r.eventId);
  return PublicInvitationPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(r.tab ? { tab: r.tab } : {}),
  });
}
