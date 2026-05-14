'use client';

import { useEffect, useRef, useState } from 'react';
import { getQueryClient } from '@/lib/query-client';
import { eventBundleQueryKeys, type EventBundle } from '@/lib/event-preload';
import { prepareForEventDay } from './event-day-prep-actions';

/**
 * Auto-preload on event day — iteration 0036.
 *
 * Mounts silently on the dashboard home. When the event is in the T-24h to
 * T+12h window we proactively fire the same prepare-for-event-day action the
 * CTA uses, hydrate the cache, and warm the SW asset cache. Uses
 * `localStorage` to dedupe: we won't auto-fire more than once per 60 minutes
 * for a given event_id, so re-renders / tab refreshes during the event don't
 * thrash the network.
 *
 * Renders nothing visible. The CTA component is responsible for the user-
 * facing affordance — this auto-runner is just the "you opened the dashboard
 * on the day of, here is everything you need" backstop.
 */
type Props = {
  eventId: string;
  /** ISO date string (YYYY-MM-DD) or null. Visibility gate. */
  eventDate: string | null;
  /** Override "now" for tests. */
  nowMs?: number;
};

const T_MINUS_HOURS = 24;
const T_PLUS_HOURS = 12;
const DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const STORAGE_KEY_PREFIX = 'setnayan:auto-preload:';

function isInAutoFireWindow(eventDate: string | null, now: Date): boolean {
  if (!eventDate) return false;
  // Treat the event date as starting at midnight local time. T-24h is the
  // start of the day BEFORE the event; T+12h covers the late-night recovery
  // period after a wedding day wraps.
  const eventStart = new Date(`${eventDate}T00:00:00`);
  const windowStart = new Date(eventStart.getTime() - T_MINUS_HOURS * 3_600_000);
  const windowEnd = new Date(eventStart.getTime() + 24 * 3_600_000 + T_PLUS_HOURS * 3_600_000);
  return now >= windowStart && now <= windowEnd;
}

function hydrateBundle(bundle: EventBundle): void {
  const qc = getQueryClient();
  const { event_id: eventId } = bundle.event;
  qc.setQueryData(eventBundleQueryKeys.event(eventId), bundle.event);
  qc.setQueryData(eventBundleQueryKeys.guests(eventId), bundle.guests);
  qc.setQueryData(eventBundleQueryKeys.tables(eventId), bundle.tables);
  qc.setQueryData(eventBundleQueryKeys.seatAssignments(eventId), bundle.seatAssignments);
  qc.setQueryData(eventBundleQueryKeys.scheduleBlocks(eventId), bundle.scheduleBlocks);
  qc.setQueryData(eventBundleQueryKeys.vendors(eventId), bundle.vendors);
  qc.setQueryData(eventBundleQueryKeys.budget(eventId), bundle.budget);
  qc.setQueryData(eventBundleQueryKeys.moodBoard(eventId), bundle.moodBoard);
  for (const thread of bundle.chatThreads) {
    qc.setQueryData(eventBundleQueryKeys.chatThread(thread.thread.thread_id), thread.messages);
  }
}

function warmAssetCache(urls: string[]): void {
  if (urls.length === 0) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  if (!sw.controller) return;
  try {
    sw.controller.postMessage({ type: 'PRELOAD_ASSETS', urls });
  } catch {
    // Best-effort — see <EventDayPrepCta> for the same rationale.
  }
}

function readDedupeTimestamp(eventId: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${eventId}`);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeDedupeTimestamp(eventId: string, nowMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${eventId}`, String(nowMs));
  } catch {
    // Quota or privacy mode — degrade silently. Worst case we re-fire on a
    // future mount, which is still cheap.
  }
}

export function AutoPreloadOnEventDay({ eventId, eventDate, nowMs }: Props) {
  const firedRef = useRef(false);
  // State only exists so React re-renders when the component remounts; the
  // payload is never read by the UI (this component renders null).
  const [, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (firedRef.current) return;
    const now = nowMs ? new Date(nowMs) : new Date();
    if (!isInAutoFireWindow(eventDate, now)) return;

    const last = readDedupeTimestamp(eventId);
    const elapsed = now.getTime() - last;
    if (last > 0 && elapsed < DEDUPE_WINDOW_MS) return;

    firedRef.current = true;
    setStatus('running');
    let cancelled = false;
    (async () => {
      try {
        const result = await prepareForEventDay(eventId);
        if (cancelled) return;
        if (!result.ok) {
          setStatus('error');
          return;
        }
        hydrateBundle(result.bundle);
        warmAssetCache(result.bundle.assetUrls);
        writeDedupeTimestamp(eventId, now.getTime());
        setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, eventDate, nowMs]);

  return null;
}
