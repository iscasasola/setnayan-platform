'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Megaphone } from 'lucide-react';
import { jittered } from '@/lib/live-day-timing';
import { AnnouncementLine, AnnouncementNotice } from './announcement-styles';

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
 * the guest's view.
 *
 * TWO LOOKS, ONE CARD (owner 2026-09-28: *"an announcement shows to guests as
 * soon as it is sent"*). `stage='live'` is the day-of look above — terracotta,
 * "From the coordinator". `stage='before'` is the same card in the calm
 * Invitation-stage register — ink-toned, labelled "Announcement" — because a
 * week out the words are "the ceremony moved to 3pm", not "phones down", and
 * they sit over the couple's invitation rather than over a seat card. Same
 * structure, same rules (not dismissible, text only, one message); only the
 * colour and the eyebrow change. The layout decides the stage.
 *
 * It is deliberately NOT dismissible. An announcement is not a notification —
 * "phones down" that a guest can swipe away is worse than none, because the
 * coordinator has no way to know it was dismissed. It disappears on its own
 * once the event is over, or when a newer one replaces it.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * Not a feed and not a conversation. One message, the latest. Anything
 * two-way belongs in the coordinator's own surfaces, not on a wedding page a
 * guest opened to find their table.
 *
 * ── HOW IT ARRIVES NOW: ONE SMALL ASK, NO LIVE CONNECTION (EV1, 2026-10-28) ─
 * Owner, 2026-10-28 (DECISION_LOG "NO EVENT HUB MAY CRASH"): *guests never hold
 * a live connection* — and *"Our priority is not crash any event hub most
 * specially during their event"*. It used to be read by the layout at render
 * (so every guest page rendered per request), kept fresh by a Supabase
 * Realtime channel PER GUEST (Realtime was >10× all other database time in the
 * 2026-10-18 audit) and a 45 s server-action pull. Now the card asks ONE small
 * route, `GET /{slug}/announcement` (route.ts beside the page — guests of this
 * event only, one remembered answer per event):
 *   · the moment the page opens, and the moment a pocketed phone is looked at;
 *   · every ~30 s (± 20 %, so the venue's phones drift apart) while it is
 *     looked at — a hidden tab asks nothing;
 *   · after a failed ask, a little later each time (to 5 minutes), so a venue
 *     whose Wi-Fi is down is not hammered the moment it comes back.
 * Only ever REPLACED with something real: a failed ask never blanks a standing
 * "phones down" off a guest's screen — an empty answer and a broken one are not
 * the same thing, and this one is safety-adjacent.
 */
export const ANNOUNCEMENT_POLL_MS = 30_000;
const ANNOUNCEMENT_BACKOFF_MAX_MS = 5 * 60_000;

export function DayOfAnnouncement({
  slug,
  stage = 'live',
  sceneStyle = null,
  look = null,
}: {
  /** The event's address — the card asks `/{slug}/announcement`. */
  slug: string;
  /** 'live' = the day-of look (default); 'before' = the calm Invitation-stage look. The layout resolves it. */
  stage?: 'before' | 'live';
  /** 🎨 `banner` (the default) · `notice` · `line` — `announcement-styles.tsx`. Same words, same tones. */
  sceneStyle?: string | null;
  /** 🧱 The block's own look (`AnnouncementLook`), drawn right before the card — only when there is a card. */
  look?: ReactNode;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: number | null = null;
    let failures = 0;

    const pull = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        // No request cache directive — see lib/live-day-cache.ts `liveEdgeHeaders`.
        const res = await fetch(`/${encodeURIComponent(slug)}/announcement`);
        if (!res.ok) throw new Error(String(res.status));
        const answer = (await res.json()) as { body?: string | null };
        failures = 0;
        if (alive && typeof answer.body === 'string' && answer.body.trim()) setText(answer.body);
      } catch {
        failures += 1; // Venue Wi-Fi — the next ask, a little later, covers it.
      }
    };

    const schedule = () => {
      const wait = Math.min(ANNOUNCEMENT_POLL_MS * 2 ** failures, ANNOUNCEMENT_BACKOFF_MAX_MS);
      timer = window.setTimeout(() => {
        timer = null;
        void pull().finally(() => {
          if (alive) schedule();
        });
      }, jittered(wait));
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };

    void pull();
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug]);

  if (!text) return null;
  const card =
    sceneStyle === 'notice' ? (
      <AnnouncementNotice body={text} stage={stage} />
    ) : sceneStyle === 'line' ? (
      <AnnouncementLine body={text} stage={stage} />
    ) : (
      <AnnouncementCard body={text} stage={stage} />
    );
  /* On the day it is sticky so it follows the reader down a long page — the guest who needs "phones down" is the one
     already scrolled into their seat card. Before the day it sits at the top, in flow. */
  return (
    <div className={stage === 'live' ? 'sticky top-0 z-50' : undefined}>
      {look}
      {card}
    </div>
  );
}

function AnnouncementCard({ body, stage }: { body: string; stage: 'before' | 'live' }) {
  const live = stage === 'live';
  return (
    <aside
      // `role="status"` + polite: a screen reader announces it when it appears
      // without interrupting whatever the guest is already reading. `alert`
      // would be wrong — this is not an error and must not seize focus.
      role="status"
      aria-live="polite"
      className="mx-auto mt-4 w-full max-w-3xl px-4"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
          live ? 'border-terracotta/35 bg-terracotta/[0.06]' : 'border-ink/12 bg-ink/[0.03]'
        }`}
      >
        <span
          className={
            live
              ? 'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/12 text-terracotta-700'
              : 'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink/70'
          }
        >
          <Megaphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p
            className={
              live
                ? 'font-mono text-xs font-bold uppercase tracking-[0.14em] text-terracotta-700'
                : 'font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink/70'
            }
          >
            {live ? 'From the coordinator' : 'Announcement'}
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
