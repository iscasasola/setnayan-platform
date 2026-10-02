'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { LastSeenEntry, LastSeenPage } from '@/lib/last-seen/store';
import { useLastSeenScope } from './last-seen-scope';
import { LastSeenMark, REFRESH_TIMEOUT_MS, noteLastSeenShown, refreshPhase, type LastSeenPhase } from './last-seen-mark';

/**
 * 💾 LAST-SEEN DATA SHOWS INSTANTLY, THEN REFRESHES (owner 2026-10-02,
 * DECISION_LOG "… FOR A HOST'S MAIN PAGES (NEVER MONEY)") — the loading half.
 *
 * Mounted by the page's own `loading.tsx` around its skeleton. While the
 * server renders the fresh page, this paints what the host last saw on THIS
 * page of THIS event — from the phone, at once — under a quiet "Updating…".
 * When the fresh render arrives, Next swaps this loading screen out for it:
 * the fresh data replaces the old in place. Nothing kept → the skeleton, as
 * before.
 *
 * 🔒 THE HONEST-READ RULE. The old page is never passed off as current:
 *  · it is `inert` — nothing on it can be tapped, typed into or read out by a
 *    screen reader as if it were live — and the mark says "Updating…";
 *  · if the phone goes offline, or the fresh page has not come after
 *    `REFRESH_TIMEOUT_MS`, the mark changes to "Couldn't refresh — this is
 *    what you saw <when>, and it may be out of date" with a Try again;
 *  · a refresh that fails on the server never reaches here at all — the
 *    error screen replaces this loading screen, and the snapshot is not
 *    rewritten from a failed read (`LastSeenCapture` `fresh`).
 */
export function LastSeenFallback({ page, children }: { page: LastSeenPage; children: ReactNode }) {
  const scope = useLastSeenScope();
  const [shown, setShown] = useState<{ entry: LastSeenEntry; phase: LastSeenPhase } | null>(null);

  useEffect(() => {
    if (!scope) return;
    // Only the page as it opens from the menu — a filtered or deep-linked view
    // is a different screen, and is never painted from another one's data.
    if (window.location.search) return;
    const url = window.location.pathname;
    let live = true;
    let timer = 0;
    const fail = () => setShown((s) => (s ? { ...s, phase: 'failed' } : s));
    // Lazy: the store loads with this screen, never with the event layout
    // (`lib/last-seen/client.ts`). Once on the phone, this is a few ms.
    void import('@/lib/last-seen/client')
      .then(({ deviceStorage, readLastSeen }) => {
        if (!live) return;
        const entry = readLastSeen(deviceStorage(), { userId: scope.userId, eventId: scope.eventId, page, url });
        if (!entry) return;
        noteLastSeenShown(page);
        const after = (waitedMs: number) =>
          setShown({ entry, phase: refreshPhase({ online: navigator.onLine !== false, waitedMs }) });
        after(0);
        timer = window.setTimeout(() => after(REFRESH_TIMEOUT_MS), REFRESH_TIMEOUT_MS);
        window.addEventListener('offline', fail);
      })
      .catch(() => {
        /* the store could not load (offline, first visit) — the skeleton stays */
      });
    return () => {
      live = false;
      window.clearTimeout(timer);
      window.removeEventListener('offline', fail);
    };
  }, [scope, page]);

  if (!shown) return <>{children}</>;
  return <LastSeenView html={shown.entry.html} savedAt={shown.entry.savedAt} phase={shown.phase} />;
}

/**
 * What a kept page looks like while it waits: the old content, untappable,
 * under the mark. Pure — `last-seen.test.ts` renders it directly.
 */
export function LastSeenView({
  html,
  savedAt,
  phase,
}: {
  html: string;
  savedAt: number;
  phase: LastSeenPhase;
}) {
  return (
    <div data-last-seen-view={phase}>
      <LastSeenMark phase={phase} savedAt={savedAt} />
      <div
        inert
        className={phase === 'failed' ? 'opacity-60 transition-opacity' : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
