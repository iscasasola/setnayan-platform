'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { deviceStorage, saveLastSeen, type LastSeenPage } from '@/lib/last-seen/store';
import { snapshotFromRoot } from '@/lib/last-seen/snapshot-dom';
import { useLastSeenScope } from './last-seen-scope';
import { LastSeenMark, takeLastSeenShown } from './last-seen-mark';

/**
 * 💾 LAST-SEEN DATA — the keeping half (owner 2026-10-02, DECISION_LOG
 * "LAST-SEEN DATA SHOWS INSTANTLY, THEN REFRESHES — FOR A HOST'S MAIN PAGES
 * (NEVER MONEY)").
 *
 * Wraps the fresh render of one of the five host pages (Home · Guests ·
 * Suppliers · Schedule · Event Details). Once the page has settled and the
 * phone is idle — and again whenever its content changes — it keeps a cleaned
 * copy of what is on screen (`lib/last-seen/snapshot-dom.ts`: no money, no
 * links, no hidden fields) for the next visit's loading screen.
 *
 * `fresh={false}` when the page's own read was refused or failed (the
 * honest-read "—" state): a failed read is NEVER kept as last-seen, so the
 * next visit shows the last GOOD page, still marked "Updating…".
 *
 * ⛔ Mount only on those five pages, and only around a branch that shows no
 * budget part: `last-seen.test.ts` holds the allowlist of files that may
 * import this, and budget / payments / orders / checkout are not on it.
 *
 * The wrapper is `display: contents`, so it adds no box to the layout.
 */
export function LastSeenCapture({
  page,
  fresh = true,
  children,
}: {
  page: LastSeenPage;
  fresh?: boolean;
  children: ReactNode;
}) {
  const scope = useLastSeenScope();
  const ref = useRef<HTMLDivElement>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  // The loading screen showed old data for this page → say it is now current.
  useEffect(() => {
    if (!takeLastSeenShown(page)) return;
    setJustUpdated(true);
    const t = window.setTimeout(() => setJustUpdated(false), 2500);
    return () => window.clearTimeout(t);
  }, [page]);

  useEffect(() => {
    const root = ref.current;
    if (!scope || !fresh || !root) return;
    let timer = 0;
    let alive = true;
    const take = () => {
      // An idle callback can land after the person has already moved on; by
      // then the address is the NEXT page's, so this page must not be saved.
      if (!alive) return;
      // Only the page as it opens from the menu (see LastSeenFallback).
      if (window.location.search) return;
      const html = snapshotFromRoot(root);
      if (!html) return;
      saveLastSeen(deviceStorage(), {
        userId: scope.userId,
        eventId: scope.eventId,
        page,
        url: window.location.pathname,
        html,
      });
    };
    // Settled = 1.2 s with no change. A page that never stops changing (a
    // count-up, a ticking clock) is still kept, at most 10 s after it began.
    let since = 0;
    const soon = () => {
      const now = Date.now();
      if (!since) since = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          since = 0;
          const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
          if (w.requestIdleCallback) w.requestIdleCallback(take, { timeout: 3000 });
          else take();
        },
        Math.max(0, Math.min(1200, since + 10_000 - now)),
      );
    };
    soon();
    const watcher = new MutationObserver(soon);
    watcher.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      alive = false;
      watcher.disconnect();
      window.clearTimeout(timer);
    };
  }, [scope, fresh, page]);

  return (
    <div ref={ref} data-last-seen-root={page} style={{ display: 'contents' }}>
      {justUpdated ? <LastSeenMark phase="updated" /> : null}
      {children}
    </div>
  );
}
