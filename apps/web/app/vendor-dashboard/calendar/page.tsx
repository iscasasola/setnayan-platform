import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Lock, UserPlus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchVendorBlocks,
  fetchVendorPoolBookings,
  fetchVendorPools,
  type CalendarBlockEntry,
  type PoolBookingEntry,
  type SchedulePool,
} from '@/lib/vendor-schedule';
import {
  addManualBlock,
  importExternalClient,
  removeBlock,
  reassignCategoryPool,
  updatePoolCapacity,
} from './actions';

export const metadata = { title: 'Calendar · Vendor' };

/**
 * Vendor Calendar — one calendar, one tab per schedule pool (owner lock
 * 2026-06-12: same category = one shared schedule; a new category = a new,
 * independent schedule; merged categories share a tab).
 *
 * Day states, in precedence order:
 *   closed   — a manual/org-wide block covers the date (date closed outright)
 *   full     — consuming entries (booked + external clients) ≥ capacity
 *   partial  — some capacity consumed
 *   open     — free
 *
 * Couples never see any of this detail — their side only ever renders
 * "unavailable" (privacy lock). This page is the vendor's own book.
 */

type Props = {
  searchParams: Promise<{ m?: string; pool?: string; notice?: string }>;
};

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  block_added: { tone: 'ok', text: 'Date block added.' },
  block_removed: { tone: 'ok', text: 'Entry removed.' },
  client_imported: { tone: 'ok', text: 'Client imported — 1 token used. They now hold a slot on this schedule.' },
  capacity_saved: { tone: 'ok', text: 'Daily capacity saved.' },
  capacity_clamped: { tone: 'warn', text: 'Saved at your plan’s maximum bookings-per-day. Upgrade to raise the ceiling.' },
  pool_saved: { tone: 'ok', text: 'Schedule assignment saved.' },
  no_tokens: { tone: 'warn', text: 'Not enough tokens — importing an outside client costs 1 token. Top up under Tokens.' },
  bad_dates: { tone: 'warn', text: 'Those dates don’t work — check the start and end date.' },
  bad_name: { tone: 'warn', text: 'The client needs a name.' },
  bad_pool: { tone: 'warn', text: 'Pick which schedule this belongs to.' },
  bad_capacity: { tone: 'warn', text: 'Capacity must be a whole number of at least 1.' },
  save_failed: { tone: 'warn', text: 'That didn’t save — try again.' },
};

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type DayState = {
  booked: number;
  external: number;
  closed: boolean;
};

