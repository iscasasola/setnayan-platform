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
  UserPlus,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { countUnread } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { fetchEventActivity } from '@/lib/activity';
import { fetchAttributedActivity } from '@/lib/activity-attribution';
import {
  formatEventDateWithPrecision,
  formatEventCountdown,
  type EventDatePrecision,
} from '@/lib/events';
import {
  getCommonAvailableDays,
  rangeFromPrecision,
  formatDayKey,
} from '@/lib/vendor-availability';
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
import { PlanningGroups } from './_components/planning-groups';
import { EventDateInput } from './_components/event-date-input';
import { AuspiciousChip } from './_components/auspicious-chip';
import { VendorAvailabilityIntersection } from './_components/vendor-availability-intersection';
import { CeremonyTypeChip } from './_components/ceremony-type-chip';
import { BudgetCountdownHeader } from './_components/budget-countdown-header';
import { FinalizedChipStrip } from './_components/finalized-chip-strip';
import { UsefulRightNow } from './_components/useful-right-now';
import { UpcomingSchedules, type UpcomingItem } from './_components/upcoming-schedules';
import { ActivityFeed } from './_components/activity-feed';
import { getConfirmedVendorCount, isEventDateInPast } from '@/lib/events';
import type { VendorCategory } from '@/lib/vendors';

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
  | 'hosts'
  | 'guests'
  | 'invitation'
  | 'vendors'
  | 'contracts'
  | 'budget'
  | 'messages'
  | 'seating'
  | 'schedule'
  | 'add_ons'
  | 'mood_board'
  | 'orders'
  | 'notifications'
  | 'disputes';

