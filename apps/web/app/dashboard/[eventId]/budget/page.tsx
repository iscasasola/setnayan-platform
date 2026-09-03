import Link from 'next/link';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { redirect } from 'next/navigation';
import { Download, TrendingUp, Gift, ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isChineseWedding, isMuslimWedding } from '@/lib/chinese-wedding';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchBudgetSnapshot,
  buildBudgetLiveSummary,
  formatPhp,
  type BudgetLiveSummary,
} from '@/lib/budget';
import { resolveEventMoney, bucketLabel, type EventMoney } from '@/lib/budget-truth';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import {
  budgetStripMoney,
  budgetLiveSummaryMoney,
  vendorsToItemize,
} from '@/lib/budget-page-money';
import { resolveAllocationInputs, fetchSavedAllocationPlan } from '@/lib/budget-allocation-data';
import { computeBudgetAllocation } from '@/lib/budget-allocation';
import { buildBudgetLedger } from '@/lib/budget-ledger';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { COUPLE_ORDERS_HIDE_VENDOR_FILTER } from '@/lib/orders';
import { fetchPublishedMethodsForCouple } from '@/lib/vendor-payment-methods.server';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import { fetchPlanForCouple } from '@/lib/vendor-service-payment-schedules.server';
import type { PlanInstance } from '@/lib/vendor-service-payment-schedules';
import { BudgetSetter } from './_components/budget-setter';
import { BudgetAllocationPlanner } from './_components/budget-allocation-planner';
import { ShareBudgetBandToggle } from './_components/share-budget-band-toggle';
import {
  BudgetLiveSummaryCard,
  BUDGET_TOP_SUMMARY_HEADER_ID,
} from './_components/budget-live-summary';
import { BudgetLedgerTable } from './_components/budget-ledger-table';
import {
  CostsWithNoSupplier,
  type RecordedCost,
} from './_components/costs-with-no-supplier';
import { costCategoryOptions } from '@/lib/event-costs';
import type { BudgetStripMoney } from '@/lib/budget-page-money';
import { VendorItemizationCard } from '../_components/vendor-itemization-card';
import { PageMasthead } from '@/app/_components/page-masthead';
import { DeniedState } from '@/app/_components/states/denied-state';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';

export const metadata = { title: 'Budget' };

type Props = { params: Promise<{ eventId: string }> };

// Per-vendor itemization renders only vendors at-or-past 'contracted'.
// Considering / shortlisted vendors are still being shopped — line-item
// and payment tracking is reserved for vendors the host has actually
// locked in. Mirrors the same taxonomy used by BudgetCountdownHeader on
// event home + every other surface that distinguishes "shopping" from
// "committed" (CONFIRMED_VENDOR_STATUSES in lib/events.ts).
const CONFIRMED_STATUS_SET = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);

