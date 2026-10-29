'use client';

import { useState, useTransition } from 'react';
import { getQueryClient } from '@/lib/query-client';
import { eventBundleQueryKeys, type EventBundle } from '@/lib/event-bundle-keys';
import { useSaveLoader } from '@/components/sd-loader';
import { HomeTodayItem } from '@/app/dashboard/[eventId]/_components/home-parts';
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
  /*
    THE EVENT HAS ALREADY HAPPENED — resolved SERVER-SIDE from the lifecycle
    phase and passed in, because this component cannot work it out.

    🚨 IT SAID "EVENT DAY SOON" TO A MAN WHOSE EVENT WAS YESTERDAY.
    The window below is T-3d .. T+1d, so this banner renders for a full day
    AFTER the celebration — and its eyebrow reads "Event day soon" and its
    button offers to pre-load the guest list for bad venue WiFi at a venue
    nobody is going back to. Owner, 2026-08-21, the morning after his Movie
    Night: *"nothing changed. i can still invite. prepare for event day, etc"*.

    🔑 THE FIX IS A HANDED-DOWN ANSWER, NOT A SECOND WINDOW. Narrowing
    `T_PLUS_DAYS` here would give the app a third opinion about when an event
    is over, on top of the lifecycle resolver and the events board. One
    resolver decides; this component is told.

    Omitted ⇒ false ⇒ byte-identical to before for every existing caller.
  */
  finished?: boolean;
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

export function EventDayPrepCta({ eventId, eventDate, finished = false, now = new Date() }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  // Nothing to prepare for once it has happened — checked BEFORE the window so
  // the honest answer wins over the arithmetic.
  if (finished) return null;
  if (!isInPrepWindow(eventDate, now)) return null;

  const onClick = (): void => {
    setPhase('loading');
    startTransition(async () => {
      const result: PrepareForEventDayResult = await save.run(
        () => prepareForEventDay(eventId),
        { steps: ['Getting you ready'], hint: 'Please wait' },
      );
      if (!result.ok) {
        setPhase('error');
        return;
      }
      try {
        hydrateBundle(result.bundle);
        warmAssetCache(result.bundle.assetUrls);
        setPhase('done');
      } catch {
        setPhase('error');
      }
    });
  };

  const busy = phase === 'loading' || pending;

  /* ☀ A LINE OF HOME'S TODAY LIST, under the cover (owner 2026-10-29: *"The popup for the access and other popups
     above the header can be presented better"*) — it was a terracotta banner above the cover; it is the Today pill now
     (`HomeTodayItem`), the press the same pre-load. Saved = calm; a failure says so, the press tries again. */
  return (
    <HomeTodayItem
      onPress={onClick}
      disabled={busy}
      tone={phase === 'done' ? 'calm' : phase === 'error' ? 'warn' : 'ask'}
      words={
        busy
          ? 'Saving your event on this phone…'
          : phase === 'done'
            ? 'Ready for event day — works offline'
            : phase === 'error'
              ? 'Saving for event day failed'
              : 'Prepare for event day'
      }
      tail={
        busy
          ? null
          : phase === 'done'
            ? 'Saved on this phone'
            : phase === 'error'
              ? 'Try again'
              : 'Works on bad venue signal'
      }
      dataAttr={['data-event-day-prep', phase]}
    />
  );
}
