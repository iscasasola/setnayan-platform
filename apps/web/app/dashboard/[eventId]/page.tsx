import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Users,
  Send,
  Briefcase,
  Wallet,
  CalendarDays,
  LayoutGrid,
  Sparkles,
  Palette,
  MessageSquare,
  Receipt,
  ArrowRight,
  CheckCircle2,
  Circle,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { computeGuestStats, fetchGuestsByEvent, guestDisplayName } from '@/lib/guests';
import { formatEventDate } from '@/lib/events';
import {
  STEPS,
  fetchManualStepCompletions,
  plannerProgress,
  resolveStepStatuses,
  type StepStatus,
} from '@/lib/planner';
import { toggleJourneyStep } from './actions';

export const dynamic = 'force-dynamic';

type Stage = {
  key: 'dreaming' | 'booking' | 'inviting' | 'finalizing' | 'wedding' | 'after';
  label: string;
};

const STAGES: Stage[] = [
  { key: 'dreaming', label: 'Dreaming' },
  { key: 'booking', label: 'Booking' },
  { key: 'inviting', label: 'Inviting' },
  { key: 'finalizing', label: 'Finalizing' },
  { key: 'wedding', label: 'Wedding Day' },
  { key: 'after', label: 'After' },
];

type TileKey =
  | 'guests'
  | 'invitation'
  | 'vendors'
  | 'budget'
  | 'messages'
  | 'seating'
  | 'services'
  | 'mood_board'
  | 'orders';

const TILES: Array<{
  key: TileKey;
  label: string;
  Icon: LucideIcon;
  href: (eventId: string) => string;
}> = [
  { key: 'guests', label: 'Guest List', Icon: Users, href: (id) => `/dashboard/${id}/guests` },
  { key: 'invitation', label: 'Invitation', Icon: Send, href: (id) => `/dashboard/${id}/invitation` },
  { key: 'vendors', label: 'Vendors', Icon: Briefcase, href: (id) => `/dashboard/${id}/vendors` },
  { key: 'budget', label: 'Budget', Icon: Wallet, href: (id) => `/dashboard/${id}/budget` },
  { key: 'messages', label: 'Messages', Icon: MessageSquare, href: (id) => `/dashboard/${id}/messages` },
  { key: 'seating', label: 'Seating', Icon: LayoutGrid, href: (id) => `/dashboard/${id}/seating` },
  { key: 'orders', label: 'Orders', Icon: Receipt, href: (id) => `/dashboard/${id}/orders` },
  { key: 'mood_board', label: 'Mood Board', Icon: Palette, href: (id) => `/dashboard/${id}/services/mood-board` },
  { key: 'services', label: 'Services', Icon: Sparkles, href: (id) => `/dashboard/${id}/services` },
];

function timeOfDayGreeting(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Burning the midnight oil';
}

function daysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const event = new Date(`${eventDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ms = event.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

function currentStage(daysOut: number | null, guestCount: number): Stage['key'] {
  if (daysOut === null) return 'dreaming';
  if (daysOut < 0) return 'after';
  if (daysOut === 0) return 'wedding';
  if (daysOut <= 30) return 'finalizing';
  if (guestCount > 0) return 'inviting';
  if (daysOut <= 180) return 'booking';
  return 'dreaming';
}

type NextUp = {
  title: string;
  body: string;
  cta: string;
  href: string;
};

function pickNextUp(args: {
  eventId: string;
  slug: string | null;
  guestCount: number;
  pendingCount: number;
  daysOut: number | null;
}): NextUp {
  const { eventId, slug, guestCount, pendingCount, daysOut } = args;
  if (guestCount === 0) {
    return {
      title: 'Add your first guests',
      body: 'Start with the wedding party — bearers, sponsors, and your immediate family. Plus-ones come later.',
      cta: 'Add a guest',
      href: `/dashboard/${eventId}/guests/new`,
    };
  }
  if (!slug) {
    return {
      title: 'Pick your invitation URL',
      body: 'Set a slug like maria-and-juan so your invitations land on a clean, memorable address.',
      cta: 'Set the slug',
      href: `/dashboard/${eventId}/invitation`,
    };
  }
  if (pendingCount > 0) {
    return {
      title: `Send invites to ${pendingCount} pending guests`,
      body: 'Print the QR sheet or share individual links so each guest can RSVP.',
      cta: 'Open invitation admin',
      href: `/dashboard/${eventId}/invitation`,
    };
  }
  if (daysOut !== null && daysOut > 0 && daysOut <= 60) {
    return {
      title: 'Lock in the seating plan',
      body: 'Your event is approaching — finalize the seating so vendors get clean numbers.',
      cta: 'Open seating',
      href: `/dashboard/${eventId}/seating`,
    };
  }
  return {
    title: 'Review your event',
    body: 'Everything looks set. Step through each section to make sure the details still match.',
    cta: 'Open invitation',
    href: `/dashboard/${eventId}/invitation`,
  };
}

type Activity = {
  id: string;
  when: string;
  description: string;
  href: string;
};

function relativeTime(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function EventHomePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [eventRes, profileRes, guests, manualSteps] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name, event_date, slug, venue_name, monogram_text, palette_finalized_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('display_name, planner_mode')
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
    fetchManualStepCompletions(supabase, eventId),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const profile = profileRes.data;
  const stats = computeGuestStats(guests);
  const now = new Date();
  const daysOut = daysUntil(event.event_date);
  const stage = currentStage(daysOut, stats.total);

  const plannerMode = profile?.planner_mode ?? 'guided';
  const stepStatuses = resolveStepStatuses(
    {
      event_date: event.event_date,
      venue_name: event.venue_name ?? null,
      slug: event.slug ?? null,
      monogram_text: event.monogram_text ?? null,
      palette_finalized_at: event.palette_finalized_at ?? null,
      guest_count: stats.total,
    },
    manualSteps,
  );

  const greetingName =
    profile?.display_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';
  const greeting = timeOfDayGreeting(now);

  const nextUp = pickNextUp({
    eventId,
    slug: event.slug ?? null,
    guestCount: stats.total,
    pendingCount: stats.pending,
    daysOut,
  });

  const recentGuests = [...guests]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 6);

  const activity: Activity[] = recentGuests.map((g) => ({
    id: g.guest_id,
    when: relativeTime(g.created_at ?? new Date().toISOString(), now),
    description: `${guestDisplayName(g)} added · ${g.rsvp_status === 'pending' ? 'awaiting RSVP' : g.rsvp_status}`,
    href: `/dashboard/${eventId}/guests/${g.guest_id}`,
  }));

  return (
    <section className="space-y-8">
      <WelcomeHeader
        greeting={greeting}
        name={greetingName}
        eventName={event.display_name}
        eventDate={event.event_date}
        daysOut={daysOut}
      />

      <StageStrip stage={stage} />

      <NextUpCard nextUp={nextUp} />

      {plannerMode === 'guided' ? (
        <Checklist eventId={eventId} statuses={stepStatuses} />
      ) : null}

      <NavGrid eventId={eventId} stats={stats} />

      <ActivityFeed activity={activity} />
    </section>
  );
}

function WelcomeHeader({
  greeting,
  name,
  eventName,
  eventDate,
  daysOut,
}: {
  greeting: string;
  name: string;
  eventName: string;
  eventDate: string | null;
  daysOut: number | null;
}) {
  return (
    <header className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        {greeting}, {name}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{eventName}</h1>
      <p className="text-base text-ink/60">
        {eventDate ? formatEventDate(eventDate) : 'Date to be confirmed'}
        {daysOut !== null
          ? daysOut > 0
            ? ` · ${daysOut} day${daysOut === 1 ? '' : 's'} to go`
            : daysOut === 0
              ? ' · today!'
              : ` · ${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? '' : 's'} ago`
          : null}
      </p>
    </header>
  );
}

function StageStrip({ stage }: { stage: Stage['key'] }) {
  const activeIndex = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="flex w-full items-center gap-2 overflow-x-auto rounded-xl border border-ink/10 bg-cream p-3">
      {STAGES.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
                active
                  ? 'bg-terracotta text-cream'
                  : done
                    ? 'bg-terracotta/15 text-terracotta-700'
                    : 'bg-ink/5 text-ink/55'
              }`}
            >
              {done ? (
                <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              ) : active ? (
                <Circle aria-hidden className="h-3.5 w-3.5 fill-cream" strokeWidth={2} />
              ) : (
                <Circle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {s.label}
            </span>
            {i < STAGES.length - 1 ? (
              <span aria-hidden className="h-px w-4 bg-ink/15 sm:w-6" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function NextUpCard({ nextUp }: { nextUp: NextUp }) {
  return (
    <Link
      href={nextUp.href}
      className="group flex flex-col gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-6 transition-colors hover:border-terracotta hover:bg-terracotta/10 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Next up
        </p>
        <h2 className="text-xl font-semibold tracking-tight">{nextUp.title}</h2>
        <p className="max-w-prose text-sm text-ink/65">{nextUp.body}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-cream sm:self-center">
        {nextUp.cta}
        <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function NavGrid({
  eventId,
  stats,
}: {
  eventId: string;
  stats: { total: number; attending: number; pending: number };
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Plan
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {TILES.map((tile) => {
          const { Icon } = tile;
          const counter =
            tile.key === 'guests' && stats.total > 0
              ? `${stats.attending}/${stats.total} attending`
              : tile.key === 'guests' && stats.pending > 0
                ? `${stats.pending} pending`
                : null;
          return (
            <li key={tile.key}>
              <Link
                href={tile.href(eventId)}
                className="flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="text-sm font-semibold text-ink">{tile.label}</span>
                {counter ? (
                  <span className="text-xs text-ink/55">{counter}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Checklist({
  eventId,
  statuses,
}: {
  eventId: string;
  statuses: StepStatus[];
}) {
  const progress = plannerProgress(statuses);
  const byKey = new Map(statuses.map((s) => [s.key, s]));
  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Guided planner
          </h2>
          <p className="text-sm text-ink/65">
            {progress.done} of {progress.total} steps · prefer to fly solo? Switch to DIY in
            Profile.
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-terracotta-700">
          {progress.pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <span
          className="block h-full rounded-full bg-terracotta transition-all"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <ol className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
        {STEPS.map((step, i) => {
          const status = byKey.get(step.key);
          const done = status?.completed ?? false;
          return (
            <li
              key={step.key}
              className="flex items-start gap-3 px-3 py-3 sm:px-4"
            >
              {step.source === 'manual' ? (
                <form action={toggleJourneyStep}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="step_key" value={step.key} />
                  <input
                    type="hidden"
                    name="action"
                    value={done ? 'uncomplete' : 'complete'}
                  />
                  <button
                    type="submit"
                    aria-label={done ? `Mark ${step.label} not done` : `Mark ${step.label} done`}
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center text-terracotta"
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                    ) : (
                      <Square className="h-5 w-5 text-ink/40" strokeWidth={1.75} />
                    )}
                  </button>
                </form>
              ) : (
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-6 w-6 items-center justify-center"
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-terracotta" strokeWidth={2} />
                  ) : (
                    <Circle className="h-5 w-5 text-ink/30" strokeWidth={1.75} />
                  )}
                </span>
              )}
              <Link
                href={step.href(eventId)}
                className="flex flex-1 flex-col gap-0.5 hover:text-terracotta"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`text-sm ${
                      done ? 'text-ink/50 line-through' : 'font-medium text-ink'
                    }`}
                  >
                    {i + 1}. {step.label}
                  </span>
                  {step.source === 'auto' ? (
                    <span className="rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
                      auto
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-ink/55">{step.hint}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ActivityFeed({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-6 text-center text-sm text-ink/55">
        Nothing in your activity feed yet — add a guest and it&rsquo;ll show up here.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Recent activity
      </h2>
      <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
        {activity.map((a) => (
          <li key={a.id}>
            <Link
              href={a.href}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-terracotta/5"
            >
              <span className="truncate text-ink/80">{a.description}</span>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                {a.when}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