export default async function BudgetPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Event-type backstop (0053): Budget is a SURFACE, and `simple_event` — the
  // vendor-free type — does not enable it. The nav has hidden Budget there
  // since 2026-06-27 and the Suite strip since 2026-07-31, but a hidden link is
  // not a closed URL: this page opened in full from a bookmark or a typed
  // address, offering to track vendor payments on an event that can have no
  // vendors. Mirrors the monogram guard exactly. Every type that enables
  // `budget` is byte-identical.
  const profile = await resolveProfileByEvent(eventId);
  if (!surfaceEnabled(profile, 'budget')) redirect(`/dashboard/${eventId}`);
  const supabase = await createClient();

  // ── WHO IS READING THE MONEY ──────────────────────────────────────────────
  // The layout admits an accepted delegate to every event surface, and
  // `events_host` hands them `estimated_budget_centavos` because
  // `current_moderator_event_ids()` has no area filter. This page asked
  // nothing, so a coordinator with budget OFF — the live production case — was
  // shown the couple's target. `'budget'` has been a declared delegate area,
  // defaulted OFF, since migration 20261129000000; this is the call site it
  // never had. Nothing about RLS, the view or any grant changes.
  //
  // ⚖ It runs BEFORE the reads below, not after: a refusal that still queries
  // the money is a refusal on the screen only.
  const budgetAccess = await resolveBudgetVisibility(supabase, eventId, user.id);
  if (!budgetAccess.mayRead) {
    // State 05 · DENIED, not Empty. The rows exist and this frame says so —
    // an RLS-shaped "you have none" on a page about money would tell a planner
    // her couple has no budget, which is a different and worse lie.
    return (
      <section className="sn-col space-y-6">
        <PageMasthead id="budget-overview" className="scroll-mt-24" title="Budget" />
        <DeniedState
          title="The budget isn't shared with you"
          scopedTo="the couple and anyone they give budget access to"
          askPerson="the couple"
        />
      </section>
    );
  }

  // Pull the budget target + paid-orders aggregate in parallel with
  // the per-vendor snapshot so the page renders one round-trip wide.
  // The events SELECT defensively reads estimated_budget_centavos —
  // safe even before the migration lands because Supabase tolerates
  // missing columns at runtime (returns undefined) for any caller.
  // BUD-2 · §18.6. The shared money resolver runs in the SAME round trip as
  // everything else, and only when the flag is on — flag OFF issues not one
  // extra query, so the page's cost profile is unchanged in production.
  const budgetTruth = isBudgetTruthEnabled();

  const [eventRes, snapshot, paidOrdersRes, allocInputs, money, savedPlanPhp] = await Promise.all([
    supabase
      // SEC-2b: public.events_host, not public.events — this select names a column
      // (budget / birth data / Drive folder) that is SELECT-denied to `authenticated`
      // on the base table by 20271008731642. The view is the couple/moderator-scoped
      // read path; same columns, same row shape, guests get zero rows.
      .from('events_host')
      .select(
        'event_id, display_name, estimated_budget_centavos, estimated_pax, region, event_type, ceremony_type, secondary_ceremony_type, mahr_description, share_budget_band',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchBudgetSnapshot(supabase, eventId),
    supabase
      .from('orders')
      .select('order_id, requested_total_php, confirmed_total_php, status')
      .eq('event_id', eventId)
      // Exclude the vendor-payer booking-fee order — the couple's spent total
      // must never include what their vendor is charged (belt over RLS).
      .or(COUPLE_ORDERS_HIDE_VENDOR_FILTER)
      .in('status', ['paid', 'fulfilled']),
    // Suggested-split inputs (budget + per-leaf benchmarks/medians + engine
    // config) resolved server-side once; the planner client component re-runs
    // the pure engine on every tilt. Reuses the same authed supabase client.
    resolveAllocationInputs(supabase, eventId),
    // Degrade to the legacy figures on ANY resolver failure rather than
    // printing a confident ₱0 — a budget page that silently zeroes is worse
    // than one that is merely out of date.
    budgetTruth
      ? resolveEventMoney(supabase, eventId).catch((): EventMoney | null => null)
      : Promise.resolve<EventMoney | null>(null),
    // BA3 · the couple's OWN saved plan, per category. Fails empty, never
    // partial — the ledger then falls back to the suggestion and says so.
    fetchSavedAllocationPlan(supabase, eventId),
  ]);

  // Migration-drift fallback (mirrors app/dashboard/[eventId]/page.tsx): the
  // explicit select above names mahr_description (migration 20270308998862). On
  // an un-migrated env PostgREST 42703s the WHOLE query (not just that field),
  // which would null display_name/region/budget too — so on a column-missing
  // error, re-read with '*' to keep the core event fields. Normal prod ships the
  // migration with this code, so this only covers a transient ordering window.
  let eventData = eventRes.data;
  if (
    !eventData &&
    eventRes.error &&
    /column .* does not exist|undefined_column|42703/i.test(
      (eventRes.error as { message?: string; code?: string }).message ??
        (eventRes.error as { code?: string }).code ??
        '',
    )
  ) {
    const fb = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    eventData = fb.data;
  }

  const event = eventData as
    | {
        event_id: string;
        display_name: string;
        estimated_budget_centavos: number | null;
        estimated_pax: number | null;
        region: string | null;
        event_type: string | null;
        ceremony_type: string | null;
        secondary_ceremony_type: string | null;
        mahr_description: string | null;
        share_budget_band: boolean | null;
      }
    | null;

  // Muslim weddings carry a Mahr — the groom's mandatory gift to the bride. It
  // is hers alone and is NOT a Setnayan or vendor charge, so it never enters the
  // budget math (committed totals / overspend); it's surfaced as a distinct,
  // non-billable reminder card.
  const isMuslimCeremony = isMuslimWedding({
    ceremony_type: event?.ceremony_type ?? null,
    secondary_ceremony_type: event?.secondary_ceremony_type ?? null,
  });
  const mahrDescription = (event?.mahr_description as string | null) ?? null;

  // Chinese (Tsinoy) weddings carry tradition-specific spend that doesn't map
  // cleanly to a vendor line — ang pao (red envelopes) gifted during the tea
  // ceremony, and the lauriat banquet that is usually the single largest
  // reception cost. Surfaced as a non-billable advisory (mirrors the Mahr card)
  // via the shared overlay predicate, so it also catches the common
  // church-primary + Chinese-secondary case, not just ceremony_type === 'chinese'.
  const isChineseCeremony = isChineseWedding({
    ceremony_type: event?.ceremony_type ?? null,
    secondary_ceremony_type: event?.secondary_ceremony_type ?? null,
  });

  // Guest count for the lauriat table-count advisory. A lauriat is priced PER
  // TABLE (~10 pax/table), so the one derived fact worth surfacing is the table
  // count — not a ₱ figure (prices are admin-managed, never hardcoded). Normalize
  // estimated_pax to a positive integer; anything missing/zero/invalid → null,
  // which keeps the card on its "set your guest count" copy.
  const paxRaw = event?.estimated_pax ?? null;
  const chineseGuestCount =
    paxRaw != null && Number.isFinite(Number(paxRaw)) && Number(paxRaw) > 0
      ? Math.floor(Number(paxRaw))
      : null;

  // Iteration 0053 P4 Unit 2: the suggested budget SPLIT (wedding cost
  // categories + benchmarks) is the wedding budget-taxonomy pack. 'wedding' is
  // the only event type with a budget taxonomy (profile.budgetTaxonomyKey), so
  // this is the exact equivalent of resolveProfile(event_type).budgetTaxonomyKey
  // === 'wedding'. Wedding → true (split renders, byte-identical); non-wedding →
  // false → generic budget (total + per-vendor itemization only, no split).
  const isWeddingBudget = ((event?.event_type as string | null) ?? 'wedding') === 'wedding';

  // Defensive read — the column may not exist yet in production until
  // migration 20260604030000 lands. Treat undefined and null the same
  // way: host has not set a budget.
  const initialBudgetCentavos: number | null =
    (event as { estimated_budget_centavos?: number | null } | null)
      ?.estimated_budget_centavos ?? null;

  // Couple opt-in (default OFF) to share their budget as a rounded RANGE with
  // vendors on the Customer Card (Customer Card respine PR-5). Defensive read —
  // undefined (pre-migration) treated the same as false.
  const initialShareBudgetBand: boolean =
    (event as { share_budget_band?: boolean | null } | null)?.share_budget_band ?? false;

  // Current commitments — sum of paid/fulfilled service_orders + the
  // total_cost_php of every vendor at-or-past 'contracted' status (the
  // canonical CONFIRMED_VENDOR_STATUSES set). Matches the
  // BudgetCountdownHeader committed-total aggregation so the two
  // surfaces stay in lock-step.
  const paidOrdersTotalPhp = (paidOrdersRes.data ?? []).reduce((acc, row) => {
    const r = row as {
      requested_total_php: number | null;
      confirmed_total_php: number | null;
      status: string;
    };
    const v = r.confirmed_total_php ?? r.requested_total_php ?? 0;
    return acc + (Number.isFinite(Number(v)) ? Number(v) : 0);
  }, 0);
  const contractedVendorsTotalPhp = snapshot.vendors.reduce((acc, s) => {
    if (!CONFIRMED_STATUS_SET.has(s.vendor.status as string)) {
      return acc;
    }
    const cost = s.vendor.total_cost_php !== null ? Number(s.vendor.total_cost_php) : 0;
    return acc + (Number.isFinite(cost) ? cost : 0);
  }, 0);
  const committedPhpTotal = paidOrdersTotalPhp + contractedVendorsTotalPhp;

  // BUD-2 · R1. Strip, live card and vendor list stop being three different
  // row sets. Flag OFF every value below collapses back to the legacy inputs
  // computed above. Both states print FINALIZED money only (BA2).
  const stripMoney = budgetStripMoney({
    enabled: budgetTruth,
    money,
    legacyCommittedPhp: committedPhpTotal,
    targetCentavos: initialBudgetCentavos,
  });

  // BA4 · ONE payment-progress computation, read by both the top summary's
  // Paid/Owed tiles and the live card below it (which also feeds the pinned
  // bar) — so the two can never print different Paid/Owed for one screen the
  // way the strip and the live card used to.
  const liveSummaryMoney: BudgetLiveSummary = budgetLiveSummaryMoney({
    enabled: budgetTruth,
    money,
    legacy: buildBudgetLiveSummary(snapshot),
  });

  // Which vendors get a card. CONFIRMED ONLY, in both flag states (BA2, owner
  // ruling 2026-09-02: "no quotes here. we only add the finalized budgets").
  // A shortlisted supplier's quote belongs in the Merkado, where the couple is
  // still adding and subtracting candidates — not on the page that says what
  // they have signed for.
  const finalizedVendors = vendorsToItemize({
    vendors: snapshot.vendors,
    isConfirmed: (status) => CONFIRMED_STATUS_SET.has(status),
  });
  const hasAnyVendors = snapshot.vendors.length > 0;
  const hasFinalizedVendors = finalizedVendors.length > 0;

  // ── BA3 · THE PLAN MEETS THE LEDGER ───────────────────────────────────────
  // `EventMoney.byBucket` has computed per-category agreed/paid/owed on every
  // load of this page since BUD-1 and had NO reader outside tests. It gets one
  // here, measured against the couple's own plan.
  //
  // "Planned" is the couple's SAVED plan when they have one, and otherwise the
  // allocation engine's recommendation — the SAME `computeBudgetAllocation`
  // the "Suggested budget split" above runs, with no pins, so the two sections
  // cannot print different suggestions for one leaf. The row names which of the
  // two it is; nothing derived is presented as the couple's own figure.
  //
  // ⚠ NO LEDGER WITHOUT THE RESOLVER. `money` is null when the budget-truth
  // flag is off or the resolver refused. There is no per-category truth to
  // print in that state, so this section is absent rather than a table of
  // confident ₱0s — the one failure mode a money page must never have.
  //
  // ⚠ THE SUGGESTION IS WEDDING-SHAPED, SO IT IS GATED ON `isWeddingBudget`.
  // `budget_leaf_benchmarks` IS the wedding budget taxonomy, and every other
  // event type that enables this surface (birthday, debut, christening, wake …)
  // has `budgetTaxonomyKey: null` — which is exactly why the "Suggested budget
  // split" above renders for weddings only. Feeding those benchmarks to a debut
  // would print a ₱450,000 catering plan the couple never made, from a table
  // that does not describe their event. Their rows still render; Planned reads
  // "—", which is the truth: we publish no typical prices for that shape yet.
  const suggestedPlanPhp = new Map<string, number | null>();
  if (isWeddingBudget && allocInputs.budgetPhp != null) {
    for (const leaf of computeBudgetAllocation({
      budgetPhp: allocInputs.budgetPhp,
      leaves: allocInputs.leaves,
      config: allocInputs.config,
    }).leaves) {
      suggestedPlanPhp.set(leaf.canonicalService, leaf.amountPhp);
    }
  }
  const allocLabels = new Map(allocInputs.leaves.map((l) => [l.canonicalService, l.label]));
  const ledger = money
    ? buildBudgetLedger({
        money,
        savedPlanPhp,
        suggestedPhp: suggestedPlanPhp,
        labelFor: (id) => allocLabels.get(id) ?? id,
      })
    : null;

  // ── BA7 · THE COSTS WITH NO SUPPLIER ──────────────────────────────────────
  // Derived from `money.lines`, NOT from a second read of `event_costs`. The
  // resolver already fetched every row to compute the totals above; a second
  // query here would be a second mechanism that can disagree with the first
  // about one fact, which is the defect this whole stream is named after.
  //
  // ⚠ AND WHEN THE RESOLVER GAVE US NOTHING, SAY SO — do not print an empty
  // list. `money` is null when the budget-truth flag is off or the resolver
  // refused, and a couple with six recorded costs reading "nothing here yet"
  // is a failure rendering identically to emptiness. `costsUnavailable`
  // carries that distinction to the render.
  const costsUnavailable = money === null;
  const recordedCosts: RecordedCost[] = (money?.lines ?? [])
    .filter((l) => l.source === 'event_cost')
    .map((l) => ({
      costId: l.sourceRef,
      label: l.label,
      categoryLabel: bucketLabel(l.bucket),
      amountPhp: l.amountPhp,
      paidPhp: l.paidPhp,
      dueDate: l.dueDate,
    }));
  // Every plan group this event type actually shows, plus "Other". The ids are
  // `plan_group_id`, the same namespace `MoneyBucket.bucketId` uses, so a cost
  // filed here lands on the ledger row above rather than opening a new one.
  const costCategories = costCategoryOptions(event?.event_type ?? null);

  // Off-platform direct-pay: resolve each finalized vendor's PUBLISHED
  // payment destinations server-side via the secure helper. It proves the
  // couple owns the event_vendor row (RLS client) before reading the
  // owner-RLS'd vendor_payment_methods table through the admin client, so
  // couples never query payment methods directly. For off-platform/manual
  // vendors (no marketplace profile) the helper returns [] and the card's
  // VendorDirectPay block shows a quiet "coordinate in chat" hint.
  // s.vendor.vendor_id IS the event_vendors.vendor_id the helper expects as
  // `eventVendorId`. Fetched in parallel; any single failure degrades to []
  // for that vendor rather than failing the whole page.
  const adminClient = createAdminClient();
  const directPayEntries = await Promise.all(
    finalizedVendors.map(async (s): Promise<[string, CoupleFacingMethod[]]> => {
      try {
        const methods = await fetchPublishedMethodsForCouple({
          authedClient: supabase,
          adminClient,
          eventId,
          eventVendorId: s.vendor.vendor_id,
        });
        return [s.vendor.vendor_id, methods];
      } catch {
        return [s.vendor.vendor_id, []];
      }
    }),
  );
  const directPayByVendor = new Map<string, CoupleFacingMethod[]>(directPayEntries);

  // Per-booking PAYMENT PLAN installments (Phase 2 PR-B/PR-C). Couple-RLS-
  // scoped, so the authed client reads event_vendor_payment_plan directly.
  // null = not locked / pre-PR-B; [] = locked, no schedule; [...] = render the
  // installment dropdown in the log-payment form. Fetched in parallel; a single
  // failure degrades that vendor to null (dropdown hidden) rather than failing
  // the page. s.vendor.vendor_id IS the event_vendors.vendor_id the plan keys on.
  const planEntries = await Promise.all(
    finalizedVendors.map(async (s): Promise<[string, PlanInstance[] | null]> => {
      try {
        const plan = await fetchPlanForCouple({
          authedClient: supabase,
          eventId,
          eventVendorId: s.vendor.vendor_id,
        });
        return [s.vendor.vendor_id, plan];
      } catch {
        return [s.vendor.vendor_id, null];
      }
    }),
  );
  const installmentsByVendor = new Map<string, PlanInstance[] | null>(planEntries);

  return (
    <section className="sn-col space-y-6">
      {/* id targets for the Budget docked sub-nav (lib/customer-menu.ts anchor
          children: Overview · Allocate · Payments). scroll-mt keeps the section
          title clear of the top edge on smooth-scroll. */}
      <PageMasthead
        id="budget-overview"
        className="scroll-mt-24"
        title="Budget"
        actions={
          <Link
            href={`/api/budget/${eventId}/ics`}
            className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-white/55 px-4 py-2 text-sm font-medium text-ink backdrop-blur-sm transition hover:border-terracotta/50 hover:text-terracotta-700"
          >
            <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Export upcoming dates (.ics)
          </Link>
        }
      />

      {/* Budget Setter — the single number that powers
       *  BudgetCountdownHeader on event home. Lives at the top of the
       *  page because it's the first thing a host needs to set before
       *  the rest of the budget math has anchors. */}
      {/* 🔒 SETTING the target is the couple's alone — locked D1, "budget never
          exceeds view in V1", stated in `moderator_area_level`'s own comment in
          production and mirrored in `resolveAreaLevel`. A delegate who may READ
          the money (one holding checkout) still never moves it, so the control
          is not rendered rather than rendered-and-refused. */}
      {budgetAccess.mayEdit ? (
        <BudgetSetter eventId={eventId} initialBudgetCentavos={initialBudgetCentavos} />
      ) : null}

      <BudgetTopSummary eventId={eventId} money={stripMoney} initialLive={liveSummaryMoney} />

      {isMuslimCeremony ? (
        <MahrInfoCard eventId={eventId} mahrDescription={mahrDescription} />
      ) : null}

      {isChineseCeremony ? <ChineseTraditionInfoCard pax={chineseGuestCount} /> : null}

      {/* Suggested budget split — the median-anchored allocation planner.
       *  RECOMMENDS what each service should cost (a ₱ target + shopping
       *  range per leaf) BEFORE the couple contracts anyone, complementing
       *  the per-vendor TRACKING below. The pure engine runs client-side for
       *  instant tilt feedback; inputs were resolved server-side above. */}
      {/* Iteration 0053 P4 Unit 2: the suggested split is the wedding budget
       *  taxonomy (wedding cost categories + benchmarks). Only render it for
       *  marriage-profile events; a non-wedding gets the generic budget (total
       *  + per-vendor itemization below). allocInputs is still resolved above
       *  for weddings — the Promise.all is unchanged so the wedding path is
       *  byte-identical. */}
      {isWeddingBudget ? (
        <div id="budget-allocate" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
          <div className="space-y-2">
            <h2 className="sn-sec text-2xl sm:text-3xl">Suggested budget split</h2>
            <p className="max-w-prose text-sm text-ink/65">
              A starting point from typical Filipino wedding costs — nudge anything;
              it&rsquo;s a guide, not a rule.
            </p>
          </div>

          <BudgetAllocationPlanner
            eventId={eventId}
            budgetPhp={allocInputs.budgetPhp}
            leaves={allocInputs.leaves}
            config={allocInputs.config}
            pax={allocInputs.pax}
            region={event?.region ?? null}
          />

          {/* Opt-in to share this plan as a rounded RANGE with vendors — sits
           *  right under the split it derives from. Off by default; range-only,
           *  per-category, never an exact number (Customer Card respine PR-5). */}
          {/* Sharing the couple's budget band with suppliers is a disclosure
           *  ABOUT THE COUPLE'S MONEY, so it follows the same rule as setting
           *  the target: theirs to make, nobody else's. */}
          {budgetAccess.mayEdit ? (
            <ShareBudgetBandToggle
              eventId={eventId}
              initialShare={initialShareBudgetBand}
            />
          ) : null}
        </div>
      ) : null}

      {/* BA3 — one row per category: Planned · Agreed · Paid · Owed. Sits
       *  between the plan above and the per-supplier detail below, because it
       *  is the sentence that joins them. */}
      {ledger ? (
        <div className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
          <BudgetLedgerTable ledger={ledger} />
        </div>
      ) : null}

      {/* BA7 — money with nobody on the other side of it. Sits between the
       *  category table and the per-supplier detail because that is what it
       *  is: a category's money that has no supplier card to live on. */}
      <div className="space-y-4 border-t border-ink/10 pt-6">
        {costsUnavailable ? (
          <p className="text-sm text-ink/65">
            We could not load your own recorded costs just now. Nothing is lost
            — reload the page, and if it keeps happening reach out from /help.
          </p>
        ) : null}
        <CostsWithNoSupplier
          eventId={eventId}
          categories={costCategories}
          costs={recordedCosts}
          canEdit={budgetAccess.mayEdit}
        />
      </div>

      {/* Existing per-vendor itemization + payment log — unchanged
       *  surface from before this PR. Heading added so the visual break
       *  from the setter form above is clear. */}
      <div id="budget-payments" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
        <div className="space-y-2">
          <h2 className="sn-sec text-2xl sm:text-3xl">Per-vendor itemization</h2>
          <p className="max-w-prose text-sm text-ink/65">
            Vendor-controlled line items come from the vendor&rsquo;s catalog and
            refresh as they update their pricing. For off-platform vendors, add
            line items yourself. Log payments against either source as money moves
            — your committed total above updates automatically.
          </p>
        </div>

        {!hasAnyVendors ? (
          <EmptyBudget eventId={eventId} />
        ) : !hasFinalizedVendors ? (
          <NoFinalizedVendors eventId={eventId} />
        ) : (
          <ul className="space-y-4">
            {finalizedVendors.map((s) => (
              <li key={s.vendor.vendor_id}>
                <VendorItemizationCard
                  summary={s}
                  eventId={eventId}
                  variant="card"
                  directPayMethods={directPayByVendor.get(s.vendor.vendor_id) ?? []}
                  installments={installmentsByVendor.get(s.vendor.vendor_id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * BA4 · ONE money summary, not two. Used to be "Current commitments" (Target
 * / Committed / Budget left) sitting above "Payment progress" (Total to pay /
 * Paid so far / Balance) — four overlapping words for different quantities on
 * one screen. Now a single card: Target · Agreed · Paid · Owed (the same
 * vocabulary BA3's ledger locked), the live progress bar, and the
 * upcoming-payments list, with a condensed version that pins once this header
 * scrolls away (`BudgetLiveSummaryCard`).
 *
 * Renders even when no vendors are confirmed yet, so the host sees their
 * target reflected back to them as soon as they save.
 */
function BudgetTopSummary({
  eventId,
  money,
  initialLive,
}: {
  eventId: string;
  money: BudgetStripMoney;
  initialLive: BudgetLiveSummary;
}) {
  const { targetPhp, committedPhp: agreedPhp, isOverBudget } = money;
  const { paid: paidPhp, remaining: owedPhp } = initialLive;

  return (
    <section aria-labelledby="budget-summary-heading" className="sn-tile space-y-4">
      {/* No border of its own — the pinned bar in BudgetLiveSummaryCard
       *  measures THIS element's box, not the outer .sn-tile card's (which
       *  carries a 1px border and would drift the pin a pixel off). */}
      <header id={BUDGET_TOP_SUMMARY_HEADER_ID} className="flex items-baseline gap-2">
        <h2 id="budget-summary-heading" className="sn-eye">
          <TrendingUp aria-hidden strokeWidth={1.75} />
          Your budget
        </h2>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Target"
          value={targetPhp !== null ? formatPhp(targetPhp) : '—'}
          hint={targetPhp !== null ? 'Your stated budget' : 'No target set yet'}
        />
        <SummaryStat
          label="Agreed"
          value={formatPhp(agreedPhp)}
          tone={isOverBudget ? 'warn' : 'default'}
          hint={
            targetPhp === null
              ? agreedPhp > 0
                ? 'What you signed for'
                : 'Nothing signed yet'
              : isOverBudget
                ? `${formatPhp(agreedPhp - targetPhp)} over your target`
                : `${formatPhp(targetPhp - agreedPhp)} left of target`
          }
        />
        <SummaryStat label="Paid" value={formatPhp(paidPhp)} tone="good" hint="Handed over so far" />
        <SummaryStat
          label="Owed"
          value={formatPhp(owedPhp)}
          tone={owedPhp > 0 ? 'warn' : 'default'}
          hint={owedPhp > 0 ? 'Agreed minus paid' : 'Nothing outstanding'}
        />
      </ul>

      <BudgetLiveSummaryCard eventId={eventId} initial={initialLive} targetPhp={targetPhp} />
    </section>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warn' | 'good';
}) {
  return (
    <li className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{label}</p>
      <p
        className={`font-mono text-2xl font-bold ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-success-700'
              : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-ink/55">{hint}</p>
    </li>
  );
}

// The Mahr — a Muslim wedding's groom-to-bride gift. Deliberately rendered as a
// distinct, NON-billable card (emerald, "gift" framing) so it never reads as a
// Setnayan/vendor charge and is never folded into the committed/overspend math.
// Setnayan neither holds nor processes the mahr; this is the couple's private
// record, set from the Nikah-essentials card on Home.
function MahrInfoCard({
  eventId,
  mahrDescription,
}: {
  eventId: string;
  mahrDescription: string | null;
}) {
  const isSet = !!mahrDescription && mahrDescription.trim().length > 0;
  return (
    <section
      aria-labelledby="mahr-info-heading"
      className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <Gift aria-hidden className="h-4 w-4 text-emerald-700" strokeWidth={1.75} />
        <h2
          id="mahr-info-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-800"
        >
          Mahr — a gift to the bride
        </h2>
      </div>
      <p className="mt-2 text-sm text-ink/75">
        {isSet ? (
          <>
            Your mahr: <span className="font-medium text-ink">{mahrDescription}</span>.
            It belongs to the bride alone — Setnayan never charges or processes
            it, so it stays out of your budget totals.
          </>
        ) : (
          <>
            A Muslim marriage includes the mahr — the groom&rsquo;s gift to the
            bride, hers alone. It isn&rsquo;t a Setnayan or vendor charge, so it
            lives outside your budget. Record yours from the Nikah card on Home.
          </>
        )}
      </p>
      <Link
        href={`/dashboard/${eventId}`}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-900"
      >
        {isSet ? 'Update mahr' : 'Set mahr'}
        <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
      </Link>
    </section>
  );
}

// Chinese (Tsinoy) tradition note — a NON-billable advisory mirroring MahrInfoCard
// (same card shell + emerald "gift" framing). It records nothing and charges
// nothing: ang pao and the lauriat are the couple's own arrangements, not a
// Setnayan or vendor charge, so the card carries no setter and no price. Purely
// informational guidance to help the couple shape their own budget. Editorial
// voice, no exclamation marks.
//
// The lauriat banquet is priced PER TABLE (~10 pax/table), not per head — that's
// the one cost-model fact worth surfacing. When the couple's guest count is set,
// we show the DERIVED TABLE COUNT (a fact, fine to compute), never a ₱ figure:
// per-table catering rates are admin-managed and not readily in scope here, so we
// keep the estimate advisory (table count + lauriat note) rather than hardcode a
// price.
const LAURIAT_PAX_PER_TABLE = 10;
function ChineseTraditionInfoCard({ pax }: { pax: number | null }) {
  const tables = pax !== null ? Math.ceil(pax / LAURIAT_PAX_PER_TABLE) : null;
  return (
    <section
      aria-labelledby="chinese-tradition-heading"
      className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="h-4 w-4 text-emerald-700" strokeWidth={1.75} />
        <h2
          id="chinese-tradition-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-800"
        >
          Chinese traditions — a budget note
        </h2>
      </div>
      <p className="mt-2 text-sm text-ink/75">
        A Chinese wedding carries a few costs worth planning for. Ang pao — red
        envelopes — are given to elders during the tea ceremony, kept aside from
        your vendor spend. The lauriat banquet is typically the main reception
        cost, and it&rsquo;s priced per table — about {LAURIAT_PAX_PER_TABLE}{' '}
        guests to a table — so it&rsquo;s worth anchoring your budget around it
        early. These are your own arrangements, not a Setnayan or vendor charge,
        so they stay outside your committed totals.
      </p>
      {tables !== null && pax !== null ? (
        <p className="mt-2 text-sm font-medium text-emerald-900">
          About {tables} lauriat {tables === 1 ? 'table' : 'tables'} for {pax}{' '}
          guests.
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink/60">
          Set your guest count to see an estimated table count.
        </p>
      )}
    </section>
  );
}

/**
 * BA7 · WHAT THIS USED TO SAY, AND WHY IT CHANGED.
 *
 * In full: *"No vendors yet. Add a vendor first, then come back here to
 * itemize costs."* It was accurate about the schema — `event_vendor_line_items
 * .vendor_id` was NOT NULL, so there was genuinely nowhere to put a peso — and
 * it was the defect, said out loud: a couple who had bought their rings was
 * told to invent a supplier before their own budget would take the number.
 *
 * `event_costs` removed the reason, so the sentence had to go with it. This
 * frame now points at the section directly above, which accepts a cost with or
 * without a supplier, and keeps the suppliers link as the other door rather
 * than the only one.
 */
function EmptyBudget({ eventId }: { eventId: string }) {
  return (
    <div className="sn-row border-dashed p-8 text-center">
      <p className="mx-auto max-w-prose text-sm text-ink/65">
        Nothing itemized against a supplier yet. Costs you pay yourself — the
        rings, the licence, tips — go in the section above; book a supplier and
        their line items and payments appear here.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/vendors`} className="button-primary">
          Find suppliers
        </Link>
      </div>
    </div>
  );
}

/**
 * Empty state for: ≥1 vendor on the event, but none yet contracted.
 * Per-vendor budget tracking unlocks once a vendor is locked in — until
 * then, considering / shortlisted vendors are still being shopped and
 * pricing isn't pinned down. The host can keep shortlisting from the
 * vendors page; once they contract one, it'll appear here.
 */
function NoFinalizedVendors({ eventId }: { eventId: string }) {
  return (
    <div className="sn-row border-dashed p-8 text-center">
      <p className="text-sm text-ink/65">
        You&rsquo;re still choosing vendors — exactly where you should be at this
        stage. The moment you contract one, its itemized costs and payments show
        up here on their own. Keep shortlisting from your vendors.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/vendors`} className="button-primary">
          Open vendors
        </Link>
      </div>
    </div>
  );
}

