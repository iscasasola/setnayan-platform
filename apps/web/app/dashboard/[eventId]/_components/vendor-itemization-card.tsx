// ============================================================================
// VendorItemizationCard — shared per-vendor budget itemization
//
// Extracted from /dashboard/[eventId]/budget/page.tsx 2026-05-22 (owner
// directive: "the per-vendor budget itemization should also embed inside the
// Payments card on the dedicated vendor page when expanded — same data, same
// controls, just rendered inside the workspace page so the host doesn't have
// to bounce between Budget and Vendor pages to see the breakdown.")
//
// Why a server component:
//   - All data (lineItems · payments · vendorControlledItems · priceSource)
//     is already fetched server-side by callers via fetchBudgetSnapshot()
//     (budget page) or a focused per-vendor query (workspace page). The card
//     just renders the data + form `action=` bindings to server actions —
//     no client interactivity inside the card itself.
//   - Form actions are imported as server-action references (addLineItem,
//     deleteLineItem, logPayment, deletePayment from budget/actions.ts).
//     They already revalidate `/budget` and now ALSO revalidate the
//     workspace path so the embedded card stays in lock-step on both
//     surfaces (PR 2026-05-22 extends budget/actions.ts).
//   - Two render modes via the `variant` prop:
//       'card'   — Used by budget/page.tsx. Wraps content in an <article>
//                  with the vendor's name header + status pill (full card
//                  shell). Has its own border + bg-cream.
//       'embed'  — Used by workspace/page.tsx Payments section. Drops the
//                  outer chrome (no name header, no status pill) because
//                  the workspace page already has its own vendor identity
//                  block above. Renders just the Money summary strip +
//                  LineItemSection + PaymentSection.
//
// Component shape mirrors the original budget/page.tsx VendorBudgetCard +
// LineItemSection + PaymentSection 1:1 — no behavioral changes. The only
// new bit is the conditional outer chrome + the optional `eventVendorId`
// (matches the workspace param naming) accepted as an alias for `vendorId`.
//
// Entry points (orphan-prevention per feedback_setnayan_orphan_prevention):
//   - budget/page.tsx — renders <VendorItemizationCard variant="card" />
//     for every finalized vendor.
//   - vendors/[eventVendorId]/workspace/page.tsx — renders
//     <VendorItemizationCard variant="embed" /> inside the Payments section
//     when the per-vendor VendorBudgetSummary loads.
// ============================================================================

import Link from 'next/link';
import {
  Plus,
  Trash2,
  Calendar,
  Receipt,
  Sparkles,
  MessageCircle,
  PencilLine,
} from 'lucide-react';
import {
  formatPhp,
  type LineItemRow,
  type PaymentRow,
  type VendorBudgetSummary,
  type VendorControlledLineItem,
  type VendorPriceSource,
} from '@/lib/budget';
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL, VENDOR_STATUS_TONE } from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  addLineItem,
  deleteLineItem,
  deletePayment,
  logPayment,
} from '@/app/dashboard/[eventId]/budget/actions';

export type VendorItemizationCardProps = {
  summary: VendorBudgetSummary;
  eventId: string;
  /**
   * 'card'  — full chrome (header + status pill + Money strip + sections)
   *           used on /budget.
   * 'embed' — minimal (Money strip + sections only) used on the workspace
   *           page where the surrounding chrome carries the vendor identity.
   */
  variant?: 'card' | 'embed';
};

export function VendorItemizationCard({
  summary,
  eventId,
  variant = 'card',
}: VendorItemizationCardProps) {
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

  const body = (
    <>
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
    </>
  );

  // 'embed' variant — no outer <article>, no header, no status pill. The
  // workspace page wraps this in its own Payments <section>.
  if (variant === 'embed') {
    return (
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
        {body}
      </div>
    );
  }

  // 'card' variant — full shell used on /budget. Anchored id added 2026-05-22
  // so the workspace page's "Add milestone" CTA (`/budget#vendor-${vendor_id}`)
  // can deep-link to this card.
  return (
    <article
      id={`vendor-${vendor.vendor_id}`}
      className="overflow-hidden rounded-xl border border-ink/10 bg-cream scroll-mt-24"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-ink">
              {vendor.vendor_name}
            </h2>
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

      {body}
    </article>
  );
}

// ----------------------------------------------------------------------------
// Internal sub-components — pulled directly from the prior budget/page.tsx
// inline definitions. Behavior preserved 1:1; only the location changes.
// ----------------------------------------------------------------------------

function PriceSourceChip({ priceSource }: { priceSource: VendorPriceSource }) {
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

function LineItemSection({
  priceSource,
  vendorControlledItems,
  lineItems,
  eventId,
  vendorId,
  vendorMarketplaceId,
}: {
  priceSource: VendorPriceSource;
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
        // Vendor-controlled / pending — quiet "add an extra" path for
        // ad-hoc cash tips or off-catalog add-ons the vendor doesn't
        // itemize. Keeps manual entry alive without competing with the
        // vendor's own pricing surface.
        <details className="group border-t border-ink/10 pt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/55 hover:text-ink/80">
            <PencilLine aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Add an extra not on the vendor&rsquo;s catalog
          </summary>
          <form action={addLineItem} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                // Synthetic value — see logPayment in budget/actions.ts.
                // Stores the label in notes; writes line_item_id=NULL
                // because vendor-controlled items have no FK target.
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
