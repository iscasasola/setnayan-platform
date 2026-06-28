import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, TrendingUp, Gift, ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchBudgetSnapshot, formatPhp } from '@/lib/budget';
import { resolveAllocationInputs } from '@/lib/budget-allocation-data';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { fetchPublishedMethodsForCouple } from '@/lib/vendor-payment-methods.server';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import { fetchPlanForCouple } from '@/lib/vendor-service-payment-schedules.server';
import type { PlanInstance } from '@/lib/vendor-service-payment-schedules';
import { BudgetSetter } from './_components/budget-setter';
import { BudgetAllocationPlanner } from './_components/budget-allocation-planner';
import { VendorItemizationCard } from '../_components/vendor-itemization-card';

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
  const supabase = await createClient();

  // Pull the budget target + paid-orders aggregate in parallel with
  // the per-vendor snapshot so the page renders one round-trip wide.
  // The events SELECT defensively reads estimated_budget_centavos —
  // safe even before the migration lands because Supabase tolerates
  // missing columns at runtime (returns undefined) for any caller.
  const [eventRes, snapshot, paidOrdersRes, allocInputs] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, estimated_budget_centavos, region, event_type, ceremony_type, secondary_ceremony_type, mahr_description',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchBudgetSnapshot(supabase, eventId),
    supabase
      .from('orders')
      .select('order_id, requested_total_php, confirmed_total_php, status')
      .eq('event_id', eventId)
      .in('status', ['paid', 'fulfilled']),
    // Suggested-split inputs (budget + per-leaf benchmarks/medians + engine
    // config) resolved server-side once; the planner client component re-runs
    // the pure engine on every tilt. Reuses the same authed supabase client.
    resolveAllocationInputs(supabase, eventId),
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
        region: string | null;
        event_type: string | null;
        ceremony_type: string | null;
        secondary_ceremony_type: string | null;
        mahr_description: string | null;
      }
    | null;

  // Muslim weddings carry a Mahr — the groom's mandatory gift to the bride. It
  // is hers alone and is NOT a Setnayan or vendor charge, so it never enters the
  // budget math (committed totals / overspend); it's surfaced as a distinct,
  // non-billable reminder card.
  const isMuslimCeremony =
    ((event?.ceremony_type as string | null) ?? null) === 'muslim' ||
    ((event?.secondary_ceremony_type as string | null) ?? null) === 'muslim';
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

  // Filter to only finalized vendors for the per-vendor itemization
  // section. Considering / shortlisted vendors are still being shopped
  // — line-item + payment tracking unlocks once they're contracted.
  // Topline metrics (Total budget / Paid so far / Remaining / Due in
  // 30 days) still reflect all vendors via snapshot.totals — those
  // numbers come from line items + payments which can pre-exist a
  // contract (pencil-in deposits are valid).
  const finalizedVendors = snapshot.vendors.filter((s) =>
    CONFIRMED_STATUS_SET.has(s.vendor.status as string),
  );
  const hasAnyVendors = snapshot.vendors.length > 0;
  const hasFinalizedVendors = finalizedVendors.length > 0;

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
    <section className="space-y-6">
      {/* id targets for the Budget docked sub-nav (lib/customer-menu.ts anchor
          children: Overview · Allocate · Payments). scroll-mt keeps the section
          title clear of the top edge on smooth-scroll. */}
      <header id="budget-overview" className="flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Budget</h1>
          <p className="max-w-prose text-base text-ink/65">
            {/* Iteration 0053 P4 Unit 3: wedding copy verbatim; non-wedding swaps
                the one wedding word. JSX collapses whitespace, so the wedding
                branch renders byte-identically. */}
            {isWeddingBudget ? (
              <>
                Set your total wedding budget. As you contract vendors, their published
                pricing fills in below — for off-platform vendors, you enter line items
                yourself. Export upcoming due dates as a `.ics` file your calendar app
                can swallow.
              </>
            ) : (
              <>
                Set your total event budget. As you contract vendors, their published
                pricing fills in below — for off-platform vendors, you enter line items
                yourself. Export upcoming due dates as a `.ics` file your calendar app
                can swallow.
              </>
            )}
          </p>
        </div>
        <Link
          href={`/api/budget/${eventId}/ics`}
          className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
        >
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Export upcoming dates (.ics)
        </Link>
      </header>

      {/* Budget Setter — the single number that powers
       *  BudgetCountdownHeader on event home. Lives at the top of the
       *  page because it's the first thing a host needs to set before
       *  the rest of the budget math has anchors. */}
      <BudgetSetter eventId={eventId} initialBudgetCentavos={initialBudgetCentavos} />

      <BudgetSummaryStrip
        targetCentavos={initialBudgetCentavos}
        committedPhp={committedPhpTotal}
      />

      {isMuslimCeremony ? (
        <MahrInfoCard eventId={eventId} mahrDescription={mahrDescription} />
      ) : null}

      {isChineseCeremony ? <ChineseTraditionInfoCard /> : null}

      <UnlocksHint />

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
            <h2 className="font-display text-2xl italic text-ink/85 sm:text-3xl">
              Suggested budget split
            </h2>
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
        </div>
      ) : null}

      {/* Existing per-vendor itemization + payment log — unchanged
       *  surface from before this PR. Heading added so the visual break
       *  from the setter form above is clear. */}
      <div id="budget-payments" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-6">
        <div className="space-y-2">
          <h2 className="font-display text-2xl italic text-ink/85 sm:text-3xl">
            Per-vendor itemization
          </h2>
          <p className="max-w-prose text-sm text-ink/65">
            Vendor-controlled line items come from the vendor&rsquo;s catalog and
            refresh as they update their pricing. For off-platform vendors, add
            line items yourself. Log payments against either source as money moves
            — your committed total above updates automatically.
          </p>
        </div>

        <StatsStrip totals={snapshot.totals} />

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
 * Quiet summary of where the host stands right now — target vs
 * committed + the remaining headroom (or amount over). Sits between
 * the setter form + the per-vendor itemization. Renders even when no
 * vendors are confirmed yet so the host sees their target reflected
 * back to them as soon as they save.
 */
