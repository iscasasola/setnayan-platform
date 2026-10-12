import Link from 'next/link';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { redirect } from 'next/navigation';
import { Download, Printer, Gift, ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isChineseWedding, isMuslimWedding } from '@/lib/chinese-wedding';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchBudgetSnapshot,
  buildBudgetLiveSummary,
  type BudgetLiveSummary,
} from '@/lib/budget';
import {
  resolveEventMoneySettled,
  moneyReadsAllOk,
  unreadEventMoney,
  type EventMoney,
} from '@/lib/budget-truth';

import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import {
  budgetStripMoney,
  budgetLiveSummaryMoney,
  vendorsToItemize,
  legacyCommittedVendorsPhp,
} from '@/lib/budget-page-money';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { COUPLE_ORDERS_HIDE_VENDOR_FILTER } from '@/lib/orders';
import { BudgetScreen, type SupplierExtras } from './_components/budget-screen';
import { buildBudgetList, pickNextPayment, type NextPayment } from '@/lib/budget-page-view';
import { costCategoryOptions } from '@/lib/event-costs';
import { depositStepHref } from '@/lib/deposit-pay-step';
import { paymentDoor, type PaymentDoor } from '@/lib/accepted-quote-terms';
import { PageMasthead } from '@/app/_components/page-masthead';
import { YOUR_TEAM_BUDGET_PART, yourTeamBudgetHref } from '@/lib/pillar-parts';
import { DeniedState } from '@/app/_components/states/denied-state';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { formatCount } from '@/lib/format-number';
import { MiniTour } from '@/app/_components/mini-tour';

export const metadata = { title: 'Budget' };

type Props = {
  params: Promise<{ eventId: string }>;
  /** `part=budget` = rendered as Your Team's Budget part (see below). */
  searchParams?: Promise<{ part?: string }>;
};

// Per-vendor itemization renders only vendors at-or-past 'contracted'.
// Considering / shortlisted vendors are still being shopped — line-item
// and payment tracking is reserved for vendors the host has actually
// locked in. Mirrors the same taxonomy used by BudgetCountdownHeader on
// event home + every other surface that distinguishes "shopping" from
// "committed" (CONFIRMED_VENDOR_STATUSES in lib/events.ts).
const CONFIRMED_STATUS_SET = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);

