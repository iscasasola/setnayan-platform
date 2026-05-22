import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  Receipt,
  ScrollText,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchEventContracts, statusLabel as contractStatusLabel } from '@/lib/contracts';
import {
  DOCUMENT_META,
  STATUS_LABEL as PAPERWORK_STATUS_LABEL,
  STATUS_TONE as PAPERWORK_STATUS_TONE,
  fetchEventPaperwork,
  formatLongDate,
  type PaperworkStatus,
} from '@/lib/paperwork';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  fetchOrdersForEvent,
  formatPhp,
  type OrderStatus,
} from '@/lib/orders';

export const metadata = { title: 'Your wedding documents' };

/**
 * /dashboard/[eventId]/documents · consolidated paper-artifact view.
 *
 * Owner directive 2026-05-22 — *"Documents would be both contracts and
 * papers the couple needs, monogram, and other things that are needed
 * for the plan?"*
 *
 * Aggregates five document sources in one navigable list:
 *   1. Government paperwork (event_paperwork)
 *   2. Vendor contracts (vendor_contracts)
 *   3. Setnayan creations (orders filtered to creation SKUs)
 *   4. Order receipts (orders — broader)
 *   5. Transaction receipts (receipts — joined per order)
 *
 * Each section reads in parallel via Promise.all. Empty sections
 * render polite brand-voice empty states. Every row deep-links to the
 * canonical detail page so this page is a navigation hub, not a
 * duplicate edit surface.
 *
 * Entry points:
 *   - Documents tile in YOUR PLAN section on event Home
 *   - "See all documents →" link on /paperwork and /contracts pages
 *
 * Per [[feedback_setnayan_orphan_prevention]] — this page has explicit
 * entry points; per [[feedback_setnayan_no_dev_text_post_launch]] —
 * empty states + status pills use polite brand voice; per
 * [[reference_setnayan_php_centavos]] — PHP amounts read from orders
 * lib via formatPhp.
 */

type Props = { params: Promise<{ eventId: string }> };

export default async function EventDocumentsPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/${eventId}/documents`)}`);

  const supabase = await createClient();

  // Pull every source in parallel — one request fan-out, five queries.
  // RLS scopes every read to the host's events; orders + receipts
  // additionally filter by event_id on the SELECT side.
  const [eventRes, paperworkRows, contracts, allOrders] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name, event_date, ceremony_type')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchEventPaperwork(supabase, eventId).catch(() => []),
    fetchEventContracts(supabase, eventId).catch(() => []),
    fetchOrdersForEvent(supabase, eventId).catch(() => []),
  ]);

  if (!eventRes.data) {
    redirect('/dashboard');
  }
  const event = eventRes.data as {
    event_id: string;
    display_name: string;
    event_date: string | null;
    ceremony_type: string | null;
  };

  // Transaction receipts — joined per-order. Only fetch if there are
  // orders on this event (otherwise the IN clause would be empty).
  const orderIdsForReceipts = allOrders
    .filter((o) => o.status === 'paid' || o.status === 'fulfilled')
    .map((o) => o.order_id);
  const receiptsRes =
    orderIdsForReceipts.length > 0
      ? await supabase
          .from('receipts')
          .select(
            'receipt_id, or_serial, order_id, issued_at, gross_total_php, vat_amount_php, pre_vat_php',
          )
          .in('order_id', orderIdsForReceipts)
          .order('issued_at', { ascending: false })
      : { data: [], error: null };
  const receipts =
    (receiptsRes.data ?? []) as Array<{
      receipt_id: string;
      or_serial: number;
      order_id: string;
      issued_at: string;
      gross_total_php: number | string;
      vat_amount_php: number | string;
      pre_vat_php: number | string;
    }>;
  const receiptsByOrderId = new Map(
    receipts.map((r) => [r.order_id, r]),
  );

  // Split orders into "Setnayan creations" (SKU codes that produce
  // delivered artifacts) vs "Order receipts" (everything else paid).
  // The two sections are presentationally distinct even though they
  // share the same underlying table.
  const CREATION_SKU_KEYS = new Set([
    'save_the_date_video',
    'monogram_hero_upgrade',
  ]);
  const creationOrders = allOrders.filter(
    (o) => o.service_key !== null && CREATION_SKU_KEYS.has(o.service_key),
  );
  const otherPaidOrders = allOrders.filter(
    (o) =>
      (o.status === 'paid' || o.status === 'fulfilled') &&
      (o.service_key === null || !CREATION_SKU_KEYS.has(o.service_key)),
  );

  // Pull vendor business names for contract attribution. Single batch
  // lookup, same pattern as /contracts page.
  const vendorProfileIds = Array.from(
    new Set(contracts.map((c) => c.vendor_profile_id)),
  );
  const vendorMap = new Map<string, { business_name: string }>();
  if (vendorProfileIds.length > 0) {
    const { data: vendorRows } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorProfileIds);
    for (const v of vendorRows ?? []) {
      vendorMap.set(v.vendor_profile_id as string, {
        business_name: (v.business_name as string) || 'Vendor',
      });
    }
  }

  const totalDocs =
    paperworkRows.length +
    contracts.length +
    creationOrders.length +
    otherPaidOrders.length +
    receipts.length;

  return (
    <section className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your wedding documents
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Everything paper, all in one place — government paperwork, vendor
          contracts, Setnayan creations, and receipts for every order. Tap
          a row to open the canonical document or edit surface.
        </p>
        {totalDocs > 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {totalDocs} {totalDocs === 1 ? 'document' : 'documents'} on file
          </p>
        ) : null}
      </header>

      {totalDocs === 0 ? (
        <EmptyState eventId={eventId} />
      ) : (
        <div className="space-y-10">
          <PaperworkSection
            eventId={eventId}
            rows={paperworkRows}
            eventDate={event.event_date}
          />
          <ContractsSection
            eventId={eventId}
            rows={contracts}
            vendorMap={vendorMap}
          />
          <CreationsSection eventId={eventId} rows={creationOrders} />
          <OrdersSection eventId={eventId} rows={otherPaidOrders} />
          <ReceiptsSection
            eventId={eventId}
            receipts={receipts}
            receiptsByOrderId={receiptsByOrderId}
            ordersById={new Map(allOrders.map((o) => [o.order_id, o]))}
          />
        </div>
      )}
    </section>
  );
}

