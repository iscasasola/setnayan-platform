import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Camera,
  ListChecks,
  Megaphone,
  Music,
  Radio,
  UserCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import type { RunOfShowBlock, RunState } from '@/lib/run-of-show';
import {
  resolveDayOfConsoleKind,
  DAY_OF_CONSOLE_META,
  type DayOfConsoleKind,
} from '@/lib/vendor-day-of';
import { ShotList } from './_components/shot-list';
import { IssuesLog } from './_components/issues-log';

export const metadata = { title: 'On the Day · Vendor · Setnayan' };

/**
 * Vendor "On the Day" console — Phase 7 of the vendor-dashboard reorg
 * (03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md · the 6th vendor nav
 * menu). A free, CATEGORY-CONDITIONAL day-of hub: the events the vendor is
 * booked on (today / upcoming / just past), a live run-of-show for the focused
 * event, and a category-tuned working panel — a photographer sees a shot list,
 * a coordinator gets the command center (run-of-show + check-in + issues +
 * broadcast), a caterer sees final headcount, a music act sees their setlist.
 *
 * SOURCE OF TRUTH + RLS: the booked-event list comes from fetchVendorPoolBookings
 * (the same read the Clients page uses — the vendor's own released=null pool
 * bookings). The run-of-show timeline is read straight off event_schedule_blocks
 * under the existing booked-vendor SELECT policy
 * (event_schedule_blocks_booked_vendor_read, migration 20261130003000); no new
 * table, no new policy. Advancing the run-state uses the single-winner
 * advance_schedule_block RPC (already gated to booked vendors). The shot list +
 * issues log are personal, device-local (localStorage) working tools — no writes,
 * offline-tolerant on a spotty venue signal.
 *
 * The deep-dive per-event view (headcount / palette / seat plan / suggest-a-
 * change / delivery handover) already lives at /vendor-dashboard/clients/[eventId]
 * — this console links into it rather than duplicating it.
 */

type Props = {
  searchParams: Promise<{ event?: string }>;
};

type FocusBlock = {
  block_id: string;
  label: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  run_state: RunState | null;
  actual_start_at: string | null;
};

/** PH wall-clock today (UTC+8, no DST) as 'YYYY-MM-DD' — booked_date is stored in
 *  the same PH civil-day convention, so string comparison is exact. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Whole PH-civil-days between today and a booked date (negative = past). */
