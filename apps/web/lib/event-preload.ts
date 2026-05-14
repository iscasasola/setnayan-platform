import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, type GuestRow } from '@/lib/guests';
import {
  fetchTables,
  fetchAssignments,
  type EventTableRow,
  type SeatAssignmentRow,
} from '@/lib/seating';
import { fetchScheduleBlocks, type ScheduleBlockRow } from '@/lib/schedule';
import { fetchEventVendors, type EventVendorRow } from '@/lib/vendors';
import { fetchBudgetSnapshot, type BudgetSnapshot } from '@/lib/budget';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import {
  fetchCoupleThreads,
  fetchMessages,
  type ChatMessageRow,
  type CoupleThreadWithVendor,
} from '@/lib/chat';

/**
 * Event-day pre-load — iteration 0036.
 *
 * Server-only module that fetches everything the couple's day-of dashboard
 * needs and bundles it under TanStack-Query-shaped keys, so the client can
 * hydrate the cache in a single round trip. Designed so the app keeps working
 * on bad venue WiFi: once the bundle is in the cache + persisted to IndexedDB
 * (handled by the persister from PR #10), every screen reads from local
 * storage and revalidates in the background.
 *
 * RLS handles auth scoping — every fetch* helper goes through the user's
 * Supabase client. Vendors / coordinators / strangers cannot read another
 * couple's event by calling this server-side because the underlying queries
 * are filtered by `current_couple_event_ids()` at the database layer.
 *
 * The shape of `EventBundle` is the contract with the client hydration step
 * in `<EventDayPrepCta>`. Each top-level key corresponds to one or more
 * TanStack Query keys; the client iterates the bundle and calls
 * `queryClient.setQueryData([key, ...], data)` per section.
 */

export type ChatThreadMessages = {
  thread: CoupleThreadWithVendor;
  messages: ChatMessageRow[];
};

export type EventMeta = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  slug: string | null;
  venue_name: string | null;
  venue_address: string | null;
  monogram_text: string | null;
  role_palette: RolePalette;
};

export type EventBundle = {
  /** When the bundle was assembled — used for UI freshness display. */
  fetchedAt: string;
  /** The event-level metadata (date, venue, palette). */
  event: EventMeta;
  /** Guests with RSVP, role, table assignment, etc. */
  guests: GuestRow[];
  /** Seating: tables + per-guest seat assignments. */
  tables: EventTableRow[];
  seatAssignments: SeatAssignmentRow[];
  /** Schedule blocks (ceremony, reception, dancing…). */
  scheduleBlocks: ScheduleBlockRow[];
  /** All vendors contracted for the event. */
  vendors: EventVendorRow[];
  /** Budget line items + payments rolled up. */
  budget: BudgetSnapshot;
  /** Mood board palette (cached on event row, sanitized for safety). */
  moodBoard: { palette: RolePalette };
  /** Last 50 messages per chat thread the couple has open with vendors. */
  chatThreads: ChatThreadMessages[];
  /** Asset URLs the client should hand to the SW so they live in the cache. */
  assetUrls: string[];
};

/**
 * Number of trailing messages we cache per thread. Tunable — 50 is a good
 * starting point for one-day-of read activity without bloating the bundle.
 */
const MESSAGES_PER_THREAD = 50;

function safeRolePalette(raw: unknown): RolePalette {
  try {
    return sanitizeRolePalette(raw);
  } catch {
    return {};
  }
}

/**
 * Build the full event-day bundle. Caller is expected to be an authenticated
 * server context (server action, route handler, or RSC) — `createClient()`
 * reads the user's cookies and RLS does the rest.
 *
 * Failures inside individual sections are NOT swallowed: if one section can't
 * be loaded, the whole prefetch surfaces the error to the caller so the UI
 * can show a retry instead of silently caching a partial bundle.
 */
