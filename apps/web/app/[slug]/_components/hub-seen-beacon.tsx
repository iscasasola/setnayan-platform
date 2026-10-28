'use client';

/**
 * HubSeenBeacon — tells the event's team "someone opened the Event Hub" (Who's here, owner 2026-10-29).
 *
 * 🛑 NO EVENT HUB MAY CRASH (owner 2026-10-28). So this is the smallest thing that can count an open:
 *   · NO LIVE CONNECTION — one fire-and-forget POST (`navigator.sendBeacon`, else a `keepalive` fetch), never a socket,
 *     never a timer that repeats;
 *   · AFTER THE PAGE — fired from an idle callback once the hub has drawn and hydrated, never on its critical path;
 *   · ONCE PER 30 MINUTES PER DEVICE — remembered in this browser's own storage (not a cookie: nothing is sent with
 *     it). A refresh, a tab switch, a second open: no request at all. The database holds the same 30 minutes for a
 *     guest (`record_hub_view`), so even a storage-less browser writes once;
 *   · NOT PART OF THE CACHED HTML'S INPUTS — it carries only the slug; the route reads the pass from the request's
 *     own cookies, so the cached hub (`app/[slug]/cached/[key]`) never reads one.
 * Renders nothing.
 */
import { useEffect } from 'react';
import { HUB_SEEN_PATH, HUB_SEEN_STORAGE_PREFIX, hubSeenDue } from '@/lib/whos-here';

export function HubSeenBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const key = `${HUB_SEEN_STORAGE_PREFIX}${slug}`;
    const send = () => {
      const now = Date.now();
      let last: number | null = null;
      try {
        const raw = window.localStorage.getItem(key);
        last = raw === null ? null : Number(raw);
      } catch {
        /* storage refused (a private window) — the database's own 30 minutes still holds a guest */
      }
      if (!hubSeenDue(last, now)) return;
      try {
        window.localStorage.setItem(key, String(now));
      } catch {
        /* nothing to remember with — send once for this load */
      }
      const body = JSON.stringify({ slug });
      try {
        if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(HUB_SEEN_PATH, body)) return;
      } catch {
        /* fall through to fetch */
      }
      try {
        void fetch(HUB_SEEN_PATH, { method: 'POST', body, keepalive: true, credentials: 'same-origin' }).catch(() => {});
      } catch {
        /* a count is best-effort */
      }
    };
    // After the hub has drawn: when the browser is idle, or after a moment where there is no idle callback (Safari).
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const h = w.requestIdleCallback(send, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(send, 1500);
    return () => window.clearTimeout(t);
  }, [slug]);
  return null;
}
