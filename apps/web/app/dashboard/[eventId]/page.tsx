import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Users,
  Send,
  Briefcase,
  Wallet,
  LayoutGrid,
  Sparkles,
  Palette,
  MessageSquare,
  Receipt,
  Bell,
  FileSignature,
  ArrowRight,
  CheckCircle2,
  Circle,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { countUnread } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { fetchEventActivity, relativeTime, type ActivityItem } from '@/lib/activity';
import { formatEventDate } from '@/lib/events';
import {
  sweepExpiredConcierge,
  type ConciergeEnforcementLevel,
  type ConciergeStatus,
} from '@/lib/concierge';
import { ConciergeBanner } from './_components/concierge-banner';
import { getLocale, makeT, type TranslationKey } from '@/lib/i18n';
import {
  STEPS,
  fetchManualStepCompletions,
  plannerProgress,
  resolveStepStatuses,
  type StepStatus,
} from '@/lib/planner';
import { isInDayOfWindow } from '@/lib/day-of-mode';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { fetchTables, type EventTableRow } from '@/lib/seating';
import { DayOfModeGrid } from './_components/day-of-mode/grid';
import { toggleJourneyStep } from './actions';
import { EventDayPrepCta } from '@/app/_components/event-day-prep-cta';
import { AutoPreloadOnEventDay } from '@/app/_components/auto-preload-on-event-day';

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
  | 'contracts'
  | 'budget'
  | 'messages'
  | 'seating'
  | 'add_ons'
  | 'mood_board'
  | 'orders'
  | 'notifications';

const TILES: Array<{
  key: TileKey;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  href: (eventId: string) => string;
}> = [
  { key: 'guests', labelKey: 'nav.guests', Icon: Users, href: (id) => `/dashboard/${id}/guests` },
  { key: 'invitation', labelKey: 'nav.invitation', Icon: Send, href: (id) => `/dashboard/${id}/invitation` },
  { key: 'vendors', labelKey: 'nav.vendors', Icon: Briefcase, href: (id) => `/dashboard/${id}/vendors` },
  { key: 'contracts', labelKey: 'nav.contracts', Icon: FileSignature, href: (id) => `/dashboard/${id}/contracts` },
  { key: 'budget', labelKey: 'nav.budget', Icon: Wallet, href: (id) => `/dashboard/${id}/budget` },
  { key: 'messages', labelKey: 'nav.messages', Icon: MessageSquare, href: (id) => `/dashboard/${id}/messages` },
  { key: 'seating', labelKey: 'nav.seating', Icon: LayoutGrid, href: (id) => `/dashboard/${id}/seating` },
  { key: 'orders', labelKey: 'nav.orders', Icon: Receipt, href: (id) => `/dashboard/${id}/orders` },
  { key: 'notifications', labelKey: 'nav.notifications', Icon: Bell, href: () => `/dashboard/notifications` },
  { key: 'mood_board', labelKey: 'nav.mood_board', Icon: Palette, href: (id) => `/dashboard/${id}/add-ons/mood-board` },
  { key: 'add_ons', labelKey: 'nav.add_ons', Icon: Sparkles, href: (id) => `/dashboard/${id}/add-ons` },
];

