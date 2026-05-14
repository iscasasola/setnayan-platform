'use server';

import {
  prefetchEventBundle,
  prefetchVendorEventBundle,
  type EventBundle,
  type VendorEventBundle,
} from '@/lib/event-preload';

/**
 * Server action invoked by `<EventDayPrepCta>` and `<AutoPreloadOnEventDay>`.
 *
 * Returns the full event bundle to the client so it can hydrate the TanStack
 * Query cache. RLS handles the auth scoping — `prefetchEventBundle` uses the
 * SSR Supabase client which reads the user's cookies, so a user can only
 * download data for an event they're already authorized to read.
 *
 * If the prefetch fails (network, RLS denial, missing event), the error is
 * surfaced via a discriminated-union return so the client UI can render a
 * retry without throwing inside the React render loop.
 */
export type PrepareForEventDayResult =
  | { ok: true; bundle: EventBundle }
  | { ok: false; error: string };

export async function prepareForEventDay(eventId: string): Promise<PrepareForEventDayResult> {
  if (!eventId || typeof eventId !== 'string') {
    return { ok: false, error: 'Missing event id' };
  }
  try {
    const bundle = await prefetchEventBundle(eventId);
    return { ok: true, bundle };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

export type PrepareVendorEventDayResult =
  | { ok: true; bundle: VendorEventBundle }
  | { ok: false; error: string };

/**
 * Vendor-side equivalent. The vendor knows their open chat thread + the
 * masked event identity from the thread row, so we pass those through. RLS
 * filters the schedule fetch to whatever the vendor is allowed to see for
 * this event in V1 — if the policy hides the schedule, the helper falls back
 * to an empty array rather than throwing.
 */
export async function prepareVendorEventDay(args: {
  threadId: string;
  eventId: string;
  eventDisplayName: string;
  eventDate: string | null;
}): Promise<PrepareVendorEventDayResult> {
  if (!args.threadId || !args.eventId) {
    return { ok: false, error: 'Missing thread or event id' };
  }
  try {
    const bundle = await prefetchVendorEventBundle(args);
    return { ok: true, bundle };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}