function daysFromToday(bookedDate: string, today: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${bookedDate}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

const CONSOLE_ICON: Record<DayOfConsoleKind, typeof CalendarCheck> = {
  coordinator: Radio,
  photo: Camera,
  caterer: UtensilsCrossed,
  band: Music,
  general: CalendarCheck,
};

export default async function VendorOnTheDayPage({ searchParams }: Props) {
  const { event: focusParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/on-the-day');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard/verify');

  const kind = resolveDayOfConsoleKind(profile.services);
  const meta = DAY_OF_CONSOLE_META[kind];
  const ConsoleIcon = CONSOLE_ICON[kind];

  const today = phToday();
  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);

  // One card per event (a vendor may hold several dated slots on the same event
  // across schedule pools). Keep the earliest booked_date per event.
  const byEvent = new Map<
    string,
    { eventId: string; eventName: string; bookedDate: string; threadId: string | null }
  >();
  for (const b of bookings) {
    const existing = byEvent.get(b.eventId);
    if (!existing || b.bookedDate < existing.bookedDate) {
      byEvent.set(b.eventId, {
        eventId: b.eventId,
        eventName: b.eventName,
        bookedDate: b.bookedDate,
        threadId: b.threadId,
      });
    }
  }
  const events = [...byEvent.values()].sort((a, b) => a.bookedDate.localeCompare(b.bookedDate));

  const todays = events.filter((e) => e.bookedDate === today);
  const upcoming = events.filter((e) => e.bookedDate > today);
  // Recently wrapped — the last 14 days, newest first (still "on the day" work:
  // handovers, wrap-up, review requests).
  const recent = events
    .filter((e) => e.bookedDate < today && daysFromToday(e.bookedDate, today) >= -14)
    .reverse();

  // Focus event — an explicit ?event= wins (must be one the vendor is booked
  // on), else today's event, else the nearest upcoming, else the most recent.
  const focus =
    (focusParam && events.find((e) => e.eventId === focusParam)) ||
    todays[0] ||
    upcoming[0] ||
    recent[0] ||
    null;

  // Live run-of-show for the focus event — booked-vendor SELECT policy admits
  // this read (migration 20261130003000). Only fetch when we have a focus event.
  let focusBlocks: RunOfShowBlock[] = [];
  if (focus) {
    const { data: rows } = await supabase
      .from('event_schedule_blocks')
      .select('block_id, label, start_at, end_at, location, run_state, actual_start_at')
      .eq('event_id', focus.eventId)
      .order('start_at', { ascending: true })
      .order('sort_order', { ascending: true });
    focusBlocks = ((rows ?? []) as FocusBlock[])
      .filter((b) => b.start_at)
      .map((b) => ({
        block_id: b.block_id,
        label: b.label,
        start_at: b.start_at as string,
        end_at: b.end_at,
        location: b.location,
        run_state: (b.run_state ?? 'upcoming') as RunState,
        actual_start_at: b.actual_start_at ?? null,
      }));
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <ConsoleIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">On the day</h1>
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {meta.eyebrow}
          </span>
        </div>
        <p className="max-w-prose text-base text-ink/65">{meta.blurb}</p>
      </header>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
          <CalendarDays aria-hidden className="mx-auto h-8 w-8 text-ink/30" strokeWidth={1.5} />
          <p className="mt-3 text-base font-medium text-ink/75">No events on your calendar yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">
            Once a couple books you and holds a date on your schedule, that day shows up here — with a
            live run-of-show and everything you need to run it.
          </p>
          <Link
            href="/vendor-dashboard/bookings"
            className="button-primary mt-4 inline-flex w-fit"
          >
            See your bookings
          </Link>
        </div>
      ) : (
        <>
          {/* Focus event — live run-of-show + category console. */}
          {focus ? (
            <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
                    {focus.bookedDate === today
                      ? 'Today'
                      : focus.bookedDate > today
                        ? 'Next up'
                        : 'Just wrapped'}
                  </p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">
                    {focus.eventName}
                  </h2>
                  <p className="text-sm text-ink/60">{fmtDate(focus.bookedDate)}</p>
                </div>
                <Link
                  href={`/vendor-dashboard/clients/${focus.eventId}`}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-terracotta hover:underline"
                >
                  Open the full brief <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>

              {/* Live run-of-show (now / next / running ±N) — booked vendors may
                  advance it (the single-winner RPC allows it). */}
              {focusBlocks.length > 0 ? (
                <div className="mt-4">
                  <RunOfShowHeader eventId={focus.eventId} initial={focusBlocks} canAdvance />
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/55">
                  The couple hasn&rsquo;t built their event-day timeline yet. Once they do, the live
                  run-of-show shows here — and you can suggest changes from{' '}
                  <Link
                    href={`/vendor-dashboard/clients/${focus.eventId}`}
                    className="font-medium text-terracotta underline"
                  >
                    their brief
                  </Link>
                  .
                </p>
              )}

              {/* Category-conditional console panel. */}
              <div className="mt-5">
                <DayOfConsole
                  kind={kind}
                  eventId={focus.eventId}
                  eventName={focus.eventName}
                />
              </div>
            </div>
          ) : null}

          {/* Event lists. */}
          {todays.length > 0 ? (
            <EventList
              title="Today"
              icon={CalendarCheck}
              events={todays}
              today={today}
              activeId={focus?.eventId}
            />
          ) : null}
          {upcoming.length > 0 ? (
            <EventList
              title="Upcoming"
              icon={CalendarDays}
              events={upcoming}
              today={today}
              activeId={focus?.eventId}
            />
          ) : null}
          {recent.length > 0 ? (
            <EventList
              title="Recently wrapped"
              icon={ListChecks}
              events={recent}
              today={today}
              activeId={focus?.eventId}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

/** Category-conditional console body — mirrors the prototype's odayCat switch. */
function DayOfConsole({
  kind,
  eventId,
  eventName,
}: {
  kind: DayOfConsoleKind;
  eventId: string;
  eventName: string;
}) {
  if (kind === 'photo') {
    return <ShotList eventId={eventId} eventName={eventName} />;
  }

  if (kind === 'coordinator') {
    return (
      <div className="space-y-4">
        {/* Vendor check-in + broadcast pointers route into the couple's brief,
            where the shared timeline + suggest/handover flows already live. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/vendor-dashboard/clients/${eventId}`}
            className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:border-terracotta/40 hover:bg-terracotta/[0.04]"
          >
            <UserCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
            <span>
              <span className="block text-sm font-semibold">Vendor check-in &amp; timeline</span>
              <span className="mt-0.5 block text-xs text-ink/60">
                See who&rsquo;s booked, the full day-of timeline, and nudge the run-of-show along.
              </span>
            </span>
          </Link>
          <Link
            href={`/vendor-dashboard/clients/${eventId}#suggest`}
            className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:border-terracotta/40 hover:bg-terracotta/[0.04]"
          >
            <Megaphone aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
            <span>
              <span className="block text-sm font-semibold">Broadcast a change</span>
              <span className="mt-0.5 block text-xs text-ink/60">
                Suggest a timeline change to the couple — they accept and it lights up for everyone.
              </span>
            </span>
          </Link>
        </div>
        <IssuesLog eventId={eventId} />
      </div>
    );
  }

  if (kind === 'caterer') {
    return (
      <Link
        href={`/vendor-dashboard/clients/${eventId}/production-sheet`}
        className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:border-terracotta/40 hover:bg-terracotta/[0.04] sm:p-6"
      >
        <span className="flex items-start gap-3">
          <UtensilsCrossed aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span>
            <span className="block text-base font-semibold">Final headcount &amp; meal splits</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              Attending pax, per-part counts, and meal preferences — pulled live from the couple&rsquo;s
              RSVPs, with your portion math on the production sheet.
            </span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-terracotta">Open →</span>
      </Link>
    );
  }

  if (kind === 'band') {
    return (
      <Link
        href="/vendor-dashboard/repertoire"
        className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:border-terracotta/40 hover:bg-terracotta/[0.04] sm:p-6"
      >
        <span className="flex items-start gap-3">
          <Music aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span>
            <span className="block text-base font-semibold">Your setlist</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              The songs you perform — go on knowing the room. When a couple&rsquo;s chosen songs overlap
              your set, you rank as a better match for their wedding.
            </span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-terracotta">Open →</span>
      </Link>
    );
  }

  // general — no specialist tool; point to the full brief.
  return (
    <Link
      href={`/vendor-dashboard/clients/${eventId}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-cream p-4 transition hover:border-terracotta/40 hover:bg-terracotta/[0.04] sm:p-6"
    >
      <span className="flex items-start gap-3">
        <CalendarCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <span>
          <span className="block text-base font-semibold">Your event brief</span>
          <span className="mt-0.5 block text-sm text-ink/65">
            Headcount, palette, the day-of timeline, and the delivery handover — everything for this
            booking in one place.
          </span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-terracotta">Open →</span>
    </Link>
  );
}

/** A titled group of booked-event cards. */
function EventList({
  title,
  icon: Icon,
  events,
  today,
  activeId,
}: {
  title: string;
  icon: typeof CalendarDays;
  events: { eventId: string; eventName: string; bookedDate: string }[];
  today: string;
  activeId?: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
        <Icon aria-hidden className="h-4 w-4 text-ink/45" strokeWidth={1.75} /> {title}
      </h2>
      <ul className="mt-2 space-y-2">
        {events.map((e) => {
          const isActive = e.eventId === activeId;
          return (
            <li key={e.eventId}>
              <Link
                href={`/vendor-dashboard/on-the-day?event=${e.eventId}`}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                  isActive
                    ? 'border-terracotta/40 bg-terracotta/[0.05]'
                    : 'border-ink/10 bg-white hover:border-terracotta/30 hover:bg-terracotta/[0.03]'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink/85">
                    {e.eventName}
                  </span>
                  <span className="block text-xs text-ink/55">
                    {fmtDate(e.bookedDate)}
                    {e.bookedDate === today ? ' · today' : ''}
                  </span>
                </span>
                {isActive ? (
                  <span className="shrink-0 rounded-full bg-terracotta/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-terracotta">
                    In focus
                  </span>
                ) : (
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/30" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
