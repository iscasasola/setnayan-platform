import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { EventScene } from '@/app/dashboard/(launcher)/_components/event-scene';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { eventTypePhotoSrc } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { renderableImageSrc } from '@/lib/event-card-art';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  Sparkles,
  CalendarClock,
  Wallet,
  Users,
  Store,
  MessageSquare,
  ListChecks,
  Camera,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { fetchChecklistProgress } from '@/lib/checklist';
import { eventDateToEpoch, type MenuLifecyclePhase } from '@/lib/day-of-mode';
import { digestSubWorthShowing } from '@/lib/digest-sub';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { rsvpSegments, rsvpSummary } from '@/lib/rsvp-segments';
import { fetchEventUnreadCounts } from '@/lib/event-decisions';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import {
  fetchPlanGroupScope,
  planGroupsForEventType,
} from '@/lib/plan-groups-by-event-type';
import { PLAN_GROUPS, type EventVendorRowInput } from '@/lib/wedding-plan-groups';
import { countUnlockedCategories, pickTodaysOneThing } from '@/lib/todays-one-thing';
import {
  buildCockpitModel,
  type CockpitDecision,
} from '@/lib/setnayan-ai-cockpit';
import {
  summarize as summarizePaperwork,
  completeByDate as paperworkCompleteByDate,
  DOCUMENT_META as PAPERWORK_DOCUMENT_META,
  type PaperworkRow,
} from '@/lib/paperwork';
import { COUPLE_ORDERS_HIDE_VENDOR_FILTER } from '@/lib/orders';
import { fetchUpcomingItems, type UpcomingItem } from '@/lib/upcoming-items';
import {
  fetchScheduleBlocks,
  selectSchedulePreviewBlocks,
  SCHEDULE_BLOCK_LABEL,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import { isSetnayanAiActiveForEvent } from '@/lib/setnayan-ai';
import { cockpitEnabled } from '@/lib/setnayan-ai-cockpit-flag';
import { ROLE_SUBTYPE_LABEL, isRoleSubtype } from '@/lib/event-moderators';
import {
  resolveSetnayanAiPaywallEnabled,
} from '@/lib/integration-config';
import {
  runTriggers,
  applyRestraint,
  type PlanningSnapshot,
  type Intervention,
} from '@/lib/setnayan-ai-triggers';
import {
  clashBlocksFromScheduleRows,
  scheduleClashesFromBlocks,
  loadVendorChangeSignals,
} from '@/lib/setnayan-ai-snapshot';
import { renderTemplate, WEDDING_TERMINOLOGY } from '@/lib/setnayan-ai-templates';
import { buildProgressStages } from '@/lib/progress-stages';
import type { EventDatePrecision } from '@/lib/events';
import type { VendorCategory } from '@/lib/vendors';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { resolvePapicHomeTile } from '@/lib/papic-home-tile';
import { formatPeso } from '@/lib/checklist-budget-format';
import {
  InspectorLayout,
  InspectorTrigger,
} from '@/app/_components/inspector/inspector-column';
import {
  OverviewDecisionInspector,
  OverviewWatchInspector,
} from './overview-inspector-body';
import {
  isFirstVenueShortlistOfferAvailable,
  isSuriAssistFreeDecisionId,
} from '@/lib/setnayan-ai-free-assist';
import { ProgressRing } from '@/app/_components/progress-ring';
import { CountUp } from '@/app/_components/count-up';
import { ExpandCard } from './expand-card';
import { JourneyRail } from '../progress/_components/journey-rail';
import { FreeVenueShortlistOffer } from '../progress/_components/free-venue-shortlist-offer';

/**
 * <EventDashboard> — the couple's event dashboard, extracted verbatim from the
 * former `/dashboard/[eventId]/progress` page so it can mount as the event
 * Home (owner directive 2026-07-10: the Home IS the dashboard).
 *
 * Production port of the approved session prototype
 * (setnayan-decisions-progress.html): the couple's read-your-progress surface —
 * hero + at-a-glance bento + the six-stage journey rail + the decisions board +
 * the around-your-event doorstep cards. Every number derives from real,
 * RLS-scoped event data (same defensive patterns as the old Overview); nothing
 * is fixture-driven.
 *
 * Dual state: when Setnayan AI is active for the viewer (per-event flag +
 * per-user subscription fan-out), the Suri briefing sentence + chips render
 * INSIDE the "Big Day" obsidian focal (Glass PR-2 — this retired both the
 * mulberry-gradient briefing strip and the separate premium veil; the tile IS
 * the premium presence), plus Today's one thing, priority-ranked decisions,
 * the What's-next deadline rail, and the render-only "Suri on watch" section.
 * Internal accounts can preview the AI state on any event via `?suri=preview`
 * (render-only override — it flips no flags and charges nothing); the Home page
 * forwards its own `?suri` param through `suriPreviewParam`.
 *
 * `slotAfterBento` renders immediately AFTER the At-a-glance bento and BEFORE
 * the Event-progress journey rail — the Home injects its cultural / set-date
 * overlays there so they land in the right visual place.
 */

const CONFIRMED_VENDOR_SET = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

/**
 * Whole days from today to the event.
 *
 * ⚠ IT USED TO ANCHOR ON THE RUNTIME'S OWN MIDNIGHT. `new Date(`${d}T00:00:00`)`
 * plus `today.setHours(0,0,0,0)` are both the SERVER's clock — UTC on Vercel —
 * so between 00:00 and 08:00 Manila the day after a wedding this still returned
 * 0 and the hero read "It's your event day". `eventDateToEpoch` exists in
 * lib/day-of-mode.ts precisely because a bare Date parse already broke a
 * countdown once; it is asked here rather than re-derived.
 */
function daysUntil(eventDate: string | null, tz?: string): number | null {
  if (!eventDate) return null;
  const eventMs = eventDateToEpoch(eventDate, tz);
  if (!Number.isFinite(eventMs)) return null;
  // "Today" collapsed in the SAME zone, so both sides of the subtraction are
  // midnights in one clock rather than midnights in two.
  const todayIso = new Date().toLocaleDateString('en-CA', tz ? { timeZone: tz } : undefined);
  const todayMs = eventDateToEpoch(todayIso, tz);
  if (!Number.isFinite(todayMs)) return null;
  return Math.round((eventMs - todayMs) / 86_400_000);
}

/** service_key → couple-facing label via the add-ons catalog, else prettified. */
function serviceLabel(key: string | null): string {
  if (!key) return 'Setnayan service';
  // Catalog keys are UPPER_SNAKE; some order rows store lower_snake — match
  // case-insensitively so both eras label correctly.
  const upper = key.toUpperCase();
  const entry = ADD_ONS.find((a) => a.serviceKey?.toUpperCase() === upper);
  if (entry) return entry.label;
  return key
    .toLowerCase()
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Day-first, per the Warm Editorial handoff ("12 Dec 2026"; short form "12 Dec"
// in chips and rails). en-PH orders this month-first ("Dec 12"), so the locale is
// pinned to en-GB purely for ORDER — the month name is identical in both.
const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

/**
 * The three-dot status vocabulary (Warm Editorial § 2.1), keyed off the SHIPPED
 * `chipTone` so the digest and the board cannot disagree about urgency.
 *   mulberry = money due / urgent · gold = waiting on people · slate = informational
 */
const decisionDotColor: Record<'hot' | 'warm' | 'calm', string> = {
  // ⛔ Owner ruling 2026-08-08 ("stick to gold to all"): gold is the ACTION colour
  // here, so the urgent dot is the deepest gold rather than the handoff's rust.
  hot: 'var(--sn-gold-700)',
  warm: 'var(--sn-gold-500)',
  calm: 'rgb(var(--color-link))',
};

type DecisionItemView = {
  id: string;
  label: string;
  sub: string;
  /** null = the row already says it — see the "pick" case in `byKind`. */
  chip: string | null;
  chipTone: 'hot' | 'warm' | 'calm';
  ctaLabel: string;
  href: string;
};

type DecisionGroupView = {
  // 'deadline' is the folded-in "What's next" rail (council verdict: the board
  // is the ONE canonical action list, and dated items fold into it rather than
  // standing beside it as a second thing to read).
  id: 'book' | 'pay' | 'pick' | 'role' | 'deadline';
  title: string;
  sub: string;
  items: DecisionItemView[];
};

// One row of the Hosts doorstep card — an account that manages this event:
// the owning couple row(s), accepted event_moderators hosts, or a still-
// pending invitation.
type HostAccountView = {
  key: string;
  name: string;
  roleLabel: string;
  state: 'active' | 'invited';
};

export async function EventDashboard({
  eventId,
  suriPreviewParam,
  inspectId,
  slotAfterBento,
  dayOfActive = false,
  lifecyclePhase = 'plan',
  canViewPapicCounts = false,
}: {
  eventId: string;
  suriPreviewParam?: string;
  /** `?inspect=` value forwarded from the Home URL — selects a decision
   *  (`d:<id>`) or a Suri-on-watch (`w:<key>`) row into the inspector column. */
  inspectId?: string;
  slotAfterBento?: ReactNode;
  /**
   * True inside the T-1h..T+8h day-of window (resolved by the Home page). When
   * set, the page's DayOfModeGrid renders its "happening now" obsidian focal
   * ABOVE this surface, so the "Big Day" focal here steps down to a glass tile
   * — the one-obsidian-per-view rule (rollout plan § 1.3) stays satisfied.
   */
  dayOfActive?: boolean;
  /*
    ─── THE EVENT LIFECYCLE PHASE ──────────────────────────────────────────

    🚨 THIS COMPONENT HAD THE NARROWEST POSSIBLE VIEW OF TIME. It took
    `dayOfActive`, a boolean that answers only "is it the day itself" — and
    whose sole use is painting one card dark. It had no way to know a
    celebration had ALREADY HAPPENED, so the day after it still offered to help
    book a venue, called the booking "overdue", showed a shimmering "% planned"
    bar, and headed its digest "Needs you this week".

    Owner, 2026-08-21: *"why can i still plan and build and create guest list as
    if it hasn't ended"* — and receding this whole component behind a disclosure
    (PR #4651) was NOT enough, because a wrong statement one click down is still
    a wrong statement.

    🔑 RESOLVED ONCE, SERVER-SIDE, BY THE ONE RESOLVER. Not re-derived here from
    `event.event_date` — this component's own `daysUntil` is exactly the kind of
    second opinion that produced an eight-hour window every morning where the
    hero said one thing and the rest of the page another.

    Omitted ⇒ 'plan' ⇒ byte-identical for every existing caller.
  */
  lifecyclePhase?: MenuLifecyclePhase;
  /**
   * Is the viewer a COUPLE member of this event? Resolved once by the Home page.
   *
   * Gates the Papic mini-tile, and it is a correctness gate rather than a
   * permission nicety: the three Papic capture tables are couple-only in RLS while
   * this surface also renders for coordinators / multi-host moderators, and an RLS
   * denial returns `count: 0` with no error — so without this a coordinator is
   * shown "0 cameras out" on an event mid-shoot. Defaults FALSE: a caller that
   * forgets it gets no tile, never a wrong one.
   */
  canViewPapicCounts?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const now = new Date();

  const [
    eventRes,
    viewerRes,
    guests,
    eventVendorsRes,
    paidOrdersRes,
    pendingOrdersRes,
    sponsorsRes,
    paperworkRes,
    unreadCount,
    seatAssignmentsRes,
    scheduleBlocks,
    hostAccounts,
    papicHome,
    checklistProgress,
    handoversRes,
  ] = await Promise.all([
    // Event row — lean select of exactly what this surface reads, with the
    // Overview's fallback-to-'*' pattern for migration drift.
    (async () => {
      const leanSelect =
        'event_id, display_name, event_date, event_date_precision, timezone, venue_name, region, estimated_budget_centavos, palette_finalized_at, event_type, ceremony_type, planning_mode, setnayan_ai_active';
      const leanRes = await supabase
        // SEC-2b: public.events_host, not public.events — this select names a column
        // (budget / birth data / Drive folder) that is SELECT-denied to `authenticated`
        // on the base table by 20271008731642. The view is the couple/moderator-scoped
        // read path; same columns, same row shape, guests get zero rows.
        .from('events_host')
        .select(leanSelect)
        .eq('event_id', eventId)
        .maybeSingle();
      if (
        leanRes.error &&
        /column .* does not exist|undefined_column|42703/i.test(
          (leanRes.error as { message?: string; code?: string }).message ??
            (leanRes.error as { code?: string }).code ??
            '',
        )
      ) {
        return supabase.from('events').select('*').eq('event_id', eventId).maybeSingle();
      }
      return leanRes;
    })(),
    // Viewer row — is_internal gates the `?suri=preview` override;
    // reminders_enabled feeds fetchUpcomingItems. Fail-soft to nulls.
    (async () => {
      try {
        return await supabase
          .from('users')
          .select('is_internal, reminders_enabled')
          .eq('user_id', user.id)
          .maybeSingle();
      } catch (caught) {
        logQueryError(
          'EventDashboard (viewer users SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null } as never;
      }
    })(),
    fetchGuestsByEvent(supabase, eventId).catch((err: unknown) => {
      logQueryError(
        'EventDashboard (fetchGuestsByEvent threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchGuestsByEvent>>;
    }),
    // Vendor picks — lean select (this surface needs no enrichment columns).
    (async () => {
      try {
        return await supabase
          .from('event_vendors')
          .select('vendor_id, vendor_name, category, status, total_cost_php, marketplace_vendor_id')
          .eq('event_id', eventId)
          .is('archived_at', null)
          .order('created_at', { ascending: true });
      } catch (caught) {
        logQueryError(
          'EventDashboard (event_vendors SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    // Paid + fulfilled orders — the committed number + the Services card.
    (async () => {
      try {
        return await supabase
          .from('orders')
          .select('order_id, service_key, requested_total_php, confirmed_total_php, status')
          .eq('event_id', eventId)
          // Exclude the vendor-payer booking-fee order — the couple's committed
          // number + Services card must never show what their vendor is charged.
          .or(COUPLE_ORDERS_HIDE_VENDOR_FILTER)
          .in('status', ['paid', 'fulfilled']);
      } catch (caught) {
        logQueryError(
          'EventDashboard (paid orders SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    // Pending-payment orders — the "Settle a payment" decision group. The
    // cockpit intentionally omits this kind (the Overview never loads unpaid
    // orders); this surface loads it with one lean query.
    (async () => {
      try {
        return await supabase
          .from('orders')
          .select('order_id, service_key, requested_total_php, reference_code, status')
          .eq('event_id', eventId)
          // 🔴 BOTH UNPAID STATES, NOT JUST ONE. `awaiting_payment` is real, but
          // almost nothing WRITES it — one admin action does (payments/actions.ts,
          // bouncing an order back for better proof). Every mint in the app —
          // onboarding, the studio buy paths, checkout, booking fees, vendor add-ons
          // — writes `submitted`. Prod holds exactly one order and it is `submitted`.
          //
          // 🔑 THE EARLIER CORRECTION STOPPED ONE STEP SHORT. This filter used to be
          // the non-existent 'pending_payment', which threw 22P02 and degraded to
          // []. That was fixed to a REAL enum member — and never checked against the
          // member the app actually mints, so it kept reading empty for the ordinary
          // case. A fix that makes a query legal is not a fix that makes it true.
          // (`add-on-state`, `entitlements`, `vendor-booking-fees.server` and
          // `ugat/data` all already ask for both.)
          .in('status', ['submitted', 'awaiting_payment']);
      } catch (caught) {
        logQueryError(
          'EventDashboard (pending orders SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    // Sponsors — the fill-a-role decision group via the cockpit model.
    (async () => {
      try {
        return await supabase
          .from('event_sponsors')
          .select('sponsor_tier, invitation_status')
          .eq('event_id', eventId);
      } catch (caught) {
        logQueryError(
          'EventDashboard (event_sponsors SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    // Paperwork pipeline — Finalizing-stage items + cockpit deadlines.
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
          'EventDashboard (event_paperwork SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    // Conversations tile — THIS event's unread vendor threads only, via the
    // grouped `unread_message_threads_by_event()` RPC. NOT the account-wide
    // notification count: that flat number surfaced onboarding/system noise
    // from every surface as "32 unread" on a couple with zero vendors, which
    // read as false vendor urgency. Event-scoped keeps the doorstep honest.
    fetchEventUnreadCounts(supabase)
      .then((m) => m.get(eventId) ?? 0)
      .catch((err: unknown) => {
        logQueryError(
          'EventDashboard (fetchEventUnreadCounts threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return 0;
      }),
    // Seat-plan assignment count — one cheap head query for the Finalizing stage.
    (async () => {
      try {
        return await supabase
          .from('event_seat_assignments')
          .select('assignment_id', { count: 'exact', head: true })
          .eq('event_id', eventId);
      } catch (caught) {
        logQueryError(
          'EventDashboard (event_seat_assignments count threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null, count: 0 } as never;
      }
    })(),
    // Schedule blocks — the couple's OWN day-of program (event_schedule_blocks)
    // for the "Schedule" doorstep card. Distinct from the deadline/reminder
    // stream (fetchUpcomingItems). fetchScheduleBlocks throws on a query error,
    // so fail-soft to [] → the card shows the build-your-timeline empty state.
    fetchScheduleBlocks(supabase, eventId).catch((err: unknown) => {
      logQueryError(
        'EventDashboard (fetchScheduleBlocks threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return [] as ScheduleBlockRow[];
    }),
    // Hosts — every account managing this event (owner couple rows +
    // event_moderators hosts and pending invites) for the Hosts doorstep
    // card. Admin client on purpose: co-hosts' names live in `users`, which
    // RLS scopes to self, and event_moderators mirrors the hosts page's
    // admin-read pattern. Fail-soft to [] like every other card feed.
    (async (): Promise<HostAccountView[]> => {
      try {
        const [membersRes, modsRes] = await Promise.all([
          adminClient
            .from('event_members')
            .select('user_id')
            .eq('event_id', eventId)
            .eq('member_type', 'couple'),
          adminClient
            .from('event_moderators')
            .select(
              'moderator_id, user_id, role_subtype, display_label, invitation_email, accepted_at, invitation_token',
            )
            .eq('event_id', eventId)
            .is('removed_at', null)
            .order('accepted_at', { ascending: true }),
        ]);
        const members = (membersRes.data ?? []) as Array<{ user_id: string }>;
        const mods = (modsRes.data ?? []) as Array<{
          moderator_id: string;
          user_id: string | null;
          role_subtype: string;
          display_label: string | null;
          invitation_email: string | null;
          accepted_at: string | null;
          invitation_token: string | null;
        }>;
        const acceptedMods = mods.filter((m) => m.accepted_at);
        const pendingMods = mods.filter((m) => !m.accepted_at && m.invitation_token);
        // An accepted host may also hold an event_members row — keep the
        // richer moderator row (it carries the role) and drop the duplicate.
        const acceptedIds = new Set(acceptedMods.map((m) => m.user_id).filter(Boolean));
        const owners = members.filter((m) => !acceptedIds.has(m.user_id));
        const userIds = [
          ...owners.map((m) => m.user_id),
          ...acceptedMods
            .map((m) => m.user_id)
            .filter((id): id is string => !!id),
        ];
        let usersById: Record<string, { display_name: string | null; email: string | null }> = {};
        if (userIds.length > 0) {
          const { data: userRows, error: userRowsError } = await adminClient
            .from('users')
            .select('user_id, display_name, email')
            .in('user_id', userIds);
          // ⚠ the names behind the event's people. Refused, real members render unnamed.
          if (userRowsError) {
            logQueryError('EventDashboard.userRows', userRowsError, {}, 'graceful_degrade');
          }
          usersById = Object.fromEntries(
            (
              (userRows ?? []) as Array<{
                user_id: string;
                display_name: string | null;
                email: string | null;
              }>
            ).map((u) => [u.user_id, { display_name: u.display_name, email: u.email }]),
          );
        }
        const modRoleLabel = (m: { role_subtype: string; display_label: string | null }) =>
          m.display_label ??
          (isRoleSubtype(m.role_subtype) ? ROLE_SUBTYPE_LABEL[m.role_subtype] : 'Host');
        return [
          ...owners.map((m) => ({
            key: `member-${m.user_id}`,
            name:
              usersById[m.user_id]?.display_name ??
              usersById[m.user_id]?.email ??
              'Event owner',
            roleLabel: 'Owner',
            state: 'active' as const,
          })),
          ...acceptedMods.map((m) => ({
            key: m.moderator_id,
            name:
              (m.user_id
                ? (usersById[m.user_id]?.display_name ?? usersById[m.user_id]?.email)
                : null) ??
              m.invitation_email ??
              'Host',
            roleLabel: modRoleLabel(m),
            state: 'active' as const,
          })),
          ...pendingMods.map((m) => ({
            key: m.moderator_id,
            name: m.invitation_email ?? 'Invitation sent',
            roleLabel: modRoleLabel(m),
            state: 'invited' as const,
          })),
        ];
      } catch (caught) {
        logQueryError(
          'EventDashboard (host accounts fetch threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return [] as HostAccountView[];
      }
    })(),
    // Papic on home (PR-G · owner picked options A + B on 2026-07-30). ONE
    // resolver feeds BOTH the mini-tile below and the "your free camera is ready"
    // nudge the Home mounts in slotAfterBento, so the two can never disagree —
    // and it rides this existing batch rather than adding a round-trip. Returns
    // null (⇒ neither surface renders) when the event has no Papic signal at all.
    resolvePapicHomeTile(adminClient, eventId, canViewPapicCounts),
    // Checklist completion for the doorway chip (§ 2.3b). Head-counts only —
    // no rows, no seeding. Returns null on a failed read AND on a never-seeded
    // event, which is why the chip is absent rather than "0%" in both cases.
    fetchChecklistProgress(supabase, eventId),
    // ── Unacknowledged vendor deliveries (the "Meanwhile" card) ─────────────
    // ⚠ THE DESIGN NAMED THE WRONG SOURCE. The frame points at `alaala/`, which
    // its own docblock says holds "no per-event data yet" — it is catalog-driven.
    // `booking_handovers` is the row that actually means "a vendor delivered
    // something you have not looked at".
    //
    // 🔑 USER CLIENT, NOT ADMIN, DELIBERATELY. RLS here is couple-on-event
    // (`current_event_ids`), so a coordinator or moderator viewing this page is
    // denied → empty → the card hides. For THIS card that fail-direction is
    // correct: a vendor's delivery is the couple's business, and an RLS denial
    // being indistinguishable from "nothing waiting" is the safe way round.
    // (It would be the WRONG way round for a counter — see the zero≠failed rule.)
    supabase
      .from('booking_handovers')
      .select('handover_id, event_vendor_id, kind, label, delivered_at')
      .eq('event_id', eventId)
      .eq('status', 'delivered')
      .is('couple_acknowledged_at', null)
      .order('delivered_at', { ascending: false })
      .limit(4),

  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const base = `/dashboard/${eventId}`;
  const eventType = (event.event_type as string | null) ?? 'wedding';

  /*
    ─── THE FOCAL CARD CARRIES A PHOTOGRAPH ─────────────────────────────────

    The account home has shown a picture of each celebration since 2026-07-30
    (owner: *"we want a better card for events… let them get to imagine what the
    events are"*). Opening the celebration itself then dropped to a card of pure
    text — the one screen a couple lives in was the one with nothing of theirs
    on it.

    🔑 NOTHING IS DRAWN HERE. `EventScene` already ships and already owns the
    whole precedence: the couple's OWN hero photo untouched → the per-type stock
    photo under a per-event treatment → a deterministic branded gradient. It is
    reused, not reimplemented, so this card and the home card can never disagree
    about which picture an event has.

    🔒 AND "ONE OBSIDIAN PER VIEW" STILL HOLDS. The band sits INSIDE the
    existing dark card rather than becoming a second dark surface, and it does
    not touch `.sn-tile-dark` — which has seven consumers across the app.

    ⚠ FAIL-SOFT, BOTH LAYERS. A vocab read that throws leaves the repo asset
    path; an unsigned or non-image `landing_page_hero_image_url` is narrowed
    away by `renderableImageSrc` before it can reach an `<img src>` (the column
    is host-writable straight through PostgREST). Either way the scene still
    renders — worst case the branded gradient.
  */
  const typeHeroSrc = await (async () => {
    try {
      const vocab = await getEventTypeVocab();
      const match = vocab.find((t) => t.key === eventType);
      if (match) return eventTypePhotoSrc(match);
    } catch {
      // Graceful-degrade to the repo asset, exactly as the home board does.
    }
    return `/event-types/${eventType}.webp`;
  })();
  const ownHeroSrc = await (async () => {
    const stored = (event.landing_page_hero_image_url as string | null) ?? null;
    if (!stored) return null;
    try {
      return renderableImageSrc(await displayUrlForStoredAsset(stored));
    } catch {
      return null;
    }
  })();
  const eventWord = eventType === 'wedding' ? 'wedding' : 'event';

  // ── VENDOR-FREE EVENT TYPES (0053 · `marketplace_enabled`) ─────────────────
  //
  // The 2026-06-27 Simple Event build gated the NAV — `hideKeys` on
  // buildCustomerMenuTree + buildCustomerNavGroups drop Explore / Vendors /
  // Budget — but nothing gated THIS surface's body. So a vendor-free event's
  // Overview opened on: "Lock your reception venue → Browse reception venues"
  // as its ONE open decision, "Book a vendor · 21 categories still open", a
  // Setnayan AI card offering to build a venue shortlist, and "start with the
  // ones that book out first: your venue and catering" — every one of them a
  // door to a marketplace this event type does not have.
  //
  // It also produced the tell that something was wrong: "overdue by 315 days"
  // on an event created minutes earlier. That is not a date bug — the wizard's
  // lead-time model says book a venue ~a year out, so a 50-day-out event is
  // "overdue" by the difference. The arithmetic was right; asking the question
  // at all was the error.
  //
  // DERIVED, never named by type: `marketplaceEnabled` is the existing column
  // that encodes vendor-free (SIMPLE_PROFILE sets it false), so a FUTURE
  // vendor-free type is covered without touching this file. Same house rule as
  // lib/papic-event-access.ts and the onboarding services step's AI gate.
  const [profile, planGroupScope] = await Promise.all([
    resolveProfileByEvent(eventId),
    // One extra read, in the same await — the tier-2 allow-lists that say which
    // bookable categories this event type actually has.
    fetchPlanGroupScope(supabase),
  ]);
  const marketplaceEnabled = profile.marketplaceEnabled === true;
  const displayName =
    (event as { display_name?: string | null }).display_name ??
    (eventType === 'wedding' ? 'Your wedding' : 'Your event');

  // Precision resolution — the single source of truth for "is there a firm,
  // countdown-worthy day?" A present `event_date` with a NULL precision column
  // is a real committed day: migration 20260603100000's own backfill rule is
  // "event_date present ⇒ 'day'", and the sibling readers (details/vendors)
  // already default null → 'day'. The old bare `'year'` default here made any
  // dated event whose precision column was null resolve to daysOut=null, so the
  // focal rendered "—" while its date line said "The date is locked" (owner
  // screenshot, 2026-07-15). Only genuine year/month placeholders (first-of-
  // range dates) stay date-less for the countdown.
  const rawPrecision = (event as { event_date_precision?: string | null })
    .event_date_precision;
  const eventDatePrecision: EventDatePrecision =
    rawPrecision === 'day' || rawPrecision === 'month' || rawPrecision === 'year'
      ? rawPrecision
      : event.event_date
        ? 'day'
        : 'year';
  const venueTz = (event as { timezone?: string | null }).timezone ?? undefined;
  const daysOut = eventDatePrecision === 'day' ? daysUntil(event.event_date, venueTz) : null;
  /*
    THE CELEBRATION HAS ALREADY HAPPENED — handed down, not worked out here.
    Everything below that states something about work still to do is gated on
    it. See the prop's docblock for why this is not derived from `daysOut`.
  */
  const eventHasHappened = lifecyclePhase === 'after';
  // ONE firm-date predicate shared by the focal's date line AND its countdown
  // numeral so they can never disagree again (the "locked" vs "no firm date
  // yet" split that produced bug 2).
  const hasFirmDate = eventDatePrecision === 'day' && Boolean(event.event_date);

  const stats = computeGuestStats(guests);

  // 🔑 THE CATCH ABOVE THESE READS CAN NEVER FIRE. Supabase RESOLVES with
  // `{ error }` instead of throwing, so a refused query never reaches a
  // `catch` — it arrives here as `data: null`, `?? []` turns it into an empty
  // list, and every total below is computed from nothing. The try/catch is
  // kept (it still catches a genuine throw), but the ERROR is what actually
  // needed reading, and nothing read it.
  const vendorsMeasured = !eventVendorsRes.error;
  const eventVendors = (eventVendorsRes.data ?? []) as Array<{
    vendor_id: string;
    vendor_name: string;
    category: VendorCategory;
    status: string | null;
    total_cost_php: number | string | null;
    marketplace_vendor_id: string | null;
  }>;

  // ---- "Meanwhile" — a vendor delivered something the couple hasn't opened ---
  // Names come from the eventVendors array already loaded above; the id is the
  // event_vendors PK, which is what the workspace route's [vendorId] expects.
  // ⚠ booking_handovers.event_vendor_id carries NO foreign key (the decoupled
  // pattern), so a name can legitimately be missing — the copy falls back to
  // "Your vendor" rather than rendering "undefined delivered your gallery".
  const handovers = (handoversRes.data ?? []) as Array<{
    handover_id: string;
    event_vendor_id: string;
    kind: 'gallery_link' | 'file' | 'note' | 'signoff';
    label: string | null;
    delivered_at: string | null;
  }>;
  const latestHandover = handovers[0] ?? null;
  const handoverVendorName = latestHandover
    ? (eventVendors.find((v) => v.vendor_id === latestHandover.event_vendor_id)?.vendor_name ??
       'Your vendor')
    : null;

  // ---- Committed budget — same formula as the Overview (paid + fulfilled
  // orders plus every contracted-or-better vendor with a known cost). --------
  const ordersMeasured = !paidOrdersRes.error;
  const paidOrders = (paidOrdersRes.data ?? []) as Array<{
    order_id: string;
    service_key: string | null;
    requested_total_php: number | string | null;
    confirmed_total_php: number | string | null;
    status: string | null;
  }>;
  const paidOrdersTotalPhp = paidOrders.reduce<number>((acc, r) => {
    const confirmed = r.confirmed_total_php !== null ? Number(r.confirmed_total_php) : null;
    const requested = r.requested_total_php !== null ? Number(r.requested_total_php) : null;
    const amount = confirmed ?? requested ?? 0;
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const contractedVendorsTotalPhp = eventVendors.reduce<number>((acc, row) => {
    if (!CONFIRMED_VENDOR_SET.has(row.status ?? '')) return acc;
    const cost = row.total_cost_php !== null ? Number(row.total_cost_php) : 0;
    return acc + (Number.isFinite(cost) ? cost : 0);
  }, 0);
  const committedCentavos = Math.round(
    (paidOrdersTotalPhp + contractedVendorsTotalPhp) * 100,
  );
  // `committed` is the SUM of both reads, so either refusal understates it —
  // and the tile renders whenever a budget target exists, so a couple who set
  // one was shown "₱0 committed" against it with a 0% ring. A number that is
  // silently short is worse than no number: it reads as progress they have not
  // made, on the screen they check to decide what they can still afford.
  const committedMeasured = vendorsMeasured && ordersMeasured;
  const budgetTargetCentavos =
    (event as { estimated_budget_centavos?: number | string | null })
      .estimated_budget_centavos != null
      ? Number(
          (event as { estimated_budget_centavos?: number | string | null })
            .estimated_budget_centavos,
        )
      : null;

  // ---- Lock counts + the resolver's #1 task (same libs as the Overview). ---
  //
  // Gated at the SOURCE rather than at each render site. The vendor booking
  // model is a lead-time ladder over PLAN_GROUPS — "book the venue ~a year
  // out", "caterer by N days" — and on a vendor-free type every one of those
  // categories is permanently unbookable. Feeding zeros in here means the
  // cockpit derives no vendor decisions, the board grows no vendor groups, the
  // digest counts none, and "overdue by N days" cannot be computed for a
  // category that will never be booked. One gate, instead of one per surface
  // and a new one every time a surface is added.
  const vendorRowInputs = marketplaceEnabled
    ? (eventVendors as ReadonlyArray<EventVendorRowInput>)
    : ([] as ReadonlyArray<EventVendorRowInput>);
  // THIS EVENT TYPE'S ladder, not the wedding one. `PLAN_GROUPS` is a hardcoded
  // wedding list (ceremony_venue · bridal_car · rings · officiant), and every
  // counter here iterated it for all 16 types — so a BIRTHDAY was told "21
  // categories still open" with "Lock your reception venue" on top.
  //
  // The per-type map already exists, is fully populated and is owner-editable:
  // `service_categories.applicable_event_types`, maintained from
  // /admin/event-types/<type>/categories. 72 of 73 tier-2 rows are scoped
  // (`bridal_car → [wedding]`, `ceremony_venue → [wedding, christening]`).
  // The marketplace and Shortlist have read it for a while; this surface never
  // did. So this is WIRING, not new taxonomy — joined on the key the two
  // already share (`PlanGroup.catalogTile` is a `service_categories.id`).
  //
  // Fail-OPEN throughout (see the module header): unknown ⇒ applies. Wrongly
  // including a category costs a slightly long checklist; wrongly excluding one
  // means a couple is never reminded to book their venue.
  const eventPlanGroups = planGroupsForEventType(eventType, planGroupScope);
  const remainingTaskCount = marketplaceEnabled
    ? countUnlockedCategories(vendorRowInputs, eventPlanGroups)
    : 0;
  const totalLockableCategories = marketplaceEnabled
    ? eventPlanGroups.filter((g) => g.countsTowardLockable !== false).length
    : 0;
  const lockedVendorCount = Math.max(0, totalLockableCategories - remainingTaskCount);
  // "Today's one thing" is a booking deadline computed BACKWARDS from the event
  // date. Past it, every deadline is behind you, so the picker returns the most
  // overdue category — i.e. it hands a finished celebration a job to do.
  const topPriorityTask =
    marketplaceEnabled && !eventHasHappened && event.event_date && eventDatePrecision === 'day'
      ? pickTodaysOneThing(vendorRowInputs, event.event_date, now, eventPlanGroups)
      : null;

  const paperworkRows = (paperworkRes.data ?? []) as PaperworkRow[];
  const paperworkSummary = summarizePaperwork(paperworkRows, event.event_date);

  const sponsorRows = (sponsorsRes.data ?? []) as Array<{
    sponsor_tier: string | null;
    invitation_status: string | null;
  }>;

  const pendingOrders = (pendingOrdersRes.data ?? []) as Array<{
    order_id: string;
    service_key: string | null;
    requested_total_php: number | string | null;
    reference_code: string | null;
    status: string | null;
  }>;

  const seatedGuests = seatAssignmentsRes.count ?? 0;

  // ---- Setnayan AI gating — the Overview's exact resolution, plus the
  // internal-only `?suri=preview` render override. -------------------------
  const aiPaywallEnabled = await resolveSetnayanAiPaywallEnabled();
  const aiEntitled = isSetnayanAiActiveForEvent(
    event as { planning_mode?: string | null; setnayan_ai_active?: boolean | null },
    { paywallEnabled: aiPaywallEnabled },
  );
  const viewerIsInternal =
    (viewerRes.data as { is_internal?: boolean | null } | null)?.is_internal === true;
  const suriPreview = suriPreviewParam === 'preview' && viewerIsInternal;
  // cockpitEnabled() is the owner's kill switch for this whole surface. It had
  // ZERO importers until 2026-08-06 — its own docblock claimed "the cockpit
  // renders ONLY when this returns true" while nothing consulted it, so the
  // owner held a lever connected at neither end. It ANDs in last and can only
  // ever remove the surface, never grant it: entitlement still decides who is
  // allowed, this decides whether it may render at all. Defaults ON, so this
  // line changes nothing until someone sets the variable to '0'.
  const aiActive = (aiEntitled || suriPreview) && cockpitEnabled();

  // ---- Upcoming items — the Schedule card + the AI What's-next rail. ------
  const remindersEnabled =
    (viewerRes.data as { reminders_enabled?: boolean | null } | null)?.reminders_enabled ??
    true;
  const upcoming = await (async () => {
    try {
      return await fetchUpcomingItems({
        supabase,
        eventId,
        eventDate: event.event_date,
        ceremonyType: (event as { ceremony_type?: string | null }).ceremony_type,
        now,
        remindersEnabled,
        statutory: eventType === 'wedding',
        limit: 8,
      });
    } catch (caught) {
      logQueryError(
        'EventDashboard (fetchUpcomingItems threw)',
        caught instanceof Error ? caught : new Error(String(caught)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return {
        items: [] as ReadonlyArray<UpcomingItem>,
        paymentItemsNext30d: [] as ReadonlyArray<UpcomingItem>,
        sourceCounts: {
          meeting: 0,
          schedule_block: 0,
          vendor_payment: 0,
          setnayan_sku_expiry: 0,
          document_deadline: 0,
          recommended_deadline: 0,
        },
      };
    }
  })();

  // ---- Cockpit model — pure derivation over data this surface already loaded
  // (same lib the Overview's dormant cockpit uses). Feeds the decisions board
  // + the Suri briefing. --------------------------------------------------
  const cockpitModel = buildCockpitModel(
    {
      eventId,
      daysOut,
      lockedVendorCount,
      totalLockableCategories,
      vendors: vendorRowInputs,
      sponsors: sponsorRows,
      topPriorityTask,
      paperwork: paperworkRows
        .filter((r) => r.status !== 'received' && r.status !== 'expired')
        .map((r) => ({
          id: r.id,
          label: PAPERWORK_DOCUMENT_META[r.document_type]?.label ?? 'Paperwork',
          dueIso:
            r.expected_completion_date ??
            paperworkCompleteByDate(r.document_type, event.event_date),
        })),
    },
    now,
  );

  // ---- Decisions board — cockpit decisions grouped by kind, plus the
  // pending-payment group this surface loads itself. ------------------------
  const byKind = (kind: CockpitDecision['kind']): DecisionItemView[] =>
    cockpitModel.decisions
      .filter((d) => d.kind === kind)
      .map((d) => ({
        id: d.id,
        label: d.label,
        sub: d.detail,
        /*
          D-5 · NO CHIP ON A "PICK" ROW — IT SAID THE SAME THING FOUR TIMES.

          The group heading is "Pick an option", the row's own label is "Pick
          your caterer", its sub-line is "3 options saved · none locked yet",
          and the chip then said "pick one". Three rows in that group put the
          same two words on screen three more times. The chip column is for a
          fact the row does not already carry; here there was none, and a chip
          that repeats its heading trains the eye to stop reading chips.

          The other two kinds keep theirs, because "not booked yet" and
          "awaiting confirmations" each say something the row does not.
        */
        chip:
          kind === 'pick'
            ? null
            : kind === 'start'
              ? 'not booked yet'
              : 'awaiting confirmations',
        chipTone: (kind === 'start' ? 'warm' : 'calm') as 'warm' | 'calm',
        ctaLabel: d.ctaLabel,
        href: d.href,
      }));

  const payItems: DecisionItemView[] = pendingOrders.map((o) => {
    const amount = o.requested_total_php !== null ? Number(o.requested_total_php) : 0;
    return {
      id: `pay:${o.order_id}`,
      label: serviceLabel(o.service_key),
      sub: o.reference_code ? `Order placed · ref ${o.reference_code}` : 'Order placed · payment pending',
      chip: Number.isFinite(amount) && amount > 0 ? `${formatPeso(Math.round(amount * 100))} pending` : 'payment pending',
      chipTone: 'hot',
      ctaLabel: 'Settle payment',
      href: `${base}/orders`,
    };
  });

  const groupsUnordered: DecisionGroupView[] = ([
    {
      id: 'book',
      title: 'Book a vendor',
      sub:
        remainingTaskCount === 1
          ? '1 category still open'
          : `${remainingTaskCount} categories still open`,
      items: byKind('start'),
    },
    {
      id: 'pick',
      title: 'Pick an option',
      sub: 'Saved options waiting on a lock',
      items: byKind('pick'),
    },
    {
      id: 'pay',
      title: 'Settle a payment',
      sub: payItems.length === 1 ? '1 waiting' : `${payItems.length} waiting`,
      items: payItems,
    },
    {
      id: 'role',
      title: 'Fill a role',
      sub: 'Key people your ceremony needs',
      items: byKind('role'),
    },
  ] satisfies DecisionGroupView[])
    .filter((g) => g.items.length > 0)
    /*
      ⚠ AFTER THE CELEBRATION, THREE OF THESE FOUR ARE ADVICE ABOUT A DAY THAT
      HAS PASSED — "Book a vendor", "Pick an option", "Fill a role", each of
      them stamped with a deadline it is now permanently past. `Settle a
      payment` STAYS: a bill is still a bill the morning after, and hiding it
      would be the opposite mistake.
    */
    .filter((g) => !eventHasHappened || g.id === 'pay');

  // AI re-rank: payments + the urgent booking first; free state keeps the
  // natural book → pick → pay → role order. Both deterministic.
  // ---- Fold the AI "What's next" rail INTO the board (council verdict § 3:
  // "Suri-ranked; What's next folds in"). It used to be a separate horizontal
  // scroller below the board, which made the doorstep ask the couple to read
  // two ranked lists and work out for themselves which one was the real one.
  // Dated items are decisions with a clock on them, so they become a group.
  //
  // The de-dup rule still holds: these are all "only you can resolve" items
  // (a payment falling due, a document deadline, a meeting). Nothing here is
  // inbox volume — unread still lives only on the Conversations tile.
  const deadlineGroup: DecisionGroupView | null =
    aiActive && upcoming.items.length > 0
      ? {
          id: 'deadline',
          title: 'Dates coming up',
          sub: 'In the order Suri would take them',
          items: upcoming.items.slice(0, 6).map((item: UpcomingItem) => ({
            id: `u:${item.id}`,
            label: item.title,
            sub: item.subtitle,
            chip: shortDate.format(item.date),
            // Urgency by how close it is — the same judgement the rail made
            // with its coloured dot, now expressed in the board's own vocabulary
            // so one row cannot look urgent in one place and calm in the other.
            chipTone:
              item.daysFromNow <= 3 ? 'hot' : item.daysFromNow <= 14 ? 'warm' : 'calm',
            ctaLabel: 'Open',
            // Every producer in lib/upcoming-items.ts sets an href; the fallback
            // exists so a future one that forgets degrades to the event home
            // rather than dropping the deadline out of the list silently.
            href: item.href ?? `${base}`,
          })),
        }
      : null;
  if (deadlineGroup) groupsUnordered.push(deadlineGroup);

  // 'deadline' is listed in BOTH orders on purpose: `order.indexOf` returns -1
  // for an unlisted id, which would sort it ABOVE everything else. Leaving it
  // out of the free order would make a stray group jump to the top of the board.
  const freeOrder: DecisionGroupView['id'][] = ['book', 'pick', 'pay', 'role', 'deadline'];
  const aiOrder: DecisionGroupView['id'][] = ['book', 'pay', 'pick', 'role', 'deadline'];
  const order = aiActive ? aiOrder : freeOrder;
  const decisionGroups = [...groupsUnordered].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const openDecisionCount = decisionGroups.reduce((acc, g) => acc + g.items.length, 0);
  // Flattened, group-ordered decision list — ONE source of data feeding both the
  // top-grid digest (top 3) AND the full board below (all of them, grouped). The
  // digest links to `#decisions` (the board), so there is no data drift.
  const flatDecisions = decisionGroups.flatMap((g) => g.items);

  // ---- FREE first-venue-shortlist offer (owner-locked 2026-07-09 ·
  // Pricing.md § 00 carve-out). Free (non-AI) state only, and ONLY while the
  // venue shortlist is EMPTY — any venue pick (Suri-built or manual) consumes
  // it; the shortlist state itself records consumption. When the venue
  // decision item renders (the resolver's 'start'/'pick' on reception_venue),
  // the offer embeds under it; otherwise it stands alone atop the board. ----
  //
  // ⚠ `marketplaceEnabled` FIRST. This offer is Setnayan AI's free introduction
  // ("let Suri build your first venue shortlist"), and the owner's 2026-07-27
  // lock is explicit that Setnayan AI is *not offered at all* on a vendor-free
  // type — not free, not paid — because all nine of its capabilities are
  // vendor-centric, which makes the card a fake door. The onboarding services
  // step already derives this correctly (`readServicesStepView` returns
  // `ai: null` on marketplaceEnabled=false); this surface did not, so a Simple
  // Event was quoted a venue shortlist AND a subscription price the type can
  // never buy.
  const venueOfferAvailable =
    marketplaceEnabled && !aiActive && isFirstVenueShortlistOfferAvailable(eventVendors);
  const venueOfferInline =
    venueOfferAvailable &&
    decisionGroups.some((g) => g.items.some((i) => isSuriAssistFreeDecisionId(i.id)));

  // ---- Journey stages (pure lib — see lib/progress-stages.ts). ------------
  const stageModel = buildProgressStages({
    eventType,
    ceremonyType: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
    eventDate: event.event_date,
    datePrecision: eventDatePrecision,
    daysOut,
    venueName: (event as { venue_name?: string | null }).venue_name ?? null,
    paletteFinalizedAt:
      (event as { palette_finalized_at?: string | null }).palette_finalized_at ?? null,
    budgetTargetCentavos,
    guestsTotal: stats.total,
    guestsAttending: stats.attending,
    guestsResponded: stats.attending + stats.declined + stats.maybe,
    lockedVendorCount,
    totalLockableCategories,
    seatedGuests,
    paperworkTotal: paperworkSummary.total,
    paperworkReceived: paperworkSummary.received,
    pendingPaymentCount: pendingOrders.length,
    activeServiceCount: paidOrders.length,
  });
  // ---- "Suri on watch" — render-only pass through the pure trigger engine,
  // fed ONLY what this surface already loaded (payments due + budget). -------
  let watchItems: Array<{ intervention: Intervention; copy: string }> = [];
  if (aiActive) {
    // GRD-03 price + GRD-09 availability — the SAME vendor-history join the
    // notify snapshot runs, so the in-app rail shows these two too (not just
    // notifications). Uses the admin client (the price-history table is RLS'd
    // away from the couple). Fail-soft to empty.
    const changeSignals = await loadVendorChangeSignals(
      adminClient,
      eventVendors.map((v) => ({ id: v.marketplace_vendor_id, name: v.vendor_name })),
      event.event_date,
      now,
    ).catch(() => ({ priceChanges: [], availability: [] }));
    const snapshot: PlanningSnapshot = {
      eventType,
      payments: upcoming.paymentItemsNext30d.map((item) => ({
        vendor: item.vendorBusinessName ?? item.subtitle,
        amountPhp: item.amountCentavos != null ? item.amountCentavos / 100 : 0,
        dueDate: item.date.toISOString().slice(0, 10),
        paid: false,
      })),
      statutory: [],
      shortlist: [],
      priceChanges: changeSignals.priceChanges,
      contracts: [],
      inquiries: [],
      budget:
        budgetTargetCentavos !== null && budgetTargetCentavos > 0
          ? {
              totalPhp: budgetTargetCentavos / 100,
              committedPhp: committedCentavos / 100,
              pendingPhp: pendingOrders.reduce((acc, o) => {
                const n = o.requested_total_php !== null ? Number(o.requested_total_php) : 0;
                return acc + (Number.isFinite(n) ? n : 0);
              }, 0),
            }
          : null,
      dateClusters: [],
      // GRD-06 clash — the same pure detection the notify snapshot uses, over
      // the run-of-show blocks this surface already loaded.
      scheduleClash: scheduleClashesFromBlocks(clashBlocksFromScheduleRows(scheduleBlocks)),
      // GRD-09 availability — same signals as the notify snapshot (loaded above).
      availability: changeSignals.availability,
    };
    watchItems = applyRestraint(runTriggers(snapshot, now), { maxProactive: 4 }).map(
      (intervention) => ({
        intervention,
        copy: renderTemplate(
          intervention.templateId,
          intervention.slots,
          WEDDING_TERMINOLOGY,
          intervention.variant ?? 'default',
        ),
      }),
    );
  }

  // ---- Around your event — the four doorstep cards. ------------------------
  const teamVendors = eventVendors.filter((v) =>
    CONFIRMED_VENDOR_SET.has(v.status ?? ''),
  );
  // Urgent-float: pending-payment orders (warm/amber) lead so they land in the
  // visible slice(0, 4); the paid/fulfilled roster follows. The couple always
  // sees what still needs settling without expanding the tile. The pay CTA
  // itself lives once, in the Decisions board (inbox/roster ≠ decision).
  const serviceRows = [
    ...pendingOrders.map((o) => ({
      id: o.order_id,
      label: serviceLabel(o.service_key),
      status: 'payment pending',
      tone: 'warm' as const,
    })),
    ...paidOrders.map((o) => ({
      id: o.order_id,
      label: serviceLabel(o.service_key),
      status: o.status === 'fulfilled' ? 'delivered' : 'active',
      tone: 'ok' as const,
    })),
  ];

  // Schedule doorstep card — the couple's own program. Prefer upcoming top-level
  // blocks; fall back to the earliest when the whole program is already past so
  // the card never reads empty while blocks exist (see selectSchedulePreviewBlocks).
  const schedulePreview = selectSchedulePreviewBlocks(scheduleBlocks, now);

  // ── Presentation — the Atelier-Glass kit (rollout plan § 1.2). The old
  //    m-card + retired-wine `mulberry` gradient skin (R7 — half-broken since
  //    mulberry re-pointed to gold) is gone; panels are `.sn-tile`, the focal is
  //    `.sn-tile-dark`, rows are `.sn-row`. Warm-semantic chip tones are inline
  //    styles so they map to the sn semantic vars, not the mulberry remap. ─────
  const chipToneStyle: Record<
    'hot' | 'warm' | 'calm' | 'ok',
    { color: string; background: string }
  > = {
    hot: { color: 'var(--sn-warning)', background: 'var(--sn-warning-soft)' },
    warm: { color: 'var(--sn-gold-700)', background: 'var(--sn-gold-100)' },
    calm: { color: 'var(--sn-info)', background: 'var(--sn-info-soft)' },
    ok: { color: 'var(--sn-success)', background: 'var(--sn-success-soft)' },
  };
  // Gold ✦ prefixing the AI-state section heads — jewelry, not paint.
  const spark = aiActive ? (
    <span
      aria-hidden
      className="mr-1.5 align-[0.18em] text-[0.72em]"
      style={{ color: 'var(--sn-gold-500)' }}
    >
      ✦
    </span>
  ) : null;

  const budgetPct =
    budgetTargetCentavos && budgetTargetCentavos > 0
      ? (committedCentavos / budgetTargetCentavos) * 100
      : 0;
  // Phase 4 — the four-state RSVP split for the segmented bar. Replaces the
  // single `attending / total` percentage the old ring drew: that one number
  // could not distinguish a settled "no" from a silence, which are the two the
  // host acts on differently.
  const guestSegments = rsvpSegments(stats);
  /** Have ANY replies come back yet? The honesty gate for the unanswered-RSVP row:
   *  before the first reply, a roster nobody has invited must not be nagged. */
  const rsvpRepliesStarted = stats.attending + stats.declined + stats.maybe > 0;

  /*
    THE GOLD BAR COUNTS VENDOR CATEGORIES LOCKED — AND NOW SAYS SO.

    🚨 IT USED TO BE CAPTIONED "% planned", and so is the figure on the account
    home. They are two different measures wearing one word: home reports the
    event CHECKLIST's real done/total, this one reports the locked share of
    vendor categories. Neither is broken. Both are right about their own
    question. Side by side they simply contradicted each other, and a person
    reading two numbers under one label concludes the product is confused about
    their wedding.

    🔑 THE HONEST CAPTION ALREADY SHIPS TWICE for this exact value —
    `setnayan-ai-value.tsx` and `lib/setnayan-ai-activity.ts` both say
    "% locked in". Reusing their words rather than inventing a third phrase for
    a number the product already knows how to name. Home is untouched: once the
    two stop sharing a word they cannot contradict each other.

    ⛔ AND IT IS DELIBERATELY *NOT* "compute it once and show it everywhere".
    That requires deciding WHICH measure is the real answer to "how planned is
    this wedding" — a product ruling, and making it inside a caption fix is
    exactly how this project acquires a lock nobody remembers agreeing to.
  */
  const lockedInPct = Math.max(0, Math.min(100, cockpitModel.briefing.lockedPct));
  // One obsidian per view (§ 1.3): the "Big Day" focal is dark EXCEPT on the day
  // itself, where the DayOfModeGrid's "happening now" card owns the obsidian and
  // this focal steps down to a glass tile.
  // E2: a `guard` item is a warning, so the phone fold starts OPEN when one exists.
  const watchHasGuard = watchItems.some((w) => w.intervention.category === 'guard');
  const focalDark = !dayOfActive;
  // The focal's date line — the emotional anchor. Real event data or a muted
  // "to be set" (a no-date event still gets the SetDateNudge in slotAfterBento).
  const focalDateLabel = event.event_date
    ? (() => {
        const d = new Date(`${event.event_date}T00:00:00`);
        if (Number.isNaN(d.getTime())) {
          return eventType === 'wedding' ? 'Your date, once it’s set' : 'Date to be set';
        }
        // Match the date's real precision — a year/month placeholder must NOT
        // masquerade as a full "Friday, December 18" (which is what let the
        // coarse-precision case read as a locked day).
        if (eventDatePrecision === 'year') return String(d.getFullYear());
        if (eventDatePrecision === 'month') {
          return new Intl.DateTimeFormat('en-PH', {
            month: 'long',
            year: 'numeric',
          }).format(d);
        }
        return new Intl.DateTimeFormat('en-PH', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(d);
      })()
    : eventType === 'wedding'
      ? 'Your date, once it’s set'
      : 'Date to be set';
  const focalVenue = (event as { venue_name?: string | null }).venue_name ?? null;
  // Chip pills inside the focal (AI briefing) — glass-on-dark vs gold-on-glass.
  const focalChipStyle = focalDark
    ? {
        border: '1px solid rgba(255,255,255,.2)',
        background: 'rgba(255,255,255,.1)',
        color: '#F3ECDF',
      }
    : {
        border: '1px solid var(--sn-gold-500)',
        background: 'var(--sn-gold-100)',
        color: 'var(--sn-gold-800)',
      };
  const focalHeadColor = focalDark ? '#FFFFFF' : 'var(--sn-ink-900)';
  const focalSubColor = focalDark ? 'rgba(253,251,247,.65)' : 'var(--sn-ink-500)';

  // ── Inspector column selection (desktop, ≥xl) ───────────────────────────
  // Resolve `?inspect=` to a decision (`d:<id>`) or a Suri-on-watch (`w:<key>`)
  // row already on this page. An unknown/stale id resolves to nothing → the
  // inspector renders closed (hasSelection=false). The body is a new
  // presentation of the SAME facts + the SAME action (a decision's own CTA);
  // watch rows carry no action today, so their inspector carries none either.
  let inspectorBody: ReactNode = null;
  if (inspectId) {
    if (inspectId.startsWith('d:')) {
      for (const g of decisionGroups) {
        const item = g.items.find((it) => `d:${it.id}` === inspectId);
        if (item) {
          inspectorBody = (
            <OverviewDecisionInspector
              swapKey={inspectId}
              groupTitle={g.title}
              groupSub={g.sub}
              label={item.label}
              sub={item.sub}
              chip={item.chip}
              chipStyle={chipToneStyle[item.chipTone]}
              ctaLabel={item.ctaLabel}
              href={item.href}
            />
          );
          break;
        }
      }
    } else if (inspectId.startsWith('w:')) {
      const watch = watchItems.find(
        (w) => `w:${w.intervention.dedupeKey}` === inspectId,
      );
      if (watch) {
        inspectorBody = (
          <OverviewWatchInspector
            swapKey={inspectId}
            category={watch.intervention.category}
            templateId={watch.intervention.templateId}
            copy={watch.copy}
          />
        );
      }
    }
  }
  // ── Top-grid right column · the 2×2 live minis (NAVIGATE) ───────────────
  // Real-data-or-nothing: each tile renders only when its own data exists, so a
  // fresh event never shows a fabricated "₱86,450"/"Casa Ibarra" sample. Blur
  // budget (§ 1.6): focal(1) + digest(1) + ≤4 minis + chrome(2) ≤ 8 above fold.
  const miniFoot = (label: string) => (
    <span
      className="mt-auto flex items-center gap-1 pt-3 text-[11.5px] font-bold"
      style={{ color: 'rgb(var(--color-link))' }}
    >
      {label} →
    </span>
  );
  const miniTiles: ReactNode[] = [];
  if (stats.total > 0) {
    miniTiles.push(
      <Link
        key="guests"
        href={`${base}/guests`}
        className="sn-tile sn-press flex flex-col text-left"
      >
        <span className="sn-eye">
          <Users aria-hidden strokeWidth={1.75} />
          Guests
        </span>
        <span className="mt-3 block font-mono text-[22px] font-bold leading-none text-ink">
          <CountUp value={stats.attending} delayMs={600} />
        </span>
        <span className="mt-0.5 block text-[11.5px] text-ink/55">
          {rsvpSummary(stats)}
        </span>
        {/* Phase 4 — the shape carries the composition (council verdict
         *  "shape-honest widgets"). A single ring could only ever say
         *  `attending / total`, which folded declined, maybe and never-replied
         *  into one grey remainder — three states that mean completely
         *  different things to a host. The segments are apportioned in
         *  lib/rsvp-segments.ts so the widths total exactly 100 and a state
         *  with even one person in it can never render at zero width. */}
        {guestSegments.length > 0 ? (
          <>
            <span
              role="img"
              aria-label={guestSegments.map((s) => s.label).join(', ')}
              className="mt-2.5 flex h-1.5 gap-px overflow-hidden rounded-full"
              style={{ background: 'rgba(30,26,18,.08)' }}
            >
              {guestSegments.map((seg) => (
                <i
                  key={seg.key}
                  aria-hidden
                  className="block h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${seg.pct}%`, background: seg.color }}
                />
              ))}
            </span>
            {/* The legend is what makes the bar readable rather than
             *  decorative — a colour with no key is a shape the host has to
             *  guess at. Hidden from screen readers because the bar's own
             *  aria-label already reads the same breakdown. */}
            <span aria-hidden className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {guestSegments.map((seg) => (
                <span
                  key={seg.key}
                  className="inline-flex items-center gap-1 text-[10px] text-ink/55"
                >
                  <i
                    className="block h-1.5 w-1.5 flex-none rounded-full"
                    style={{ background: seg.color }}
                  />
                  {seg.label}
                </span>
              ))}
            </span>
          </>
        ) : null}
        {miniFoot('Open the roster')}
      </Link>,
    );
  }
  if (committedCentavos > 0 || (budgetTargetCentavos ?? 0) > 0) {
    miniTiles.push(
      <Link
        key="budget"
        href={`${base}/budget`}
        className="sn-tile sn-press flex flex-col text-left"
      >
        <span className="sn-eye">
          <Wallet aria-hidden strokeWidth={1.75} />
          Budget
        </span>
        {/* Phase 4 — committed-against-target is the one genuinely
         *  part-of-whole number on this grid, so it takes the ring the Guests
         *  tile just vacated. The flat bar it replaces could not hold its own
         *  figure; the donut puts the percentage in the hole, which is the
         *  point of the shape. With no target set there is no whole to be part
         *  of, so the tile stays a plain figure rather than drawing a ring
         *  against an invented denominator. */}
        {budgetTargetCentavos && budgetTargetCentavos > 0 ? (
          <span className="mt-3 flex items-center gap-3">
            <ProgressRing
              pct={budgetPct}
              size={46}
              stroke={6}
              color="var(--sn-gold-500)"
              sweep={{ delayMs: 600 }}
            >
              <span className="font-mono text-[11px] font-bold leading-none text-ink">
                {Math.round(Math.min(100, budgetPct))}%
              </span>
            </ProgressRing>
            <span className="min-w-0">
              <span className="block font-mono text-[20px] font-bold leading-none text-ink">
                {committedMeasured ? formatPeso(committedCentavos) : '—'}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink/55">
                {committedMeasured
                  ? `committed of ${formatPeso(budgetTargetCentavos)}`
                  : "couldn't load — your budget is unchanged"}
              </span>
            </span>
          </span>
        ) : (
          <>
            <span className="mt-3 block font-mono text-[20px] font-bold leading-none text-ink">
              {committedMeasured ? formatPeso(committedCentavos) : '—'}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-ink/55">
              committed so far
            </span>
          </>
        )}
        {miniFoot('Open budget & payments')}
      </Link>,
    );
  }
  if (!schedulePreview.isEmpty) {
    miniTiles.push(
      <Link
        key="schedule"
        href={`${base}/schedule?view=journey`}
        className="sn-tile sn-press flex flex-col text-left"
      >
        <span className="sn-eye">
          <CalendarClock aria-hidden strokeWidth={1.75} />
          Schedule · next
        </span>
        <span className="mt-2.5 block space-y-1.5">
          {schedulePreview.display.slice(0, 2).map((block) => (
            /* D-3 · THE NAME IS THE POINT OF THE ROW, SO IT WRAPS RATHER
               THAN TRUNCATES. These tiles sit two-up on a phone: with the date
               pill taking its fixed width there is room for about eleven
               characters, so "Hair & makeup" arrived as "Hair & mak…" — an
               appointment the couple cannot identify at a glance, on the tile
               whose whole job is telling them what is next. Two lines, then
               the ellipsis; `items-start` so the pill sits with the first
               line rather than centring against a two-line name. */
            <span key={block.block_id} className="flex items-start gap-2 text-[12px]">
              <span
                className="mt-px flex-none rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold"
                style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
              >
                {shortDate.format(new Date(block.start_at))}
              </span>
              <span className="min-w-0 flex-1 line-clamp-2 font-semibold leading-snug text-ink">
                {block.label}
              </span>
            </span>
          ))}
        </span>
        {miniFoot('Full program')}
      </Link>,
    );
  }
  // ── Papic (PR-G · option A) ──────────────────────────────────────────────
  // Pre-capture it leads with shots ready (the honest thing to say when nothing
  // has been shot); from the first photo it flips to photos gathered, which is
  // the number a couple actually wants on their home page during the run-up
  // (owner default, PR-G question 2). Both figures derive from
  // lib/papic-home-tile.ts — the pool figure is the same `papic_event_pool_status`
  // the capture path meters against, so the tile and the fence cannot disagree.
  const papicMini = papicHome ? (
    <Link
      key="papic"
      href={`${base}/studio/papic`}
      className="sn-tile sn-press flex flex-col text-left"
    >
      <span className="sn-eye">
        <Camera aria-hidden strokeWidth={1.75} />
        Papic
      </span>
      <span className="mt-3 block font-mono text-[22px] font-bold leading-none text-ink">
        <CountUp
          value={papicHome.preCapture ? papicHome.shotsLeft : papicHome.photosGathered}
          delayMs={700}
        />
      </span>
      <span className="mt-0.5 block text-[11.5px] text-ink/55">
        {papicHome.preCapture
          ? papicHome.cameras === 1
            ? 'shots ready · 1 camera out'
            : `shots ready · ${papicHome.cameras} cameras out`
          : papicHome.shotsLeft > 0
            ? `photos gathered · ${papicHome.shotsLeft.toLocaleString('en-PH')} shots left`
            : 'photos gathered'}
      </span>
      {miniFoot('Open Papic')}
    </Link>
  ) : null;

  // Pushed HERE, ahead of Messages, so the priority order is structural rather
  // than index arithmetic: Guests → Budget → Schedule → PAPIC → Messages, in
  // every combination of which minis have data. (An earlier cut spliced at a
  // fixed index, which silently put Papic *after* Messages whenever Schedule had
  // nothing to show.) The cap below is what makes the order bite.
  if (papicMini) miniTiles.push(papicMini);

  if (unreadCount > 0) {
    miniTiles.push(
      <Link
        key="messages"
        href={`${base}/messages`}
        className="sn-tile sn-press flex flex-col text-left"
      >
        <span className="sn-eye">
          <MessageSquare aria-hidden strokeWidth={1.75} />
          Messages
        </span>
        <span className="mt-3 block font-mono text-[22px] font-bold leading-none text-ink">
          <CountUp value={unreadCount} delayMs={700} />
        </span>
        <span className="mt-0.5 block text-[11.5px] text-ink/55">
          {unreadCount === 1 ? 'unread thread' : 'unread across threads'}
        </span>
        {miniFoot('Open threads')}
      </Link>,
    );
  }

  // ── PAPIC ALWAYS HOLDS A SLOT (owner 2026-07-30: "always hold a slot. since
  //    that is the foundation of the app.") ─────────────────────────────────
  //
  // The first cut of this (PR #3895) let Papic take a slot only when one was
  // free, so a couple with a full dashboard who had not shot yet saw no Papic at
  // all once they dismissed the nudge. The owner reversed that: Papic is the
  // product's foundation, so it is GUARANTEED a slot, always.
  //
  // ⚠ WHY THE CAP STAYS 4 RATHER THAN GROWING TO 5. § 1.6 of the rollout plan
  // (quoted at the top of this bento block) budgets "focal(1) + digest(1) + ≤4
  // minis + chrome(2) ≤ 8" glass layers above the fold, and `backdrop-filter` is
  // the expensive part of every one of them. "Always hold a slot" is a statement
  // about Papic's PRIORITY, not a licence to put a ninth blur layer on the
  // couple's first screen — so Papic is ranked instead of appended, and the
  // budget is untouched.
  //
  // Push order IS the priority — Papic is pushed above, ahead of Messages — so on
  // a fully-populated dashboard it is MESSAGES that yields its tile: the least
  // structural of the five (unread vendor threads are transient, they carry their
  // own nav badge, and the open count also renders in the decisions digest
  // directly above this grid). Guests, Budget and Schedule are never displaced,
  // and Papic is never dropped.
  const MAX_MINIS = 4;
  if (miniTiles.length > MAX_MINIS) miniTiles.length = MAX_MINIS;

  const inspectorMaster = (
    <div className="relative">
      <div className="space-y-10">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="sn-reveal pt-1">
          <p className="text-[13px] text-ink/55">
            Kumusta, {displayName} · welcome back
          </p>
          <h1 className="sn-h1 mt-1.5">
            {daysOut === 0
              ? `It's your ${eventWord} day.`
              : daysOut !== null && daysOut < 0
                ? `Your ${eventWord} is complete.`
                : `Your ${eventWord} is taking shape.`}{' '}
            {daysOut === null || daysOut > 0 ? (
              <span className="sn-h1-tail">Here&rsquo;s today.</span>
            ) : null}
          </h1>
          {/* One home per number (rollout § 3.1): the countdown lives in the
           *  focal, the open-decision count in the digest panel, the stage on
           *  the journey rail — so the hero is greeting + sentence only. */}
        </header>

        {/* ── Top grid — the proto's 2-column grammar (rollout plan § 3.1).
         *  LEFT: the obsidian "Big Day" focal (STATUS) as a tall column — date ·
         *  locked line · the countdown numeral · % planned gold bar · and, when
         *  Setnayan AI is active, the Suri briefing + "The Watch" attention rows
         *  INSIDE it (what fills the tall tile). RIGHT (ACT → NAVIGATE): the
         *  decisions digest panel + a 2×2 of live minis (Guests · Budget ·
         *  Schedule · Messages). The old separate 4-ring bento AND the
         *  standalone "Suri on watch" section dissolve into this grid — the
         *  countdown now lives ONLY in the focal, which killed the duplicate that
         *  let the focal and the tile disagree on whether a date is set. One
         *  obsidian per view (§ 1.3): glass on the day itself. Focal blooms last.
         *  Blur budget (§ 1.6): focal(1) + digest(1) + ≤4 minis + chrome(2) ≤ 8. */}
        <section aria-label={`The ${eventWord} day`} className="!mt-6">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* LEFT — the Big Day focal */}
            {/* WARM EDITORIAL restyle (§ 2.4). The focal's SURFACE is no longer
             *  styled here: `.sn-tile-dark` itself became a solid ink card in the
             *  app-wide skin swap, so this page just uses the class.
             *
             *  ⚠ THIS BLOCK USED TO STYLE IT INLINE, and the reason it gave was
             *  measured and found wrong: it said `.sn-tile-dark` "has 20+ consumers
             *  … restyling the shared class would repaint surfaces this port has
             *  not reviewed". It has SEVEN, and every one of them is the focal card
             *  of its own surface (admin home · here · the day-of card · vendor
             *  on-the-day ×2 · vendor overview · vendor performance). Seven surfaces
             *  wanting one treatment is a class, not seven copies of the same hexes.
             *
             *  Inlining also silently dropped two things the class provides: the
             *  `--m-*` token remap that lets a card nested in the dark sidebar
             *  follow the sidebar, and the hover lift. Only the HEADLINE colours
             *  stay here — those are per-surface, exactly as the skin swap said. */}
            <div
              className={`relative overflow-hidden sn-bloom ${
                focalDark ? 'sn-tile-dark' : 'sn-tile'
              }`}
            >
              {/* Full-bleed inside the card's 18px padding. Decorative only —
                  every fact below is real text, so nothing depends on it. */}
              <div className="relative -mx-[18px] -mt-[18px] mb-4 h-28 overflow-hidden">
                <EventScene
                  eventId={eventId}
                  eventType={eventType}
                  photoSrc={typeHeroSrc}
                  ownPhotoSrc={ownHeroSrc}
                  muted={eventHasHappened}
                />
                {/* The card's own ink, brought up over the foot of the photo so
                    the eyebrow underneath never sits against a bright frame. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-14"
                  style={{
                    background: focalDark
                      ? 'linear-gradient(to top, var(--m-ink), transparent)'
                      : 'linear-gradient(to top, var(--m-paper), transparent)',
                  }}
                />
              </div>
              <p className="sn-eye">
                <CalendarClock aria-hidden strokeWidth={1.75} />
                The {eventWord} day
              </p>
              <div className="mt-3 min-w-0">
                <h2
                  className="text-[22px] font-extrabold leading-tight tracking-[-0.015em]"
                  style={{ color: focalHeadColor }}
                >
                  {focalDateLabel}
                </h2>
                {/* Locked line + numeral both derive from `hasFirmDate` — they
                 *  can no longer disagree ("locked" vs "no firm date yet"). */}
                {/* D-8 · MONO IS FOR DIGITS. This line is prose — a venue
                    name, or "The date is locked" — and Space Mono makes a
                    sentence read like a serial number. The mono lines that
                    remain on this card all carry a figure. */}
                <p className="mt-1 truncate text-xs" style={{ color: focalSubColor }}>
                  {focalVenue
                    ? focalVenue
                    : hasFirmDate
                      ? 'The date is locked'
                      : event.event_date
                        ? 'Target date — not locked yet'
                        : 'No firm date yet'}
                </p>
              </div>
              {hasFirmDate ? (
                <div className="mt-4 flex items-baseline gap-2">
                  <b
                    className="font-mono text-[46px] font-bold leading-none tracking-[-0.02em]"
                    style={{ color: focalHeadColor }}
                  >
                    {daysOut === null
                      ? '—'
                      : daysOut === 0
                        ? 'Today'
                        : daysOut < 0
                          ? Math.abs(daysOut)
                          : <CountUp value={daysOut} delayMs={700} />}
                  </b>
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: focalDark ? 'rgba(243,236,223,.7)' : 'var(--sn-ink-500)' }}
                  >
                    {daysOut === 0
                      ? 'it all happens now'
                      : daysOut !== null && daysOut < 0
                        ? Math.abs(daysOut) === 1
                          ? 'day ago'
                          : 'days ago'
                        : 'days to go'}
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-[13px]" style={{ color: focalSubColor }}>
                  {event.event_date
                    ? 'Narrow to a single day to start your countdown.'
                    : 'Your countdown begins the moment your date is set.'}
                </p>
              )}
              {/* % planned — gold bar, date-independent (vendor-categories locked).
                  ⚠ HIDDEN ONCE THE CELEBRATION HAS HAPPENED. A shimmering
                  progress bar is a promise that the number can still go up.
                  For the owner's Movie Night it read a shimmering 0%, the
                  morning after a night that went fine. */}
              {eventHasHappened ? null : (
                <>
              <div
                className="sn-bar mt-3.5 h-1.5 overflow-hidden rounded-full"
                style={{
                  background: focalDark ? 'rgba(255,255,255,.14)' : 'rgba(30,26,18,.08)',
                }}
              >
                <i
                  className="relative block h-full overflow-hidden rounded-full"
                  style={{ width: `${lockedInPct}%`, background: 'var(--sn-gold-300)' }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-2/5"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)',
                      animation: 'sn-shimmer 2.8s var(--sn-ease-out) 1.6s 1 both',
                    }}
                  />
                </i>
              </div>
              <p
                className="mt-2 font-mono text-[10px]"
                style={{ color: focalDark ? 'rgba(243,236,223,.55)' : 'var(--sn-ink-500)' }}
              >
                <b style={{ color: focalDark ? 'var(--sn-gold-300)' : 'var(--sn-gold-700)' }}>
                  {Math.round(lockedInPct)}%
                </b>{' '}
                locked in
              </p>
                </>
              )}

              {/* AI: the Suri briefing sentence + chips, inside the focal. */}
              {aiActive ? (
                <>
                  <div
                    className="my-4 h-px"
                    style={{
                      background: focalDark ? 'rgba(255,255,255,.12)' : 'rgba(30,26,18,.08)',
                    }}
                  />
                  <p className="sn-eye">
                    <Sparkles aria-hidden strokeWidth={1.75} />
                    Suri · your briefing
                  </p>
                  <p
                    className="mt-2 max-w-[60ch] text-[15px] font-semibold leading-snug"
                    style={{ color: focalHeadColor }}
                  >
                    {cockpitModel.briefing.sentence}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {daysOut !== null && daysOut >= 0 ? (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={focalChipStyle}
                      >
                        {daysOut === 0 ? 'Today is the day' : `${daysOut} days to go`}
                      </span>
                    ) : null}
                    {/* D-6 · THE FRACTION IS GONE — IT WAS THE BAR'S NUMBER
                        IN ANOTHER COSTUME. The gold bar directly above already
                        reports the locked share, and the briefing sentence
                        beside it opens with the same figure in words. A third
                        rendering of one fact reads as three facts and makes the
                        card feel busier than the wedding is. The chips that
                        remain each say something nothing else on the card
                        says: how long is left, and what is most urgent. */}
                    {topPriorityTask ? (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={focalChipStyle}
                      >
                        Most urgent: {topPriorityTask.title.toLowerCase()}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : null}

              {/* AI: "The Watch" — the attention rows, moved INTO the focal's
               *  lower half (was a standalone section below). Each row keeps its
               *  #3265 desktop inspector trigger (w:<dedupeKey>); below xl it's
               *  inert, matching a no-action row. This is what fills the tall
               *  focal in the AI state. */}
              {/* AI: "The Watch" — the attention rows, inside the focal's lower half.
                *  Each row keeps its #3265 desktop inspector trigger (w:<dedupeKey>);
                *  below xl it's inert, matching a no-action row.
                *
                *  § 4 E2 — ON A PHONE THIS FOLDS. The AI focal is tall, and on <lg it
                *  pushed "Needs you this week" below the fold — the one panel a couple
                *  opens the app for. Nine months out the briefing is reassurance; the
                *  digest is the job. Open by default when anything is a `guard`, so a
                *  real warning is never hidden behind a tap.
                *
                *  ⚠ TWO BRANCHES, NOT ONE ELEMENT NEUTRALISED BY CSS. Forcing a single
                *  <details> open at ≥lg leaves its <summary> clickable and focusable
                *  while doing nothing visible — a dead control, which this repo treats
                *  as a defect. Two branches is also the pattern already used for the
                *  sidebar/bottom-nav split. `watchItems` is capped at 4, so the cost is
                *  at most four rows of duplicate markup and no duplicate DOM ids —
                *  `inspectId` is a query param, not an id. */}
              {aiActive && watchItems.length > 0 ? (
                <>
                  <div
                    className="my-4 h-px"
                    style={{
                      background: focalDark ? 'rgba(255,255,255,.12)' : 'rgba(30,26,18,.08)',
                    }}
                  />
                  {/* Phone — a real disclosure. */}
                  <details className="lg:hidden" open={watchHasGuard}>
                    <summary className="sn-eye cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <Sparkles aria-hidden strokeWidth={1.75} />
                      Setnayan AI · The Watch · {watchItems.length}
                    </summary>
                  <div className="mt-1">
                    {watchItems.map(({ intervention, copy }) => {
                      const watchColor =
                        intervention.category === 'guard'
                          ? 'var(--sn-info)'
                          : 'var(--sn-gold-600)';
                      return (
                        <InspectorTrigger
                          key={intervention.dedupeKey}
                          inspectId={`w:${intervention.dedupeKey}`}
                          className="mt-2 flex w-full gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 flex-none rounded-full"
                            style={{ background: focalDark ? 'var(--sn-gold-300)' : watchColor }}
                          />
                          <span className="min-w-0">
                            <span
                              className="block text-[10px] font-bold uppercase tracking-[0.13em]"
                              style={{ color: focalDark ? 'var(--sn-gold-300)' : watchColor }}
                            >
                              {intervention.category === 'guard' ? 'Guard' : 'Secretary'}
                            </span>
                            <span
                              className="mt-0.5 block whitespace-pre-line text-[12.5px] leading-snug"
                              style={{
                                color: focalDark ? 'rgba(243,236,223,.82)' : 'var(--sn-ink-700)',
                              }}
                            >
                              {copy}
                            </span>
                          </span>
                        </InspectorTrigger>
                      );
                    })}
                  </div>
                  <p
                    className="mt-3 text-[10.5px]"
                    style={{ color: focalDark ? 'rgba(243,236,223,.5)' : 'var(--sn-ink-500)' }}
                  >
                    Suri fires a few alerts a week at most — deduped, most-urgent first.
                  </p>
                  </details>

                  {/* Laptop — never folds. */}
                  <div className="hidden lg:block">
                  <p className="sn-eye">
                    <Sparkles aria-hidden strokeWidth={1.75} />
                    Setnayan AI · The Watch
                  </p>
                  <div className="mt-1">
                    {watchItems.map(({ intervention, copy }) => {
                      const watchColor =
                        intervention.category === 'guard'
                          ? 'var(--sn-info)'
                          : 'var(--sn-gold-600)';
                      return (
                        <InspectorTrigger
                          key={intervention.dedupeKey}
                          inspectId={`w:${intervention.dedupeKey}`}
                          className="mt-2 flex w-full gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 flex-none rounded-full"
                            style={{ background: focalDark ? 'var(--sn-gold-300)' : watchColor }}
                          />
                          <span className="min-w-0">
                            <span
                              className="block text-[10px] font-bold uppercase tracking-[0.13em]"
                              style={{ color: focalDark ? 'var(--sn-gold-300)' : watchColor }}
                            >
                              {intervention.category === 'guard' ? 'Guard' : 'Secretary'}
                            </span>
                            <span
                              className="mt-0.5 block whitespace-pre-line text-[12.5px] leading-snug"
                              style={{
                                color: focalDark ? 'rgba(243,236,223,.82)' : 'var(--sn-ink-700)',
                              }}
                            >
                              {copy}
                            </span>
                          </span>
                        </InspectorTrigger>
                      );
                    })}
                  </div>
                  <p
                    className="mt-3 text-[10.5px]"
                    style={{ color: focalDark ? 'rgba(243,236,223,.5)' : 'var(--sn-ink-500)' }}
                  >
                    Suri fires a few alerts a week at most — deduped, most-urgent first.
                  </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* RIGHT — decisions digest (ACT) + 2×2 live minis (NAVIGATE) */}
            <div className="flex flex-col gap-3.5">
              <div className="sn-tile">
                <p className="sn-eye">
                  <ListChecks aria-hidden strokeWidth={1.75} />
                  {/* "this week" is a deadline, and after the celebration there
                      is no week left to meet it in. What remains is genuinely
                      still open — a bill, a document — so it is named that. */}
                  {eventHasHappened ? 'Still open' : 'Needs you this week'}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <b className="font-mono text-[30px] font-bold leading-none text-ink">
                    <CountUp value={openDecisionCount} delayMs={300} />
                  </b>
                  <span className="text-[12.5px] text-ink/55">
                    {openDecisionCount === 1 ? 'open decision' : 'open decisions'}
                    {aiActive && openDecisionCount > 0 ? ' · ranked' : ''}
                  </span>
                </div>
                {flatDecisions.length > 0 ? (
                  <>
                    {/* WARM EDITORIAL row grammar (§ 2.2): one line, one status, one
                     *  destination. THE WHOLE ROW IS THE LINK now — a 44px target
                     *  instead of a 28px pill, which is the tap-target rule rather
                     *  than a preference. The labelled CTA pills are NOT lost: the
                     *  decisions board below keeps them (§ 2.2b), so every action
                     *  still has a verb somewhere on the page.
                     *
                     *  The dot replaces the pill as the urgency signal, read from the
                     *  SHIPPED `chipTone` — no new field, no re-derivation.
                     *
                     *  ⚠ Two deliberate departures from the spec, both to avoid
                     *  inventing fragile logic:
                     *   · the spec wanted the peso figure parsed OUT of `chip`. There
                     *     is no amount field on DecisionItemView, so that means a
                     *     regex over display text that breaks silently when the chip
                     *     is reworded. The chip itself is rendered instead — same
                     *     number, nothing to break — in mono when it carries a ₱.
                     *   · the spec wanted `sub` shown only "when it carries a date or
                     *     a reference". That is a heuristic over free text with no
                     *     field to key on, so `sub` is kept as shipped. */}
                    <div className="mt-2">
                      {flatDecisions.slice(0, 3).map((item, ii) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03] ${
                            ii > 0 ? 'border-t' : ''
                          }`}
                          style={ii > 0 ? { borderColor: '#EDE8DE' } : undefined}
                        >
                          <span
                            aria-hidden
                            className="h-2 w-2 flex-none rounded-full"
                            style={{ background: decisionDotColor[item.chipTone] }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-ink">
                              {item.label}
                            </span>
                            {/* § 2.2 — on the DIGEST the second line earns its place
                              *  only when it carries a date or a reference. Everything
                              *  else it used to repeat is still written in full on the
                              *  decisions board below, so nothing is lost, and the row
                              *  becomes one line with one number as the frame draws it. */}
                            {digestSubWorthShowing(item.sub) ? (
                              <span className="block truncate text-[11.5px] text-ink/55">
                                {item.sub}
                              </span>
                            ) : null}
                          </span>
                          {item.chip ? (
                            <span
                              className={`flex-none whitespace-nowrap text-[13.5px] font-bold text-ink ${
                                item.chip.includes('₱') ? 'font-mono' : ''
                              }`}
                            >
                              {item.chip}
                            </span>
                          ) : null}
                        </Link>
                      ))}
                      {/* EXTEND (§ 2.2) — unanswered RSVPs. Not a cockpit decision, so
                       *  it is appended BELOW the top-3 slice and deliberately does NOT
                       *  enter `decisionGroups` or `openDecisionCount`: that number means
                       *  "cockpit decisions + payments" and corrupting a shipped number's
                       *  definition is worse than the row is worth.
                       *
                       *  🔑 HONESTY GATE — `rsvpRepliesStarted`. A roster nobody has
                       *  invited yet must never be nagged that "141 haven't replied";
                       *  before the first reply arrives, silence is the truthful state.
                       *  (An explicit "invitations sent" signal would be the better gate,
                       *  but `computeGuestStats` has none — this is the conservative
                       *  substitute, not a guess dressed as one.)
                       *
                       *  Zero new queries: `stats` is already computed for this surface.
                       *  No "nudge them?" copy — no nudge mechanism ships, and a question
                       *  implying one is a fake door. Links to the plain roster; no
                       *  invented `?filter=` param. */}
                      {/* ⚠ AND the event must not have happened: chasing replies
                          to an invitation to a party that is over is the purest
                          version of the owner's complaint. */}
                      {!eventHasHappened && stats.pending > 0 && rsvpRepliesStarted ? (
                        <Link
                          href={`${base}/guests`}
                          className="flex min-h-[44px] items-center gap-3 border-t px-4 py-3 transition-colors hover:bg-ink/[0.03]"
                          style={{ borderColor: '#EDE8DE' }}
                        >
                          <span
                            aria-hidden
                            className="h-2 w-2 flex-none rounded-full"
                            // gold = "waiting on people" in the § 2.1 dot vocabulary.
                            // Inlined rather than importing Unit B's shared
                            // `decisionDotColor` map, so this row ships independently
                            // of that PR; identical value, no stacked dependency.
                            style={{ background: 'var(--sn-gold-500)' }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                            <span className="font-mono font-bold">{stats.pending}</span>{' '}
                            {stats.pending === 1 ? 'guest hasn' : 'guests haven'}&rsquo;t
                            replied yet
                          </span>
                          <span className="flex-none text-[13.5px] text-ink/45">&rarr;</span>
                        </Link>
                      ) : null}
                    </div>
                    <a
                      href="#decisions"
                      className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold"
                      style={{ color: 'rgb(var(--color-link))' }}
                    >
                      All {openDecisionCount}{' '}
                      {openDecisionCount === 1 ? 'decision' : 'decisions'} ↗
                    </a>
                  </>
                ) : (
                  <p className="mt-2 text-[13px] text-ink/55">
                    Nothing needs a decision right now — your plan keeps moving on its own.
                  </p>
                )}
              </div>

              {miniTiles.length > 0 ? (
                <div className="grid grid-cols-2 gap-3.5">{miniTiles}</div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Today's one thing — the resolver's #1 (AI state), a gold-hairlined
         *  glass tile below the top grid. */}
        {aiActive && topPriorityTask ? (
          <div className="sn-tile relative !mt-4 flex flex-wrap items-center gap-4 overflow-hidden">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-4 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--sn-gold-500), transparent)',
              }}
            />
            <span
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full font-mono text-lg font-bold"
              style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
            >
              1
            </span>
            <div className="min-w-0 flex-1">
              <p className="sn-eye">Today&rsquo;s one thing</p>
              <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">
                {topPriorityTask.title}
              </p>
              <p className="mt-0.5 text-[13px] text-ink/60">
                {topPriorityTask.whyItMatters}
              </p>
            </div>
            <Link
              href={topPriorityTask.ctaHref}
              /* D-4 · THE ONE FILLED ACTION ON THIS SCREEN, AND IT IS THE
                 ACTION COLOUR. Gold is the atelier's decorative slot; the CTA
                 terracotta lives in the `mulberry` token (#C24E25 — the slot
                 names are inherited and backwards, which is exactly why this
                 is spelled out). White on it measures 4.76:1, over the AA
                 floor. Every other call to action on the page steps down to
                 an outline, so "do this now" means one thing here.
                 ⚠ There is no rule making solid gold a premium signature —
                 that was checked in the decision log before changing it. The
                 only premium signature on record is the six monogram effects
                 (2026-07-17), which say nothing about buttons. */
              className="inline-flex flex-none items-center rounded-full px-4 py-2 text-[13px] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: 'rgb(var(--color-mulberry))', color: '#FFFFFF' }}
            >
              {topPriorityTask.ctaLabel}
            </Link>
          </div>
        ) : null}

        {/* ── Home-injected overlays (cultural / set-date) ─────────────────
         *   Rendered between the bento and the journey rail via the
         *   `slotAfterBento` slot so the Muslim / Chinese / set-date cards
         *   land in the right visual place on the event Home. Null on the
         *   standalone dashboard. */}
        {slotAfterBento ? (
          <div className="space-y-4 !mt-6">{slotAfterBento}</div>
        ) : null}

        {/* ── Decisions board ──────────────────────────────────────────────
         *  Reordered above the Journey rail (owner-approved 2026-07-12 council
         *  verdict): the doorstep now leads with the daily JOB — status
         *  (bento) → act (decisions) → navigate (the band) — and the narrative
         *  Journey rail moves BELOW the band as reassurance, not the top task.
         *  The hero line still greets ("you're in the {stage} stage") so no
         *  emotional pacing is lost. */}
        <section id="decisions" aria-label="Decisions" className="scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="sn-sec">{spark}Decisions waiting on you</h2>
            <span
              className="rounded-full px-2.5 py-0.5 font-mono text-xs font-bold"
              style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
            >
              {openDecisionCount} open
            </span>
            <p className="sn-sec-sub">
              {aiActive
                ? 'Ranked by what closes soonest — each one links to its room.'
                : 'Choices only you can make — everything else keeps moving without you.'}
            </p>
          </div>
          {venueOfferAvailable && !venueOfferInline ? (
            <div className="mb-3.5">
              <FreeVenueShortlistOffer eventId={eventId} variant="card" />
            </div>
          ) : null}
          {decisionGroups.length > 0 ? (
            <div className="grid gap-3.5 lg:grid-cols-2">
              {decisionGroups.map((group, gi) => {
                const GroupIcon =
                  group.id === 'book'
                    ? Store
                    : group.id === 'pay'
                      ? Wallet
                      : group.id === 'role'
                        ? Users
                        : group.id === 'deadline'
                          ? CalendarClock
                          : Sparkles;
                return (
                  <article key={group.id} className="sn-tile">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-md"
                        style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
                      >
                        <GroupIcon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-extrabold tracking-[-0.015em] text-ink">
                          {group.title}
                        </h3>
                        <p className="text-xs text-ink/45">{group.sub}</p>
                      </div>
                      {aiActive ? (
                        <span
                          className="ml-auto rounded-full px-2.5 py-0.5 font-mono text-[11px] font-extrabold tracking-wide"
                          style={{ background: 'var(--sn-gold-700)', color: '#FFFFFF' }}
                        >
                          PRIORITY {gi + 1}
                        </span>
                      ) : (
                        <span
                          className="ml-auto rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold text-ink/60"
                          style={{ borderColor: 'rgba(30,26,18,.12)' }}
                        >
                          {group.items.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item, ii) => (
                        <div key={item.id} className="sn-row px-3.5 py-2.5">
                          {/* The whole row is one desktop inspector trigger; on
                           *  mobile / modified clicks it navigates to the same
                           *  room the CTA below always pointed to. The CTA renders
                           *  as a styled span inside the anchor (no nested link);
                           *  the free-venue offer stays a live sibling below. */}
                          <InspectorTrigger
                            inspectId={`d:${item.id}`}
                            href={item.href}
                            className="-mx-3.5 -my-2.5 block rounded-xl px-3.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                          >
                            <div className="flex items-center gap-2.5">
                              <b className="min-w-0 truncate text-sm font-semibold text-ink">
                                {item.label}
                              </b>
                              {item.chip ? (
                              <span
                                className="ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                                style={chipToneStyle[item.chipTone]}
                              >
                                {item.chip}
                              </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[12.5px] text-ink/55">{item.sub}</p>
                            <span
                              className="mt-2 inline-block rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
                              /* D-4 · EVERY DECISION CTA IS AN OUTLINE NOW.
                                 The first row of EVERY group used to be filled,
                                 so a couple with three open groups met three
                                 identical "most important" buttons plus the
                                 top-priority one above them — four things
                                 shouting at once, which is the same as none.
                                 The page's single filled action is the
                                 top-priority task; these are the queue behind
                                 it. */
                              style={{
                                border: '1px solid var(--sn-gold-500)',
                                color: 'var(--sn-gold-700)',
                              }}
                            >
                              {item.ctaLabel}
                            </span>
                          </InspectorTrigger>
                          {venueOfferInline && isSuriAssistFreeDecisionId(item.id) ? (
                            <FreeVenueShortlistOffer eventId={eventId} variant="inline" />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="sn-tile text-sm text-ink/55">
              Nothing needs a decision right now — your plan keeps moving on its own.
            </div>
          )}
          {/* Doorway to the full planning checklist — the only in-UI entry point
           *  to /checklist since the standalone checklist card was removed. */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`${base}/checklist`}
              className="font-semibold hover:underline"
              style={{ color: 'rgb(var(--color-link))' }}
            >
              View your full checklist →
            </Link>
            {/* § 2.3b — completion chip. Absent when the checklist has never been
             *  seeded OR the read failed: both arrive as "no completed items", and
             *  "0% done" would state a fact about their planning that nobody
             *  measured. A finished list turns green rather than staying gold —
             *  gold in this kit means "waiting on you", which 100% is not. */}
            {checklistProgress ? (
              (() => {
                const pct = Math.round((checklistProgress.done / checklistProgress.total) * 100);
                const complete = pct >= 100;
                return (
                  <span
                    className="inline-flex flex-none items-center rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={
                      complete
                        ? { color: 'var(--sn-success)', background: '#E9EEE3' }
                        : { color: 'var(--sn-gold-800)', background: 'rgba(169,131,75,.12)' }
                    }
                  >
                    {pct}% done
                  </span>
                );
              })()
            ) : null}
          </div>
        </section>

        {/* ── Meanwhile — a delivery is waiting ──────────────────────────
         *  Renders ONLY when a vendor has delivered something still
         *  unacknowledged. Absent data ⇒ absent section, never an empty shell.
         *
         *  There is no per-card dismiss state and no new action: "Confirm
         *  receipt" in the vendor workspace is the shipped, explicit dismissal
         *  (the idempotent `acknowledge_handover` RPC), so acknowledging there
         *  clears this here. One mechanism, one place.
         *
         *  The thumbnail is a HATCHED PLACEHOLDER on purpose — a handover
         *  payload is a link or a file, not a resolvable preview, so nothing is
         *  presigned here and no image is faked.
         *
         *  ⚠ The frame's sample copy read "Your prenup photos arrived — 84 from
         *  Studio Hiraya". Neither the count nor the media kind is derivable
         *  from this row, so the copy claims only what it knows. */}
        {latestHandover ? (
          <section aria-label="Meanwhile" className="!mt-6">
            <p className="sn-eye">Meanwhile</p>
            <div
              className="mt-2 p-4"
              style={{
                borderRadius: 'var(--m-r-md)',
                background: 'rgb(var(--color-cream))',
                border: '1px solid #E1DCD1',
                boxShadow: '0 1px 3px rgba(30,26,18,0.06)',
              }}
            >
              <Link
                href={`${base}/vendors/${latestHandover.event_vendor_id}/workspace`}
                className="flex min-h-[44px] items-center gap-3"
              >
                <span
                  aria-hidden
                  className="h-11 w-11 flex-none"
                  style={{
                    borderRadius: 'var(--m-r-sm)',
                    border: '1px solid #E1DCD1',
                    background:
                      'repeating-linear-gradient(-45deg,#EFE8DA,#EFE8DA 6px,#E6DECB 6px,#E6DECB 12px)',
                  }}
                />
                <span className="min-w-0 flex-1 text-[13.5px]" style={{ color: '#6E6A62' }}>
                  {latestHandover.kind === 'gallery_link'
                    ? `${handoverVendorName} delivered your gallery.`
                    : latestHandover.kind === 'file'
                      ? `${handoverVendorName} sent you a file${
                          latestHandover.label ? ` — ${latestHandover.label}` : ''
                        }.`
                      : `${handoverVendorName} left you a note.`}{' '}
                  <span className="font-semibold" style={{ color: 'rgb(var(--color-link))' }}>
                    {latestHandover.kind === 'gallery_link'
                      ? 'Look →'
                      : latestHandover.kind === 'file'
                        ? 'Open →'
                        : 'Read →'}
                  </span>
                </span>
              </Link>
              {handovers.length > 1 ? (
                <p className="mt-2 text-[12px]" style={{ color: '#8A857B' }}>
                  +{handovers.length - 1} more waiting in your vendor rooms.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Around your event ────────────────────────────────────────── */}
        <section aria-label="Around your event">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="sn-sec">{spark}Around your event</h2>
            <p className="sn-sec-sub">
              Your hosts, team, threads, services, and schedule — this is the
              doorstep.
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* Hosts — every account managing this event. The add-host entry
             *  moved here from the account switcher (owner 2026-07-12) so the
             *  couple sees who can run their event right on the Overview;
             *  the full invite/permission surface stays at /hosts. */}
            <ExpandCard
              cardClassName="sn-tile"
              title="Hosts"
              badge={
                <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[11.5px] font-bold text-ink/60">
                  {hostAccounts.length}{' '}
                  {hostAccounts.length === 1 ? 'account' : 'accounts'}
                </span>
              }
              fullHref={`${base}/hosts`}
              fullLabel="Add a host"
              preview={
                hostAccounts.length > 1 ? (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {hostAccounts.length} accounts can run this {eventWord} —
                    expand to see who.
                  </p>
                ) : (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {eventHasHappened
                      ? `It was just you running this ${eventWord}.`
                      : `It’s just you so far — invite your partner, family, or a coordinator to plan this ${eventWord} together.`}
                  </p>
                )
              }
            >
              {hostAccounts.length > 1
                ? hostAccounts.map((account) => (
                    <div
                      key={account.key}
                      className="flex items-center gap-2.5 border-t border-ink/5 py-2 text-[13px]"
                    >
                      <span className="min-w-0 truncate font-semibold text-ink">
                        {account.name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink/50">
                        {account.roleLabel}
                      </span>
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={
                          account.state === 'invited'
                            ? chipToneStyle.warm
                            : chipToneStyle.ok
                        }
                      >
                        {account.state}
                      </span>
                    </div>
                  ))
                : null}
            </ExpandCard>

            {/* Your team — vendor-bearing types only. On a vendor-free type the
             *  whole card is a doorway to a marketplace that does not exist:
             *  its empty state read "start with the ones that book out first:
             *  your venue and catering" and its CTA linked to /vendors, which
             *  the nav already hides for exactly this reason. */}
            {marketplaceEnabled ? (
            <ExpandCard
              cardClassName="sn-tile"
              title="Your team"
              badge={
                /* Event-type-scoped: the "of 21" denominator is the wedding
                 *  plan-group count — wrong for a debut/christening/corporate
                 *  host, so non-weddings show a plain booked count until their
                 *  per-type category map ships. */
                <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[11.5px] font-bold text-ink/60">
                  {!vendorsMeasured
                    ? 'not loaded'
                    : eventType === 'wedding'
                      ? `${lockedVendorCount} of ${totalLockableCategories} booked`
                      : `${teamVendors.length} ${teamVendors.length === 1 ? 'vendor' : 'vendors'} booked`}
                </span>
              }
              fullHref={`${base}/vendors`}
              fullLabel="Manage vendors"
              preview={
                !vendorsMeasured ? (
                  // "No vendors booked yet" to a couple with a booked venue is
                  // not a neutral default — it invites them to start work they
                  // have already done, and it renders identically either way.
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    We couldn&rsquo;t load your suppliers just now. Nothing has
                    changed &mdash; refresh to try again.
                  </p>
                ) : teamVendors.length > 0 ? (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {teamVendors.length}{' '}
                    {teamVendors.length === 1 ? 'vendor' : 'vendors'} booked —
                    expand to see your team.
                  </p>
                ) : (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {eventHasHappened
                      ? 'No suppliers were booked through Setnayan for this one.'
                      : 'No vendors booked yet — start with the ones that book out first: your venue and catering.'}
                  </p>
                )
              }
            >
              {teamVendors.length > 0
                ? teamVendors.map((v) => (
                    <div
                      key={v.vendor_id}
                      className="flex items-center gap-2.5 border-t border-ink/5 py-2 text-[13px]"
                    >
                      <span className="min-w-0 truncate font-semibold text-ink">
                        {v.vendor_name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink/50">
                        {String(v.category).replace(/_/g, ' ')}
                      </span>
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={chipToneStyle.ok}
                      >
                        {(v.status ?? 'contracted').replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))
                : null}
            </ExpandCard>
            ) : null}

            {/* Conversations — unread count is THIS event's vendor threads
             *  (see fetchEventUnreadCounts above), so the copy never claims
             *  false urgency on a fresh, vendor-less couple. The identity-
             *  masking note moved to one global footnote below the grid. */}
            <article className="sn-tile relative">
              <div className="mb-2 flex items-center gap-2.5">
                <MessageSquare
                  aria-hidden
                  className="h-4 w-4 flex-none"
                  strokeWidth={1.75}
                  style={{ color: 'var(--sn-gold-600)' }}
                />
                <h3 className="text-[16.5px] font-extrabold tracking-[-0.015em] text-ink">
                  Conversations
                </h3>
                {unreadCount > 0 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                    style={chipToneStyle.warm}
                  >
                    {unreadCount} unread
                  </span>
                ) : null}
                <Link
                  href={`${base}/messages`}
                  aria-label="Open threads"
                  className="ml-auto whitespace-nowrap text-xs font-bold"
                  style={{ color: 'var(--sn-gold-700)' }}
                >
                  Open threads →
                </Link>
              </div>
              <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                {unreadCount > 0
                  ? `${unreadCount} ${unreadCount === 1 ? 'thread has' : 'threads have'} unread messages — open to catch up.`
                  : 'All caught up — when a vendor replies, it lands right here.'}
              </p>
            </article>

            {/* Your services */}
            <ExpandCard
              cardClassName="sn-tile"
              title="Your services"
              badge={
                <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[11.5px] font-bold text-ink/60">
                  {serviceRows.length} {serviceRows.length === 1 ? 'order' : 'orders'}
                </span>
              }
              fullHref={`${base}/orders`}
              fullLabel="Open orders"
              preview={
                serviceRows.length > 0 ? (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {serviceRows.length}{' '}
                    {serviceRows.length === 1 ? 'order' : 'orders'} — expand to see
                    {serviceRows.length === 1 ? ' it.' : ' them.'}
                  </p>
                ) : (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {eventHasHappened
                      ? 'Nothing was ordered for this one.'
                      : 'Nothing ordered yet — the Studio has everything for the day, from your monogram to save-the-dates and live streaming.'}
                  </p>
                )
              }
            >
              {serviceRows.length > 0
                ? serviceRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2.5 border-t border-ink/5 py-2 text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                        {row.label}
                      </span>
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={chipToneStyle[row.tone]}
                      >
                        {row.status}
                      </span>
                    </div>
                  ))
                : null}
            </ExpandCard>

            {/* Schedule — the couple's OWN day-of program (event_schedule_blocks),
             *  NOT the deadline/reminder stream. So the "Schedule" title now
             *  reflects the ceremony/reception timeline the couple builds under
             *  /schedule and that the day-of grid goes live with. */}
            <ExpandCard
              cardClassName="sn-tile"
              title="Schedule"
              fullHref={`${base}/schedule?view=journey`}
              fullLabel="See full schedule"
              preview={
                schedulePreview.isEmpty ? (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {eventHasHappened
                      ? 'No program was set for this one.'
                      : 'No program yet — map out your ceremony & reception, and your guests follow the timeline live on the day.'}
                  </p>
                ) : (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    Your ceremony &amp; reception timeline — expand to see it.
                  </p>
                )
              }
            >
              {schedulePreview.isEmpty ? null : (
                <>
                  {schedulePreview.display.map((block) => (
                    <div
                      key={block.block_id}
                      className="flex items-center gap-2.5 border-t border-ink/5 py-2 text-[13px]"
                    >
                      <span
                        className="flex h-6 min-w-[24px] flex-none items-center justify-center rounded-full px-1 font-mono text-[10.5px] font-bold"
                        style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
                      >
                        {shortDate.format(new Date(block.start_at))}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                        {block.label}
                      </span>
                      <span className="whitespace-nowrap text-[11px] text-ink/45">
                        {SCHEDULE_BLOCK_LABEL[block.block_type]}
                      </span>
                    </div>
                  ))}
                  {schedulePreview.moreCount > 0 ? (
                    <p className="border-t border-ink/5 pt-2 text-[11.5px] text-ink/45">
                      +{schedulePreview.moreCount} more{' '}
                      {schedulePreview.moreCount === 1 ? 'block' : 'blocks'} in your
                      timeline
                    </p>
                  ) : null}
                </>
              )}
            </ExpandCard>
          </div>
          {/* Band footer — ONE global identity-masking note (replaces the
           *  per-card 'never a personal profile' legalese that used to repeat
           *  on the Conversations card) + the sole couple-UI entry to the full
           *  /activity feed (kept reachable after the Budget nav's `activity`
           *  child was removed in #3055). */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/5 pt-3 text-[11.5px] text-ink/45">
            <span>
              Vendors always appear by company — never a personal profile.
            </span>
            <Link
              href={`${base}/activity`}
              className="ml-auto whitespace-nowrap font-bold"
              style={{ color: 'rgb(var(--color-link))' }}
            >
              See all recent activity →
            </Link>
          </div>
        </section>

        {/* ── Journey rail — moved BELOW the band per the council verdict.
         *  Narrative reassurance ("Read your progress"), endowed so a fresh
         *  event never reads 0%, but no longer occupies the daily-job slot
         *  above the Decisions board. */}
        <section aria-label="Event progress">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="sn-sec">{spark}Read your progress</h2>
            <p className="sn-sec-sub">
              Tap a stage — or use ← → — to walk through your {eventWord}, start to
              finish.
            </p>
          </div>
          <JourneyRail
            stages={stageModel.stages}
            currentKey={stageModel.currentKey}
            aiActive={aiActive}
          />
        </section>
        {/* The "Suri on watch" section moved INTO the Big-Day focal's lower half
         *  (top grid, above) so the tall focal is filled and the watch lives in
         *  one place. Its #3265 inspector triggers travelled with it. */}
      </div>
    </div>
  );

  return (
    <InspectorLayout
      paramKey="inspect"
      hasSelection={Boolean(inspectorBody)}
      master={inspectorMaster}
      inspector={inspectorBody}
    />
  );
}