const TILES: Array<{
  key: TileKey;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  href: (eventId: string) => string;
}> = [
  { key: 'hosts', labelKey: 'nav.hosts', Icon: UserPlus, href: (id) => `/dashboard/${id}/hosts` },
  { key: 'guests', labelKey: 'nav.guests', Icon: Users, href: (id) => `/dashboard/${id}/guests` },
  {
    key: 'invitation',
    labelKey: 'nav.invitation',
    Icon: Send,
    href: (id) => `/dashboard/${id}/invitation`,
  },
  {
    key: 'vendors',
    labelKey: 'nav.vendors',
    Icon: Briefcase,
    href: (id) => `/dashboard/${id}/vendors`,
  },
  {
    key: 'contracts',
    labelKey: 'nav.contracts',
    Icon: FileSignature,
    href: (id) => `/dashboard/${id}/contracts`,
  },
  { key: 'budget', labelKey: 'nav.budget', Icon: Wallet, href: (id) => `/dashboard/${id}/budget` },
  {
    key: 'messages',
    labelKey: 'nav.messages',
    Icon: MessageSquare,
    href: (id) => `/dashboard/${id}/messages`,
  },
  {
    key: 'seating',
    labelKey: 'nav.seating',
    Icon: LayoutGrid,
    href: (id) => `/dashboard/${id}/seating`,
  },
  {
    key: 'schedule',
    labelKey: 'nav.schedule',
    Icon: CalendarClock,
    href: (id) => `/dashboard/${id}/schedule`,
  },
  { key: 'orders', labelKey: 'nav.orders', Icon: Receipt, href: (id) => `/dashboard/${id}/orders` },
  {
    key: 'notifications',
    labelKey: 'nav.notifications',
    Icon: Bell,
    href: () => `/dashboard/notifications`,
  },
  {
    key: 'mood_board',
    labelKey: 'nav.mood_board',
    Icon: Palette,
    href: (id) => `/dashboard/${id}/add-ons/mood-board`,
  },
  {
    key: 'add_ons',
    labelKey: 'nav.add_ons',
    Icon: Sparkles,
    href: (id) => `/dashboard/${id}/add-ons`,
  },
  {
    key: 'disputes',
    labelKey: 'nav.disputes',
    Icon: AlertTriangle,
    href: (id) => `/dashboard/${id}/disputes`,
  },
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
  // Companion sweep for non-Concierge subscription SKUs (Task #23 — pilot
  // blocker). Scoped by eventId so couple-dashboard renders only sweep this
  // event's orders, keeping the hot path fast.
  void sweepLapsedSubscriptions(adminClient, { eventId });

  const [
    eventRes,
    profileRes,
    guests,
    manualSteps,
    unreadCount,
    locale,
    eventVendorsRes,
    confirmedVendorCount,
    // V1 pilot Home v2 — owner directive 2026-05-22.
    // Five extra reads feed the new home sections + the attributed
    // activity lane. Every query is RLS-scoped to the host's events;
    // they ride the same Promise.all so the home-page request stays
    // one round trip wide.
    moodBoardSavesRes,
    seatAssignmentsRes,
    vendorThreadsRes,
    upcomingBlocksRes,
    paidOrdersRes,
  ] =
    await Promise.all([
      supabase
        .from('events')
        .select(
          'event_id, display_name, event_date, event_date_precision, slug, venue_name, venue_latitude, venue_longitude, monogram_text, palette_finalized_at, concierge_status, concierge_tier, concierge_activated_at, concierge_expires_at, concierge_long_engagement_advised_at, event_type, ceremony_type, ceremony_type_locked_at, venue_setting, estimated_budget_centavos, date_status, auspicious_reasons',
        )
        .eq('event_id', eventId)
        .maybeSingle(),
      supabase
        .from('users')
        .select('display_name, planner_mode, concierge_trial_used_at, concierge_enforcement_level')
        .eq('user_id', user.id)
        .maybeSingle(),
      fetchGuestsByEvent(supabase, eventId),
      fetchManualStepCompletions(supabase, eventId),
      countUnread(supabase, user.id),
      getLocale(),
      // 12-group planner needs every saved vendor for this event, bucketed
      // by category. RLS already restricts to couples on this event.
      //
      // PR B 2026-05-22 — adds `marketplace_vendor_id` + `source_venue_directory_id`
      // so the compatibility-mismatch check downstream can resolve the
      // picked vendor's `compatible_ceremony_types[]` /
      // `compatible_venue_settings[]` arrays against the host's current
      // events.ceremony_type / events.venue_setting. Two follow-up batch
      // queries against vendor_profiles + venue_directory enrich each
      // row with its compat arrays before bucketVendorsByGroup runs.
      supabase
        .from('event_vendors')
        .select(
          'vendor_id, vendor_name, category, status, total_cost_php, deposit_paid_php, notes, contact_email, contact_phone, marketplace_vendor_id, source_venue_directory_id',
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      // Task #37 — confirmed-vendor count drives the date-edit + ceremony-
      // type-edit lock state on event home. Same RLS scope as the vendors
      // query above; getConfirmedVendorCount returns 0 on error so a
      // count failure never blocks the dashboard render.
      getConfirmedVendorCount(supabase, eventId),
      // Mood Board save count — fuels the UsefulRightNow tile subtitle.
      supabase
        .from('event_moodboard_saves')
        .select('save_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      // Seat assignments — fuels the UsefulRightNow Seat Plan subtitle.
      supabase
        .from('event_seat_assignments')
        .select('assignment_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      // Vendor chat threads — Inbox tile proxy until read-receipt
      // tracking lands. Counts active threads on this event regardless
      // of read state; the polite-voice subtitle works either way.
      supabase
        .from('chat_threads')
        .select('thread_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      // Next 5 upcoming schedule blocks — fuels UpcomingSchedules.
      supabase
        .from('event_schedule_blocks')
        .select('block_id, label, start_at, end_at, location, block_type')
        .eq('event_id', eventId)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(5),
      // Paid + fulfilled orders — fuels BudgetCountdownHeader's
      // "committed" number. Pulled separately from the cart UI flow
      // because home only needs the aggregate, not the line items.
      supabase
        .from('orders')
        .select('order_id, requested_total_php, confirmed_total_php, status')
        .eq('event_id', eventId)
        .in('status', ['paid', 'fulfilled']),
    ]);
  const tr = makeT(locale);

  const event = eventRes.data;
  if (!event) notFound();

  const profile = profileRes.data;
  const stats = computeGuestStats(guests);
  const now = new Date();
  // Task #39 (2026-05-22) — event_date_precision drives display + intersection.
  // Default 'year' for any pre-migration rows that somehow reach here without
  // the column populated; the migration backfills, so in practice this only
  // gates the prop type.
  const eventDatePrecision: EventDatePrecision =
    (event as { event_date_precision?: EventDatePrecision | null }).event_date_precision ?? 'year';
  // Stage + countdown only meaningful when the host has narrowed to day
  // precision. Year/month modes are early-planning states where the
  // numerical days-out is misleading (the placeholder date is the 1st of
  // the range, not the actual day).
  const daysOut =
    eventDatePrecision === 'day' ? daysUntil(event.event_date) : null;
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

  const greetingName = profile?.display_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';
  const greeting = tr(timeOfDayGreetingKey(now));

  const eventVendorsRaw = (eventVendorsRes.data ?? []) as Array<{
    vendor_id: string;
    vendor_name: string;
    category: VendorCategory;
    status: string | null;
    total_cost_php: number | string | null;
    deposit_paid_php: number | string | null;
    notes: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    marketplace_vendor_id: string | null;
    source_venue_directory_id: string | null;
  }>;

  // PR B 2026-05-22 — enrich each event_vendor row with the compatibility
  // arrays from its linked vendor_profiles row (when
  // `marketplace_vendor_id` is set) OR its linked venue_directory row
  // (when `source_venue_directory_id` is set + no marketplace link). Two
  // batch queries — one IN(...) per linked table — collapse all the
  // needed lookups into 2 round trips even for events with 50+ picks.
  // Off-platform / custom rows (both FKs null) skip the enrichment and
  // get null compat arrays, which `computeCompatibilityIssue` treats as
  // "no data to check" and returns null for. Mirrors the data-flow
  // pattern in `venue-recommendations.ts`.
  const marketplaceIds = Array.from(
    new Set(
      eventVendorsRaw
        .map((v) => v.marketplace_vendor_id)
        .filter((id): id is string => id !== null),
    ),
  );
  const directoryIds = Array.from(
    new Set(
      eventVendorsRaw
        .map((v) => v.source_venue_directory_id)
        .filter((id): id is string => id !== null),
    ),
  );

  const compatibilityFetches = await Promise.all([
    marketplaceIds.length > 0
      ? adminClient
          .from('vendor_profiles')
          .select(
            'vendor_profile_id, compatible_ceremony_types, compatible_venue_settings',
          )
          .in('vendor_profile_id', marketplaceIds)
      : Promise.resolve({ data: [] as Array<{
          vendor_profile_id: string;
          compatible_ceremony_types: string[] | null;
          compatible_venue_settings: string[] | null;
        }> }),
    directoryIds.length > 0
      ? adminClient
          .from('venue_directory')
          .select('venue_directory_id, compatible_ceremony_types')
          .in('venue_directory_id', directoryIds)
      : Promise.resolve({ data: [] as Array<{
          venue_directory_id: string;
          compatible_ceremony_types: string[] | null;
        }> }),
  ]);
  const marketplaceCompatMap = new Map<
    string,
    { ceremony: string[] | null; venue: string[] | null }
  >();
  for (const row of compatibilityFetches[0].data ?? []) {
    marketplaceCompatMap.set(row.vendor_profile_id, {
      ceremony: (row.compatible_ceremony_types as string[] | null) ?? null,
      venue: (row.compatible_venue_settings as string[] | null) ?? null,
    });
  }
  const directoryCompatMap = new Map<string, string[] | null>();
  for (const row of compatibilityFetches[1].data ?? []) {
    directoryCompatMap.set(
      row.venue_directory_id,
      (row.compatible_ceremony_types as string[] | null) ?? null,
    );
  }

  const eventVendors = eventVendorsRaw.map((v) => {
    const marketplace = v.marketplace_vendor_id
      ? marketplaceCompatMap.get(v.marketplace_vendor_id)
      : undefined;
    const directory = v.source_venue_directory_id
      ? directoryCompatMap.get(v.source_venue_directory_id) ?? null
      : null;
    return {
      ...v,
      marketplace_compatible_ceremony_types: marketplace?.ceremony ?? null,
      marketplace_compatible_venue_settings: marketplace?.venue ?? null,
      directory_compatible_ceremony_types: directory,
    };
  });

  const eventCeremonyType =
    (event as { ceremony_type?: string | null }).ceremony_type ?? null;
  const eventVenueSetting =
    (event as { venue_setting?: string | null }).venue_setting ?? null;

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
    // The canonical 2026-05-09 catalog replaces the variable-capacity 'head_table'
    // with three fixed family_head_12/14/16 variants. Day-of UI keeps surfacing
    // a single "head table" by picking the first family_head_* row found.
    dayOfHeadTable = tables.find((t) => t.table_type.startsWith('family_head_')) ?? null;
    dayOfNearbyTables = tables.filter((t) => t.table_id !== dayOfHeadTable?.table_id).slice(0, 6);
  }

  // Task #39 (2026-05-22) — vendor calendar intersection. Renders only at
  // year/month precision with ≥1 confirmed vendor. Errors return an empty
  // result so the dashboard never crashes on a calendar-query failure.
  let availabilityDays: string[] = [];
  let availabilityTotalDays = 0;
  let availabilityVendorCount = 0;
  let availabilityWindowLabel = '';
  if (
    (eventDatePrecision === 'year' || eventDatePrecision === 'month') &&
    confirmedVendorCount > 0 &&
    event.event_date
  ) {
    const range = rangeFromPrecision(event.event_date, eventDatePrecision);
    if (range) {
      try {
        const result = await getCommonAvailableDays(supabase, eventId, range.start, range.end);
        availabilityDays = result.availableDays.map(formatDayKey);
        availabilityTotalDays = result.totalDaysInRange;
        availabilityVendorCount = result.confirmedVendorCount;
        availabilityWindowLabel = formatEventDateWithPrecision(
          event.event_date,
          eventDatePrecision,
        ).replace(/^Sometime in /, '');
      } catch {
        // Stay silent on errors — the dashboard renders the date input
        // without the intersection panel, which is the safe default.
      }
    }
  }

  // V1 pilot Home v2 — parallel fetches for the source activity feed
  // + the new attributed lane (event_action_log). Attribution silently
  // returns [] when the table has no rows for this event OR a join
  // fails, so the source feed always renders.
  const [activity, attributedActivity] = await Promise.all([
    fetchEventActivity(supabase, eventId, 20),
    fetchAttributedActivity(adminClient, eventId, user.id, 20),
  ]);

  // Derived counts for the new Home v2 sections.
  const moodBoardSaveCount = moodBoardSavesRes.count ?? 0;
  const seatedGuests = seatAssignmentsRes.count ?? 0;
  const vendorThreadCount = vendorThreadsRes.count ?? 0;

  // "Committed" budget signal: paid + fulfilled orders + every
  // contracted-or-better event_vendors row whose total_cost_php is
  // known. The result is in PHP centavos so the BudgetCountdownHeader
  // can format it consistently with future cart line items.
  const paidOrdersTotalPhp = (paidOrdersRes.data ?? []).reduce<number>((acc, row) => {
    const r = row as { requested_total_php: number | string | null; confirmed_total_php: number | string | null };
    const confirmed = r.confirmed_total_php !== null ? Number(r.confirmed_total_php) : null;
    const requested = r.requested_total_php !== null ? Number(r.requested_total_php) : null;
    const amount = confirmed ?? requested ?? 0;
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const contractedVendorsTotalPhp = eventVendorsRaw.reduce<number>((acc, row) => {
    const status = row.status ?? '';
    if (
      status !== 'contracted' &&
      status !== 'deposit_paid' &&
      status !== 'delivered' &&
      status !== 'complete'
    ) {
      return acc;
    }
    const cost = row.total_cost_php !== null ? Number(row.total_cost_php) : 0;
    return acc + (Number.isFinite(cost) ? cost : 0);
  }, 0);
  const committedCentavos = Math.round((paidOrdersTotalPhp + contractedVendorsTotalPhp) * 100);

  // Target budget — populated by the Budget Setter at
  // /dashboard/[eventId]/budget (migration 20260604030000 added the
  // events.estimated_budget_centavos column). Defensive optional read
  // in case a fresh deploy lands the SELECT before the migration
  // applies in production; NULL surfaces the "Set your budget" CTA in
  // BudgetCountdownHeader without crashing the page.
  const eventBudgetCentavos =
    (event as { estimated_budget_centavos?: number | null }).estimated_budget_centavos ?? null;

  // Upcoming schedule blocks — already filtered server-side to future
  // rows + limited to 5. Type the shape for the component prop.
  const upcomingItems: UpcomingItem[] = (upcomingBlocksRes.data ?? []).map((row) => {
    const r = row as {
      block_id: string;
      label: string;
      start_at: string;
      end_at: string | null;
      location: string | null;
      block_type: UpcomingItem['block_type'];
    };
    return {
      block_id: r.block_id,
      label: r.label,
      start_at: r.start_at,
      end_at: r.end_at,
      location: r.location,
      block_type: r.block_type,
    };
  });

  // Concierge state for the inline banner (iteration 0021 § 2.0b).
  const eventConciergeRow = event as typeof event & {
    concierge_status?: ConciergeStatus | null;
    concierge_activated_at?: string | null;
    concierge_expires_at?: string | null;
    concierge_long_engagement_advised_at?: string | null;
  };
  const conciergeStatus: ConciergeStatus = eventConciergeRow.concierge_status ?? 'diy';
  const conciergeEnforcementLevel: ConciergeEnforcementLevel =
    (profile as { concierge_enforcement_level?: ConciergeEnforcementLevel } | null)
      ?.concierge_enforcement_level ?? 'none';
  const conciergeTrialUsedAt =
    (profile as { concierge_trial_used_at?: string | null } | null)?.concierge_trial_used_at ??
    null;

  // Long-engagement advisory one-shot stamp (per HANDOFF_2026-05-17 § 3 +
  // iteration 0016 § 0). If active Concierge AND wedding > activated + 24mo
  // AND not yet stamped, stamp now so the advisory only fires once per event.
  if (
    conciergeStatus === 'active' &&
    eventConciergeRow.concierge_activated_at &&
    event.event_date &&
    !eventConciergeRow.concierge_long_engagement_advised_at &&
    isWeddingBeyondConciergeCap(eventConciergeRow.concierge_activated_at, event.event_date)
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
        eventDatePrecision={eventDatePrecision}
        now={now}
      />

      {/* Phase 0 Date Selection entry point — CLAUDE.md 2026-05-22 lock.
       *  Renders one of two states based on events.date_status:
       *    - 'locked' → shows the host's chosen date + invitation to
       *      review the auspicious reasoning at /date-selection.
       *    - other   → soft "Pick your date" prompt routing to /date-selection.
       *  See _components/auspicious-chip.tsx + date-selection/page.tsx. */}
      <AuspiciousChip
        eventId={eventId}
        eventDate={event.event_date}
        dateStatus={(event as { date_status?: string | null }).date_status ?? null}
      />

      <div className="space-y-2">
        <EventDateInput
          eventId={eventId}
          initial={event.event_date ?? null}
          initialPrecision={eventDatePrecision}
          confirmedVendorCount={confirmedVendorCount}
        />
        {event.event_date && isEventDateInPast(event.event_date, eventDatePrecision, now) ? (
          // Task #41 (2026-05-22) — muted warning when the stored wedding
          // date is already in the past (e.g. the "Bonbon and Chihuahua"
          // event that originally surfaced this bug). Editorial-restraint
          // tone per brand voice — no exclamation marks, no red panic
          // styling, no all-caps. The Edit button on EventDateInput above
          // still works to fix the value.
          <p className="flex items-center gap-1.5 text-xs text-ink/55">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Wedding date is in the past — please update.
          </p>
        ) : null}
        {availabilityVendorCount > 0 && availabilityWindowLabel ? (
          <VendorAvailabilityIntersection
            eventId={eventId}
            availableDays={availabilityDays}
            confirmedVendorCount={availabilityVendorCount}
            windowLabel={availabilityWindowLabel}
            totalDaysInRange={availabilityTotalDays}
          />
        ) : null}
        <CeremonyTypeChip
          eventId={eventId}
          eventType={(event as { event_type?: string | null }).event_type ?? 'wedding'}
          ceremonyType={(event as { ceremony_type?: string | null }).ceremony_type ?? null}
          ceremonyTypeLockedAt={
            (event as { ceremony_type_locked_at?: string | null }).ceremony_type_locked_at ?? null
          }
          confirmedVendorCount={confirmedVendorCount}
        />
      </div>

      <StageStrip stage={stage} />

      {/* V1 pilot Home v2 — owner directive 2026-05-22.
       *  BudgetCountdownHeader + FinalizedChipStrip sit between the
       *  StageStrip and the 12-card PlanningGroups so the host sees
       *  their countdown + money state + locked vendors before they
       *  scroll into category-by-category planning. */}
      <BudgetCountdownHeader
        eventDate={event.event_date}
        eventDatePrecision={eventDatePrecision}
        targetCentavos={eventBudgetCentavos}
        committedCentavos={committedCentavos}
        settingsHref={`/dashboard/${eventId}/budget`}
        now={now}
      />

      <FinalizedChipStrip eventId={eventId} vendors={eventVendorsRaw} />

      <PlanningGroups
        eventId={eventId}
        eventDate={event.event_date}
        venueLatitude={(event as { venue_latitude?: number | null }).venue_latitude ?? null}
        venueLongitude={(event as { venue_longitude?: number | null }).venue_longitude ?? null}
        ceremonyType={eventCeremonyType}
        venueSetting={eventVenueSetting}
        vendors={eventVendors}
      />

      {plannerMode === 'guided' ? (
        <Checklist eventId={eventId} statuses={stepStatuses} tr={tr} />
      ) : null}

      <NavGrid eventId={eventId} stats={stats} unreadCount={unreadCount} tr={tr} />

      {/* V1 pilot Home v2 — owner directive 2026-05-22.
       *  UsefulRightNow + UpcomingSchedules sit between the 14-tile
       *  NavGrid and the activity feed. The 2×2 toolkit fast-routes
       *  to the four surfaces hosts return to most; the upcoming
       *  schedule strip surfaces the next handful of day-of timeline
       *  blocks so the host doesn't have to click into the schedule
       *  surface for a quick "what's next" glance. */}
      <UsefulRightNow
        eventId={eventId}
        moodBoardSaveCount={moodBoardSaveCount}
        totalGuests={stats.total}
        seatedGuests={seatedGuests}
        vendorThreadCount={vendorThreadCount}
      />

      <UpcomingSchedules eventId={eventId} items={upcomingItems} now={now} />

      <ActivityFeed
        eventId={eventId}
        sourceActivity={activity}
        attributedActivity={attributedActivity}
        headingLabel={tr('section.recent_activity')}
        seeAllLabel={tr('cta.see_all')}
      />
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
  eventDatePrecision,
  now,
}: {
  greeting: string;
  name: string;
  eventName: string;
  eventDate: string | null;
  eventDatePrecision: EventDatePrecision;
  now: Date;
}) {
  // Task #39 (2026-05-22) — precision-aware display + countdown.
  const pretty = eventDate
    ? formatEventDateWithPrecision(eventDate, eventDatePrecision)
    : 'Date to be confirmed';
  const countdown = formatEventCountdown(eventDate, eventDatePrecision, now);
  return (
    <header className="space-y-1.5">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{eventName}</h1>
      <p className="text-base text-ink/75">
        {greeting}, {name}
      </p>
      <p className="text-sm text-ink/55">
        {pretty}
        {countdown ? ` · ${countdown}` : null}
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
                  isActive ? 'bg-terracotta' : done ? 'bg-terracotta/45' : 'bg-ink/10'
                }`}
              />
            </li>
          );
        })}
      </ol>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Stage {activeIndex + 1} of {STAGES.length} ·{' '}
        <span className="text-ink/85">{activeLabel}</span>
      </p>
    </div>
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
        <span className="font-mono text-sm font-semibold text-terracotta-700">{progress.pct}%</span>
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
            <li key={step.key} className="flex items-start gap-3 px-3 py-3 sm:px-4">
              {step.source === 'manual' ? (
                <form action={toggleJourneyStep}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="step_key" value={step.key} />
                  <input type="hidden" name="action" value={done ? 'uncomplete' : 'complete'} />
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

// ActivityFeed moved to ./_components/activity-feed.tsx as part of
// the V1 pilot Home v2 refactor (2026-05-22). The shared component
// renders both the existing source feed AND the attributed lane.