export default async function BudgetPage({ params, searchParams }: Props) {
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

  // ── YOUR TEAM'S BUDGET PART (owner 2026-09-29) ───────────────────────────
  // Budget moved into the Your Team pillar (`lib/pillar-parts.ts`): Your Team
  // renders THIS page whole at `?part=budget`, and passes that same param here
  // so the two know which one is drawing. Visited on its own, the page lands in
  // that part — but only where Your Team exists: `marketplace_enabled` is the
  // column Your Team itself gates on, so an event type without suppliers keeps
  // this page exactly as it was rather than being sent to a page that would
  // send it home.
  if (YOUR_TEAM_BUDGET_PART !== (await searchParams)?.part && profile.marketplaceEnabled === true) {
    redirect(yourTeamBudgetHref(eventId));
  }
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

  const [eventRes, snapshot, paidOrdersRes, moneyRead] = await Promise.all([
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
    // B0 (2026-10-08) · the resolver is asked in the form that NEVER rejects and
    // says, per source, whether it answered (`EventMoney.reads`). No catch here
    // that turns a failure into `null` — a `null` cannot say WHICH read failed,
    // and the render needs to know.
    budgetTruth
      ? resolveEventMoneySettled(supabase, eventId)
      : Promise.resolve<EventMoney | null>(null),
  ]);

  // ── A PARTIAL LEDGER IS NOT A LEDGER (B0) ─────────────────────────────────
  // Every figure this page prints from `money` today is a sum over ALL three
  // sources. With one refused, that sum is not a smaller answer, it is a wrong
  // one — so the SUMMARY's figures come from `money` only when all three reads
  // answered (see `summaryFigures`). `moneyRead` keeps the per-source status,
  // and the LIST below is built from it group by group: a group whose read
  // answered is drawn, a group whose read was refused says so.
  const money = moneyRead !== null && moneyReadsAllOk(moneyRead) ? moneyRead : null;

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

  // Defensive read — the column may not exist yet in production until
  // migration 20260604030000 lands. Treat undefined and null the same
  // way: host has not set a budget.
  const initialBudgetCentavos: number | null =
    (event as { estimated_budget_centavos?: number | null } | null)
      ?.estimated_budget_centavos ?? null;

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
  // ── AND THE CHANGES AGREED SINCE (owner 2026-09-09) ──────────────────────
  // The arithmetic moved to `legacyCommittedVendorsPhp` so it can be tested:
  // a number that lives inside a page cannot be. It sums each confirmed
  // supplier's headline PLUS the change-order deltas settled against them —
  // because a change accepted after the lock never moves `total_cost_php`, so
  // without that term this strip kept printing the pre-change figure while the
  // supplier's own card printed the new one, on the same screen.
  const contractedVendorsTotalPhp = legacyCommittedVendorsPhp(snapshot.vendors, (status) =>
    CONFIRMED_STATUS_SET.has(status),
  );
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

  // ── B1 · WHAT THE SUMMARY MAY STATE ───────────────────────────────────────
  // `moneyRead` non-null with a refused source = the resolver RAN and one of
  // its three reads failed. Agreed and Paid are sums over all three, so they
  // are unknown — drawn "—", never a legacy figure and never ₱0. (`moneyRead`
  // null is the kill-switch: the resolver was not asked at all, and the legacy
  // arithmetic in `stripMoney` / `liveSummaryMoney` is the figure, as before.)
  const ledgerRefused = moneyRead !== null && !moneyReadsAllOk(moneyRead);
  const summaryFigures: { agreedPhp: number | null; paidPhp: number | null; owedPhp: number | null } =
    ledgerRefused
      ? { agreedPhp: null, paidPhp: null, owedPhp: null }
      : {
          agreedPhp: stripMoney.committedPhp,
          paidPhp: liveSummaryMoney.paid,
          owedPhp: liveSummaryMoney.remaining,
        };
  // The ONE "Next" line. From the resolver's own lines — agreed money only —
  // so it cannot name a payment to a supplier the couple never booked. With
  // the resolver switched off, the legacy list's first row (what this page
  // listed under "Next payments" before).
  const legacyNext = liveSummaryMoney.upcoming[0];
  const nextPayment: NextPayment | null = ledgerRefused
    ? null
    : money
      ? pickNextPayment(money.lines)
      : legacyNext
        ? {
            amountPhp: legacyNext.remainingPhp,
            name: legacyNext.vendorName,
            dueDate: legacyNext.dueDate,
            vendorId: legacyNext.vendorId,
            costId: null,
          }
        : null;

  // ── B2 · THE ONE LIST ─────────────────────────────────────────────────────
  // Booked suppliers · Bought on Setnayan · Your expenses — every row a reading
  // of the resolver's own lines (`buildBudgetList`), NOT a second read of
  // `event_vendors`, `orders` or `event_costs`. The resolver already fetched
  // every row to compute the totals above; a second query here would be a
  // second mechanism that can disagree with the first about one fact.
  //
  // ⚠ AND WHEN THE RESOLVER GAVE US NOTHING, SAY SO. `moneyRead` is null only
  // when the kill-switch is off and the resolver was never asked; there are no
  // lines to draw then, and three "nothing yet" groups would be a failure
  // rendering identically to emptiness. `unreadEventMoney()` makes every group
  // read "Couldn't load …" instead. (Production has run with the switch ON
  // since 2026-09-02.)
  const list = buildBudgetList(moneyRead ?? unreadEventMoney());
  // The categories the Add expense sheet offers: every plan group this event
  // type shows, plus "Other". The ids are `plan_group_id`, the namespace
  // `MoneyBucket.bucketId` uses.
  const costCategories = costCategoryOptions(event?.event_type ?? null);

  // ── WHAT A SUPPLIER'S SHEET NEEDS BESIDES THE MONEY ──────────────────────
  // Its payment history (date · how — the resolver's payment rows carry
  // neither), which door a new payment goes through, and how to reach them.
  // Only suppliers the couple has BOOKED get one (BA2, owner 2026-09-02: "no
  // quotes here. we only add the finalized budgets").
  const finalizedVendors = vendorsToItemize({
    vendors: snapshot.vendors,
    isConfirmed: (status) => CONFIRMED_STATUS_SET.has(status),
  });

  // THE PAYMENT DOOR (2026-09-20 · #5717). A supplier ON SETNAYAN is paid
  // through "Amount to pay" — it names which payment is due, takes the first
  // through `recordDeposit` (date held, supplier asked to confirm) and later
  // ones through `logPayment`. Recording here as well was a second door, so the
  // sheet's button goes THERE for them. One batched read; a refused read leaves
  // the door 'unknown' — never a blind 'log'.
  const marketplaceFinalized = finalizedVendors.filter((s) => s.vendor.marketplace_vendor_id);
  const doorByVendor = new Map<string, PaymentDoor>();
  if (marketplaceFinalized.length > 0) {
    const { data: depRows, error: depErr } = await supabase
      .from('event_vendors')
      .select('vendor_id, deposit_recorded_at')
      .eq('event_id', eventId)
      .in(
        'vendor_id',
        marketplaceFinalized.map((s) => s.vendor.vendor_id),
      );
    if (depErr) console.error('[budget] deposit-marker read refused', depErr.message, { event_id: eventId });
    const deps = new Map(
      ((depRows ?? []) as { vendor_id: string; deposit_recorded_at: string | null }[]).map((r) => [
        r.vendor_id,
        r.deposit_recorded_at,
      ]),
    );
    for (const s of marketplaceFinalized) {
      const vid = s.vendor.vendor_id;
      doorByVendor.set(
        vid,
        paymentDoor({
          isMarketplaceVendor: true,
          depositRecordedAt: depErr || !deps.has(vid) ? undefined : (deps.get(vid) ?? null),
        }),
      );
    }
  }

  // Looked up among the BOOKED suppliers only (`finalizedVendors`), so nothing
  // about an un-booked supplier can reach a sheet.
  const snapshotByVendor = new Map(finalizedVendors.map((s) => [s.vendor.vendor_id, s]));
  const supplierExtras: Record<string, SupplierExtras> = {};
  for (const row of list.suppliers ?? []) {
    const s = snapshotByVendor.get(row.vendorId);
    const onSetnayan = Boolean(s?.vendor.marketplace_vendor_id);
    supplierExtras[row.vendorId] = {
      payments: (s?.payments ?? []).map((pay) => ({
        paymentId: pay.payment_id,
        paidAt: String(pay.paid_at).slice(0, 10),
        amountPhp: Number(pay.amount_php),
        method: pay.method,
      })),
      // Off Setnayan → recorded here. On Setnayan → whatever the read said. A
      // supplier the snapshot does not know at all is never logged blind.
      door: !s ? 'unknown' : onSetnayan ? (doorByVendor.get(row.vendorId) ?? 'unknown') : 'log',
      amountToPayHref: depositStepHref(eventId, row.vendorId),
      // A shop on Setnayan is reached through its conversation. Anyone else has
      // no thread to open, so Chat lands on Messages.
      chat: onSetnayan ? { kind: 'thread' } : { kind: 'link', href: `/dashboard/${eventId}/messages` },
    };
  }

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
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/budget/${eventId}/ics`}
              className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-white/55 px-4 py-2 text-sm font-medium text-ink backdrop-blur-sm transition hover:border-terracotta/50 hover:text-terracotta-700"
            >
              <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Export upcoming dates (.ics)
            </a>
            {/* SUP-64 · the same books as this page, to print or to open in a
                spreadsheet. Agreed money only — see lib/budget-export.ts.
                Offered only when the resolver answered: with no `money` the
                route can only say "try again", so the button would be a
                promise the page already knows it cannot keep. */}
            {money ? (
              <>
                <a
                  href={`/api/budget/${eventId}/export?format=csv`}
                  className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-white/55 px-4 py-2 text-sm font-medium text-ink backdrop-blur-sm transition hover:border-terracotta/50 hover:text-terracotta-700"
                >
                  <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Budget (.csv)
                </a>
                <a
                  href={`/api/budget/${eventId}/export`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-white/55 px-4 py-2 text-sm font-medium text-ink backdrop-blur-sm transition hover:border-terracotta/50 hover:text-terracotta-700"
                >
                  <Printer aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Print budget
                </a>
              </>
            ) : null}
          </div>
        }
      />

      {/* B1 + B2 (2026-10-08) · THE BUDGET SCREEN. The summary as rows — Target ·
       *  Agreed · Paid · Owed two by two, one meter, one "Next" line — then ONE
       *  list in three groups: Booked suppliers · Bought on Setnayan · Your
       *  expenses. `BudgetScreen` draws both, because "Pay ›" on the Next line
       *  opens the same sheet a supplier's row does.
       *
       *  It replaced, in order: the setter form, the boxed four-stat tile and
       *  its pinned bar (B1); the "Suggested budget split" planner, the
       *  "Category by category" table, the "Costs you pay yourself" form and
       *  the per-supplier itemization cards (B2). The estimate READERS are
       *  untouched — the Suppliers page, Explore and the CSV export still ask
       *  them; only this page stopped drawing them (owner: "not this one").
       *
       *  🔒 WRITING money is the couple's alone — locked D1, "budget never
       *  exceeds view in V1". A delegate who may READ sees the same rows; the
       *  Target is a figure, not a field, and no sheet offers a verb. */}
      <BudgetScreen
        eventId={eventId}
        canEdit={budgetAccess.mayEdit}
        summary={{
          targetPhp: stripMoney.targetPhp,
          agreedPhp: summaryFigures.agreedPhp,
          paidPhp: summaryFigures.paidPhp,
          owedPhp: summaryFigures.owedPhp,
          next: nextPayment,
        }}
        list={list}
        supplierExtras={supplierExtras}
        categories={costCategories}
      >
        {isMuslimCeremony ? <MahrInfoCard eventId={eventId} mahrDescription={mahrDescription} /> : null}
        {isChineseCeremony ? <ChineseTraditionInfoCard pax={chineseGuestCount} /> : null}
      </BudgetScreen>

      {/* First visit only — the shipped MiniTour (owner 2026-09-25). */}
      <MiniTour tourKey="customer_budget_v1" />
    </section>
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
          className="tabular-nums text-[11px] uppercase tracking-[0.2em] text-emerald-800"
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
            bride, hers alone. It isn&rsquo;t a Setnayan or supplier charge, so it
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
          className="tabular-nums text-[11px] uppercase tracking-[0.2em] text-emerald-800"
        >
          Chinese traditions — a budget note
        </h2>
      </div>
      <p className="mt-2 text-sm text-ink/75">
        Chinese traditions carry a few costs worth planning for. Ang pao — red
        envelopes — are given to elders during the tea ceremony, kept aside from
        your supplier spend. The lauriat banquet is typically the main reception
        cost, and it&rsquo;s priced per table — about {formatCount(LAURIAT_PAX_PER_TABLE)}{' '}
        guests to a table — so it&rsquo;s worth anchoring your budget around it
        early. These are your own arrangements, not a Setnayan or supplier charge,
        so they stay outside your committed totals.
      </p>
      {tables !== null && pax !== null ? (
        <p className="mt-2 text-sm font-medium text-emerald-900">
          About {tables} lauriat {tables === 1 ? 'table' : 'tables'} for {formatCount(pax)}{' '}
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
