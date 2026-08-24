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
  ChevronDown,
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
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import type { PlanInstance } from '@/lib/vendor-service-payment-schedules';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { FileUpload } from '@/app/_components/file-upload';
import { VendorDirectPay } from '@/app/dashboard/[eventId]/_components/vendor-direct-pay';
import { SuggestMilestonesButton } from '@/app/dashboard/[eventId]/budget/_components/suggest-milestones-button';
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
  /**
   * The vendor's PUBLISHED off-platform payment destinations, fetched
   * server-side by the caller via fetchPublishedMethodsForCouple (couples
   * pay vendors directly; Setnayan never holds the money). Defaults to []
   * — for off-platform/manual vendors the helper returns [] and the
   * VendorDirectPay block renders a quiet "coordinate in chat" hint.
   */
  directPayMethods?: CoupleFacingMethod[];
  /**
   * The booking's frozen PAYMENT PLAN installments (Phase 2 PR-B/PR-C),
   * fetched server-side by the caller from event_vendor_payment_plan. When
   * present + non-empty, the log-payment form surfaces an optional "which
   * installment?" dropdown (label · amount · due) that sets
   * schedule_instance_seq. null/[] = no plan → the dropdown is hidden and the
   * host logs a generic payment, exactly as before.
   */
  installments?: PlanInstance[] | null;
};

