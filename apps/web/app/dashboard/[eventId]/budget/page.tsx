import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Plus,
  Trash2,
  Calendar,
  Receipt,
  Download,
  TrendingUp,
  Sparkles,
  MessageCircle,
  PencilLine,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchBudgetSnapshot,
  formatPhp,
  type LineItemRow,
  type PaymentRow,
  type VendorBudgetSummary,
  type VendorControlledLineItem,
} from '@/lib/budget';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL, VENDOR_STATUS_TONE } from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';
import { addLineItem, deleteLineItem, deletePayment, logPayment } from './actions';
import { BudgetSetter } from './_components/budget-setter';

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
                <VendorBudgetCard summary={s} eventId={eventId} />
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

function VendorBudgetCard({
  summary,
  eventId,
}: {
  summary: VendorBudgetSummary;
  eventId: string;
}) {
  const {
    vendor,
    lineItems,
    payments,
    itemizedTotal,
    paidTotal,
    remaining,
    priceSource,
    vendorControlledItems,
  } = summary;
  return (
    <article className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-ink">
              {vendor.vendor_name}
            </h2>
            {/* Surface a small chip explaining where the pricing came
             * from so the host knows what kind of card they're looking at.
             * Polite brand voice per [[feedback_setnayan_no_dev_text_post_launch]]. */}
            <PriceSourceChip priceSource={priceSource} />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {VENDOR_CATEGORY_LABEL[vendor.category]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              VENDOR_STATUS_TONE[vendor.status]
            }`}
          >
            {VENDOR_STATUS_LABEL[vendor.status]}
          </span>
        </div>
      </header>

      <div className="grid gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-3">
        <Money label="Budget" value={formatPhp(itemizedTotal)} />
        <Money label="Paid" value={formatPhp(paidTotal)} tone="muted" />
        <Money
          label="Remaining"
          value={formatPhp(remaining)}
          tone={remaining > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="grid gap-0 border-t border-ink/10 lg:grid-cols-2 lg:divide-x lg:divide-ink/10">
        <LineItemSection
          priceSource={priceSource}
          vendorControlledItems={vendorControlledItems}
          lineItems={lineItems}
          eventId={eventId}
          vendorId={vendor.vendor_id}
          vendorMarketplaceId={vendor.marketplace_vendor_id}
        />
        <PaymentSection
          payments={payments}
          lineItems={lineItems}
          vendorControlledItems={vendorControlledItems}
          eventId={eventId}
          vendorId={vendor.vendor_id}
        />
      </div>
    </article>
  );
}

/**
 * Small badge above the vendor's name explaining where the pricing data
 * on the card came from. Three states:
 *   - 'package' / 'service': vendor-controlled, terracotta accent — the
 *     host is reading what the vendor has published.
 *   - 'pending': marketplace vendor, no pricing yet — amber.
 *   - 'manual': legacy host-entered, no chip rendered (the default,
 *     and the existing UX for off-platform vendors).
 */
function PriceSourceChip({
  priceSource,
}: {
  priceSource: VendorBudgetSummary['priceSource'];
}) {
  if (priceSource === 'manual') return null;
  if (priceSource === 'package' || priceSource === 'service') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700"
        title="The vendor publishes this pricing in their catalog. Message them to adjust."
      >
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        From vendor
      </span>
    );
  }
  // 'pending' — vendor hasn't sent pricing yet.
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-800"
      title="The vendor hasn't published pricing yet. Ask them in chat."
    >
      Awaiting pricing
    </span>
  );
}

function Money({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warn' | 'good';
}) {
  return (
    <div className="rounded-md bg-ink/[0.03] p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-semibold ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-emerald-700'
              : tone === 'muted'
                ? 'text-ink/65'
                : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Line-item rendering — branches on priceSource per the 2026-05-22
 * owner directive "budget should be entered by vendor. but if there is
 * no vendor account, we can place it manually."
 *
 *  - 'package' / 'service': render the vendor-controlled items
 *    READ-ONLY (no Delete, terracotta accent) + render any legacy host-
 *    entered items below them. No "Add line item" form — host messages
 *    the vendor in chat to change pricing.
 *  - 'pending': render a polite empty state with a "Ask {vendor} to send
 *    their pricing" CTA linking to the chat thread. No form. Legacy host-
 *    entered items still render if they exist.
 *  - 'manual': legacy behavior unchanged. Host adds Deposit / Balance /
 *    Tip rows via the existing form.
 */
function LineItemSection({
  priceSource,
  vendorControlledItems,
  lineItems,
  eventId,
  vendorId,
  vendorMarketplaceId,
}: {
  priceSource: VendorBudgetSummary['priceSource'];
  vendorControlledItems: VendorControlledLineItem[];
  lineItems: LineItemRow[];
  eventId: string;
  vendorId: string;
  vendorMarketplaceId: string | null;
}) {
  const hasVendorControlled = vendorControlledItems.length > 0;
  const hasManual = lineItems.length > 0;
  return (
    <section className="space-y-3 p-5">
      <header className="flex items-center gap-2">
        <Receipt aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Line items
        </h3>
      </header>

      {/* Vendor-controlled (READ-ONLY) — terracotta-tinted block so the
       * host can tell these came from the vendor's catalog and not their
       * own entry. No Delete button — to change pricing, the host
       * messages the vendor. */}
      {hasVendorControlled ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700/80">
            From the vendor&rsquo;s catalog
          </p>
          <ul className="space-y-1.5">
            {vendorControlledItems.map((item) => (
              <li
                key={item.source_id}
                className="flex items-center justify-between gap-2 rounded-md border border-terracotta/15 bg-terracotta/[0.04] px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-ink">{item.label}</p>
                  <p className="text-xs text-ink/55">
                    {item.source_kind === 'package' ? 'Package item' : 'Starting price'}
                    {' · '}
                    {item.vendor_business_name}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-ink">
                  {formatPhp(item.amount_php)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/55">
            To adjust pricing, message the vendor in chat. They&rsquo;ll update their
            catalog and these line items will refresh.
          </p>
        </div>
      ) : null}

      {/* Pending state — marketplace vendor, no pricing published yet.
       * Polite CTA to nudge the vendor via chat. */}
      {priceSource === 'pending' && !hasVendorControlled ? (
        <div className="space-y-2 rounded-md border border-dashed border-amber-300/60 bg-amber-50/60 px-3 py-3 text-sm">
          <p className="text-ink/75">
            This vendor hasn&rsquo;t shared pricing yet. Their catalog will appear
            here once they publish it.
          </p>
          <Link
            href={`/dashboard/${eventId}/messages?vendor=${vendorMarketplaceId ?? ''}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-cream px-2.5 py-1 text-xs font-medium text-amber-900 hover:border-amber-500 hover:text-amber-950"
          >
            <MessageCircle aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Ask them for pricing
          </Link>
        </div>
      ) : null}

      {/* Manual host-entered items — render always when they exist. For
       * vendor-controlled cards, label this block "Your own additions"
       * so the host knows these aren't from the vendor. */}
      {hasManual ? (
        <div className="space-y-2">
          {hasVendorControlled ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Your own additions
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {lineItems.map((li) => (
              <li
                key={li.line_item_id}
                className="flex items-center justify-between gap-2 rounded-md bg-ink/[0.03] px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-ink">{li.label}</p>
                  {li.due_date ? (
                    <p className="inline-flex items-center gap-1 text-xs text-ink/60">
                      <Calendar className="h-3 w-3" strokeWidth={1.75} />
                      Due {li.due_date}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">
                    {formatPhp(li.amount_php)}
                  </span>
                  <form action={deleteLineItem}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="line_item_id" value={li.line_item_id} />
                    <SubmitButton
                      aria-label="Delete line item"
                      pendingLabel=""
                      className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-rose-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Manual entry form — only rendered for the 'manual' price source.
       * Vendor-controlled cards intentionally suppress this to keep the
       * host from re-typing pricing the vendor already published. */}
      {priceSource === 'manual' ? (
        <>
          {!hasManual ? (
            <p className="text-xs text-ink/55">
              No line items yet — add a Deposit, Balance, or Tip below.
            </p>
          ) : null}
          <form
            action={addLineItem}
            className="grid grid-cols-2 gap-2 border-t border-ink/10 pt-3 sm:grid-cols-4"
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={vendorId} />
            <input
              name="label"
              required
              maxLength={64}
              placeholder="Label (e.g. Deposit)"
              className="input-field col-span-2 h-9 py-0 text-xs"
            />
            <input
              name="amount_php"
              type="number"
              min={0}
              step="0.01"
              required
              placeholder="Amount"
              className="input-field h-9 py-0 text-xs"
            />
            <input
              name="due_date"
              type="date"
              placeholder="Due date"
              className="input-field h-9 py-0 text-xs"
            />
            <SubmitButton
              className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-600 disabled:opacity-70 sm:col-span-4"
              pendingLabel="Adding…"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add line item
            </SubmitButton>
          </form>
        </>
      ) : (
        /* Vendor-controlled / pending — offer a quiet "add an extra" option
         * for cases where the host wants to track a side-cost the vendor
         * hasn't itemized (cash tip, ad-hoc add-on). Keeps the manual
         * entry path alive without competing with the vendor's catalog. */
        <details className="group border-t border-ink/10 pt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/55 hover:text-ink/80">
            <PencilLine aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Add an extra not on the vendor&rsquo;s catalog
          </summary>
          <form
            action={addLineItem}
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={vendorId} />
            <input
              name="label"
              required
              maxLength={64}
              placeholder="Label (e.g. Tip)"
              className="input-field col-span-2 h-9 py-0 text-xs"
            />
            <input
              name="amount_php"
              type="number"
              min={0}
              step="0.01"
              required
              placeholder="Amount"
              className="input-field h-9 py-0 text-xs"
            />
            <input
              name="due_date"
              type="date"
              placeholder="Due date"
              className="input-field h-9 py-0 text-xs"
            />
            <SubmitButton
              className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-600 disabled:opacity-70 sm:col-span-4"
              pendingLabel="Adding…"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add extra
            </SubmitButton>
          </form>
        </details>
      )}
    </section>
  );
}

/**
 * Payments — the host's record of money that moved. ALWAYS editable
 * regardless of priceSource: payments are host-side activity (what they
 * paid + when + via what method), distinct from line items (what the
 * vendor is charging). Owner directive 2026-05-22 explicitly framed
 * line-items as the vendor-owned side; payments stay host-owned.
 *
 * The line-item select also includes vendor-controlled items as a
 * "Reference only" optgroup. Payments against vendor-controlled items
 * land with line_item_id=NULL (vendor-controlled items don't have an
 * event_vendor_line_items row to FK to) plus a notes string capturing
 * the vendor-controlled item label. This keeps the payment record
 * complete without violating the existing FK constraint.
 */
function PaymentSection({
  payments,
  lineItems,
  vendorControlledItems,
  eventId,
  vendorId,
}: {
  payments: PaymentRow[];
  lineItems: LineItemRow[];
  vendorControlledItems: VendorControlledLineItem[];
  eventId: string;
  vendorId: string;
}) {
  const hasVendorControlled = vendorControlledItems.length > 0;
  return (
    <section className="space-y-3 p-5">
      <header className="flex items-center gap-2">
        <Receipt aria-hidden className="h-3.5 w-3.5 text-emerald-700" strokeWidth={1.75} />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Payments
        </h3>
      </header>
      {payments.length === 0 ? (
        <p className="text-xs text-ink/55">
          No payments logged yet — record one below as soon as money moves.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {payments.map((p) => {
            const line = lineItems.find((li) => li.line_item_id === p.line_item_id);
            // For payments without a line_item_id, fall back to the notes
            // field which the form below populates with the vendor-
            // controlled item label when the host picks one.
            const fallbackLabel =
              !line && p.notes && p.notes.length > 0 ? p.notes : 'Generic payment';
            return (
              <li
                key={p.payment_id}
                className="flex items-start justify-between gap-2 rounded-md bg-emerald-50/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-emerald-900">
                    {line ? line.label : fallbackLabel}
                  </p>
                  <p className="text-xs text-emerald-900/75">
                    {p.paid_at}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.reference ? ` · ref ${p.reference}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-emerald-900">
                    {formatPhp(p.amount_php)}
                  </span>
                  <form action={deletePayment}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="payment_id" value={p.payment_id} />
                    <SubmitButton
                      aria-label="Delete payment"
                      pendingLabel=""
                      className="rounded-md p-1 text-emerald-900/50 hover:bg-emerald-900/5 hover:text-rose-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={logPayment}
        className="grid grid-cols-2 gap-2 border-t border-ink/10 pt-3 sm:grid-cols-4"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="vendor_id" value={vendorId} />
        <select
          name="line_item_id"
          defaultValue=""
          className="input-field col-span-2 h-9 py-0 text-xs"
        >
          <option value="">Against any line item</option>
          {hasVendorControlled ? (
            <optgroup label="From the vendor's catalog">
              {vendorControlledItems.map((item) => (
                /* Synthetic value the logPayment action recognizes — see
                 * actions.ts. Stores the label in notes and writes
                 * line_item_id = NULL because vendor-controlled items
                 * don't have an event_vendor_line_items row to FK to. */
                <option key={item.source_id} value={`vc:${item.label}`}>
                  {item.label} · {formatPhp(item.amount_php)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {lineItems.length > 0 ? (
            <optgroup label="Your own additions">
              {lineItems.map((li) => (
                <option key={li.line_item_id} value={li.line_item_id}>
                  {li.label} · {formatPhp(li.amount_php)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <input
          name="amount_php"
          type="number"
          min={0}
          step="0.01"
          required
          placeholder="Amount paid"
          className="input-field h-9 py-0 text-xs"
        />
        <input
          name="paid_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="input-field h-9 py-0 text-xs"
        />
        <input
          name="method"
          placeholder="Method (cash, BDO, GCash)"
          className="input-field col-span-2 h-9 py-0 text-xs"
        />
        <input
          name="reference"
          placeholder="Reference #"
          className="input-field h-9 py-0 text-xs"
        />
        <SubmitButton
          className="col-span-1 inline-flex items-center justify-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-emerald-800 disabled:opacity-70"
          pendingLabel="Logging…"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Log
        </SubmitButton>
      </form>
    </section>
  );
}
