import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchBudgetSnapshot, formatPhp } from '@/lib/budget';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { fetchPublishedMethodsForCouple } from '@/lib/vendor-payment-methods.server';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import { BudgetSetter } from './_components/budget-setter';
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
  const [eventRes, snapshot, paidOrdersRes] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name, estimated_budget_centavos')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchBudgetSnapshot(supabase, eventId),
    supabase
      .from('orders')
      .select('order_id, requested_total_php, confirmed_total_php, status')
      .eq('event_id', eventId)
      .in('status', ['paid', 'fulfilled']),
  ]);

  const event = eventRes.data as
    | { event_id: string; display_name: string; estimated_budget_centavos: number | null }
    | null;

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

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Budget</h1>
          <p className="max-w-prose text-base text-ink/65">
            Set your total wedding budget. As you contract vendors, their published
            pricing fills in below — for off-platform vendors, you enter line items
            yourself. Export upcoming due dates as a `.ics` file your calendar app
            can swallow.
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

      <UnlocksHint />

      {/* Existing per-vendor itemization + payment log — unchanged
       *  surface from before this PR. Heading added so the visual break
       *  from the setter form above is clear. */}
      <div className="space-y-4 border-t border-ink/10 pt-6">
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
          label={remainingPhp !== null && remainingPhp < 0 ? 'Over target' : 'Remaining'}
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
              ? 'text-emerald-700'
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
        label="Remaining"
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
              ? 'text-emerald-700'
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
        Per-vendor budget tracking unlocks once you contract a vendor. Keep
        shortlisting — your committed line items will land here as you lock
        them in.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/vendors`} className="button-primary">
          Open vendors
        </Link>
      </div>
    </div>
  );
}