export function VendorItemizationCard({
  summary,
  eventId,
  variant = 'card',
  directPayMethods = [],
  installments = null,
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
    paymentsMeasured,
    lineItemsMeasured,
  } = summary;

  /**
   * The ledger ROW — what the archetype shows without being asked: the money,
   * and the notice when a read was refused. On /budget this is the summary of
   * a collapsed card; in the workspace embed it simply leads, as before.
   */
  /**
   * The refused-read alert. It used to live inside `ledgerRow`, which on
   * /budget put a paragraph of error prose INSIDE the `<summary>` — and a
   * `<summary>` is announced as one control whose name is everything inside
   * it, so a screen-reader user heard the failure notice read out as part of
   * the button's label before they could act on it. It is an alert ABOUT the
   * card, not part of the row, so it now sits above the disclosure on both
   * variants: still always visible, no longer part of a control's name.
   *
   * A refused read must never render as a money figure. `paidTotal` of 0 makes
   * `remaining` the FULL total, so an unmeasured payments read does not merely
   * hide what you paid — it bills you for it again. Both figures derive from
   * that one read, so both go together; "Budget" is kept because it survives on
   * the headline figure, and flagged when its own line-items read was refused.
   */
  const refusedReadNotice = paymentsMeasured ? null : (
    <div
      role="status"
      className="mx-5 mt-3 rounded-lg border-t-[3px] border-mulberry/70 bg-mulberry/5 px-3 py-2 text-xs text-ink/70"
    >
      We couldn&rsquo;t load your payments for this supplier, so what
      you&rsquo;ve paid and what&rsquo;s left aren&rsquo;t shown. Nothing has
      changed &mdash; refresh to try again.
    </div>
  );

  const ledgerRow = (
    <>
      {/* 🏷 A REAL <dl>. These are term/figure pairs and always were, but the
          <dt>/<dd> sat inside a plain <div>, which leaves them orphaned: with
          no <dl> ancestor the description-list semantics are dropped entirely
          and assistive tech reads six unrelated fragments instead of three
          labelled amounts. `dl > div > dt + dd` is the valid grouping form, so
          Money's own wrapper is unchanged. (Repo-wide this shape appears in
          three files; the other two are outside this screen and are reported,
          not touched.) */}
      <dl className="grid gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-3">
        <Money
          label={lineItemsMeasured ? 'Budget' : 'Budget (partly loaded)'}
          value={formatPhp(itemizedTotal)}
        />
        <Money label="Paid" value={paymentsMeasured ? formatPhp(paidTotal) : '—'} tone="muted" />
        <Money
          label="Remaining"
          value={paymentsMeasured ? formatPhp(remaining) : '—'}
          tone={paymentsMeasured && remaining > 0 ? 'warn' : 'good'}
        />
      </dl>
    </>
  );

  /**
   * The HISTORY — line items and the dated payment log. "Summary first, history
   * on demand" (Ledger archetype, designer's note 3), so on /budget this lives
   * behind the row rather than beside it.
   */
  const workingSections = (
    <div className="grid gap-0 border-t border-ink/10 lg:grid-cols-2 lg:divide-x lg:divide-ink/10">
        <LineItemSection
          priceSource={priceSource}
          vendorControlledItems={vendorControlledItems}
          lineItems={lineItems}
          eventId={eventId}
          vendorId={vendor.vendor_id}
          vendorMarketplaceId={vendor.marketplace_vendor_id}
          suggestTotalPhp={itemizedTotal}
        />
        <PaymentSection
          payments={payments}
          lineItems={lineItems}
          vendorControlledItems={vendorControlledItems}
          eventId={eventId}
          vendorId={vendor.vendor_id}
          vendorName={vendor.vendor_name}
          directPayMethods={directPayMethods}
          installments={installments}
        />
    </div>
  );

  // 'embed' variant — no outer <article>, no header, no status pill. The
  // workspace page wraps this in its own Payments <section>.
  if (variant === 'embed') {
    return (
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
        {refusedReadNotice}
        {ledgerRow}
        {workingSections}
      </div>
    );
  }

  // 'card' variant — full shell used on /budget.
  //
  // 🪧 THE ANCHOR SERVES NOBODY YET, AND THAT IS NOW SAID OUT LOUD. A comment
  // here claimed the workspace page's "Add milestone" CTA deep-links to
  // `/budget#vendor-${vendor_id}`. Grepped: there is exactly ONE occurrence of
  // that URL shape in the repo and it was the comment itself — no caller has
  // ever existed. The id + `scroll-mt-24` are kept because they are the right
  // landing spot if one is ever built, but whoever builds it must know the
  // card is now COLLAPSED on arrival: point the fragment at something INSIDE
  // the <details> (browsers open the ancestor disclosure for a fragment target)
  // rather than at the <article>, or the visitor lands on a shut row.
  //
  // 📖 SUMMARY FIRST, HISTORY ON DEMAND (Ledger archetype, designer's note 3:
  // "Each row expands to its dated payments and receipts; collapsed, the ledger
  // stays one screen of truth"). The card used to hold every supplier's full
  // line-item table and payment log open at once, so a couple with eight
  // suppliers scrolled past eight open ledgers to reach the eighth. Collapsed,
  // the row still carries everything the archetype puts on a row — who, what
  // kind, where the booking stands, and Budget / Paid / Remaining — and the
  // history opens on a tap.
  //
  // ⚠ NOT a client component and deliberately so: `<details>` is the browser's
  // own disclosure, so this stays a server component, keeps working with no
  // JavaScript, and announces its own expanded state. The forms inside it are
  // the same server actions, unmoved.
  //
  // ⚠ THE GROUP IS NAMED, AND IT HAS TO BE. A bare `className="group"` here
  // becomes an ancestor `.group` for the whole card, and `group-hover:` matches
  // ANY `.group` ancestor rather than the nearest — so hovering the header lit
  // up a `group-hover:` chevron three components deep in vendor-direct-pay, as
  // if that button were under the cursor. `group/ledger` + `group-open/ledger:`
  // keeps this disclosure's state to itself.
  //
  // ⚠ 'embed' NEVER COLLAPSES — and the reason first written here was FALSE.
  // It said the workspace page already wraps this card in a Payments
  // disclosure. It does not: that page contains zero `<details>` of any kind.
  // The true reason is simpler — the workspace IS the page for one supplier,
  // reached by choosing that supplier, and folding away the only thing it
  // exists to show is a door in front of the room you asked for. On /budget the
  // fold earns its keep because there are N suppliers to scroll past; there,
  // there is one.
  return (
    <article
      id={`vendor-${vendor.vendor_id}`}
      className="overflow-hidden rounded-xl border border-ink/10 bg-cream scroll-mt-24"
    >
      {refusedReadNotice}
      <details className="group/ledger">
        <summary className="cursor-pointer list-none pb-1 pt-4 transition-colors hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5">
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
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  VENDOR_STATUS_TONE[vendor.status]
                }`}
              >
                {VENDOR_STATUS_LABEL[vendor.status]}
              </span>
              {/* Decoration: a <summary> already carries its own expanded
                  state, so these words would otherwise be read out as part of
                  the control's name for no gain. */}
              <span
                aria-hidden
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45 group-open/ledger:hidden"
              >
                Open
              </span>
              <span
                aria-hidden
                className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45 group-open/ledger:inline"
              >
                Close
              </span>
              <ChevronDown
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink/45 transition-transform group-open/ledger:rotate-180"
                strokeWidth={2}
              />
            </div>
          </div>

          {ledgerRow}
        </summary>

        {workingSections}
      </details>
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
      className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-warn-800"
      title="The vendor hasn't published pricing yet. Ask them in chat."
    >
      Awaiting pricing
    </span>
  );
}

/**
 * One ledger cell — a money figure under its own micro-label.
 *
 * 🔤 THE FIGURE IS SET IN THE MONO FACE, and that is the archetype's rule, not
 * a preference: the binding Ledger archetype asks for "every numeral … in Space
 * Mono like a bank book" so magnitude scans down one edge. This cell set its
 * LABEL in mono and its FIGURE in the body face until 2026-08-25, which put the
 * word "Paid" on the budget screen twice in two different typefaces — once over
 * a mono figure in payment progress, once over a body-face figure here.
 * Pinned by budget/money-wears-the-ledger-face.test.ts.
 */
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
        className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-success-700'
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
  suggestTotalPhp,
}: {
  priceSource: VendorPriceSource;
  vendorControlledItems: VendorControlledLineItem[];
  lineItems: LineItemRow[];
  eventId: string;
  vendorId: string;
  vendorMarketplaceId: string | null;
  suggestTotalPhp: number;
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
        <div className="space-y-2 rounded-md border border-dashed border-warn-300/60 bg-warn-50/60 px-3 py-3 text-sm">
          <p className="text-ink/75">
            This vendor hasn&rsquo;t shared pricing yet. Their catalog will appear
            here once they publish it.
          </p>
          <Link
            href={`/dashboard/${eventId}/messages?vendor=${vendorMarketplaceId ?? ''}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-warn-400/50 bg-cream px-2.5 py-1 text-xs font-medium text-warn-900 hover:border-warn-500 hover:text-warn-950"
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
                  <ConfirmForm
                    action={deleteLineItem}
                    title="Delete this line item?"
                    message="It’s removed from this vendor’s budget — you can add it back anytime."
                    confirmLabel="Delete"
                  >
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="line_item_id" value={li.line_item_id} />
                    <SubmitButton
                      aria-label="Delete line item"
                      pendingLabel=""
                      className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-danger-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {priceSource === 'manual' ? (
        <>
          {!hasManual ? (
            <div className="space-y-2">
              <p className="text-xs text-ink/55">
                No line items yet — add a Deposit, Balance, or Tip below.
              </p>
              {/* One-click split — only when there's a total to divide. Seeds an
                  editable Deposit 50% + Balance 50% so the live "next payments"
                  list + .ics export populate without typing each milestone. */}
              {suggestTotalPhp > 0 ? (
                <SuggestMilestonesButton eventId={eventId} vendorId={vendorId} />
              ) : null}
            </div>
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
              min={0.01}
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
              className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:col-span-4"
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
              min={0.01}
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
              className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:col-span-4"
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
  vendorName,
  directPayMethods,
  installments,
}: {
  payments: PaymentRow[];
  lineItems: LineItemRow[];
  vendorControlledItems: VendorControlledLineItem[];
  eventId: string;
  vendorId: string;
  vendorName: string;
  directPayMethods: CoupleFacingMethod[];
  installments?: PlanInstance[] | null;
}) {
  const hasVendorControlled = vendorControlledItems.length > 0;
  const planInstallments = installments ?? [];
  const hasInstallments = planInstallments.length > 0;
  return (
    <section className="space-y-3 p-5">
      {/* Off-platform direct-pay surface — the vendor's published payment
          destinations + the always-on "Setnayan doesn't hold this money"
          disclosure. Rendered just above the payment log so the host sees
          HOW to pay before they record THAT they paid. Methods are fetched
          server-side via the secure helper (see budget/page.tsx). */}
      <VendorDirectPay vendorName={vendorName} methods={directPayMethods} />

      <header className="flex items-center gap-2">
        <Receipt aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={1.75} />
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
                className="flex items-start justify-between gap-2 rounded-md bg-success-50/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-success-900">
                    {line ? line.label : fallbackLabel}
                  </p>
                  <p className="text-xs text-success-900/75">
                    {p.paid_at}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.reference ? ` · ref ${p.reference}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-success-900">
                    {formatPhp(p.amount_php)}
                  </span>
                  <ConfirmForm
                    action={deletePayment}
                    title="Remove this logged payment?"
                    message="The running total updates — log it again if you remove it by mistake."
                    confirmLabel="Delete"
                  >
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="payment_id" value={p.payment_id} />
                    <SubmitButton
                      aria-label="Delete payment"
                      pendingLabel=""
                      className="rounded-md p-1 text-success-900/50 hover:bg-success-900/5 hover:text-danger-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Default-then-disclose: the 5-field log stays out of the way until the
          host actually has a payment to record (it's the page's busiest form). */}
      <details className="group border-t border-ink/10 pt-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-success-700 hover:text-success-800">
          <Plus aria-hidden className="h-3 w-3" strokeWidth={2} />
          Log a payment
        </summary>
        <form
          action={logPayment}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="vendor_id" value={vendorId} />
        {/* Optional installment attribution (Phase 2 PR-C). Only shown when the
            booking has a frozen payment plan — sets schedule_instance_seq so the
            vendor sees WHICH installment this payment is for when they confirm.
            "Not tied to an installment" = leave NULL (a generic payment). */}
        {hasInstallments ? (
          <select
            name="schedule_instance_seq"
            defaultValue=""
            aria-label="Which installment?"
            className="input-field col-span-2 h-9 py-0 text-xs sm:col-span-4"
          >
            <option value="">Not tied to an installment</option>
            {planInstallments.map((inst) => (
              <option key={inst.seq} value={inst.seq}>
                {inst.label}
                {inst.amount_php != null ? ` · ${formatPhp(inst.amount_php)}` : ''}
                {inst.due_date ? ` · due ${inst.due_date}` : ''}
              </option>
            ))}
          </select>
        ) : null}
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
          min={0.01}
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
        {/* Optional receipt screenshot — couples pay vendors off-platform, so
            this is their own record of the transfer (not a Setnayan-verified
            proof). Emits an `r2://thread-files/…` ref via a hidden input that
            logPayment reads as `proof_r2_key`.

            🔒 PRIVATE BUCKET, deliberately. This wrote to `media` until
            2026-07-30 — the one publicly-served bucket (`PUBLIC_MEDIA_BUCKET`
            in lib/booth-studio.ts, fetched unsigned). These are bank-transfer
            screenshots carrying reference numbers, partial account numbers and
            names: the same PII class as Setnayan-checkout proofs, which already
            route to `thread-files` via bucketForPrefix(). "The host's own
            record" describes whose data it is, not how exposed it may be.

            ⚠ "There is currently NO reader" was true when written and is NOT
            true now — `lib/vendor-service-payment-schedules.server.ts` has read
            this since 2026-06-20 and renders it on three live vendor routes. It
            resolves through `displayUrlForStoredAsset()` (lib/uploads.ts), which
            signs a short-lived GET; never interpolate the key into a public URL.
            The reader existed while the upload was refused outright, so the
            vendor's screen had a slot for a receipt that could never arrive. */}
        <div className="col-span-2 sm:col-span-4">
          <FileUpload
            name="proof_r2_key"
            bucket="thread-files"
            pathPrefix={`payment-proof/events/${eventId}`}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            label="Attach receipt (optional)"
            variant="wide"
          />
        </div>
        <SubmitButton
          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-success-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-success-800 disabled:opacity-70 sm:col-span-4"
          pendingLabel="Logging…"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Log
        </SubmitButton>
        </form>
      </details>
    </section>
  );
}