function BudgetSummaryStrip({
  targetCentavos,
  committedPhp,
}: {
  targetCentavos: number | null;
  committedPhp: number;
}) {
  const targetPhp = targetCentavos !== null ? targetCentavos / 100 : null;
  const remainingPhp = targetPhp !== null ? targetPhp - committedPhp : null;

  return (
    <section
      aria-labelledby="budget-summary-heading"
      className="rounded-xl border border-ink/10 bg-cream p-5"
    >
      <header className="flex items-baseline gap-2">
        <TrendingUp aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
        <h2
          id="budget-summary-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Current commitments
        </h2>
      </header>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Target"
          value={targetPhp !== null ? formatPhp(targetPhp) : '—'}
          hint={targetPhp !== null ? 'Your stated budget' : 'No target set yet'}
        />
        <SummaryStat
          label="Committed"
          value={formatPhp(committedPhp)}
          hint={committedPhp > 0 ? 'Paid + signed vendors' : 'Nothing committed yet'}
        />
        <SummaryStat
          label={remainingPhp !== null && remainingPhp < 0 ? 'Over target' : 'Budget left'}
          value={remainingPhp !== null ? formatPhp(Math.abs(remainingPhp)) : '—'}
          tone={
            remainingPhp === null
              ? 'default'
              : remainingPhp < 0
                ? 'warn'
                : 'good'
          }
          hint={
            remainingPhp === null
              ? 'Set a target to see headroom'
              : remainingPhp < 0
                ? 'Time to review'
                : 'Room to grow'
          }
        />
      </ul>
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
        className={`font-display text-2xl ${
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

/**
 * What-this-unlocks helper card — explains why setting a budget is
 * worth the host's time. Polite brand voice per
 * [[feedback_setnayan_no_dev_text_post_launch]]: outcome-first copy,
 * no engineering jargon, no exclamation marks.
 */
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
function ChineseTraditionInfoCard() {
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
        cost, so it&rsquo;s worth anchoring your budget around it early. These are
        your own arrangements, not a Setnayan or vendor charge, so they stay
        outside your committed totals.
      </p>
    </section>
  );
}

function UnlocksHint() {
  return (
    <section
      aria-labelledby="budget-unlocks-heading"
      className="rounded-xl border border-terracotta/20 bg-terracotta/[0.04] p-4 sm:p-5"
    >
      <h2
        id="budget-unlocks-heading"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700"
      >
        What this unlocks
      </h2>
      <p className="mt-2 text-sm text-ink/75">
        We&rsquo;ll show your budget vs committed pacing on Home so you always know
        where you stand. Update it anytime as your plans evolve.
      </p>
    </section>
  );
}

function StatsStrip({
  totals,
}: {
  totals: {
    budget: number;
    paid: number;
    remaining: number;
    upcomingDueAmount: number;
    upcomingDueCount: number;
  };
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Total budget" value={formatPhp(totals.budget)} />
      <StatTile label="Paid so far" value={formatPhp(totals.paid)} />
      <StatTile
        label="Still to pay"
        value={formatPhp(totals.remaining)}
        tone={totals.remaining > 0 ? 'warn' : 'good'}
      />
      <StatTile
        label="Due in 30 days"
        value={
          totals.upcomingDueCount > 0
            ? `${formatPhp(totals.upcomingDueAmount)} · ${totals.upcomingDueCount}`
            : '—'
        }
        tone={totals.upcomingDueCount > 0 ? 'warn' : 'default'}
      />
    </ul>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'good';
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-success-700'
              : 'text-ink'
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function EmptyBudget({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
      <p className="text-sm text-ink/65">
        No vendors yet. Add a vendor first, then come back here to itemize costs.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/vendors`} className="button-primary">
          Open vendors
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
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
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