// ----- Empty state --------------------------------------------------

function EmptyState({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-10 text-center">
      <ScrollText
        aria-hidden
        className="mx-auto h-8 w-8 text-ink/40"
        strokeWidth={1.5}
      />
      <p className="mt-3 text-sm text-ink/65">
        No documents yet. As you plan, your government paperwork, vendor
        contracts, and Setnayan creations will land here automatically.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href={`/dashboard/${eventId}/paperwork`}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
        >
          <ScrollText className="h-3.5 w-3.5" strokeWidth={1.75} />
          Start your paperwork
        </Link>
        <Link
          href={`/dashboard/${eventId}/contracts`}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
        >
          <FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} />
          See contract uploads
        </Link>
      </div>
    </div>
  );
}

// ----- Section: Government paperwork --------------------------------

function PaperworkSection({
  eventId,
  rows,
  eventDate,
}: {
  eventId: string;
  rows: Awaited<ReturnType<typeof fetchEventPaperwork>>;
  eventDate: string | null;
}) {
  return (
    <section aria-labelledby="paperwork-section-heading" className="space-y-3">
      <SectionHeader
        id="paperwork-section-heading"
        Icon={ScrollText}
        label="Government paperwork"
        count={rows.length}
        href={`/dashboard/${eventId}/paperwork`}
        cta="Manage"
      />
      {rows.length === 0 ? (
        <SectionEmpty
          message="No paperwork rows yet. The paperwork page seeds your ceremony's required documents on first open."
          ctaLabel="Open paperwork"
          href={`/dashboard/${eventId}/paperwork`}
        />
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {rows.map((row) => {
            const meta = DOCUMENT_META[row.document_type];
            const label = meta?.label ?? row.document_type;
            const timestampLabel = paperworkTimestampLabel(row.status, {
              receivedAt: row.received_at,
              requestedAt: row.requested_at,
              expectedCompletionDate: row.expected_completion_date,
              expiresAt: row.expires_at,
            });
            return (
              <li key={row.id}>
                <Link
                  href={`/dashboard/${eventId}/paperwork#${row.document_type}`}
                  className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-terracotta/[0.03] sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink sm:text-base">
                        {label}
                      </span>
                      <StatusPill
                        label={PAPERWORK_STATUS_LABEL[row.status]}
                        toneClass={PAPERWORK_STATUS_TONE[row.status]}
                      />
                    </div>
                    {timestampLabel ? (
                      <p className="text-xs text-ink/55">{timestampLabel}</p>
                    ) : null}
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 h-4 w-4 flex-shrink-0 text-ink/35"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {/* Suppress unused-var warning in case eventDate ever becomes
       *  reference material for a deadline tone column. Keeps the prop
       *  threaded for forward compat without a wholesale signature
       *  change later. */}
      <span className="sr-only">{eventDate ?? ''}</span>
    </section>
  );
}

function paperworkTimestampLabel(
  status: PaperworkStatus,
  ts: {
    receivedAt: string | null;
    requestedAt: string | null;
    expectedCompletionDate: string | null;
    expiresAt: string | null;
  },
): string | null {
  if (status === 'received' && ts.receivedAt) {
    return `Received ${formatLongDate(ts.receivedAt.slice(0, 10))}`;
  }
  if (status === 'requested' && ts.requestedAt) {
    if (ts.expectedCompletionDate) {
      return `Requested ${formatLongDate(ts.requestedAt.slice(0, 10))} · expected ${formatLongDate(ts.expectedCompletionDate)}`;
    }
    return `Requested ${formatLongDate(ts.requestedAt.slice(0, 10))}`;
  }
  if (status === 'in_processing' && ts.requestedAt) {
    if (ts.expectedCompletionDate) {
      return `In processing · expected ${formatLongDate(ts.expectedCompletionDate)}`;
    }
    return `Requested ${formatLongDate(ts.requestedAt.slice(0, 10))}`;
  }
  if (status === 'expired' && ts.expiresAt) {
    return `Expired ${formatLongDate(ts.expiresAt.slice(0, 10))}`;
  }
  return null;
}

// ----- Section: Vendor contracts -----------------------------------

function ContractsSection({
  eventId,
  rows,
  vendorMap,
}: {
  eventId: string;
  rows: Awaited<ReturnType<typeof fetchEventContracts>>;
  vendorMap: Map<string, { business_name: string }>;
}) {
  return (
    <section aria-labelledby="contracts-section-heading" className="space-y-3">
      <SectionHeader
        id="contracts-section-heading"
        Icon={FileSignature}
        label="Vendor contracts"
        count={rows.length}
        href={`/dashboard/${eventId}/contracts`}
        cta="See all"
      />
      {rows.length === 0 ? (
        <SectionEmpty
          message="No contracts yet. Vendors will upload PDFs here once you agree on terms in chat."
          ctaLabel="See chat threads"
          href={`/dashboard/${eventId}/messages`}
        />
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {rows.map((c) => {
            const vendor = vendorMap.get(c.vendor_profile_id);
            return (
              <li key={c.contract_id}>
                <Link
                  href={`/dashboard/${eventId}/contracts/${c.contract_id}`}
                  className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-terracotta/[0.03] sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink sm:text-base">
                        {c.title}
                      </span>
                      <StatusPill
                        label={contractStatusLabel(c.status)}
                        toneClass={
                          c.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }
                      />
                    </div>
                    <p className="text-xs text-ink/55">
                      From {vendor?.business_name ?? 'Vendor'} ·{' '}
                      {formatRelativeDate(c.created_at)}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 h-4 w-4 flex-shrink-0 text-ink/35"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ----- Section: Setnayan creations ----------------------------------

const CREATION_SKU_LABEL: Record<string, string> = {
  save_the_date_video: 'Save-the-Date Video',
  monogram_hero_upgrade: 'Monogram Hero',
};

function CreationsSection({
  eventId,
  rows,
}: {
  eventId: string;
  rows: Awaited<ReturnType<typeof fetchOrdersForEvent>>;
}) {
  return (
    <section aria-labelledby="creations-section-heading" className="space-y-3">
      <SectionHeader
        id="creations-section-heading"
        Icon={Sparkles}
        label="Setnayan creations"
        count={rows.length}
      />
      {rows.length === 0 ? (
        <SectionEmpty
          message="No Setnayan creations yet. Draft a Save-the-Date video or design a monogram from the YOUR PLAN section on Home."
          ctaLabel="Browse add-ons"
          href={`/dashboard/${eventId}/add-ons`}
        />
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {rows.map((order) => {
            const label =
              (order.service_key && CREATION_SKU_LABEL[order.service_key]) ??
              order.description ??
              order.service_key ??
              'Creation order';
            return (
              <li key={order.order_id}>
                <Link
                  href={`/dashboard/${eventId}/orders`}
                  className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-terracotta/[0.03] sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink sm:text-base">
                        {label}
                      </span>
                      <StatusPill
                        label={ORDER_STATUS_LABEL[order.status]}
                        toneClass={ORDER_STATUS_TONE[order.status]}
                      />
                    </div>
                    <p className="text-xs text-ink/55">
                      {formatPhp(
                        order.confirmed_total_php ?? order.requested_total_php,
                      )}{' '}
                      · {formatRelativeDate(order.created_at)} · Ref{' '}
                      {order.reference_code}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 h-4 w-4 flex-shrink-0 text-ink/35"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ----- Section: Order receipts (paid + fulfilled) -------------------

function OrdersSection({
  eventId,
  rows,
}: {
  eventId: string;
  rows: Awaited<ReturnType<typeof fetchOrdersForEvent>>;
}) {
  return (
    <section aria-labelledby="orders-section-heading" className="space-y-3">
      <SectionHeader
        id="orders-section-heading"
        Icon={Receipt}
        label="Order receipts"
        count={rows.length}
        href={`/dashboard/${eventId}/orders`}
        cta="See all"
      />
      {rows.length === 0 ? (
        <SectionEmpty
          message="No paid orders yet. Setnayan Pay receipts appear here once a payment is matched by the operations team."
          ctaLabel="Open orders"
          href={`/dashboard/${eventId}/orders`}
        />
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {rows.map((order) => (
            <li key={order.order_id}>
              <Link
                href={`/dashboard/${eventId}/orders`}
                className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-terracotta/[0.03] sm:p-5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink sm:text-base">
                      {order.description || 'Setnayan order'}
                    </span>
                    <StatusPill
                      label={ORDER_STATUS_LABEL[order.status]}
                      toneClass={ORDER_STATUS_TONE[order.status]}
                    />
                  </div>
                  <p className="text-xs text-ink/55">
                    {formatPhp(
                      order.confirmed_total_php ?? order.requested_total_php,
                    )}{' '}
                    · {formatRelativeDate(order.created_at)} · Ref{' '}
                    {order.reference_code}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden
                  className="mt-1 h-4 w-4 flex-shrink-0 text-ink/35"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ----- Section: Transaction receipts --------------------------------

function ReceiptsSection({
  eventId,
  receipts,
  receiptsByOrderId,
  ordersById,
}: {
  eventId: string;
  receipts: Array<{
    receipt_id: string;
    or_serial: number;
    order_id: string;
    issued_at: string;
    gross_total_php: number | string;
    vat_amount_php: number | string;
    pre_vat_php: number | string;
  }>;
  receiptsByOrderId: Map<string, unknown>;
  ordersById: Map<string, { description: string; reference_code: string }>;
}) {
  // suppress unused-var warning for receiptsByOrderId — kept for future
  // detail-row variations that look up by order_id directly.
  void receiptsByOrderId;
  return (
    <section aria-labelledby="receipts-section-heading" className="space-y-3">
      <SectionHeader
        id="receipts-section-heading"
        Icon={Receipt}
        label="Transaction receipts"
        count={receipts.length}
      />
      {receipts.length === 0 ? (
        <SectionEmpty
          message="No transaction receipts yet. These auto-issue when a Setnayan payment is matched. BIR Official Receipts are issued separately by the operations team."
          ctaLabel="Open orders"
          href={`/dashboard/${eventId}/orders`}
        />
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {receipts.map((r) => {
            const order = ordersById.get(r.order_id);
            const grossNum =
              typeof r.gross_total_php === 'string'
                ? Number(r.gross_total_php)
                : r.gross_total_php;
            return (
              <li key={r.receipt_id}>
                <Link
                  href={`/receipts/${r.receipt_id}`}
                  className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-terracotta/[0.03] sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink sm:text-base">
                        TXN-{new Date(r.issued_at).getFullYear()}-
                        {String(r.or_serial).padStart(6, '0')}
                      </span>
                    </div>
                    <p className="text-xs text-ink/55">
                      {order?.description ?? 'Setnayan order'} ·{' '}
                      {formatPhp(grossNum)} ·{' '}
                      {formatRelativeDate(r.issued_at)}
                    </p>
                  </div>
                  <ExternalLink
                    aria-hidden
                    className="mt-1 h-4 w-4 flex-shrink-0 text-ink/35"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {/* Suppress unused-var warning for eventId — only used by the
       *  empty-state CTA and the receipts route is public-receipt
       *  anchored, not event-scoped, so no other uses. */}
      <span className="sr-only">{eventId}</span>
    </section>
  );
}

// ----- Shared building blocks --------------------------------------

function SectionHeader({
  id,
  Icon,
  label,
  count,
  href,
  cta,
}: {
  id: string;
  Icon: typeof FileText;
  label: string;
  count: number;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-2">
      <h2 id={id} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <span>{label}</span>
        {count > 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
            {count}
          </span>
        ) : null}
      </h2>
      {href && cta ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 hover:text-terracotta-800"
        >
          {cta} <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}

function SectionEmpty({
  message,
  ctaLabel,
  href,
}: {
  message: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/50 p-6 text-center">
      <p className="text-sm text-ink/65">{message}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 hover:text-terracotta-800"
      >
        {ctaLabel} <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
      </Link>
    </div>
  );
}

function StatusPill({
  label,
  toneClass,
}: {
  label: string;
  toneClass: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function formatRelativeDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Suppress unused-import warning — Clock + CheckCircle2 + XCircle + OrderStatus
// are retained for future status-icon expansion when receipts pick up a
// `status` of their own.
void Clock;
void CheckCircle2;
void XCircle;
const _OrderStatusKeepImport: OrderStatus = 'paid';
void _OrderStatusKeepImport;