function timeOfDayGreetingKey(date: Date): TranslationKey {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'greeting.morning';
  if (h >= 12 && h < 17) return 'greeting.afternoon';
  if (h >= 17 && h < 21) return 'greeting.evening';
  return 'greeting.night';
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

type NextTask = {
  id: string;
  title: string;
  body: string;
  cta: string;
  href: string;
};

function pickNextTasks(args: {
  eventId: string;
  slug: string | null;
  venueName: string | null;
  monogramText: string | null;
  paletteFinalizedAt: string | null;
  guestCount: number;
  pendingCount: number;
  daysOut: number | null;
}): NextTask[] {
  const {
    eventId,
    slug,
    venueName,
    monogramText,
    paletteFinalizedAt,
    guestCount,
    pendingCount,
    daysOut,
  } = args;
  const out: NextTask[] = [];
  const push = (t: NextTask) => {
    if (out.length < 5 && !out.some((x) => x.id === t.id)) out.push(t);
  };

  if (guestCount === 0) {
    push({
      id: 'add-guests',
      title: 'Add your first guests',
      body: 'Start with the wedding party — bearers, sponsors, and your immediate family.',
      cta: 'Add a guest',
      href: `/dashboard/${eventId}/guests/new`,
    });
  }
  if (!slug) {
    push({
      id: 'set-slug',
      title: 'Pick your invitation URL',
      body: 'Set a slug like maria-and-juan so your invites land on a clean address.',
      cta: 'Set slug',
      href: `/dashboard/${eventId}/invitation`,
    });
  }
  if (!venueName) {
    push({
      id: 'set-venue',
      title: 'Lock in your venue',
      body: 'A venue name lets us pre-fill invitations, seating, and vendor briefs.',
      cta: 'Add venue',
      href: `/dashboard/${eventId}/invitation`,
    });
  }
  if (pendingCount > 0) {
    push({
      id: 'send-invites',
      title:
        pendingCount === 1
          ? 'Send invite to 1 pending guest'
          : `Send invites to ${pendingCount} pending guests`,
      body: 'Print the QR sheet or share individual links so each guest can RSVP.',
      cta: 'Open invitation',
      href: `/dashboard/${eventId}/invitation`,
    });
  }
  if (daysOut !== null && daysOut > 0 && daysOut <= 14) {
    push({
      id: 'final-week',
      title: 'Run final-week confirmations',
      body: 'Confirm arrival times with every booked vendor — the call sheet is ready in Vendors.',
      cta: 'Open vendors',
      href: `/dashboard/${eventId}/vendors`,
    });
  }
  if (daysOut !== null && daysOut > 0 && daysOut <= 60) {
    push({
      id: 'lock-seating',
      title: 'Lock in the seating plan',
      body: 'Your event is approaching — finalize seating so vendors get clean numbers.',
      cta: 'Open seating',
      href: `/dashboard/${eventId}/seating`,
    });
  }
  if (!paletteFinalizedAt) {
    push({
      id: 'set-palette',
      title: 'Lock in your color palette',
      body: 'Pick the palette for invitations, signage, and the gallery — vendors will match it.',
      cta: 'Open mood board',
      href: `/dashboard/${eventId}/add-ons/mood-board`,
    });
  }
  if (!monogramText) {
    push({
      id: 'set-monogram',
      title: 'Set your monogram',
      body: 'Your initials anchor the invitation card, table numbers, and event signage.',
      cta: 'Set monogram',
      href: `/dashboard/${eventId}/add-ons`,
    });
  }

  const evergreen: NextTask[] = [
    {
      id: 'browse-vendors',
      title: 'Browse vendor directory',
      body: 'Photographers, florists, mobile bars — discover Filipino-first vendors near your venue.',
      cta: 'Open vendors',
      href: `/dashboard/${eventId}/vendors`,
    },
    {
      id: 'sketch-schedule',
      title: 'Sketch your day-of timeline',
      body: 'Block in ceremony, photos, reception. Vendors plug into your schedule.',
      cta: 'Open schedule',
      href: `/dashboard/${eventId}/schedule`,
    },
    {
      id: 'review-budget',
      title: 'Review your budget',
      body: 'Compare vendor commitments against your total and flag anything close to your cap.',
      cta: 'Open budget',
      href: `/dashboard/${eventId}/budget`,
    },
    {
      id: 'preview-invitation',
      title: 'Preview your invitation',
      body: 'See what guests see when they open your invitation URL.',
      cta: 'Open invitation',
      href: `/dashboard/${eventId}/invitation`,
    },
    {
      id: 'review-event',
      title: 'Review your event details',
      body: 'Step through every section to make sure the details still match.',
      cta: 'Open settings',
      href: `/dashboard/${eventId}/invitation`,
    },
  ];
  for (const t of evergreen) push(t);

  return out;
}


export default async function EventHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ concierge_trial?: string }>;
}) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Lazy expiry sweep at the top of any Concierge-surfacing page (no-cron
  // architecture per CLAUDE.md 2026-05-14 / PR #47). Fire-and-forget; failures
  // never block the dashboard render.
  const adminClient = createAdminClient();
  void sweepExpiredConcierge(adminClient);

  const [eventRes, profileRes, guests, manualSteps, unreadCount, locale] =
    await Promise.all([
      supabase
        .from('events')
        .select(
          'event_id, display_name, event_date, slug, venue_name, monogram_text, palette_finalized_at, concierge_status, concierge_tier, concierge_activated_at, concierge_expires_at, concierge_long_engagement_advised_at',
        )
        .eq('event_id', eventId)
        .maybeSingle(),
      supabase
        .from('users')
        .select(
          'display_name, planner_mode, concierge_trial_used_at, concierge_enforcement_level',
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      fetchGuestsByEvent(supabase, eventId),
      fetchManualStepCompletions(supabase, eventId),
      countUnread(supabase, user.id),
      getLocale(),
    ]);
  const tr = makeT(locale);

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
  const greeting = tr(timeOfDayGreetingKey(now));

  const nextTasks = pickNextTasks({
    eventId,
    slug: event.slug ?? null,
    venueName: event.venue_name ?? null,
    monogramText: event.monogram_text ?? null,
    paletteFinalizedAt: event.palette_finalized_at ?? null,
    guestCount: stats.total,
    pendingCount: stats.pending,
    daysOut,
  });

  // Day-of mode (iteration 0031): when inside the T-1h .. T+8h window of the
  // event date, fetch the schedule + seating data needed to render the live
  // grid above the rest of the dashboard. Outside the window we render
  // nothing extra and skip the queries entirely.
  const dayOfActive = event.event_date ? isInDayOfWindow(event.event_date) : false;
  let dayOfBlocks: Awaited<ReturnType<typeof fetchScheduleBlocks>> = [];
  let dayOfHeadTable: EventTableRow | null = null;
  let dayOfNearbyTables: EventTableRow[] = [];
  if (dayOfActive) {
    const [blocksRes, tablesRes] = await Promise.all([
      fetchScheduleBlocks(supabase, eventId).catch(() => []),
      fetchTables(supabase, eventId).catch(() => [] as EventTableRow[]),
    ]);
    dayOfBlocks = blocksRes;
    const tables = tablesRes;
    dayOfHeadTable = tables.find((t) => t.table_type === 'head_table') ?? null;
    dayOfNearbyTables = tables
      .filter((t) => t.table_id !== dayOfHeadTable?.table_id)
      .slice(0, 6);
  }

  const activity = await fetchEventActivity(supabase, eventId, 20);

  // Concierge state for the inline banner (iteration 0021 § 2.0b).
  const eventConciergeRow = event as typeof event & {
    concierge_status?: ConciergeStatus | null;
    concierge_activated_at?: string | null;
    concierge_expires_at?: string | null;
    concierge_long_engagement_advised_at?: string | null;
  };
  const conciergeStatus: ConciergeStatus = eventConciergeRow.concierge_status ?? 'diy';
  const conciergeEnforcementLevel: ConciergeEnforcementLevel =
    ((profile as { concierge_enforcement_level?: ConciergeEnforcementLevel } | null)
      ?.concierge_enforcement_level ?? 'none');
  const conciergeTrialUsedAt =
    (profile as { concierge_trial_used_at?: string | null } | null)
      ?.concierge_trial_used_at ?? null;

  // Long-engagement advisory one-shot stamp (per HANDOFF_2026-05-17 § 3 +
  // iteration 0016 § 0). If active Concierge AND wedding > activated + 24mo
  // AND not yet stamped, stamp now so the advisory only fires once per event.
  if (
    conciergeStatus === 'active' &&
    eventConciergeRow.concierge_activated_at &&
    event.event_date &&
    !eventConciergeRow.concierge_long_engagement_advised_at &&
    isWeddingBeyondConciergeCap(
      eventConciergeRow.concierge_activated_at,
      event.event_date,
    )
  ) {
    void adminClient
      .from('events')
      .update({ concierge_long_engagement_advised_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .is('concierge_long_engagement_advised_at', null)
      .then(() => undefined);
  }

  return (
    <section className="space-y-8">
      <EventDayPrepCta eventId={eventId} eventDate={event.event_date} />
      <AutoPreloadOnEventDay eventId={eventId} eventDate={event.event_date} />
      {dayOfActive ? (
        <DayOfModeGrid
          eventId={eventId}
          blocks={dayOfBlocks.map((b) => ({
            block_id: b.block_id,
            label: b.label,
            start_at: b.start_at,
            end_at: b.end_at,
            location: b.location,
          }))}
          headTable={dayOfHeadTable}
          nearbyTables={dayOfNearbyTables}
        />
      ) : null}

      <ConciergeBanner
        eventId={eventId}
        status={conciergeStatus}
        expiresAt={eventConciergeRow.concierge_expires_at ?? null}
        activatedAt={eventConciergeRow.concierge_activated_at ?? null}
        weddingDate={event.event_date}
        longEngagementAdvisedAt={eventConciergeRow.concierge_long_engagement_advised_at ?? null}
        enforcementLevel={conciergeEnforcementLevel}
        trialUsedAt={conciergeTrialUsedAt}
        trialResultStatus={search.concierge_trial ?? null}
      />

      <WelcomeHeader
        greeting={greeting}
        name={greetingName}
        eventName={event.display_name}
        eventDate={event.event_date}
        daysOut={daysOut}
      />

      <StageStrip stage={stage} />

      <NextTasksCarousel tasks={nextTasks} tr={tr} />

      {plannerMode === 'guided' ? (
        <Checklist eventId={eventId} statuses={stepStatuses} tr={tr} />
      ) : null}

      <NavGrid eventId={eventId} stats={stats} unreadCount={unreadCount} tr={tr} />

      <ActivityFeed activity={activity} eventId={eventId} tr={tr} />
    </section>
  );
}

function isWeddingBeyondConciergeCap(activatedIso: string, weddingIso: string): boolean {
  const activated = new Date(activatedIso);
  const wedding = new Date(weddingIso);
  if (Number.isNaN(activated.getTime()) || Number.isNaN(wedding.getTime())) return false;
  const cap = new Date(activated);
  cap.setMonth(cap.getMonth() + 24);
  return wedding.getTime() > cap.getTime();
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
    <header className="space-y-1.5">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{eventName}</h1>
      <p className="text-base text-ink/75">
        {greeting}, {name}
      </p>
      <p className="text-sm text-ink/55">
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
  const foundIndex = STAGES.findIndex((s) => s.key === stage);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;
  const activeLabel = STAGES[activeIndex]?.label ?? STAGES[0]?.label ?? '';
  return (
    <div className="space-y-2">
      <ol className="flex w-full items-center gap-1.5" aria-label="Wedding stage progress">
        {STAGES.map((s, i) => {
          const done = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-1.5">
              <span
                aria-current={isActive ? 'step' : undefined}
                aria-label={s.label}
                className={`block h-1.5 flex-1 rounded-full transition-colors ${
                  isActive
                    ? 'bg-terracotta'
                    : done
                      ? 'bg-terracotta/45'
                      : 'bg-ink/10'
                }`}
              />
            </li>
          );
        })}
      </ol>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Stage {activeIndex + 1} of {STAGES.length} · <span className="text-ink/85">{activeLabel}</span>
      </p>
    </div>
  );
}

function NextTasksCarousel({
  tasks,
  tr,
}: {
  tasks: NextTask[];
  tr: (key: TranslationKey) => string;
}) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="next-tasks-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="next-tasks-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {tr('section.next_tasks')}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
          {tasks.length}
        </span>
      </div>
      <ol className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {tasks.map((t, i) => {
          const featured = i === 0;
          return (
            <li
              key={t.id}
              className="w-[86%] shrink-0 snap-start sm:w-[48%] lg:w-[31%]"
            >
              <Link
                href={t.href}
                className={`group flex h-full flex-col justify-between gap-4 rounded-2xl border p-5 transition-colors ${
                  featured
                    ? 'border-terracotta/30 bg-terracotta/5 hover:border-terracotta hover:bg-terracotta/10'
                    : 'border-ink/10 bg-cream hover:border-ink/20 hover:bg-ink/[0.03]'
                }`}
              >
                <div className="space-y-1.5">
                  <p
                    className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                      featured ? 'text-terracotta' : 'text-ink/45'
                    }`}
                  >
                    {i + 1} of {tasks.length}
                  </p>
                  <h3 className="text-base font-semibold leading-snug tracking-tight">
                    {t.title}
                  </h3>
                  <p className="text-sm text-ink/65">{t.body}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    featured ? 'text-terracotta' : 'text-ink/70'
                  }`}
                >
                  {t.cta}
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NavGrid({
  eventId,
  stats,
  unreadCount,
  tr,
}: {
  eventId: string;
  stats: { total: number; attending: number; pending: number };
  unreadCount: number;
  tr: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        {tr('section.plan')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {TILES.map((tile) => {
          const { Icon } = tile;
          const counter =
            tile.key === 'guests' && stats.total > 0
              ? `${stats.attending}/${stats.total} attending`
              : tile.key === 'guests' && stats.pending > 0
                ? `${stats.pending} pending`
                : tile.key === 'notifications' && unreadCount > 0
                  ? `${unreadCount} unread`
                  : null;
          const showBadge = tile.key === 'notifications' && unreadCount > 0;
          return (
            <li key={tile.key}>
              <Link
                href={tile.href(eventId)}
                className="flex h-full flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-3 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 sm:gap-3 sm:p-4"
              >
                <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta sm:h-10 sm:w-10">
                  <Icon aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />
                  {showBadge ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-terracotta px-1 font-mono text-[9px] font-semibold text-cream">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-semibold text-ink sm:text-sm">
                  {tr(tile.labelKey)}
                </span>
                {counter ? (
                  <span className="text-[10px] text-ink/55 sm:text-xs">{counter}</span>
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
  tr,
}: {
  eventId: string;
  statuses: StepStatus[];
  tr: (key: TranslationKey) => string;
}) {
  const progress = plannerProgress(statuses);
  const byKey = new Map(statuses.map((s) => [s.key, s]));
  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {tr('section.concierge')}
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

function ActivityFeed({
  activity,
  eventId,
  tr,
}: {
  activity: ActivityItem[];
  eventId: string;
  tr: (key: TranslationKey) => string;
}) {
  if (activity.length === 0) {
    return (
      <section aria-labelledby="recent-activity-heading" className="space-y-3">
        <h2
          id="recent-activity-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {tr('section.recent_activity')}
        </h2>
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          Nothing yet. Add a guest, book a vendor, or place an order — it&rsquo;ll show up here.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="recent-activity-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="recent-activity-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {tr('section.recent_activity')}
        </h2>
        <Link
          href={`/dashboard/${eventId}/activity`}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta hover:text-terracotta-700"
        >
          {tr('cta.see_all')}
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-1">
        {activity.map((a) => (
          <li key={a.id}>
            <Link
              href={a.href}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-terracotta/5"
            >
              <span className="truncate text-ink/80">{a.description}</span>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
                {relativeTime(a.at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