export async function prefetchEventBundle(eventId: string): Promise<EventBundle> {
  const supabase = await createClient();

  const eventRes = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_date, slug, venue_name, venue_address, monogram_text, role_palette',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (eventRes.error) {
    throw new Error(`prefetchEventBundle: event lookup failed — ${eventRes.error.message}`);
  }
  if (!eventRes.data) {
    throw new Error(`prefetchEventBundle: event ${eventId} not found or not visible to the caller`);
  }

  const event: EventMeta = {
    event_id: eventRes.data.event_id as string,
    display_name: eventRes.data.display_name as string,
    event_date: (eventRes.data.event_date as string | null) ?? null,
    slug: (eventRes.data.slug as string | null) ?? null,
    venue_name: (eventRes.data.venue_name as string | null) ?? null,
    venue_address: (eventRes.data.venue_address as string | null) ?? null,
    monogram_text: (eventRes.data.monogram_text as string | null) ?? null,
    role_palette: safeRolePalette(eventRes.data.role_palette),
  };

  const [guests, tables, seatAssignments, scheduleBlocks, vendors, budget, coupleThreads] =
    await Promise.all([
      fetchGuestsByEvent(supabase, eventId),
      fetchTables(supabase, eventId),
      fetchAssignments(supabase, eventId),
      fetchScheduleBlocks(supabase, eventId),
      fetchEventVendors(supabase, eventId),
      fetchBudgetSnapshot(supabase, eventId),
      fetchCoupleThreads(supabase, eventId),
    ]);

  // Last N messages per open thread — fetched in parallel, then trimmed.
  // fetchMessages returns oldest-first; we keep the trailing N to honor
  // "Last 50 messages per open chat thread" from the iteration spec.
  const chatThreads: ChatThreadMessages[] = await Promise.all(
    coupleThreads.map(async (thread) => {
      const all = await fetchMessages(supabase, thread.thread_id);
      const messages =
        all.length > MESSAGES_PER_THREAD ? all.slice(-MESSAGES_PER_THREAD) : all;
      return { thread, messages };
    }),
  );

  // Asset URLs the service worker should warm. Anything not an absolute URL is
  // dropped so we don't ask the SW to fetch garbage. Vendor logos in chat
  // threads + mood-board references are the highest-value warm targets.
  const assetUrlSet = new Set<string>();
  for (const t of coupleThreads) {
    if (t.vendor?.logo_url && /^https?:\/\//i.test(t.vendor.logo_url)) {
      assetUrlSet.add(t.vendor.logo_url);
    }
  }
  // Save-the-date / mood-board thumbnails could be appended here once their
  // canonical URLs are exposed by their respective lib helpers — keeping the
  // surface minimal in V1 to avoid stale or invalid URLs in the SW cache.
  const assetUrls = Array.from(assetUrlSet);

  return {
    fetchedAt: new Date().toISOString(),
    event,
    guests,
    tables,
    seatAssignments,
    scheduleBlocks,
    vendors,
    budget,
    moodBoard: { palette: event.role_palette },
    chatThreads,
    assetUrls,
  };
}

/**
 * Smaller bundle for the vendor side. The vendor only sees their own service
 * for the event, the schedule (so they know when their slot starts), the
 * masked couple contact, and their chat thread with the couple — RLS already
 * enforces this scoping, we just call the right helpers.
 *
 * V1 keeps it simple: the vendor's chat thread is the entry point we already
 * have to a contracted event. From the thread row we get event_id + the
 * thread_id needed for last-50-messages.
 */
export type VendorEventBundle = {
  fetchedAt: string;
  threadId: string;
  eventId: string;
  eventDisplayName: string;
  eventDate: string | null;
  scheduleBlocks: ScheduleBlockRow[];
  messages: ChatMessageRow[];
  /**
   * Couple contact — purely whatever surfaces through RLS on `event_vendors`.
   * Vendors don't have couple-side read access in V1, so this is typically the
   * masked event display name + date the couple chose to share via the thread.
   */
  maskedContact: {
    event_display_name: string;
    event_date: string | null;
  };
};

export async function prefetchVendorEventBundle(args: {
  threadId: string;
  eventId: string;
  eventDisplayName: string;
  eventDate: string | null;
}): Promise<VendorEventBundle> {
  const supabase = await createClient();
  const { threadId, eventId, eventDisplayName, eventDate } = args;

  const [scheduleBlocks, allMessages] = await Promise.all([
    fetchScheduleBlocks(supabase, eventId).catch(() => [] as ScheduleBlockRow[]),
    fetchMessages(supabase, threadId),
  ]);

  const messages =
    allMessages.length > MESSAGES_PER_THREAD
      ? allMessages.slice(-MESSAGES_PER_THREAD)
      : allMessages;

  return {
    fetchedAt: new Date().toISOString(),
    threadId,
    eventId,
    eventDisplayName,
    eventDate,
    scheduleBlocks,
    messages,
    maskedContact: {
      event_display_name: eventDisplayName,
      event_date: eventDate,
    },
  };
}

/**
 * Canonical TanStack-Query key builders. Centralized here so the hydration
 * step in `<EventDayPrepCta>` and the page-level queries in feature folders
 * never disagree about the key shape. Bare arrays so they survive
 * structural equality the way TanStack expects.
 */
export const eventBundleQueryKeys = {
  event: (eventId: string) => ['event', eventId] as const,
  guests: (eventId: string) => ['event', eventId, 'guests'] as const,
  tables: (eventId: string) => ['event', eventId, 'tables'] as const,
  seatAssignments: (eventId: string) => ['event', eventId, 'seatAssignments'] as const,
  scheduleBlocks: (eventId: string) => ['event', eventId, 'scheduleBlocks'] as const,
  vendors: (eventId: string) => ['event', eventId, 'vendors'] as const,
  budget: (eventId: string) => ['event', eventId, 'budget'] as const,
  moodBoard: (eventId: string) => ['event', eventId, 'moodBoard'] as const,
  chatThread: (threadId: string) => ['chat', threadId, 'messages'] as const,
  vendorThread: (threadId: string) => ['vendor', 'chat', threadId, 'messages'] as const,
  vendorEvent: (eventId: string) => ['vendor', 'event', eventId] as const,
};
