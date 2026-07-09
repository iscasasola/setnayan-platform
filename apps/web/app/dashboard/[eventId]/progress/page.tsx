import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { countUnread } from '@/lib/notifications';
import { PLAN_GROUPS, type EventVendorRowInput } from '@/lib/wedding-plan-groups';
import { countUnlockedCategories, pickTodaysOneThing } from '@/lib/todays-one-thing';
import {
  buildCockpitModel,
  formatRelativeDays,
  type CockpitDecision,
} from '@/lib/setnayan-ai-cockpit';
import {
  summarize as summarizePaperwork,
  completeByDate as paperworkCompleteByDate,
  DOCUMENT_META as PAPERWORK_DOCUMENT_META,
  type PaperworkRow,
} from '@/lib/paperwork';
import { fetchUpcomingItems, type UpcomingItem } from '@/lib/upcoming-items';
import { isSetnayanAiActiveForUser } from '@/lib/setnayan-ai';
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
import { ProgressRing } from '@/app/_components/progress-ring';
import { JourneyRail } from './_components/journey-rail';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Decisions & Progress · Setnayan' };

/**
 * /dashboard/[eventId]/progress — "Decisions & Progress".
 *
 * Production port of the approved session prototype
 * (setnayan-decisions-progress.html): the couple's read-your-progress surface —
 * hero + at-a-glance bento + the six-stage journey rail + the decisions board +
 * the around-your-event doorstep cards. Every number derives from real,
 * RLS-scoped event data (same defensive patterns as the Overview); nothing is
 * fixture-driven.
 *
 * Dual state: when Setnayan AI is active for the viewer (the Overview's exact
 * resolution — per-event flag + per-user subscription fan-out), the page adds
 * the Suri briefing strip, Today's one thing, priority-ranked decisions, the
 * What's-next deadline rail, the render-only "Suri on watch" section, and the
 * page-scoped wine/champagne premium skin. Internal accounts can preview the
 * AI state on any event via `?suri=preview` (render-only override — it flips
 * no flags and charges nothing).
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

export default async function EventProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ suri?: string }>;
}) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
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
  ] = await Promise.all([
    // Event row — lean select of exactly what this page reads, with the
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
          'EventProgress (viewer users SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null } as never;
      }
    })(),
    fetchGuestsByEvent(supabase, eventId).catch((err: unknown) => {
      logQueryError(
        'EventProgress (fetchGuestsByEvent threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchGuestsByEvent>>;
    }),
    // Vendor picks — lean select (this page needs no enrichment columns).
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
          'EventProgress (event_vendors SELECT threw)',
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
          'EventProgress (paid orders SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    // Pending-payment orders — the "Settle a payment" decision group. The
    // cockpit intentionally omits this kind (the Overview never loads unpaid
    // orders); this page loads it with one lean query.
    (async () => {
      try {
        return await supabase
          .from('orders')
          .select('order_id, service_key, requested_total_php, reference_code, status')
          .eq('event_id', eventId)
          .eq('status', 'pending_payment');
      } catch (caught) {
        logQueryError(
          'EventProgress (pending orders SELECT threw)',
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
          'EventProgress (event_sponsors SELECT threw)',
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
          'EventProgress (event_paperwork SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })(),
    countUnread(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'EventProgress (countUnread threw)',
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
          'EventProgress (event_seat_assignments count threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null, count: 0 } as never;
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
  const suriPreview = search.suri === 'preview' && viewerIsInternal;
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
        'EventProgress (fetchUpcomingItems threw)',
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

  // ---- Cockpit model — pure derivation over data this page already loaded
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
  // pending-payment group this page loads itself. ---------------------------
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

  // ---- Journey stages (pure lib — see lib/progress-stages.ts). ------------
  const stageModel = buildProgressStages({
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
  // fed ONLY what this page already loaded (payments due + budget). ----------
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
  const serviceRows = [
    ...paidOrders.map((o) => ({
      id: o.order_id,
      label: serviceLabel(o.service_key),
      status: o.status === 'fulfilled' ? 'delivered' : 'active',
      tone: 'ok' as const,
    })),
    ...pendingOrders.map((o) => ({
      id: o.order_id,
      label: serviceLabel(o.service_key),
      status: 'payment pending',
      tone: 'warm' as const,
    })),
  ];

  // Presentation helpers for the premium skin (page-scoped; tokens only).
  const card = aiActive
    ? 'm-card relative overflow-hidden border-terracotta/40 shadow-[0_2px_6px_rgba(92,37,66,0.07),0_16px_40px_rgba(92,37,66,0.11)]'
    : 'm-card';
  const chipToneClass = {
    hot: 'bg-mulberry/10 text-mulberry',
    warm: 'bg-warn-100 text-warn-700 dark:bg-warn-900/40 dark:text-warn-300',
    calm: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
    ok: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  } as const;
  const spark = aiActive ? (
    <span aria-hidden className="mr-1.5 align-[0.18em] text-[0.62em] text-terracotta">
      ✦
    </span>
  ) : null;
  const goldHairline = aiActive ? (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-terracotta to-transparent"
    />
  ) : null;

  const countdownPct =
    daysOut === null ? 0 : Math.max(0, Math.min(100, ((365 - daysOut) / 365) * 100));
  const budgetPct =
    budgetTargetCentavos && budgetTargetCentavos > 0
      ? (committedCentavos / budgetTargetCentavos) * 100
      : 0;
  const guestPct = stats.total > 0 ? (stats.attending / stats.total) * 100 : 0;

  return (
    <div className="relative">
      {/* Premium veil — page-scoped radial wash, AI state only. */}
      {aiActive ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-4 -inset-y-6 -z-10 sm:-inset-x-6 lg:-inset-x-8"
          style={{
            background:
              'radial-gradient(1000px 560px at 10% -4%, rgb(var(--color-mulberry) / 0.07) 0%, transparent 62%), radial-gradient(760px 460px at 96% 6%, rgb(var(--color-terracotta) / 0.10) 0%, transparent 58%), radial-gradient(1100px 760px at 50% 104%, rgb(var(--color-mulberry) / 0.05) 0%, transparent 62%)',
          }}
        />
      ) : null}

      <div className="space-y-10">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
            Hello {displayName}
          </p>
          <h1 className="m-serif mt-2 text-3xl leading-tight text-ink sm:text-4xl">
            {daysOut === 0
              ? `It's your ${eventWord} day.`
              : daysOut !== null && daysOut < 0
                ? `Your ${eventWord} is complete.`
                : `Your ${eventWord} is taking shape.`}
          </h1>
          <p className="mt-2 max-w-[56ch] text-ink/60">
            {daysOut !== null && daysOut > 0 ? (
              <>
                <b className="font-semibold text-ink">{daysOut}</b>{' '}
                {daysOut === 1 ? 'day' : 'days'} to go ·{' '}
              </>
            ) : null}
            <b className="font-semibold text-ink">{openDecisionCount}</b>{' '}
            {openDecisionCount === 1 ? 'decision' : 'decisions'} waiting on you ·
            you&rsquo;re in the{' '}
            <b className="font-semibold text-ink">{currentStageLabel}</b> stage.
          </p>
        </header>

        {/* ── Suri briefing strip (AI) ─────────────────────────────────── */}
        {aiActive ? (
          <section aria-label="Suri briefing" className="!mt-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-mulberry-700 via-mulberry to-mulberry-600 px-6 py-5 text-white shadow-[0_14px_36px_rgba(92,37,66,0.32)]">
              <span
                aria-hidden
                className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-terracotta/20"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terracotta-200">
                ✦ Suri · your planning briefing
              </p>
              <p className="m-serif mt-2 max-w-[60ch] text-lg leading-snug sm:text-xl">
                {cockpitModel.briefing.sentence}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {daysOut !== null && daysOut >= 0 ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                    {daysOut === 0 ? 'Today is the day' : `${daysOut} days to go`}
                  </span>
                ) : null}
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                  {lockedVendorCount} of {totalLockableCategories} categories locked
                </span>
                {topPriorityTask ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                    Most urgent: {topPriorityTask.title.toLowerCase()}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Today's one thing — the resolver's #1, single-focus. */}
            {topPriorityTask ? (
              <div
                className={`${card} mt-3 flex flex-wrap items-center gap-4 border-terracotta/50 px-5 py-4`}
              >
                {goldHairline}
                <span className="m-serif flex h-11 w-11 flex-none items-center justify-center rounded-full bg-terracotta/15 text-lg text-terracotta-700 dark:text-terracotta-300">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-terracotta">
                    Today&rsquo;s one thing
                  </p>
                  <p className="m-serif text-lg leading-snug text-ink">
                    {topPriorityTask.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink/60">
                    {topPriorityTask.whyItMatters}
                  </p>
                </div>
                <Link
                  href={topPriorityTask.ctaHref}
                  className="flex-none rounded-full bg-gradient-to-r from-mulberry-700 to-mulberry px-4 py-2 text-[13px] font-bold text-white"
                >
                  {topPriorityTask.ctaLabel}
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── At-a-glance bento ────────────────────────────────────────── */}
        <section aria-label="At a glance" className={aiActive ? '!mt-5' : '!mt-6'}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={`${card} flex items-center gap-3.5 px-4 py-4`}>
              {goldHairline}
              <ProgressRing pct={countdownPct} size={60} stroke={7} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                  Countdown
                </p>
                <p className="m-serif text-2xl leading-none text-ink">
                  {daysOut === null ? '—' : daysOut === 0 ? 'Today' : daysOut}
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
            <div className={`${card} flex items-center gap-3.5 px-4 py-4`}>
              {goldHairline}
              <ProgressRing pct={cockpitModel.briefing.lockedPct} size={60} stroke={7}>
                <span className="m-serif text-lg leading-none text-ink">
                  {openDecisionCount}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                  Decisions
                </p>
                <p className="m-serif text-2xl leading-none text-ink">{openDecisionCount}</p>
                <p className="mt-0.5 truncate text-xs text-ink/55">waiting on you</p>
              </div>
            </div>
            <div className={`${card} flex items-center gap-3.5 px-4 py-4`}>
              {goldHairline}
              <ProgressRing
                pct={budgetPct}
                size={60}
                stroke={7}
                color="rgb(var(--color-terracotta))"
              >
                <span className="m-serif text-sm leading-none text-ink">
                  {budgetTargetCentavos && budgetTargetCentavos > 0
                    ? `${Math.round(Math.min(999, budgetPct))}%`
                    : '—'}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                  Budget
                </p>
                <p className="m-serif text-xl leading-none text-ink">
                  {formatPeso(committedCentavos)}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink/55">
                  {budgetTargetCentavos && budgetTargetCentavos > 0
                    ? `of ${formatPeso(budgetTargetCentavos)} committed`
                    : 'committed · no target set'}
                </p>
              </div>
            </div>
            <div className={`${card} flex items-center gap-3.5 px-4 py-4`}>
              {goldHairline}
              <ProgressRing pct={guestPct} size={60} stroke={7}>
                <span className="m-serif text-lg leading-none text-ink">
                  {stats.attending}
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                  Guests
                </p>
                <p className="m-serif text-2xl leading-none text-ink">{stats.attending}</p>
                <p className="mt-0.5 truncate text-xs text-ink/55">
                  attending of {stats.total}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Journey rail ─────────────────────────────────────────────── */}
        <section aria-label="Event progress">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="m-serif text-2xl text-ink">{spark}Read your progress</h2>
            <p className="text-sm text-ink/55">
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

        {/* ── Decisions board ──────────────────────────────────────────── */}
        <section aria-label="Decisions">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="m-serif text-2xl text-ink">{spark}Decisions waiting on you</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                aiActive
                  ? 'bg-gradient-to-r from-mulberry-700 to-mulberry text-white'
                  : 'bg-mulberry/10 text-mulberry'
              }`}
            >
              {openDecisionCount} open
            </span>
            <p className="text-sm text-ink/55">
              {aiActive
                ? 'Ranked by what closes soonest — each one links to its room.'
                : 'Choices only you can make — everything else keeps moving without you.'}
            </p>
          </div>
          {decisionGroups.length > 0 ? (
            <div className="grid gap-3.5 lg:grid-cols-2">
              {decisionGroups.map((group, gi) => (
                <article key={group.id} className={`${card} px-5 py-4`}>
                  {goldHairline}
                  <div className="mb-1 flex items-center gap-2.5">
                    <div className="min-w-0">
                      <h3 className="m-serif text-[17px] text-ink">{group.title}</h3>
                      <p className="text-xs text-ink/45">{group.sub}</p>
                    </div>
                    {aiActive ? (
                      <span className="ml-auto rounded-full bg-gradient-to-r from-mulberry-700 to-mulberry px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white">
                        PRIORITY {gi + 1}
                      </span>
                    ) : (
                      <span className="ml-auto rounded-full border border-ink/10 px-2.5 py-0.5 text-xs font-bold text-ink/60">
                        {group.items.length}
                      </span>
                    )}
                  </div>
                  {group.items.map((item) => (
                    <div key={item.id} className="border-t border-ink/5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <b className="min-w-0 truncate text-sm font-semibold text-ink">
                          {item.label}
                        </b>
                        <span
                          className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${chipToneClass[item.chipTone]}`}
                        >
                          {item.chip}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-ink/55">{item.sub}</p>
                      <Link
                        href={item.href}
                        className={`mt-2 inline-block rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                          aiActive
                            ? 'bg-gradient-to-r from-mulberry-700 to-mulberry text-white'
                            : 'border border-mulberry/30 text-mulberry hover:bg-mulberry/10'
                        }`}
                      >
                        {item.ctaLabel}
                      </Link>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <div className={`${card} px-5 py-6 text-sm text-ink/55`}>
              {goldHairline}
              Nothing needs a decision right now — your plan keeps moving on its own.
            </div>
          )}
        </section>

        {/* ── What's next rail (AI) ────────────────────────────────────── */}
        {aiActive && upcoming.items.length > 0 ? (
          <section aria-label="What's next">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="m-serif text-2xl text-ink">{spark}What&rsquo;s next</h2>
              <p className="text-sm text-ink/55">
                Your deadlines, in the order Suri would take them.
              </p>
            </div>
            <div className="-mx-1 flex gap-0 overflow-x-auto px-1 pb-2 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.items.map((item) => (
                <div key={item.id} className="relative min-w-[150px] flex-1 pr-3">
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 top-[5px] h-0.5 bg-mulberry/20"
                  />
                  <span
                    aria-hidden
                    className={`relative z-[2] mb-2.5 block h-3 w-3 rounded-full ring-4 ${
                      item.category === 'payment' || item.category === 'renewal'
                        ? 'bg-mulberry ring-mulberry/15'
                        : item.category === 'document'
                          ? 'bg-warn-500 ring-warn-500/20'
                          : 'bg-success-500 ring-success-500/20'
                    }`}
                  />
                  <p className="text-[11px] font-bold uppercase tracking-wide text-mulberry">
                    {shortDate.format(item.date)}
                  </p>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="mt-0.5 block text-[13.5px] font-semibold leading-snug text-ink hover:text-mulberry"
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
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Around your event ────────────────────────────────────────── */}
        <section aria-label="Around your event">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="m-serif text-2xl text-ink">{spark}Around your event</h2>
            <p className="text-sm text-ink/55">
              Your team, threads, services, and schedule — this is the doorstep.
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* Your team */}
            <article className={`${card} px-5 py-4`}>
              {goldHairline}
              <div className="mb-2 flex items-center gap-2.5">
                <h3 className="m-serif text-[16.5px] text-ink">Your team</h3>
                <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[11.5px] font-bold text-ink/60">
                  {lockedVendorCount} of {totalLockableCategories} booked
                </span>
                <Link
                  href={`${base}/vendors`}
                  className="ml-auto whitespace-nowrap text-xs font-bold text-mulberry"
                >
                  Manage vendors →
                </Link>
              </div>
              {teamVendors.length > 0 ? (
                teamVendors.slice(0, 4).map((v) => (
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
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${chipToneClass.ok}`}
                    >
                      {(v.status ?? 'contracted').replace(/_/g, ' ')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="border-t border-ink/5 py-2 text-[13px] text-ink/50">
                  No vendors locked yet — your booked team appears here.
                </p>
              )}
              {teamVendors.length > 4 ? (
                <p className="border-t border-ink/5 pt-2 text-[11.5px] text-ink/45">
                  +{teamVendors.length - 4} more on the Vendors tab
                </p>
              ) : null}
            </article>

            {/* Conversations */}
            <article className={`${card} px-5 py-4`}>
              {goldHairline}
              <div className="mb-2 flex items-center gap-2.5">
                <h3 className="m-serif text-[16.5px] text-ink">Conversations</h3>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-mulberry/10 px-2 py-0.5 text-[11.5px] font-bold text-mulberry">
                    {unreadCount} unread
                  </span>
                ) : null}
                <Link
                  href={`${base}/messages`}
                  className="ml-auto whitespace-nowrap text-xs font-bold text-mulberry"
                >
                  Open threads →
                </Link>
              </div>
              <p className="border-t border-ink/5 py-2 text-[13px] text-ink/60">
                {unreadCount > 0
                  ? `${unreadCount} ${unreadCount === 1 ? 'message needs' : 'messages need'} a look — vendors reply fastest when you do too.`
                  : 'All caught up — no unread messages right now.'}
              </p>
              <p className="border-t border-ink/5 pt-2 text-[11.5px] text-ink/45">
                Vendors always appear by company — never a personal profile.
              </p>
            </article>

            {/* Your services */}
            <article className={`${card} px-5 py-4`}>
              {goldHairline}
              <div className="mb-2 flex items-center gap-2.5">
                <h3 className="m-serif text-[16.5px] text-ink">Your services</h3>
                <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[11.5px] font-bold text-ink/60">
                  {serviceRows.length} {serviceRows.length === 1 ? 'order' : 'orders'}
                </span>
                <Link
                  href={`${base}/orders`}
                  className="ml-auto whitespace-nowrap text-xs font-bold text-mulberry"
                >
                  Open orders →
                </Link>
              </div>
              {serviceRows.length > 0 ? (
                serviceRows.slice(0, 4).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2.5 border-t border-ink/5 py-2 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {row.label}
                    </span>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${chipToneClass[row.tone]}`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="border-t border-ink/5 py-2 text-[13px] text-ink/50">
                  Nothing ordered yet — the Studio has everything for the day.
                </p>
              )}
            </article>

            {/* Schedule */}
            <article className={`${card} px-5 py-4`}>
              {goldHairline}
              <div className="mb-2 flex items-center gap-2.5">
                <h3 className="m-serif text-[16.5px] text-ink">Schedule</h3>
                <Link
                  href={`${base}/schedule`}
                  className="ml-auto whitespace-nowrap text-xs font-bold text-mulberry"
                >
                  Full schedule →
                </Link>
              </div>
              {upcoming.items.length > 0 ? (
                upcoming.items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 border-t border-ink/5 py-2 text-[13px]"
                  >
                    <span className="flex h-6 min-w-[24px] flex-none items-center justify-center rounded-full bg-mulberry/10 px-1 text-[10.5px] font-bold text-mulberry">
                      {shortDate.format(item.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-ink">{item.title}</span>{' '}
                      <span className="text-ink/50">· {item.subtitle}</span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-ink/45">
                      {formatRelativeDays(item.daysFromNow)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="border-t border-ink/5 py-2 text-[13px] text-ink/50">
                  Nothing scheduled in the next stretch — quiet weeks stay quiet.
                </p>
              )}
            </article>
          </div>
        </section>

        {/* ── Suri on watch (AI · render-only) ─────────────────────────── */}
        {aiActive && watchItems.length > 0 ? (
          <section aria-label="Suri on watch">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="m-serif text-2xl text-ink">{spark}Suri on watch</h2>
              <p className="text-sm text-ink/55">
                Guards run in the background — they only speak up when something changes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {watchItems.map(({ intervention, copy }) => (
                <div key={intervention.dedupeKey} className={`${card} flex gap-3 px-4 py-3.5`}>
                  {goldHairline}
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${
                      intervention.category === 'guard'
                        ? 'bg-mulberry ring-4 ring-mulberry/15'
                        : 'bg-terracotta ring-4 ring-terracotta/20'
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-[10.5px] font-bold uppercase tracking-[0.13em] ${
                        intervention.category === 'guard'
                          ? 'text-mulberry'
                          : 'text-terracotta-700 dark:text-terracotta-300'
                      }`}
                    >
                      {intervention.category === 'guard' ? 'Guard' : 'Secretary'} ·{' '}
                      {intervention.templateId}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">
                      {copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink/45">
              <span aria-hidden className="text-terracotta">
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
