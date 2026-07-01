import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, BellRing, CheckCircle2, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchVendorBlocks,
  fetchVendorDayStates,
  fetchVendorPoolBookings,
  fetchVendorPools,
  type CalendarBlockEntry,
  type PoolBookingEntry,
  type SchedulePool,
  type VendorCalendarDayState,
} from '@/lib/vendor-schedule';
import { fetchVendorWaitlist } from '@/lib/vendor-waitlist';
import { setCalendarDayState, notifyWaitlistSlot } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Day · Calendar · Vendor' };

/**
 * PHASE 5 — month→day drill-down. One date, every schedule's state on it, and
 * the 6-state day controls (lock / whitelist / reopen). This is the per-day
 * surface of the 6-state taxonomy; the month grid links each cell here.
 *
 * The 6 states rendered per schedule (precedence high→low):
 *   Closed    — a manual/synced/business-wide closure block covers the date.
 *   Locked    — a vendor-set hard hold (gates bookings; net-new state).
 *   Approve   — a vendor-set whitelist / approve-first hold (net-new state).
 *   Full      — booked + imported >= capacity.
 *   Booked    — 0 < booked+imported < capacity.
 *   Open      — free.
 * Couples never see this — the privacy lock ("unavailable") holds on their side.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  day_state_saved: { tone: 'ok', text: 'Day updated. Couples see only “unavailable”.' },
  day_state_cleared: { tone: 'ok', text: 'Day reopened — it’s bookable again.' },
  waitlist_notified: { tone: 'ok', text: 'Waitlisted couples emailed — they know the date is open again.' },
  bad_dates: { tone: 'warn', text: 'That date doesn’t look right.' },
  bad_pool: { tone: 'warn', text: 'Pick which schedule this belongs to.' },
  save_failed: { tone: 'warn', text: 'That didn’t save — try again.' },
};

type Props = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ pool?: string; notice?: string }>;
};

function fmtLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00+08:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

type PoolDay = {
  pool: SchedulePool;
  consumed: number;
  closed: boolean;
  locked: boolean;
  whitelist: boolean;
};

function stateLabel(d: PoolDay): { text: string; cls: string; icon?: LucideIcon } {
  if (d.closed) return { text: 'Closed', cls: 'bg-ink/10 text-ink/60' };
  if (d.locked) return { text: 'Locked', cls: 'bg-ink/10 text-ink/60', icon: Lock };
  if (d.whitelist)
    return { text: 'Approve-first', cls: 'bg-success-100 text-success-900', icon: CheckCircle2 };
  if (d.consumed >= d.pool.capacity)
    return { text: `Full · ${d.consumed}/${d.pool.capacity}`, cls: 'bg-terracotta/20 text-terracotta' };
  if (d.consumed > 0)
    return { text: `Booked · ${d.consumed}/${d.pool.capacity}`, cls: 'bg-warn-100 text-warn-900' };
  return { text: 'Open', cls: 'bg-success-50 text-success-900' };
}

export default async function VendorCalendarDayPage({ params, searchParams }: Props) {
  const { date } = await params;
  const search = await searchParams;
  if (!DATE_RE.test(date)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const month = date.slice(0, 7);
  const [pools, bookings, blocks, dayStates, waitlist] = await Promise.all([
    fetchVendorPools(supabase, profile.vendor_profile_id),
    fetchVendorPoolBookings(supabase, profile.vendor_profile_id),
    fetchVendorBlocks(supabase, profile.vendor_profile_id),
    fetchVendorDayStates(supabase, profile.vendor_profile_id, date, date),
    fetchVendorWaitlist(supabase, profile.vendor_profile_id, date),
  ]);

  // Per-pool state for THIS date only.
  const bookingsOn: PoolBookingEntry[] = bookings.filter((b) => b.bookedDate === date);
  const blocksOn: CalendarBlockEntry[] = blocks.filter(
    (b) => b.startDate <= date && b.endDate >= date,
  );
  const statesOn: VendorCalendarDayState[] = dayStates.filter((d) => d.stateDate === date);

  const poolDays: PoolDay[] = pools.map((pool) => {
    let consumed = 0;
    let closed = false;
    for (const b of bookingsOn) if (b.poolId === pool.poolId) consumed += 1;
    for (const blk of blocksOn) {
      const applies = blk.poolId === null || blk.poolId === pool.poolId;
      if (!applies) continue;
      if (blk.source === 'external_client') {
        if (blk.poolId === pool.poolId) consumed += 1;
      } else {
        closed = true;
      }
    }
    let locked = false;
    let whitelist = false;
    for (const ds of statesOn) {
      const applies = ds.poolId === null || ds.poolId === pool.poolId;
      if (!applies) continue;
      if (ds.dayState === 'locked') locked = true;
      else if (ds.dayState === 'whitelist') whitelist = true;
    }
    return { pool, consumed, closed, locked, whitelist };
  });

  const waitingHere = waitlist.find((w) => w.requestedDate === date);
  const backHref = `/vendor-dashboard/calendar?m=${month}${
    search.pool ? `&pool=${search.pool}` : ''
  }`;
  const notice = search.notice ? NOTICES[search.notice] : undefined;

  const returnFields = (
    <>
      <input type="hidden" name="return_to" value="day" />
      <input type="hidden" name="return_date" value={date} />
      <input type="hidden" name="return_pool" value={search.pool ?? ''} />
      <input type="hidden" name="state_date" value={date} />
    </>
  );

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-terracotta underline"
        >
          ← Back to calendar
        </Link>
      </div>
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <CalendarDays aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{fmtLongDate(date)}</h1>
        <p className="max-w-prose text-base text-ink/65">
          What every schedule looks like on this day, and the controls to hold it. Couples
          only ever see &ldquo;unavailable&rdquo; — never who, why, or which state.
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-success-200 bg-success-50 text-success-900'
              : 'border-warn-200 bg-warn-50 text-warn-900'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {/* Per-schedule state on this date */}
      {pools.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-6 text-center text-ink/70">
          No schedules yet — post a service (or create a calendar) first.
        </div>
      ) : (
        <div className="space-y-3">
          {poolDays.map((d) => {
            const s = stateLabel(d);
            return (
              <div
                key={d.pool.poolId}
                className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{d.pool.label}</h2>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>
                    {s.icon ? <s.icon className="h-3 w-3" strokeWidth={2.5} aria-hidden /> : null}
                    {s.text}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/55">
                  Capacity {d.pool.capacity}/day · {d.consumed} taken
                </p>

                {/* Set / clear a day state for THIS schedule on THIS date */}
                <form
                  action={setCalendarDayState}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  {returnFields}
                  <input type="hidden" name="scope" value={d.pool.poolId} />
                  <label className="flex flex-col gap-1 text-xs text-ink/70">
                    Day state
                    <select
                      name="day_state"
                      defaultValue={d.locked ? 'locked' : d.whitelist ? 'whitelist' : 'open'}
                      className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="open">Open (bookable)</option>
                      <option value="locked">Locked (hard hold)</option>
                      <option value="whitelist">Approve-first</option>
                    </select>
                  </label>
                  <input
                    type="text"
                    name="note"
                    placeholder="Note (only you see this)"
                    maxLength={300}
                    className="min-w-40 flex-1 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                  />
                  <SubmitButton
                    pendingLabel="Saving…"
                    className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream"
                  >
                    Save
                  </SubmitButton>
                </form>
              </div>
            );
          })}

          {/* Business-wide (org) day state — applies to every schedule at once */}
          <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-4 sm:p-5">
            <h2 className="text-base font-semibold">Every schedule (business-wide)</h2>
            <p className="mt-1 text-xs text-ink/55">
              Hold or approve-first this date across your whole business at once.
            </p>
            <form action={setCalendarDayState} className="mt-3 flex flex-wrap items-end gap-2">
              {returnFields}
              <input type="hidden" name="scope" value="org" />
              <label className="flex flex-col gap-1 text-xs text-ink/70">
                Day state
                <select
                  name="day_state"
                  defaultValue="open"
                  className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="open">Open (bookable)</option>
                  <option value="locked">Locked (hard hold)</option>
                  <option value="whitelist">Approve-first</option>
                </select>
              </label>
              <input
                type="text"
                name="note"
                placeholder="Note (only you see this)"
                maxLength={300}
                className="min-w-40 flex-1 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
              />
              <SubmitButton
                pendingLabel="Saving…"
                className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream"
              >
                Apply to all
              </SubmitButton>
            </form>
          </div>
        </div>
      )}

      {/* Booked events on this day (deep-link to chat) */}
      {bookingsOn.length > 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="text-base font-semibold">Booked this day</h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {bookingsOn.map((b) => (
              <li key={b.poolBookingId} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{b.eventName}</p>
                  <p className="text-xs text-ink/55">
                    {pools.find((p) => p.poolId === b.poolId)?.label ?? 'A schedule'} · via Setnayan
                  </p>
                </div>
                {b.threadId ? (
                  <Link
                    href={`/vendor-dashboard/messages/${b.threadId}`}
                    className="text-sm font-medium text-terracotta underline"
                  >
                    Open chat
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Waitlist waiters for this date */}
      {waitingHere ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BellRing aria-hidden className="h-4 w-4 text-terracotta" /> Waitlist
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            {waitingHere.pendingCount === 1
              ? '1 couple is waiting on this date.'
              : `${waitingHere.pendingCount} couples are waiting on this date.`}{' '}
            When it frees up, let them know — a notify emails everyone waiting. (It’s free.)
          </p>
          <form action={notifyWaitlistSlot} className="mt-3">
            <input type="hidden" name="return_to" value="day" />
            <input type="hidden" name="return_date" value={date} />
            <input type="hidden" name="return_pool" value={search.pool ?? ''} />
            <input type="hidden" name="requested_date" value={date} />
            <SubmitButton
              pendingLabel="Notifying…"
              className="rounded-lg border border-terracotta/40 px-3 py-1.5 text-sm font-medium text-terracotta hover:bg-terracotta/5"
            >
              A slot opened — notify them
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </section>
  );
}
