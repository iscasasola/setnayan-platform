import type { GuestRow } from '@/lib/guests';
import type { EventTableRow, SeatAssignmentRow } from '@/lib/seating';
import type { ScheduleBlockRow } from '@/lib/schedule';
import type { EventVendorRow } from '@/lib/vendors';
import type { BudgetSnapshot } from '@/lib/budget';
import type { RolePalette } from '@/lib/mood-board';
import type { ChatMessageRow, CoupleThreadWithVendor } from '@/lib/chat';

// Event-bundle types + TanStack-Query key factory. This module is safe to
// import from CLIENT components — it has no server-only or RLS-bound code.
// The actual server-side fetchers live in `lib/event-preload.ts` (which is
// `'server-only'`-gated).
//
// Both the server bundler and the client hydration step pull from here, so
// the cache key shape stays in lock-step.

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
