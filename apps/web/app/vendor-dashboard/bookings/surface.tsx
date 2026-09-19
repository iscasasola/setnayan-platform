import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchVendorThreadsDetailed,
  formatChatTimestamp,
  type VendorThreadWithEvent,
} from '@/lib/chat';
import {
  fetchInquiryCustomerFacts,
  INQUIRY_CUSTOMER_UNKNOWN,
} from '@/lib/inquiry-customer.server';
import { previewFor } from '@/lib/conversation-list';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPreparationItemsByEvent } from '@/lib/preparation';
import { fetchVendorRoomEventsDetailed } from '@/lib/vendor-room-access';
import { readUnreadChatThreadIds } from '@/lib/vendor-unread-threads';
import { rowReadsCompleted } from '@/lib/vendor-thread-stage';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  BOOKING_LIST_LABEL,
  bookingListStatus,
  bookingPillLabel,
  parseBookingFilter,
  type BookingListStatus,
} from './booking-list-status';
import {
  VendorPrepForBooking,
  type VendorPrepItem,
} from './_components/vendor-prep-add';
import { ShopEmpty } from '../_components/kit';
import { ListPager, keepParamsFrom } from '../_components/list-pager';
import { paginate } from '@/lib/paginate';
import { readInChunks } from '@/lib/read-all-pages';

export const metadata = { title: 'Bookings · Vendor' };

type BookingStatus = BookingListStatus;

// The tag is derived from the BOOKING (`./booking-list-status.ts`), not from
// chat activity — see that file for what it replaced.
const STATUS_LABEL = BOOKING_LIST_LABEL;

const STATUS_TONE: Record<BookingStatus, string> = {
  new: 'bg-terracotta text-cream',
  in_progress: 'bg-sky-100 text-sky-800',
  closed: 'bg-ink/10 text-ink/65',
};

type Filter = 'all' | BookingStatus;

type Props = {
  searchParams: Promise<{
    status?: string;
    upcoming?: string;
    /** This list's own page. The hub holds several lists on one URL. */
    bkpage?: string;
    [key: string]: string | string[] | undefined;
  }>;
};

type BookingRow = VendorThreadWithEvent & {
  status: BookingStatus;
  pillLabel: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unread: boolean;
};

function daysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const event = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(event.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((event.getTime() - today.getTime()) / 86_400_000);
}

