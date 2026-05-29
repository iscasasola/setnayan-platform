'use client';

import { useState, useTransition } from 'react';
import { CloudDownload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { getQueryClient } from '@/lib/query-client';
import { eventBundleQueryKeys, type EventBundle } from '@/lib/event-bundle-keys';
import {
  prepareForEventDay,
  type PrepareForEventDayResult,
} from './event-day-prep-actions';

/**
 * "Prepare for event day" banner — iteration 0036.
 *
 * Visible only when the event date is within T-3 days through T+1 day so the
 * CTA never clutters the dashboard on a normal planning day. On click the
 * server action returns the full event bundle, we hydrate the TanStack Query
 * cache section-by-section, then ask the service worker to warm the asset
 * cache. Progress + success states are intentionally chatty so a couple
 * standing in a venue lobby with one bar of LTE knows what's happening.
 */
type Props = {
  eventId: string;
  /** ISO date string (YYYY-MM-DD) or null. Visibility gate. */
  eventDate: string | null;
  /** Override "now" for tests. */
  now?: Date;
};

type Phase = 'idle' | 'loading' | 'done' | 'error';

const T_MINUS_DAYS = 3;
const T_PLUS_DAYS = 1;

function daysUntilDate(eventDate: string, now: Date): number {
  const event = new Date(`${eventDate}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((event.getTime() - today.getTime()) / 86_400_000);
}

function isInPrepWindow(eventDate: string | null, now: Date): boolean {
  if (!eventDate) return false;
  const days = daysUntilDate(eventDate, now);
  return days <= T_MINUS_DAYS && days >= -T_PLUS_DAYS;
}

/**
 * Hydrate every section of the bundle into TanStack Query under the same
 * keys the page-level queries use. Kept in a separate function so the
 * component body stays focused on UI state.
 */
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

/**
 * Send the SW a list of URLs to pre-fetch + stash in the cache. The SW
 * handler is a stub in V1 — it ignores unknown message types gracefully —
 * so this is a no-op until iteration 0010's Workbox-driven SW ships, at
 * which point the same `PRELOAD_ASSETS` shape continues to work.
 */
function warmAssetCache(urls: string[]): void {
  if (urls.length === 0) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  if (!sw.controller) return;
  try {
    sw.controller.postMessage({ type: 'PRELOAD_ASSETS', urls });
  } catch {
    // Swallowing on purpose — asset warm-up is best-effort. Hydrated query
    // data is the load-bearing half of the pre-load; assets are gravy.
  }
}

export function EventDayPrepCta({ eventId, eventDate, now = new Date() }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isInPrepWindow(eventDate, now)) return null;

  const onClick = (): void => {
    setPhase('loading');
    setErrorMsg(null);
    startTransition(async () => {
      const result: PrepareForEventDayResult = await prepareForEventDay(eventId);
      if (!result.ok) {
        setPhase('error');
        setErrorMsg(result.error);
        return;
      }
      try {
        hydrateBundle(result.bundle);
        warmAssetCache(result.bundle.assetUrls);
        setPhase('done');
      } catch (err) {
        setPhase('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to hydrate cache');
      }
    });
  };

  const busy = phase === 'loading' || pending;

  return (
    <aside
      role="region"
      aria-label="Event day pre-load"
      className="flex flex-col gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta"
        >
          {phase === 'done' ? (
            <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
          ) : phase === 'error' ? (
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <CloudDownload className="h-5 w-5" strokeWidth={1.75} />
          )}
        </span>
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta">
            Event day soon
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            {phase === 'done'
              ? 'Ready for event day — works offline'
              : phase === 'error'
                ? 'Pre-load failed'
                : 'Prepare for event day'}
          </h2>
          <p className="max-w-prose text-sm text-ink/65">
            {phase === 'done'
              ? "Guest list, seating, schedule, vendors, budget, and recent messages are saved on this device. You'll see live data when you're online."
              : phase === 'error'
                ? (errorMsg ?? 'Something went wrong. Try again — the cache hasn’t been changed.')
                : 'Download a copy of everything you need for the day so the dashboard works on bad venue WiFi.'}
          </p>
        </div>
      </div>
      {phase !== 'done' ? (
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"
        >
          {busy ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              Pre-loading…
            </>
          ) : phase === 'error' ? (
            'Try again'
          ) : (
            'Prepare for event day'
          )}
        </button>
      ) : null}
    </aside>
  );
}
