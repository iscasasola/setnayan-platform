import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Sparkles,
  CalendarClock,
  Wallet,
  Users,
  Store,
  MessageSquare,
  ListChecks,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { fetchEventUnreadCounts } from '@/lib/event-decisions';
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
import { fetchUpcomingItems, type UpcomingItem } from '@/lib/upcoming-items';
import {
  fetchScheduleBlocks,
  selectSchedulePreviewBlocks,
  SCHEDULE_BLOCK_LABEL,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import { isSetnayanAiActiveForUser } from '@/lib/setnayan-ai';
import { ROLE_SUBTYPE_LABEL, isRoleSubtype } from '@/lib/event-moderators';
import { getEventHostAiSubscription } from '@/lib/setnayan-ai-server';
import {
  resolveSetnayanAiPaywallEnabled,
  resolveSetnayanAiPerUserEnabled,
} from '@/lib/integration-config';
import {
  runTriggers,
  applyRestraint,
  type PlanningSnapshot,
  type Intervention,
} from '@/lib/setnayan-ai-triggers';
import { renderTemplate, WEDDING_TERMINOLOGY } from '@/lib/setnayan-ai-templates';
import { buildProgressStages } from '@/lib/progress-stages';
import type { EventDatePrecision } from '@/lib/events';
import type { VendorCategory } from '@/lib/vendors';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { formatPeso } from '@/lib/checklist-budget-format';
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

function daysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const event = new Date(`${eventDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((event.getTime() - today.getTime()) / 86_400_000);
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

const shortDate = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
});

type DecisionItemView = {
  id: string;
  label: string;
  sub: string;
  chip: string;
  chipTone: 'hot' | 'warm' | 'calm';
  ctaLabel: string;
  href: string;
};

type DecisionGroupView = {
  id: 'book' | 'pay' | 'pick' | 'role';
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
  slotAfterBento,
  dayOfActive = false,
}: {
  eventId: string;
  suriPreviewParam?: string;
  slotAfterBento?: ReactNode;
  /**
   * True inside the T-1h..T+8h day-of window (resolved by the Home page). When
   * set, the page's DayOfModeGrid renders its "happening now" obsidian focal
   * ABOVE this surface, so the "Big Day" focal here steps down to a glass tile
   * — the one-obsidian-per-view rule (rollout plan § 1.3) stays satisfied.
   */
  dayOfActive?: boolean;
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
  ] = await Promise.all([
    // Event row — lean select of exactly what this surface reads, with the
    // Overview's fallback-to-'*' pattern for migration drift.
    (async () => {
      const leanSelect =
        'event_id, display_name, event_date, event_date_precision, venue_name, region, estimated_budget_centavos, palette_finalized_at, event_type, ceremony_type, planning_mode, setnayan_ai_active';
      const leanRes = await supabase
        .from('events')
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
          .select('vendor_id, vendor_name, category, status, total_cost_php')
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
          // `awaiting_payment` is the couple-facing "needs to be paid" state in
          // the order_status enum. The old 'pending_payment' is NOT an enum
          // member (it lives on vendor token/subscription tables), so this query
          // threw 22P02 and graceful-degraded to [] — the "Settle a payment"
          // decision group + pendingPaymentCount were silently always 0.
          .eq('status', 'awaiting_payment');
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
          const { data: userRows } = await adminClient
            .from('users')
            .select('user_id, display_name, email')
            .in('user_id', userIds);
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
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const base = `/dashboard/${eventId}`;
  const eventType = (event.event_type as string | null) ?? 'wedding';
  const eventWord = eventType === 'wedding' ? 'wedding' : 'event';
  const displayName =
    (event as { display_name?: string | null }).display_name ??
    (eventType === 'wedding' ? 'Your wedding' : 'Your event');

  const eventDatePrecision: EventDatePrecision =
    (event as { event_date_precision?: EventDatePrecision | null }).event_date_precision ??
    'year';
  const daysOut = eventDatePrecision === 'day' ? daysUntil(event.event_date) : null;

  const stats = computeGuestStats(guests);

  const eventVendors = (eventVendorsRes.data ?? []) as Array<{
    vendor_id: string;
    vendor_name: string;
    category: VendorCategory;
    status: string | null;
    total_cost_php: number | string | null;
  }>;

  // ---- Committed budget — same formula as the Overview (paid + fulfilled
  // orders plus every contracted-or-better vendor with a known cost). --------
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
  const budgetTargetCentavos =
    (event as { estimated_budget_centavos?: number | string | null })
      .estimated_budget_centavos != null
      ? Number(
          (event as { estimated_budget_centavos?: number | string | null })
            .estimated_budget_centavos,
        )
      : null;

  // ---- Lock counts + the resolver's #1 task (same libs as the Overview). ---
  const vendorRowInputs = eventVendors as ReadonlyArray<EventVendorRowInput>;
  const remainingTaskCount = countUnlockedCategories(vendorRowInputs);
  const totalLockableCategories = PLAN_GROUPS.filter(
    (g) => g.countsTowardLockable !== false,
  ).length;
  const lockedVendorCount = Math.max(0, totalLockableCategories - remainingTaskCount);
  const topPriorityTask =
    event.event_date && eventDatePrecision === 'day'
      ? pickTodaysOneThing(vendorRowInputs, event.event_date, now)
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
  const aiPerUserEnabled = await resolveSetnayanAiPerUserEnabled();
  const aiSubscription = aiPerUserEnabled
    ? await getEventHostAiSubscription(adminClient, eventId)
    : null;
  const aiEntitled = isSetnayanAiActiveForUser(
    event as { planning_mode?: string | null; setnayan_ai_active?: boolean | null },
    {
      paywallEnabled: aiPaywallEnabled,
      perUserEnabled: aiPerUserEnabled,
      subscription: aiSubscription,
    },
  );
  const viewerIsInternal =
    (viewerRes.data as { is_internal?: boolean | null } | null)?.is_internal === true;
  const suriPreview = suriPreviewParam === 'preview' && viewerIsInternal;
  const aiActive = aiEntitled || suriPreview;

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
        chip:
          kind === 'pick'
            ? 'pick one'
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
  ] satisfies DecisionGroupView[]).filter((g) => g.items.length > 0);

  // AI re-rank: payments + the urgent booking first; free state keeps the
  // natural book → pick → pay → role order. Both deterministic.
  const freeOrder: DecisionGroupView['id'][] = ['book', 'pick', 'pay', 'role'];
  const aiOrder: DecisionGroupView['id'][] = ['book', 'pay', 'pick', 'role'];
  const order = aiActive ? aiOrder : freeOrder;
  const decisionGroups = [...groupsUnordered].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const openDecisionCount = decisionGroups.reduce((acc, g) => acc + g.items.length, 0);

  // ---- FREE first-venue-shortlist offer (owner-locked 2026-07-09 ·
  // Pricing.md § 00 carve-out). Free (non-AI) state only, and ONLY while the
  // venue shortlist is EMPTY — any venue pick (Suri-built or manual) consumes
  // it; the shortlist state itself records consumption. When the venue
  // decision item renders (the resolver's 'start'/'pick' on reception_venue),
  // the offer embeds under it; otherwise it stands alone atop the board. ----
  const venueOfferAvailable =
    !aiActive && isFirstVenueShortlistOfferAvailable(eventVendors);
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
  const currentStageLabel =
    stageModel.stages.find((s) => s.key === stageModel.currentKey)?.label ?? 'Dreaming';

  // ---- "Suri on watch" — render-only pass through the pure trigger engine,
  // fed ONLY what this surface already loaded (payments due + budget). -------
  let watchItems: Array<{ intervention: Intervention; copy: string }> = [];
  if (aiActive) {
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
      priceChanges: [],
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

  const countdownPct =
    daysOut === null ? 0 : Math.max(0, Math.min(100, ((365 - daysOut) / 365) * 100));
  const budgetPct =
    budgetTargetCentavos && budgetTargetCentavos > 0
      ? (committedCentavos / budgetTargetCentavos) * 100
      : 0;
  const guestPct = stats.total > 0 ? (stats.attending / stats.total) * 100 : 0;

  // The focal's "% planned" gold bar = vendor-categories-locked share (the same
  // real aggregate the cockpit briefing reports). Clamped for the bar width.
  const plannedPct = Math.max(0, Math.min(100, cockpitModel.briefing.lockedPct));
  // One obsidian per view (§ 1.3): the "Big Day" focal is dark EXCEPT on the day
  // itself, where the DayOfModeGrid's "happening now" card owns the obsidian and
  // this focal steps down to a glass tile.
  const focalDark = !dayOfActive;
  // The focal's date line — the emotional anchor. Real event data or a muted
  // "to be set" (a no-date event still gets the SetDateNudge in slotAfterBento).
  const focalDateLabel = event.event_date
    ? new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date(`${event.event_date}T00:00:00`))
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
        color: 'var(--sn-gold-700)',
      };
  const focalHeadColor = focalDark ? '#F3ECDF' : 'var(--sn-ink-900)';
  const focalSubColor = focalDark ? 'rgba(243,236,223,.65)' : 'var(--sn-ink-500)';

  return (
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
          <p className="mt-2.5 max-w-[56ch] text-[12.5px] text-ink/55">
            {daysOut !== null && daysOut > 0 ? (
              <>
                <b className="font-mono font-bold" style={{ color: 'var(--sn-gold-700)' }}>
                  {daysOut}
                </b>{' '}
                {daysOut === 1 ? 'day' : 'days'} to go ·{' '}
              </>
            ) : null}
            <b className="font-mono font-bold" style={{ color: 'var(--sn-gold-700)' }}>
              {openDecisionCount}
            </b>{' '}
            {openDecisionCount === 1 ? 'decision' : 'decisions'} waiting on you ·
            you&rsquo;re in the{' '}
            <b className="font-semibold text-ink">{currentStageLabel}</b> stage.
          </p>
        </header>

        {/* ── The Big Day — the obsidian focal (§ 1.3). Countdown · date ·
         *  venue · % planned gold bar; when Setnayan AI is active the Suri
         *  briefing sentence + chips render INSIDE it — retiring BOTH the
         *  retired-wine `from-mulberry-700` gradient strip (R7 bug) AND the
         *  separate premium veil (the tile IS the premium presence). On the
         *  day itself it steps down to glass so the DayOfModeGrid's "happening
         *  now" card owns the single obsidian (§ 1.3). Blooms last (sn-bloom). */}
        <section aria-label={`The ${eventWord} day`} className="!mt-6">
          <div
            className={`relative overflow-hidden sn-bloom ${
              focalDark ? 'sn-tile-dark' : 'sn-tile'
            }`}
          >
            {focalDark ? (
              <>
                <span className="sn-veil" aria-hidden />
                <span className="sn-capiz" aria-hidden />
              </>
            ) : null}
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
              <p className="mt-1 truncate font-mono text-xs" style={{ color: focalSubColor }}>
                {focalVenue
                  ? focalVenue
                  : event.event_date
                    ? 'The date is locked'
                    : 'No firm date yet'}
              </p>
            </div>
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
                {daysOut === null
                  ? 'days to go'
                  : daysOut === 0
                    ? 'it all happens now'
                    : daysOut < 0
                      ? Math.abs(daysOut) === 1
                        ? 'day ago'
                        : 'days ago'
                      : 'days to go'}
              </span>
            </div>
            {/* % planned — gold bar with a single shimmer pass. */}
            <div
              className="sn-bar mt-3.5 h-1.5 overflow-hidden rounded-full"
              style={{
                background: focalDark ? 'rgba(255,255,255,.14)' : 'rgba(30,26,18,.08)',
              }}
            >
              <i
                className="relative block h-full overflow-hidden rounded-full"
                style={{ width: `${plannedPct}%`, background: 'var(--sn-gold-300)' }}
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
                {Math.round(plannedPct)}%
              </b>{' '}
              planned
            </p>

            {/* AI-active: the Suri briefing sentence + chips, INSIDE the focal. */}
            {aiActive ? (
              <>
                <div
                  className="my-4 h-px"
                  style={{
                    background: focalDark ? 'rgba(255,255,255,.12)' : 'rgba(30,26,18,.08)',
                  }}
                />
                {/* .sn-eye cascades gold-300 inside .sn-tile-dark and gold-700
                 *  on the day-of glass fallback — no inline color override. */}
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
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={focalChipStyle}
                  >
                    {lockedVendorCount} of {totalLockableCategories} categories locked
                  </span>
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
          </div>

          {/* Today's one thing — the resolver's #1 (AI state), a gold-hairlined
           *  glass tile right below the focal. */}
          {aiActive && topPriorityTask ? (
            <div className="sn-tile relative mt-3 flex flex-wrap items-center gap-4 overflow-hidden">
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
                style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
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
                className="inline-flex flex-none items-center rounded-full px-4 py-2 text-[13px] font-bold transition-transform hover:-translate-y-0.5"
                style={{ background: 'var(--sn-gold-500)', color: '#FFFDF8' }}
              >
                {topPriorityTask.ctaLabel}
              </Link>
            </div>
          ) : null}
        </section>

        {/* ── At-a-glance bento ────────────────────────────────────────── */}
        {/* Entrance cascade § 2(b): header (0s) → these four tiles stagger via
         *  .sn-reveal's nth-child delays (+.08s each) → the focal blooms LAST
         *  at ~1.05s. Header + 4 tiles + focal = the 6-element stagger cap;
         *  everything below the fold paints static. */}
        <section aria-label="At a glance" className={aiActive ? '!mt-5' : '!mt-6'}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="sn-tile sn-reveal flex items-center gap-3.5">
              <ProgressRing
                pct={countdownPct}
                size={60}
                stroke={7}
                color="var(--sn-gold-500)"
                sweep={{ delayMs: 300 }}
              />
              <div className="min-w-0">
                <p className="sn-eye">
                  <CalendarClock aria-hidden strokeWidth={1.75} />
                  Countdown
                </p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none text-ink">
                  {daysOut === null ? (
                    '—'
                  ) : daysOut === 0 ? (
                    'Today'
                  ) : daysOut < 0 ? (
                    Math.abs(daysOut)
                  ) : (
                    <CountUp value={daysOut} delayMs={300} />
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink/55">
                  {daysOut === null
                    ? 'no firm date yet'
                    : daysOut === 0
                      ? 'it all happens now'
                      : daysOut < 0
                        ? 'days since — congratulations'
                        : 'days to go'}
                </p>
              </div>
            </div>
            {/* Gauge + jump-anchor (not a second decisions list): tapping the
             *  ring scrolls to the Decisions board below, which owns the items. */}
            <a
              href="#decisions"
              aria-label="Jump to decisions waiting on you"
              className="sn-tile sn-reveal sn-press flex items-center gap-3.5"
            >
              <ProgressRing
                pct={cockpitModel.briefing.lockedPct}
                size={60}
                stroke={7}
                color="var(--sn-gold-500)"
                sweep={{ delayMs: 380 }}
              >
                <span className="font-mono text-lg font-bold leading-none text-ink">
                  {openDecisionCount}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="sn-eye">
                  <ListChecks aria-hidden strokeWidth={1.75} />
                  Decisions
                </p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none text-ink">
                  <CountUp value={openDecisionCount} delayMs={380} />
                </p>
                <p className="mt-0.5 truncate text-xs text-ink/55">waiting on you</p>
              </div>
            </a>
            <div className="sn-tile sn-reveal flex items-center gap-3.5">
              <ProgressRing
                pct={budgetPct}
                size={60}
                stroke={7}
                color="var(--sn-gold-500)"
                sweep={{ delayMs: 460 }}
              >
                <span className="font-mono text-sm font-bold leading-none text-ink">
                  {budgetTargetCentavos && budgetTargetCentavos > 0
                    ? `${Math.round(Math.min(999, budgetPct))}%`
                    : '—'}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="sn-eye">
                  <Wallet aria-hidden strokeWidth={1.75} />
                  Budget
                </p>
                <p className="mt-1 font-mono text-xl font-bold leading-none text-ink">
                  {formatPeso(committedCentavos)}
                </p>
                {/* Owner screenshot fix (2026-07-15): the old "of ₱X committed"
                 *  sub read as if the BUDGET were the committed amount. The
                 *  mono value above is what's committed; the sub names the
                 *  budget it counts against, and the ring carries %-of-budget. */}
                <p className="mt-0.5 truncate text-xs text-ink/55">
                  {budgetTargetCentavos && budgetTargetCentavos > 0
                    ? `committed · of ${formatPeso(budgetTargetCentavos)} budget`
                    : 'committed · no target set'}
                </p>
              </div>
            </div>
            <div className="sn-tile sn-reveal flex items-center gap-3.5">
              <ProgressRing
                pct={guestPct}
                size={60}
                stroke={7}
                color="var(--sn-gold-500)"
                sweep={{ delayMs: 540 }}
              >
                <span className="font-mono text-lg font-bold leading-none text-ink">
                  {stats.attending}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="sn-eye">
                  <Users aria-hidden strokeWidth={1.75} />
                  Guests
                </p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none text-ink">
                  <CountUp value={stats.attending} delayMs={540} />
                </p>
                <p className="mt-0.5 truncate text-xs text-ink/55">
                  attending of {stats.total}
                </p>
              </div>
            </div>
          </div>
        </section>

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
              style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
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
                        : Sparkles;
                return (
                  <article key={group.id} className="sn-tile">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-md"
                        style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
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
                          style={{ background: 'var(--sn-gold-500)', color: '#FFFDF8' }}
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
                          <div className="flex items-center gap-2.5">
                            <b className="min-w-0 truncate text-sm font-semibold text-ink">
                              {item.label}
                            </b>
                            <span
                              className="ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                              style={chipToneStyle[item.chipTone]}
                            >
                              {item.chip}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[12.5px] text-ink/55">{item.sub}</p>
                          <Link
                            href={item.href}
                            className="mt-2 inline-block rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-transform hover:-translate-y-0.5"
                            style={
                              ii === 0
                                ? { background: 'var(--sn-gold-500)', color: '#FFFDF8' }
                                : { border: '1px solid var(--sn-gold-500)', color: 'var(--sn-gold-700)' }
                            }
                          >
                            {item.ctaLabel}
                          </Link>
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
          <div className="mt-3.5 text-sm">
            <Link
              href={`${base}/checklist`}
              className="font-semibold hover:underline"
              style={{ color: 'var(--sn-gold-700)' }}
            >
              View your full checklist →
            </Link>
          </div>
        </section>

        {/* ── What's next rail (AI) ────────────────────────────────────── */}
        {aiActive && upcoming.items.length > 0 ? (
          <section aria-label="What's next">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="sn-sec">{spark}What&rsquo;s next</h2>
              <p className="sn-sec-sub">
                Your deadlines, in the order Suri would take them.
              </p>
            </div>
            <div className="-mx-1 flex gap-0 overflow-x-auto px-1 pb-2 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.items.map((item) => {
                const dotColor =
                  item.category === 'payment' || item.category === 'renewal'
                    ? 'var(--sn-warning)'
                    : item.category === 'document'
                      ? 'var(--sn-info)'
                      : 'var(--sn-success)';
                return (
                  <div key={item.id} className="relative min-w-[150px] flex-1 pr-3">
                    <span
                      aria-hidden
                      className="absolute left-0 right-0 top-[5px] h-0.5"
                      style={{ background: 'rgba(169,131,75,.25)' }}
                    />
                    <span
                      aria-hidden
                      className="relative z-[2] mb-2.5 block h-3 w-3 rounded-full"
                      style={{ background: dotColor, boxShadow: `0 0 0 4px ${dotColor}22` }}
                    />
                    <p
                      className="font-mono text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: 'var(--sn-gold-700)' }}
                    >
                      {shortDate.format(item.date)}
                    </p>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="mt-0.5 block text-[13.5px] font-semibold leading-snug text-ink hover:text-ink/70"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <p className="mt-0.5 text-[13.5px] font-semibold leading-snug text-ink">
                        {item.title}
                      </p>
                    )}
                    <p className="text-xs text-ink/55">{item.subtitle}</p>
                  </div>
                );
              })}
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
                    It&rsquo;s just you so far — invite your partner, family, or a
                    coordinator to plan this {eventWord} together.
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

            {/* Your team */}
            <ExpandCard
              cardClassName="sn-tile"
              title="Your team"
              badge={
                /* Event-type-scoped: the "of 21" denominator is the wedding
                 *  plan-group count — wrong for a debut/christening/corporate
                 *  host, so non-weddings show a plain booked count until their
                 *  per-type category map ships. */
                <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[11.5px] font-bold text-ink/60">
                  {eventType === 'wedding'
                    ? `${lockedVendorCount} of ${totalLockableCategories} booked`
                    : `${teamVendors.length} ${teamVendors.length === 1 ? 'vendor' : 'vendors'} booked`}
                </span>
              }
              fullHref={`${base}/vendors`}
              fullLabel="Manage vendors"
              preview={
                teamVendors.length > 0 ? (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    {teamVendors.length}{' '}
                    {teamVendors.length === 1 ? 'vendor' : 'vendors'} booked —
                    expand to see your team.
                  </p>
                ) : (
                  <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                    No vendors booked yet — start with the ones that book out
                    first: your venue and catering.
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
                    Nothing ordered yet — the Studio has everything for the day,
                    from your monogram to save-the-dates and live streaming.
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
                    No program yet — map out your ceremony &amp; reception, and
                    your guests follow the timeline live on the day.
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
                        style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
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
              style={{ color: 'var(--sn-gold-700)' }}
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

        {/* ── Suri on watch (AI · render-only) ─────────────────────────── */}
        {aiActive && watchItems.length > 0 ? (
          <section aria-label="Suri on watch">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="sn-sec">{spark}Suri on watch</h2>
              <p className="sn-sec-sub">
                Guards run in the background — they only speak up when something changes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {watchItems.map(({ intervention, copy }) => {
                const watchColor =
                  intervention.category === 'guard'
                    ? 'var(--sn-info)'
                    : 'var(--sn-gold-600)';
                return (
                  <div key={intervention.dedupeKey} className="sn-tile flex gap-3">
                    <span
                      aria-hidden
                      className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full"
                      style={{ background: watchColor, boxShadow: `0 0 0 4px ${watchColor}22` }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[10.5px] font-bold uppercase tracking-[0.13em]"
                        style={{ color: watchColor }}
                      >
                        {intervention.category === 'guard' ? 'Guard' : 'Secretary'} ·{' '}
                        {intervention.templateId}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">
                        {copy}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink/45">
              <span aria-hidden style={{ color: 'var(--sn-gold-500)' }}>
                ✦
              </span>
              Suri fires a few alerts a week at most — deduped, cooled down, most-urgent
              first. Quiet weeks stay quiet.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