export default async function VendorBookingsPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Threads + this vendor's prep items both key off the vendor id and are
  // independent — one parallel batch instead of two serial reads (owner perf
  // pass 2026-06-03). threadIds below still derives from `threads`, so the
  // unread/latest-message Promise.all stays sequential after this.
  const [{ threads, complete: threadsComplete }, vendorPrepByEvent] = await Promise.all([
    fetchVendorThreadsDetailed(supabase, profile.vendor_profile_id),
    // Hybrid Preparation (2026-06-03) — prep items THIS vendor has added,
    // keyed by event_id; graceful-degrades to an empty map pre-migration.
    fetchVendorPreparationItemsByEvent(supabase, profile.vendor_profile_id),
  ]);

  // Vendor's unread chat-message notifications — match by related_url
  // suffix (the URL is /vendor-dashboard/messages/<threadId>).
  // ⚠ Paged to the server's count (`lib/vendor-unread-threads.ts`): one capped
  // read dropped the "Unread" dot past 1,000 notifications, with no error.
  const unreadRead = await readUnreadChatThreadIds(supabase, user.id);
  if (!unreadRead.complete) {
    logQueryError(
      'VendorBookingsSurface.unread',
      {
        message:
          unreadRead.error ??
          `read ${unreadRead.threadIds.size} threads without reaching the server count`,
      },
      { vendorProfileId: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  const unreadThreadIds = unreadRead.threadIds;
  // Every per-row fact that could not be read in full — said under the list.
  let factsIncomplete = !unreadRead.complete;

  // ── THE BOOKING FACTS each row's tag is derived from ──────────────────────
  // Three batched reads, one per fact, over every event on this page. Each
  // degrades toward "not yet" (the conservative direction — a live booking
  // shown as a conversation is a stale label; a live one shown as Closed tells
  // a supplier to stop working) and each failure is LOGGED, never swallowed.
  const eventIds = [...new Set(threads.map((t) => t.event_id))];
  const bookedEventIds = new Set<string>();
  const quotedEventIds = new Set<string>();
  const completedEventIds = new Set<string>();
  if (eventIds.length > 0) {
    const [roomEvents, quotedRes, doneRes] = await Promise.all([
      // BOOKED — the room read (pool · agreed lock · claimed Locked QR), the
      // same answer the Clients list and Today's Upcoming give.
      fetchVendorRoomEventsDetailed(supabase, profile.vendor_profile_id).catch(() => ({
        events: [],
        complete: false,
      })),
      // QUOTED — a proposal out with the couple (sent / viewed, not a draft).
      // Chunked (`IN_LIST_CHUNK`): past ~600 ids one `in.()` is refused 400,
      // and every row's tag fell back to "not yet" at once.
      readInChunks<{ event_id: string }>(eventIds, (part) =>
        supabase
          .from('vendor_proposals')
          .select('event_id')
          .eq('vendor_profile_id', profile.vendor_profile_id)
          .in('event_id', part)
          .in('status', ['sent', 'viewed']),
      ),
      // COMPLETED — admin client, scoped by this shop's own id: `event_vendors`
      // holds no supplier-side select policy, so the shop's session reads zero.
      readInChunks<{
        event_id: string;
        completion_status: string | null;
        customer_confirmed_received_at: string | null;
        status: string | null;
      }>(eventIds, (part) =>
        createAdminClient()
          .from('event_vendors')
          .select('event_id, completion_status, customer_confirmed_received_at, status')
          .eq('marketplace_vendor_id', profile.vendor_profile_id)
          .in('event_id', part),
      ),
    ]);
    for (const b of roomEvents.events) bookedEventIds.add(b.eventId);
    if (!roomEvents.complete) factsIncomplete = true;
    if (quotedRes.error) {
      logQueryError(
        'VendorBookingsSurface.quoted',
        quotedRes.error,
        { vendorProfileId: profile.vendor_profile_id },
        'graceful_degrade',
      );
    }
    for (const r of quotedRes.rows) quotedEventIds.add(r.event_id);
    if (doneRes.error) {
      logQueryError(
        'VendorBookingsSurface.completed',
        doneRes.error,
        { vendorProfileId: profile.vendor_profile_id },
        'graceful_degrade',
      );
    }
    for (const r of doneRes.rows) {
      if (rowReadsCompleted(r)) completedEventIds.add(r.event_id);
    }
  }

  type FactRow = Omit<BookingRow, 'lastMessagePreview' | 'lastMessageAt'>;
  const rows: FactRow[] = threads.map((t) => {
    const unread = unreadThreadIds.has(t.thread_id);
    const facts = {
      inquiryStatus: t.inquiry_status,
      booked: bookedEventIds.has(t.event_id),
      quoted: quotedEventIds.has(t.event_id),
      completed: completedEventIds.has(t.event_id),
    };
    return {
      ...t,
      status: bookingListStatus(facts),
      pillLabel: bookingPillLabel(facts),
      unread,
    };
  });

  const filter: Filter = parseBookingFilter(search.status);
  const upcoming = search.upcoming !== '0';

  let visible = rows;
  if (filter !== 'all') {
    visible = visible.filter((r) => r.status === filter);
  }
  if (upcoming) {
    visible = visible.filter((r) => {
      const d = daysUntil(r.event?.event_date ?? null);
      // Treat undated threads as "upcoming" too — couples often book before
      // a firm date is set. Only events more than 30 days in the past get
      // hidden by the toggle.
      return d === null || d >= -30;
    });
  }

  // Sort: event-date proximity ascending (closest first), undated last.
  visible.sort((a, b) => {
    const da = daysUntil(a.event?.event_date ?? null);
    const db = daysUntil(b.event?.event_date ?? null);
    if (da === null && db === null) {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    if (da === null) return 1;
    if (db === null) return -1;
    // Prefer upcoming (positive) over past (negative); within each, soonest first.
    const aFuture = da >= 0;
    const bFuture = db >= 0;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return da - db;
  });

  /*
    PAGED (owner 2026-09-19). This list is ALWAYS ON under the roster, one row
    per thread, so a shop with 1,000 enquiries pushed Payday and every folded
    section a thousand rows down. Paged AFTER the filter and the sort, so page
    1 is still the soonest events; the chip counts below stay whole-list.
  */
  const bookingsPage = paginate(visible, search.bkpage);

  // WHO IS ASKING, for the rows on THIS page. A vendor holds no `events` RLS,
  // so the embedded `r.event.display_name` is null on EVERY thread of theirs —
  // which is why the old revealed/unrevealed split rendered "Event" either
  // way. One admin-scoped batch, gated by the vendor-scoped thread fetch above,
  // is what actually names them.
  const inquiryCustomers = await fetchInquiryCustomerFacts(
    createAdminClient(),
    bookingsPage.items.map((t) => t.event_id),
  );

  // Latest message per thread, for the rows on THIS page only.
  //
  // ⚠ BOUNDED. This used to fetch the latest messages of EVERY thread in one
  // `in.()` — a URL the gateway refuses past ~600 ids, and a read capped at 600
  // messages, so a busy shop's previews went blank. Now it asks about at most
  // one page of threads. The reducer keeps the FIRST row per thread
  // (newest-first); the `.limit(600)` can still cost a preview if the threads
  // on one page hold more than 600 messages between them — never a row.
  const pageThreadIds = bookingsPage.items.map((t) => t.thread_id);
  const { data: latestMessages } =
    pageThreadIds.length > 0
      ? await supabase
          .from('chat_messages')
          .select('thread_id,body,sender_role,created_at')
          .in('thread_id', pageThreadIds)
          .order('created_at', { ascending: false })
          .limit(600)
      : { data: [] as { thread_id: string; body: string; sender_role: string; created_at: string }[] };
  const latestByThread = new Map<
    string,
    { body: string; sender_role: string; created_at: string }
  >();
  for (const m of latestMessages ?? []) {
    if (!latestByThread.has(m.thread_id)) {
      latestByThread.set(m.thread_id, m);
    }
  }
  const pageRows: BookingRow[] = bookingsPage.items.map((r) => {
    const last = latestByThread.get(r.thread_id) ?? null;
    return {
      ...r,
      // 🔴 WAS: `last?.body ?? null` — the reader's own last word rendered
      // identically to the couple's. `previewFor` is the ONE preview builder
      // (`lib/conversation-list.ts`, shared with the Conversations column) —
      // it prefixes "You:" for this vendor's own messages and writes any card
      // this app generated as a short, fact-first line.
      lastMessagePreview: last ? previewFor(last, 'vendor') : null,
      lastMessageAt: last?.created_at ?? null,
    };
  });

  const counts: Record<Filter, number> = {
    all: rows.length,
    new: rows.filter((r) => r.status === 'new').length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    closed: rows.filter((r) => r.status === 'closed').length,
  };

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <ClipboardList aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bookings</h1>
        <p className="max-w-prose text-base text-ink/65">
          Threads from couples who&rsquo;ve reached out. Sorted by event date — the
          soonest events come first. Click a row to open the conversation.
        </p>
      </header>

      <nav
        aria-label="Booking filters"
        className="sn-tile flex flex-wrap items-center gap-2 p-3"
      >
        {(['all', 'new', 'in_progress', 'closed'] as Filter[]).map((f) => {
          const params = new URLSearchParams();
          if (f !== 'all') params.set('status', f);
          if (!upcoming) params.set('upcoming', '0');
          const qs = params.toString();
          const isActive = filter === f;
          return (
            <Link
              key={f}
              href={`/vendor-dashboard/bookings${qs ? `?${qs}` : ''}`}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ${
                isActive
                  ? 'bg-terracotta text-cream'
                  : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
              }`}
            >
              <span>{f === 'all' ? 'All' : STATUS_LABEL[f as BookingStatus]}</span>
              {counts[f] > 0 ? (
                <span
                  className={`rounded-full px-1.5 font-mono text-[10px] ${
                    isActive ? 'bg-cream/20 text-cream' : 'bg-ink/10 text-ink/65'
                  }`}
                >
                  {counts[f]}
                </span>
              ) : null}
            </Link>
          );
        })}

        <span className="mx-1 hidden h-6 w-px bg-ink/10 sm:inline-block" />

        <Link
          href={(() => {
            const params = new URLSearchParams();
            if (filter !== 'all') params.set('status', filter);
            if (upcoming) params.set('upcoming', '0');
            const qs = params.toString();
            return `/vendor-dashboard/bookings${qs ? `?${qs}` : ''}`;
          })()}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ${
            upcoming
              ? 'bg-success-100 text-success-900'
              : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
            {upcoming ? 'Upcoming · last 30d' : 'All time'}
          </span>
        </Link>
      </nav>

      {visible.length === 0 ? (
        <ShopEmpty>
          <ClipboardList
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No bookings yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Couples that send you a message land here.
          </p>
        </ShopEmpty>
      ) : (
        <ul className="space-y-2">
          {pageRows.map((r) => {
            const d = daysUntil(r.event?.event_date ?? null);
            const dateLabel = (() => {
              if (!r.event?.event_date) return 'No date set';
              if (d === null) return r.event.event_date;
              if (d === 0) return `${r.event.event_date} · today`;
              if (d > 0) return `${r.event.event_date} · in ${d} day${d === 1 ? '' : 's'}`;
              return `${r.event.event_date} · ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
            })();
            // Hybrid Preparation (2026-06-03) — the vendor may add dated
            // prep items only for ACCEPTED bookings (RLS gates the insert to
            // accepted threads; we gate the UI to match). Undated bookings
            // are fine — the prep item carries its own date.
            const isAccepted = r.inquiry_status === 'accepted';
            const prepItems: VendorPrepItem[] = isAccepted
              ? (vendorPrepByEvent.get(r.event_id) ?? []).map((it) => ({
                  itemId: it.itemId,
                  dueDate: it.dueDate,
                  label: it.label,
                  notes: it.notes,
                  kind: it.kind,
                  amountPhp: it.amountPhp,
                }))
              : [];
            return (
              // `.sn-row` — repeated list items stay opaque (blur budget § 1.6).
              // The #3266 anonymization placeholder renders inside untouched.
              <li key={r.thread_id} className="sn-row overflow-hidden">
                <Link
                  href={`/vendor-dashboard/messages/${r.thread_id}`}
                  className="group flex items-start justify-between gap-3 p-4 transition-colors hover:bg-terracotta/5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[r.status]}`}
                      >
                        {r.pillLabel}
                      </span>
                      {r.unread ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                          Unread
                        </span>
                      ) : null}
                      <p className="truncate text-sm font-semibold text-ink">
                        {(inquiryCustomers.get(r.event_id) ?? INQUIRY_CUSTOMER_UNKNOWN)
                          .displayName ?? 'Event'}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                      {dateLabel}
                      {r.lastMessageAt
                        ? ` · last message ${formatChatTimestamp(r.lastMessageAt)}`
                        : ''}
                    </p>
                    {r.lastMessagePreview ? (
                      <p className="line-clamp-1 text-xs text-ink/70">
                        {r.lastMessagePreview}
                      </p>
                    ) : (
                      <p className="text-xs italic text-ink/50">No messages yet.</p>
                    )}
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 h-4 w-4 shrink-0 text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
                    strokeWidth={1.75}
                  />
                </Link>
                {isAccepted ? (
                  <div className="border-t border-ink/10 px-4 py-3">
                    <VendorPrepForBooking
                      eventId={r.event_id}
                      vendorProfileId={profile.vendor_profile_id}
                      eventName={r.event?.display_name ?? 'this event'}
                      items={prepItems}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ListPager
        paged={bookingsPage}
        param="bkpage"
        keepParams={keepParamsFrom(search, ['bkpage'])}
        hash="bookings"
        noun="bookings"
        incomplete={!threadsComplete}
      />
      {factsIncomplete ? (
        <p
          role="status"
          className="mt-2 rounded-xl border px-3 py-2 text-xs"
          style={{
            background: 'var(--sn-warning-soft)',
            borderColor: 'color-mix(in srgb, var(--sn-warning) 30%, transparent)',
            color: 'var(--sn-warning-deep)',
          }}
        >
          Some booking details couldn&rsquo;t load, so a few rows may be missing their
          &ldquo;Unread&rdquo; dot or show the wrong stage. Reload the page to try again.
        </p>
      ) : null}
    </section>
  );
}
