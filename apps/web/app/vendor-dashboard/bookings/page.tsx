import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchVendorThreads,
  formatChatTimestamp,
  type VendorThreadWithEvent,
} from '@/lib/chat';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

export const metadata = { title: 'Bookings · Vendor' };

type BookingStatus = 'new' | 'in_progress' | 'stale';

const STATUS_LABEL: Record<BookingStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  stale: 'Stale',
};

const STATUS_TONE: Record<BookingStatus, string> = {
  new: 'bg-terracotta text-cream',
  in_progress: 'bg-sky-100 text-sky-800',
  stale: 'bg-ink/10 text-ink/65',
};

type Filter = 'all' | BookingStatus;

type Props = {
  searchParams: Promise<{ status?: string; upcoming?: string }>;
};

type BookingRow = VendorThreadWithEvent & {
  status: BookingStatus;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unread: boolean;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

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

  const threads = await fetchVendorThreads(supabase, profile.vendor_profile_id);

  // Pull latest message per thread for preview + unread inference.
  const threadIds = threads.map((t) => t.thread_id);
  const [{ data: latestMessages }, { data: unreadNotifs }] = await Promise.all([
    threadIds.length > 0
      ? supabase
          .from('chat_messages')
          .select('thread_id,body,sender_role,created_at')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Vendor's unread chat-message notifications — match by related_url
    // suffix (the URL is /vendor-dashboard/messages/<threadId>).
    supabase
      .from('notifications')
      .select('related_url')
      .eq('user_id', user.id)
      .eq('type', 'chat_message')
      .is('read_at', null),
  ]);

  const latestByThread = new Map<
    string,
    { body: string; sender_role: string; created_at: string }
  >();
  for (const m of latestMessages ?? []) {
    if (!latestByThread.has(m.thread_id)) {
      latestByThread.set(m.thread_id, m);
    }
  }
  const unreadThreadIds = new Set<string>();
  for (const n of unreadNotifs ?? []) {
    const url = (n.related_url ?? '') as string;
    const idx = url.lastIndexOf('/');
    if (idx >= 0) unreadThreadIds.add(url.slice(idx + 1));
  }

  const now = Date.now();
  const rows: BookingRow[] = threads.map((t) => {
    const last = latestByThread.get(t.thread_id) ?? null;
    const unread = unreadThreadIds.has(t.thread_id);
    const lastTime = last ? new Date(last.created_at).getTime() : new Date(t.updated_at).getTime();
    const stale = now - lastTime > THIRTY_DAYS_MS;
    let status: BookingStatus;
    if (unread) status = 'new';
    else if (stale) status = 'stale';
    else status = 'in_progress';
    return {
      ...t,
      status,
      lastMessagePreview: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
      unread,
    };
  });

  const filter: Filter =
    search.status === 'new' ||
    search.status === 'in_progress' ||
    search.status === 'stale' ||
    search.status === 'all'
      ? (search.status as Filter)
      : 'all';
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

  const counts: Record<Filter, number> = {
    all: rows.length,
    new: rows.filter((r) => r.status === 'new').length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    stale: rows.filter((r) => r.status === 'stale').length,
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
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-cream p-3"
      >
        {(['all', 'new', 'in_progress', 'stale'] as Filter[]).map((f) => {
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
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
            {upcoming ? 'Upcoming · last 30d' : 'All time'}
          </span>
        </Link>
      </nav>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
          <ClipboardList
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No bookings yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Couples that send you a message land here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const d = daysUntil(r.event?.event_date ?? null);
            const dateLabel = (() => {
              if (!r.event?.event_date) return 'No date set';
              if (d === null) return r.event.event_date;
              if (d === 0) return `${r.event.event_date} · today`;
              if (d > 0) return `${r.event.event_date} · in ${d} day${d === 1 ? '' : 's'}`;
              return `${r.event.event_date} · ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
            })();
            return (
              <li key={r.thread_id}>
                <Link
                  href={`/vendor-dashboard/messages/${r.thread_id}`}
                  className="group flex items-start justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      <p className="truncate text-sm font-semibold text-ink">
                        {r.event?.display_name ?? 'Event'}
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
