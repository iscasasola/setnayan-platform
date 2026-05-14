'use client';

import { useState, useTransition } from 'react';
import { CloudDownload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { getQueryClient } from '@/lib/query-client';
import { eventBundleQueryKeys, type VendorEventBundle } from '@/lib/event-preload';
import {
  prepareVendorEventDay,
  type PrepareVendorEventDayResult,
} from './event-day-prep-actions';

/**
 * Vendor-side "Prepare for event day" card — iteration 0036.
 *
 * Smaller analogue of `<EventDayPrepCta>` scoped to a single upcoming event
 * the vendor has a contracted relationship with (via the chat thread). On
 * click we pull the vendor-side bundle (their service slot in the schedule,
 * the masked couple contact, their last-50 chat messages) and hydrate the
 * vendor query keys. Asset cache warm-up is shared with the couple path —
 * the SW stub handler is the same `PRELOAD_ASSETS` shape.
 */
type Props = {
  /** Chat thread id between vendor and couple. */
  threadId: string;
  /** Event id (UUID) that the thread is bound to. */
  eventId: string;
  /** The masked event display name vendors see. */
  eventDisplayName: string;
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

function hydrateVendorBundle(bundle: VendorEventBundle): void {
  const qc = getQueryClient();
  qc.setQueryData(eventBundleQueryKeys.vendorEvent(bundle.eventId), {
    event_id: bundle.eventId,
    event_display_name: bundle.eventDisplayName,
    event_date: bundle.eventDate,
    masked_contact: bundle.maskedContact,
  });
  qc.setQueryData(eventBundleQueryKeys.scheduleBlocks(bundle.eventId), bundle.scheduleBlocks);
  qc.setQueryData(eventBundleQueryKeys.vendorThread(bundle.threadId), bundle.messages);
}

export function VendorEventDayPrepCta({
  threadId,
  eventId,
  eventDisplayName,
  eventDate,
  now = new Date(),
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isInPrepWindow(eventDate, now)) return null;

  const onClick = (): void => {
    setPhase('loading');
    setErrorMsg(null);
    startTransition(async () => {
      const result: PrepareVendorEventDayResult = await prepareVendorEventDay({
        threadId,
        eventId,
        eventDisplayName,
        eventDate,
      });
      if (!result.ok) {
        setPhase('error');
        setErrorMsg(result.error);
        return;
      }
      try {
        hydrateVendorBundle(result.bundle);
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
      aria-label={`Event day pre-load for ${eventDisplayName}`}
      className="flex flex-col gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta"
        >
          {phase === 'done' ? (
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
          ) : phase === 'error' ? (
            <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <CloudDownload className="h-4 w-4" strokeWidth={1.75} />
          )}
        </span>
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta">
            Event day soon · {eventDisplayName}
          </p>
          <p className="text-sm text-ink/70">
            {phase === 'done'
              ? 'Schedule and recent messages saved for offline use.'
              : phase === 'error'
                ? (errorMsg ?? 'Pre-load failed. Try again — nothing was changed.')
                : 'Save the schedule and your last 50 messages with this couple to this device.'}
          </p>
        </div>
      </div>
      {phase !== 'done' ? (
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"
        >
          {busy ? (
            <>
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
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