export default async function VendorCalendarPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const [pools, bookings, blocks] = await Promise.all([
    fetchVendorPools(supabase, profile.vendor_profile_id),
    fetchVendorPoolBookings(supabase, profile.vendor_profile_id),
    fetchVendorBlocks(supabase, profile.vendor_profile_id),
  ]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = /^\d{4}-\d{2}$/.test(search.m ?? '') ? (search.m as string) : thisMonth;
  const activePool: SchedulePool | null =
    pools.find((p) => p.poolId === search.pool) ?? pools[0] ?? null;
  const notice = search.notice ? NOTICES[search.notice] : undefined;

  // ── Day-state map for the selected pool + month ─────────────────────────
  const [yearNum = 2026, monthNum = 1] = month.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstWeekday = new Date(yearNum, monthNum - 1, 1).getDay();
  const dayStates = new Map<string, DayState>();
  const dateOf = (day: number) =>
    `${month}-${String(day).padStart(2, '0')}`;
  if (activePool) {
    for (let d = 1; d <= daysInMonth; d++) {
      dayStates.set(dateOf(d), { booked: 0, external: 0, closed: false });
    }
    for (const b of bookings) {
      if (b.poolId === activePool.poolId) {
        const st = dayStates.get(b.bookedDate);
        if (st) st.booked += 1;
      }
    }
    for (const blk of blocks) {
      const appliesToPool =
        blk.poolId === null || blk.poolId === activePool.poolId;
      if (!appliesToPool) continue;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = dateOf(d);
        if (date < blk.startDate || date > blk.endDate) continue;
        const st = dayStates.get(date);
        if (!st) continue;
        if (blk.source === 'external_client') {
          if (blk.poolId === activePool.poolId) st.external += 1;
        } else {
          st.closed = true;
        }
      }
    }
  }

  // Upcoming entries for the selected pool (list under the grid).
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const upcomingBookings: PoolBookingEntry[] = activePool
    ? bookings.filter((b) => b.poolId === activePool.poolId && b.bookedDate >= today)
    : [];
  const upcomingBlocks: CalendarBlockEntry[] = activePool
    ? blocks.filter(
        (b) =>
          (b.poolId === null || b.poolId === activePool.poolId)
          && b.endDate >= today
          && b.source !== 'setnayan_booking',
      )
    : [];

  const returnFields = (
    <>
      <input type="hidden" name="return_month" value={month} />
      <input type="hidden" name="return_pool" value={activePool?.poolId ?? ''} />
    </>
  );

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <CalendarDays aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Calendar</h1>
        <p className="max-w-prose text-base text-ink/65">
          One schedule per service category — services in the same category share a
          schedule; a new category gets its own. Booked dates, your own blocks, and
          imported outside clients all live here. Couples only ever see
          &ldquo;unavailable&rdquo; — never who or why.
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
          {search.notice === 'no_tokens' ? (
            <>
              {' '}
              <Link href="/vendor-dashboard/tokens" className="font-medium underline">
                Get tokens
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {pools.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-8 text-center">
          <p className="text-ink/70">
            Post a service first — each service category you offer gets its own
            schedule here automatically.
          </p>
          <Link
            href="/vendor-dashboard/services"
            className="mt-3 inline-block font-medium text-terracotta underline"
          >
            Go to Services
          </Link>
        </div>
      ) : (
        <>
          {/* Pool tabs — one per independent schedule */}
          <nav aria-label="Schedules" className="flex flex-wrap items-center gap-2">
            {pools.map((p) => {
              const active = p.poolId === activePool?.poolId;
              return (
                <Link
                  key={p.poolId}
                  href={`/vendor-dashboard/calendar?pool=${p.poolId}&m=${month}`}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                    active
                      ? 'border-terracotta bg-terracotta text-cream'
                      : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>

          {activePool ? (
            <>
              {/* Month grid */}
              <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Link
                    href={`/vendor-dashboard/calendar?pool=${activePool.poolId}&m=${shiftMonth(month, -1)}`}
                    className="rounded-lg border border-ink/15 px-3 py-1 text-sm hover:border-ink/30"
                  >
                    ← {monthLabel(shiftMonth(month, -1)).split(' ')[0]}
                  </Link>
                  <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
                  <Link
                    href={`/vendor-dashboard/calendar?pool=${activePool.poolId}&m=${shiftMonth(month, 1)}`}
                    className="rounded-lg border border-ink/15 px-3 py-1 text-sm hover:border-ink/30"
                  >
                    {monthLabel(shiftMonth(month, 1)).split(' ')[0]} →
                  </Link>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink/50">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstWeekday }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = dateOf(day);
                    const st = dayStates.get(date)!;
                    const consumed = st.booked + st.external;
                    const full = consumed >= activePool.capacity;
                    const past = date < today;
                    let cls = 'border-ink/10 bg-white/40';
                    let badge: string | null = null;
                    if (st.closed) {
                      cls = 'border-ink/20 bg-ink/10 text-ink/50';
                      badge = 'Closed';
                    } else if (consumed > 0) {
                      cls = full
                        ? 'border-terracotta/40 bg-terracotta/15'
                        : 'border-amber-300 bg-amber-50';
                      badge = `${consumed}/${activePool.capacity}`;
                    }
                    return (
                      <div
                        key={date}
                        className={`min-h-14 rounded-lg border p-1 text-left ${cls} ${past ? 'opacity-50' : ''}`}
                      >
                        <span className="text-xs font-medium">{day}</span>
                        {badge ? (
                          <span className="mt-0.5 block text-[10px] font-semibold leading-tight">
                            {badge}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-ink/55">
                  <span className="font-semibold">n/{activePool.capacity}</span> = booked
                  + imported clients vs daily capacity · <span className="font-semibold">Closed</span> = your
                  block (this schedule or business-wide).
                </p>
              </div>

              {/* Capacity */}
              <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
                <h3 className="text-base font-semibold">Daily capacity — {activePool.label}</h3>
                <p className="mt-1 text-sm text-ink/65">
                  How many bookings this team can serve on one date. Unlimited
                  inquiries stay open until a date is fully booked.
                </p>
                <form action={updatePoolCapacity} className="mt-3 flex items-center gap-2">
                  {returnFields}
                  <input type="hidden" name="pool_id" value={activePool.poolId} />
                  <input
                    type="number"
                    name="capacity"
                    min={1}
                    max={50}
                    defaultValue={activePool.capacity}
                    className="w-24 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream"
                  >
                    Save
                  </button>
                </form>
              </div>

              {/* Add block + import client */}
              <div className="grid gap-4 lg:grid-cols-2">
                <details className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
                  <summary className="cursor-pointer text-base font-semibold">
                    <Lock aria-hidden className="mr-1 inline h-4 w-4" /> Block dates
                  </summary>
                  <p className="mt-2 text-sm text-ink/65">
                    Close dates on this schedule — or business-wide (every schedule)
                    for holidays and rest days. Couples see only &ldquo;unavailable&rdquo;.
                  </p>
                  <form action={addManualBlock} className="mt-3 grid gap-2">
                    {returnFields}
                    <input
                      type="text"
                      name="label"
                      placeholder="Label (only you see this)"
                      maxLength={120}
                      className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="date" name="start_date" required className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                      <span className="text-sm text-ink/50">to</span>
                      <input type="date" name="end_date" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                    </div>
                    <select name="scope" defaultValue={activePool.poolId} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm">
                      <option value={activePool.poolId}>Only {activePool.label}</option>
                      <option value="org">Business-wide (every schedule)</option>
                    </select>
                    <button type="submit" className="justify-self-start rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream">
                      Add block
                    </button>
                  </form>
                </details>

                <details className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
                  <summary className="cursor-pointer text-base font-semibold">
                    <UserPlus aria-hidden className="mr-1 inline h-4 w-4" /> Import an outside client
                  </summary>
                  <p className="mt-2 text-sm text-ink/65">
                    A booking you took outside Setnayan. It holds a slot on this
                    schedule so the app never double-books you. Costs <strong>1 token</strong>.
                    Outside clients aren&rsquo;t app clients — no chat thread, no stats,
                    no reviews.
                  </p>
                  <form action={importExternalClient} className="mt-3 grid gap-2">
                    {returnFields}
                    <input type="hidden" name="pool_id" value={activePool.poolId} />
                    <input type="text" name="client_name" required placeholder="Client name" maxLength={120} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                    <input type="text" name="client_contact" placeholder="Contact (optional)" maxLength={160} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                    <input type="text" name="client_note" placeholder="Note (optional)" maxLength={500} className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="date" name="start_date" required className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                      <span className="text-sm text-ink/50">to</span>
                      <input type="date" name="end_date" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                    </div>
                    <button type="submit" className="justify-self-start rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream">
                      Import · 1 token
                    </button>
                  </form>
                </details>
              </div>

              {/* Upcoming list */}
              <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
                <h3 className="text-base font-semibold">Upcoming on this schedule</h3>
                {upcomingBookings.length === 0 && upcomingBlocks.length === 0 ? (
                  <p className="mt-2 text-sm text-ink/55">Nothing upcoming yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-ink/10">
                    {upcomingBookings.map((b) => (
                      <li key={b.poolBookingId} className="flex items-center justify-between gap-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium">{b.eventName}</p>
                          <p className="text-xs text-ink/55">{fmtDate(b.bookedDate)} · Booked via Setnayan</p>
                        </div>
                        {b.threadId ? (
                          <Link href={`/vendor-dashboard/messages/${b.threadId}`} className="text-sm font-medium text-terracotta underline">
                            Open chat
                          </Link>
                        ) : null}
                      </li>
                    ))}
                    {upcomingBlocks.map((blk) => (
                      <li key={blk.blockId} className="flex items-center justify-between gap-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium">
                            {blk.source === 'external_client'
                              ? `${blk.clientName ?? blk.label} (outside client)`
                              : `${blk.label}${blk.poolId === null ? ' · business-wide' : ''}`}
                          </p>
                          <p className="text-xs text-ink/55">
                            {blk.startDate === blk.endDate
                              ? fmtDate(blk.startDate)
                              : `${fmtDate(blk.startDate)} – ${fmtDate(blk.endDate)}`}
                            {blk.source === 'external_client' && blk.clientContact ? ` · ${blk.clientContact}` : ''}
                          </p>
                        </div>
                        <form action={removeBlock}>
                          {returnFields}
                          <input type="hidden" name="block_id" value={blk.blockId} />
                          <button type="submit" className="text-sm text-ink/55 underline hover:text-ink">
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Merge / split categories */}
              {activePool.categories.length > 0 && pools.length >= 1 ? (
                <details className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
                  <summary className="cursor-pointer text-base font-semibold">
                    <Users aria-hidden className="mr-1 inline h-4 w-4" /> Which categories share this team?
                  </summary>
                  <p className="mt-2 text-sm text-ink/65">
                    By default every category runs its own schedule (different
                    materials, different crew). If the <em>same team</em> serves two
                    categories — say photo and video — point both at one schedule so a
                    booking on either holds the date on both.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {pools.flatMap((p) =>
                      p.categories.map((cat) => (
                        <li key={cat} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="min-w-32 font-medium">
                            {cat.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <form action={reassignCategoryPool} className="flex items-center gap-2">
                            {returnFields}
                            <input type="hidden" name="category_key" value={cat} />
                            <select name="target_pool" defaultValue={p.poolId} className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-sm">
                              {pools.map((opt) => (
                                <option key={opt.poolId} value={opt.poolId}>
                                  {opt.label}
                                </option>
                              ))}
                              <option value="new">Its own new schedule</option>
                            </select>
                            <button type="submit" className="rounded-lg border border-ink/20 px-3 py-1 text-sm hover:border-ink/40">
                              Move
                            </button>
                          </form>
                        </li>
                      )),
                    )}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
