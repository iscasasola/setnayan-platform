import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import {
  fetchVendorBlocks,
  fetchVendorPoolBookings,
  fetchVendorPools,
} from '@/lib/vendor-schedule';
import { importExternalClient, removeBlock } from '../calendar/actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Clients · Vendor' };

/**
 * Vendor Clients — the book of business, three buckets (owner lock
 * 2026-06-12):
 *
 *   Booked     — Setnayan bookings holding live schedule slots
 *   Inquiring  — accepted chat threads not (yet) booked
 *   Outside    — imported external clients: named entries in the vendor's
 *                OWN book that hold schedule capacity but are NOT app
 *                clients (no thread, no funnel stats, no reviews)
 *
 * White is unlimited — pending inquiries live on /vendor-dashboard/bookings;
 * this page is the committed/working set.
 */

type Props = { searchParams: Promise<{ notice?: string }> };

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  client_imported: { tone: 'ok', text: 'Client imported — 1 token used. They now hold a slot on that schedule.' },
  block_removed: { tone: 'ok', text: 'Outside client removed — the date is open again.' },
  no_tokens: { tone: 'warn', text: 'Not enough tokens — importing an outside client costs 1 token.' },
  bad_dates: { tone: 'warn', text: 'Those dates don’t work — check the start and end date.' },
  bad_name: { tone: 'warn', text: 'The client needs a name.' },
  bad_pool: { tone: 'warn', text: 'Pick which schedule this client belongs to.' },
  save_failed: { tone: 'warn', text: 'That didn’t save — try again.' },
};

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function VendorClientsPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const [pools, bookings, blocks, threads] = await Promise.all([
    fetchVendorPools(supabase, profile.vendor_profile_id),
    fetchVendorPoolBookings(supabase, profile.vendor_profile_id),
    fetchVendorBlocks(supabase, profile.vendor_profile_id),
    fetchVendorThreads(supabase, profile.vendor_profile_id),
  ]);
  const notice = search.notice ? NOTICES[search.notice] : undefined;

  const poolLabel = new Map(pools.map((p) => [p.poolId, p.label]));

  // Booked — group live reservations by event.
  const bookedByEvent = new Map<
    string,
    { eventName: string; threadId: string | null; entries: { date: string; pool: string }[] }
  >();
  for (const b of bookings) {
    const group = bookedByEvent.get(b.eventId) ?? {
      eventName: b.eventName,
      threadId: b.threadId,
      entries: [],
    };
    group.entries.push({
      date: b.bookedDate,
      pool: poolLabel.get(b.poolId) ?? 'Schedule',
    });
    bookedByEvent.set(b.eventId, group);
  }

  // Inquiring — accepted threads without a live booking.
  const accepted = threads.filter(
    (t) => t.inquiry_status === 'accepted' && !bookedByEvent.has(t.event_id),
  );

  // Outside — external-client blocks.
  const externals = blocks.filter((b) => b.source === 'external_client');

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Users aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Clients</h1>
        <p className="max-w-prose text-base text-ink/65">
          Your book of business: Setnayan bookings, couples you&rsquo;re talking to,
          and clients you brought in from outside the app. Outside clients hold
          dates on your schedule but aren&rsquo;t app clients — no chat thread, no
          stats, no reviews.
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {/* Booked */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Booked via Setnayan</h2>
        {bookedByEvent.size === 0 ? (
          <p className="mt-2 text-sm text-ink/55">
            No booked clients holding schedule slots yet. Bookings appear here the
            moment a couple&rsquo;s downpayment is recorded.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10">
            {[...bookedByEvent.entries()].map(([eventId, group]) => (
              <li key={eventId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{group.eventName}</p>
                  <p className="text-xs text-ink/55">
                    {group.entries
                      .map((e) => `${fmtDate(e.date)} · ${e.pool}`)
                      .join('  ·  ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/vendor-dashboard/clients/${eventId}`}
                    className="text-sm font-medium text-terracotta underline"
                  >
                    Event brief
                  </Link>
                  {group.threadId ? (
                    <Link
                      href={`/vendor-dashboard/messages/${group.threadId}`}
                      className="text-sm font-medium text-terracotta underline"
                    >
                      Open chat
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inquiring */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="text-lg font-semibold">In conversation</h2>
        <p className="mt-1 text-sm text-ink/65">
          Accepted inquiries that haven&rsquo;t booked yet. The full inbox lives in{' '}
          <Link href="/vendor-dashboard/bookings" className="font-medium text-terracotta underline">
            Bookings
          </Link>
          .
        </p>
        {accepted.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">No open conversations right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10">
            {accepted.map((t) => (
              <li key={t.thread_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{t.event?.display_name ?? 'A Setnayan event'}</p>
                  <p className="text-xs text-ink/55">
                    {t.event?.event_date ? fmtDate(t.event.event_date) : 'Date not set yet'}
                  </p>
                </div>
                <Link
                  href={`/vendor-dashboard/messages/${t.thread_id}`}
                  className="text-sm font-medium text-terracotta underline"
                >
                  Open chat
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Outside clients */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Outside clients</h2>
          <Link
            href="/vendor-dashboard/calendar"
            className="inline-flex items-center gap-1 text-sm font-medium text-terracotta underline"
          >
            <CalendarDays aria-hidden className="h-4 w-4" /> View on calendar
          </Link>
        </div>
        {externals.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">
            No imported clients yet. Import one below so the app never
            double-books a date you sold outside Setnayan.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10">
            {externals.map((b) => (
              <li key={b.blockId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{b.clientName ?? b.label}</p>
                  <p className="text-xs text-ink/55">
                    {b.startDate === b.endDate
                      ? fmtDate(b.startDate)
                      : `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`}
                    {' · '}
                    {b.poolId ? (poolLabel.get(b.poolId) ?? 'Schedule') : 'Schedule'}
                    {b.clientContact ? ` · ${b.clientContact}` : ''}
                  </p>
                  {b.clientNote ? (
                    <p className="mt-0.5 text-xs text-ink/45">{b.clientNote}</p>
                  ) : null}
                </div>
                <form action={removeBlock}>
                  <input type="hidden" name="return_to" value="clients" />
                  <input type="hidden" name="block_id" value={b.blockId} />
                  <SubmitButton pendingLabel="Removing…" className="text-sm text-ink/55 underline hover:text-ink">
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        {pools.length > 0 ? (
          <details className="mt-4 rounded-xl border border-ink/10 bg-white/50 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Import an outside client · 1 token
            </summary>
            <form action={importExternalClient} className="mt-3 grid max-w-md gap-2">
              <input type="hidden" name="return_to" value="clients" />
              <select name="pool_id" required defaultValue={pools[0]?.poolId} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm">
                {pools.map((p) => (
                  <option key={p.poolId} value={p.poolId}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input type="text" name="client_name" required placeholder="Client name" maxLength={120} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
              <input type="text" name="client_contact" placeholder="Contact (optional)" maxLength={160} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
              <input type="text" name="client_note" placeholder="Note (optional)" maxLength={500} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" name="start_date" required className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <span className="text-sm text-ink/50">to</span>
                <input type="date" name="end_date" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
              </div>
              <SubmitButton pendingLabel="Importing…" className="justify-self-start rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream">
                Import · 1 token
              </SubmitButton>
            </form>
          </details>
        ) : null}
      </div>
    </section>
  );
}
