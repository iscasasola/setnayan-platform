// ============================================================================
// TourVendorItemization — READ-ONLY presentational fork of
// app/dashboard/[eventId]/_components/vendor-itemization-card.tsx for the
// public, no-login Maria & Jose tour.
//
// Why a fork (not a reuse): the dashboard VendorItemizationCard imports server
// actions (addLineItem / deleteLineItem / logPayment / deletePayment from
// budget/actions) plus FileUpload + VendorDirectPay, which would (a) trip the
// app/tour/** no-restricted-imports guard and (b) surface mutation UI on a
// read-only public page. This fork copies ONLY the visual markup that displays
// already-fetched, display-safe data:
//   • the Budget / Paid / Remaining money strip,
//   • vendor-controlled (catalog) line items,
//   • the couple's own line items,
//   • the logged-payments list.
// Everything that writes or reveals PII is dropped: no add/delete buttons, no
// log-payment form, no receipt upload, no direct-pay methods, no reference /
// contact reads. Payment rows show only a display-safe label + date + method.
// ============================================================================

import { Receipt, Sparkles, Calendar } from 'lucide-react';
import {
  formatPhp,
  type LineItemRow,
  type PaymentRow,
  type VendorBudgetSummary,
  type VendorControlledLineItem,
  type VendorPriceSource,
} from '@/lib/budget';
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL, VENDOR_STATUS_TONE } from '@/lib/vendors';

export function TourVendorItemization({ summary }: { summary: VendorBudgetSummary }) {
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
    <article className="overflow-hidden rounded-2xl border border-[#1E2229]/10 bg-[#FBF8F1]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E2229]/10 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-serif text-lg tracking-tight text-[#1E2229]">{vendor.vendor_name}</h3>
            <PriceSourceChip priceSource={priceSource} />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#5F5E5A]">
            {VENDOR_CATEGORY_LABEL[vendor.category]}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${VENDOR_STATUS_TONE[vendor.status]}`}
        >
          {VENDOR_STATUS_LABEL[vendor.status]}
        </span>
      </header>

      {/* Money strip. */}
      <dl className="grid gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-3">
        <Money label="Budget" value={formatPhp(itemizedTotal)} />
        <Money label="Paid" value={formatPhp(paidTotal)} tone="muted" />
        <Money label="Remaining" value={formatPhp(remaining)} tone={remaining > 0 ? 'warn' : 'good'} />
      </dl>

      <div className="grid gap-0 border-t border-[#1E2229]/10 lg:grid-cols-2 lg:divide-x lg:divide-[#1E2229]/10">
        <LineItemSection
          priceSource={priceSource}
          vendorControlledItems={vendorControlledItems}
          lineItems={lineItems}
        />
        <PaymentSection payments={payments} lineItems={lineItems} />
      </div>
    </article>
  );
}

function PriceSourceChip({ priceSource }: { priceSource: VendorPriceSource }) {
  if (priceSource === 'manual') return null;
  if (priceSource === 'package' || priceSource === 'service') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#8C6932]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8C6932]"
        title="The vendor publishes this pricing in their catalog."
      >
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        From vendor
      </span>
    );
  }
  // 'pending'
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8C6932]">
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
  const color =
    tone === 'warn'
      ? 'text-[#5C2542]'
      : tone === 'good'
        ? 'text-emerald-700'
        : tone === 'muted'
          ? 'text-[#5F5E5A]'
          : 'text-[#1E2229]';
  return (
    <div className="rounded-md bg-[#1E2229]/[0.03] p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F5E5A]">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold ${color}`}>{value}</dd>
    </div>
  );
}

function LineItemSection({
  priceSource,
  vendorControlledItems,
  lineItems,
}: {
  priceSource: VendorPriceSource;
  vendorControlledItems: VendorControlledLineItem[];
  lineItems: LineItemRow[];
}) {
  const hasVendorControlled = vendorControlledItems.length > 0;
  const hasManual = lineItems.length > 0;
  return (
    <section className="space-y-3 p-5">
      <header className="flex items-center gap-2">
        <Receipt aria-hidden className="h-3.5 w-3.5 text-[#8C6932]" strokeWidth={1.75} />
        <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5F5E5A]">Line items</h4>
      </header>

      {hasVendorControlled ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8C6932]/80">
            From the vendor&rsquo;s catalog
          </p>
          <ul className="space-y-1.5">
            {vendorControlledItems.map((item) => (
              <li
                key={item.source_id}
                className="flex items-center justify-between gap-2 rounded-md border border-[#C5A059]/25 bg-[#C5A059]/[0.07] px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-[#1E2229]">{item.label}</p>
                  <p className="text-xs text-[#5F5E5A]">
                    {item.source_kind === 'package' ? 'Package item' : 'Starting price'}
                    {' · '}
                    {item.vendor_business_name}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-[#1E2229]">{formatPhp(item.amount_php)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {priceSource === 'pending' && !hasVendorControlled ? (
        <p className="rounded-md border border-dashed border-[#C5A059]/40 bg-[#FBF6EA] px-3 py-3 text-sm text-[#5F5E5A]">
          This vendor hasn&rsquo;t shared pricing yet. Their catalog will appear here once they publish it.
        </p>
      ) : null}

      {hasManual ? (
        <div className="space-y-2">
          {hasVendorControlled ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#5F5E5A]">The couple&rsquo;s own additions</p>
          ) : null}
          <ul className="space-y-1.5">
            {lineItems.map((li) => (
              <li
                key={li.line_item_id}
                className="flex items-center justify-between gap-2 rounded-md bg-[#1E2229]/[0.03] px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-[#1E2229]">{li.label}</p>
                  {li.due_date ? (
                    <p className="inline-flex items-center gap-1 text-xs text-[#5F5E5A]">
                      <Calendar className="h-3 w-3" strokeWidth={1.75} />
                      Due {li.due_date}
                    </p>
                  ) : null}
                </div>
                <span className="font-mono text-sm font-semibold text-[#1E2229]">{formatPhp(li.amount_php)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hasVendorControlled && !hasManual && priceSource !== 'pending' ? (
        <p className="text-xs text-[#5F5E5A]">No line items broken out — the agreed total is shown above.</p>
      ) : null}
    </section>
  );
}

function PaymentSection({ payments, lineItems }: { payments: PaymentRow[]; lineItems: LineItemRow[] }) {
  return (
    <section className="space-y-3 p-5">
      <header className="flex items-center gap-2">
        <Receipt aria-hidden className="h-3.5 w-3.5 text-emerald-700" strokeWidth={1.75} />
        <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5F5E5A]">Payments</h4>
      </header>
      {payments.length === 0 ? (
        <p className="text-xs text-[#5F5E5A]">No payments logged yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {payments.map((p) => {
            const line = lineItems.find((li) => li.line_item_id === p.line_item_id);
            return (
              <li
                key={p.payment_id}
                className="flex items-start justify-between gap-2 rounded-md bg-emerald-50/70 px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-emerald-900">{line ? line.label : 'Payment'}</p>
                  <p className="text-xs text-emerald-900/75">
                    {p.paid_at}
                    {p.method ? ` · ${p.method}` : ''}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-900">{formatPhp(p.amount_php)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
