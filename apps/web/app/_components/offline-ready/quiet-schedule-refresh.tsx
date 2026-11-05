'use client';

import { useEffect } from 'react';

import { offlineCopiesUntil, savedCopyOnScreen } from '@/lib/offline-copies';
import {
  QUIET_MAX_COPIES,
  QUIET_TRIED_KEY_PREFIX,
  holdsAnotherViewersCopies,
  quietRefreshDue,
  type QuietCopy,
} from '@/lib/quiet-schedule-refresh';

import { askWorker, readKept, workerSupported } from './use-offline-copy';

/** The page settles first — the refresh is never in the way of what the guest opened. */
const QUIET_AFTER_MS = 4_000;

function lastTried(path: string): number | null {
  try {
    const v = Number(window.localStorage.getItem(QUIET_TRIED_KEY_PREFIX + path));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function markTried(path: string, at: number): void {
  try {
    window.localStorage.setItem(QUIET_TRIED_KEY_PREFIX + path, String(at));
  } catch {
    // Private window / blocked storage: the worker's own 30-minute skip still holds for every copy that landed.
  }
}

/**
 * 🔕 QUIET SCHEDULE REFRESH — Home and the Event Hub re-render the guest's saved "Your schedule" copy in the background
 * (owner-approved 5 Nov, item 1). It draws NOTHING: the freshness line lives on Me alone (`ScheduleSavedMark`). The
 * rules — 30-minute ceiling, only around event days, a first save only on a phone holding nobody else's copy — are `lib/quiet-schedule-refresh.ts`; the saving is
 * the existing worker's (`OFFLINE_SAVE`, not forced), never a second mechanism.
 */
export function QuietScheduleRefresh({ viewer, copies }: { viewer: string; copies: readonly QuietCopy[] }) {
  const key = copies.map((c) => `${c.eventKey}|${c.path}|${c.eventDate ?? ''}|${c.eventEndDate ?? ''}`).join('\n');
  useEffect(() => {
    if (!viewer || copies.length === 0 || !workerSupported()) return;
    // Not from a saved copy (it opened because the network failed), and not with the browser saying it is offline.
    if (savedCopyOnScreen() !== null || navigator.onLine === false) return;
    let alive = true;
    const timer = window.setTimeout(async () => {
      for (const c of copies.slice(0, QUIET_MAX_COPIES)) {
        if (!alive) return;
        const now = Date.now();
        const kept = await readKept(viewer, c.eventKey, [c.path], null);
        const anotherViewersCopies = holdsAnotherViewersCopies(kept.reg ?? null, viewer, now, kept.unreadable === true);
        if (!quietRefreshDue({ now, eventDate: c.eventDate, eventEndDate: c.eventEndDate, savedAt: kept.savedAt, lastTriedAt: lastTried(c.path), anotherViewersCopies })) {
          continue;
        }
        const until = offlineCopiesUntil(c.eventDate, c.eventEndDate);
        if (until === null) continue;
        markTried(c.path, now);
        // One message; the worker saves a first copy or re-renders one older than 30 min, refuses an unread page.
        void askWorker({ type: 'OFFLINE_SAVE', viewer, eventId: c.eventKey, until, paths: [c.path], force: false });
      }
    }, QUIET_AFTER_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // `key` stands for `copies` (a fresh array each server render must not re-arm the timer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, key]);
  return null;
}
