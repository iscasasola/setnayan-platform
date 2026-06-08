import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Send,
  ArrowRight,
  Briefcase,
  Sparkles,
  MessageSquare,
  Receipt,
  Bell,
  FileSignature,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Square,
  QrCode,
  HardHat,
  type LucideIcon,
} from 'lucide-react';
import { countUnread } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { isSetnayanAiActive } from '@/lib/setnayan-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
// fetchEventActivity + fetchAttributedActivity moved into ActivityFeedAsync
// (2026-05-30 Phase 2 — Suspense streaming · see _components/activity-feed-async.tsx
// + CLAUDE.md 2026-05-30 row). Page no longer awaits these — the activity feed
// streams in independently after the shell.
import {
  formatEventDateWithPrecision,
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
// TodaysOneThing legacy component lives at ./_components/todays-one-thing.tsx
// and the lib helpers (pickTodaysOneThing / countUnlockedCategories) live at
// @/lib/todays-one-thing — both retained on disk as a quick-revert path
// while the Setnayan AI wizard (originally branded Concierge in V1; V2
// cutover 2026-05-28 renamed the surface · iteration 0016 substrate
// unchanged · CLAUDE.md Sixth 2026-05-23 row · Phase 1 PR #467) replaces
// this surface.
//
// WizardHero import REMOVED 2026-05-24: the wizard surface MOVED to its
// own /dashboard/[eventId]/today route + first BottomNav tab "Today"
// per owner directive. Event-home no longer renders <WizardHero> inline.
// If a future iteration needs to surface the wizard back on event-home
// (e.g., a compact peek-card variant), re-add the import here and the
// JSX in the section where the comment placeholder lives.
// pickTodaysOneThing + countUnlockedCategories lib helpers retained at
// @/lib/todays-one-thing for the quick-revert path. Unused here now that
// the wizard owns the Setnayan AI surface (on /today, not event-home).
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
import { MarketplaceTeaseStrip } from './_components/marketplace-tease-strip';
// Finder-column scaffolding (EventHomeSplitView + EventHomeDetailPane +
// CardSelectable + ?card=<id> URL state) retired 2026-05-23 per owner
// directive — event home renders as a single column on every
// breakpoint. The 2-col master-detail split shipped via PR #367/#384
// caused mobile-shape cramping on the LEFT pane (max 420px) and the
// duplicated content on the RIGHT pane didn't earn its weight. The
// underlying split-pane primitive lives on in the lg desktop sidebar
// (bottom-nav.tsx + sidebar-resize-handle.tsx) — those usages are
// unchanged.
import { buildCrossCategoryRecommendations, PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  summarize as summarizePaperwork,
  type PaperworkRow,
} from '@/lib/paperwork';
import { AuspiciousChip } from './_components/auspicious-chip';
import { EventCountdownHeader } from './_components/event-countdown-header';
import { countUnlockedCategories } from '@/lib/todays-one-thing';
import {
  WeddingRoadmapAsync,
  WeddingRoadmapSkeleton,
} from './_components/wedding-roadmap-async';
import { EventMetaLine } from './_components/event-meta-line';
import { VendorAvailabilityIntersection } from './_components/vendor-availability-intersection';
import { BudgetCountdownHeader } from './_components/budget-countdown-header';
import { FinalizedChipStrip } from './_components/finalized-chip-strip';
// MoneyInFlight + UpcomingSchedules + ActivityFeed renders now sit inside
// Suspense boundaries via their async wrappers (2026-05-30 Phase 2 — see
// CLAUDE.md 2026-05-30 row). Each wrapper does its own fetch and the
// shell streams in immediately while the panels resolve independently.
import { Suspense } from 'react';
import {
  UpcomingSchedulesAsync,
  UpcomingSchedulesSkeleton,
} from './_components/upcoming-schedules-async';
import {
  ActivityFeedAsync,
  ActivityFeedSkeleton,
} from './_components/activity-feed-async';
import { YourPlanSection } from './_components/your-plan-section';
import { getConfirmedVendorCount, isEventDateInPast } from '@/lib/events';
import type { VendorCategory } from '@/lib/vendors';
// Finalized-card-service-photo refinement (2026-05-22) — resolve
// vendor_services.primary_photo_r2_key → public URL for the locked-state
// avatars. r2PublicUrl is synchronous (no signing roundtrip), so we can
// build the URL once per service and feed it through the EventVendor
// enrichment pipeline below. setnayan-media is the canonical bucket for
// vendor portfolio + service media.
import { R2_BUCKETS, r2PublicUrl } from '@/lib/r2';

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
  | 'sponsors'
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
  | 'disputes'
  | 'event_qr'
  | 'manpower';

// Deduped 2026-05-24 (owner directive — "they are repetitive"). The
// 6 tiles previously here (guests · sponsors · budget · seating ·
// schedule · mood_board) are canonical in YourPlanSection ("YOUR PLAN ·
// things you build, not book") which renders ABOVE this grid with live
// status sub-lines. Keep only the navigation-only surfaces that YOUR
// PLAN doesn't cover. Result: 15 tiles → 9, zero overlap with YOUR
// PLAN. The TileKey union still carries the retired keys for backwards
// compat with any external link/route that addresses them by key; the
// TILES array is the only consumer that matters for the home grid.
const TILES: Array<{
  key: TileKey;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  href: (eventId: string) => string;
}> = [
  { key: 'hosts', labelKey: 'nav.hosts', Icon: UserPlus, href: (id) => `/dashboard/${id}/hosts` },
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
  {
    key: 'messages',
    labelKey: 'nav.messages',
    Icon: MessageSquare,
    href: (id) => `/dashboard/${id}/messages`,
  },
  { key: 'orders', labelKey: 'nav.orders', Icon: Receipt, href: (id) => `/dashboard/${id}/orders` },
  {
    key: 'notifications',
    labelKey: 'nav.notifications',
    Icon: Bell,
    href: () => `/dashboard/notifications`,
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
  {
    key: 'event_qr',
    labelKey: 'nav.event_qr',
    Icon: QrCode,
    href: (id) => `/dashboard/${id}/event-qr`,
  },
  {
    // V2 Phase F · Manpower ₱15k offline cash flow · CLAUDE.md 2026-05-28
    // third row § (a). Tile gives the host an entry point to post + manage
    // day-of crew gigs · separate from vendor bookings (which run through
    // marketplace) because the cash flows direct to the vendor's crew.
    key: 'manpower',
    labelKey: 'nav.manpower',
    Icon: HardHat,
    href: (id) => `/dashboard/${id}/manpower`,
  },
];

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

/**
 * Defensive event_vendors fetcher — tries the new
 * `event_vendor_package_id` column first (added 2026-05-22, migration
 * 20260604110000_vendor_packages.sql). If a stale deploy environment
 * hasn't applied that migration yet, the PostgREST query errors with a
 * "column does not exist" message; we fall back to the legacy select
 * without `event_vendor_package_id`, so event home keeps rendering. The
 * "Included in <package>" badge just won't appear until the migration
 * lands. Once the migration is applied, the fallback path is dormant.
 *
 * Mirrors the same pattern `/v/[slug]` uses for the `is_demo` column
 * (PR brief 2026-05-22 evening — marketplace simulation workstream).
 */
type EventVendorsResult = Awaited<
  ReturnType<
    ReturnType<
      Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>['from']
    >['select']
  >
>;

async function fetchEventVendorsRobust(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  eventId: string,
): Promise<EventVendorsResult> {
  // Full select includes both this PR's `event_vendor_package_id` (migration
  // 20260604110000) AND the sibling 22-card-grid PR's
  // `manual_vendor_id, source, source_category` (migration 20260604120000).
  // If the package column is missing in a stale environment, fall back to
  // the wider sibling-only select. If those are missing too, fall back to
  // the legacy pre-2026-05-22 select. Three-tier fallback keeps event
  // home rendering across every migration ordering.
  const fullSelect =
    'vendor_id, vendor_name, category, status, total_cost_php, deposit_paid_php, notes, contact_email, contact_phone, marketplace_vendor_id, source_venue_directory_id, service_id, manual_vendor_id, source, source_category, event_vendor_package_id';
  const siblingOnlySelect =
    'vendor_id, vendor_name, category, status, total_cost_php, deposit_paid_php, notes, contact_email, contact_phone, marketplace_vendor_id, source_venue_directory_id, service_id, manual_vendor_id, source, source_category';
  const legacySelect =
    'vendor_id, vendor_name, category, status, total_cost_php, deposit_paid_php, notes, contact_email, contact_phone, marketplace_vendor_id, source_venue_directory_id, service_id';

  // Cross-category recommendations + finalize cleanup (CLAUDE.md
  // 2026-05-22). Active rows only — archived picks live in DB for audit
  // + potential restore via SwitchVendorConfirm but shouldn't surface on
  // home / bucketing. The `archived_at IS NULL` filter applies to all
  // three select-tiers; if the column itself is missing (pre-archive
  // migration 20260604100000), the .is() filter silently no-ops in
  // PostgREST (returns "column does not exist" which falls through to
  // the next tier).
  const fullResult = await supabase
    .from('event_vendors')
    .select(fullSelect)
    .eq('event_id', eventId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (
    fullResult.error &&
    /event_vendor_package_id/i.test(fullResult.error.message)
  ) {
    const siblingResult = await supabase
      .from('event_vendors')
      .select(siblingOnlySelect)
      .eq('event_id', eventId)
      .is('archived_at', null)
      .order('created_at', { ascending: true });
    if (
      siblingResult.error &&
      /(manual_vendor_id|source_category|source)\b/i.test(siblingResult.error.message)
    ) {
      return supabase
        .from('event_vendors')
        .select(legacySelect)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
    }
    return siblingResult;
  }
  return fullResult;
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
  // `?card=<id>` URL state retired 2026-05-23 alongside the Finder-column
  // split-view. The PlanningGroups grid no longer renders a "selected"
  // ring + the EventHomeDetailPane right column is gone, so there's
  // nothing for the param to drive. Stale bookmarks land cleanly on
  // event home with no UI affordance differences.
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
    paidOrdersRes,
    paperworkRowsRes,
    sponsorsRes,
    scheduleBlocksRes,
    contractsCountRes,
    setnayanCreationOrdersRes,
    manualVendorsRes,
    // Love-quote popup gating (owner directive 2026-05-22). The 5-sec
    // once-per-day popup fires only for hosts whose event_moderators
    // row carries role_subtype ∈ {bride, groom, partner1, partner2}.
    // Other hosts (parents · ninong · ninang · planner · MOH · best
    // man · family_helper · viewer) see nothing — the quote is the
    // couple's intimate daily moment. Returns null when the host has
    // no event_moderators row (legacy event_members 'couple' pattern
    // pre-iteration-0048 backfill); component returns null upstream
    // in that case so legacy events stay calm too.
    viewerModeratorRes,
    // Activity + attributed activity moved into ActivityFeedAsync
    // (2026-05-30 Phase 2 — Suspense streaming). The feed renders as
    // its own Suspense child below so the shell stops blocking on the
    // 2 activity queries; total time-to-data is roughly the same since
    // the new client does both fetches in parallel inside the wrapper.
  ] =
    await Promise.all([
      // Robust events SELECT (owner reported "error in creating an event"
      // 2026-05-23 — global error boundary firing after the create-event
      // redirect). Pre-fix this SELECT listed 22 columns; if ANY of them
      // is missing on prod (migration drift between local + remote), the
      // whole page crashed with "column does not exist" propagating from
      // the server-component render. Fallback pattern mirrors
      // fetchEventVendorsRobust above: try the full explicit list first,
      // fall back to SELECT * on any column-not-found error. Wider net
      // — also catches generic Postgres errors so a transient DB hiccup
      // returns null rather than 500-ing the page.
      (async () => {
        const fullSelect =
          'event_id, display_name, event_date, event_date_precision, slug, venue_name, venue_latitude, venue_longitude, monogram_text, palette_finalized_at, concierge_status, concierge_tier, concierge_activated_at, concierge_expires_at, concierge_long_engagement_advised_at, event_type, ceremony_type, ceremony_type_locked_at, secondary_ceremony_type, venue_setting, estimated_pax, estimated_budget_centavos, region, mood_feel_key, date_mode, date_candidates, date_window_start, date_window_end, style_preferences, date_status, auspicious_reasons, wizard_state, planning_mode, setnayan_ai_active';
        const fullRes = await supabase
          .from('events')
          .select(fullSelect)
          .eq('event_id', eventId)
          .maybeSingle();
        if (
          fullRes.error &&
          /column .* does not exist|undefined_column|42703/i.test(
            (fullRes.error as { message?: string; code?: string }).message ??
              (fullRes.error as { code?: string }).code ??
              '',
          )
        ) {
          // Column missing on prod → migration drift. Fall back to '*'
          // which returns whatever columns the deployed schema has;
          // downstream code already reads columns defensively via the
          // `(event as { ... }).column ?? fallback` pattern.
          return supabase
            .from('events')
            .select('*')
            .eq('event_id', eventId)
            .maybeSingle();
        }
        return fullRes;
      })(),
      // Same defensive pattern on the user row read — adds protection
      // for stale users-table columns. If concierge_* columns or
      // planner_mode are missing, fall back to display_name only.
      (async () => {
        const fullUserSelect =
          'display_name, planner_mode, concierge_trial_used_at, concierge_enforcement_level';
        const fullRes = await supabase
          .from('users')
          .select(fullUserSelect)
          .eq('user_id', user.id)
          .maybeSingle();
        if (
          fullRes.error &&
          /column .* does not exist|undefined_column|42703/i.test(
            (fullRes.error as { message?: string; code?: string }).message ??
              (fullRes.error as { code?: string }).code ??
              '',
          )
        ) {
          return supabase
            .from('users')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
        }
        return fullRes;
      })(),
      // 6th hotfix pass · Path B 2026-05-23 — every remaining query on
      // this Promise.all wrapped in .catch() / IIFE try/catch with a
      // safe default that matches the destination variable's expected
      // shape. Mirrors the defensive pattern already shipped at
      // /dashboard/layout.tsx (PR #452) + /dashboard/[eventId]/layout.tsx
      // (PR #454). Owner reported a brief flash of the global-error
      // boundary BEFORE the event-home content streams in — root cause
      // is migration drift between local + prod (engineering is ahead
      // of prod schema). Path A (owner runs `supabase db push --linked`
      // from setnayan-db-push/) fixes the underlying drift; Path B
      // (this) makes the page never crash even when drift exists, so
      // the boundary flash disappears regardless of when the migration
      // applies. Every catch logs via logQueryError so the next missed
      // schema gap surfaces with the exact call site in Sentry instead
      // of forcing another speculative hotfix pass.
      fetchGuestsByEvent(supabase, eventId).catch((err: unknown) => {
        logQueryError(
          'EventHome (fetchGuestsByEvent threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchGuestsByEvent>>;
      }),
      // fetchManualStepCompletions returns Set<StepKey> — empty Set is
      // the safe default. resolveStepStatuses iterates set.has() so an
      // empty set means "no manual steps marked complete" which is the
      // correct degraded state.
      fetchManualStepCompletions(supabase, eventId).catch((err: unknown) => {
        logQueryError(
          'EventHome (fetchManualStepCompletions threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return new Set() as Awaited<
          ReturnType<typeof fetchManualStepCompletions>
        >;
      }),
      countUnread(supabase, user.id).catch((err: unknown) => {
        logQueryError(
          'EventHome (countUnread threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return 0;
      }),
      Promise.resolve(getLocale()).catch(() => 'en' as const),
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
      //
      // source + source_category (added 2026-05-22, migration
      // 20260604120000_event_vendors_source_tracking) drive the
      // Sparkles badge on auto-cascaded considering picks.
      //
      // event_vendor_package_id (added 2026-05-22, migration
      // 20260604110000_vendor_packages) drives the "Included in
      // <package>" badge on the LockedCard variant. Defensive fetch via
      // fetchEventVendorsRobust falls back to the legacy select when
      // the column is missing on a stale deploy environment.
      // PostgrestSingleResponse-shaped safe default — downstream reads
      // `.data ?? []` so the missing `count / status / statusText`
      // fields are never observed at runtime. Cast through `unknown`
      // because the strict response type carries metadata we don't need
      // for the degraded path.
      fetchEventVendorsRobust(supabase, eventId).catch((err: unknown) => {
        logQueryError(
          'EventHome (fetchEventVendorsRobust threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as unknown as Awaited<
          ReturnType<typeof fetchEventVendorsRobust>
        >;
      }),
      // Task #37 — confirmed-vendor count drives the date-edit + ceremony-
      // type-edit lock state on event home. Same RLS scope as the vendors
      // query above; getConfirmedVendorCount returns 0 on error so a
      // count failure never blocks the dashboard render.
      getConfirmedVendorCount(supabase, eventId).catch((err: unknown) => {
        logQueryError(
          'EventHome (getConfirmedVendorCount threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return 0;
      }),
      // Mood Board save count — fuels the YourPlanSection Mood Board
      // tile subtitle (also fed UsefulRightNow until 2026-05-24 dedupe).
      (async () => {
        try {
          return await supabase
            .from('event_moodboard_saves')
            .select('save_id', { count: 'exact', head: true })
            .eq('event_id', eventId);
        } catch (caught) {
          logQueryError(
            'EventHome (event_moodboard_saves count threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: null, error: null, count: 0 } as never;
        }
      })(),
      // Seat assignments — fuels the YourPlanSection Seat Plan tile
      // subtitle (also fed UsefulRightNow until 2026-05-24 dedupe).
      (async () => {
        try {
          return await supabase
            .from('event_seat_assignments')
            .select('assignment_id', { count: 'exact', head: true })
            .eq('event_id', eventId);
        } catch (caught) {
          logQueryError(
            'EventHome (event_seat_assignments count threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: null, error: null, count: 0 } as never;
        }
      })(),
      // chat_threads count fetch removed 2026-05-24 alongside the
      // UsefulRightNow surface (its only consumer). One fewer DB
      // roundtrip on every home-page render.
      // Paid + fulfilled orders — fuels BudgetCountdownHeader's
      // "committed" number. Pulled separately from the cart UI flow
      // because home only needs the aggregate, not the line items.
      (async () => {
        try {
          return await supabase
            .from('orders')
            .select('order_id, requested_total_php, confirmed_total_php, status')
            .eq('event_id', eventId)
            .in('status', ['paid', 'fulfilled']);
        } catch (caught) {
          logQueryError(
            'EventHome (paid orders SELECT threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: [], error: null } as never;
        }
      })(),
      // Paperwork pipeline rows — fuels the small "📋 Paperwork — X of Y"
      // sub-link rendered on the Ceremony venue plan card. Per CLAUDE.md
      // 2026-05-22 owner directive: surgical sub-link on the existing
      // card, no other home surface impacted. RLS scoped to host via
      // event_moderators; returns [] before the migration lands without
      // crashing thanks to defensive Supabase column-missing semantics.
      (async () => {
        try {
          return await supabase
            .from('event_paperwork')
            .select(
              'id, event_id, document_type, status, requested_at, received_at, expected_completion_date, expires_at, tracking_reference, document_r2_key, notes, created_at, updated_at',
            )
            .eq('event_id', eventId);
        } catch (caught) {
          logQueryError(
            'EventHome (event_paperwork SELECT threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: [], error: null } as never;
        }
      })(),
      // Sponsors — fuels the Next 15 Steps resolver. Picks each tier
      // whose `accepted` count falls short of the cultural minimum
      // (principal = 1+ accepted pair; secondaries = 2 accepted slots
      // each). Read sponsor_tier + invitation_status only — that's all
      // the resolver needs. RLS scoped via event_moderators; returns
      // [] before the migration lands without crashing thanks to
      // defensive Supabase column-missing semantics.
      (async () => {
        try {
          return await supabase
            .from('event_sponsors')
            .select('sponsor_tier, invitation_status')
            .eq('event_id', eventId);
        } catch (caught) {
          logQueryError(
            'EventHome (event_sponsors SELECT threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: [], error: null } as never;
        }
      })(),
      // YOUR PLAN section reads (owner directive 2026-05-22).
      // Schedule blocks count fuels the Schedule tool tile sub-line.
      (async () => {
        try {
          return await supabase
            .from('event_schedule_blocks')
            .select('block_id', { count: 'exact', head: true })
            .eq('event_id', eventId);
        } catch (caught) {
          logQueryError(
            'EventHome (event_schedule_blocks count threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: null, error: null, count: 0 } as never;
        }
      })(),
      // Vendor contracts count (non-draft, RLS already filters). Fuels
      // the Documents tool tile + the consolidated /documents route.
      (async () => {
        try {
          return await supabase
            .from('vendor_contracts')
            .select('contract_id', { count: 'exact', head: true })
            .eq('event_id', eventId);
        } catch (caught) {
          logQueryError(
            'EventHome (vendor_contracts count threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: null, error: null, count: 0 } as never;
        }
      })(),
      // Setnayan creation orders — Save-the-Date Video + Monogram Hero
      // upgrade. Drives the "Saved to your event" sub-line on the
      // Save-the-Date + Monogram tool tiles. Filter to non-cancelled
      // statuses so a cancelled order doesn't lock the CTA to its
      // post-purchase state.
      (async () => {
        try {
          return await supabase
            .from('orders')
            .select('service_key, status')
            .eq('event_id', eventId)
            .in('service_key', ['save_the_date_video', 'monogram_hero_upgrade'])
            .not('status', 'in', '("cancelled","refunded","lapsed")');
        } catch (caught) {
          logQueryError(
            'EventHome (creation orders SELECT threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: [], error: null } as never;
        }
      })(),
      // Manual vendors — host-managed contacts with Photo + Name +
      // Contact Person + Phone, reusable across N planning categories
      // (2026-05-22 owner directive). Read all rows for this event so
      // the home-page card "+ Add" dropdown can list every saved
      // contact, plus we map manual_vendor_id → contact metadata for
      // the existing event_vendors picks that link to manual rows. RLS
      // scoped via event_moderators per migration 20260604080000.
      (async () => {
        try {
          return await supabase
            .from('event_manual_vendors')
            .select(
              'manual_vendor_id, business_name, contact_person, contact_number, photo_r2_key',
            )
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });
        } catch (caught) {
          logQueryError(
            'EventHome (event_manual_vendors SELECT threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: [], error: null } as never;
        }
      })(),
      // Viewer's event_moderators row — drives the love-quote popup
      // visibility gate (owner directive 2026-05-22). Filters by
      // removed_at IS NULL to skip revoked-host rows. RLS scoped via
      // event_moderators per migration 20260519100000. .maybeSingle()
      // returns null when the viewer has no moderator row (legacy
      // event_members 'couple' pattern OR not a moderator at all);
      // the popup component handles null gracefully.
      (async () => {
        try {
          return await supabase
            .from('event_moderators')
            .select('role_subtype')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .is('removed_at', null)
            .maybeSingle();
        } catch (caught) {
          logQueryError(
            'EventHome (event_moderators viewer-row threw)',
            caught instanceof Error ? caught : new Error(String(caught)),
            { event_id: eventId, user_id: user.id },
            'graceful_degrade',
          );
          return { data: null, error: null } as never;
        }
      })(),
      // (2026-05-30 Phase 2) Activity + attributed activity lifted into
      // ActivityFeedAsync below — the feed streams in its own Suspense
      // boundary after the shell renders.
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
    service_id: string | null;
    // 22-card-grid PR (migration 20260604120000_event_vendors_source_tracking)
    // adds manual_vendor_id, source, source_category. Optional on the type
    // because fetchEventVendorsRobust may fall back to the legacy select
    // when the columns are missing on a stale deploy.
    manual_vendor_id?: string | null;
    source?: string | null;
    source_category?: VendorCategory | null;
    // Vendor packages back-link (owner directive 2026-05-22 — vendor
    // packages + cascade-lock). Optional because the column may be
    // missing on stale deploys before migration 20260604110000 lands —
    // defensive read via fetchEventVendorsRobust falls back to the
    // sibling-only or legacy select in those cases. Drives the
    // "Included in <package>" badge on the LockedCard variant.
    event_vendor_package_id?: string | null;
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
  // Finalized-card-service-photo refinement (2026-05-22). Service photos
  // are PRIORITY 1 on the locked-state avatars per the owner directive
  // ("the SERVICE the host booked"). We batch-fetch the
  // primary_photo_r2_key for every service_id present on this event's
  // picks in a single IN(...) — one extra round trip max, regardless of
  // how many distinct services the host has saved across all 12 plan
  // groups. NULL service_id (off-platform / custom rows + pre-migration
  // rows) skip the fetch entirely, fall through to marketplace_logo_url
  // → initials placeholder at render time.
  const serviceIds = Array.from(
    new Set(
      eventVendorsRaw
        .map((v) => v.service_id)
        .filter((id): id is string => id !== null),
    ),
  );
  // Vendor packages back-link (owner directive 2026-05-22). Single batch
  // fetch resolves every package_name for every linked
  // event_vendor_package_id present on this event's picks. Drives the
  // "Included in <package>" badge on the LockedCard variant. Map is
  // empty when migration 20260604110000 hasn't shipped OR when no picks
  // came from a package — badge just doesn't render in either case.
  const packageBookingIds = Array.from(
    new Set(
      eventVendorsRaw
        .map(
          (v) =>
            (v as { event_vendor_package_id?: string | null })
              .event_vendor_package_id ?? null,
        )
        .filter((id): id is string => id !== null),
    ),
  );

  // 6th hotfix pass · Path B 2026-05-23 — wrap each adminClient call in
  // an async IIFE try/catch that returns the same empty-data shape the
  // length-zero branch already returns. Same defensive rationale as the
  // top-level Promise.all wrap above (migration drift between local +
  // prod can crash these calls before the schema-cache catches up). All
  // four downstream `marketplaceCompatMap` / iterators read `.data ??
  // []` so an empty fallback is the natural safe state.
  const compatibilityFetches = await Promise.all([
    // Finalized-vendor-photo-card (2026-05-22) — extend the existing
    // PR-B compatibility-fetch with logo_url + business_name + city so
    // the LockedCard variant on event home can render the marketplace
    // vendor's photo + canonical name without a separate round-trip.
    // Still one IN(...) per linked table — no perf regression.
    (async () => {
      type CompatRow = {
        vendor_profile_id: string;
        compatible_ceremony_types: string[] | null;
        compatible_venue_settings: string[] | null;
        logo_url: string | null;
        business_name: string | null;
        city: string | null;
      };
      const empty: { data: CompatRow[] } = { data: [] };
      if (marketplaceIds.length === 0) return empty;
      try {
        // 2026-05-24 fix: column is named `location_city` per iteration
        // 0022 migration 20260513120000_iteration_0022_vendor_dashboard.sql,
        // NOT `city`. The bad column name returned a PostgREST 400 on
        // every event-home render where marketplaceIds.length > 0
        // (existing events with picks) — the iterator at line ~1030 used
        // `?? []` so the iteration didn't crash, but every map row landed
        // with city=null AND emitted a 400 in Sentry breadcrumbs on every
        // page render. Aliasing `location_city AS city` in the SELECT
        // keeps the downstream CompatRow type + marketplaceCompatMap key
        // unchanged while the query actually returns data.
        return await adminClient
          .from('vendor_profiles')
          .select(
            'vendor_profile_id, compatible_ceremony_types, compatible_venue_settings, logo_url, business_name, city:location_city',
          )
          .in('vendor_profile_id', marketplaceIds);
      } catch (caught) {
        logQueryError(
          'EventHome (compatibilityFetches[0] vendor_profiles threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id, marketplace_ids: marketplaceIds.length },
          'graceful_degrade',
        );
        return empty;
      }
    })(),
    (async () => {
      type DirectoryRow = {
        venue_directory_id: string;
        compatible_ceremony_types: string[] | null;
      };
      const empty: { data: DirectoryRow[] } = { data: [] };
      if (directoryIds.length === 0) return empty;
      try {
        return await adminClient
          .from('venue_directory')
          .select('venue_directory_id, compatible_ceremony_types')
          .in('venue_directory_id', directoryIds);
      } catch (caught) {
        logQueryError(
          'EventHome (compatibilityFetches[1] venue_directory threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id, directory_ids: directoryIds.length },
          'graceful_degrade',
        );
        return empty;
      }
    })(),
    // Finalized-card-service-photo refinement (2026-05-22) — single
    // batch fetch against vendor_services for every distinct service_id
    // on this event's picks. NULL primary_photo_r2_key just means the
    // vendor hasn't uploaded a service photo yet → consumer falls
    // through to vendor_profiles.logo_url (PR #341 priority 2).
    (async () => {
      type ServiceRow = {
        vendor_service_id: string;
        primary_photo_r2_key: string | null;
      };
      const empty: { data: ServiceRow[] } = { data: [] };
      if (serviceIds.length === 0) return empty;
      try {
        return await adminClient
          .from('vendor_services')
          .select('vendor_service_id, primary_photo_r2_key')
          .in('vendor_service_id', serviceIds);
      } catch (caught) {
        logQueryError(
          'EventHome (compatibilityFetches[2] vendor_services threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id, service_ids: serviceIds.length },
          'graceful_degrade',
        );
        return empty;
      }
    })(),
    // Vendor packages back-link (owner directive 2026-05-22) — resolve
    // package_name for every event_vendor_package_id on this event's
    // picks. Two-table join via Supabase nested select; falls back to
    // empty data on any error (migration unapplied, RLS quirk, etc.).
    (async () => {
      type PackageRow = {
        booking_id: string;
        vendor_packages: { package_name: string } | null;
      };
      const empty: { data: PackageRow[] } = { data: [] };
      if (packageBookingIds.length === 0) return empty;
      try {
        return await adminClient
          .from('event_vendor_packages')
          .select(
            'booking_id, vendor_packages:package_id(package_name)',
          )
          .in('booking_id', packageBookingIds);
      } catch (caught) {
        logQueryError(
          'EventHome (compatibilityFetches[3] event_vendor_packages threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id, booking_ids: packageBookingIds.length },
          'graceful_degrade',
        );
        return empty;
      }
    })(),
    // Cross-category vendor services lifted into round 2 by the perf
    // pass 2026-05-28. Only depends on `marketplaceIds` which was
    // computed BEFORE this Promise.all from round-1 results, so it
    // can run alongside the other compat fetches instead of waiting
    // for them to resolve first. Saves a full Singapore round-trip on
    // every event-home render. Same admin-client + is_active=true +
    // graceful-degrade contract as the prior standalone serial await.
    (async () => {
      type ServiceRow = {
        vendor_service_id: string;
        vendor_profile_id: string;
        category: string;
        is_active: boolean;
      };
      const empty: { data: ServiceRow[] } = { data: [] };
      if (marketplaceIds.length === 0) return empty;
      try {
        return await adminClient
          .from('vendor_services')
          .select(
            'vendor_service_id, vendor_profile_id, category, is_active',
          )
          .in('vendor_profile_id', marketplaceIds)
          .eq('is_active', true);
      } catch (caught) {
        logQueryError(
          'EventHome (compatibilityFetches[4] vendor_services cross-category threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id, marketplace_ids: marketplaceIds.length },
          'graceful_degrade',
        );
        return empty;
      }
    })(),
    // (2026-05-30 Phase 2) fetchUpcomingItems lifted into
    // MoneyAndUpcomingAsync below — the panels stream in their own
    // Suspense boundary after the shell renders. compatibilityFetches
    // is now 5 entries (indices 0-4); the prior [5] upcoming slot is
    // gone. No other code accessed compatibilityFetches[5].
  ]);
  const marketplaceCompatMap = new Map<
    string,
    {
      ceremony: string[] | null;
      venue: string[] | null;
      logo_url: string | null;
      business_name: string | null;
      city: string | null;
    }
  >();
  for (const row of compatibilityFetches[0].data ?? []) {
    marketplaceCompatMap.set(row.vendor_profile_id, {
      ceremony: (row.compatible_ceremony_types as string[] | null) ?? null,
      venue: (row.compatible_venue_settings as string[] | null) ?? null,
      logo_url:
        (row as { logo_url?: string | null }).logo_url ?? null,
      business_name:
        (row as { business_name?: string | null }).business_name ?? null,
      city: (row as { city?: string | null }).city ?? null,
    });
  }
  const directoryCompatMap = new Map<string, string[] | null>();
  for (const row of compatibilityFetches[1].data ?? []) {
    directoryCompatMap.set(
      row.venue_directory_id,
      (row.compatible_ceremony_types as string[] | null) ?? null,
    );
  }
  // Finalized-card-service-photo refinement (2026-05-22). Map service_id
  // → public photo URL once, here, so the per-row enrichment below stays
  // a plain Map.get. NULL key (service has no photo yet) → drop from
  // map → consumer falls through to vendor logo at render time.
  const servicePhotoMap = new Map<string, string>();
  for (const row of compatibilityFetches[2].data ?? []) {
    const key = (row as { primary_photo_r2_key?: string | null })
      .primary_photo_r2_key;
    if (key && key.length > 0) {
      servicePhotoMap.set(
        row.vendor_service_id,
        r2PublicUrl(R2_BUCKETS.media, key),
      );
    }
  }
  // Vendor packages back-link (owner directive 2026-05-22). booking_id →
  // package_name. Empty map when no package picks OR when migration
  // unapplied — badge silently doesn't render in either case.
  const packageNameMap = new Map<string, string>();
  for (const row of compatibilityFetches[3]?.data ?? []) {
    const pkg = (row as { vendor_packages?: { package_name?: string } | null })
      .vendor_packages;
    if (pkg?.package_name) {
      packageNameMap.set(row.booking_id, pkg.package_name);
    }
  }

  // Hot-fix 2026-05-22 — TDZ violation surfaced by PR #349.
  //
  // The original PR #349 placement put the `eventVendors = eventVendorsRaw.map(...)`
  // enrichment BEFORE the `manualVendorPhotoMap` declaration, even though
  // the callback at line 611 reads `manualVendorPhotoMap.get(...)`.
  // JavaScript `const` is hoisted into block scope but the binding stays
  // uninitialized until execution reaches the declaration — any read
  // attempt throws `ReferenceError: Cannot access 'manualVendorPhotoMap'
  // before initialization`.
  //
  // For freshly-created events (eventVendorsRaw = []) the `.map()`
  // callback never runs, so the TDZ doesn't fire. But for ANY event
  // that has at least one event_vendors row with manual_vendor_id set
  // — and even rows with manual_vendor_id = null still evaluate the
  // surrounding `.map()` body where the closure captures the
  // identifier — the production runtime throws and the globalError
  // boundary renders.
  //
  // Fix: declare all four manual-vendor variables (manualVendorRows,
  // manualVendorOptions, manualVendorPhotoMap, manualVendorsAttachedByCategory)
  // BEFORE the eventVendors enrichment block so the `.map()` callback
  // can safely read manualVendorPhotoMap.get(...) regardless of how
  // many vendor picks the event has. None of the four depend on
  // eventVendors (the enriched array) — they all read from
  // manualVendorsRes.data and eventVendorsRaw, both of which are
  // already populated.
  //
  // See CLAUDE.md 2026-05-22 hot-fix decision-log row.

  // Manual vendors — host-managed contacts reusable across N planning
  // categories (2026-05-22 owner directive). Resolve photo R2 keys to
  // public URLs once here so the dropdown components stay client-side
  // pure (no server-only r2 calls).
  const manualVendorRows = (manualVendorsRes.data ?? []) as Array<{
    manual_vendor_id: string;
    business_name: string;
    contact_person: string;
    contact_number: string;
    photo_r2_key: string | null;
  }>;
  const manualVendorOptions = manualVendorRows.map((mv) => ({
    manual_vendor_id: mv.manual_vendor_id,
    business_name: mv.business_name,
    contact_person: mv.contact_person,
    photo_url:
      mv.photo_r2_key && mv.photo_r2_key.length > 0
        ? r2PublicUrl(R2_BUCKETS.media, mv.photo_r2_key)
        : null,
  }));

  // Lookup map for the 4-tier avatar ladder — manual_vendor_id →
  // resolved photo URL. Mirrors the servicePhotoMap pattern above.
  // Used downstream to enrich each event_vendors row's
  // manual_vendor_photo_url for LockedVendorAvatar / FinalizedChipStrip.
  const manualVendorPhotoMap = new Map<string, string>();
  for (const mv of manualVendorRows) {
    if (mv.photo_r2_key && mv.photo_r2_key.length > 0) {
      manualVendorPhotoMap.set(
        mv.manual_vendor_id,
        r2PublicUrl(R2_BUCKETS.media, mv.photo_r2_key),
      );
    }
  }

  // Per-category attach map — which manual_vendor_ids are already
  // wired into which categories. Drives the "✓ Added" disabled state
  // on the dropdown so hosts don't double-attach the same manual
  // vendor to the same card. Map<category, Set<manual_vendor_id>>.
  const manualVendorsAttachedByCategory = new Map<string, Set<string>>();
  for (const v of eventVendorsRaw) {
    if (v.manual_vendor_id) {
      if (!manualVendorsAttachedByCategory.has(v.category)) {
        manualVendorsAttachedByCategory.set(v.category, new Set());
      }
      manualVendorsAttachedByCategory.get(v.category)!.add(v.manual_vendor_id);
    }
  }

  const eventVendors = eventVendorsRaw.map((v) => {
    const marketplace = v.marketplace_vendor_id
      ? marketplaceCompatMap.get(v.marketplace_vendor_id)
      : undefined;
    const directory = v.source_venue_directory_id
      ? directoryCompatMap.get(v.source_venue_directory_id) ?? null
      : null;
    const servicePhotoUrl = v.service_id
      ? servicePhotoMap.get(v.service_id) ?? null
      : null;
    // 2026-05-22 owner directive — manual vendor photo lookup. PRIORITY
    // 1 on the avatar ladder for picks that wrap a host-managed
    // contact. NULL on marketplace + freeform rows.
    const manualVendorPhotoUrl = v.manual_vendor_id
      ? manualVendorPhotoMap.get(v.manual_vendor_id) ?? null
      : null;
    return {
      ...v,
      marketplace_compatible_ceremony_types: marketplace?.ceremony ?? null,
      marketplace_compatible_venue_settings: marketplace?.venue ?? null,
      directory_compatible_ceremony_types: directory,
      // Finalized-vendor-photo-card (2026-05-22) — carry logo + canonical
      // business_name + city from the same vendor_profiles join so the
      // LockedCard + upgraded FinalizedChipStrip can render the photo
      // without an extra round-trip.
      marketplace_logo_url: marketplace?.logo_url ?? null,
      marketplace_business_name: marketplace?.business_name ?? null,
      marketplace_city: marketplace?.city ?? null,
      // Finalized-card-service-photo refinement (2026-05-22). PRIORITY 2
      // photo source — the booked service's primary photo. Resolved as
      // a public URL via r2PublicUrl above. Falls back to
      // marketplace_logo_url, then initials, at render time. See the
      // 4-tier fallback ladder in LockedVendorAvatar and the upgraded
      // VendorAvatar in finalized-chip-strip.tsx.
      service_primary_photo_url: servicePhotoUrl,
      // 2026-05-22 owner directive — manual vendor photo URL is
      // PRIORITY 1 on the avatar ladder when the pick wraps a manual
      // contact (Tito Marcel, family helper). Beats service photo +
      // marketplace logo + initials. NULL means "fall through to the
      // next tier" — no special handling needed downstream.
      manual_vendor_photo_url: manualVendorPhotoUrl,
      // 22-card-grid auto-cascade source tracking — drives the Sparkles
      // badge on auto-cascaded considering picks. Optional on the raw
      // row (may be missing on stale deploys); coerce to null here.
      source: (v as { source?: string | null }).source ?? null,
      source_category:
        ((v as { source_category?: VendorCategory | null }).source_category ??
          null) as VendorCategory | null,
      // Vendor packages back-link (owner directive 2026-05-22 — vendor
      // packages + cascade-lock). When the row was cascade-created from
      // a locked vendor package, carries the package_name so the
      // LockedCard "Included in <package>" badge can render. NULL on
      // standalone (non-package) rows.
      event_vendor_package_id:
        (v as { event_vendor_package_id?: string | null })
          .event_vendor_package_id ?? null,
      package_name:
        (v as { event_vendor_package_id?: string | null })
          .event_vendor_package_id !== null &&
        (v as { event_vendor_package_id?: string | null })
          .event_vendor_package_id !== undefined
          ? packageNameMap.get(
              (v as { event_vendor_package_id: string })
                .event_vendor_package_id,
            ) ?? null
          : null,
    };
  });

  // eventCeremonyType + eventVenueSetting removed with the PersonalizedMenu
  // recap (couple-home-cockpit 2026-06-04) — their only consumer. Ceremony
  // type is read inline by the Needs-you (Upcoming) wrapper below; venue now
  // lives on the Services "Matching you on" strip.

  // Cross-category vendor recommendations (CLAUDE.md 2026-05-22 owner
  // directive). For every marketplace vendor the host has picked, fetch
  // ALL of that vendor's vendor_services rows so we can recommend them
  // for other categories they cover. e.g. a caterer who also offers
  // cake + cocktail bar surfaces as RECOMMENDED on the Cake card +
  // Music & Entertainment card with badge "also doing your catering."
  //
  // The actual fetch was lifted into the `compatibilityFetches` Promise.all
  // above by the perf pass 2026-05-28 — it only depends on `marketplaceIds`
  // which is computed BEFORE the Promise.all from round-1 results, so it
  // can run in parallel with the 4 compat lookups instead of waiting for
  // them to resolve first. Same admin-client + is_active=true + graceful-
  // degrade contract as before. See compatibilityFetches[4] above.
  //
  // adminClient used (same as the compat fetches) because vendor_services
  // RLS is restricted to the owning vendor — couples can't read other
  // vendors' service rows. The admin path is safe here because the
  // marketplace_vendor_id set is already gated by the couple's RLS read
  // on event_vendors above; we're not exposing anything they can't see.
  const crossCategoryServicesRaw = compatibilityFetches[4]?.data ?? [];
  const crossCategoryRecommendations = buildCrossCategoryRecommendations({
    picks: eventVendors.map((v) => ({
      marketplace_vendor_id: v.marketplace_vendor_id,
      category: v.category,
      status: v.status,
      marketplace_business_name: v.marketplace_business_name,
      marketplace_logo_url: v.marketplace_logo_url,
      vendor_name: v.vendor_name,
    })),
    vendor_services: (crossCategoryServicesRaw ?? []) as Array<{
      vendor_service_id: string;
      vendor_profile_id: string;
      category: string;
      is_active: boolean;
    }>,
  });

  // Setnayan AI computation moved UP into the couple-home-cockpit block
  // (2026-06-04) — see `todaysTask` / `remainingTaskCount` near the render.
  // The single-focus hero (owner directive 2026-05-22, Headspace-pattern)
  // resolves the host's #1 unlocked task from the same `eventVendors` array
  // so the hero agrees with the plan's lock state. (The 2026-06-02 → 06-03
  // WizardHero/Today's-Focus-wizard surface was retired; this is the original
  // lightweight vendor-derived hero, NOT the wizard or the paid Concierge.)

  // Next 15 Steps · Parallel Work Map — REMOVED 2026-05-24 (owner directive).
  // Setnayan AI carousel + the 22-card Plan grid below cover the same
  // territory without the third ranked-ladder surface stealing attention.
  // The resolver + JSX block + sponsorRowsForNextSteps + nextSteps variable
  // are all gone. paperworkRowsForNextSteps is kept (used by paperwork
  // summary later in this file) but no longer feeds the retired ladder.
  const paperworkRowsForNextSteps = (paperworkRowsRes.data ?? []) as PaperworkRow[];
  const moodBoardLocked =
    (event as { palette_finalized_at?: string | null }).palette_finalized_at !==
      null &&
    (event as { palette_finalized_at?: string | null }).palette_finalized_at !==
      undefined;

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

  // V1 pilot Home v2 — source activity feed + the new attributed lane
  // (event_action_log) were lifted into the top Promise.all (round 1)
  // by the perf pass 2026-05-28. Both only depend on eventId + user.id
  // which are available at the start; serialising them here cost a
  // full Singapore-region round-trip on every event-home render.
  // Attribution silently returns [] when the table has no rows OR a
  // join fails, so the source feed always renders. Each fetcher's
  // own .catch() with [] safe-default shape (6th hotfix pass · Path B
  // 2026-05-23) lives inline in the top Promise.all now.

  // Derived counts for the new Home v2 sections.
  const moodBoardSaveCount = moodBoardSavesRes.count ?? 0;
  const seatedGuests = seatAssignmentsRes.count ?? 0;

  // YOUR PLAN section derived stats (owner directive 2026-05-22).
  // All counts pulled from the same Promise.all above. The section is a
  // grid of nine tool tiles — each tile's sub-line shows live progress
  // so the host sees a snapshot without clicking through.
  const scheduleBlockCount = scheduleBlocksRes.count ?? 0;
  const contractCount = contractsCountRes.count ?? 0;
  const sponsorRowsForCount = (sponsorsRes.data ?? []) as Array<{
    sponsor_tier: string | null;
    invitation_status: string | null;
  }>;
  const sponsorCount = sponsorRowsForCount.length;
  const acceptedSponsorCount = sponsorRowsForCount.filter(
    (s) => s.invitation_status === 'accepted',
  ).length;
  // Paperwork in-progress = anything not received OR expired. Lines up
  // with the "X in progress" doc-tile sub-line.
  const paperworkInProgressCount = paperworkRowsForNextSteps.filter(
    (r) => r.status !== 'received' && r.status !== 'expired',
  ).length;
  // Setnayan creation orders — present means the host has a non-cancelled
  // order for that SKU. Either pending payment OR paid both count
  // because the tile copy ("Saved to your event") works for both.
  const setnayanCreationRows = (setnayanCreationOrdersRes.data ?? []) as Array<{
    service_key: string | null;
    status: string | null;
  }>;
  const hasSaveTheDateOrder = setnayanCreationRows.some(
    (r) => r.service_key === 'save_the_date_video',
  );
  const hasMonogramOrder = setnayanCreationRows.some(
    (r) => r.service_key === 'monogram_hero_upgrade',
  );

  // Paperwork pipeline summary — drives the small "📋 Paperwork — X of Y"
  // sub-link on the Ceremony venue plan card. Falls back gracefully to a
  // zero-state summary when the table doesn't exist yet (pre-migration)
  // OR the host hasn't seeded any rows yet — the sub-link renders as a
  // "Track your paperwork" empty-state CTA in that case.
  const paperworkRows = paperworkRowsForNextSteps;
  const paperworkSummary = summarizePaperwork(paperworkRows, event.event_date);

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

  // eventBudgetCentavos removed with the PersonalizedMenu recap
  // (couple-home-cockpit 2026-06-04) — its only consumer. Budget now lives on
  // Services (the "Matching you on" strip + budget summary), not Home.

  // Upcoming items + money-in-flight derivation moved into
  // MoneyAndUpcomingAsync (2026-05-30 Phase 2 — Suspense streaming).
  // The async wrapper does the fetchUpcomingItems call inside its own
  // Suspense boundary so the panels render the moment the data
  // resolves — no longer blocking the shell. See
  // _components/money-and-upcoming-async.tsx + @/lib/upcoming-items
  // for the per-source schema audit. Graceful-degrade contract
  // (Path B 2026-05-23 + CLAUDE.md 2026-05-28 12th row PR #567)
  // preserved verbatim inside the wrapper.

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

  // Couple-home-cockpit (owner-approved prototype 2026-06-04). Home leads with
  // the emotional anchor (countdown) + the single highest-priority next action
  // ("Setnayan AI"), NOT the text-heavy match-criteria recap (which moved to
  // the top of Services; the full editable record stays at /details). Every
  // input below is derived from data the page already loaded — no new fetches.
  // remainingTaskCount feeds the countdown's "X of N vendors locked" bar
  // below (countUnlockedCategories — unchanged). The old "Setnayan AI" hero
  // (pickTodaysOneThing) was replaced by the Things-to-complete roadmap, which
  // self-fetches; its compute no longer lives here.
  const remainingTaskCount = countUnlockedCategories(eventVendors);
  // "X of N vendors locked" for the countdown progress bar. N = lockable
  // plan-groups (entry-point cards excluded), matching the resolver's universe
  // so the header and the focus card agree. locked = N − unlocked.
  const totalLockableCategories = PLAN_GROUPS.filter(
    (g) => g.countsTowardLockable !== false,
  ).length;
  const lockedVendorCount = Math.max(0, totalLockableCategories - remainingTaskCount);
  // Venue label for the countdown — venue_name when set, else region.
  const countdownVenueLabel =
    (event as { venue_name?: string | null }).venue_name ??
    (event as { region?: string | null }).region ??
    null;

  // Planning mode (owner 2026-06-05). 'manual' = the couple turned off
  // Setnayan's automated layer: hide Setnayan AI (auto-task) + Upcoming
  // schedules (per-service + statutory deadlines). The countdown + activity
  // feed stay. Default 'guided' (and any unknown value) keeps everything on.
  const planningManual = !isSetnayanAiActive(
    event as { planning_mode?: string | null; setnayan_ai_active?: boolean | null },
  );

  return (
    // Column effect retired 2026-05-23 per owner directive — event home
    // renders as a single column on every breakpoint. Prior shape was a
    // mobile-shape LEFT pane (max 420px) + draggable divider + sticky
    // EventHomeDetailPane RIGHT pane on lg+. That layout cramped the
    // left content + the right pane duplicated content the host
    // already saw inline. Single-column mirrors the same content
    // density mobile hosts already enjoy.
    <>
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

      {/* Couple-home-cockpit (owner-approved prototype 2026-06-04). Home is a
       *  cockpit, not a catalog — five beats answering "what now?":
       *  1) the countdown (emotional anchor), 2) Setnayan AI (the single
       *  next action), 3) Needs you (time-bound items that need the host),
       *  4) Recent activity (updates), 5) one doorway into the matched
       *  marketplace. The match-criteria recap moved to the top of Services;
       *  the full editable record lives at /details. Everything else — the
       *  plan grid, the services storefront, the nav tiles, money-in-flight —
       *  owns its own tab, reachable via the bottom-nav + desktop sidebar.
       *  The day-of trio above stays — wedding-day takeover (iteration 0031),
       *  null in normal planning. */}
      <EventCountdownHeader
        eventId={eventId}
        eventName={(event as { display_name?: string | null }).display_name ?? 'Your wedding'}
        eventDate={event.event_date}
        eventDatePrecision={eventDatePrecision}
        dateMode={(event as { date_mode?: string | null }).date_mode ?? null}
        dateCandidates={(event as { date_candidates?: string[] | null }).date_candidates ?? null}
        dateWindowStart={(event as { date_window_start?: string | null }).date_window_start ?? null}
        dateWindowEnd={(event as { date_window_end?: string | null }).date_window_end ?? null}
        venueLabel={countdownVenueLabel}
        lockedCount={lockedVendorCount}
        totalLockable={totalLockableCategories}
        now={now}
      />

      {/* Things to complete — the free wedding roadmap (owner 2026-06-05). The
       *  ordered tasks, timed by months-to-earliest-date; the couple taps each
       *  done themselves (manual check-off · NO automation / no AI). Replaces
       *  the single "Up next" hero with the fuller list. Hidden in Manual mode
       *  like the rest of the assist. Streams in its own Suspense. */}
      {!planningManual ? (
        <Suspense fallback={<WeddingRoadmapSkeleton />}>
          <WeddingRoadmapAsync eventId={eventId} now={now} />
        </Suspense>
      ) : null}

      {/* Needs you — the time-bound items that need the host (vendor replies,
       *  payment milestones, statutory deadlines). Same UpcomingSchedules
       *  surface, reframed from a passive "Upcoming" calendar via the async
       *  wrapper's headingLabel/emptyLabel props. Streams independently.
       *  Manual mode (owner 2026-06-05) turns off ALL deadlines — including the
       *  statutory ones — per the owner's explicit choice (DECISION_LOG). */}
      {!planningManual ? (
        <Suspense fallback={<UpcomingSchedulesSkeleton />}>
          <UpcomingSchedulesAsync
            eventId={eventId}
            eventDate={event.event_date}
            ceremonyType={(event as { ceremony_type?: string | null }).ceremony_type ?? null}
            userId={user.id}
            now={now}
          />
        </Suspense>
      ) : null}

      {/* Recent activity — what's changed since last visit. */}
      <Suspense fallback={<ActivityFeedSkeleton />}>
        <ActivityFeedAsync
          eventId={eventId}
          userId={user.id}
          headingLabel={tr('section.recent_activity')}
          seeAllLabel={tr('cta.see_all')}
        />
      </Suspense>

      {/* One calm doorway into the matched marketplace — replaces the CTA that
       *  used to live inside the removed recap card. */}
      <Link
        href={`/dashboard/${eventId}/vendors`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-ink/15 bg-cream/60 px-4 py-4 transition-colors hover:bg-cream"
      >
        <span>
          <span className="block text-sm font-semibold text-ink">
            Browse your matched services
          </span>
          <span className="mt-0.5 block text-xs text-ink/55">
            Matched to your date, venue &amp; style
          </span>
        </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </Link>
    </>
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

function WelcomeHeader({ eventName }: { eventName: string }) {
  // Task #65 (2026-05-22) — date + countdown + ceremony type live in
  // <EventMetaLine> immediately below (rendered as a sibling in the page
  // composition). 2026-05-22 (owner directive) — the time-of-day greeting
  // line previously rendered beneath the event name was removed; header now
  // carries only the event-name display so the welcome strip stays the
  // single source of "who and what" without duplicating the "when" three
  // times across the page. See _components/event-meta-line.tsx.
  //
  // v2.1 visual overlay (2026-05-28) — couple-dashboard.jsx template's
  // `.display` typeface renders the couple's names as uppercase Saira
  // Condensed at 44px. We adopt the `.m-display-tight` utility from
  // globals.css (Saira Condensed 700 · uppercase via toUpperCase()) so
  // the welcome header gets the v2.1 keynote treatment without changing
  // the underlying event-name data shape. The eventName itself stays —
  // .toUpperCase() is the typographic transform, not a content rename.
  // 2026-05-28 deep-fix — eyebrow above the heading uses sienna so the
  // welcome strip reads like the template's "Good evening, …" rail.
  // .m-display-tight class is already present (Saira Condensed 700) from
  // the shallow PR #576 overlay; deep-fix adds the eyebrow + .m-mono on
  // a thin sub-rule beneath to match the template's typographic rhythm.
  return (
    <header className="space-y-1.5">
      <p
        className="m-eyebrow font-mono text-[10px] uppercase tracking-[0.22em]"
        style={{ color: 'var(--m-orange-2)' }}
      >
        Your wedding
      </p>
      <h1
        className="m-display-tight text-3xl uppercase sm:text-[44px]"
        style={{ letterSpacing: '-0.005em', color: 'var(--m-ink)' }}
      >
        {eventName.toUpperCase()}
      </h1>
    </header>
  );
}

function StageStrip({ stage }: { stage: Stage['key'] }) {
  const foundIndex = STAGES.findIndex((s) => s.key === stage);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;
  const activeLabel = STAGES[activeIndex]?.label ?? STAGES[0]?.label ?? '';
  // v2.1 deep-fix (2026-05-28) — stage strip pills swap from terracotta
  // semantic class to sienna --m-orange (active) + --m-orange-3 (done) +
  // --m-line-soft (pending), matching couple-dashboard.jsx template's
  // 6-phase rail in CoupleTopbar. Phase count + labels + activeIndex math
  // all stay untouched — pure inline-style color overlay so the SHIPPED
  // STAGES lookup + stage prop semantics carry through.
  return (
    <div className="space-y-2">
      <ol className="flex w-full items-center gap-1.5" aria-label="Wedding stage progress">
        {STAGES.map((s, i) => {
          const done = i < activeIndex;
          const isActive = i === activeIndex;
          const fill = isActive
            ? 'var(--m-orange)'
            : done
              ? 'var(--m-orange-3)'
              : 'var(--m-line-soft)';
          return (
            <li key={s.key} className="flex flex-1 items-center gap-1.5">
              <span
                aria-current={isActive ? 'step' : undefined}
                aria-label={s.label}
                className="block h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: fill }}
              />
            </li>
          );
        })}
      </ol>
      {/* 2026-05-30 contrast lift (owner: "text are unreadable") —
       *  swapped --m-slate-3 (#898D94 · 3.07:1 on Alabaster · fails
       *  WCAG AA) → --m-slate (#4F535B · 7.40:1 · passes AAA). Same
       *  visual hierarchy (eyebrow muted, active label full ink) just
       *  bumped above the WCAG threshold. */}
      <p
        className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--m-slate)' }}
      >
        Stage {activeIndex + 1} of {STAGES.length} ·{' '}
        <span style={{ color: 'var(--m-ink)' }}>{activeLabel}</span>
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
  // v2.1 deep-fix (2026-05-28) — TILES grid chrome adopts template's
  // card pattern: --m-paper background, --m-line border, sienna-tinted
  // icon chip (--m-orange-4 bg + --m-orange-2 fg), --m-shadow-sm rest +
  // --m-shadow-md hover. The 14-tile TILES lookup + section.plan
  // translation key + tile.href(eventId) navigation + stats counter
  // logic + notifications badge all stay untouched — pure styling
  // refresh per [[feedback_setnayan_button_preservation]].
  return (
    <div className="space-y-3">
      <h2
        className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--m-slate-3)' }}
      >
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
                className="group flex h-full flex-col gap-2 rounded-xl border p-3 transition-all sm:gap-3 sm:p-4"
                style={{
                  background: 'var(--m-paper)',
                  borderColor: 'var(--m-line)',
                  boxShadow: 'var(--m-shadow-sm)',
                }}
              >
                <span
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10"
                  style={{
                    background: 'var(--m-orange-4)',
                    color: 'var(--m-orange-2)',
                  }}
                >
                  <Icon aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />
                  {showBadge ? (
                    <span
                      className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 font-mono text-[9px] font-semibold"
                      style={{
                        background: 'var(--m-orange)',
                        color: 'var(--m-paper)',
                      }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className="text-xs font-semibold sm:text-sm"
                  style={{ color: 'var(--m-ink)' }}
                >
                  {tr(tile.labelKey)}
                </span>
                {counter ? (
                  <span
                    className="text-[10px] sm:text-xs"
                    style={{ color: 'var(--m-slate-3)' }}
                  >
                    {counter}
                  </span>
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
  // v2.1 deep-fix (2026-05-28) — Setnayan AI checklist card uses
  // --m-paper background + --m-line border + --m-shadow-sm rest. Progress
  // bar fill swaps from terracotta semantic class to sienna --m-orange.
  // Track bg uses --m-line-soft so the track has the warm ivory cast
  // (vs the cool ink/10 we had before). All percentage math + STEPS
  // lookup + tr() translations + step.key navigation unchanged.
  return (
    <div
      className="space-y-3 rounded-2xl border p-5"
      style={{
        background: 'var(--m-paper)',
        borderColor: 'var(--m-line)',
        boxShadow: 'var(--m-shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2
            className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
            {tr('section.concierge')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
            {progress.done} of {progress.total} steps · prefer to fly solo? Switch to DIY in
            Profile.
          </p>
        </div>
        <span
          className="font-mono text-sm font-semibold"
          style={{ color: 'var(--m-orange-2)' }}
        >
          {progress.pct}%
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--m-line-soft)' }}
      >
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${progress.pct}%`, background: 'var(--m-orange)' }}
        />
      </div>
      <ol
        className="divide-y rounded-xl border"
        style={{
          borderColor: 'var(--m-line)',
          background: 'var(--m-paper-2)',
        }}
      >
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
