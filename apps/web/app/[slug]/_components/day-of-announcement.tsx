'use client';

import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { latestAnnouncementForGuest } from '../announcement-actions';

/**
 * DayOfAnnouncement — what the coordinator says, where the guests are.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 * The composer shipped months ago and the privacy control for it is ACTIVE in
 * production, but nothing on the guest site ever read what it wrote. A
 * coordinator could type "phones down, the ceremony is starting" and it would
 * appear only on the couple's own dashboard — i.e. to the two people least
 * able to act on it while walking down an aisle.
 *
 * ── WHY IT LOOKS LIKE THIS ──────────────────────────────────────────────────
 * Loud enough to be seen by someone glancing at a phone in a dim reception,
 * quiet enough not to shout over the couple's own page. It sits at the top of
 * the guest's view during the live window and nowhere else.
 *
 * It is deliberately NOT dismissible. An announcement is not a notification —
 * "phones down" that a guest can swipe away is worse than none, because the
 * coordinator has no way to know it was dismissed. It disappears on its own
 * when the day-of window closes, or when a newer one replaces it.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * Not a feed and not a conversation. One message, the latest. Anything
 * two-way belongs in the coordinator's own surfaces, not on a wedding page a
 * guest opened to find their table.
 *
 * ── IT ARRIVES ON ITS OWN NOW (2026-08-05) ──────────────────────────────────
 * It used to be resolved once, server-side, at render. So the message reached
 * only the guests who happened to reload — and nobody reloads a page they are
 * already looking at. "Phones down, the ceremony is starting" is worth nothing
 * five minutes late.
 *
 * Two things bring it in, and the ORDER MATTERS:
 *   1. a Supabase `broadcast` ping on this event's channel — instant, and
 *      carrying NO TEXT (see announcement-actions.ts for why);
 *   2. a slow poll, because venue wifi drops channels constantly. The ping is
 *      a hint; the timer is the guarantee. A dropped channel costs latency,
 *      never the message.
 *
 * The server-rendered `body` seeds it, so the first paint is unchanged and a
 * guest who lands mid-announcement still sees it with no round-trip.
 */
export function DayOfAnnouncement({
  body,
  eventId,
}: {
  body: string;
  /** Which event to listen on. Absent → the component stays exactly as it was,
   *  server-rendered and static, so nothing regresses if a caller forgets. */
  eventId?: string;
}) {
  const [text, setText] = useState(body);
  // The server value wins on navigation — otherwise a guest moving between
  // pages would keep whatever the last subscription happened to fetch.
  const seeded = useRef(body);
  if (seeded.current !== body) {
    seeded.current = body;
    if (text !== body) setText(body);
  }

  useEffect(() => {
    if (!eventId) return;
    let alive = true;

    const pull = async () => {
      try {
        const latest = await latestAnnouncementForGuest(eventId);
        // Only ever REPLACE with something real. A failed read must not blank a
        // standing "phones down" off a guest's screen — the same rule the rest
        // of the guest site follows: an empty answer and a broken one are not
        // the same thing, and this one is safety-adjacent.
        if (alive && latest?.body) setText(latest.body);
      } catch {
        // Venue wifi. The next tick covers it.
      }
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`announce:${eventId}`)
      .on('broadcast', { event: 'announcement' }, () => {
        void pull();
      })
      .subscribe();

    // 45s: slow enough to be invisible on a phone battery through a reception,
    // fast enough that a dropped channel is a delay and not a silence.
    const timer = window.setInterval(() => void pull(), 45_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  return <AnnouncementCard body={text} />;
}

function AnnouncementCard({ body }: { body: string }) {
  return (
    <aside
      // `role="status"` + polite: a screen reader announces it when it appears
      // without interrupting whatever the guest is already reading. `alert`
      // would be wrong — this is not an error and must not seize focus.
      role="status"
      aria-live="polite"
      className="mx-auto mt-4 w-full max-w-3xl px-4"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-terracotta/35 bg-terracotta/[0.06] px-4 py-3.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/12 text-terracotta-700">
          <Megaphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-terracotta-700">
            From the coordinator
          </p>
          {/* The coordinator's own words, rendered as text. Never markdown,
              never HTML — this is typed by a person on a phone under pressure
              and reaches every guest at the wedding. */}
          <p className="mt-1 whitespace-pre-line text-[15px] leading-snug text-ink">{body}</p>
        </div>
      </div>
    </aside>
  );
}
